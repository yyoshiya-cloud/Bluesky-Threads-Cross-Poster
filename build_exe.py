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
    
    # 探索先: desktop_ui または dist
    dist_web_dir = None
    for cand in [base_dir / "desktop_ui", base_dir / "dist"]:
        if cand.exists() and (cand / "index.html").exists():
            dist_web_dir = cand
            break

    if not dist_web_dir:
        # 自動修復: オンラインからUIファイルをダウンロード展開を試みる
        print("[INFO] Local UI directory not found. Attempting automatic download from cloud...")
        try:
            import urllib.request
            import zipfile
            import io
            
            pkg_url = "https://ais-pre-ktrdeobzrgsk4662t6ihxf-196356171486.asia-east1.run.app/api/desktop-package"
            print(f"       Downloading package from {pkg_url} ...")
            req = urllib.request.Request(pkg_url, headers={"User-Agent": "CrossPost-Builder/1.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read()
            
            target_ui = base_dir / "desktop_ui"
            target_ui.mkdir(exist_ok=True, parents=True)
            with zipfile.ZipFile(io.BytesIO(data)) as zf:
                for member in zf.infolist():
                    if member.filename.startswith("dist/"):
                        rel_path = member.filename[len("dist/"):]
                        if not rel_path or rel_path.endswith("/"):
                            continue
                        dest_file = target_ui / rel_path
                        dest_file.parent.mkdir(parents=True, exist_ok=True)
                        with zf.open(member) as src, open(dest_file, "wb") as dst:
                            dst.write(src.read())
            
            if (target_ui / "index.html").exists():
                print("[OK] UI bundle successfully restored into desktop_ui/")
                dist_web_dir = target_ui
        except Exception as e:
            print(f"[WARNING] Automatic UI download failed: {e}")

    if not dist_web_dir or not (dist_web_dir / "index.html").exists():
        print("[ERROR] Neither desktop_ui/ nor dist/ directory was found.")
        print("Please ensure the project files are fully extracted.")
        return 1

    print(f"[OK] Using UI bundle directory: {dist_web_dir.name}")

    try:
        import PyInstaller
    except ImportError:
        print("[ERROR] PyInstaller is not installed.")
        print("Please run: pip install pyinstaller")
        return 1

    # パス区切り文字 (Windowsは分号 ;, Unixはコロン :)
    sep = ";" if sys.platform.startswith("win") else ":"
    ui_folder_name = dist_web_dir.name
    data_arg = f"{ui_folder_name}{sep}{ui_folder_name}"

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
