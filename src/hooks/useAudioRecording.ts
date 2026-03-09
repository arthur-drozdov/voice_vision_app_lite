/**
 * Audio Recording Hook
 *
 * This hook provides functionality for recording audio from the microphone
 * using LLMRTC with VAD (Silero VAD v5) for speech detection.
 *
 * LLMRTC Integration:
 * - VAD (Silero VAD v5) handles speech detection server-side
 * - Provides waveform visualization for the LLMRTC audio stream
 * - Barge-in is handled automatically by LLMRTC when VAD detects speech during TTS
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { LLMRTCClient } from '@/lib/llmrtcClient';

export interface UseAudioRecordingReturn {
  isRecording: boolean;
  isPermissionDenied: boolean;
  waveformData: number[];
  duration: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob>;
  cancelRecording: () => void;
  error: string | null;
}

export interface UseAudioRecordingOptions {
  /**
   * LLMRTC client for VAD-based speech detection (required)
   * Uses Silero VAD v5 for accurate speech detection.
   */
  llmrtcClient: LLMRTCClient;

  /**
   * Callback for when VAD detects speech start
   */
  onSpeechStart?: () => void;

  /**
   * Callback for when VAD detects speech end
   */
  onSpeechEnd?: () => void;

  /**
   * Callback for barge-in event when TTS is interrupted
   */
  onBargeIn?: () => void;
}

/**
 * Hook for recording audio from the microphone using LLMRTC
 *
 * @param options - Optional configuration including LLMRTC client
 * @returns Object containing recording state and control functions
 */
export function useAudioRecording(options?: UseAudioRecordingOptions): UseAudioRecordingReturn {
  const { llmrtcClient, onSpeechStart, onSpeechEnd, onBargeIn } = options || {};

  const [isRecording, setIsRecording] = useState(false);
  const [isPermissionDenied, setIsPermissionDenied] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<number | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop duration interval
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Stop audio tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Reset state
    mediaRecorderRef.current = null;
    analyserRef.current = null;
    chunksRef.current = [];
    setWaveformData([]);
    setDuration(0);
  }, []);

  const updateWaveform = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Normalize to 0-1 range and sample to get a manageable number of points
    const samples: number[] = [];
    const sampleCount = 50; // Number of waveform points
    const step = Math.floor(dataArray.length / sampleCount);

    for (let i = 0; i < sampleCount; i++) {
      const value = dataArray[i * step] / 255;
      samples.push(value);
    }

    setWaveformData(samples);

    animationFrameRef.current = requestAnimationFrame(updateWaveform);
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setIsPermissionDenied(false);

    try {
      console.log('[useAudioRecording] Starting recording' + (llmrtcClient ? ' with LLMRTC VAD' : ' (local only)'));

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000,
        },
      });

      streamRef.current = stream;
      chunksRef.current = [];

      // Setup audio context for waveform visualization
      const audioContext = new AudioContext({ sampleRate: 48000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Setup local MediaRecorder if llmrtcClient is not used
      if (!llmrtcClient) {
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        mediaRecorder.start();
      }

      // Start waveform visualization
      updateWaveform();

      // Start duration timer
      setDuration(0);
      durationIntervalRef.current = window.setInterval(() => {
        setDuration((prev) => prev + 0.1);
      }, 100);

      // Share audio with LLMRTC client if provided
      if (llmrtcClient) {
        await llmrtcClient.startRecording();
      }

      setIsRecording(true);
      console.log('[useAudioRecording] Recording started');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setIsPermissionDenied(true);
        setError('Microphone access denied. Please enable microphone permissions.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to start recording');
      }
      console.error('Failed to start recording:', err);
      cleanup();
    }
  }, [llmrtcClient, cleanup, updateWaveform]);

  const stopRecording = useCallback(async (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      console.log('[useAudioRecording] Stopping recording');

      const finish = () => {
        // If we have local chunks, combine them into a blob
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
          cleanup();
          setIsRecording(false);
          resolve(blob);
        } else {
          cleanup();
          setIsRecording(false);
          // Return empty blob for LLMRTC case (handled server-side)
          resolve(new Blob([], { type: 'audio/webm;codecs=opus' }));
        }
      };

      if (llmrtcClient) {
        llmrtcClient.stopRecording()
          .then(finish)
          .catch((err) => {
            cleanup();
            setIsRecording(false);
            reject(err);
          });
      } else if (mediaRecorderRef.current) {
        mediaRecorderRef.current.onstop = finish;
        mediaRecorderRef.current.stop();
      } else {
        finish();
      }
    });
  }, [llmrtcClient, cleanup]);

  const cancelRecording = useCallback(() => {
    console.log('[useAudioRecording] Cancelling recording');
    if (llmrtcClient) {
      llmrtcClient.stopRecording().catch(() => { });
    }
    cleanup();
    setIsRecording(false);
    setError(null);
  }, [llmrtcClient, cleanup]);

  return {
    isRecording,
    isPermissionDenied,
    waveformData,
    duration,
    startRecording,
    stopRecording,
    cancelRecording,
    error,
  };
}

export default useAudioRecording;
