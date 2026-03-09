/**
 * LLMRTC Client Wrapper
 * 
 * Wraps the LLMRTCWebClient to provide a compatible interface for the existing
 * audio recording infrastructure. This wrapper handles:
 * - Connection management to LLMRTC server
 * - Microphone audio sharing with VAD (Silero VAD v5)
 * - Event handling for speech detection, transcription, TTS, and barge-in
 * - TTS audio playback via WebRTC stream
 */

import {
  LLMRTCWebClient,
  ConnectionState,
  ClientError,
  ToolCallStartPayload,
  ToolCallEndPayload,
  StageChangePayload,
} from '@llmrtc/llmrtc-web-client';

export type LLMRTCConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface LLMRTCCallbacks {
  // Speech events (from VAD)
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  
  // Transcription events
  onTranscript?: (text: string) => void;
  
  // LLM response events
  onLLMChunk?: (content: string) => void;
  onLLM?: (text: string) => void;
  
  // TTS events
  onTTSStart?: () => void;
  onTTSCancelled?: () => void;  // Barge-in event
  onTTSTrack?: (stream: MediaStream) => void;  // WebRTC audio track for playback
  
  // Error handling
  onError?: (error: string) => void;
  
  // Connection status
  onStatusChange?: (status: LLMRTCConnectionStatus) => void;
  
  // Additional events (optional)
  onToolCallStart?: (payload: ToolCallStartPayload) => void;
  onToolCallEnd?: (payload: ToolCallEndPayload) => void;
  onStageChange?: (payload: StageChangePayload) => void;
  onReconnecting?: (attempt: number, maxAttempts: number) => void;
}

export interface LLMRTCClientConfig {
  signallingUrl: string;
  iceServers?: RTCIceServer[];
  callbacks?: LLMRTCCallbacks;
}

/**
 * Wrapper class for LLMRTCWebClient that provides a simplified interface
 * for audio streaming with VAD and barge-in support.
 */
export class LLMRTCClient {
  private client: LLMRTCWebClient;
  private callbacks: LLMRTCCallbacks;
  private status: LLMRTCConnectionStatus = 'disconnected';
  private audioStream: MediaStream | null = null;
  private audioController: ReturnType<LLMRTCWebClient['shareAudio']> | null = null;
  private audioContext: AudioContext | null = null;
  private audioSource: MediaStreamAudioSourceNode | null = null;

  constructor(config: LLMRTCClientConfig) {
    const { signallingUrl, iceServers, callbacks = {} } = config;
    
    this.callbacks = callbacks;
    
    this.client = new LLMRTCWebClient({
      signallingUrl,
      iceServers,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Connection state changes
    this.client.on('stateChange', (state: ConnectionState) => {
      this.handleStateChange(state);
    });

    // Speech detection events (from Silero VAD)
    this.client.on('speechStart', () => {
      console.log('[LLMRTCClient] Speech detected (VAD)');
      this.callbacks.onSpeechStart?.();
    });

    this.client.on('speechEnd', () => {
      console.log('[LLMRTCClient] Speech ended');
      this.callbacks.onSpeechEnd?.();
    });

    // Transcription events
    this.client.on('transcript', (text: string) => {
      console.log('[LLMRTCClient] Transcript:', text);
      this.callbacks.onTranscript?.(text);
    });

    // LLM response events
    this.client.on('llmChunk', (content: string) => {
      this.callbacks.onLLMChunk?.(content);
    });

    this.client.on('llm', (text: string) => {
      this.callbacks.onLLM?.(text);
    });

    // TTS events
    this.client.on('ttsStart', () => {
      console.log('[LLMRTCClient] TTS started');
      this.callbacks.onTTSStart?.();
    });

    this.client.on('ttsCancelled', () => {
      console.log('[LLMRTCClient] TTS cancelled (barge-in)');
      this.stopTTSPlayback();
      this.callbacks.onTTSCancelled?.();
    });

    this.client.on('ttsTrack', (stream: MediaStream) => {
      console.log('[LLMRTCClient] Received TTS audio track');
      this.handleTTSAudioTrack(stream);
    });

    // Error handling
    this.client.on('error', (error: ClientError) => {
      console.error('[LLMRTCClient] Error:', error);
      this.callbacks.onError?.(error.message);
    });

    // Reconnection events
    this.client.on('reconnecting', (attempt: number, maxAttempts: number) => {
      console.log(`[LLMRTCClient] Reconnecting: attempt ${attempt}/${maxAttempts}`);
      this.callbacks.onReconnecting?.(attempt, maxAttempts);
    });

    // Optional events
    this.client.on('toolCallStart', (payload: ToolCallStartPayload) => {
      this.callbacks.onToolCallStart?.(payload);
    });

    this.client.on('toolCallEnd', (payload: ToolCallEndPayload) => {
      this.callbacks.onToolCallEnd?.(payload);
    });

    this.client.on('stageChange', (payload: StageChangePayload) => {
      this.callbacks.onStageChange?.(payload);
    });
  }

  private handleStateChange(state: ConnectionState): void {
    let newStatus: LLMRTCConnectionStatus;

    switch (state) {
      case ConnectionState.CONNECTING:
        newStatus = 'connecting';
        break;
      case ConnectionState.CONNECTED:
        newStatus = 'connected';
        break;
      case ConnectionState.FAILED:
      case ConnectionState.CLOSED:
        newStatus = 'disconnected';
        break;
      default:
        newStatus = 'error';
    }

    if (newStatus !== this.status) {
      this.status = newStatus;
      this.callbacks.onStatusChange?.(newStatus);
    }
  }

  private handleTTSAudioTrack(stream: MediaStream): void {
    // Play the TTS audio track from WebRTC
    this.stopTTSPlayback();

    try {
      // Create audio context if needed
      if (!this.audioContext) {
        this.audioContext = new AudioContext({ sampleRate: 48000 });
      }

      // Create audio source from WebRTC stream
      const audioDestination = this.audioContext.createMediaStreamDestination();
      
      // Get the audio track from the stream and play it
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        // Use the stream directly for playback
        const playbackStream = new MediaStream([audioTrack]);
        const playbackAudio = new Audio();
        playbackAudio.srcObject = playbackStream;
        playbackAudio.play().catch(err => {
          console.error('[LLMRTCClient] Error playing TTS audio:', err);
        });

        // Store reference for cleanup
        (playbackAudio as any)._llmrtc_ref = true;
        
        console.log('[LLMRTCClient] TTS audio playback started');
      }
    } catch (error) {
      console.error('[LLMRTCClient] Error setting up TTS playback:', error);
    }
  }

  private stopTTSPlayback(): void {
    // Stop any current TTS playback
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.audioSource = null;
  }

  /**
   * Start connection to the LLMRTC server
   */
  async connect(): Promise<void> {
    try {
      await this.client.start();
      console.log('[LLMRTCClient] Connected to LLMRTC server');
    } catch (error) {
      console.error('[LLMRTCClient] Connection failed:', error);
      this.callbacks.onError?.(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Start sharing microphone audio with the server
   * VAD (Silero VAD v5) is handled server-side for accurate speech detection
   */
  async startRecording(): Promise<void> {
    if (!this.audioStream) {
      try {
        // Get microphone access with optimal settings for VAD
        this.audioStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,  // Match VAD model sample rate
          },
        });

        console.log('[LLMRTCClient] Microphone access granted');
      } catch (error) {
        console.error('[LLMRTCClient] Microphone access denied:', error);
        this.callbacks.onError?.('Microphone access denied');
        throw error;
      }
    }

    if (this.audioStream && this.client.state === ConnectionState.CONNECTED) {
      try {
        this.audioController = await this.client.shareAudio(this.audioStream);
        console.log('[LLMRTCClient] Audio sharing started - VAD enabled');
      } catch (error) {
        console.error('[LLMRTCClient] Failed to share audio:', error);
        this.callbacks.onError?.('Failed to start audio sharing');
        throw error;
      }
    } else {
      throw new Error('Client not connected');
    }
  }

  /**
   * Stop sharing microphone audio
   */
  async stopRecording(): Promise<void> {
    if (this.audioController) {
      await this.audioController.stop();
      this.audioController = null;
      console.log('[LLMRTCClient] Audio sharing stopped');
    }

    if (this.audioStream) {
      this.audioStream.getTracks().forEach(track => track.stop());
      this.audioStream = null;
    }
  }

  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    await this.stopRecording();
    this.client.close();
    this.stopTTSPlayback();
    this.status = 'disconnected';
    this.callbacks.onStatusChange?.('disconnected');
    console.log('[LLMRTCClient] Disconnected');
  }

  /**
   * Get current connection status
   */
  getStatus(): LLMRTCConnectionStatus {
    return this.status;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.status === 'connected';
  }

  /**
   * Send an interrupt signal to stop current TTS playback (barge-in)
   * Note: With LLMRTC, barge-in is automatic when VAD detects speech during TTS
   * This method is provided for manual interruption if needed
   */
  async interrupt(): Promise<void> {
    // The LLMRTC client handles barge-in automatically via VAD
    // This method can be used for manual interruption
    if (this.client.state === ConnectionState.CONNECTED) {
      // Send interrupt message through the data channel
      this.client.client['peer']?.send(JSON.stringify({
        type: 'interrupt',
        timestamp: Date.now(),
      }));
      console.log('[LLMRTCClient] Interrupt signal sent');
    }
  }

  /**
   * Access the underlying LLMRTCWebClient for advanced use cases
   */
  getClient(): LLMRTCWebClient {
    return this.client;
  }
}

/**
 * Singleton instance for backward compatibility
 */
let singletonInstance: LLMRTCClient | null = null;

/**
 * Get or create singleton instance of LLMRTCClient
 */
export function getLLMRTCClient(config: LLMRTCClientConfig): LLMRTCClient {
  if (!singletonInstance) {
    singletonInstance = new LLMRTCClient(config);
  }
  return singletonInstance;
}

/**
 * Reset singleton (useful for testing)
 */
export function resetLLMRTCClient(): void {
  singletonInstance?.disconnect().catch(() => {});
  singletonInstance = null;
}
