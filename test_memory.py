"""
Backend Memory Test — "The Alex Test"

Connects to the Python bridge WebSocket and runs a 6-step conversation
to verify that conversation history is properly maintained:

1. User: "hello"
2. Assistant: (any reply)
3. User: "my name is Alex"
4. Assistant: (any reply)
5. User: "what is my name?"  → Expected: mentions "Alex"
6. User: "summarise our conversation" → Expected: correct summary

Run:  uv run python test_memory.py
"""

import asyncio
import json
import sys
import time

try:
    import websockets
except ImportError:
    print("Installing websockets...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets"])
    import websockets


WS_URL = "ws://127.0.0.1:8080/chat"
TIMEOUT = 120  # seconds per message


async def send_and_receive(ws, text: str, session_id: str, system_prompt: str | None = None) -> str:
    """Send a message and collect the full response."""
    payload: dict = {"text": text, "thread_id": session_id}
    if system_prompt:
        payload["system_prompt"] = system_prompt

    await ws.send(json.dumps(payload))

    full_response = ""
    start = time.time()

    while True:
        if time.time() - start > TIMEOUT:
            print(f"  ⏱ TIMEOUT after {TIMEOUT}s")
            break
        try:
            raw = await asyncio.wait_for(ws.recv(), timeout=TIMEOUT)
            data = json.loads(raw)

            if "chunk" in data:
                full_response += data["chunk"]
            elif data.get("done"):
                break
        except asyncio.TimeoutError:
            print(f"  ⏱ TIMEOUT waiting for response")
            break

    return full_response.strip()


async def run_alex_test():
    session_id = f"alex-test-{int(time.time())}"
    system_prompt = (
        "You are a helpful assistant. Answer concisely. "
        "Remember everything the user tells you in this conversation."
    )

    print(f"🔌 Connecting to {WS_URL}...")
    print(f"📝 Session ID: {session_id}")
    print("=" * 60)

    try:
        async with websockets.connect(WS_URL, max_size=10 * 1024 * 1024) as ws:
            # Step 1
            print("\n[1] User: hello")
            resp1 = await send_and_receive(ws, "hello", session_id, system_prompt)
            print(f"    Assistant: {resp1[:200]}")

            # Step 2
            print("\n[2] User: my name is Alex")
            resp2 = await send_and_receive(ws, "my name is Alex", session_id)
            print(f"    Assistant: {resp2[:200]}")

            # Step 3 — THE KEY TEST
            print("\n[3] User: what is my name?")
            resp3 = await send_and_receive(ws, "what is my name?", session_id)
            print(f"    Assistant: {resp3[:200]}")

            name_remembered = "alex" in resp3.lower()
            status3 = "✅ PASS" if name_remembered else "❌ FAIL"
            print(f"    → Name remembered: {status3}")

            # Step 4 — Summary test
            print("\n[4] User: summarise our conversation")
            resp4 = await send_and_receive(ws, "summarise our conversation", session_id)
            print(f"    Assistant: {resp4[:300]}")

            mentions_name = "alex" in resp4.lower()
            mentions_greeting = any(
                w in resp4.lower()
                for w in ["hello", "greeted", "introduced", "name"]
            )
            status4 = "✅ PASS" if (mentions_name and mentions_greeting) else "⚠️ PARTIAL" if mentions_name else "❌ FAIL"
            print(f"    → Summary quality: {status4}")

            # Final verdict
            print("\n" + "=" * 60)
            if name_remembered:
                print("🎉 MEMORY TEST PASSED — The model remembers conversation history.")
                return 0
            else:
                print("💥 MEMORY TEST FAILED — The model does NOT remember prior messages.")
                print("   Check the backend logs for the messages array to diagnose.")
                return 1

    except ConnectionRefusedError:
        print(f"❌ Could not connect to {WS_URL}")
        print("   Make sure the backend is running: uv run python python_bridge.py")
        return 2
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(run_alex_test())
    sys.exit(exit_code)
