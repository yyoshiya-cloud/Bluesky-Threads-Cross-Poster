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
# 画像アップロード（Threads API用 公開静的ホスト）
# -------------------------------------------------------------
def upload_image_to_public_host(buffer: bytes, mime_type: str, file_name: str) -> str:
    """
    Threads APIがダウンロード可能な公開CDN（Litterbox / Uguu）へ一時アップロード
    """
    ext = get_extension_from_mime(mime_type)
    safe_name = re.sub(r"[^a-zA-Z0-9_-]", "_", file_name or "image")
    upload_name = f"{safe_name}.{ext}"

    # 1. Litterbox (24h保持)
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
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            res_text = response.read().decode("utf-8", errors="ignore").strip()
            if res_text.startswith("http"):
                print(f"[Desktop/Image] Uploaded to Litterbox: {res_text}")
                return res_text
    except Exception as e:
        print(f"[Desktop/Image] Litterbox upload failed: {e}")

    # 2. Uguu
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
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read().decode("utf-8", errors="ignore"))
            url = data.get("files", [{}])[0].get("url")
            if url and url.startswith("http"):
                print(f"[Desktop/Image] Uploaded to Uguu: {url}")
                return url
    except Exception as e:
        print(f"[Desktop/Image] Uguu upload failed: {e}")

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
# HTTP リクエストハンドラ (API + 静的ファイル配信)
# -------------------------------------------------------------
class CrossPostAppRequestHandler(SimpleHTTPRequestHandler):
    dist_dir = find_frontend_dir()

    def __init__(self, *args, **kwargs):
        # 起動のたびに最新の探索結果を反映
        self.dist_dir = find_frontend_dir()
        super().__init__(*args, directory=str(self.dist_dir), **kwargs)

    def log_message(self, format, *args):
        # APIリクエスト時はコンソール出力
        try:
            msg = format % args
            if "api" in msg:
                print(f"[Desktop API] {msg}")
        except Exception:
            pass

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD")
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
        body = self.get_json_body()

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
        # アプリ終了 (Quit API)
        # ---------------------------------------------------------
        if path == "/api/app/quit":
            self.send_json({"success": True, "message": "シャットダウンします"})
            def delayed_quit():
                time.sleep(0.3)
                try:
                    import webview
                    for w in getattr(webview, "windows", []):
                        w.destroy()
                except Exception:
                    pass
                os._exit(0)
            threading.Thread(target=delayed_quit, daemon=True).start()
            return

        self.send_error(404, "Endpoint not found")

    # ---------------------------------------------------------
    # 各エンドポイントの処理実装
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
            self.send_json({
                "success": True,
                "isDemo": True,
                "postsCount": total_count,
                "postIds": [u.split("/")[-1] for u in demo_urls],
                "urls": demo_urls,
                "message": "【デモモード】デスクトップ版シミュレーション投稿が完了しました。",
            })
            return

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

            # 2. 画像アップロード (uploadBlob)
            uploaded_blobs = []
            if isinstance(images, list):
                for b_idx, img in enumerate(images):
                    data_url = img.get("dataUrl", "")
                    match = re.match(r"^data:([^;]+);base64,(.+)$", data_url)
                    if match:
                        mime_type = match.group(1)
                        import base64
                        img_bytes = base64.b64decode(match.group(2))
                        alt_text = (img.get("alt") or "").strip()

                        blob_req = urllib.request.Request(
                            f"{pds}/xrpc/com.atproto.repo.uploadBlob",
                            data=img_bytes,
                            headers={
                                "Authorization": f"Bearer {access_jwt}",
                                "Content-Type": mime_type,
                            },
                            method="POST",
                        )
                        with urllib.request.urlopen(blob_req, timeout=15) as b_res:
                            b_data = json.loads(b_res.read().decode("utf-8"))
                            if b_data.get("blob"):
                                uploaded_blobs.append({"blob": b_data["blob"], "alt": alt_text})

            # 4枚ずつチャンク化
            blob_chunks = [uploaded_blobs[i : i + 4] for i in range(0, len(uploaded_blobs), 4)]

            # 3. レコード作成（スレッド）
            created_keys = []
            created_urls = []
            root_ref = None
            parent_ref = None

            total_post_count = max(len(posts), len(blob_chunks))
            for i in range(total_post_count):
                post_text = posts[i] if i < len(posts) else (f"({i+1}/{total_post_count})" if total_post_count > 1 else "")
                facets = generate_bluesky_facets(post_text, pds)

                import datetime
                record = {
                    "$type": "app.bsky.feed.post",
                    "text": post_text,
                    "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                }
                if facets:
                    record["facets"] = facets

                if i < len(blob_chunks) and blob_chunks[i]:
                    record["embed"] = {
                        "$type": "app.bsky.embed.images",
                        "images": [
                            {"image": it["blob"], "alt": it["alt"]} for it in blob_chunks[i]
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

            self.send_json({
                "success": True,
                "postsCount": len(created_urls),
                "postIds": created_keys,
                "urls": created_urls,
            })
        except Exception as e:
            self.send_json({"success": False, "error": f"Bluesky投稿エラー: {str(e)}"}, 500)

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
                "message": "【デモモード】Long-Lived Tokenの有効期限を60日間延長しました。",
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
        creds = body.get("credentials", {})
        posts = body.get("posts", [])
        images = body.get("images", [])
        topic = sanitize_input(body.get("topic", "")).lstrip("#")
        is_demo = body.get("isDemo", False) or creds.get("isDemoMode", False)

        token = sanitize_input(creds.get("threadsAccessToken", ""))
        user_id = sanitize_input(creds.get("threadsUserId", "")) or "me"
        username = creds.get("threadsUsername") or "@Demo_Threads_Official"

        # デモ判定
        if is_demo or "demo" in token.lower() or not token:
            urls = [f"https://www.threads.net/{username}/post/demo-{int(time.time()*1000)}-{i+1}" for i in range(len(posts) or 1)]
            self.send_json({
                "success": True,
                "isDemo": True,
                "postsCount": len(urls),
                "imagesCount": len(images) if isinstance(images, list) else 0,
                "topic": topic or None,
                "postIds": [u.split("/")[-1] for u in urls],
                "urls": urls,
                "message": "【デモモード】デスクトップ版Threads投稿シミュレーションが完了しました。",
            })
            return

        try:
            # 画像を公開ホストへアップロード
            media_urls = []
            if isinstance(images, list):
                for idx, img in enumerate(images[:20]):
                    data_url = img.get("dataUrl", "")
                    if data_url.startswith("http://") or data_url.startswith("https://"):
                        media_urls.append(data_url)
                        continue
                    match = re.match(r"^data:([^;]+);base64,(.+)$", data_url)
                    if match:
                        import base64
                        mime_type = match.group(1)
                        buf = base64.b64decode(match.group(2))
                        pub_url = upload_image_to_public_host(buf, mime_type, img.get("name") or f"image_{idx+1}")
                        if pub_url:
                            media_urls.append(pub_url)

            # 20枚単位チャンク
            media_chunks = [media_urls[i : i + 20] for i in range(0, len(media_urls), 20)]
            total_count = max(len(posts), len(media_chunks))
            post_texts = []
            for p in range(total_count):
                if p < len(posts):
                    post_texts.append(posts[p])
                else:
                    post_texts.append(f"📷 添付画像 ({p*20+1}〜{min((p+1)*20, len(media_urls))})")

            created_ids = []
            created_urls = []
            prev_published_id = None

            for i, p_text in enumerate(post_texts):
                curr_medias = media_chunks[i] if i < len(media_chunks) else []
                container_id = None

                if len(curr_medias) > 1:
                    # カルーセル
                    child_ids = []
                    for m_url in curr_medias:
                        params = urllib.parse.urlencode({
                            "access_token": token,
                            "media_type": "IMAGE",
                            "image_url": m_url,
                            "is_carousel_item": "true",
                        }).encode("utf-8")
                        c_req = urllib.request.Request(f"https://graph.threads.net/v1.0/{user_id}/threads", data=params, method="POST")
                        with urllib.request.urlopen(c_req, timeout=15) as c_res:
                            child_ids.append(json.loads(c_res.read().decode("utf-8"))["id"])

                    # 完了待機
                    for cid in child_ids:
                        self.wait_for_container_finished(cid, token)

                    # 親カルーセル
                    carousel_data = {
                        "access_token": token,
                        "media_type": "CAROUSEL",
                        "children": ",".join(child_ids),
                        "text": p_text,
                    }
                    if topic:
                        carousel_data["topic_tag"] = topic
                    if prev_published_id:
                        carousel_data["reply_to_id"] = prev_published_id

                    p_req = urllib.request.Request(
                        f"https://graph.threads.net/v1.0/{user_id}/threads",
                        data=urllib.parse.urlencode(carousel_data).encode("utf-8"),
                        method="POST",
                    )
                    with urllib.request.urlopen(p_req, timeout=15) as p_res:
                        container_id = json.loads(p_res.read().decode("utf-8"))["id"]

                elif len(curr_medias) == 1:
                    # 単一画像
                    img_data = {
                        "access_token": token,
                        "media_type": "IMAGE",
                        "image_url": curr_medias[0],
                        "text": p_text,
                    }
                    if topic:
                        img_data["topic_tag"] = topic
                    if prev_published_id:
                        img_data["reply_to_id"] = prev_published_id

                    p_req = urllib.request.Request(
                        f"https://graph.threads.net/v1.0/{user_id}/threads",
                        data=urllib.parse.urlencode(img_data).encode("utf-8"),
                        method="POST",
                    )
                    with urllib.request.urlopen(p_req, timeout=15) as p_res:
                        container_id = json.loads(p_res.read().decode("utf-8"))["id"]

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

                    p_req = urllib.request.Request(
                        f"https://graph.threads.net/v1.0/{user_id}/threads",
                        data=urllib.parse.urlencode(txt_data).encode("utf-8"),
                        method="POST",
                    )
                    with urllib.request.urlopen(p_req, timeout=15) as p_res:
                        container_id = json.loads(p_res.read().decode("utf-8"))["id"]

                # 処理完了待機
                self.wait_for_container_finished(container_id, token)

                # 公開 (Publish)
                pub_params = urllib.parse.urlencode({
                    "access_token": token,
                    "creation_id": container_id,
                }).encode("utf-8")
                pub_req = urllib.request.Request(
                    f"https://graph.threads.net/v1.0/{user_id}/threads_publish",
                    data=pub_params,
                    method="POST",
                )
                with urllib.request.urlopen(pub_req, timeout=15) as pub_res:
                    pub_data = json.loads(pub_res.read().decode("utf-8"))
                    published_id = pub_data["id"]

                created_ids.append(published_id)
                prev_published_id = published_id
                clean_u = (username or "").lstrip("@")
                created_urls.append(
                    f"https://www.threads.net/@{clean_u}/post/{published_id}" if clean_u else f"https://www.threads.net/post/{published_id}"
                )

                if i < len(post_texts) - 1:
                    time.sleep(1.0)

            self.send_json({
                "success": True,
                "postsCount": len(created_urls),
                "postIds": created_ids,
                "urls": created_urls,
            })
        except Exception as e:
            self.send_json({"success": False, "error": f"Threads投稿エラー: {str(e)}"}, 500)

    def wait_for_container_finished(self, container_id: str, access_token: str, max_wait=25):
        start = time.time()
        while time.time() - start < max_wait:
            try:
                url = f"https://graph.threads.net/v1.0/{container_id}?fields=status,error_message&access_token={urllib.parse.quote(access_token)}"
                req = urllib.request.Request(url, method="GET")
                with urllib.request.urlopen(req, timeout=8) as res:
                    data = json.loads(res.read().decode("utf-8"))
                    status = data.get("status")
                    if status in ("FINISHED", "PUBLISHED"):
                        return
                    if status == "ERROR":
                        raise RuntimeError(f"Threads画像処理エラー: {data.get('error_message')}")
            except Exception:
                pass
            time.sleep(0.8)


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


# -------------------------------------------------------------
# 単体デスクトップアプリ・ウィンドウ起動エンジン
# -------------------------------------------------------------
def launch_standalone_app_window(url: str, title: str, width: int = 1280, height: int = 860) -> bool:
    """
    通常のWebブラウザ（タブやアドレスバーのあるブラウザ）を起動させず、
    独立した単体デスクトップアプリケーション（専用ウィンドウ）として起動する
    """
    is_frozen = getattr(sys, "frozen", False)
    app_api = DesktopAppApi()

    # pywebview 用 日本語ローカライゼーション
    pywebview_localization = {
        "global.quitConfirmation": "終了しますか？",
        "global.ok": "OK",
        "global.cancel": "キャンセル",
    }

    # 1. pywebview による純粋ネイティブウィンドウ起動
    try:
        import webview

        print("[CrossPost] Starting native app window with pywebview...")
        window = webview.create_window(
            title=title,
            url=url,
            width=width,
            height=height,
            min_size=(MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT),
            text_select=True,
            confirm_close=True,
            js_api=app_api,
        )
        app_api.set_window(window)

        # 閉じるイベント時のフック: React側にダークモーダル表示を指示
        def on_window_closing():
            if app_api._is_force_closing:
                return True
            try:
                # フロントエンドのダークモード終了確認ダイアログを開く
                res = window.evaluate_js(
                    "window.__showDarkQuitModal ? (window.__showDarkQuitModal(), true) : false;"
                )
                if res:
                    # ダークモーダルをトリガーできた場合はOSの標準ダイアログを出さずに閉じるのを一旦阻止
                    return False
            except Exception:
                pass
            # 万一JS側が呼べない場合は pywebview の確認ダイアログ（終了しますか？）にフォールバック
            return True

        window.events.closing += on_window_closing

        webview.start(debug=False, localization=pywebview_localization)
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

                print("[OK] pywebview engine ready. Launching window...")
                window = webview.create_window(
                    title=title,
                    url=url,
                    width=width,
                    height=height,
                    min_size=(MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT),
                    text_select=True,
                    confirm_close=True,
                    js_api=app_api,
                )
                app_api.set_window(window)

                def on_window_closing_retry():
                    if app_api._is_force_closing:
                        return True
                    try:
                        res = window.evaluate_js(
                            "window.__showDarkQuitModal ? (window.__showDarkQuitModal(), true) : false;"
                        )
                        if res:
                            return False
                    except Exception:
                        pass
                    return True

                window.events.closing += on_window_closing_retry

                webview.start(debug=False, localization=pywebview_localization)
                return True
        except Exception as e:
            print(f"[INFO] Auto-install skipped: {e}")

    # 2. Windows / OS標準のスタンドアロン・アプリモード (--app)
    # ブラウザのURLバー・タブ・メニューを一切表示させず、単体の独立したアプリウィンドウとして起動
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
                    f"--window-size={width},{height}",
                    "--window-position=center",
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
                cmd = [exe, f"--app={url}", f"--window-size={width},{height}"]
                subproc = subprocess.Popen(cmd)
                app_launched = True
                break
    else:
        # Linux
        linux_candidates = ["google-chrome", "chromium-browser", "chromium", "microsoft-edge"]
        for exe in linux_candidates:
            if shutil.which(exe):
                print(f"[CrossPost] Launching standalone app window: {exe}")
                cmd = [exe, f"--app={url}", f"--window-size={width},{height}"]
                subproc = subprocess.Popen(cmd)
                app_launched = True
                break

    if app_launched and subproc:
        print("[OK] Standalone app window opened (no browser URL bar or tabs).")
        print("     Close the window to exit the application.")
        try:
            subproc.wait()
        except KeyboardInterrupt:
            subproc.terminate()
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
