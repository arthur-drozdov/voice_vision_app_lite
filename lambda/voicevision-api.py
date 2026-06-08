"""
VoiceVision API Lambda v14 — Notifications: persistent session routing + webhook + polling

Architecture:
  Browser → API Gateway WebSocket → Lambda → Tailscale → Gateway /v1/chat/completions (SSE)
  OpenClaw cron → Function URL POST /webhook → Lambda → DynamoDB → WebSocket (real-time)
  Browser → WebSocket get_notifications (poll every 30s) → Lambda → DynamoDB → response

Session routing:
  $connect → store {userId, connectionId} in voicevision-memory (SK: _wsconn)
  $disconnect → delete
  Webhook → lookup connectionId → post_to_connection OR store for polling

Tables (single DynamoDB table: voicevision-memory):
  - Memories:  PK=userId, SK=session#... | global#... | prefs#...
  - Connection: PK=userId, SK=_wsconn  (data: {connectionId, lastSeen})
  - Notifications: PK=userId, SK=notif#<id>  (data: {message, type, createdAt, read, delivered})
"""

import json, os, boto3, subprocess, time, ssl, http.client, urllib.request, urllib.error, uuid
from datetime import datetime

TS_SOCKET = "/tmp/tailscale/tailscaled.sock"
TS_DIR = "/tmp/tailscale"

GATEWAY_HOST = "gateway.example.com"
GATEWAY_PORT = 18789
GATEWAY_TOKEN = os.environ.get("OPENCLAW_GATEWAY_WS_TOKEN",
    "***REDACTED-GATEWAY-TOKEN***")

AGENTS = {"eden": "eden", "noe": "noe", "flo": "flo", 
          "spark": "spark", "luna": "luna"}

MEMORY_TABLE = "voicevision-memory"
dynamodb = boto3.client("dynamodb", region_name="us-east-1")

# Max time to spend streaming.  API Gateway WebSocket may terminate the
# handler at 29s, but post_to_connection calls continue to work while the
# Lambda container is alive (up to 180s).  Set generously for reasoning models.
STREAM_TIMEOUT_S = 80

_tailscale_ready = False

def ensure_tailscale():
    global _tailscale_ready
    if _tailscale_ready:
        # Quick liveness check — proxy may have died in warm container
        try:
            r = subprocess.run(["/var/task/tailscale", f"--socket={TS_SOCKET}", "status", "--json"],
                capture_output=True, text=True, timeout=3)
            if r.returncode == 0 and "Tailscale is stopped" not in r.stdout:
                return  # Actually alive
        except:
            pass
        # Proxy is dead — force re-init
        print("Tailscale proxy stale, re-initializing")
        _tailscale_ready = False
    
    # Kill any existing tailscaled and clean up stale socket
    try:
        subprocess.run(["pkill", "-9", "tailscaled"], timeout=2,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(0.3)
    except:
        pass
    for path in [TS_SOCKET, f"{TS_SOCKET}.lock"]:
        try:
            os.unlink(path)
        except:
            pass
    
    os.makedirs(TS_DIR, exist_ok=True)
    auth_key = os.environ.get("TAILSCALE_AUTHKEY", "")
    hostname = f"vv-{os.getpid()}"
    
    print(f"Starting tailscaled...")
    subprocess.Popen(
        ["/var/task/tailscaled", "--tun=userspace-networking",
         "--socks5-server=localhost:1055", "--outbound-http-proxy-listen=localhost:1056",
         f"--statedir={TS_DIR}", f"--socket={TS_SOCKET}"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    # Wait for socket to appear
    for _ in range(30):
        if os.path.exists(TS_SOCKET):
            break
        time.sleep(0.2)
    time.sleep(0.5)
    
    print(f"Running tailscale up...")
    r = subprocess.run(["/var/task/tailscale", f"--socket={TS_SOCKET}", "up",
         f"--auth-key={auth_key}", f"--hostname={hostname}",
         "--force-reauth", "--reset", "--timeout=30s"],
        capture_output=True, text=True, timeout=35)
    print(f"tailscale up: rc={r.returncode} stdout={r.stdout[:100]}")
    
    if r.returncode != 0:
        raise RuntimeError(f"tailscale up failed: {r.stderr[:300]}")
    
    # Give the HTTP proxy a moment to start accepting connections
    time.sleep(1)
    
    _tailscale_ready = True
    os.environ["HTTP_PROXY"] = "http://localhost:1056"
    os.environ["HTTPS_PROXY"] = "http://localhost:1056"
    print(f"Tailscale ready as {hostname}")


def send_ws(domain, stage, conn_id, data):
    """Send a message to a WebSocket connection."""
    try:
        client = boto3.client('apigatewaymanagementapi',
            endpoint_url=f"https://{domain}/{stage}")
        client.post_to_connection(ConnectionId=conn_id,
            Data=json.dumps(data).encode())
    except Exception as e:
        print(f"ws send error: {e}")


def send_ws_by_connid(conn_id, data):
    """Send a message by connection ID (uses known domain/stage)."""
    try:
        client = boto3.client('apigatewaymanagementapi',
            endpoint_url="https://184z3y4uxi.execute-api.us-east-1.amazonaws.com/prod")
        client.post_to_connection(ConnectionId=conn_id,
            Data=json.dumps(data).encode())
        return True
    except Exception as e:
        print(f"ws send by connid error: {e}")
        return False


# ── Connection Tracking ──────────────────────────────────────────────

def store_connection(user_id, conn_id):
    """Store WebSocket connection mapping for real-time notification delivery."""
    try:
        dynamodb.put_item(
            TableName=MEMORY_TABLE,
            Item={
                "userId": {"S": user_id},
                "memoryId": {"S": "_wsconn"},
                "data": {"S": json.dumps({
                    "connectionId": conn_id,
                    "lastSeen": datetime.utcnow().isoformat() + "Z"
                })},
                "updatedAt": {"S": datetime.utcnow().isoformat() + "Z"}
            }
        )
        print(f"Connection stored: {user_id} -> {conn_id}")
    except Exception as e:
        print(f"store_connection error: {e}")


def delete_connection(user_id):
    """Remove connection mapping on disconnect."""
    try:
        dynamodb.delete_item(
            TableName=MEMORY_TABLE,
            Key={"userId": {"S": user_id}, "memoryId": {"S": "_wsconn"}}
        )
        print(f"Connection removed: {user_id}")
    except Exception as e:
        print(f"delete_connection error: {e}")


def get_connection(user_id):
    """Look up the current WebSocket connectionId for a user."""
    try:
        resp = dynamodb.get_item(
            TableName=MEMORY_TABLE,
            Key={"userId": {"S": user_id}, "memoryId": {"S": "_wsconn"}}
        )
        item = resp.get('Item')
        if item:
            data = json.loads(item.get('data', {}).get('S', '{}'))
            return data.get('connectionId')
    except Exception as e:
        print(f"get_connection error: {e}")
    return None


# ── Notification Storage ─────────────────────────────────────────────

def save_notification(user_id, message, notif_type="reminder"):
    """Store a notification for a user."""
    notif_id = f"notif#{uuid.uuid4().hex[:12]}"
    now = datetime.utcnow().isoformat() + "Z"
    try:
        dynamodb.put_item(
            TableName=MEMORY_TABLE,
            Item={
                "userId": {"S": user_id},
                "memoryId": {"S": notif_id},
                "data": {"S": json.dumps({
                    "message": message,
                    "type": notif_type,
                    "createdAt": now,
                    "read": False,
                    "delivered": False
                })},
                "updatedAt": {"S": now}
            }
        )
        print(f"Notification saved: {notif_id} for {user_id}")
        return notif_id
    except Exception as e:
        print(f"save_notification error: {e}")
        return None


def get_notifications(user_id, mark_as_delivered=True):
    """Get unread notifications for a user. Optionally mark as delivered."""
    try:
        resp = dynamodb.query(
            TableName=MEMORY_TABLE,
            KeyConditionExpression="#uid = :uid AND begins_with(#mid, :prefix)",
            ExpressionAttributeNames={"#uid": "userId", "#mid": "memoryId"},
            ExpressionAttributeValues={
                ":uid": {"S": user_id},
                ":prefix": {"S": "notif#"}
            },
            ScanIndexForward=True,
            Limit=20
        )
        items = resp.get('Items', [])
        notifications = []
        for item in items:
            data = json.loads(item.get('data', {}).get('S', '{}'))
            if not data.get('read'):
                data['notificationId'] = item.get('memoryId', {}).get('S', '')
                notifications.append(data)
        
        # Mark as delivered if there's an active connection
        if mark_as_delivered and notifications:
            for n in notifications:
                nid = n.get('notificationId')
                if nid:
                    try:
                        # Update read status to delivered
                        data_copy = dict(n)
                        data_copy['delivered'] = True
                        del data_copy['notificationId']
                        dynamodb.update_item(
                            TableName=MEMORY_TABLE,
                            Key={"userId": {"S": user_id}, "memoryId": {"S": nid}},
                            UpdateExpression="SET #d = :d",
                            ExpressionAttributeNames={"#d": "data"},
                            ExpressionAttributeValues={":d": {"S": json.dumps(data_copy)}}
                        )
                    except Exception as e:
                        print(f"mark delivered error: {e}")
        
        return notifications
    except Exception as e:
        print(f"get_notifications error: {e}")
        return []


def ack_notification(user_id, notif_id):
    """Mark a notification as read (delete it)."""
    try:
        dynamodb.delete_item(
            TableName=MEMORY_TABLE,
            Key={"userId": {"S": user_id}, "memoryId": {"S": notif_id}}
        )
        return True
    except Exception as e:
        print(f"ack_notification error: {e}")
        return False


# ── Webhook Handler (Function URL) ────────────────────────────────────

def handle_webhook(event):
    """Handle POST /webhook — receives cron announcements from OpenClaw."""
    print(f"Webhook received: {json.dumps(event, default=str)[:500]}")
    
    http_method = event.get('requestContext', {}).get('http', {}).get('method', 'GET')
    raw_path = event.get('rawPath', '/')
    
    if http_method == 'GET':
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({"ok": True, "service": "voicevision-webhook"})
        }
    
    if http_method != 'POST':
        return {'statusCode': 405, 'body': 'Method Not Allowed'}
    
    try:
        body = json.loads(event.get('body', '{}'))
    except json.JSONDecodeError:
        return {'statusCode': 400, 'body': 'Invalid JSON'}
    
    user_id = body.get('userId', '')
    message = body.get('message', '')
    notif_type = body.get('type', 'reminder')
    
    if not user_id or not message:
        return {'statusCode': 400, 'body': json.dumps({"error": "userId and message required"})}
    
    # Store notification
    notif_id = save_notification(user_id, message, notif_type)
    
    # Try real-time delivery if user is online
    conn_id = get_connection(user_id)
    delivered = False
    if conn_id:
        delivered = send_ws_by_connid(conn_id, {
            "type": "notification",
            "notificationId": notif_id,
            "message": message,
            "notificationType": notif_type
        })
        if delivered:
            print(f"Real-time delivery to {user_id} via {conn_id}")
            # Mark as delivered
            ack_notification(user_id, notif_id)
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({
            "ok": True,
            "notificationId": notif_id,
            "delivered": delivered,
            "storedForPolling": not delivered
        })
    }


# ── Main Lambda Handler ───────────────────────────────────────────────

def lambda_handler(event, context):
    global _tailscale_ready
    
    # ── Function URL (REST) events ──────────────────────────
    if 'rawPath' in event or ('requestContext' in event and 'http' in event.get('requestContext', {})):
        return handle_webhook(event)
    
    # ── WebSocket events ────────────────────────────────────
    route = event.get('requestContext', {}).get('routeKey', '$default')
    conn_id = event['requestContext']['connectionId']
    domain = event['requestContext']['domainName']
    stage = event['requestContext']['stage']
    
    # Extract userId from query string parameters (set by frontend on connect)
    user_id = None
    qs = event.get('queryStringParameters', {}) or {}
    user_id = qs.get('userId', '')
    
    if route == '$connect':
        print(f"Connected: {conn_id}" + (f" user={user_id[:12]}" if user_id else ""))
        if user_id:
            store_connection(user_id, conn_id)
        return {'statusCode': 200}
    
    if route == '$disconnect':
        print(f"Disconnected: {conn_id}")
        # Find and delete connection by scanning for this conn_id
        # (userId not available on disconnect)
        try:
            # We need to find which userId had this connectionId
            # Use a scan with filter — lightweight for our scale
            resp = dynamodb.scan(
                TableName=MEMORY_TABLE,
                FilterExpression="#mid = :mid",
                ExpressionAttributeNames={"#mid": "memoryId"},
                ExpressionAttributeValues={":mid": {"S": "_wsconn"}},
                Limit=10
            )
            for item in resp.get('Items', []):
                data = json.loads(item.get('data', {}).get('S', '{}'))
                if data.get('connectionId') == conn_id:
                    uid = item.get('userId', {}).get('S', '')
                    delete_connection(uid)
                    break
        except Exception as e:
            print(f"disconnect cleanup error: {e}")
        return {'statusCode': 200}
    
    # ── All other routes need Tailscale ─────────────────────
    if not _tailscale_ready:
        ensure_tailscale()
    
    body = json.loads(event.get('body', '{}'))
    msg_type = body.get('type', 'chat')
    
    if msg_type == 'hello':
        # Track userId from hello message (fallback if not in connect URL)
        hello_user_id = body.get('userId', user_id or conn_id[:12])
        if not user_id and hello_user_id:
            store_connection(hello_user_id, conn_id)
        
        send_ws(domain, stage, conn_id, {
            "type": "hello", "version": "2.0.0",
            "agents": list(AGENTS.keys()), "status": "connected"
        })
        return {'statusCode': 200}
    
    if msg_type == 'ping':
        # Keepalive ping — prevent API Gateway idle timeout
        send_ws(domain, stage, conn_id, {"type": "pong"})
        return {'statusCode': 200}
    
    # ── Notification handlers ──────────────────────────────
    
    if msg_type == 'get_notifications':
        notif_user_id = body.get('userId', user_id or conn_id[:12])
        notifications = get_notifications(notif_user_id)
        send_ws(domain, stage, conn_id, {
            "type": "notifications",
            "notifications": notifications,
            "count": len(notifications)
        })
        return {'statusCode': 200}
    
    if msg_type == 'ack_notification':
        notif_user_id = body.get('userId', user_id or conn_id[:12])
        notif_id = body.get('notificationId', '')
        if notif_id:
            ack_notification(notif_user_id, notif_id)
            send_ws(domain, stage, conn_id, {
                "type": "notification_acked",
                "notificationId": notif_id
            })
        return {'statusCode': 200}
    
    # ── Memory handlers ────────────────────────────────────
    
    if msg_type == 'memory_get':
        mem_user_id = body.get('userId', conn_id[:12])
        memory_type = body.get('memoryType', 'all')  # 'all', 'session', 'global', 'preferences'
        
        try:
            items = []
            if memory_type == 'all':
                # Query all memories for this user
                resp = dynamodb.query(
                    TableName=MEMORY_TABLE,
                    KeyConditionExpression="#uid = :uid",
                    ExpressionAttributeNames={"#uid": "userId"},
                    ExpressionAttributeValues={":uid": {"S": mem_user_id}},
                    ScanIndexForward=False,  # newest first
                    Limit=50
                )
                items = resp.get('Items', [])
            else:
                # Query by memory type prefix
                resp = dynamodb.query(
                    TableName=MEMORY_TABLE,
                    KeyConditionExpression="#uid = :uid AND begins_with(#mid, :prefix)",
                    ExpressionAttributeNames={"#uid": "userId", "#mid": "memoryId"},
                    ExpressionAttributeValues={
                        ":uid": {"S": mem_user_id},
                        ":prefix": {"S": f"{memory_type}#"}
                    },
                    ScanIndexForward=False,
                    Limit=50
                )
                items = resp.get('Items', [])
            
            # Parse DynamoDB items to clean objects (exclude system items)
            memories = []
            for item in items:
                mid = item.get('memoryId', {}).get('S', '')
                if mid.startswith('_') or mid.startswith('notif#'):
                    continue  # Skip system/notification items
                mem = json.loads(item.get('data', {}).get('S', '{}'))
                mem['memoryId'] = mid
                mem['userId'] = item.get('userId', {}).get('S', '')
                mem['updatedAt'] = item.get('updatedAt', {}).get('S', '')
                memories.append(mem)
            
            send_ws(domain, stage, conn_id, {
                "type": "memory_list",
                "memories": memories,
                "count": len(memories)
            })
        except Exception as e:
            print(f"memory_get error: {e}")
            send_ws(domain, stage, conn_id, {"type": "error", "error": f"Memory fetch failed: {str(e)[:200]}"})
        
        return {'statusCode': 200}
    
    if msg_type == 'memory_add':
        mem_user_id = body.get('userId', conn_id[:12])
        memory_type = body.get('memoryType', 'session')  # 'session', 'global', 'preferences'
        data = body.get('data', {})
        memory_id = body.get('memoryId', f"{memory_type}#{uuid.uuid4().hex[:12]}")
        
        try:
            dynamodb.put_item(
                TableName=MEMORY_TABLE,
                Item={
                    "userId": {"S": mem_user_id},
                    "memoryId": {"S": memory_id},
                    "data": {"S": json.dumps(data)},
                    "updatedAt": {"S": datetime.utcnow().isoformat() + "Z"}
                }
            )
            send_ws(domain, stage, conn_id, {
                "type": "memory_saved",
                "memoryId": memory_id,
                "status": "ok"
            })
        except Exception as e:
            print(f"memory_add error: {e}")
            send_ws(domain, stage, conn_id, {"type": "error", "error": f"Memory save failed: {str(e)[:200]}"})
        
        return {'statusCode': 200}
    
    if msg_type == 'memory_delete':
        mem_user_id = body.get('userId', conn_id[:12])
        memory_id = body.get('memoryId', '')
        
        if not memory_id:
            send_ws(domain, stage, conn_id, {"type": "error", "error": "memoryId required"})
            return {'statusCode': 200}
        
        try:
            dynamodb.delete_item(
                TableName=MEMORY_TABLE,
                Key={
                    "userId": {"S": mem_user_id},
                    "memoryId": {"S": memory_id}
                }
            )
            send_ws(domain, stage, conn_id, {
                "type": "memory_deleted",
                "memoryId": memory_id,
                "status": "ok"
            })
        except Exception as e:
            print(f"memory_delete error: {e}")
            send_ws(domain, stage, conn_id, {"type": "error", "error": f"Memory delete failed: {str(e)[:200]}"})
        
        return {'statusCode': 200}
    
    # ── Chat handler ────────────────────────────────────────
    
    if msg_type == 'chat':
        character = body.get('character', 'eden')
        text = body.get('text', '')
        system_prompt = body.get('systemPrompt', '')
        messages = body.get('messages', [])
        
        agent_id = AGENTS.get(character, 'default')
        model = f"openclaw/{agent_id}"
        
        send_ws(domain, stage, conn_id, {"type": "status", "status": "processing"})
        
        # Build OpenAI-compatible body
        req_body = {"model": model, "messages": [], "stream": True, "max_tokens": 2048}
        if system_prompt:
            req_body["messages"].append({"role": "system", "content": system_prompt})
        # Add conversation history
        for msg in (messages or []):
            role = "user" if msg.get("role") == "user" else "assistant"
            req_body["messages"].append({"role": role, "content": msg.get("text", "")})
        # Always append the current message as the last user turn
        if text:
            req_body["messages"].append({"role": "user", "content": text})
        
        start_time = time.time()
        
        # Try up to 2 times (retry once if proxy is stale from warm start)
        for attempt in range(2):
            try:
                ctx = ssl.create_default_context()
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE
                
                url = f"http://{GATEWAY_HOST}:{GATEWAY_PORT}/v1/chat/completions"
                req = urllib.request.Request(url,
                    data=json.dumps(req_body).encode(),
                    headers={
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {GATEWAY_TOKEN}",
                    },
                    method="POST")
                
                resp = urllib.request.urlopen(req, context=ctx, timeout=120)
            
                if resp.status != 200:
                    err_body = resp.read().decode()[:500]
                    print(f"Gateway error {resp.status}: {err_body}")
                    send_ws(domain, stage, conn_id, {"type": "error", "error": f"Gateway error {resp.status}"})
                    return {'statusCode': 200}
                
                # Read SSE stream — use byte buffer to avoid splitting multi-byte UTF-8
                buf = b""
                chunk_count = 0
                empty_reads = 0
                while True:
                    elapsed = time.time() - start_time
                    if elapsed > STREAM_TIMEOUT_S:
                        print(f"Timeout after {chunk_count} chunks, {elapsed:.1f}s")
                        send_ws(domain, stage, conn_id, {"type": "done"})
                        break
                    
                    raw = resp.read(4096)
                    if not raw:
                        # Empty read may be a temporary model pause, not EOF.
                        # Reasoning models can pause 5-15s between token bursts.
                        # Retry up to 30 times (9s total) before treating as stream end.
                        empty_reads += 1
                        if empty_reads > 30:
                            print(f"Stream ended without [DONE] after {chunk_count} chunks")
                            break
                        time.sleep(0.3)
                        continue
                    empty_reads = 0
                    buf += raw
                    
                    # Process complete lines (split on \n byte)
                    while b'\n' in buf:
                        line_bytes, buf = buf.split(b'\n', 1)
                        line = line_bytes.decode('utf-8', errors='replace').strip()
                        
                        if not line or not line.startswith('data: '):
                            continue
                        
                        data = line[6:]
                        if data == '[DONE]':
                            send_ws(domain, stage, conn_id, {"type": "done"})
                            print(f"Stream complete: {chunk_count} chunks, {time.time()-start_time:.1f}s")
                            return {'statusCode': 200}
                        
                        try:
                            event = json.loads(data)
                            delta = event.get('choices', [{}])[0].get('delta', {})
                            content = delta.get('content', '')
                            if content:
                                send_ws(domain, stage, conn_id, {"type": "chunk", "text": content})
                                chunk_count += 1
                        except json.JSONDecodeError:
                            pass
                
                # Stream ended without [DONE]
                send_ws(domain, stage, conn_id, {"type": "done"})
                return {'statusCode': 200}
                
            except Exception as e:
                err_str = str(e)
                # If proxy is dead (warm container stale connection), re-init and retry once
                if attempt == 0 and ("502" in err_str or "Busy" in err_str or "Connection refused" in err_str):
                    print(f"Proxy error on attempt 1: {e}, re-initializing Tailscale")
                    _tailscale_ready = False
                    try:
                        subprocess.run(["pkill", "-9", "tailscaled"], timeout=2,
                                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                        time.sleep(0.5)
                    except:
                        pass
                    ensure_tailscale()
                    continue
                
                print(f"Stream error: {e}")
                send_ws(domain, stage, conn_id, {"type": "error", "error": err_str[:200]})
                return {'statusCode': 200}
        
        # Should not reach here, but just in case
        send_ws(domain, stage, conn_id, {"type": "error", "error": "Max retries exceeded"})
        
        return {'statusCode': 200}
    
    return {'statusCode': 200}
