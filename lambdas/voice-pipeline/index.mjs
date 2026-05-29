/**
 * Voice Pipeline Lambda — STT → LLM → TTS
 *
 * Receives WAV audio (16kHz mono PCM), transcribes via Transcribe streaming,
 * generates response via Bedrock Claude, synthesises speech via Polly.
 * Returns raw PCM audio with metadata in headers.
 *
 * Deploy: see deploy.sh
 * Invoke mode: BUFFERED (Function URL POST → complete response)
 */

import { TranscribeStreamingClient, StartStreamTranscriptionCommand } from "@aws-sdk/client-transcribe-streaming";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";

const WAV_HEADER_SIZE = 44;
const POLLY_VOICE_ID = "Ruth"; // British English, neural, warm

// ── PCM extraction ──────────────────────────────────────────────────────

function extractPcmFromWav(wavBuffer) {
  if (wavBuffer.length <= WAV_HEADER_SIZE) {
    throw new Error(`WAV too small: ${wavBuffer.length} bytes`);
  }
  return wavBuffer.subarray(WAV_HEADER_SIZE);
}

// ── Transcribe streaming ────────────────────────────────────────────────

async function* audioChunkGenerator(pcmData) {
  const CHUNK_SIZE = 960; // 60ms at 16kHz (2x Silero frame)
  for (let i = 0; i < pcmData.length; i += CHUNK_SIZE) {
    const end = Math.min(i + CHUNK_SIZE, pcmData.length);
    yield { AudioEvent: { AudioChunk: pcmData.subarray(i, end) } };
  }
}

async function transcribeAudio(pcmData, region) {
  const client = new TranscribeStreamingClient({ region });

  const cmd = new StartStreamTranscriptionCommand({
    LanguageCode: "en-US",
    MediaEncoding: "pcm",
    MediaSampleRateHertz: 16000,
    AudioStream: audioChunkGenerator(pcmData),
  });

  const response = await client.send(cmd);
  let transcript = "";

  for await (const event of response.TranscriptResultStream) {
    if (event.TranscriptEvent) {
      const results = event.TranscriptEvent.Transcript.Results;
      for (const result of results) {
        if (result.IsPartial) continue;
        for (const alt of result.Alternatives) {
          transcript += alt.Transcript + " ";
        }
      }
    }
  }

  return transcript.trim();
}

// ── Bedrock ─────────────────────────────────────────────────────────────

async function callBedrock(transcript, region) {
  const client = new BedrockRuntimeClient({ region });

  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 150,
    temperature: 0.7,
    system: [
      "You are a warm, friendly voice assistant. Keep every response to 1-2 short sentences.",
      "Be conversational and natural — never robotic or formal.",
      "Never use markdown, asterisks, emoji, or special formatting.",
      "If asked who you are: you're a voice assistant built by Arthur and Sonnia, running on AWS.",
    ].join(" "),
    messages: [{ role: "user", content: [{ type: "text", text: transcript }] }],
  });

  const cmd = new InvokeModelCommand({
    modelId: "arn:aws:bedrock:eu-west-2:111122223333:inference-profile/eu.anthropic.claude-haiku-4-5-20251001-v1:0",
    contentType: "application/json",
    accept: "application/json",
    body,
  });

  const response = await client.send(cmd);
  const output = JSON.parse(new TextDecoder().decode(response.body));
  return output.content[0].text.replace(/[\*\_\`\n]/g, " ").replace(/\s+/g, " ").trim();
}

// ── Polly ───────────────────────────────────────────────────────────────

async function synthesizeSpeech(text, region, voiceId) {
  const client = new PollyClient({ region });
  const voice = voiceId || POLLY_VOICE_ID;

  const cmd = new SynthesizeSpeechCommand({
    Engine: "generative",
    LanguageCode: "en-GB",
    OutputFormat: "pcm",
    SampleRate: "16000",
    Text: text,
    VoiceId: voice,
  });

  const response = await client.send(cmd);
  const chunks = [];
  for await (const chunk of response.AudioStream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

// ── CORS headers ────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Amz-Date, X-Api-Key, X-Amz-Security-Token",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Expose-Headers": "x-transcript, x-response-text, x-pipeline-ms",
};

// ── Handler ─────────────────────────────────────────────────────────────

export const handler = async (event) => {
  // CORS preflight — check multiple possible method paths
  const httpMethod = event.requestContext?.http?.method || event.httpMethod || event.requestContext?.httpMethod || "";
  if (httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { ...CORS_HEADERS }, body: "" };
  }

  try {
    const region = process.env.AWS_REGION || "eu-west-2";
    const t0 = Date.now();
    const ct = (event.headers?.["content-type"] || event.headers?.["Content-Type"] || "").toLowerCase();

    // Accept two formats:
    //   JSON: { "audio": "<base64-wav>", "voice_id": "optional-polly-voice" }
    //   Binary: raw WAV bytes (Content-Type: audio/wav)
    let pcmData, voiceId;
    if (ct.includes("json") || ct.includes("text/plain") || ct.includes("text/html")) {
      const bodyStr = event.isBase64Encoded
        ? Buffer.from(event.body || "", "base64").toString("utf-8")
        : (event.body || "");
      if (!bodyStr) throw new Error("Empty request body");
      const parsed = JSON.parse(bodyStr);
      const wavBin = Buffer.from(parsed.audio, "base64");
      pcmData = extractPcmFromWav(wavBin);
      voiceId = parsed.voice_id || null;
    } else {
      const rawBody = event.isBase64Encoded
        ? Buffer.from(event.body || "", "base64")
        : Buffer.from(event.body || "");
      pcmData = extractPcmFromWav(rawBody);
    }

    console.log(`[voice-pipeline] PCM: ${pcmData.length} bytes`);

    // Guard: too short (noise/VAD misfire)
    if (pcmData.length < 3200) {
      return {
        statusCode: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transcript: "", response: "", reason: "too-short" }),
      };
    }

    // 1. Transcribe
    const tStt = Date.now();
    const transcript = await transcribeAudio(pcmData, region);
    console.log(`[voice-pipeline] STT: "${transcript}" (${Date.now() - tStt}ms)`);

    if (!transcript) {
      return {
        statusCode: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transcript: "", response: "", reason: "no-speech" }),
      };
    }

    // 2. Bedrock
    const tLlm = Date.now();
    const responseText = await callBedrock(transcript, region);
    console.log(`[voice-pipeline] LLM: "${responseText}" (${Date.now() - tLlm}ms)`);

    // 3. Polly
    const tTts = Date.now();
    const audioBuffer = await synthesizeSpeech(responseText, region, voiceId);
    console.log(`[voice-pipeline] TTS: ${audioBuffer.length} bytes (${Date.now() - tTts}ms)`);
    console.log(`[voice-pipeline] Total: ${Date.now() - t0}ms`);

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "audio/l16;rate=16000;channels=1",
        "x-transcript": encodeURIComponent(transcript),
        "x-response-text": encodeURIComponent(responseText),
        "x-pipeline-ms": String(Date.now() - t0),
      },
      body: audioBuffer.toString("base64"),
      isBase64Encoded: true,
    };

  } catch (error) {
    console.error("[voice-pipeline] Error:", error);
    return {
      statusCode: 500,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
