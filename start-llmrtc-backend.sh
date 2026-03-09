#!/bin/bash
# Start the LLMRTC backend server for voice_vision_app
# This server handles WebRTC signalling, VAD, and AI integration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "  LLMRTC Backend Server"
echo "=========================================="

# Check if backend dependencies are installed
if [ ! -d "server/node_modules" ]; then
    echo "Installing LLMRTC backend dependencies..."
    cd server
    npm install
    cd "$SCRIPT_DIR"
fi

echo ""
echo "Starting LLMRTC backend server..."
echo "Backend: ws://localhost:8787"
echo ""
echo "Press Ctrl+C to stop the server"
echo "=========================================="
echo ""

# Start the backend from the server directory
cd server
npm start
