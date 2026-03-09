import { TTSProvider, TTSConfig, TTSResult } from '@llmrtc/llmrtc-core';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Get dirname in ESM or CJS
const currentDir = typeof __dirname !== 'undefined' ? __dirname : import.meta.dirname || process.cwd();

export class CustomWebSocketTTSProvider implements TTSProvider {
    private static referenceCache = new Map<string, number[]>();
    public name = 'custom-ws-tts';
    private wsUrl: string;
    private refWavPath?: string;
    private refText?: string;
    private isFirstRequest = true;
    private sessionVoiceId: string | null = null;
    private lastSelectionMtime = 0;
    private cachedVoiceId: string | null = null;

    constructor(options: { wsUrl: string, refWavPath?: string, refText?: string }) {
        this.wsUrl = options.wsUrl;
        this.refWavPath = options.refWavPath;
        this.refText = options.refText;
    }

    async speak(text: string, config?: TTSConfig): Promise<TTSResult> {
        const buffers: Buffer[] = [];
        for await (const chunk of this.speakStream(text, config)) {
            buffers.push(chunk);
        }
        // Resulting audio is pcm16 for llmrtc-core consumption
        return { audio: Buffer.concat(buffers), format: 'pcm' };
    }

    async *speakStream(text: string, config?: TTSConfig): AsyncIterable<Buffer> {
        let ws: WebSocket | null = null;
        let resolveMessage: (() => void) | null = null;
        let isConnected = false;
        let wsClosed = false;
        const messageQueue: any[] = [];
        let receivedMeta = false;

        // Audio buffer for smoothing - accumulate chunks before yielding
        const audioBuffer: Buffer[] = [];
        const MIN_BUFFER_SIZE = 1200;  // Reduced further for faster initial response (~0.025s at 24kHz)
        let isFirstChunk = true;  // Yield first chunk immediately for faster response

        try {
            ws = new WebSocket(this.wsUrl, { maxPayload: 100 * 1024 * 1024 });

            ws.on('open', () => {
                isConnected = true;
                const payload: any = {
                    text: text,
                    emit_every_frames: 2,  // Reduced from 4 for even faster initial streaming
                    decode_window_frames: 24,  // Reduced from 32 for lower latency
                };

                // Check for selected voice override
                let activeRefWav = this.refWavPath;
                let activeRefText = this.refText;
                let voiceId: string | null = null;

                try {
                    const selectionPath = path.resolve(currentDir, '../data/voices/selected_voice.json');
                    if (fs.existsSync(selectionPath)) {
                        // Use stats to check if file changed
                        const stats = fs.statSync(selectionPath);
                        const mtime = stats.mtimeMs;

                        if (this.lastSelectionMtime !== mtime) {
                            console.log(`[tts] Selection file changed or first read. Reloading...`);
                            const selection = JSON.parse(fs.readFileSync(selectionPath, 'utf8'));
                            this.cachedVoiceId = selection.voice_id;
                            this.lastSelectionMtime = mtime;
                        }

                        voiceId = this.cachedVoiceId;

                        if (voiceId && voiceId !== 'reference_voice') {
                            const voicesPath = path.resolve(currentDir, '../data/voices/voices.json');
                            if (fs.existsSync(voicesPath)) {
                                const voices = JSON.parse(fs.readFileSync(voicesPath, 'utf8'));
                                const selectedVoice = voices.find((v: any) => v.voice_id === voiceId);
                                if (selectedVoice && selectedVoice.reference_audio_path) {
                                    activeRefWav = selectedVoice.reference_audio_path;
                                    activeRefText = selectedVoice.reference_text;
                                    console.log(`[tts] Using custom selected voice: ${selectedVoice.name} (${voiceId})`);
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error("[tts] Failed to load selected voice override", e);
                }

                // Send ref audio if it's the first request or if the voice has changed
                const shouldSendRef = this.isFirstRequest || (voiceId && voiceId !== this.sessionVoiceId);

                if (shouldSendRef && activeRefWav) {
                    try {
                        if (fs.existsSync(activeRefWav)) {
                            // Check global cache first
                            let floats = CustomWebSocketTTSProvider.referenceCache.get(activeRefWav);

                            if (floats) {
                                console.log(`[tts] Cache hit for reference audio: ${activeRefWav}`);
                            } else {
                                console.log(`[tts] Cache miss. Loading reference audio via python helper...`);
                                const scriptPath = path.join(currentDir, 'get_ref_floats.py');
                                const cliDir = path.resolve(currentDir, '../../cli');

                                // Execute the small python script to get floats matching tts_client.py
                                const out = execSync(`cd ${cliDir} && uv run --with librosa --with numpy --with soundfile python ${scriptPath} ${activeRefWav}`, {
                                    maxBuffer: 100 * 1024 * 1024,
                                    encoding: 'utf-8'
                                });

                                floats = JSON.parse(out);
                                if (floats) {
                                    CustomWebSocketTTSProvider.referenceCache.set(activeRefWav, floats);
                                }
                            }

                            payload.ref_audio = floats;

                            // Also read ref text
                            if (activeRefText && fs.existsSync(activeRefText)) {
                                console.log(`[tts] Loading reference text from ${activeRefText}`);
                                payload.ref_text = fs.readFileSync(activeRefText, 'utf8').trim();
                            } else {
                                payload.ref_text = activeRefText || '';
                            }

                            // Update session state
                            this.sessionVoiceId = voiceId || 'reference_voice';
                        } else {
                            console.warn(`[tts] Reference audio not found at ${activeRefWav}, skipping reference clone.`);
                        }
                    } catch (e) {
                        console.error("[tts] Failed to load ref audio via python helper", e);
                    }
                    this.isFirstRequest = false;
                } else if (voiceId === this.sessionVoiceId) {
                    console.log(`[tts] Voice "${voiceId}" already active in session, skipping redundant reference transfer.`);
                }

                try {
                    const payloadStr = JSON.stringify(payload);
                    console.log(`[tts] Sending request for text: "${text.substring(0, 30)}..." (payload size: ${payloadStr.length} bytes)`);
                    if (ws?.readyState === WebSocket.OPEN) {
                        ws.send(payloadStr, (err) => {
                            if (err) console.error("[tts] WebSocket send error:", err);
                            else console.log("[tts] WebSocket send successful");
                        });
                    }
                } catch (sendErr) {
                    console.error("[tts] Caught error during ws.send:", sendErr);
                }
            });

            ws.on('message', (data: WebSocket.Data) => {
                const len = data instanceof Buffer ? data.length : 'N/A';
                if (isFirstChunk && data instanceof Buffer) {
                    console.log(`[tts] Received first binary message from server (length: ${len})`);
                }
                messageQueue.push(data);
                if (resolveMessage) {
                    resolveMessage();
                    resolveMessage = null;
                }
            });

            ws.on('close', () => {
                wsClosed = true;
                if (resolveMessage) resolveMessage();
            });

            ws.on('error', (err) => {
                console.error('TTS WebSocket Error', err);
                wsClosed = true;
                if (resolveMessage) resolveMessage();
            });

            // Wait until connected and sent
            while (!isConnected && !wsClosed) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            if (wsClosed) return;

            while (true) {
                if (messageQueue.length === 0) {
                    if (wsClosed) break;
                    await new Promise<void>(resolve => { resolveMessage = resolve; });
                }

                const msg = messageQueue.shift();
                if (!msg) continue;

                let isJson = false;
                let jsonPayload: any = null;

                try {
                    const textMsg = msg.toString('utf8');
                    if (textMsg.trim().startsWith('{')) {
                        jsonPayload = JSON.parse(textMsg);
                        isJson = true;
                    }
                } catch (e) {
                    // Not JSON
                }

                if (isJson) {
                    if (jsonPayload.event === 'meta') {
                        console.log(`[tts] Received meta: ${JSON.stringify(jsonPayload)}`);
                        receivedMeta = true;
                    } else if (jsonPayload.event === 'eos') {
                        console.log(`[tts] Received EOS`);
                        // Flush any remaining buffered audio before ending
                        if (audioBuffer.length > 0) {
                            const totalBufferSize = audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
                            console.log(`[tts] Flushing ${audioBuffer.length} buffered chunks (${totalBufferSize} bytes)`);
                            const combinedBuffer = Buffer.concat(audioBuffer);
                            audioBuffer.length = 0;
                            yield combinedBuffer;
                        }
                        break;
                    } else if (jsonPayload.error) {
                        console.error("[tts] TTS Server Error:", jsonPayload.error);
                        break;
                    }
                } else {
                    // Binary audio chunk - accumulate for buffering
                    if (receivedMeta && Buffer.isBuffer(msg)) {
                        try {
                            const numSamples = msg.length / 4;
                            const convertedBuffer = Buffer.alloc(numSamples * 2);

                            for (let i = 0; i < numSamples; i++) {
                                let s = msg.readFloatLE(i * 4);
                                s = Math.max(-1, Math.min(1, s));
                                const intVal = Math.round(s < 0 ? s * 0x8000 : s * 0x7FFF);
                                convertedBuffer.writeInt16LE(intVal, i * 2);
                            }

                            // Yield first chunk immediately for fastest response
                            if (isFirstChunk) {
                                console.log(`[tts] Yielding first audio chunk (${convertedBuffer.length} bytes)`);
                                isFirstChunk = false;
                                yield convertedBuffer;
                            } else {
                                // Add to buffer for subsequent chunks
                                audioBuffer.push(convertedBuffer);

                                // Check if we have enough data to yield
                                const totalBufferSize = audioBuffer.reduce((sum, buf) => sum + buf.length, 0);
                                if (totalBufferSize >= MIN_BUFFER_SIZE) {
                                    const combinedBuffer = Buffer.concat(audioBuffer);
                                    audioBuffer.length = 0;
                                    yield combinedBuffer;
                                }
                            }

                        } catch (e) {
                            console.error("[tts] Error converting audio chunk", e);
                        }
                    } else if (!receivedMeta) {
                        console.warn(`[tts] Skipping binary data received before meta event (length: ${msg.length})`);
                    }
                }
            }
        } catch (globalErr) {
            console.error('[tts] Unexpected global error in speakStream:', globalErr);
        } finally {
            try {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.close();
                }
            } catch (closeErr) {
                console.error('[tts] Error closing websocket:', closeErr);
            }
        }
    }
}
