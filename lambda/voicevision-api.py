"""
VoiceVision API Lambda — WebSocket chat proxy to OpenClaw Gateway

Architecture:
  Browser → API Gateway WebSocket → Lambda (Tailscale) → OpenClaw Gateway
                                           ↓
                                    AWS Transcribe / Polly (voice path)

Mirrors the email-webhook Lambda pattern:
  - Tailscale SOCKS5 proxy to reach home lab K8s cluster
  - OpenClaw gateway at gateway.example.com:18789
  - Auth via Bearer token
  - Streaming via API Gateway Management API (post_to_connection)
"""

import json
import os
import boto3
import subprocess
import time
import urllib.request
import urllib.error
import ssl
import threading
from datetime import datetime

# ── Tailscale setup ──────────────────────────────────────────────────────────
TAILSCALE_SOCKET = "/tmp/tailscale/tailscaled.sock"
TAILSCALE_DIR = "/tmp/tailscale"

def ensure_tailscale():
    """Start tailscaled + connect (persists across warm invocations)."""
    if os.path.exists(TAILSCALE_SOCKET):
        os.environ["HTTP_PROXY"] = "http://localhost:1056"
        os.environ["HTTPS_PROXY"] = "http://localhost:1056"
        return

    os.makedirs(TAILSCALE_DIR, exist_ok=True)
    auth_key = os.environ.get("TAILSCALE_AUTHKEY", "")
    hostname = f"voicevision-{os.getpid()}"

    subprocess.Popen(
        ["/var/task/tailscaled",
         "--tun=userspace-networking",
         "--socks5-server=localhost:1055",
         "--outbound-http-proxy-listen=localhost:1056",
         f"--statedir={TAILSCALE_DIR}",
         f"--socket={TAILSCALE_SOCKET}"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
    )
    time.sleep(1)

    result = subprocess.run(
        ["/var/task/tailscale", f"--socket={TAILSCALE_SOCKET}", "up",
         f"--auth-key={auth_key}", f"--hostname={hostname}",
         "--force-reauth", "--reset", "--timeout=30s"],
        capture_output=True, text=True, timeout=35
    )

    if result.returncode == 0:
        os.environ["HTTP_PROXY"] = "http://localhost:1056"
        os.environ["HTTPS_PROXY"] = "http://localhost:1056"
        print("Tailscale connected")
    else:
        raise RuntimeError(f"tailscale up failed: {result.stderr[:500]}")

# ── API Gateway WebSocket helpers ────────────────────────────────────────────
def get_apigw_endpoint(domain_name: str, stage: str) -> str:
    return f"https://{domain_name}/{stage}"

def send_to_connection(domain: str, stage: str, connection_id: str, data: dict):
    """Send a message to a connected WebSocket client."""
    try:
        client = boto3.client('apigatewaymanagementapi',
            endpoint_url=get_apigw_endpoint(domain, stage))
        client.post_to_connection(
            ConnectionId=connection_id,
            Data=json.dumps(data).encode('utf-8'))
    except Exception as e:
        print(f"Failed to send to {connection_id}: {e}")

# ── OpenClaw gateway communication ───────────────────────────────────────────
GATEWAY_BASE = os.environ.get(
    'OPENCLAW_GATEWAY_URL',
    'http://gateway.example.com:18789'
)
AUTH_BEARER = os.environ.get(
    'OPENCLAW_AUTH_BEARER',
    'a8c4fdc1295985ade47d10be3a5e68aca4222393bdf846eb72c18dc12920ca24'
)

CHARACTER_AGENTS = {
    "eden": "eden",
    "noe": "noe",
    "flo": "flo",
    "spark": "spark",
    "luna": "luna",
}

def send_chat_to_gateway(agent_id: str, message: str, system_prompt: str = None, session_key: str = None) -> dict:
    """
    Send a chat message to the OpenClaw gateway and get the streaming response.
    Uses the webhook endpoint pattern (same as email Lambda).
    """
    webhook_url = f"{GATEWAY_BASE}/webhook/chat"

    payload = {
        "path": "chat",
        "event": "chat.message",
        "data": {
            "message": message,
            "agentId": agent_id,
            "timestamp": datetime.utcnow().isoformat(),
        }
    }

    if system_prompt:
        payload["data"]["systemPrompt"] = system_prompt
    if session_key:
        payload["data"]["sessionKey"] = session_key

    try:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            webhook_url,
            data=data,
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {AUTH_BEARER}',
                'User-Agent': 'VoiceVision-Lambda/1.0',
            },
            method='POST'
        )

        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE

        with urllib.request.urlopen(req, context=ssl_context, timeout=30) as resp:
            result = json.loads(resp.read().decode('utf-8'))
            print(f"Gateway response: {json.dumps(result)[:200]}")
            return {"success": True, "data": result}

    except urllib.error.HTTPError as e:
        body = e.read().decode()[:500] if e.fp else ''
        print(f"Gateway HTTP {e.code}: {body}")
        return {"success": False, "error": f"Gateway error {e.code}"}
    except Exception as e:
        print(f"Gateway error: {e}")
        return {"success": False, "error": str(e)}

def stream_from_gateway(agent_id: str, message: str, connection_id: str, domain: str, stage: str, system_prompt: str = None):
    """
    Send message to gateway and stream chunks back to WebSocket client.
    For now: sends full message, then polls for response.
    """
    import uuid
    session_key = f"voicevision:{connection_id}"

    # Send typing indicator
    send_to_connection(domain, stage, connection_id, {
        "type": "status", "status": "thinking"
    })

    result = send_chat_to_gateway(agent_id, message, system_prompt, session_key)

    if result["success"]:
        response_data = result["data"]
        # The webhook response contains the agent's reply
        reply = response_data.get("reply") or response_data.get("text") or ""
        if reply:
            # Simulate chunks for streaming experience
            words = reply.split()
            chunk_size = 5
            for i in range(0, len(words), chunk_size):
                chunk = " ".join(words[i:i+chunk_size]) + " "
                send_to_connection(domain, stage, connection_id, {
                    "type": "chunk", "text": chunk
                })
            send_to_connection(domain, stage, connection_id, {"type": "done"})
        else:
            # Try nested response
            agent_response = response_data.get("response") or response_data.get("output") or ""
            if agent_response:
                send_to_connection(domain, stage, connection_id, {
                    "type": "chunk", "text": agent_response
                })
            send_to_connection(domain, stage, connection_id, {"type": "done"})
    else:
        send_to_connection(domain, stage, connection_id, {
            "type": "error", "error": result.get("error", "Unknown error")
        })

# ── Lambda handlers ──────────────────────────────────────────────────────────
def handle_connect(event, context):
    """WebSocket $connect — connection established."""
    connection_id = event['requestContext']['connectionId']
    print(f"Client connected: {connection_id}")
    return {'statusCode': 200}

def handle_disconnect(event, context):
    """WebSocket $disconnect — cleanup."""
    connection_id = event['requestContext']['connectionId']
    print(f"Client disconnected: {connection_id}")
    return {'statusCode': 200}

def handle_message(event, context):
    """WebSocket $default — incoming chat message from browser."""
    connection_id = event['requestContext']['connectionId']
    domain = event['requestContext']['domainName']
    stage = event['requestContext']['stage']
    body = json.loads(event.get('body', '{}'))
    msg_type = body.get('type', 'chat')

    print(f"Message from {connection_id}: {msg_type}")

    if msg_type == 'chat':
        text = body.get('text', '')
        character = body.get('character', 'default')
        system_prompt = body.get('systemPrompt', '')

        agent_id = CHARACTER_AGENTS.get(character, 'default')

        # Stream response asynchronously (Lambda will finish but streaming continues via post_to_connection)
        def stream():
            stream_from_gateway(agent_id, text, connection_id, domain, stage, system_prompt)

        # Run in thread so Lambda doesn't wait (API Gateway WebSocket allows outbound after return)
        threading.Thread(target=stream, daemon=True).start()

        return {'statusCode': 200, 'body': 'ok'}

    elif msg_type == 'cancel':
        # Notify gateway to cancel (best effort)
        send_to_connection(domain, stage, connection_id, {"type": "done"})
        return {'statusCode': 200, 'body': 'ok'}

    elif msg_type == 'hello':
        send_to_connection(domain, stage, connection_id, {
            "type": "hello",
            "version": "1.0.0",
            "agents": list(CHARACTER_AGENTS.keys())
        })
        return {'statusCode': 200, 'body': 'ok'}

    return {'statusCode': 200, 'body': 'ok'}

def lambda_handler(event, context):
    """Main entry point — routes based on route key."""
    ensure_tailscale()

    route = event.get('requestContext', {}).get('routeKey', '$default')
    print(f"Route: {route}")

    if route == '$connect':
        return handle_connect(event, context)
    elif route == '$disconnect':
        return handle_disconnect(event, context)
    else:
        return handle_message(event, context)
