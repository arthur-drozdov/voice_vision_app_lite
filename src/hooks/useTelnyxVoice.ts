/**
 * useTelnyxVoice
 *
 * Connects the browser directly to the Telnyx AI Assistant via WebRTC.
 * The assistant handles STT → LLM → TTS with Szonja's cloned voice,
 * plus all tools (mem0, Notion, GitHub, email, etc.).
 *
 * No Lambda — browser talks directly to Telnyx's carrier network.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { TelnyxRTC } from "@telnyx/webrtc";
import type { Call } from "@telnyx/webrtc";

export type TelnyxCallState =
  | "idle"
  | "connecting"
  | "ready"
  | "calling"
  | "active"
  | "ended"
  | "error";

export interface TelnyxTranscript {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

export interface UseTelnyxVoiceOptions {
  assistantId?: string;
  onTranscript?: (t: TelnyxTranscript) => void;
  onStateChange?: (state: TelnyxCallState) => void;
}

export interface UseTelnyxVoiceReturn {
  state: TelnyxCallState;
  isReady: boolean;
  isInCall: boolean;
  error: string | null;
  transcripts: TelnyxTranscript[];
  start: () => Promise<void>;
  stop: () => void;
  toggle: () => void;
}

const AI_ASSISTANT_ID =
  import.meta.env.VITE_TELNYX_ASSISTANT_ID ||
  "assistant-b216d822-f641-4e22-a678-4a8f56d1de33";

export function useTelnyxVoice(
  options: UseTelnyxVoiceOptions = {}
): UseTelnyxVoiceReturn {
  const { assistantId = AI_ASSISTANT_ID, onTranscript, onStateChange } = options;

  const [state, setState] = useState<TelnyxCallState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [transcripts, setTranscripts] = useState<TelnyxTranscript[]>([]);

  const clientRef = useRef<TelnyxRTC | null>(null);
  const callRef = useRef<Call | null>(null);

  const updateState = useCallback(
    (s: TelnyxCallState) => {
      setState(s);
      onStateChange?.(s);
    },
    [onStateChange]
  );

  // Initialize client
  const initClient = useCallback(() => {
    if (clientRef.current) return;

    const client = new TelnyxRTC({
      anonymous_login: {
        target_type: "ai_assistant",
        target_id: assistantId,
      },
    });

    client.on("telnyx.ready", () => {
      console.log("[Telnyx] Connected, ready for calls");
      setIsReady(true);
      if (state !== "calling" && state !== "active") {
        updateState("ready");
      }
    });

    client.on("telnyx.error", (err: any) => {
      console.error("[Telnyx] Error:", err.code, err.message);
      setError(err.message || "Connection failed");
      updateState("error");
    });

    client.on("telnyx.socket.close", () => {
      console.log("[Telnyx] Socket closed");
      setIsReady(false);
      callRef.current = null;
      if (state !== "idle" && state !== "ended") {
        updateState("idle");
      }
    });

    // Listen for call notifications (state changes, transcripts)
    client.on("telnyx.notification", (notification: any) => {
      console.log("[Telnyx] Notification:", notification);

      if (notification.type === "callUpdate" && notification.call) {
        const callState = notification.call.call_state || notification.call.state;

        // Map Telnyx call states
        switch (callState) {
          case "ringing":
          case "early":
            updateState("calling");
            break;
          case "active":
            updateState("active");
            break;
          case "ended":
          case "hangup":
          case "completed":
            updateState("ended");
            callRef.current = null;
            break;
          default:
            break;
        }
      }
    });

    clientRef.current = client;
    return client;
  }, [assistantId, state, updateState]);

  // Start the call
  const start = useCallback(async () => {
    if (callRef.current) return; // already in a call

    const client = initClient();
    if (!client) return;

    updateState("connecting");

    try {
      // If not already connected, connect first
      if (!isReady && clientRef.current) {
        await new Promise<void>((resolve, reject) => {
          client.once("telnyx.ready", () => resolve());
          client.once("telnyx.error", (err: any) => reject(new Error(err.message)));
          client.connect();
        });
      }

      updateState("calling");

      // Create a call to the AI assistant
      // With anonymous_login, the destination is the AI assistant automatically
      const call = client.newCall({
        destination: assistantId,
        // The AI assistant picks up automatically — no need for callerName etc
      });

      callRef.current = call;

      // Listen for call state changes
      call.on("stateChange", (callObj: Call) => {
        console.log("[Telnyx] Call state:", callObj.state);
        switch (callObj.state) {
          case "active":
            updateState("active");
            break;
          case "destroy":
          case "hangup":
          case "purge":
            updateState("ended");
            callRef.current = null;
            break;
          default:
            break;
        }
      });

      // Try to listen for transcript events (JS SDK may have this)
      try {
        call.on("telnyx.transcript", (data: any) => {
          const t: TelnyxTranscript = {
            role: data.role === "ai" || data.role === "assistant" ? "assistant" : "user",
            text: data.text || data.transcript || "",
            timestamp: Date.now(),
          };
          console.log("[Telnyx] Transcript:", t);
          setTranscripts((prev) => [...prev, t]);
          onTranscript?.(t);
        });
      } catch {
        // Transcript events may not be available in all SDK versions
      }

    } catch (err: any) {
      console.error("[Telnyx] Start error:", err);
      setError(err.message || "Failed to start call");
      updateState("error");
    }
  }, [initClient, isReady, assistantId, updateState, onTranscript]);

  // Stop the call
  const stop = useCallback(() => {
    if (callRef.current) {
      try {
        callRef.current.hangup();
      } catch {
        // ignore
      }
      callRef.current = null;
    }
    if (clientRef.current) {
      try {
        clientRef.current.disconnect();
      } catch {
        // ignore
      }
      clientRef.current = null;
    }
    setIsReady(false);
    updateState("idle");
  }, [updateState]);

  const toggle = useCallback(() => {
    if (state === "active" || state === "calling" || state === "connecting") {
      stop();
    } else {
      start();
    }
  }, [state, start, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callRef.current) {
        try { callRef.current.hangup(); } catch {}
        callRef.current = null;
      }
      if (clientRef.current) {
        try { clientRef.current.disconnect(); } catch {}
        clientRef.current = null;
      }
    };
  }, []);

  return {
    state,
    isReady,
    isInCall: state === "calling" || state === "active",
    error,
    transcripts,
    start,
    stop,
    toggle,
  };
}
