#!/usr/bin/env bash
echo "==================================================="
echo "  CrossPost Desktop Studio - Bluesky & Threads"
echo "  単体デスクトップアプリを起動しています..."
echo "==================================================="

if command -v python3 >/dev/null 2>&1; then
    PYTHON_CMD=python3
elif command -v python >/dev/null 2>&1; then
    PYTHON_CMD=python
else
    echo "[エラー] Python が見つかりません。Python 3.8以上をインストールしてください。"
    exit 1
fi

# 単体ウィンドウエンジンの確認
if ! $PYTHON_CMD -c "import webview" >/dev/null 2>&1; then
    echo "単体ネイティブウィンドウ用エンジン (pywebview) を準備しています..."
    $PYTHON_CMD -m pip install pywebview --quiet >/dev/null 2>&1 || true
fi

$PYTHON_CMD desktop_app.py
