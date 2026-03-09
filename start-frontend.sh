#!/bin/bash
# Start the frontend development server for voice_vision_app
# This script installs dependencies (if needed) and starts the Vite dev server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Setting up frontend..."

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

echo "Starting frontend development server..."
echo "Frontend will be available at http://localhost:5173"
echo ""

# Start the Vite dev server
npm run dev
