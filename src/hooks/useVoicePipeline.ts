/**
 * useVoicePipeline
 *
 * Combines client-side Silero VAD with the voice pipeline Lambda.
 * Continuous voice mode: VAD stays active between turns.
 *
 * Flow: VAD listening → speech detected → speech ends → Lambda → TTS playback → VAD listening
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { useClientSideVAD } from "./useClientSideVAD";
import {
  callVoicePipeline,
  preconnectPipeline,
  type VoicePipelineResult,
  type VoicePipelineError,
} from "@/lib/voicePipelineClient";

export type VoiceCallState =
  | "idle"
  | "initializing"
  | "listening"
  | "speaking"
  | "thinking"
  | "responding";

export interface VoiceCallMessage {
  role: "user" | "assistant" | "system";
  text: string;
  timestamp: number;
}

export interface UseVoicePipelineOptions {
  pipelineUrl?: string;
  onMessage?: (userMsg: VoiceCallMessage, assistantMsg: VoiceCallMessage) => void;
  autoStart?: boolean;
}

export interface UseVoicePipelineReturn {
  state: VoiceCallState;
  isInitialized: boolean;
  isSupported: boolean;
  error: string | null;
  lastResult: VoicePipelineResult | null;
  messages: VoiceCallMessage[];
  start: () => Promise<void>;
  stop: () => Promise<void>;
  toggle: () => Promise<void>;
  turnCount: number;
}

const DEFAULT_URL = import.meta.env.VITE_VOICE_PIPELINE_URL || "";

export function useVoicePipeline(
  options: UseVoicePipelineOptions = {}
): UseVoicePipelineReturn {
  const {
    pipelineUrl = DEFAULT_URL,
    onMessage,
    autoStart = false,
  } = options;

  const [pipelineState, setPipelineState] = useState<VoiceCallState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<VoicePipelineResult | null>(null);
  const [messages, setMessages] = useState<VoiceCallMessage[]>([]);
  const [turnCount, setTurnCount] = useState(0);
  const processingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const processUtterance = useCallback(async (audio: Float32Array) => {
    if (processingRef.current || !pipelineUrl) return;
    if (audio.length < 1600) return; // <100ms = noise

    processingRef.current = true;
    setPipelineState("thinking");
    setError(null);

    // Abort any in-progress playback AND fetch
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    // Read saved voice ID from Customize page
    let voiceId: string | undefined;
    try {
      const settings = JSON.parse(localStorage.getItem("customize-settings") || "{}");
      voiceId = settings.selectedVoiceId || undefined;
    } catch { /* ignore */ }

    try {
      const result = await callVoicePipeline(
        audio,
        pipelineUrl,
        (playbackState) => {
          if (signal.aborted) return;
          if (playbackState === "thinking") setPipelineState("thinking");
          else if (playbackState === "speaking") setPipelineState("responding");
          else if (playbackState === "done") setPipelineState("listening");
        },
        signal,
        voiceId
      );

      setLastResult(result);

      const now = Date.now();
      const userMsg: VoiceCallMessage = { role: "user", text: result.transcript, timestamp: now };
      const assistantMsg: VoiceCallMessage = { role: "assistant", text: result.response, timestamp: now };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setTurnCount((n) => n + 1);
      onMessage?.(userMsg, assistantMsg);
    } catch (err: any) {
      const voiceErr = err as VoicePipelineError;
      if (voiceErr.reason === "no-speech" || voiceErr.reason === "too-short") {
        // VAD misfire — not an error
      } else {
        setError(voiceErr.error || "Pipeline failed");
      }
    } finally {
      processingRef.current = false;
      // If VAD is still listening, go back to listening
      setPipelineState("listening");
    }
  }, [pipelineUrl, onMessage]);

  // Silero VAD — continuous mode
  const vad = useClientSideVAD({
    model: "v5",
    baseAssetPath: "/",
    onnxWASMBasePath: "/",
    minSpeechFrames: 5,          // ~400ms — ignores coughs, clicks
    minSilenceFrames: 8,         // ~640ms — quicker turn-taking
    threshold: 0.65,             // higher bar for speech vs noise
    negativeThreshold: 0.4,      // lower below this = definitely silence
    onSpeechStart: () => {
      // Barge-in: abort current playback if user speaks
      if (pipelineState === "responding" || pipelineState === "thinking") {
        abortRef.current?.abort();
      }
      setPipelineState("speaking");
    },
    onSpeechEnd: (audio: Float32Array) => {
      processUtterance(audio);
    },
    onVADMisfire: () => {
      if (pipelineState === "speaking") {
        setPipelineState("listening");
      }
    },
    autoStart,
  });

  // Preconnect to Lambda
  useEffect(() => {
    if (pipelineUrl) preconnectPipeline(pipelineUrl);
  }, [pipelineUrl]);

  // Auto-start when model loads
  useEffect(() => {
    if (autoStart && vad.isInitialized && !vad.isListening) {
      vad.startVAD();
    }
  }, [autoStart, vad.isInitialized]);

  // Derive display state
  const state: VoiceCallState = vad.error
    ? "idle"
    : !vad.isInitialized
    ? "initializing"
    : pipelineState !== "idle" && pipelineState !== "listening"
    ? pipelineState
    : vad.isSpeaking
    ? "speaking"
    : vad.isListening
    ? "listening"
    : "idle";

  return {
    state,
    isInitialized: vad.isInitialized,
    isSupported: vad.isSupported,
    error: vad.error || error,
    lastResult,
    messages,
    start: vad.startVAD,
    stop: vad.stopVAD,
    toggle: vad.toggleVAD,
    turnCount,
  };
}
