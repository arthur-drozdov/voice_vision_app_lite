/**
 * useClientSideVAD
 *
 * React hook wrapping @ricky0123/vad-web's MicVAD for client-side Silero VAD.
 * Runs Silero VAD v5 (or legacy) entirely in-browser via ONNX runtime.
 * No server roundtrip needed for voice activity detection.
 *
 * Usage:
 *   const { isSpeaking, startVAD, stopVAD, isSupported, isInitialized, error } = useClientSideVAD({
 *     onSpeechEnd: (audio) => { /* audio is Float32Array at 16kHz *\/ },
 *   });
 */

import { useState, useRef, useCallback, useEffect } from "react";
import type { MicVAD, RealTimeVADOptions } from "@ricky0123/vad-web";

export interface UseClientSideVADOptions {
  /** Called when speech starts */
  onSpeechStart?: () => void;
  /** Called when speech ends, with raw audio samples (16kHz, Float32Array -1 to 1) */
  onSpeechEnd?: (audio: Float32Array) => void;
  /** Called when a VAD misfire occurs (speech detected but too short) */
  onVADMisfire?: () => void;
  /** Called when speech is confirmed as valid (passed min frames check) */
  onSpeechRealStart?: () => void;
  /** Model to use: "v5" (default) or "legacy" */
  model?: "v5" | "legacy";
  /** Minimum speech frames required to trigger onSpeechEnd (default: 3, ~240ms) */
  minSpeechFrames?: number;
  /** Minimum silence frames to end speech (default: 10, ~800ms)  */
  minSilenceFrames?: number;
  /** Threshold for speech probability (default: 0.5) */
  threshold?: number;
  /** Negative threshold for speech end detection (default: 0.35) */
  negativeThreshold?: number;
  /** Whether to start VAD immediately when the hook mounts (default: false) */
  autoStart?: boolean;
  /** Base path for VAD models and worklet (default: auto-detected from package) */
  baseAssetPath?: string;
  /** ONNX WASM base path */
  onnxWASMBasePath?: string;
}

export interface UseClientSideVADReturn {
  /** Whether the VAD currently detects speech */
  isSpeaking: boolean;
  /** Whether the VAD engine is initialized (model loaded + ready) */
  isInitialized: boolean;
  /** Whether the VAD is currently listening (microphone + model active) */
  isListening: boolean;
  /** Whether browser supports required APIs (AudioContext + WASM) */
  isSupported: boolean;
  /** Whether AudioContext needs a user gesture to resume */
  needsUserGesture: boolean;
  /** Model loading progress (0-1) */
  loadProgress: number;
  /** Error message if something went wrong */
  error: string | null;
  /** Start VAD listening */
  startVAD: () => Promise<void>;
  /** Stop VAD listening */
  stopVAD: () => Promise<void>;
  /** Toggle VAD on/off */
  toggleVAD: () => Promise<void>;
  /** Destroy VAD and clean up */
  destroy: () => Promise<void>;
}

/**
 * Check if the browser supports client-side VAD (AudioContext + WASM).
 */
function checkSupport(): { supported: boolean; needsGesture: boolean } {
  const hasAudioContext = !!(
    window.AudioContext ||
    (window as any).webkitAudioContext
  );
  const hasWasm = typeof WebAssembly === "object" && typeof WebAssembly.instantiate === "function";
  const needsGesture =
    hasAudioContext &&
    (window.AudioContext
      ? (new AudioContext()).state === "suspended"
      : false);

  // Close the test context
  try {
    if (window.AudioContext) new AudioContext().close();
  } catch { /* ignore */ }

  return { supported: hasAudioContext && hasWasm, needsGesture };
}

/**
 * React hook wrapping @ricky0123/vad-web MicVAD for client-side Silero VAD.
 */
export function useClientSideVAD(options: UseClientSideVADOptions = {}): UseClientSideVADReturn {
  const {
    onSpeechStart,
    onSpeechEnd,
    onVADMisfire,
    onSpeechRealStart,
    model = "v5",
    autoStart = false,
  } = options;

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const vadRef = useRef<MicVAD | null>(null);
  const [supportState] = useState(() => checkSupport());

  // Create and initialise the VAD
  useEffect(() => {
    if (!supportState.supported) {
      setError("Client-side VAD is not supported in this browser (requires AudioContext + WASM).");
      return;
    }

    let vadInstance: MicVAD | null = null;
    let mounted = true;

    const initVAD = async () => {
      try {
        const { MicVAD: MicVADClass, getDefaultRealTimeVADOptions } = await import("@ricky0123/vad-web");

        // Calculate frame size: default is 30ms * 16kHz = 480 samples per frame
        const defaultOpts = getDefaultRealTimeVADOptions(model);
        const mergedOpts: Partial<RealTimeVADOptions> = {
          ...defaultOpts,
          startOnLoad: false,
          ...(options.minSpeechFrames !== undefined && { minSpeechFrames: options.minSpeechFrames }),
          ...(options.minSilenceFrames !== undefined && { minSilenceFrames: options.minSilenceFrames }),
          ...(options.threshold !== undefined && { threshold: options.threshold }),
          ...(options.negativeThreshold !== undefined && { negativeThreshold: options.negativeThreshold }),
          ...(options.baseAssetPath !== undefined && { baseAssetPath: options.baseAssetPath }),
          ...(options.onnxWASMBasePath !== undefined && { onnxWASMBasePath: options.onnxWASMBasePath }),
          onSpeechStart: () => {
            if (!mounted) return;
            setIsSpeaking(true);
            onSpeechStart?.();
          },
          onSpeechEnd: (audio: Float32Array) => {
            if (!mounted) return;
            setIsSpeaking(false);
            onSpeechEnd?.(audio);
          },
          onVADMisfire: () => {
            if (!mounted) return;
            onVADMisfire?.();
          },
          onSpeechRealStart: () => {
            if (!mounted) return;
            onSpeechRealStart?.();
          },
          onFrameProcessed: async () => {
            // Frame processed — used for progress tracking
          },
        };

        vadInstance = await MicVADClass.new(mergedOpts);
        if (mounted) {
          vadRef.current = vadInstance;
          setIsInitialized(true);
          setLoadProgress(1);
          setError(null);
        }
      } catch (err) {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : "Failed to initialise VAD";
        console.error("[useClientSideVAD] Initialisation error:", err);
        setError(msg);
      }
    };

    initVAD();

    return () => {
      mounted = false;
      if (vadInstance) {
        vadInstance.destroy().catch(() => {});
      }
      vadRef.current = null;
      setIsInitialized(false);
      setIsListening(false);
      setIsSpeaking(false);
    };
  }, [model]); // Only re-init if model changes

  // Auto-start if configured
  useEffect(() => {
    if (autoStart && isInitialized && !isListening && vadRef.current) {
      startVAD();
    }
  }, [autoStart, isInitialized]);

  const startVAD = useCallback(async () => {
    if (!vadRef.current) {
      // If not yet initialised but supported, it'll init and we can't await that here
      setError("VAD not initialised yet. Please wait for the model to load.");
      return;
    }
    try {
      // AudioContext may be suspended (user gesture needed)
      const ctx = (vadRef.current as any)._audioContext as AudioContext | undefined;
      if (ctx && ctx.state === "suspended") {
        await ctx.resume();
      }
      await vadRef.current.start();
      setIsListening(true);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to start VAD";
      console.error("[useClientSideVAD] Start error:", err);
      setError(msg);
    }
  }, []);

  const stopVAD = useCallback(async () => {
    if (!vadRef.current) return;
    try {
      await vadRef.current.pause();
      setIsListening(false);
      setIsSpeaking(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to stop VAD";
      console.error("[useClientSideVAD] Stop error:", err);
      setError(msg);
    }
  }, []);

  const toggleVAD = useCallback(async () => {
    if (isListening) {
      await stopVAD();
    } else {
      await startVAD();
    }
  }, [isListening, startVAD, stopVAD]);

  const destroy = useCallback(async () => {
    await stopVAD();
    if (vadRef.current) {
      await vadRef.current.destroy();
      vadRef.current = null;
    }
    setIsInitialized(false);
  }, [stopVAD]);

  return {
    isSpeaking,
    isInitialized,
    isListening,
    isSupported: supportState.supported,
    needsUserGesture: supportState.needsGesture,
    loadProgress,
    error,
    startVAD,
    stopVAD,
    toggleVAD,
    destroy,
  };
}
