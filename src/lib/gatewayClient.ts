/**
 * Gateway Client — Browser side
 *
 * WebSocket client for the VoiceVision Gateway Bridge.
 * Replaces PythonBridge with a lightweight protocol that connects
 * through the bridge to OpenClaw agents.
 *
 * Protocol (simple JSON over WebSocket):
 *   → { type: "chat", text: "...", character: "eden", systemPrompt: "..." }
 *   ← { type: "chunk", text: "..." }
 *   ← { type: "done" }
 *   ← { type: "error", error: "..." }
 */

export type GatewayStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface GatewayCallbacks {
  onChunk?: (text: string) => void;
  onDone?: () => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: GatewayStatus) => void;
  onThinking?: () => void;
}

export interface GatewayOptions {
  wsUrl?: string;
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

// Production WebSocket endpoint via API Gateway → Lambda → Tailscale → OpenClaw
const PROD_WS_URL = 'wss://184z3y4uxi.execute-api.us-east-1.amazonaws.com/prod';

export class GatewayClient {
  private ws: WebSocket | null = null;
  private status: GatewayStatus = 'disconnected';
  private callbacks: GatewayCallbacks;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private messageQueue: Array<{ text: string; character: string; systemPrompt?: string }> = [];

  private readonly wsUrl: string;
  private readonly reconnectInterval: number;
  private readonly maxReconnectAttempts: number;

  constructor(options: GatewayOptions = {}, callbacks: GatewayCallbacks = {}) {
    this.wsUrl = options.wsUrl ?? (
      // In dev (localhost): use Vite proxy to the bridge
      // In production: use API Gateway WebSocket → Lambda → Tailscale → OpenClaw
      window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
        ? `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/chat`
        : PROD_WS_URL
    );
    this.reconnectInterval = options.reconnectInterval ?? 3000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
    this.callbacks = callbacks;
  }

  getStatus(): GatewayStatus {
    return this.status;
  }

  private setStatus(s: GatewayStatus): void {
    this.status = s;
    this.callbacks.onStatusChange?.(s);
  }

  connect(): void {
    if (this.status === 'connecting' || this.status === 'connected') return;

    this.setStatus('connecting');
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;

    this.tryConnect();
  }

  private tryConnect(): void {
    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        this.setStatus('connected');
        this.reconnectAttempts = 0;
        // Flush any queued messages
        for (const msg of this.messageQueue) {
          this.sendRaw(msg);
        }
        this.messageQueue = [];
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.type) {
            case 'chunk':
              this.callbacks.onChunk?.(msg.text);
              break;
            case 'done':
              this.callbacks.onDone?.();
              break;
            case 'error':
              this.callbacks.onError?.(msg.error || 'Unknown error');
              break;
            case 'status':
              if (msg.status === 'thinking') {
                this.callbacks.onThinking?.();
              }
              break;
            case 'hello':
              console.log('[GatewayClient] Bridge connected, agents:', msg.agents);
              break;
          }
        } catch {
          // Skip non-JSON messages
        }
      };

      this.ws.onclose = () => {
        this.setStatus('disconnected');
        this.tryReconnect();
      };

      this.ws.onerror = () => {
        this.setStatus('error');
        this.tryReconnect();
      };
    } catch (e) {
      this.setStatus('error');
      this.tryReconnect();
    }
  }

  private tryReconnect(): void {
    if (!this.shouldReconnect || this.reconnectAttempts >= this.maxReconnectAttempts) return;

    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      console.log(`[GatewayClient] Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      this.tryConnect();
    }, this.reconnectInterval * this.reconnectAttempts);
  }

  private sendRaw(msg: { text: string; character: string; systemPrompt?: string }): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.messageQueue.push(msg);
      return;
    }
    this.ws.send(JSON.stringify({
      type: 'chat',
      text: msg.text,
      character: msg.character,
      systemPrompt: msg.systemPrompt,
    }));
  }

  send(text: string, character: string, systemPrompt?: string): void {
    if (this.status !== 'connected') {
      // Queue for when we connect
      this.messageQueue.push({ text, character, systemPrompt });
      this.connect();
      return;
    }
    this.sendRaw({ text, character, systemPrompt });
  }

  cancel(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'cancel' }));
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.setStatus('disconnected');
  }
}

// Singleton
let instance: GatewayClient | null = null;

export function getGatewayClient(callbacks?: GatewayCallbacks): GatewayClient {
  if (!instance) {
    instance = new GatewayClient({}, callbacks);
  }
  if (callbacks) {
    // Update callbacks
    Object.assign((instance as any).callbacks, callbacks);
  }
  return instance;
}

export function resetGatewayClient(): void {
  instance?.disconnect();
  instance = null;
}
