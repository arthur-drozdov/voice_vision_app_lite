/**
 * Gateway Bridge Server
 *
 * Translates simple WebSocket messages from the VoiceVision website
 * to the full OpenClaw gateway JSON-RPC protocol.
 *
 * Architecture:
 *   Browser ←→ Bridge (WS) ←→ OpenClaw Gateway (WS) ←→ Subagent
 *
 * Character routing: the selected character maps to an OpenClaw agent.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { randomUUID } from 'crypto';

// ── Config ──────────────────────────────────────────────────────────────────
const BRIDGE_PORT = parseInt(process.env.BRIDGE_PORT || '8080', 10);
const GATEWAY_URL = process.env.GATEWAY_URL || 'ws://127.0.0.1:18789';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || process.env.OPENCLAW_GATEWAY_TOKEN || '';

// ── Character → Agent mapping ───────────────────────────────────────────────
const CHARACTER_AGENTS: Record<string, string> = {
  eden: 'eden',
  noe: 'noe',
  flo: 'flo',
  spark: 'spark',
  luna: 'luna',
};

// ── Gateway connection pool ─────────────────────────────────────────────────
interface GatewayConnection {
  ws: WebSocket;
  connected: boolean;
  pending: Map<string, (res: any) => void>;
  seq: number;
}

let gateway: GatewayConnection | null = null;

function getGatewayToken(): string {
  return GATEWAY_TOKEN;
}

async function connectGateway(): Promise<GatewayConnection> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(GATEWAY_URL);
    const pending = new Map<string, (res: any) => void>();
    let seq = 0;

    const conn: GatewayConnection = { ws, connected: false, pending, seq };

    ws.on('open', () => {
      // Wait for connect.challenge, then authenticate
      console.log('[bridge] Gateway socket open, waiting for challenge...');
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        // Handle challenges
        if (msg.type === 'event' && msg.event === 'connect.challenge') {
          const connectId = randomUUID();
          const req = {
            type: 'req',
            id: connectId,
            method: 'connect',
            params: {
              minProtocol: 3,
              maxProtocol: 4,
              client: {
                id: 'voicevision-bridge',
                version: '1.0.0',
                platform: 'linux',
                mode: 'backend',
              },
              role: 'operator',
              scopes: ['operator.read', 'operator.write'],
              caps: [],
              commands: [],
              permissions: {},
              auth: { token: getGatewayToken() },
              locale: 'en-GB',
              userAgent: 'voicevision-bridge/1.0.0',
            },
          };
          conn.pending.set(connectId, (res) => {
            if (res.ok) {
              conn.connected = true;
              console.log('[bridge] Gateway handshake OK, protocol:', res.payload?.protocol);
              resolve(conn);
            } else {
              reject(new Error(`Gateway handshake failed: ${JSON.stringify(res.error)}`));
            }
          });
          ws.send(JSON.stringify(req));
          return;
        }

        // Handle responses
        if (msg.type === 'res' && msg.id !== undefined) {
          const resolve = conn.pending.get(String(msg.id));
          if (resolve) {
            conn.pending.delete(String(msg.id));
            resolve(msg);
          }
          return;
        }

        // Handle events (streaming, agent responses, etc.)
        if (msg.type === 'event') {
          conn.pending.forEach((resolve) => {
            resolve(msg);
          });
        }
      } catch (e) {
        // Skip malformed messages
      }
    });

    ws.on('close', () => {
      console.log('[bridge] Gateway connection closed');
      conn.connected = false;
      gateway = null;
    });

    ws.on('error', (err) => {
      console.error('[bridge] Gateway error:', err.message);
      if (!conn.connected) reject(err);
    });

    // Timeout
    setTimeout(() => {
      if (!conn.connected) {
        ws.close();
        reject(new Error('Gateway handshake timeout'));
      }
    }, 10000);
  });
}

async function getGateway(): Promise<GatewayConnection> {
  if (gateway?.connected) return gateway;
  gateway = await connectGateway();
  return gateway;
}

// ── Chat send ───────────────────────────────────────────────────────────────
async function sendChatMessage(
  agentId: string,
  message: string,
  systemPrompt?: string,
  sessionId?: string,
  onChunk?: (text: string) => void,
  onDone?: () => void,
  onError?: (error: string) => void,
): Promise<void> {
  try {
    const gw = await getGateway();
    const id = randomUUID();
    const params: Record<string, any> = {
      message,
      agentId,
      sessionKey: sessionId || undefined,
    };

    if (systemPrompt) {
      params.systemPrompt = systemPrompt;
    }

    // Register handler for streaming events
    const eventHandler = (msg: any) => {
      if (msg.type !== 'event') return;

      // Agent chunk event
      if (msg.event === 'agent' && msg.payload?.chunk) {
        onChunk?.(msg.payload.chunk);
      }
      // Agent done
      if (msg.event === 'agent' && msg.payload?.done) {
        gw.pending.delete('event:' + id);
        onDone?.();
      }
      // Error
      if (msg.event === 'error') {
        gw.pending.delete('event:' + id);
        onError?.(msg.payload?.message || 'Unknown error');
      }
    };

    gw.pending.set('event:' + id, eventHandler);

    const req = {
      type: 'req',
      id,
      method: 'chat.send',
      params,
    };

    gw.ws.send(JSON.stringify(req));

    // Wait for response
    gw.pending.set(id, (res) => {
      if (!res.ok && res.error) {
        gw.pending.delete('event:' + id);
        onError?.(res.error?.message || 'Chat send failed');
      }
    });
  } catch (err: any) {
    onError?.(err.message);
  }
}

// ── Cancel ──────────────────────────────────────────────────────────────────
async function cancelChat(sessionId?: string): Promise<void> {
  try {
    const gw = await getGateway();
    const req = {
      type: 'req',
      id: randomUUID(),
      method: 'chat.cancel',
      params: sessionId ? { sessionKey: sessionId } : {},
    };
    gw.ws.send(JSON.stringify(req));
  } catch (e) {
    // Best effort
  }
}

// ── WebSocket server for browser clients ─────────────────────────────────────
const wss = new WebSocketServer({ port: BRIDGE_PORT });

console.log(`[bridge] VoiceVision Gateway Bridge on port ${BRIDGE_PORT}`);
console.log(`[bridge] Gateway: ${GATEWAY_URL}`);

wss.on('connection', (ws: WebSocket) => {
  console.log('[bridge] Browser client connected');

  let currentAgent = 'default';
  let sessionKey: string | undefined;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case 'chat': {
          const { text, character, systemPrompt } = msg;
          const agentId = CHARACTER_AGENTS[character] || 'default';

          if (agentId !== currentAgent) {
            // New character = new session
            sessionKey = undefined;
            currentAgent = agentId;
          }

          // Send typing indicator
          ws.send(JSON.stringify({ type: 'status', status: 'thinking' }));

          sendChatMessage(
            agentId,
            text,
            systemPrompt,
            sessionKey,
            // onChunk
            (chunk) => {
              ws.send(JSON.stringify({ type: 'chunk', text: chunk }));
            },
            // onDone
            () => {
              ws.send(JSON.stringify({ type: 'done' }));
            },
            // onError
            (error) => {
              ws.send(JSON.stringify({ type: 'error', error }));
            },
          );
          break;
        }

        case 'cancel': {
          cancelChat(sessionKey);
          break;
        }

        case 'hello': {
          ws.send(JSON.stringify({ type: 'hello', version: '1.0.0', agents: Object.keys(CHARACTER_AGENTS) }));
          break;
        }
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }));
    }
  });

  ws.on('close', () => {
    console.log('[bridge] Browser client disconnected');
  });
});

// ── Cleanup ─────────────────────────────────────────────────────────────────
process.on('SIGTERM', () => {
  console.log('[bridge] Shutting down...');
  wss.close();
  if (gateway) gateway.ws.close();
  process.exit(0);
});

export { wss, sendChatMessage, cancelChat, getGateway };
