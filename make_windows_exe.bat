@echo off
cd /d "%~dp0"

echo ========================================================
echo   CrossPost Desktop Studio - Standalone .EXE Builder
echo   Builds standalone desktop app (CrossPostStudio.exe)
echo ========================================================

REM Check if Python is installed
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Please install Python 3.8+ from: https://www.python.org/
    pause
    exit /b 1
)

echo.
echo [1/3] Preparing build tools (pyinstaller, pywebview)...
python -m pip install pyinstaller pywebview --quiet

echo [2/3] Compiling standalone desktop executable (.exe)...
python build_exe.py

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo   [SUCCESS] Standalone app build completed!
    echo   Generated: dist_desktop\CrossPostStudio\CrossPostStudio.exe
    echo   You can double-click this EXE to run the app directly!
    echo ========================================================
    echo.
) else (
    echo.
    echo [ERROR] Build failed. Please check error output above.
)

pause
