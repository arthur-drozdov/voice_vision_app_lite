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

export interface MemoryListPayload {
  type: string;
  memories: Array<{
    memoryId: string;
    userId: string;
    data: Record<string, unknown>;
    updatedAt: string;
  }>;
  count: number;
}

export interface NotificationPayload {
  notificationId: string;
  message: string;
  notificationType: string;
}

export interface NotificationListPayload {
  type: string;
  notifications: Array<{
    notificationId: string;
    message: string;
    type: string;
    createdAt: string;
    read: boolean;
    delivered: boolean;
  }>;
  count: number;
}

export interface GatewayCallbacks {
  onChunk?: (text: string) => void;
  onDone?: () => void;
  onError?: (error: string) => void;
  onStatusChange?: (status: GatewayStatus) => void;
  onThinking?: () => void;
  onMemoryList?: (payload: MemoryListPayload) => void;
  onMemorySaved?: (payload: { memoryId: string; status: string }) => void;
  onMemoryDeleted?: (payload: { memoryId: string; status: string }) => void;
  onNotification?: (payload: NotificationPayload) => void;
  onNotifications?: (payload: NotificationListPayload) => void;
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
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  private shouldReconnect = true;
  private messageQueue: Array<{ text: string; character: string; systemPrompt?: string; messages?: { role: string; text: string }[] }> = [];

  private readonly wsUrl: string;
  private readonly reconnectInterval: number;
  private readonly maxReconnectAttempts: number;

  constructor(options: GatewayOptions = {}, callbacks: GatewayCallbacks = {}) {
    const baseUrl = options.wsUrl ?? (
      window.location.hostname.includes('localhost') || window.location.hostname.includes('127.0.0.1')
        ? `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/chat`
        : PROD_WS_URL
    );
    // Append userId for persistent session routing (notifications, reminders)
    const userId = (typeof localStorage !== 'undefined' && localStorage.getItem('vv-user-id')) || '';
    this.wsUrl = userId ? `${baseUrl}?userId=${encodeURIComponent(userId)}` : baseUrl;
    this.reconnectInterval = options.reconnectInterval ?? 3000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 20;
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
        // Start keepalive ping to prevent API Gateway 10-min idle timeout
        this.startKeepalive();
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
            case 'memory_list':
              console.log('[GatewayClient] Received', msg.count, 'memories');
              this.callbacks.onMemoryList?.(msg as MemoryListPayload);
              break;
            case 'memory_saved':
              console.log('[GatewayClient] Memory saved:', msg.memoryId);
              this.callbacks.onMemorySaved?.(msg);
              break;
            case 'memory_deleted':
              console.log('[GatewayClient] Memory deleted:', msg.memoryId);
              this.callbacks.onMemoryDeleted?.(msg);
              break;
            case 'notification':
              console.log('[GatewayClient] Real-time notification:', msg.message?.slice(0, 50));
              this.callbacks.onNotification?.(msg as NotificationPayload);
              break;
            case 'notifications':
              console.log('[GatewayClient] Notification poll:', msg.count);
              this.callbacks.onNotifications?.(msg as NotificationListPayload);
              break;
            case 'notification_acked':
              console.log('[GatewayClient] Notification acked:', msg.notificationId);
              break;
          }
        } catch {
          // Skip non-JSON messages
        }
      };

      this.ws.onclose = () => {
        this.stopKeepalive();
        if (this.shouldReconnect) {
          this.setStatus('disconnected');
          this.tryReconnect();
        }
      };

      this.ws.onerror = () => {
        this.stopKeepalive();
        if (this.shouldReconnect) {
          this.setStatus('error');
          this.tryReconnect();
        }
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

  private sendRaw(msg: { text: string; character: string; systemPrompt?: string; messages?: { role: string; text: string }[] }): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.messageQueue.push(msg);
      return;
    }
    this.ws.send(JSON.stringify({
      type: 'chat',
      text: msg.text,
      character: msg.character,
      systemPrompt: msg.systemPrompt,
      messages: msg.messages || [],
    }));
  }

  send(text: string, character: string, systemPrompt?: string, messages?: { role: string; text: string }[]): void {
    if (this.status !== 'connected') {
      // Queue for when we connect
      this.messageQueue.push({ text, character, systemPrompt, messages });
      this.connect();
      return;
    }
    this.sendRaw({ text, character, systemPrompt, messages });
  }

  /** Send a memory operation through the WebSocket */
  sendMemory(type: string, payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Queue memory ops and send on reconnect
      console.warn('[GatewayClient] Cannot send memory — not connected');
      return;
    }
    this.ws.send(JSON.stringify({ type, ...payload }));
  }

  /** Fetch all memories for the current user */
  fetchMemories(userId: string, memoryType: string = 'all'): void {
    this.sendMemory('memory_get', { userId, memoryType });
  }

  /** Poll for pending notifications (call every 30s) */
  pollNotifications(userId: string): void {
    this.sendMemory('get_notifications', { userId });
  }

  /** Mark a notification as read */
  ackNotification(userId: string, notificationId: string): void {
    this.sendMemory('ack_notification', { userId, notificationId });
  }

  cancel(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'cancel' }));
    }
  }

  private startKeepalive(): void {
    this.stopKeepalive();
    // Send ping every 5 minutes to prevent API Gateway 10-min idle timeout
    this.keepaliveTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 5 * 60 * 1000);
  }

  private stopKeepalive(): void {
    if (this.keepaliveTimer) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.stopKeepalive();
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
