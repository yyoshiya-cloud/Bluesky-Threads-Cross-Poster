@echo off
cd /d "%~dp0"

echo ========================================================
echo   CrossPost Desktop Studio - Bluesky & Threads
echo   Starting Standalone Desktop App...
echo ========================================================

REM Check if Python is installed
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python 3.8+ from: https://www.python.org/
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)

REM Check if frontend UI files exist
if not exist "dist\index.html" if not exist "index.html" (
    echo [WARNING] dist\index.html was not found.
    echo Please download the complete ZIP package from the app header.
    echo.
)

REM Check and setup pywebview if missing
python -c "import webview" >nul 2>nul
if %errorlevel% neq 0 (
    echo [Setup] Setting up pywebview native window engine...
    python -m pip install pywebview --quiet
)

REM Launch desktop app without opening standard browser
echo [Launch] Starting app window...
python desktop_app.py
if %errorlevel% neq 0 (
    echo.
    echo [Exit] App closed or encountered an error.
    pause
)
