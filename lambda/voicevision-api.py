"""
VoiceVision API Lambda v7 — Synchronous SSE Streaming

Architecture:
  Browser → API Gateway WebSocket → Lambda → Tailscale → Gateway /v1/chat/completions (SSE)

The Lambda handler processes the chat request synchronously — it makes a
streaming HTTP request to the gateway, parses SSE tokens, and forwards each
to the browser via post_to_connection. The handler returns when streaming
completes or the API Gateway timeout approaches (25s safety margin for 29s max).
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

# Max time to spend streaming before API Gateway kills us (29s timeout, 25s safe)
STREAM_TIMEOUT_S = 28

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
    try:
        client = boto3.client('apigatewaymanagementapi',
            endpoint_url=f"https://{domain}/{stage}")
        client.post_to_connection(ConnectionId=conn_id,
            Data=json.dumps(data).encode())
    except Exception as e:
        print(f"ws send error: {e}")


def lambda_handler(event, context):
    global _tailscale_ready
    route = event.get('requestContext', {}).get('routeKey', '$default')
    conn_id = event['requestContext']['connectionId']
    domain = event['requestContext']['domainName']
    stage = event['requestContext']['stage']
    
    if route == '$connect':
        print(f"Connected: {conn_id}")
        return {'statusCode': 200}
    
    if route == '$disconnect':
        print(f"Disconnected: {conn_id}")
        return {'statusCode': 200}
    
    # All other routes need Tailscale
    if not _tailscale_ready:
        ensure_tailscale()
    
    body = json.loads(event.get('body', '{}'))
    msg_type = body.get('type', 'chat')
    
    if msg_type == 'hello':
        send_ws(domain, stage, conn_id, {
            "type": "hello", "version": "2.0.0",
            "agents": list(AGENTS.keys()), "status": "connected"
        })
        return {'statusCode': 200}
    
    if msg_type == 'memory_get':
        user_id = body.get('userId', conn_id[:12])
        memory_type = body.get('memoryType', 'all')  # 'all', 'session', 'global', 'preferences'
        
        try:
            items = []
            if memory_type == 'all':
                # Query all memories for this user
                resp = dynamodb.query(
                    TableName=MEMORY_TABLE,
                    KeyConditionExpression="#uid = :uid",
                    ExpressionAttributeNames={"#uid": "userId"},
                    ExpressionAttributeValues={":uid": {"S": user_id}},
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
                        ":uid": {"S": user_id},
                        ":prefix": {"S": f"{memory_type}#"}
                    },
                    ScanIndexForward=False,
                    Limit=50
                )
                items = resp.get('Items', [])
            
            # Parse DynamoDB items to clean objects
            memories = []
            for item in items:
                mem = json.loads(item.get('data', {}).get('S', '{}'))
                mem['memoryId'] = item.get('memoryId', {}).get('S', '')
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
        user_id = body.get('userId', conn_id[:12])
        memory_type = body.get('memoryType', 'session')  # 'session', 'global', 'preferences'
        data = body.get('data', {})
        memory_id = body.get('memoryId', f"{memory_type}#{uuid.uuid4().hex[:12]}")
        
        try:
            dynamodb.put_item(
                TableName=MEMORY_TABLE,
                Item={
                    "userId": {"S": user_id},
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
        user_id = body.get('userId', conn_id[:12])
        memory_id = body.get('memoryId', '')
        
        if not memory_id:
            send_ws(domain, stage, conn_id, {"type": "error", "error": "memoryId required"})
            return {'statusCode': 200}
        
        try:
            dynamodb.delete_item(
                TableName=MEMORY_TABLE,
                Key={
                    "userId": {"S": user_id},
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
                
                resp = urllib.request.urlopen(req, context=ctx, timeout=30)
            
                if resp.status != 200:
                    err_body = resp.read().decode()[:500]
                    print(f"Gateway error {resp.status}: {err_body}")
                    send_ws(domain, stage, conn_id, {"type": "error", "error": f"Gateway error {resp.status}"})
                    return {'statusCode': 200}
                
                # Read SSE stream — use byte buffer to avoid splitting multi-byte UTF-8
                buf = b""
                chunk_count = 0
                while True:
                    elapsed = time.time() - start_time
                    if elapsed > STREAM_TIMEOUT_S:
                        print(f"Timeout after {chunk_count} chunks, {elapsed:.1f}s")
                        send_ws(domain, stage, conn_id, {"type": "done"})
                        break
                    
                    raw = resp.read(4096)
                    if not raw:
                        break
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
