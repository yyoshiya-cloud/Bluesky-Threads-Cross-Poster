#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CrossPost Desktop Studio - PyInstaller Build Script
Windows (.exe) / macOS (.app) / Linux Standalone Desktop App Builder
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path


def build():
    print("==================================================")
    print(" [CrossPost] Desktop Studio - EXE/APP Builder")
    print("==================================================")

    base_dir = Path(__file__).parent
    dist_web_dir = base_dir / "dist"

    if not dist_web_dir.exists() or not (dist_web_dir / "index.html").exists():
        print("[ERROR] dist/ directory not found.")
        print("Please ensure frontend files are built before compiling.")
        return 1

    try:
        import PyInstaller
    except ImportError:
        print("[ERROR] PyInstaller is not installed.")
        print("Please run: pip install pyinstaller")
        return 1

    # パス区切り文字 (Windowsは分号 ;, Unixはコロン :)
    sep = ";" if sys.platform.startswith("win") else ":"
    data_arg = f"dist{sep}dist"

    cmd = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--name=CrossPostStudio",
        "--noconsole",
        "--onedir",
        f"--distpath={str(base_dir / 'dist_desktop')}",
        f"--add-data={data_arg}",
        "--hidden-import=ssl",
        "--hidden-import=_ssl",
        "desktop_app.py",
        "--clean",
        "-y",
    ]

    # アイコンファイルが存在すれば追加
    icon_path = base_dir / "public" / "favicon.ico"
    if not icon_path.exists():
        icon_path = base_dir / "public" / "favicon.png"
    if icon_path.exists():
        cmd.append(f"--icon={str(icon_path)}")

    print("[Build] Running command:", " ".join(cmd))
    res = subprocess.run(cmd)

    if res.returncode == 0:
        print("\n==================================================")
        print(" [SUCCESS] Standalone desktop build completed!")
        print(" Output directory: dist_desktop/CrossPostStudio/")
        print(" Executable file : dist_desktop/CrossPostStudio/CrossPostStudio.exe")
        print("==================================================")
    else:
        print("\n[ERROR] Build failed. Return code:", res.returncode)
    return res.returncode


if __name__ == "__main__":
    sys.exit(build())
