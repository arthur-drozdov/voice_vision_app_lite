import { config } from 'dotenv';
config();

import { LLMRTCServer } from '@llmrtc/llmrtc-backend';
import { DeepAgentsLLMProvider } from './DeepAgentsLLMProvider.js';
import { CustomWebSocketSTTProvider } from './CustomSTTProvider.js';
import { CustomWebSocketTTSProvider } from './CustomTTSProvider.js';
import path from 'path';

const server = new LLMRTCServer({
    providers: {
        llm: new DeepAgentsLLMProvider({
            wsUrl: process.env.CHAT_SERVER_URL || 'ws://127.0.0.1:8080/chat'
        }),
        stt: new CustomWebSocketSTTProvider({
            wsUrl: process.env.STT_SERVER_URL || 'ws://127.0.0.1:8002/ws/asr'
        }),
        tts: new CustomWebSocketTTSProvider({
            wsUrl: process.env.TTS_SERVER_URL || 'ws://127.0.0.1:8001/ws/tts',
            refWavPath: path.resolve(import.meta.dirname, '../data/voices/default.wav'),
            refText: "Hi, I'm a voice assistant. This is the reference text used to condition the default text-to-speech voice. Replace it with a short sample matching the audio in your reference WAV file."
        })
    },
    port: 8787,
    streamingTTS: true,
    // Use a generic system prompt. The real logic is in Python DeepAgents.
    systemPrompt: 'You are a helpful voice assistant.'
});

server.on('listening', ({ host, port }) => {
    console.log(`\n  Voice Vision App LLMRTC Server`);
    console.log(`  ==============================`);
    console.log(`  Server running at http://${host}:${port}`);
});

server.on('connection', ({ id }) => {
    console.log(`[server] Client connected: ${id}`);
});

server.on('disconnect', ({ id }) => {
    console.log(`[server] Client disconnected: ${id}`);
});

server.on('error', (err) => {
    console.error(`[server] Error:`, err.message);
});

server.start().catch(console.error);

// Add global error handlers to prevent silent crashes from unhandled websocket drops
process.on('uncaughtException', (err) => {
    console.error('[Global] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[Global] Unhandled Rejection at:', promise, 'reason:', reason);
});
