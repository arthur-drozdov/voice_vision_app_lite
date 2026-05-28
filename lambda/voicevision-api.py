"""
VoiceVision API Lambda v5

Simple, reliable approach:
1. POST to gateway webhook/email (known working) 
2. Returns runId to browser
3. Response arrives via session system

Architecture: Browser → API GW WS → Lambda → Tailscale → Gateway webhook → Agent
"""

import json, os, boto3, subprocess, time, ssl, urllib.request, urllib.error
from datetime import datetime

TS_SOCKET = "/tmp/tailscale/tailscaled.sock"
TS_DIR = "/tmp/tailscale"

def ensure_tailscale():
    if os.path.exists(TS_SOCKET):
        os.environ["HTTP_PROXY"] = "http://localhost:1056"
        os.environ["HTTPS_PROXY"] = "http://localhost:1056"
        return
    os.makedirs(TS_DIR, exist_ok=True)
    auth_key = os.environ.get("TAILSCALE_AUTHKEY", "")
    hostname = f"vv-{os.getpid()}"
    subprocess.Popen(
        ["/var/task/tailscaled", "--tun=userspace-networking",
         "--socks5-server=localhost:1055", "--outbound-http-proxy-listen=localhost:1056",
         f"--statedir={TS_DIR}", f"--socket={TS_SOCKET}"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    r = subprocess.run(["/var/task/tailscale", f"--socket={TS_SOCKET}", "up",
         f"--auth-key={auth_key}", f"--hostname={hostname}",
         "--force-reauth", "--reset", "--timeout=30s"],
        capture_output=True, text=True, timeout=35)
    if r.returncode == 0:
        os.environ["HTTP_PROXY"] = "http://localhost:1056"
        os.environ["HTTPS_PROXY"] = "http://localhost:1056"
        print("Tailscale connected")
    else:
        raise RuntimeError(f"tailscale up failed: {r.stderr[:300]}")

def send_to_client(domain, stage, conn_id, data):
    try:
        client = boto3.client('apigatewaymanagementapi',
            endpoint_url=f"https://{domain}/{stage}")
        client.post_to_connection(ConnectionId=conn_id,
            Data=json.dumps(data).encode())
    except Exception as e:
        print(f"post error: {e}")

GATEWAY_URL = "http://gateway.example.com:18789/webhook/email"
WEBHOOK_TOKEN = os.environ.get('OPENCLAW_AUTH_BEARER',
    'a8c4fdc1295985ade47d10be3a5e68aca4222393bdf846eb72c18dc12920ca24')
AGENTS = {"eden":"eden","noe":"noe","flo":"flo","spark":"spark","luna":"luna"}

def lambda_handler(event, context):
    ensure_tailscale()
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
    
    body = json.loads(event.get('body', '{}'))
    msg_type = body.get('type', 'chat')
    
    if msg_type == 'chat':
        text = body.get('text', '')
        character = body.get('character', 'eden')
        sys_prompt = body.get('systemPrompt', '')
        agent_id = AGENTS.get(character, 'default')
        session_key = f"vv:{conn_id}"
        
        # Send to gateway webhook
        payload = json.dumps({
            "path": "email",
            "event": "chat.message",
            "data": {
                "message": text,
                "agentId": agent_id,
                "sessionKey": session_key,
                "systemPrompt": sys_prompt,
                "timestamp": datetime.utcnow().isoformat(),
            }
        }).encode()
        
        try:
            req = urllib.request.Request(GATEWAY_URL, data=payload,
                headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {WEBHOOK_TOKEN}'},
                method='POST')
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            
            with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
                result = json.loads(resp.read().decode())
                run_id = result.get('runId', '')
                print(f"Agent {agent_id} running: {run_id}")
                
                send_to_client(domain, stage, conn_id, {
                    "type": "status", "status": "processing",
                    "runId": run_id, "sessionKey": session_key
                })
                
                # Agent is thinking — response will follow via sessions
                send_to_client(domain, stage, conn_id, {
                    "type": "chunk",
                    "text": f"[{character} is thinking...]"
                })
                send_to_client(domain, stage, conn_id, {"type": "done"})
                
        except urllib.error.HTTPError as e:
            body_err = e.read().decode()[:300] if e.fp else ''
            print(f"Gateway error {e.code}: {body_err}")
            send_to_client(domain, stage, conn_id, {
                "type": "error", "error": f"Gateway error {e.code}"
            })
        except Exception as e:
            print(f"Error: {e}")
            send_to_client(domain, stage, conn_id, {
                "type": "error", "error": str(e)[:200]
            })
        
        return {'statusCode': 200, 'body': 'ok'}
    
    elif msg_type == 'hello':
        send_to_client(domain, stage, conn_id, {
            "type": "hello", "version": "1.0.0",
            "agents": list(AGENTS.keys()), "status": "connected"
        })
        return {'statusCode': 200, 'body': 'ok'}
    
    return {'statusCode': 200, 'body': 'ok'}
