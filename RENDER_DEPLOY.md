# Render.com デプロイ手順ガイド

CrossPost Studio を Render.com（Node.js Web Service）にデプロイする手順です。

---

## 1. 事前準備
1. 本プロジェクトの最新コードを **GitHub リポジトリ** にプッシュしておきます。
2. [Render.com](https://render.com/) のアカウントを作成・ログインします。

---

## 2. Render.com でのデプロイ手順

### 方法A: Blueprint（render.yaml）による自動設定（推奨・簡単）
1. Render ダッシュボードで **[New +]** -> **[Blueprint]** を選択します。
2. GitHub リポジトリを選択します。
3. リポジトリ内の `render.yaml` が自動検出されます。
4. **[Apply]** をクリックすると、ビルドとデプロイが自動で開始されます。

---

### 方法B: 手動で Web Service を作成する場合
1. Render ダッシュボードで **[New +]** -> **[Web Service]** を選択します。
2. GitHub リポジトリを連携・選択します。
3. 各設定項目に以下を入力します：
   - **Name**: `crosspost-studio`（任意のサービス名）
   - **Language**: `Node`
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
4. **[Advanced]** または **[Environment Variables]** で以下を設定します：
   - `NODE_ENV`: `production`
   - `NODE_VERSION`: `20`
   - （任意・Gemini API利用時）`GEMINI_API_KEY`: お手持ちのAPIキー
5. **[Create Web Service]** をクリックします。

---

## 3. デプロイ後の確認
- ビルド完了後、画面上部に発行されたURL（例: `https://crosspost-studio.onrender.com`）にアクセスします。
- 動画・画像を含む Threads / Bluesky へのクロスポストが専用バックエンドを通じて高速かつ安定して動作します。
