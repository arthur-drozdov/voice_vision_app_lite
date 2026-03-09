@echo off
echo Starting AI App servers...

:: Start Python backend in a new window
start "Python Backend" cmd /k "cd /d "%~dp0" && uv run python python_bridge.py"

:: Wait a moment then start LLMRTC backend in another new window
timeout /t 2 /nobreak >nul
start "LLMRTC Backend" cmd /k "cd /d "%~dp0server" && npm start"

echo Both servers are starting in separate windows.
echo You can close this window.
