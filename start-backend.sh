#!/bin/bash
# Start the Python backend server for voice_vision_app
# This script starts the FastAPI server running python_bridge.py

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Starting Python backend server..."
echo "Backend will be available at http://127.0.0.1:8080"
echo ""

# Run the Python backend using uv
uv run python python_bridge.py
