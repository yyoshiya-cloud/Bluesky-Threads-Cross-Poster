#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CrossPost Desktop Studio - Bluesky & Threads Cross-Poster
Python デスクトップアプリケーション

Webアプリの全UI・全機能（Bluesky/Threads同時投稿、自動分割、画像添付、予約投稿など）を
そのままPythonネイティブデスクトップアプリとして実行します。
"""

import os
import sys
import json
import time
import re
import socket
import threading
import mimetypes
import secrets
from pathlib import Path
from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.request
import urllib.error
import urllib.parse
import subprocess
import shutil
import hashlib
import zipfile
import io

# -------------------------------------------------------------
# Windows / CP932 文字コード安全化 & 出力ハンドラ
# -------------------------------------------------------------
if sys.platform == "win32":
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def _safe_print(*args, **kwargs):
    """
    Windows環境 (CP932 / PyInstaller --noconsole) で
    UnicodeEncodeError や NoneType.write エラーを起こさない安全なprint
    """
    try:
        target = kwargs.get("file", sys.stdout)
        if target is None:
            return
        sep = kwargs.get("sep", " ")
        end = kwargs.get("end", "\n")
        raw_text = sep.join(str(a) for a in args) + end
        try:
            target.write(raw_text)
            target.flush()
        except UnicodeEncodeError:
            # CP932等でエンコードできない絵文字文字を安全に置換して出力
            safe_text = raw_text.encode("ascii", errors="backslashreplace").decode("ascii")
            target.write(safe_text)
            target.flush()
    except Exception:
        pass


print = _safe_print

# -------------------------------------------------------------
# OSクリップボード連携 (デスクトップアプリ内テキスト操作の確実化)
# -------------------------------------------------------------
def get_system_clipboard() -> str:
    """OSシステムクリップボードからテキストを取得"""
    # 1. Windows ctypes (外部依存なし・高速)
    if sys.platform == "win32":
        try:
            import ctypes
            CF_UNICODETEXT = 13
            user32 = ctypes.windll.user32
            kernel32 = ctypes.windll.kernel32
            if user32.OpenClipboard(None):
                try:
                    handle = user32.GetClipboardData(CF_UNICODETEXT)
                    if handle:
                        ptr = kernel32.GlobalLock(handle)
                        if ptr:
                            try:
                                return ctypes.c_wchar_p(ptr).value or ""
                            finally:
                                kernel32.GlobalUnlock(handle)
                finally:
                    user32.CloseClipboard()
        except Exception:
            pass

    # 2. Tkinter フォールバック
    try:
        import tkinter as tk
        r = tk.Tk()
        r.withdraw()
        text = r.clipboard_get()
        r.destroy()
        return text or ""
    except Exception:
        pass

    # 3. macOS pbpaste
    if sys.platform == "darwin":
        try:
            out = subprocess.check_output(["pbpaste"], timeout=1)
            return out.decode("utf-8", errors="replace")
        except Exception:
            pass

    # 4. Windows PowerShell フォールバック
    if sys.platform == "win32":
        try:
            out = subprocess.check_output(
                ["powershell", "-NoProfile", "-Command", "Get-Clipboard"],
                timeout=1.5,
                creationflags=0x08000000 if hasattr(subprocess, "CREATE_NO_WINDOW") else 0,
            )
            return out.decode("utf-8", errors="replace").rstrip("\r\n")
        except Exception:
            pass

    return ""


def set_system_clipboard(text: str) -> bool:
    """OSシステムクリップボードにテキストを書き込み"""
    if not isinstance(text, str):
        text = str(text)

    # 1. Windows ctypes
    if sys.platform == "win32":
        try:
            import ctypes
            CF_UNICODETEXT = 13
            user32 = ctypes.windll.user32
            kernel32 = ctypes.windll.kernel32
            if user32.OpenClipboard(None):
                try:
                    user32.EmptyClipboard()
                    encoded = text.encode("utf-16le") + b"\x00\x00"
                    h_mem = kernel32.GlobalAlloc(0x0042, len(encoded))  # GMEM_MOVEABLE | GMEM_ZEROINIT
                    if h_mem:
                        ptr = kernel32.GlobalLock(h_mem)
                        if ptr:
                            ctypes.memmove(ptr, encoded, len(encoded))
                            kernel32.GlobalUnlock(h_mem)
                            user32.SetClipboardData(CF_UNICODETEXT, h_mem)
                            return True
                finally:
                    user32.CloseClipboard()
        except Exception:
            pass

    # 2. macOS pbcopy
    if sys.platform == "darwin":
        try:
            p = subprocess.Popen(["pbcopy"], stdin=subprocess.PIPE)
            p.communicate(text.encode("utf-8"), timeout=1)
            return True
        except Exception:
            pass

    # 3. Windows PowerShell フォールバック
    if sys.platform == "win32":
        try:
            p = subprocess.Popen(
                ["powershell", "-NoProfile", "-Command", "$input | Set-Clipboard"],
                stdin=subprocess.PIPE,
                creationflags=0x08000000 if hasattr(subprocess, "CREATE_NO_WINDOW") else 0,
            )
            p.communicate(text.encode("utf-8"), timeout=1.5)
            return True
        except Exception:
            pass

    return False


# -------------------------------------------------------------
# 定数 & メディアキャッシュ設定
# -------------------------------------------------------------
APP_NAME = "CrossPost Desktop Studio"
DEFAULT_WINDOW_WIDTH = 1280
DEFAULT_WINDOW_HEIGHT = 860
MIN_WINDOW_WIDTH = 960
MIN_WINDOW_HEIGHT = 640

# 一時メディアキャッシュ（Threads用）
MEDIA_STORAGE = {}  # id -> {"data": bytes, "mime": str, "created_at": float}
HANDLE_DID_CACHE = {}  # handle -> did


def cleanup_media_storage():
    """30分以上経過した一時メディアを削除"""
    now = time.time()
    expired = [k for k, v in MEDIA_STORAGE.items() if now - v["created_at"] > 1800]
    for k in expired:
        MEDIA_STORAGE.pop(k, None)


def sanitize_input(val):
    if not isinstance(val, str):
        return ""
    val = val.strip().strip("'\"`").replace("\u3000", " ").strip()
    return val


def get_extension_from_mime(mime_type: str) -> str:
    if "mp4" in mime_type:
        return "mp4"
    if "quicktime" in mime_type or "mov" in mime_type:
        return "mov"
    if "webm" in mime_type:
        return "webm"
    if "png" in mime_type:
        return "png"
    if "webp" in mime_type:
        return "webp"
    if "gif" in mime_type:
        return "gif"
    if "heic" in mime_type:
        return "heic"
    if "avif" in mime_type:
        return "avif"
    return "jpg"


# -------------------------------------------------------------
# メディアバッファ解決ヘルパー (mediaId または Base64)
# -------------------------------------------------------------
def resolve_media_buffer(item: dict):
    """
    item から (buffer: bytes, mime_type: str, filename: str, is_video: bool) を解決
    """
    if not isinstance(item, dict):
        return None
    media_id = item.get("mediaId")
    name = item.get("name") or "media"
    ext = name.split(".")[-1].lower() if "." in name else ""
    is_explicit_video = item.get("mediaType") == "video" or ext in ("mp4", "mov", "webm", "m4v")

    if media_id and media_id in MEDIA_STORAGE:
        stored = MEDIA_STORAGE[media_id]
        buf = stored["data"]
        mime = stored.get("mime", "application/octet-stream")
        stored_name = stored.get("name") or name
        if is_explicit_video and (not mime.startswith("video/") or mime == "application/octet-stream"):
            mime = "video/quicktime" if ext == "mov" else "video/mp4"
        return buf, mime, stored_name, True if is_explicit_video else mime.startswith("video/")

    data_url = item.get("dataUrl", "")
    if data_url and isinstance(data_url, str):
        match = re.match(r"^data:([^;]+);base64,(.+)$", data_url)
        if match:
            mime = match.group(1)
            # サムネイル画像Base64が動画実体として誤認されるのを防ぐガード
            if is_explicit_video and mime.startswith("image/"):
                print(f"[Desktop/Media] Warning: dataUrl is thumbnail image for video {name}, skipping as video payload")
                return None

            import base64
            buf = base64.b64decode(match.group(2))
            is_video = is_explicit_video or mime.startswith("video/")
            if is_video and not mime.startswith("video/"):
                mime = "video/quicktime" if ext == "mov" else "video/mp4"
            return buf, mime, name, is_video

    return None


# -------------------------------------------------------------
# Bluesky 公式動画アップロードAPI
# -------------------------------------------------------------
def upload_bluesky_video(
    buffer: bytes, mime_type: str, file_name: str, did: str, access_jwt: str, pds_endpoint: str
):
    """
    Bluesky 公式動画アップロードAPI (video.bsky.app) または PDSフォールバック
    """
    clean_name = file_name or "video.mp4"
    if not clean_name.lower().endswith((".mp4", ".mov", ".webm")):
        clean_name = f"{clean_name}.mp4"

    clean_mime = mime_type if (mime_type.startswith("video/") and "quicktime" not in mime_type and "webm" not in mime_type) else "video/mp4"

    # Service Auth Token (com.atproto.server.getServiceAuth) の取得試行 (video.bsky.app 必須要件)
    service_auth_token = access_jwt
    try:
        auth_url = f"{pds_endpoint.rstrip('/')}/xrpc/com.atproto.server.getServiceAuth?aud=did:web:video.bsky.app&lxm=app.bsky.video.uploadVideo"
        auth_req = urllib.request.Request(
            auth_url,
            headers={"Authorization": f"Bearer {access_jwt}"},
            method="GET",
        )
        with urllib.request.urlopen(auth_req, timeout=10) as s_res:
            s_data = json.loads(s_res.read().decode("utf-8"))
            if s_data.get("token"):
                service_auth_token = s_data["token"]
                print("[Desktop/Bluesky] Successfully obtained Service Auth Token for video.bsky.app")
    except Exception as sae:
        print(f"[Desktop/Bluesky] Note on getServiceAuth ({sae}), using accessJwt...")

    # 1. 公式動画エンドポイント video.bsky.app
    try:
        query = urllib.parse.urlencode({"did": did, "name": clean_name})
        url = f"https://video.bsky.app/xrpc/app.bsky.video.uploadVideo?{query}"
        req = urllib.request.Request(
            url,
            data=buffer,
            headers={
                "Authorization": f"Bearer {service_auth_token}",
                "Content-Type": clean_mime,
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=45) as res:
            res_data = json.loads(res.read().decode("utf-8"))
            if res_data.get("jobStatus"):
                job_id = res_data["jobStatus"].get("jobId")
                if job_id:
                    for _ in range(30):
                        time.sleep(1.5)
                        st_url = f"https://video.bsky.app/xrpc/app.bsky.video.getJobStatus?jobId={urllib.parse.quote(job_id)}"
                        st_req = urllib.request.Request(
                            st_url,
                            headers={"Authorization": f"Bearer {service_auth_token}"},
                            method="GET",
                        )
                        with urllib.request.urlopen(st_req, timeout=10) as st_res:
                            st_data = json.loads(st_res.read().decode("utf-8"))
                            job = st_data.get("jobStatus", {})
                            if job.get("state") == "JOB_STATE_COMPLETED" and job.get("blob"):
                                print("[Desktop/Bluesky] Video processed successfully via video.bsky.app")
                                return job["blob"]
                            if job.get("state") == "JOB_STATE_FAILED":
                                raise RuntimeError(f"Bluesky動画変換失敗: {job.get('error')}")
            if res_data.get("blob"):
                return res_data["blob"]
    except Exception as e:
        print(f"[Bluesky Video] Official endpoint note ({e}), trying PDS uploadBlob...")

    # 2. PDS uploadBlob フォールバック
    blob_req = urllib.request.Request(
        f"{pds_endpoint.rstrip('/')}/xrpc/com.atproto.repo.uploadBlob",
        data=buffer,
        headers={
            "Authorization": f"Bearer {access_jwt}",
            "Content-Type": "video/mp4",
        },
        method="POST",
    )
    with urllib.request.urlopen(blob_req, timeout=35) as b_res:
        b_data = json.loads(b_res.read().decode("utf-8"))
        if b_data.get("blob"):
            print("[Desktop/Bluesky] Video uploaded successfully via PDS uploadBlob fallback")
            return b_data["blob"]
    raise RuntimeError("Blueskyへの動画アップロードに失敗しました。ファイル形式(MP4/MOV)および容量(最大50MB)をご確認ください。")


# -------------------------------------------------------------
# 画像/動画アップロード（Threads API用 公開静的ホスト）
# -------------------------------------------------------------
def upload_image_to_public_host(buffer: bytes, mime_type: str, file_name: str) -> str:
    """
    Threads APIがダウンロード可能な公開CDN（Catbox/Litterbox, tmpfiles.org, Uguu）へ一時アップロード
    """
    ext = get_extension_from_mime(mime_type)
    safe_name = re.sub(r"[^a-zA-Z0-9_-]", "_", file_name or "media")
    upload_name = f"{safe_name}.{ext}"
    is_vid = mime_type.startswith("video/") or ext in ("mp4", "mov", "webm", "m4v")
    timeout_sec = 45 if is_vid else 15

    # 1. Litterbox (Catbox 24h一時保持: 無料・画像/動画対応)
    try:
        boundary = f"----WebKitFormBoundary{secrets.token_hex(16)}"
        body = bytearray()

        def add_field(name, val):
            body.extend(f"--{boundary}\r\n".encode("utf-8"))
            body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"))
            body.extend(f"{val}\r\n".encode("utf-8"))

        add_field("reqtype", "fileupload")
        add_field("time", "24h")

        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(
            f'Content-Disposition: form-data; name="fileToUpload"; filename="{upload_name}"\r\n'.encode("utf-8")
        )
        body.extend(f"Content-Type: {mime_type}\r\n\r\n".encode("utf-8"))
        body.extend(buffer)
        body.extend(b"\r\n")
        body.extend(f"--{boundary}--\r\n".encode("utf-8"))

        req = urllib.request.Request(
            "https://litterbox.catbox.moe/resources/internals/api.php",
            data=bytes(body),
            headers={
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "User-Agent": "CrossPostDesktop/1.0",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout_sec) as response:
            res_text = response.read().decode("utf-8", errors="ignore").strip()
            if res_text.startswith("http"):
                print(f"[Desktop/Media] Uploaded to Litterbox: {res_text}")
                return res_text
    except Exception as e:
        print(f"[Desktop/Media] Litterbox upload note: {e}")

    # 2. tmpfiles.org (大容量・動画・画像両対応の高速一時ファイルホスト)
    try:
        boundary = f"----WebKitFormBoundary{secrets.token_hex(16)}"
        body = bytearray()
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(
            f'Content-Disposition: form-data; name="input"; filename="{upload_name}"\r\n'.encode("utf-8")
        )
        body.extend(f"Content-Type: {mime_type}\r\n\r\n".encode("utf-8"))
        body.extend(buffer)
        body.extend(b"\r\n")
        body.extend(f"--{boundary}--\r\n".encode("utf-8"))

        req = urllib.request.Request(
            "https://tmpfiles.org/api/v1/upload",
            data=bytes(body),
            headers={
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "User-Agent": "CrossPostDesktop/1.0",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout_sec) as response:
            resp_json = json.loads(response.read().decode("utf-8", errors="ignore"))
            raw_url = resp_json.get("data", {}).get("url", "")
            if raw_url and "tmpfiles.org/" in raw_url:
                # 直リンク化: https://tmpfiles.org/123/name -> https://tmpfiles.org/dl/123/name
                direct_url = raw_url.replace("tmpfiles.org/", "tmpfiles.org/dl/")
                print(f"[Desktop/Media] Uploaded to tmpfiles: {direct_url}")
                return direct_url
    except Exception as e:
        print(f"[Desktop/Media] tmpfiles.org upload note: {e}")

    # 3. Uguu (100MBまで対応の一時ホスト)
    try:
        boundary = f"----WebKitFormBoundary{secrets.token_hex(16)}"
        body = bytearray()
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(
            f'Content-Disposition: form-data; name="files[]"; filename="{upload_name}"\r\n'.encode("utf-8")
        )
        body.extend(f"Content-Type: {mime_type}\r\n\r\n".encode("utf-8"))
        body.extend(buffer)
        body.extend(b"\r\n")
        body.extend(f"--{boundary}--\r\n".encode("utf-8"))

        req = urllib.request.Request(
            "https://uguu.se/upload",
            data=bytes(body),
            headers={
                "Content-Type": f"multipart/form-data; boundary={boundary}",
                "User-Agent": "CrossPostDesktop/1.0",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=timeout_sec) as response:
            data = json.loads(response.read().decode("utf-8", errors="ignore"))
            url = data.get("files", [{}])[0].get("url")
            if url and url.startswith("http"):
                print(f"[Desktop/Media] Uploaded to Uguu: {url}")
                return url
    except Exception as e:
        print(f"[Desktop/Media] Uguu upload note: {e}")

    return ""


# -------------------------------------------------------------
# Bluesky DID解決 & Facets (リンク/メンション/ハッシュタグ)
# -------------------------------------------------------------
def resolve_bluesky_handle_to_did(handle: str, pds_endpoint: str) -> str:
    clean_handle = handle.lstrip("@").strip().lower()
    if not clean_handle:
        return ""
    if clean_handle in HANDLE_DID_CACHE:
        return HANDLE_DID_CACHE[clean_handle]

    endpoints = [
        pds_endpoint.rstrip("/"),
        "https://public.api.bsky.app",
        "https://bsky.social",
    ]

    for ep in endpoints:
        try:
            url = f"{ep}/xrpc/com.atproto.identity.resolveHandle?handle={urllib.parse.quote(clean_handle)}"
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=4) as res:
                data = json.loads(res.read().decode("utf-8"))
                did = data.get("did")
                if did:
                    HANDLE_DID_CACHE[clean_handle] = did
                    return did
        except Exception:
            continue
    return ""


def generate_bluesky_facets(text: str, pds_endpoint: str):
    if not text:
        return []

    facets = []
    text_bytes = text.encode("utf-8")

    # 1. URL リンク
    url_pattern = re.compile(r"https?://[^\s<>()\"']+")
    for match in url_pattern.finditer(text):
        url = match.group(0)
        end_idx = match.end()
        while url and url[-1] in ".,!?:;)]}'\"":
            url = url[:-1]
            end_idx -= 1

        if url:
            byte_start = len(text[: match.start()].encode("utf-8"))
            byte_end = len(text[:end_idx].encode("utf-8"))
            facets.append(
                {
                    "index": {"byteStart": byte_start, "byteEnd": byte_end},
                    "features": [
                        {
                            "$type": "app.bsky.richtext.facet#link",
                            "uri": url,
                        }
                    ],
                }
            )

    # 2. メンション (@handle.domain)
    mention_pattern = re.compile(
        r"(^|\s)(@([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)"
    )
    for match in mention_pattern.finditer(text):
        prefix = match.group(1) or ""
        full_mention = match.group(2)
        handle = full_mention.lstrip("@")
        match_start = match.start() + len(prefix)
        match_end = match_start + len(full_mention)

        did = resolve_bluesky_handle_to_did(handle, pds_endpoint)
        if did:
            byte_start = len(text[:match_start].encode("utf-8"))
            byte_end = len(text[:match_end].encode("utf-8"))
            facets.append(
                {
                    "index": {"byteStart": byte_start, "byteEnd": byte_end},
                    "features": [
                        {
                            "$type": "app.bsky.richtext.facet#mention",
                            "did": did,
                        }
                    ],
                }
            )

    # 3. ハッシュタグ (#tag)
    tag_pattern = re.compile(r"(^|\s)(#([^\s#.,!?:;()[\]{}'\"’]+))")
    for match in tag_pattern.finditer(text):
        prefix = match.group(1) or ""
        tag_val = match.group(3)
        match_start = match.start() + len(prefix)
        match_end = match.end()

        if tag_val:
            byte_start = len(text[:match_start].encode("utf-8"))
            byte_end = len(text[:match_end].encode("utf-8"))
            facets.append(
                {
                    "index": {"byteStart": byte_start, "byteEnd": byte_end},
                    "features": [
                        {
                            "$type": "app.bsky.richtext.facet#tag",
                            "tag": tag_val,
                        }
                    ],
                }
            )

    facets.sort(key=lambda x: x["index"]["byteStart"])
    return facets


# -------------------------------------------------------------
# フロントエンド静的ファイル (desktop_ui / dist) の自動検出 & 自己修復
# -------------------------------------------------------------
def restore_frontend_bundle(target_dir: Path) -> bool:
    """
    UIファイルが見つからない場合にクラウドから最新のUIアセットを自動ダウンロードして復元
    """
    try:
        import urllib.request
        import zipfile
        import io

        cloud_urls = [
            "https://ais-pre-ktrdeobzrgsk4662t6ihxf-196356171486.asia-east1.run.app/api/desktop-package",
            "https://ais-dev-ktrdeobzrgsk4662t6ihxf-196356171486.asia-east1.run.app/api/desktop-package",
        ]
        print("[CrossPost] Attempting automatic UI bundle restoration from cloud...")
        for url in cloud_urls:
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "CrossPostDesktop/1.0"})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    if resp.status == 200:
                        data = resp.read()
                        target_dir.mkdir(exist_ok=True, parents=True)
                        with zipfile.ZipFile(io.BytesIO(data)) as zf:
                            for member in zf.infolist():
                                if member.filename.startswith("dist/"):
                                    rel = member.filename[len("dist/"):]
                                    if not rel or rel.endswith("/"):
                                        continue
                                    dst = target_dir / rel
                                    dst.parent.mkdir(parents=True, exist_ok=True)
                                    with zf.open(member) as src, open(dst, "wb") as f:
                                        f.write(src.read())
                        if (target_dir / "index.html").is_file():
                            print(f"[OK] UI bundle successfully restored into: {target_dir}")
                            return True
            except Exception as ex:
                print(f"[INFO] Cloud download fallback note: {ex}")
    except Exception as e:
        print(f"[WARNING] Auto-restore error: {e}")
    return False


def find_frontend_dir() -> Path:
    """
    フロントエンド (React desktop_ui / dist) の格納先を複数の候補から自動検出
    """
    candidates = []

    # 1. PyInstaller 実行時の一時ディレクトリ
    if getattr(sys, "_MEIPASS", None):
        meipass = Path(sys._MEIPASS)
        candidates.append(meipass / "desktop_ui")
        candidates.append(meipass / "dist")
        candidates.append(meipass)

    script_dir = Path(__file__).resolve().parent
    cwd = Path.cwd()

    # 2. desktop_ui / dist ディレクトリ候補
    candidates.append(script_dir / "desktop_ui")
    candidates.append(script_dir / "dist")
    candidates.append(cwd / "desktop_ui")
    candidates.append(cwd / "dist")

    # 3. 直下に index.html がある場合
    candidates.append(script_dir)
    candidates.append(cwd)

    for c in candidates:
        if c.exists() and (c / "index.html").is_file():
            return c

    # 4. 見つからない場合は自動修復を試みる
    target_restore = script_dir / "desktop_ui"
    if restore_frontend_bundle(target_restore):
        return target_restore

    # 5. それでも見つからない場合は存在するフォルダを返し、HTMLハンドラ側でフォールバックUIを表示
    return script_dir if script_dir.exists() else Path.cwd()


def get_missing_dist_html(checked_path: Path) -> str:
    """
    dist/index.html が見つからない場合に表示する親切な案内画面
    """
    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>CrossPost Desktop Studio - セットアップのご案内</title>
  <style>
    body {{
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #090d16;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }}
    .card {{
      background: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 16px;
      padding: 36px;
      max-width: 600px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }}
    h1 {{
      margin-top: 0;
      font-size: 22px;
      color: #38bdf8;
      display: flex;
      align-items: center;
      gap: 10px;
    }}
    p {{
      color: #94a3b8;
      line-height: 1.6;
      font-size: 14px;
    }}
    .box {{
      background: #020617;
      border: 1px solid #334155;
      border-radius: 10px;
      padding: 16px;
      margin: 20px 0;
      font-family: Consolas, monospace;
      font-size: 13px;
      color: #f87171;
    }}
    ol {{
      padding-left: 20px;
      color: #cbd5e1;
      font-size: 14px;
      line-height: 1.8;
    }}
    .badge {{
      display: inline-block;
      background: #0369a1;
      color: white;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: bold;
      font-size: 12px;
    }}
    .tip {{
      margin-top: 24px;
      padding: 12px 16px;
      background: rgba(56, 189, 248, 0.1);
      border-left: 4px solid #38bdf8;
      border-radius: 4px;
      font-size: 13px;
      color: #bae6fd;
    }}
  </style>
</head>
<body>
  <div class="card">
    <h1><span>🖥️</span> CrossPost Desktop Studio</h1>
    <p>フロントエンドのUIファイル（<code>dist/index.html</code>）が見つかりません。</p>
    
    <div class="box">
      探索先: {checked_path} / index.html [未検出]
    </div>

    <h3>【解決手順】</h3>
    <ol>
      <li>Webアプリ画面上部の <strong>「🖥️ デスクトップ版」</strong> ボタンをクリックします。</li>
      <li><strong>「完全ZIPパッケージをダウンロード」</strong> をクリックし、最新のZIPを保存してください。</li>
      <li>ダウンロードしたZIPをすべて展開（解凍）し、<code>run_desktop.bat</code> と同じフォルダ内に <code>dist</code> フォルダがある状態で起動してください。</li>
    </ol>

    <div class="tip">
      💡 <strong>開発者の方へ:</strong> プロジェクトルートで <code>npm run build</code> を実行すると <code>dist</code> フォルダが自動生成され、正常に起動します。
    </div>
  </div>
</body>
</html>"""


# -------------------------------------------------------------
# アカウント保管庫 (Vault) & セキュリティ設定 (Windowsローカル永続化)
# -------------------------------------------------------------
DATA_DIR = Path(__file__).parent / "data"
VAULT_FILE = DATA_DIR / "account_vault.json"
SECURITY_FILE = DATA_DIR / "mode_security.json"


def get_vault_data() -> dict:
    try:
        if VAULT_FILE.exists():
            with open(VAULT_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
    except Exception as e:
        print(f"[Desktop/Vault] Read error: {e}")
    return {}


def save_vault_data(vault: dict) -> bool:
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(VAULT_FILE, "w", encoding="utf-8") as f:
            json.dump(vault, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"[Desktop/Vault] Save error: {e}")
        return False


def get_mode_security_data() -> dict:
    default_config = {
        "passwordHash": "",
        "isPasswordProtected": False,
        "hint": "",
        "updatedAt": 0,
    }
    try:
        if SECURITY_FILE.exists():
            with open(SECURITY_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return {**default_config, **data}
    except Exception as e:
        print(f"[Desktop/Security] Read error: {e}")
    return default_config


def save_mode_security_data(config: dict) -> bool:
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with open(SECURITY_FILE, "w", encoding="utf-8") as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"[Desktop/Security] Save error: {e}")
        return False


# -------------------------------------------------------------
# HTTP リクエストハンドラ (API + 静的ファイル配信)
# -------------------------------------------------------------
class CrossPostAppRequestHandler(SimpleHTTPRequestHandler):
    dist_dir = find_frontend_dir()

    def __init__(self, *args, **kwargs):
        # 起動のたびに最新の探索結果を反映
        self.dist_dir = find_frontend_dir()
        super().__init__(*args, directory=str(self.dist_dir), **kwargs)

    def get_client_browser(self):
        ua = self.headers.get("User-Agent", "")
        if "Edg" in ua:
            return "Microsoft Edge"
        elif "Chrome" in ua and "Edg" not in ua:
            return "Google Chrome"
        elif "Firefox" in ua:
            return "Mozilla Firefox"
        elif "Safari" in ua and "Chrome" not in ua:
            return "Apple Safari"
        elif "pywebview" in ua:
            return "CrossPost Desktop (pywebview)"
        return ua[:40] if ua else "Unknown Client"

    def log_message(self, format, *args):
        # APIリクエスト時はコンソール出力
        try:
            msg = format % args
            if "api" in msg:
                browser = self.get_client_browser()
                print(f"[Desktop API] [{browser}] {msg}")
        except Exception:
            pass

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS, HEAD")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        if self.path.endswith(".html") or self.path == "/" or self.path == "":
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def get_json_body(self):
        content_len = int(self.headers.get("Content-Length", 0))
        if content_len == 0:
            return {}
        raw = self.rfile.read(content_len).decode("utf-8", errors="ignore")
        try:
            return json.loads(raw)
        except Exception:
            return {}

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # 1. API: ヘルスチェック
        if path == "/api/health":
            self.send_json({"status": "ok", "mode": "python_desktop", "time": time.time()})
            return

        # API: クリップボード読み取り
        if path == "/api/clipboard/read":
            text = get_system_clipboard()
            self.send_json({"text": text})
            return

        # API: アカウント保管庫 (Vault) 取得
        if path == "/api/credentials/vault":
            vault = get_vault_data()
            self.send_json({"vault": vault, "source": "local_disk"})
            return

        # API: モードセキュリティ設定取得
        if path == "/api/mode/security":
            sec = get_mode_security_data()
            self.send_json({
                "isPasswordProtected": sec.get("isPasswordProtected", False),
                "hint": sec.get("hint", ""),
            })
            return

        # API: デスクトップパッケージZIP配信
        if path == "/api/desktop-package":
            self.handle_desktop_package()
            return

        # 2. API: 一時メディア配信
        if path.startswith("/api/media/"):
            media_id = path.replace("/api/media/", "")
            item = MEDIA_STORAGE.get(media_id)
            if not item:
                self.send_error(404, "Media not found")
                return
            self.send_response(200)
            self.send_header("Content-Type", item["mime"])
            self.send_header("Content-Length", str(len(item["data"])))
            self.send_header("Cache-Control", "public, max-age=3600")
            self.end_headers()
            self.wfile.write(item["data"])
            return

        # 3. 静的ファイル配信 (SPA fallback)
        target_path = self.dist_dir / path.lstrip("/")
        if target_path.is_file():
            return super().do_GET()

        # index.html にフォールバック
        index_file = self.dist_dir / "index.html"
        if index_file.is_file():
            self.path = "/index.html"
            return super().do_GET()

        # index.html も見つからない場合は、無機質な404の代わりに親切なトラブルシューティングUIを返す
        html = get_missing_dist_html(self.dist_dir).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(html)))
        self.end_headers()
        self.wfile.write(html)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/")

        # ---------------------------------------------------------
        # 一時メディアアップロード (動画・画像)
        # ---------------------------------------------------------
        if path == "/api/media/upload":
            self.handle_media_upload()
            return

        # ---------------------------------------------------------
        # クリップボード書き込み
        # ---------------------------------------------------------
        if path == "/api/clipboard/write":
            body = self.get_json_body()
            text = body.get("text", "")
            ok = set_system_clipboard(text)
            self.send_json({"status": "ok" if ok else "error"})
            return

        body = self.get_json_body()

        # ---------------------------------------------------------
        # アカウント保管庫 (Vault) 保存
        # ---------------------------------------------------------
        if path == "/api/credentials/vault":
            self.handle_vault_save(body)
            return

        # ---------------------------------------------------------
        # モードセキュリティ設定
        # ---------------------------------------------------------
        if path == "/api/mode/security":
            self.handle_mode_security_save(body)
            return

        if path == "/api/mode/verify":
            self.handle_mode_verify(body)
            return

        # ---------------------------------------------------------
        # Bluesky 認証
        # ---------------------------------------------------------
        if path == "/api/bluesky/auth":
            self.handle_bluesky_auth(body)
            return

        # ---------------------------------------------------------
        # Bluesky 投稿
        # ---------------------------------------------------------
        if path == "/api/bluesky/post":
            self.handle_bluesky_post(body)
            return

        # ---------------------------------------------------------
        # Threads 検証
        # ---------------------------------------------------------
        if path == "/api/threads/verify":
            self.handle_threads_verify(body)
            return

        # ---------------------------------------------------------
        # Threads トークン有効期限更新
        # ---------------------------------------------------------
        if path == "/api/threads/refresh-token":
            self.handle_threads_refresh(body)
            return

        # ---------------------------------------------------------
        # Threads 投稿
        # ---------------------------------------------------------
        if path == "/api/threads/post":
            self.handle_threads_post(body)
            return

        # ---------------------------------------------------------
        # 統合投稿 (Bluesky & Threads 同時投稿)
        # ---------------------------------------------------------
        if path == "/api/post":
            self.handle_unified_post(body)
            return

        # ---------------------------------------------------------
        # アプリ終了 (Quit API)
        # ---------------------------------------------------------
        if path == "/api/app/quit":
            self.send_json({"success": True, "message": "シャットダウンします"})
            def immediate_quit():
                time.sleep(0.05)
                try:
                    import webview
                    for w in getattr(webview, "windows", []):
                        w.destroy()
                except Exception:
                    pass
                os._exit(0)
            threading.Thread(target=immediate_quit, daemon=True).start()
            return

        self.send_error(404, "Endpoint not found")

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path == "/api/credentials/vault":
            body = self.get_json_body()
            platform = body.get("platform")
            vault = get_vault_data()
            if platform in ["bluesky", "threads"]:
                if platform in vault:
                    del vault[platform]
            else:
                vault = {}
            save_vault_data(vault)
            self.send_json({"success": True, "vault": vault})
            return

        self.send_error(404, "Endpoint not found")

    def handle_vault_save(self, body):
        new_vault = body.get("vault", {})
        preserve_password = body.get("preservePassword", True)
        existing = get_vault_data()

        merged = {**existing}
        if "bluesky" in new_vault:
            b_new = new_vault["bluesky"]
            b_old = merged.get("bluesky", {})
            b_pass = b_new.get("appPassword")
            if preserve_password and (not b_pass or b_pass == "********"):
                b_pass = b_old.get("appPassword", "")
            merged["bluesky"] = {
                **b_old,
                **b_new,
                "appPassword": b_pass,
                "savedAt": b_new.get("savedAt") or int(time.time() * 1000),
            }

        if "threads" in new_vault:
            t_new = new_vault["threads"]
            t_old = merged.get("threads", {})
            t_token = t_new.get("accessToken")
            if preserve_password and (not t_token or (isinstance(t_token, str) and t_token.startswith("TH_") and "*" in t_token)):
                t_token = t_old.get("accessToken", "")
            merged["threads"] = {
                **t_old,
                **t_new,
                "accessToken": t_token,
                "savedAt": t_new.get("savedAt") or int(time.time() * 1000),
            }

        merged["encryptedAt"] = int(time.time() * 1000)
        save_vault_data(merged)
        self.send_json({"success": True, "vault": merged})

    def handle_mode_security_save(self, body):
        pwd = body.get("password")
        hint = body.get("hint", "")
        current_pwd = body.get("currentPassword")

        existing = get_mode_security_data()
        if existing.get("isPasswordProtected") and existing.get("passwordHash"):
            if not current_pwd:
                self.send_json({"success": False, "error": "現在のパスワードを入力してください。"}, 400)
                return
            curr_hash = hashlib.sha256(current_pwd.encode("utf-8")).hexdigest()
            if curr_hash != existing["passwordHash"]:
                self.send_json({"success": False, "error": "現在のパスワードが正しくありません。"}, 403)
                return

        if pwd:
            pwd_hash = hashlib.sha256(pwd.encode("utf-8")).hexdigest()
            new_sec = {
                "passwordHash": pwd_hash,
                "isPasswordProtected": True,
                "hint": hint,
                "updatedAt": int(time.time() * 1000),
            }
        else:
            new_sec = {
                "passwordHash": "",
                "isPasswordProtected": False,
                "hint": "",
                "updatedAt": int(time.time() * 1000),
            }
        save_mode_security_data(new_sec)
        self.send_json({"success": True, "isPasswordProtected": new_sec["isPasswordProtected"]})

    def handle_mode_verify(self, body):
        pwd = body.get("password", "")
        existing = get_mode_security_data()
        if not existing.get("isPasswordProtected") or not existing.get("passwordHash"):
            self.send_json({"valid": True})
            return
        pwd_hash = hashlib.sha256(pwd.encode("utf-8")).hexdigest()
        self.send_json({"valid": pwd_hash == existing["passwordHash"]})

    def handle_unified_post(self, body):
        # 統合同時投稿
        creds = body.get("credentials", {})
        post_bsky = body.get("postToBluesky", True)
        post_th = body.get("postToThreads", True)
        images = body.get("images", [])
        threads_topic = body.get("threadsTopic", "")

        bsky_posts = body.get("blueskyPosts") or [body.get("blueskyText") or body.get("text", "")]
        threads_posts = body.get("threadsPosts") or [body.get("threadsText") or body.get("text", "")]

        response_payload = {
            "success": True,
            "bluesky": None,
            "threads": None,
            "message": "",
        }

        # 1. Bluesky
        if post_bsky:
            try:
                b_body = {
                    "credentials": creds,
                    "posts": bsky_posts,
                    "images": images,
                    "replySettings": body.get("replySettings"),
                    "isDemo": body.get("isDemo", False),
                }
                # 自前のメソッドを実行
                b_result = self._execute_bluesky_post(b_body)
                response_payload["bluesky"] = b_result
            except Exception as e:
                response_payload["bluesky"] = {"success": False, "error": str(e)}
                response_payload["success"] = False

        # 2. Threads
        if post_th:
            try:
                th_body = {
                    "credentials": creds,
                    "posts": threads_posts,
                    "images": images,
                    "threadsTopic": threads_topic,
                    "replySettings": body.get("replySettings"),
                    "isDemo": body.get("isDemo", False),
                }
                th_result = self._execute_threads_post(th_body)
                response_payload["threads"] = th_result
            except Exception as e:
                response_payload["threads"] = {"success": False, "error": str(e)}
                response_payload["success"] = False

        msg_parts = []
        if response_payload.get("bluesky", {}).get("success"):
            msg_parts.append("Bluesky投稿完了")
        if response_payload.get("threads", {}).get("success"):
            msg_parts.append("Threads投稿完了")
        response_payload["message"] = " & ".join(msg_parts) or "投稿処理が完了しました"

        self.send_json(response_payload)

    def handle_desktop_package(self):
        try:
            base_dir = Path(__file__).parent
            buf = io.BytesIO()
            with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
                root_files = [
                    "desktop_app.py",
                    "requirements.txt",
                    "run_desktop.bat",
                    "run_desktop_silent.vbs",
                    "run_desktop.sh",
                    "make_windows_exe.bat",
                    "build_exe.py",
                    "README_DESKTOP.md",
                ]
                for f_name in root_files:
                    p = base_dir / f_name
                    if p.exists():
                        zf.write(p, f_name)

                ui_dir = base_dir / "desktop_ui"
                if not ui_dir.exists():
                    ui_dir = base_dir / "dist"

                if ui_dir.exists():
                    for file_path in ui_dir.rglob("*"):
                        if file_path.is_file() and not file_path.name.endswith(".cjs") and not file_path.name.endswith(".map"):
                            rel_p = file_path.relative_to(ui_dir)
                            zf.write(file_path, f"desktop_ui/{rel_p.as_posix()}")
                            zf.write(file_path, f"dist/{rel_p.as_posix()}")

                start_txt = (
                    "============================================================\n"
                    " CrossPost Desktop Studio (Windows / Pythonデスクトップアプリ)\n"
                    "============================================================\n\n"
                    "【Windowsでの起動手順】\n"
                    "1. 本ZIPファイルを右クリックし、「すべて展開」で解凍します。\n"
                    "2. 「run_desktop.bat」をダブルクリックします。\n"
                    "   ※ 自動的に専用GUIウィンドウが起動します。\n\n"
                    "【単体EXEファイル（CrossPostStudio.exe）を作りたい場合】\n"
                    "・「make_windows_exe.bat」をダブルクリックすると自動生成されます。\n\n"
                    "【コマンドラインから起動する場合】\n"
                    "   python desktop_app.py\n"
                )
                zf.writestr("START_HERE.txt", start_txt)

            val = buf.getvalue()
            self.send_response(200)
            self.send_header("Content-Type", "application/zip")
            self.send_header("Content-Disposition", 'attachment; filename="crosspost-desktop-python.zip"')
            self.send_header("Content-Length", str(len(val)))
            self.end_headers()
            self.wfile.write(val)
        except Exception as e:
            print(f"[Desktop/Package] Error creating zip: {e}")
            self.send_json({"success": False, "error": str(e)}, 500)

    # ---------------------------------------------------------
    # 各エンドポイントの処理実装
    # ---------------------------------------------------------
    def handle_media_upload(self):
        content_type = self.headers.get("Content-Type", "")
        content_len = int(self.headers.get("Content-Length", 0))
        if content_len == 0:
            self.send_json({"success": False, "error": "アップロードデータが空です"}, 400)
            return

        raw_data = self.rfile.read(content_len)
        media_id = f"media_{int(time.time()*1000)}_{secrets.token_hex(6)}"
        mime_type = "application/octet-stream"
        filename = "media"
        file_data = b""

        if "multipart/form-data" in content_type:
            boundary = None
            for part in content_type.split(";"):
                part = part.strip()
                if part.startswith("boundary="):
                    boundary = part[len("boundary="):].strip('"\'')
                    break
            if boundary:
                b_boundary = f"--{boundary}".encode("latin1")
                parts = raw_data.split(b_boundary)
                for p in parts:
                    if b'name="file"' in p or b"filename=" in p:
                        header_body_split = p.split(b"\r\n\r\n", 1)
                        if len(header_body_split) == 2:
                            h_bytes, b_bytes = header_body_split
                            h_str = h_bytes.decode("utf-8", errors="ignore")
                            ct_match = re.search(r"Content-Type:\s*([^\r\n;]+)", h_str, re.IGNORECASE)
                            if ct_match:
                                mime_type = ct_match.group(1).strip()
                            fn_match = re.search(r'filename="([^"]+)"', h_str)
                            if fn_match:
                                filename = fn_match.group(1).strip()
                            if b_bytes.endswith(b"\r\n"):
                                b_bytes = b_bytes[:-2]
                            if b_bytes.endswith(b"--"):
                                b_bytes = b_bytes[:-2]
                            if b_bytes.endswith(b"\r\n"):
                                b_bytes = b_bytes[:-2]
                            file_data = b_bytes
                            break
        if not file_data:
            file_data = raw_data

        ext = filename.split(".")[-1].lower() if "." in filename else ""
        if ext in ("mp4", "m4v"):
            mime_type = "video/mp4"
        elif ext == "mov":
            mime_type = "video/quicktime"
        elif ext == "webm":
            mime_type = "video/webm"
        elif ext in ("jpg", "jpeg"):
            mime_type = "image/jpeg"
        elif ext == "png":
            mime_type = "image/png"

        if ext in ("mp4", "m4v", "mov", "webm") and not mime_type.startswith("video/"):
            mime_type = "video/mp4"

        MEDIA_STORAGE[media_id] = {
            "data": file_data,
            "mime": mime_type,
            "name": filename,
            "created_at": time.time(),
        }
        cleanup_media_storage()
        self.send_json({"success": True, "mediaId": media_id})
    # ---------------------------------------------------------
    def handle_bluesky_auth(self, body):
        identifier = sanitize_input(body.get("identifier", "")).lstrip("@")
        app_password = sanitize_input(body.get("appPassword", ""))
        service_url = body.get("serviceUrl", "https://bsky.social") or "https://bsky.social"

        if not identifier or not app_password:
            self.send_json({"success": False, "error": "ハンドルとアプリパスワードを入力してください。"}, 400)
            return

        if "." not in identifier:
            identifier = f"{identifier}.bsky.social"

        # デモ認証
        if "demo" in identifier.lower() or "demo" in app_password.lower():
            self.send_json({
                "success": True,
                "isDemo": True,
                "session": {
                    "did": "did:plc:democreator1029384756",
                    "handle": identifier,
                    "accessJwt": "demo_access_jwt",
                    "refreshJwt": "demo_refresh_jwt",
                },
            })
            return

        pds = service_url.rstrip("/")
        req_data = json.dumps({"identifier": identifier, "password": app_password}).encode("utf-8")
        req = urllib.request.Request(
            f"{pds}/xrpc/com.atproto.server.createSession",
            data=req_data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as res:
                data = json.loads(res.read().decode("utf-8"))
                self.send_json({
                    "success": True,
                    "session": {
                        "did": data.get("did"),
                        "handle": data.get("handle"),
                        "accessJwt": data.get("accessJwt"),
                        "refreshJwt": data.get("refreshJwt"),
                        "email": data.get("email"),
                    },
                })
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            err_json = json.loads(err_body) if err_body else {}
            msg = err_json.get("message") or f"Bluesky認証エラー: {e.reason}"
            self.send_json({"success": False, "error": msg}, e.code)
        except Exception as e:
            self.send_json({"success": False, "error": f"通信エラー: {str(e)}"}, 500)

    def handle_bluesky_post(self, body):
        res = self._execute_bluesky_post(body)
        self.send_json(res, 200 if res.get("success") else 400)

    def _execute_bluesky_post(self, body):
        creds = body.get("credentials", {})
        posts = body.get("posts", [])
        images = body.get("images", [])
        is_demo = body.get("isDemo", False) or creds.get("isDemoMode", False)

        b_id = sanitize_input(creds.get("blueskyIdentifier", "")).lstrip("@")
        b_pass = sanitize_input(creds.get("blueskyAppPassword", ""))
        service_url = creds.get("blueskyServiceUrl", "https://bsky.social") or "https://bsky.social"

        # デモ判定
        if is_demo or "demo" in b_id.lower() or "demo" in b_pass.lower() or not b_id or not b_pass:
            handle = b_id or "demo-creator.bsky.social"
            img_count = len(images) if isinstance(images, list) else 0
            total_count = max(len(posts) if isinstance(posts, list) else 0, (img_count + 3) // 4) or 1
            demo_urls = [f"https://bsky.app/profile/{handle}/post/demo-{int(time.time()*1000)}-{i+1}" for i in range(total_count)]
            return {
                "success": True,
                "isDemo": True,
                "postsCount": total_count,
                "postIds": [u.split("/")[-1] for u in demo_urls],
                "urls": demo_urls,
                "message": "【DEMOモード】デスクトップ版シミュレーション投稿が完了しました。",
            }

        if "." not in b_id:
            b_id = f"{b_id}.bsky.social"

        pds = service_url.rstrip("/")

        try:
            # 1. セッション作成
            auth_req_data = json.dumps({"identifier": b_id, "password": b_pass}).encode("utf-8")
            auth_req = urllib.request.Request(
                f"{pds}/xrpc/com.atproto.server.createSession",
                data=auth_req_data,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(auth_req, timeout=10) as res:
                auth_data = json.loads(res.read().decode("utf-8"))

            did = auth_data["did"]
            handle = auth_data["handle"]
            access_jwt = auth_data["accessJwt"]

            # 2. メディア（画像・動画）のアップロード処理 (動画・画像の複数添付・混在に完全対応)
            uploaded_media_items = []
            if isinstance(images, list) and images:
                for b_idx, img in enumerate(images):
                    resolved = resolve_media_buffer(img)
                    if not resolved:
                        continue
                    buf, mime_type, name, is_vid = resolved
                    alt_text = (img.get("alt") or "").strip()

                    if is_vid:
                        try:
                            v_blob = upload_bluesky_video(buf, mime_type, name, did, access_jwt, pds)
                            uploaded_media_items.append({
                                "type": "video",
                                "video": {"blob": v_blob, "alt": alt_text}
                            })
                        except Exception as ve:
                            print(f"[Desktop/Bluesky] Video #{b_idx+1} upload error: {ve}")
                            self.send_json({"success": False, "error": f"Bluesky動画アップロード失敗 (#{b_idx+1}): {str(ve)}"}, 400)
                            return
                    else:
                        blob_req = urllib.request.Request(
                            f"{pds}/xrpc/com.atproto.repo.uploadBlob",
                            data=buf,
                            headers={
                                "Authorization": f"Bearer {access_jwt}",
                                "Content-Type": mime_type,
                            },
                            method="POST",
                        )
                        with urllib.request.urlopen(blob_req, timeout=15) as b_res:
                            b_data = json.loads(b_res.read().decode("utf-8"))
                            if b_data.get("blob"):
                                uploaded_media_items.append({
                                    "type": "image",
                                    "image": {"blob": b_data["blob"], "alt": alt_text}
                                })

            # チャンク化: 1投稿につき動画1本 または 画像最大4枚 (Bluesky公式仕様準拠・4枚超過エラー防止)
            media_chunks = []
            curr_images = []
            for it in uploaded_media_items:
                if it["type"] == "video":
                    if curr_images:
                        media_chunks.append({"type": "images", "images": curr_images})
                        curr_images = []
                    media_chunks.append(it)
                else:
                    curr_images.append(it["image"])
                    if len(curr_images) == 4:
                        media_chunks.append({"type": "images", "images": curr_images})
                        curr_images = []
            if curr_images:
                media_chunks.append({"type": "images", "images": curr_images})

            # メディアのみ投稿で、メディアの読み込み/アップロードが1件も成功しなかった場合のガード
            has_valid_text = any(isinstance(p, str) and p.strip() for p in posts)
            if not has_valid_text and not media_chunks:
                self.send_json({
                    "success": False,
                    "error": "投稿テキストが空で、添付メディアのアップロードにも失敗しました。画像/動画の形式をご確認ください。"
                }, 400)
                return

            # 3. レコード作成（スレッド）
            created_keys = []
            created_urls = []
            root_ref = None
            parent_ref = None

            total_post_count = max(len(posts), len(media_chunks), 1)
            for i in range(total_post_count):
                post_text = posts[i] if i < len(posts) else (f"({i+1}/{total_post_count})" if total_post_count > 1 else "")
                facets = generate_bluesky_facets(post_text, pds) if post_text else []

                import datetime
                record = {
                    "$type": "app.bsky.feed.post",
                    "text": post_text,
                    "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                }
                if facets:
                    record["facets"] = facets

                if i < len(media_chunks):
                    chunk = media_chunks[i]
                    if chunk["type"] == "video":
                        record["embed"] = {
                            "$type": "app.bsky.embed.video",
                            "video": chunk["video"]["blob"],
                            "alt": chunk["video"]["alt"],
                        }
                    elif chunk["type"] == "images" and chunk["images"]:
                        record["embed"] = {
                            "$type": "app.bsky.embed.images",
                            "images": [
                                {"image": it["blob"], "alt": it["alt"]} for it in chunk["images"]
                            ],
                        }

                if root_ref and parent_ref:
                    record["reply"] = {"root": root_ref, "parent": parent_ref}

                post_req_data = json.dumps({
                    "repo": did,
                    "collection": "app.bsky.feed.post",
                    "record": record,
                }).encode("utf-8")

                post_req = urllib.request.Request(
                    f"{pds}/xrpc/com.atproto.repo.createRecord",
                    data=post_req_data,
                    headers={
                        "Authorization": f"Bearer {access_jwt}",
                        "Content-Type": "application/json",
                    },
                    method="POST",
                )
                with urllib.request.urlopen(post_req, timeout=10) as p_res:
                    p_data = json.loads(p_res.read().decode("utf-8"))

                uri = p_data["uri"]
                cid = p_data["cid"]
                rkey = uri.split("/")[-1]
                created_keys.append(rkey)
                created_urls.append(f"https://bsky.app/profile/{handle}/post/{rkey}")

                if i == 0:
                    root_ref = {"uri": uri, "cid": cid}
                parent_ref = {"uri": uri, "cid": cid}

                if i < total_post_count - 1:
                    time.sleep(0.5)

            return {
                "success": True,
                "postsCount": len(created_urls),
                "postIds": created_keys,
                "urls": created_urls,
            }
        except Exception as e:
            return {"success": False, "error": f"Bluesky投稿エラー: {str(e)}"}

    def handle_threads_verify(self, body):
        token = sanitize_input(body.get("accessToken", ""))
        user_id = sanitize_input(body.get("userId", "")) or "me"

        if not token:
            self.send_json({"success": False, "error": "Threadsアクセストークンを入力してください。"}, 400)
            return

        if "demo" in token.lower():
            self.send_json({
                "success": True,
                "isDemo": True,
                "id": "threads_user_demo_10293",
                "username": "Demo_Threads_Official",
            })
            return

        try:
            url = f"https://graph.threads.net/v1.0/{user_id}?fields=id,username&access_token={urllib.parse.quote(token)}"
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=10) as res:
                data = json.loads(res.read().decode("utf-8"))
                self.send_json({
                    "success": True,
                    "id": data.get("id"),
                    "username": data.get("username"),
                })
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            err_json = json.loads(err_body) if err_body else {}
            msg = err_json.get("error", {}).get("message") or f"Threads検証エラー: {e.reason}"
            self.send_json({"success": False, "error": msg}, e.code)
        except Exception as e:
            self.send_json({"success": False, "error": f"Threads通信エラー: {str(e)}"}, 500)

    def handle_threads_refresh(self, body):
        token = sanitize_input(body.get("accessToken", "")).replace(" ", "").replace("\u3000", "")
        if not token:
            self.send_json({"success": False, "error": "アクセストークンが指定されていません。"}, 400)
            return

        if "demo" in token.lower() or token == "TH_LONG_LIVED_TOKEN_DEMO_91238":
            expires_in = 5184000
            self.send_json({
                "success": True,
                "isDemo": True,
                "accessToken": "TH_LONG_LIVED_TOKEN_DEMO_91238",
                "expiresIn": expires_in,
                "expiresAt": int(time.time() * 1000) + expires_in * 1000,
                "refreshedAt": int(time.time() * 1000),
                "message": "【DEMOモード】Long-Lived Tokenの有効期限を60日間延長しました。",
            })
            return

        try:
            refresh_url = f"https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token={urllib.parse.quote(token)}"
            req = urllib.request.Request(refresh_url, method="GET")
            with urllib.request.urlopen(req, timeout=10) as res:
                data = json.loads(res.read().decode("utf-8"))
                expires_in = data.get("expires_in", 5184000)
                self.send_json({
                    "success": True,
                    "accessToken": data["access_token"],
                    "expiresIn": expires_in,
                    "expiresAt": int(time.time() * 1000) + expires_in * 1000,
                    "refreshedAt": int(time.time() * 1000),
                    "message": "Threads Long-Lived Tokenの有効期限を更新（60日間延長）しました！",
                })
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="ignore")
            err_json = json.loads(err_body) if err_body else {}
            msg = err_json.get("error", {}).get("message") or f"トークン更新エラー: {e.reason}"
            if "24 hours" in msg or "less than 24 hours" in msg:
                now_ms = int(time.time() * 1000)
                self.send_json({
                    "success": True,
                    "accessToken": token,
                    "expiresIn": 5184000,
                    "expiresAt": now_ms + 5184000 * 1000,
                    "refreshedAt": now_ms,
                    "message": "ℹ️ このアクセストークンは発行・更新から24時間未満のため延長不要です（現在も有効期限約60日間が保持されています）。24時間経過後に再度延長が可能になります。",
                })
                return
            self.send_json({"success": False, "error": msg}, e.code)
        except Exception as e:
            self.send_json({"success": False, "error": f"Threads通信エラー: {str(e)}"}, 500)

    def handle_threads_post(self, body):
        res = self._execute_threads_post(body)
        self.send_json(res, 200 if res.get("success") else 400)

    def _execute_threads_post(self, body):
        creds = body.get("credentials", {})
        posts = body.get("posts", [])
        images = body.get("images", [])
        # Meta Threads API 準拠トピックタグ整形
        raw_topic = sanitize_input(body.get("topic", "")).lstrip("#").replace(".", "").replace("&", "").strip()
        topic = raw_topic[:50]
        while len(topic.encode("utf-8")) > 50 and len(topic) > 0:
            topic = topic[:-1]
        topic = topic.strip()
        is_demo = body.get("isDemo", False) or creds.get("isDemoMode", False)

        token = sanitize_input(creds.get("threadsAccessToken", ""))
        user_id = sanitize_input(creds.get("threadsUserId", "")) or "me"
        username = creds.get("threadsUsername") or "@Demo_Threads_Official"

        # デモ判定
        if is_demo or "demo" in token.lower() or not token:
            urls = [f"https://www.threads.net/{username}/post/demo-{int(time.time()*1000)}-{i+1}" for i in range(len(posts) or 1)]
            return {
                "success": True,
                "isDemo": True,
                "postsCount": len(urls),
                "imagesCount": len(images) if isinstance(images, list) else 0,
                "topic": topic or None,
                "postIds": [u.split("/")[-1] for u in urls],
                "urls": urls,
                "message": "【DEMOモード】デスクトップ版Threads投稿シミュレーションが完了しました。",
            }

        try:
            # 画像・動画を公開ホストへアップロード
            media_items = []
            if isinstance(images, list):
                for idx, img in enumerate(images[:20]):
                    resolved = resolve_media_buffer(img)
                    if not resolved:
                        continue
                    buf, mime_type, filename, is_video = resolved
                    pub_url = upload_image_to_public_host(buf, mime_type, filename or f"media_{idx+1}")
                    if pub_url:
                        media_items.append({
                            "url": pub_url,
                            "isVideo": is_video,
                        })

            # 20枚単位チャンク
            media_chunks = [media_items[i : i + 20] for i in range(0, len(media_items), 20)]

            # テキストが空かつメディアアップロードも失敗した場合のガード
            has_valid_text = any(isinstance(p, str) and p.strip() for p in posts)
            if not has_valid_text and not media_items:
                self.send_json({
                    "success": False,
                    "error": "投稿テキストが空で、添付メディア（画像・動画）のアップロードにも失敗しました。ファイル形式またはネットワーク接続をご確認ください。"
                }, 400)
                return

            total_count = max(len(posts), len(media_chunks)) or 1
            post_texts = []
            for p in range(total_count):
                if p < len(posts):
                    post_texts.append(posts[p])
                elif not posts and p == 0:
                    post_texts.append("")
                else:
                    post_texts.append(f"📷 添付メディア ({p*20+1}〜{min((p+1)*20, len(media_items))})")

            created_ids = []
            created_urls = []
            prev_published_id = None

            def make_container_req(payload):
                p_req = urllib.request.Request(
                    f"https://graph.threads.net/v1.0/{user_id}/threads",
                    data=urllib.parse.urlencode(payload).encode("utf-8"),
                    method="POST",
                )
                try:
                    with urllib.request.urlopen(p_req, timeout=20) as p_res:
                        return json.loads(p_res.read().decode("utf-8"))["id"]
                except urllib.error.HTTPError as he:
                    err_txt = he.read().decode("utf-8", errors="ignore")
                    if "topic_tag" in err_txt and "topic_tag" in payload:
                        # topic_tag 拒否時は topic_tag を除外して自動フォールバック再試行
                        del payload["topic_tag"]
                        p_req2 = urllib.request.Request(
                            f"https://graph.threads.net/v1.0/{user_id}/threads",
                            data=urllib.parse.urlencode(payload).encode("utf-8"),
                            method="POST",
                        )
                        with urllib.request.urlopen(p_req2, timeout=20) as p_res2:
                            return json.loads(p_res2.read().decode("utf-8"))["id"]
                    raise

            for i, p_text in enumerate(post_texts):
                curr_medias = media_chunks[i] if i < len(media_chunks) else []
                container_id = None

                if len(curr_medias) > 1:
                    # カルーセル
                    child_ids = []
                    for m_obj in curr_medias:
                        m_url = m_obj["url"]
                        m_type = "VIDEO" if m_obj.get("isVideo") else "IMAGE"
                        m_param_key = "video_url" if m_type == "VIDEO" else "image_url"

                        params = urllib.parse.urlencode({
                            "access_token": token,
                            "media_type": m_type,
                            m_param_key: m_url,
                            "is_carousel_item": "true",
                        }).encode("utf-8")
                        c_req = urllib.request.Request(f"https://graph.threads.net/v1.0/{user_id}/threads", data=params, method="POST")
                        with urllib.request.urlopen(c_req, timeout=20) as c_res:
                            child_ids.append(json.loads(c_res.read().decode("utf-8"))["id"])

                    # 完了待機
                    for cid in child_ids:
                        self.wait_for_container_finished(cid, token, max_wait=60)

                    # 親カルーセル
                    carousel_data = {
                        "access_token": token,
                        "media_type": "CAROUSEL",
                        "children": ",".join(child_ids),
                    }
                    if p_text and p_text.strip():
                        carousel_data["text"] = p_text.strip()
                    if topic:
                        carousel_data["topic_tag"] = topic
                    if prev_published_id:
                        carousel_data["reply_to_id"] = prev_published_id

                    container_id = make_container_req(carousel_data)

                elif len(curr_medias) == 1:
                    # 単一画像または動画
                    m_obj = curr_medias[0]
                    is_vid = m_obj.get("isVideo")
                    med_data = {
                        "access_token": token,
                        "media_type": "VIDEO" if is_vid else "IMAGE",
                        ("video_url" if is_vid else "image_url"): m_obj["url"],
                    }
                    if p_text and p_text.strip():
                        med_data["text"] = p_text.strip()
                    if topic:
                        med_data["topic_tag"] = topic
                    if prev_published_id:
                        med_data["reply_to_id"] = prev_published_id

                    container_id = make_container_req(med_data)

                else:
                    # テキストのみ
                    txt_data = {
                        "access_token": token,
                        "media_type": "TEXT",
                        "text": p_text,
                    }
                    if topic:
                        txt_data["topic_tag"] = topic
                    if prev_published_id:
                        txt_data["reply_to_id"] = prev_published_id

                    container_id = make_container_req(txt_data)

                # 処理完了待機 (動画の場合は最長75秒)
                is_any_video = any(m.get("isVideo") for m in curr_medias)
                self.wait_for_container_finished(container_id, token, max_wait=75 if is_any_video else 30)

                # 公開 (Publish) - 伝播遅延対応のリトライ
                published_id = None
                last_pub_err = None
                pub_params = urllib.parse.urlencode({
                    "access_token": token,
                    "creation_id": container_id,
                }).encode("utf-8")

                for attempt in range(5):
                    try:
                        pub_req = urllib.request.Request(
                            f"https://graph.threads.net/v1.0/{user_id}/threads_publish",
                            data=pub_params,
                            method="POST",
                        )
                        with urllib.request.urlopen(pub_req, timeout=15) as pub_res:
                            pub_data = json.loads(pub_res.read().decode("utf-8"))
                            published_id = pub_data.get("id")
                            if published_id:
                                break
                    except urllib.error.HTTPError as he:
                        err_body = he.read().decode("utf-8", errors="ignore")
                        last_pub_err = err_body
                        print(f"[Desktop/Threads] Publish attempt {attempt+1} note: {err_body}")
                        if attempt < 4:
                            time.sleep(3.5 if is_any_video else 2.0)
                    except Exception as pe:
                        last_pub_err = str(pe)
                        if attempt < 4:
                            time.sleep(2.0)

                if not published_id:
                    raise RuntimeError(f"Threads公開に失敗しました: {last_pub_err or '不明なエラー'}")

                created_ids.append(published_id)
                prev_published_id = published_id
                clean_u = (username or "").lstrip("@")
                created_urls.append(
                    f"https://www.threads.net/@{clean_u}/post/{published_id}" if clean_u else f"https://www.threads.net/post/{published_id}"
                )

                if i < len(post_texts) - 1:
                    time.sleep(1.0)

            return {
                "success": True,
                "postsCount": len(created_urls),
                "postIds": created_ids,
                "urls": created_urls,
            }
        except Exception as e:
            return {"success": False, "error": f"Threads投稿エラー: {str(e)}"}

    def wait_for_container_finished(self, container_id: str, access_token: str, max_wait=60):
        start = time.time()
        last_status = "UNKNOWN"
        while time.time() - start < max_wait:
            try:
                url = f"https://graph.threads.net/v1.0/{container_id}?fields=status,status_code,error_message&access_token={urllib.parse.quote(access_token)}"
                req = urllib.request.Request(url, method="GET")
                with urllib.request.urlopen(req, timeout=10) as res:
                    data = json.loads(res.read().decode("utf-8"))
                    status = data.get("status") or data.get("status_code")
                    last_status = status or "UNKNOWN"
                    if status in ("FINISHED", "PUBLISHED"):
                        time.sleep(1.2)  # Metaサーバー反映安定化待ち
                        return
                    if status == "ERROR":
                        err_msg = data.get("error_message") or "Meta側でのメディア（動画/画像）処理に失敗しました"
                        raise RuntimeError(f"Threadsメディア処理エラー: {err_msg}")
                    if status == "EXPIRED":
                        raise RuntimeError("Threadsコンテナの有効期限が切れました")
            except RuntimeError:
                raise
            except Exception as e:
                print(f"[Desktop/Threads] Polling note for {container_id}: {e}")
            time.sleep(1.5)
        if last_status in ("IN_PROGRESS", "UNKNOWN"):
            raise RuntimeError(f"Threadsの動画エンコード処理がタイムアウトしました（Meta側ステータス: {last_status}）。Meta側の処理に時間がかかっています。少し時間をおいてから再試行してください。")


# -------------------------------------------------------------
# 空きポート探索 & サーバー起動
# -------------------------------------------------------------
def find_available_port(start_port=3000, max_attempts=50):
    for port in range(start_port, start_port + max_attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return start_port


def run_local_server(port):
    server_address = ("127.0.0.1", port)
    httpd = HTTPServer(server_address, CrossPostAppRequestHandler)
    print(f"[{APP_NAME}] Local server running at http://127.0.0.1:{port}")
    httpd.serve_forever()


# -------------------------------------------------------------
# デスクトップアプリケーション メインエントリーポイント
# -------------------------------------------------------------
class DesktopAppApi:
    def __init__(self):
        self._window = None
        self._is_force_closing = False

    def set_window(self, window):
        self._window = window

    def close_app(self):
        """Webフロントエンド側のダーク終了確認モーダルで「終了」が押された際に呼ぶ"""
        self._is_force_closing = True
        if self._window:
            try:
                self._window.destroy()
            except Exception:
                pass
        time.sleep(0.1)
        os._exit(0)

    def get_app_info(self):
        return {"name": APP_NAME, "version": "1.0.0", "platform": sys.platform}

    def read_clipboard(self):
        """クリップボードからテキストを取得"""
        return get_system_clipboard()

    def write_clipboard(self, text: str):
        """クリップボードにテキストを書き込み"""
        return set_system_clipboard(text)


# -------------------------------------------------------------
# 単体デスクトップアプリ・ウィンドウ起動エンジン
# -------------------------------------------------------------
def launch_standalone_app_window(url: str, title: str, width: int = 1280, height: int = 860) -> bool:
    """
    通常のWebブラウザ（タブやアドレスバーのあるブラウザ）を起動させず、
    独立した単体デスクトップアプリケーション（専用ウィンドウ）として最大化起動する
    """
    is_frozen = getattr(sys, "frozen", False)
    app_api = DesktopAppApi()

    # 1. pywebview による純粋ネイティブウィンドウ起動
    try:
        import webview

        try:
            webview.settings["ALLOW_DOWNLOADS"] = True
            webview.settings["ALLOW_FILE_URLS"] = True
            webview.settings["OPEN_EXTERNAL_LINKS_IN_BROWSER"] = True
        except Exception:
            pass

        print("[CrossPost] Starting native app window with pywebview in maximized mode...")
        window = webview.create_window(
            title=title,
            url=url,
            width=width,
            height=height,
            min_size=(MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT),
            text_select=True,
            easy_drag=False,
            confirm_close=False,
            maximized=True,
            js_api=app_api,
        )
        app_api.set_window(window)

        def on_window_loaded():
            try:
                window.maximize()
            except Exception:
                pass

        def on_window_closed():
            """ウィンドウが閉じられた際に安全・即座にプロセスを終了"""
            try:
                time.sleep(0.05)
            finally:
                os._exit(0)

        window.events.loaded += on_window_loaded
        window.events.closed += on_window_closed

        try:
            webview.start(debug=False)
        finally:
            os._exit(0)
        return True
    except (ImportError, OSError, Exception) as e:
        print(f"[INFO] pywebview is not active ({e}). Trying standalone app mode...")

    # pywebviewが使えず、かつスクリプト実行時（非frozen）の場合のみpipインストールを試行
    if not is_frozen:
        try:
            print("[SETUP] Setting up pywebview native window engine...")
            res = subprocess.run(
                [sys.executable, "-m", "pip", "install", "pywebview", "--quiet"],
                check=False,
                timeout=45,
            )
            if res.returncode == 0:
                import webview

                try:
                    webview.settings["ALLOW_DOWNLOADS"] = True
                    webview.settings["ALLOW_FILE_URLS"] = True
                    webview.settings["OPEN_EXTERNAL_LINKS_IN_BROWSER"] = True
                except Exception:
                    pass

                print("[OK] pywebview engine ready. Launching window in maximized mode...")
                window = webview.create_window(
                    title=title,
                    url=url,
                    width=width,
                    height=height,
                    min_size=(MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT),
                    text_select=True,
                    easy_drag=False,
                    confirm_close=False,
                    maximized=True,
                    js_api=app_api,
                )
                app_api.set_window(window)

                def on_window_loaded_retry():
                    try:
                        window.maximize()
                    except Exception:
                        pass

                def on_window_closed_retry():
                    try:
                        time.sleep(0.05)
                    finally:
                        os._exit(0)

                window.events.loaded += on_window_loaded_retry
                window.events.closed += on_window_closed_retry

                try:
                    webview.start(debug=False)
                finally:
                    os._exit(0)
                return True
        except Exception as e:
            print(f"[INFO] Auto-install skipped: {e}")

    # 2. Windows / OS標準のスタンドアロン・アプリモード (--app)
    # ブラウザのURLバー・タブ・メニューを一切表示させず、単体の独立したアプリウィンドウとして最大化起動
    subproc = None
    app_launched = False

    if sys.platform == "win32":
        # Windows標準の Edge または Chrome の --app モード
        win_candidates = [
            os.path.expandvars(r"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"),
            os.path.expandvars(r"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"),
            os.path.expandvars(r"%LocalAppData%\Microsoft\Edge\Application\msedge.exe"),
            os.path.expandvars(r"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
            os.path.expandvars(r"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
            os.path.expandvars(r"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
        ]
        for exe in win_candidates:
            if os.path.isfile(exe):
                print(f"[CrossPost] Launching standalone app window: {os.path.basename(exe)}")
                cmd = [
                    exe,
                    f"--app={url}",
                    "--start-maximized",
                    f"--app-id=crosspost-studio-{title}",
                ]
                subproc = subprocess.Popen(cmd)
                app_launched = True
                break
    elif sys.platform == "darwin":
        # macOS
        mac_candidates = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        ]
        for exe in mac_candidates:
            if os.path.exists(exe):
                print(f"[CrossPost] Launching standalone app window: {exe}")
                cmd = [exe, f"--app={url}", "--start-maximized"]
                subproc = subprocess.Popen(cmd)
                app_launched = True
                break
    else:
        # Linux
        linux_candidates = ["google-chrome", "chromium-browser", "chromium", "microsoft-edge"]
        for exe in linux_candidates:
            if shutil.which(exe):
                print(f"[CrossPost] Launching standalone app window: {exe}")
                cmd = [exe, f"--app={url}", "--start-maximized"]
                subproc = subprocess.Popen(cmd)
                app_launched = True
                break

    if app_launched and subproc:
        print("[OK] Standalone app window opened in maximized mode.")
        print("     Close the window to exit the application.")
        try:
            subproc.wait()
        except KeyboardInterrupt:
            subproc.terminate()
        finally:
            os._exit(0)
        return True

    # 3. 万一スタンドアロンエンジンが起動できない場合のフォールバック待機案内
    print("\n[WARNING] Standalone window launcher completed.")
    print(f"   Local server is active at: {url}")
    print("   Press Ctrl+C to stop.")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        os._exit(0)
    return False


# -------------------------------------------------------------
# デスクトップアプリケーション メインエントリーポイント
# -------------------------------------------------------------
def wait_for_server_ready(port: int, max_wait_sec: float = 6.0) -> bool:
    """
    ローカルHTTPサーバーが正常に応答するまで待機
    """
    import urllib.request
    health_url = f"http://127.0.0.1:{port}/api/health"
    start_t = time.time()
    while time.time() - start_t < max_wait_sec:
        try:
            req = urllib.request.Request(health_url)
            with urllib.request.urlopen(req, timeout=1.0) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(0.15)
    return False


def main():
    print("=" * 60)
    print(f"[CrossPost] {APP_NAME}")
    print("   Bluesky & Threads Cross-Poster Desktop Studio")
    print("=" * 60)

    # desktop_ui / dist ディレクトリの検出・自動復元
    frontend_dir = find_frontend_dir()
    index_file = frontend_dir / "index.html"
    if not index_file.is_file():
        print("[WARNING] Build output (index.html) not found locally.")
        print(f"   Searched at: {frontend_dir}")
    else:
        print(f"[OK] Frontend UI bundle detected: {frontend_dir}")

    # 空きポートの取得
    port = find_available_port(3000)
    app_url = f"http://127.0.0.1:{port}"

    # バックグラウンドでローカルサーバーを起動
    server_thread = threading.Thread(target=run_local_server, args=(port,), daemon=True)
    server_thread.start()

    # サーバーの起動完了をヘルスチェックで確認
    print(f"[CrossPost] Initializing local desktop server on port {port}...")
    ready = wait_for_server_ready(port, max_wait_sec=5.0)
    if ready:
        print(f"[OK] Local server ready at {app_url}")
    else:
        print(f"[WARNING] Local server slow to respond, proceeding to launch window...")

    # 単体デスクトップアプリ（Webブラウザなし）として起動
    launch_standalone_app_window(
        url=app_url,
        title=f"{APP_NAME} - Bluesky & Threads",
        width=DEFAULT_WINDOW_WIDTH,
        height=DEFAULT_WINDOW_HEIGHT,
    )

    print("\n[CrossPost] Desktop application closed.")


if __name__ == "__main__":
    main()
