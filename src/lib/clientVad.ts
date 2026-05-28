/**
 * Client-side Voice Activity Detection
 *
 * Uses @ricky0123/vad-web (Silero VAD v5 via ONNX Runtime Web)
 * to detect speech in the browser with zero network roundtrip.
 *
 * Chunk size: 30ms (minimum for Silero VAD, configurable)
 * Sample rate: 16000 Hz
 * Model: ~1.2MB ONNX download (cached by browser)
 */

export interface ClientVADCallbacks {
  onSpeechStart?: () => void;
  onSpeechEnd?: (audio: Float32Array) => void;
  onVADMisfire?: () => void;
  onError?: (error: Error) => void;
}

export interface ClientVADOptions {
  /** Minimum speech duration in ms before triggering onSpeechStart (default: 200) */
  minSpeechFrames?: number;
  /** Silence duration in ms before triggering onSpeechEnd (default: 500) */
  silenceDurationMs?: number;
  /** Positive speech threshold (0-1, default: 0.5) */
  positiveSpeechThreshold?: number;
  /** Negative speech threshold (0-1, default: 0.35) */
  negativeSpeechThreshold?: number;
  /** Callbacks */
  callbacks?: ClientVADCallbacks;
  /** ONNX WASM base path (for bundling the runtime) */
  onnxWASMBasePath?: string;
  /** VAD model base asset path */
  baseAssetPath?: string;
}

export class ClientVAD {
  private callbacks: ClientVADCallbacks;
  private vad: any = null; // MicVAD instance
  private listening = false;
  private options: Required<Omit<ClientVADOptions, 'callbacks' | 'onnxWASMBasePath' | 'baseAssetPath'>> & Pick<ClientVADOptions, 'callbacks' | 'onnxWASMBasePath' | 'baseAssetPath'>;

  constructor(options: ClientVADOptions = {}) {
    this.callbacks = options.callbacks || {};
    this.options = {
      minSpeechFrames: options.minSpeechFrames ?? 8, // ~200ms at 25ms/frame
      silenceDurationMs: options.silenceDurationMs ?? 500,
      positiveSpeechThreshold: options.positiveSpeechThreshold ?? 0.5,
      negativeSpeechThreshold: options.negativeSpeechThreshold ?? 0.35,
      ...options,
    };
  }

  /**
   * Initialize VAD and start listening.
   * Downloads the ONNX model (~1.2MB) on first call.
   */
  async start(): Promise<void> {
    if (this.listening) return;

    try {
      // Dynamically import @ricky0123/vad-web to avoid bundling issues
      const vadModule = await import('@ricky0123/vad-web');

      this.vad = await vadModule.MicVAD.new({
        onSpeechStart: () => {
          this.callbacks.onSpeechStart?.();
        },
        onSpeechEnd: (audio: Float32Array) => {
          this.callbacks.onSpeechEnd?.(audio);
        },
        onVADMisfire: () => {
          this.callbacks.onVADMisfire?.();
        },
        positiveSpeechThreshold: this.options.positiveSpeechThreshold,
        negativeSpeechThreshold: this.options.negativeSpeechThreshold,
        minSpeechFrames: this.options.minSpeechFrames,
        preSpeechPadFrames: 3,  // 75ms padding before speech
        redemptionFrames: 4,     // Grace frames after silence
        frameSamples: 480,       // 30ms at 16kHz
        ortConfig: (ort: any) => {
          ort.env.wasm.wasmPaths = this.options.onnxWASMBasePath ||
            'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
        },
        baseAssetPath: this.options.baseAssetPath ||
          'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.30/dist/',
        workletURL: this.options.baseAssetPath 
          ? this.options.baseAssetPath + 'vad.worklet.bundle.min.js'
          : 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.30/dist/vad.worklet.bundle.min.js',
        modelURL: this.options.baseAssetPath
          ? this.options.baseAssetPath + 'silero_vad_v5.onnx'
          : 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.30/dist/silero_vad_v5.onnx',
        onnxWASMBasePath: this.options.onnxWASMBasePath ||
          'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/',
      });

      this.vad.start();
      this.listening = true;
      console.log('[ClientVAD] Started — Silero VAD v5 in-browser, 30ms chunks');
    } catch (err) {
      console.error('[ClientVAD] Failed to start:', err);
      this.callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));

      // Fallback: try WebRTC VAD as simpler alternative
      if (!this.listening) {
        console.log('[ClientVAD] Falling back to WebRTC VAD...');
        await this.startWebRTCVADFallback();
      }
    }
  }

  /**
   * Fallback: Use browser's built-in audio processing via AudioContext analyser.
   * Less accurate than Silero but zero dependencies.
   */
  private async startWebRTCVADFallback(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });

      const audioCtx = new AudioContext({ sampleRate: 16000 });
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let speaking = false;
      let silenceStart = 0;
      const SILENCE_THRESHOLD = 20;
      const SILENCE_DURATION = this.options.silenceDurationMs;

      const audioChunks: Float32Array[] = [];
      let chunkAccumulator: Float32Array | null = null;
      let chunkOffset = 0;
      const CHUNK_SIZE = 480; // 30ms at 16kHz

      const check = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
        const now = Date.now();

        if (avg > SILENCE_THRESHOLD && !speaking) {
          speaking = true;
          audioChunks.length = 0;
          chunkAccumulator = new Float32Array(CHUNK_SIZE * 100); // 3 seconds buffer
          chunkOffset = 0;
          this.callbacks.onSpeechStart?.();
        } else if (avg <= SILENCE_THRESHOLD && speaking) {
          if (silenceStart === 0) silenceStart = now;
          if (now - silenceStart >= SILENCE_DURATION) {
            speaking = false;
            silenceStart = 0;
            const audio = new Float32Array(chunkOffset);
            if (chunkAccumulator) {
              audio.set(chunkAccumulator.subarray(0, chunkOffset));
            }
            this.callbacks.onSpeechEnd?.(audio);
          }
        } else if (avg > SILENCE_THRESHOLD) {
          silenceStart = 0;
        }

        if (speaking && chunkAccumulator) {
          // Append raw PCM data
          const rawData = new Float32Array(CHUNK_SIZE);
          analyser.getFloatTimeDomainData(rawData);
          if (chunkOffset + CHUNK_SIZE <= chunkAccumulator.length) {
            chunkAccumulator.set(rawData, chunkOffset);
            chunkOffset += CHUNK_SIZE;
          }
        }

        if (this.listening) {
          requestAnimationFrame(check);
        }
      };

      this.listening = true;
      requestAnimationFrame(check);
      console.log('[ClientVAD] WebRTC fallback VAD started, 30ms chunks');
    } catch (err) {
      console.error('[ClientVAD] WebRTC fallback also failed:', err);
      this.callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Stop VAD and release microphone.
   */
  async stop(): Promise<void> {
    this.listening = false;
    if (this.vad) {
      try {
        this.vad.destroy();
      } catch {
        // Best effort
      }
      this.vad = null;
    }
    console.log('[ClientVAD] Stopped');
  }

  /**
   * Pause VAD without releasing resources.
   */
  pause(): void {
    if (this.vad?.pause) {
      this.vad.pause();
    }
    this.listening = false;
  }

  /**
   * Resume paused VAD.
   */
  resume(): void {
    if (this.vad?.start) {
      this.vad.start();
    }
    this.listening = true;
  }

  isListening(): boolean {
    return this.listening;
  }
}

// Re-export types
export type { ClientVADCallbacks as VADCallbacks };
