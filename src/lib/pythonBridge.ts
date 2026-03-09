/**
 * Python Bridge Client
 *
 * WebSocket client for connecting to the Python bridge backend
 * and Vision API client for camera frame capture/upload.
 */

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface ChunkMessage {
  chunk: string;
  source?: string;  // Source agent identifier (e.g., "main" or "tools:subagent_name")
}

export interface DoneMessage {
  done: boolean;
}

export interface ThinkingMessage {
  thinking: boolean;
}

export interface ToolCallMessage {
  tool_call: string;
  status: "running" | "done";
}

export type WebSocketMessage = ChunkMessage | DoneMessage | ThinkingMessage | ToolCallMessage;

export interface PythonBridgeOptions {
  wsUrl?: string;
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export class PythonBridge {
  private ws: WebSocket | null = null;
  private status: ConnectionStatus = "disconnected";
  private chunkCallbacks: Array<(chunk: string, source?: string) => void> = [];
  private doneCallbacks: (() => void)[] = [];
  private errorCallbacks: Array<(error: Error) => void> = [];
  private statusCallbacks: Array<(status: ConnectionStatus) => void> = [];
  private thinkingCallbacks: Array<() => void> = [];
  private toolCallCallbacks: Array<(toolName: string, status: string) => void> = [];
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private messageQueue: string[] = [];
  private shouldReconnect = true;

  private readonly wsUrl: string;
  private readonly reconnectInterval: number;
  private readonly maxReconnectAttempts: number;

  private autoConnect: boolean;

  constructor(options: PythonBridgeOptions = {}) {
    this.wsUrl = options.wsUrl ?? "/chat";
    this.autoConnect = options.autoConnect ?? false;
    this.reconnectInterval = options.reconnectInterval ?? 3000;
    this.maxReconnectAttempts = options.maxReconnectAttempts ?? 5;
  }

  /**
   * Get the current connection status
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): void {
    if (this.status === "connecting" || this.status === "connected") {
      return;
    }

    this.setStatus("connecting");
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;

    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        this.setStatus("connected");
        this.reconnectAttempts = 0;

        // Send any queued messages
        while (this.messageQueue.length > 0) {
          const message = this.messageQueue.shift();
          if (message && this.ws) {
            this.ws.send(message);
          }
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);

          if ("chunk" in data) {
            this.chunkCallbacks.forEach((cb) => cb(data.chunk, data.source));
          } else if ("done" in data) {
            this.doneCallbacks.forEach((cb) => cb());
          } else if ("thinking" in data) {
            this.thinkingCallbacks.forEach((cb) => cb());
          } else if ("tool_call" in data) {
            const tc = data as ToolCallMessage;
            this.toolCallCallbacks.forEach((cb) => cb(tc.tool_call, tc.status));
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      this.ws.onerror = () => {
        this.setStatus("error");
        const wsError = new Error("WebSocket connection error");
        this.triggerErrorCallbacks(wsError);
      };

      this.ws.onclose = () => {
        this.setStatus("disconnected");
        this.ws = null;

        if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          this.scheduleReconnect();
        }
      };
    } catch (error) {
      this.setStatus("error");
      const wsError = error instanceof Error ? error : new Error("Failed to create WebSocket");
      this.triggerErrorCallbacks(wsError);
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimer();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setStatus("disconnected");
  }

  /**
   * Cancel the current streaming response and immediately reconnect.
   * Unlike disconnect(), the connection stays usable for the next message.
   */
  cancel(): void {
    this.clearReconnectTimer();
    this.messageQueue = [];

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Reconnect right away so the next message works without a page refresh
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;
    setTimeout(() => this.connect(), 150);
  }

  /**
   * Send a text message to the server.
   * @param text - The user's message
   * @param systemPrompt - Optional character + tone system prompt (sent with first message of a session)
   * @param threadId - Session ID used by the backend LangGraph checkpointer for per-session memory
   * @param agentName - Optional agent name for multi-agent memory tagging (e.g. "kai", "eden")
   * @param conversationId - Optional conversation ID for shared multi-agent memory (defaults to threadId)
   */
  send(text: string, systemPrompt?: string, threadId?: string, agentName?: string, conversationId?: string): void {
    const data: Record<string, string> = { text };
    if (systemPrompt) data.system_prompt = systemPrompt;
    if (threadId) data.thread_id = threadId;
    if (agentName) data.agent_name = agentName;
    if (conversationId) data.conversation_id = conversationId;
    const payload = JSON.stringify(data);

    if (this.ws && this.status === "connected") {
      this.ws.send(payload);
    } else {
      // Queue message for later sending
      this.messageQueue.push(payload);
    }
  }

  /**
   * Register a callback for incoming chunks
   */
  onChunk(callback: (chunk: string) => void): () => void {
    this.chunkCallbacks.push(callback);
    return () => {
      this.chunkCallbacks = this.chunkCallbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Register a callback for completion
   */
  onDone(callback: () => void): () => void {
    this.doneCallbacks.push(callback);
    return () => {
      this.doneCallbacks = this.doneCallbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Register a callback for when the model is in a deep-thinking / reasoning phase.
   * Called when the backend receives a reasoning_content or thought token
   * (so the frontend can show a "Deep thinking…" indicator).
   */
  onThinking(callback: () => void): () => void {
    this.thinkingCallbacks.push(callback);
    return () => {
      this.thinkingCallbacks = this.thinkingCallbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Register a callback for tool call signals (e.g. search running/done).
   * Called when the backend sends a tool_call message with the tool name and status.
   */
  onToolCall(callback: (toolName: string, status: string) => void): () => void {
    this.toolCallCallbacks.push(callback);
    return () => {
      this.toolCallCallbacks = this.toolCallCallbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Register a callback for errors
   */
  onError(callback: (error: Error) => void): () => void {
    this.errorCallbacks.push(callback);
    return () => {
      this.errorCallbacks = this.errorCallbacks.filter((cb) => cb !== callback);
    };
  }

  private triggerErrorCallbacks(error: Error): void {
    this.errorCallbacks.forEach((cb) => cb(error));
  }

  /**
   * Register a callback for status changes
   */
  onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusCallbacks.push(callback);
    return () => {
      this.statusCallbacks = this.statusCallbacks.filter((cb) => cb !== callback);
    };
  }

  private setStatus(newStatus: ConnectionStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusCallbacks.forEach((cb) => cb(newStatus));
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    this.setStatus("connecting");

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, this.reconnectInterval);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// Singleton instance for the app
let bridgeInstance: PythonBridge | null = null;

export function getBridge(): PythonBridge {
  if (!bridgeInstance) {
    bridgeInstance = new PythonBridge();
  }
  return bridgeInstance;
}

/**
 * Capture a frame from the camera as base64
 * @param videoElement - The video element to capture from
 * @returns Base64 encoded image data (without data URL prefix)
 */
export function captureFrame(videoElement: HTMLVideoElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

  // Convert to JPEG with 0.8 quality
  const dataUrl = canvas.toDataURL("image/jpeg", 0.8);

  // Remove the data URL prefix to get raw base64
  return dataUrl.replace(/^data:image\/jpeg;base64,/, "");
}

/**
 * Send a camera frame to the vision endpoint
 * @param videoBase64 - Base64 encoded image data
 * @param format - Image format (e.g., "jpeg")
 * @returns Response from the server
 */
export async function sendToVision(
  videoBase64: string,
  format: string = "jpeg"
): Promise<{ status: string } | { error: string }> {
  try {
    const response = await fetch("/vision", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ video_base64: videoBase64, format }),
    });

    return await response.json();
  } catch (error) {
    console.error("Vision API error:", error);
    return { error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Resize and compress an image before sending
 * @param videoElement - The video element to capture from
 * @param maxWidth - Maximum width (default: 240px for efficiency)
 * @param maxHeight - Maximum height (default: 180px for efficiency)
 * @returns Base64 encoded image data
 */
export function captureFrameResized(
  videoElement: HTMLVideoElement,
  maxWidth: number = 240,
  maxHeight: number = 180
): string {
  let width = videoElement.videoWidth;
  let height = videoElement.videoHeight;

  // Calculate scaled dimensions
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.floor(width * ratio);
    height = Math.floor(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Failed to get canvas context");
  }

  ctx.drawImage(videoElement, 0, 0, width, height);

  // Convert to JPEG with 0.7 quality for smaller size
  const dataUrl = canvas.toDataURL("image/jpeg", 0.7);

  // Remove the data URL prefix to get raw base64
  return dataUrl.replace(/^data:image\/jpeg;base64,/, "");
}
