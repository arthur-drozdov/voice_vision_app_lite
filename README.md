# Voice Vision App

A voice-interactive web application with voice cloning capabilities and visual assistant features.

## Overview

This application combines:

- **Voice Assistant**: Real-time voice chat with AI
- **Voice Cloning**: Create custom voice clones for personalized audio responses
- **Camera Vision**: Visual understanding of your environment
- **Audio Playback**: Synthesized speech using cloned or default voices

## Architecture

The project consists of three components:

1. **Frontend**: React + TypeScript + Vite with a modern UI using shadcn-ui and Tailwind CSS
2. **Python Backend** ([`python_bridge.py`](python_bridge.py)): FastAPI server providing:
   - Voice cloning API (REST endpoints for recording, listing, deleting voice clones)
   - TTS preview synthesis
   - Camera vision integration
3. **LLMRTC Backend** ([`llmrtc-lib/packages/backend`](llmrtc-lib/packages/backend)): Real-time WebRTC server providing:
   - Voice Activity Detection (VAD) using Silero VAD v5
   - WebRTC signalling for audio streaming
   - AI integration with LLM providers
   - Barge-in support (TTS interruption when user speaks)

**Important**: The LLMRTC backend must be running for voice features to work. It runs separately on `ws://localhost:8787`.

## Prerequisites

Before getting started, ensure you have:

- **Node.js** (v18+) and **npm**
- **Python** (3.11+)
- **[uv](https://github.com/astral-sh/uv)** - Fast Python package installer

## Quick Start

### Prerequisites

Before starting, you need to configure API keys for the LLMRTC backend:

```bash
# Copy the example environment file
cp llmrtc-lib/.env.test.example llmrtc-lib/.env

# Edit llmrtc-lib/.env and add your API keys:
# - OPENAI_API_KEY (required for LLM/STT/TTS)
# - Or configure other providers (Anthropic, ElevenLabs, etc.)
```

### Option 1: Start Everything at Once

The easiest way to start the application:

```bash
./start-all.sh
```

This script will:

1. Install frontend dependencies (if needed)
2. Start the Python backend server
3. Start the frontend development server

**Note**: This starts the Python backend and frontend only. The LLMRTC backend must be started separately.

The application will be available at:

- **Frontend**: http://localhost:5173
- **Python Backend**: http://127.0.0.1:8080

### Option 2: Start All Services Separately

You need **three terminals** for full functionality:

**Terminal 1 - LLMRTC Backend** (required for voice features):

```bash
./start-llmrtc-backend.sh
```

This starts the WebRTC signalling server on `ws://localhost:8787`.

**Terminal 2 - Python Backend**:

```bash
./start-backend.sh
```

This starts the voice cloning API on `http://127.0.0.1:8080`.

**Terminal 3 - Frontend**:

```bash
./start-frontend.sh
```

This starts the React dev server on `http://localhost:5173`.

## Manual Setup

If the convenience scripts don't work, you can start manually:

### 1. Install Frontend Dependencies

```bash
npm install
```

### 2. Start the Backend Server

```bash
uv run python python_bridge.py
```

The backend will start at http://127.0.0.1:8080

### 3. Start the Frontend Dev Server

**Important**: The backend must be running first!

```bash
npm run dev
```

The frontend will start at http://localhost:5173

## Configuration

### Environment Variables

Copy the example environment file and configure as needed:

```bash
cp .env.example .env
```

Key configuration:

- `TAVILY_API_KEY`: Required for web search capabilities
- `LANGSMITH_TRACING`: Optional, for LangChain tracing
- `LANGSMITH_ENDPOINT`: LangSmith API endpoint
- `LANGSMITH_API_KEY`: LangSmith API key

### Backend Configuration

The backend uses:

- **ASR Server**: `ws://localhost:8002/ws/asr` (configurable via `STT_SERVER_URL`)
- **TTS Server**: `ws://localhost:8001/ws/tts` (configurable via `TTS_SERVER_URL`)

These external servers handle speech recognition and synthesis.

## Features

### Voice Cloning

1. Click the microphone to record 5+ seconds of clear speech
2. Give your voice clone a name
3. Use your cloned voice for audio playback

**API Endpoints:**

- `POST /api/voice-cloning/record` - Create voice clone
- `GET /api/voice-cloning/voices` - List all voices
- `DELETE /api/voice-cloning/voices/{voice_id}` - Delete voice
- `POST /api/audio/tts/preview` - Synthesize preview audio

### Voice Assistant

- Use the microphone button to speak
- The assistant responds with both text and audio
- Camera vision available when you ask "what do you see?"

### Web Search

The assistant can search the web using Tavily:

- Ask questions requiring current information
- The assistant will automatically use the Search tool

## Troubleshooting

### LLMRTC Backend Not Starting

**Problem**: VAD initialization fails with "ENOENT: no such file or directory" error

**Solutions**:

1. Ensure LLMRTC backend dependencies are installed:

   ```bash
   cd llmrtc-lib/packages/backend
   npm install
   ```

2. Verify the VAD model exists:

   ```bash
   ls llmrtc-lib/node_modules/avr-vad/dist/silero_vad_v5.onnx
   ```

3. Check that `.env` is configured at `llmrtc-lib/.env` with valid API keys

### Backend Not Starting

**Problem**: Python backend fails to start or crashes

**Solutions**:

1. Ensure `uv` is installed: `uv --version`
2. Check Python version: `python --version` (requires 3.11+)
3. Verify dependencies: `uv sync`
4. Check if port 8080 is already in use

### Frontend Won't Connect

**Problem**: Frontend shows connection errors

**Solutions**:

1. **LLMRTC backend must be running!** The voice features require the LLMRTC backend at `ws://localhost:8787`
2. **Python backend must be running first!** Start Python backend before frontend
3. Verify backends are accessible:
   - `curl http://127.0.0.1:8080` (Python backend)
   - Check terminal for LLMRTC backend startup confirmation
4. Check browser console for WebSocket errors
5. Ensure `VITE_LLMRTC_BACKEND_URL` is set correctly in `.env` (default: `ws://localhost:8787`)

### Voice Cloning Errors

**Problem**: Voice cloning fails or produces errors

**Solutions**:

1. Record clear audio (5-10 seconds recommended)
2. Speak clearly without background noise
3. Ensure TTS server is accessible
4. Check backend logs for detailed errors

### TTS Preview Not Playing

**Problem**: Preview button shows loading but no sound

**Solutions**:

1. Ensure backend is running and accessible
2. Check browser permissions for audio playback
3. Verify voice clone was created successfully
4. Try selecting the voice first before preview

### Dependencies Issues

**Problem**: `npm install` fails or missing modules

**Solutions**:

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Or use npm audit fix for security issues
npm audit fix
```

## Project Structure

```
libs/voice_vision_app/
├── python_bridge.py          # Main backend server (FastAPI)
├── audio_utils.py            # Audio processing utilities
├── package.json              # Frontend dependencies
├── vite.config.ts           # Vite configuration
├── tsconfig.json            # TypeScript configuration
├── start-backend.sh         # Backend startup script
├── start-frontend.sh        # Frontend startup script
├── start-all.sh             # Start both services
├── src/                     # Frontend source code
│   ├── components/          # React components
│   │   ├── VoiceCloningPanel.tsx
│   │   └── ui/             # shadcn-ui components
│   ├── hooks/              # Custom React hooks
│   │   └── useAudioRecording.ts
│   ├── lib/                # API clients
│   │   ├── voiceCloningApi.ts
│   │   └── llmrtcClient.ts
│   └── pages/              # Page components
│       └── VideoAgent.tsx
├── services/                # Backend services
│   └── voice_store.py       # Voice clone storage
├── llmrtc-lib/              # LLMRTC client library
└── data/voices/             # Stored voice clones
```

## API Documentation

### Voice Cloning API

#### Create Voice Clone

```http
POST /api/voice-cloning/record
Content-Type: multipart/form-data

ref_audio: File (WAV format, 5-10 seconds)
ref_text: string (optional, auto-transcribed if not provided)
name: string (optional)
```

#### List Voices

```http
GET /api/voice-cloning/voices
```

#### Delete Voice

```http
DELETE /api/voice-cloning/voices/{voice_id}
```

#### TTS Preview

```http
POST /api/audio/tts/preview
Content-Type: application/json

{
  "text": "Hello, this is a preview!",
  "voice_id": "voice-123"  // optional
}

Response:
{
  "audio_base64": "base64-encoded-float32-audio",
  "sample_rate": 24000,
  "duration_seconds": 2.5
}
```

### Audio Streaming

WebSocket endpoint for full-duplex audio:

```
WebSocket: ws://127.0.0.1:8080/audio/full-duplex
```

**Protocol:**

- Client sends: `{"type": "audio", "data": base64_float32}`
- Client sends: `{"type": "stop"}` to end utterance
- Server responds: `{"type": "transcript", "text": "..."}`
- Server responds: `{"type": "audio", "data": base64_float32}`
- Server responds: `{"type": "done"}` when complete

## Development

### Linting and Formatting

```bash
# Lint Python code
make lint

# Format Python code
make format

# Lint TypeScript/React
npm run lint
```

### Testing

```bash
# Run frontend tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review backend logs for detailed error messages
3. Check browser console for frontend errors
4. Ensure all prerequisites are met

## License

This project is part of the Deep Agents monorepo. See the root repository for license information.
