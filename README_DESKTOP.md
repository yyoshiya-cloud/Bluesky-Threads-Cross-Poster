# CrossPost Desktop Studio (Python版デスクトップアプリ)

Bluesky と Threads への同時投稿・文字数自動分割・画像添付Webスタジオを、Pythonで動作するデスクトップアプリケーションに変換したパッケージです。

Web版の美しいUI・レスポンシブデザイン・テーマカラー・自動分割・画像添付・予約投稿・下書き自動保存などの機能は**すべて100%そのまま**利用できます。

---

## 🌟 主な特徴

1. **Webブラウザ不要・完全な単体アプリ動作**:
   - アドレスバーやタブのあるWebブラウザは一切起動せず、**専用の独立したウィンドウ枠（ネイティブGUI）** として単体起動します。
   - タスクバー上でも独立したアプリとして認識され、ウィンドウを閉じるとアプリも自動終了します。
2. **完全なUI＆機能の維持**:
   - Web版と全く同一のリッチなインターフェース、Bluesky・Threads同時投稿、下書き自動保存、アカウント管理、予約投稿、画像添付。
3. **安全・ローカル完結**:
   - 認証トークンやパスワードは外部サーバーを経由せず、お使いの端末ローカルでのみ処理されます。
4. **ワンクリック起動 & 単体EXE生成対応**:
   - Windows用 `run_desktop.bat`（単体アプリ起動）
   - Windows用 `make_windows_exe.bat`（単体 `CrossPostStudio.exe` を自動ビルド）
   - Mac/Linux用 `run_desktop.sh` を同梱。

---

## 🚀 起動方法（クイックスタート）

### 1. 動作要件
- **Python 3.8 以上**（Windows, macOS, Linux いずれも対応）

### 2. Windows での起動方法
- **方法1（推奨）: `run_desktop.bat` をダブルクリック**
  - 自動的に単体ネイティブGUI枠を整え、Webブラウザなしでアプリが立ち上がります。
- **方法2: `make_windows_exe.bat` をダブルクリック**
  - 完全に単体で動作する実行ファイル（`CrossPostStudio.exe`）を自動生成できます。

### 3. macOS / Linux での起動方法
ターミナルで本フォルダを開き、以下を実行:
```bash
./run_desktop.sh
# または
python3 desktop_app.py
```

起動すると、自動的に専用ウィンドウが立ち上がり、すぐにBluesky / Threadsへの同時投稿スタジオをご利用いただけます。

---

## 📦 単独の実行ファイル (.exe / .app) を作る方法 (PyInstaller)

PythonがインストールされていないPCにも配布可能な `.exe` や `.app` を作成できます。

```bash
# ビルドツールのインストール
pip install pyinstaller pywebview

# ビルド実行
python build_exe.py
```

実行が完了すると、`dist/CrossPostStudio/` フォルダ内に実行可能ファイルが生成されます。

---

## 🛠️ フロントエンドの再ビルド（カスタマイズ時）

UIやReactコードを変更した場合は、以下で静的ファイルを更新できます:

```bash
npm install
npm run build
```
ビルドされた成果物（`dist/` フォルダ）を `desktop_app.py` が自動的に読み込んで配信します。

---

## ❓ トラブルシューティング

### Q. 起動時に「Error code: 404 / Message: File not found」が表示される
- **原因**: 起動したフォルダ内に WebアプリのUIファイル（`dist/index.html`）が見つからない状態です。
- **対処法**:
  1. Web画面の上部にある **「🖥️ デスクトップ版」** ボタンをクリックします。
  2. **「完全ZIPパッケージをダウンロード」** を押し、UIファイル（`dist/`）が同梱された最新のZIPを保存してください。
  3. ダウンロードしたZIPを「すべて展開（解凍）」し、`run_desktop.bat` と同じ場所に `dist` フォルダがある状態で起動してください。

