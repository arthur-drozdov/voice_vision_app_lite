/**
 * Voice Pipeline Client
 *
 * Wraps the Lambda Function URL call for STT→LLM→TTS.
 * Converts VAD Float32Array audio → WAV, posts to Lambda, plays PCM response.
 */

export interface VoicePipelineResult {
  transcript: string;
  response: string;
  pipelineMs: number;
}

export interface VoicePipelineError {
  error: string;
  reason?: "too-short" | "no-speech" | "http-error";
}

/**
 * Convert Float32Array PCM (-1..1) at 16kHz mono → base64 WAV string.
 */
function float32ToWavBase64(samples: Float32Array, sampleRate: number = 16000): string {
  const numChannels = 1;
  const bitDepth = 16;
  const numSamples = samples.length;
  const dataSize = numSamples * (bitDepth / 8);
  const headerSize = 44;
  const fileSize = headerSize + dataSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, fileSize - 8, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(44 + i * 2, intSample, true);
  }

  // Encode as base64 — browser-safe, avoids CORS preflight
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Call the voice pipeline Lambda and play the response.
 */
export async function callVoicePipeline(
  audio: Float32Array,
  pipelineUrl: string,
  onPlaybackState?: (state: "thinking" | "speaking" | "done") => void,
  signal?: AbortSignal,
  voiceId?: string
): Promise<VoicePipelineResult> {
  const wavBase64 = float32ToWavBase64(audio, 16000);

  // Check if already aborted
  if (signal?.aborted) throw { error: "Cancelled", reason: "cancelled" };

  // Send as JSON with text/plain to avoid CORS preflight
  const body: Record<string, string> = { audio: wavBase64 };
  if (voiceId) body.voice_id = voiceId;

  const response = await fetch(pipelineUrl, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "text/plain",
    },
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw {
      error: body.error || `HTTP ${response.status}`,
      reason: body.reason,
    } satisfies VoicePipelineError;
  }

  const contentType = response.headers.get("Content-Type") || "";

  // JSON response = no speech or error
  if (contentType.includes("application/json")) {
    const body = await response.json();
    throw {
      error: body.reason === "no-speech" ? "No speech detected" : body.reason || "unknown",
      reason: body.reason,
    } satisfies VoicePipelineError;
  }

  // Extract metadata from headers
  const transcript = decodeURIComponent(
    response.headers.get("x-transcript") || ""
  );
  const responseText = decodeURIComponent(
    response.headers.get("x-response-text") || ""
  );
  const pipelineMs = parseInt(
    response.headers.get("x-pipeline-ms") || "0",
    10
  );

  // PCM audio: play it with barge-in support
  if (response.ok && !signal?.aborted) {
    onPlaybackState?.("thinking");
    const audioBuffer = await response.arrayBuffer();
    if (audioBuffer.byteLength > 0 && !signal?.aborted) {
      await playPcmAudio(audioBuffer, signal, () => onPlaybackState?.("speaking"));
    }
  }

  if (!signal?.aborted) {
    onPlaybackState?.("done");
  }

  return { transcript, response: responseText, pipelineMs };
}

/**
 * Play raw PCM Int16 mono 16kHz audio via Web Audio API.
 * Supports barge-in via AbortSignal.
 */
async function playPcmAudio(
  pcmData: ArrayBuffer,
  signal?: AbortSignal,
  onStart?: () => void
): Promise<void> {
  const audioContext = new AudioContext({ sampleRate: 16000 });
  const int16Data = new Int16Array(pcmData);
  const floatData = new Float32Array(int16Data.length);

  // Convert Int16 → Float32 (-1..1)
  for (let i = 0; i < int16Data.length; i++) {
    floatData[i] = int16Data[i] / (int16Data[i] < 0 ? 0x8000 : 0x7fff);
  }

  const audioBuffer = audioContext.createBuffer(1, floatData.length, 16000);
  audioBuffer.getChannelData(0).set(floatData);

  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);

  return new Promise((resolve) => {
    const onAbort = () => {
      try { source.stop(0); } catch {}
      audioContext.close().catch(() => {});
      resolve();
    };

    // Barge-in: stop playback immediately
    if (signal) {
      if (signal.aborted) { onAbort(); return; }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    source.onended = () => {
      signal?.removeEventListener("abort", onAbort);
      audioContext.close();
      resolve();
    };
    source.start(0);
    onStart?.();
  });
}

/**
 * Preconnect to Lambda URL to warm the connection.
 */
export function preconnectPipeline(pipelineUrl: string) {
  const link = document.createElement("link");
  link.rel = "preconnect";
  link.href = new URL(pipelineUrl).origin;
  document.head.appendChild(link);
}
