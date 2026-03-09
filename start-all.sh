#!/bin/bash
# Start both backend and frontend for voice_vision_app
# This script starts the Python backend and the frontend dev server concurrently

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "  Voice Vision App - Complete Startup"
echo "=========================================="
echo ""

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

# Start backend in background
echo "Starting Python backend server..."
echo "Backend: http://127.0.0.1:8080"
uv run python python_bridge.py &
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Start frontend
echo ""
echo "Starting frontend development server..."
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"
echo "=========================================="
echo ""

# Trap Ctrl+C to clean up
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $BACKEND_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start frontend (this will block)
npm run dev
