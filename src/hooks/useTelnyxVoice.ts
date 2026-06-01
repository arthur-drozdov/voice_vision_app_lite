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
  const callRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
      console.error("[Telnyx] Error:", err?.code, err?.message);
      setError(err?.message || "Connection failed");
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

    // Listen for call state changes via notification events
    // Call objects don't have .on() — state is tracked via client notifications
    client.on("telnyx.notification", (notification: any) => {
      console.log("[Telnyx] Notification:", notification);

      if (notification.type === "callUpdate" && notification.call) {
        const call = notification.call;
        const callState = call.call_state || call.state;
        console.log("[Telnyx] Call state:", callState);

        switch (callState) {
          case "ringing":
          case "early":
          case "requesting":
          case "trying":
          case "recovering":
            if (state !== "active") updateState("calling");
            break;
          case "active":
            updateState("active");
            break;
          case "hangup":
          case "destroy":
          case "purge":
          case "done":
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
      // If not already connected, connect and wait for ready
      if (!isReady && clientRef.current) {
        await new Promise<void>((resolve, reject) => {
          const onReady = () => {
            client.off("telnyx.ready", onReady);
            client.off("telnyx.error", onError);
            resolve();
          };
          const onError = (err: any) => {
            client.off("telnyx.ready", onReady);
            client.off("telnyx.error", onError);
            reject(new Error(err?.message || "Connection failed"));
          };
          client.on("telnyx.ready", onReady);
          client.on("telnyx.error", onError);
          client.connect();
        });
      }

      updateState("calling");

      // Create (or reuse) audio element for remote audio
      if (!audioRef.current) {
        const audio = new Audio();
        audio.autoplay = true;
        audioRef.current = audio;
      }

      // Create a call to the AI assistant
      const call = client.newCall({
        destinationNumber: assistantId,
        remoteElement: audioRef.current,
        audio: true,
      });

      callRef.current = call;

      console.log("[Telnyx] Call created:", call.id, "state:", call.state);

      // Call state changes come via client.on("telnyx.notification") — already set up above
      // No call.on() needed — Call objects use state property + notification events

    } catch (err: any) {
      console.error("[Telnyx] Start error:", err);
      setError(err.message || "Failed to start call");
      updateState("error");
    }
  }, [initClient, isReady, assistantId, updateState]);

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
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
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
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.srcObject = null;
        audioRef.current = null;
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
