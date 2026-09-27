import fs from 'fs';
import path from 'path';

// スクリーンショット画像をBase64データURIとしてSVGに直接インライン埋め込み
const localScreenshotPath = path.resolve('public', 'screenshot_editor.png');
if (!fs.existsSync(localScreenshotPath)) {
  console.error('Error: screenshot_editor.png not found');
  process.exit(1);
}
const imgBuf = fs.readFileSync(localScreenshotPath);
const screenshotDataUri = `data:image/png;base64,${imgBuf.toString('base64')}`;

// 1920x1080 フルHDの超高精細インフォグラフィックSVG
// - ピクセル解析に基づき、各ヘッダーボタンの正確なピクセル位置へ矢印を完全一致
// - 機能ごとに識別しやすい固有カラー・線種（実線・破線・点線・一点鎖線）を設定
// - ボタン着地点にカラーサークル＆グローを設置し、視認性を飛躍的に向上
const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
  <defs>
    <!-- 背景グラデーション -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#050811"/>
      <stop offset="50%" stop-color="#090f1d"/>
      <stop offset="100%" stop-color="#03060d"/>
    </linearGradient>

    <!-- カード用グラデーション -->
    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>

    <!-- メインエディタ外枠グロー -->
    <filter id="mainGlow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#0284c7" flood-opacity="0.35"/>
    </filter>

    <!-- モーダルカードグロー -->
    <filter id="cardGlow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#000000" flood-opacity="0.75"/>
    </filter>

    <!-- 各機能専用 識別矢印マーカー -->
    <!-- 1. シアン: モード切替 -->
    <marker id="arrowCyan" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <polygon points="0 0, 7 3, 0 6" fill="#22d3ee"/>
    </marker>
    <!-- 2. アンバー: 分析・データ -->
    <marker id="arrowAmber" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <polygon points="0 0, 7 3, 0 6" fill="#fbbf24"/>
    </marker>
    <!-- 3. スカイ: 使い方ガイド -->
    <marker id="arrowSky" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <polygon points="0 0, 7 3, 0 6" fill="#38bdf8"/>
    </marker>
    <!-- 4. インディゴ: 予約カレンダー -->
    <marker id="arrowIndigo" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <polygon points="0 0, 7 3, 0 6" fill="#818cf8"/>
    </marker>
    <!-- 5. パープル: 投稿履歴 -->
    <marker id="arrowPurple" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <polygon points="0 0, 7 3, 0 6" fill="#c084fc"/>
    </marker>
    <!-- 6. ブルー: アカウント設定 -->
    <marker id="arrowBlue" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <polygon points="0 0, 7 3, 0 6" fill="#60a5fa"/>
    </marker>
    <!-- 7. エメラルド: サーバー登録情報 -->
    <marker id="arrowEmerald" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <polygon points="0 0, 7 3, 0 6" fill="#34d399"/>
    </marker>
    <!-- 8. イエロー: AIアシスト -->
    <marker id="arrowYellow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <polygon points="0 0, 7 3, 0 6" fill="#facc15"/>
    </marker>
    <!-- 9. フューシャ: プレビュー -->
    <marker id="arrowFuchsia" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <polygon points="0 0, 7 3, 0 6" fill="#e879f9"/>
    </marker>
    <!-- 10. ローズ: アプリ情報・終了 -->
    <marker id="arrowRose" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
      <polygon points="0 0, 7 3, 0 6" fill="#f43f5e"/>
    </marker>

    <!-- 正規 CrossPost ロゴ用グラデーション ＆ グロー -->
    <linearGradient id="logoBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0F172A" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <linearGradient id="logoBlueskyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8" />
      <stop offset="100%" stop-color="#0085FF" />
    </linearGradient>
    <linearGradient id="logoThreadsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#C084FC" />
      <stop offset="100%" stop-color="#A855F7" />
    </linearGradient>
    <linearGradient id="logoCrossBridge" x1="0%" y1="50%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#0085FF" />
      <stop offset="50%" stop-color="#EC4899" />
      <stop offset="100%" stop-color="#A855F7" />
    </linearGradient>
    <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <style>
    .font-sans { font-family: 'Hiragino Kaku Gothic ProN', 'Meiryo', 'Noto Sans JP', 'Segoe UI', sans-serif; }
    .title { font-weight: 800; letter-spacing: -0.5px; fill: #ffffff; }
    .card-title { font-weight: 700; font-size: 12px; }
    .card-badge { font-weight: 700; font-size: 9.5px; fill: #ffffff; }
    .desc { font-weight: 400; font-size: 10px; fill: #cbd5e1; }
  </style>

  <!-- 背景 -->
  <rect width="1920" height="1080" fill="url(#bgGrad)"/>

  <!-- 背景グリッド -->
  <g opacity="0.06" stroke="#38bdf8" stroke-width="1">
    <line x1="0" y1="120" x2="1920" y2="120"/>
    <line x1="0" y1="240" x2="1920" y2="240"/>
    <line x1="0" y1="360" x2="1920" y2="360"/>
    <line x1="0" y1="480" x2="1920" y2="480"/>
    <line x1="0" y1="600" x2="1920" y2="600"/>
    <line x1="0" y1="720" x2="1920" y2="720"/>
    <line x1="0" y1="840" x2="1920" y2="840"/>
    <line x1="0" y1="960" x2="1920" y2="960"/>
    <line x1="240" y1="0" x2="240" y2="1080"/>
    <line x1="480" y1="0" x2="480" y2="1080"/>
    <line x1="720" y1="0" x2="720" y2="1080"/>
    <line x1="960" y1="0" x2="960" y2="1080"/>
    <line x1="1200" y1="0" x2="1200" y2="1080"/>
    <line x1="1440" y1="0" x2="1440" y2="1080"/>
    <line x1="1680" y1="0" x2="1680" y2="1080"/>
  </g>

  <!-- 最上部ヘッダータイトル帯 -->
  <g transform="translate(40, 16)">
    <rect x="0" y="0" width="1840" height="48" rx="10" fill="#0f172a" stroke="#1e293b" stroke-width="1.5"/>
    
    <!-- 正規の CrossPost ロゴアイコン (蝶モチーフ) -->
    <g transform="translate(14, 8) scale(0.5)">
      <rect width="64" height="64" rx="16" fill="url(#logoBgGrad)" stroke="#334155" stroke-width="2" />
      <path d="M 28 32 C 26 21, 14 17, 12 24 C 10 31, 20 37, 28 34 C 20 39, 11 46, 15 52 C 19 56, 26 50, 29 37 Z" 
            fill="url(#logoBlueskyGrad)" 
            filter="url(#logoGlow)"
            opacity="0.95" />
      <path d="M 36 32 C 38 21, 50 17, 52 24 C 54 31, 44 37, 36 34 C 44 39, 53 46, 49 52 C 45 56, 38 50, 35 37 Z" 
            fill="url(#logoThreadsGrad)" 
            filter="url(#logoGlow)"
            opacity="0.95" />
      <circle cx="32" cy="33" r="5" fill="url(#logoCrossBridge)" filter="url(#logoGlow)" />
      <circle cx="32" cy="33" r="2.2" fill="#FFFFFF" />
    </g>

    <text x="58" y="30" class="font-sans title" font-size="19">CrossPost Web Studio</text>
    <rect x="310" y="13" width="140" height="22" rx="11" fill="#0284c7"/>
    <text x="322" y="28" class="font-sans" font-size="10.5" font-weight="700" fill="#ffffff">BLUESKY &amp; THREADS</text>
    <rect x="465" y="13" width="190" height="22" rx="11" fill="#1e293b" stroke="#38bdf8" stroke-width="1"/>
    <text x="475" y="28" class="font-sans" font-size="10.5" font-weight="700" fill="#38bdf8">システム機能 ＆ 画面遷移図</text>
    <text x="1480" y="30" class="font-sans" font-size="12" font-weight="600" fill="#94a3b8">全機能詳細ガイド / 完全日本語仕様</text>
  </g>

  <!-- ==================== 中央: メイン投稿エディタ画面（原画配置） ==================== -->
  <!-- 配置位置: X = 320, Y = 250, 幅 = 1280, 高さ = 760 -->
  <g id="main-editor-container" transform="translate(320, 250)" filter="url(#mainGlow)">
    <clipPath id="screenClip">
      <rect x="0" y="0" width="1280" height="760" rx="10"/>
    </clipPath>
    <rect x="0" y="0" width="1280" height="760" rx="12" fill="#070b14"/>
    <image href="${screenshotDataUri}" x="0" y="0" width="1280" height="760" preserveAspectRatio="none" clip-path="url(#screenClip)"/>
    <rect x="0" y="0" width="1280" height="760" rx="12" fill="none" stroke="#0284c7" stroke-width="2"/>
  </g>

  <!-- ==================== 上部 7機能カード ＆ 正確な位置への識別矢印 ==================== -->

  <!-- 【カード 1】🔑 モード切替・認証 (シアン / 実線 / ターゲット: LIVE MODE バッジ X=543, Y=263) -->
  <g transform="translate(40, 80)" filter="url(#cardGlow)">
    <rect x="0" y="0" width="245" height="106" rx="8" fill="url(#cardGrad)" stroke="#22d3ee" stroke-width="1.4"/>
    <text x="12" y="24" class="font-sans card-title" fill="#a5f3fc">🔑 モード切替・認証</text>
    <rect x="155" y="10" width="78" height="18" rx="9" fill="#0891b2"/>
    <text x="165" y="22" class="font-sans card-badge">DEMO ↔ LIVE</text>
    <text x="12" y="46" class="font-sans desc">• DEMOモード: 擬似投稿で全機能を安全テスト</text>
    <text x="12" y="66" class="font-sans desc">• LIVEモード: 実際のBluesky＆Threadsへ配信</text>
    <text x="12" y="86" class="font-sans desc">• ヘッダーのMODEバッジから即時切り替え</text>
  </g>
  <!-- 矢印1: シアン実線 -->
  <path d="M 162 186 L 162 210 L 543 210 L 543 260" fill="none" stroke="#22d3ee" stroke-width="2" marker-end="url(#arrowCyan)"/>
  <circle cx="543" cy="263" r="5" fill="#22d3ee" stroke="#0891b2" stroke-width="1.5"/>

  <!-- 【カード 2】📊 分析・データ管理 (アンバー / 一点鎖線 6,3 / ターゲット: 分析ボタン X=1056, Y=263) -->
  <g transform="translate(305, 80)" filter="url(#cardGlow)">
    <rect x="0" y="0" width="235" height="106" rx="8" fill="url(#cardGrad)" stroke="#fbbf24" stroke-width="1.4"/>
    <text x="12" y="24" class="font-sans card-title" fill="#fde68a">📊 分析・データ管理</text>
    <rect x="155" y="10" width="68" height="18" rx="9" fill="#d97706"/>
    <text x="163" y="22" class="font-sans card-badge">統計＆JSON</text>
    <text x="12" y="46" class="font-sans desc">• プラットフォーム別投稿比率グラフ</text>
    <text x="12" y="66" class="font-sans desc">• 文字数・分割頻度の傾向集計</text>
    <text x="12" y="86" class="font-sans desc">• 完全JSONバックアップ＆復元</text>
  </g>
  <!-- 矢印2: アンバー破線 -->
  <path d="M 422 186 L 422 220 L 1056 220 L 1056 260" fill="none" stroke="#fbbf24" stroke-width="2" stroke-dasharray="6,3" marker-end="url(#arrowAmber)"/>
  <circle cx="1056" cy="263" r="5" fill="#fbbf24" stroke="#d97706" stroke-width="1.5"/>

  <!-- 【カード 3】📘 使い方 ＆ 機能ガイド (スカイ / 実線 / ターゲット: 使い方ボタン X=1123, Y=263) -->
  <g transform="translate(560, 80)" filter="url(#cardGlow)">
    <rect x="0" y="0" width="235" height="106" rx="8" fill="url(#cardGrad)" stroke="#38bdf8" stroke-width="1.4"/>
    <text x="12" y="24" class="font-sans card-title" fill="#bae6fd">📘 使い方ガイド</text>
    <rect x="148" y="10" width="75" height="18" rx="9" fill="#0284c7"/>
    <text x="156" y="22" class="font-sans card-badge">全20機能解説</text>
    <text x="12" y="46" class="font-sans desc">• クイックスタート・投稿の流れ</text>
    <text x="12" y="66" class="font-sans desc">• 長文分割＆画像最適化仕様</text>
    <text x="12" y="86" class="font-sans desc">• FAQ ＆ 運用実用TIPS 7選</text>
  </g>
  <!-- 矢印3: スカイ実線 -->
  <path d="M 677 186 L 677 230 L 1123 230 L 1123 260" fill="none" stroke="#38bdf8" stroke-width="2" marker-end="url(#arrowSky)"/>
  <circle cx="1123" cy="263" r="5" fill="#38bdf8" stroke="#0284c7" stroke-width="1.5"/>

  <!-- 【カード 4】📅 予約投稿カレンダー (インディゴ / 破線 4,4 / ターゲット: 予約カレンダーボタン X=1193, Y=263) -->
  <g transform="translate(815, 80)" filter="url(#cardGlow)">
    <rect x="0" y="0" width="235" height="106" rx="8" fill="url(#cardGrad)" stroke="#818cf8" stroke-width="1.4"/>
    <text x="12" y="24" class="font-sans card-title" fill="#c7d2fe">📅 予約投稿カレンダー</text>
    <rect x="146" y="10" width="78" height="18" rx="9" fill="#4f46e5"/>
    <text x="154" y="22" class="font-sans card-badge">日時指定キュー</text>
    <text x="12" y="46" class="font-sans desc">• 月間カレンダー＆週間タイムライン</text>
    <text x="12" y="66" class="font-sans desc">• ドラッグ＆ドロップでの日時変更</text>
    <text x="12" y="86" class="font-sans desc">• 今すぐ投稿への切り替え・削除</text>
  </g>
  <!-- 矢印4: インディゴ破線 -->
  <path d="M 932 186 L 932 240 L 1193 240 L 1193 260" fill="none" stroke="#818cf8" stroke-width="2" stroke-dasharray="4,4" marker-end="url(#arrowIndigo)"/>
  <circle cx="1193" cy="263" r="5" fill="#818cf8" stroke="#4f46e5" stroke-width="1.5"/>

  <!-- 【カード 5】📜 投稿履歴 ＆ リポスト (パープル / 点線 3,3 / ターゲット: 履歴ボタン X=1260, Y=263) -->
  <g transform="translate(1070, 80)" filter="url(#cardGlow)">
    <rect x="0" y="0" width="235" height="106" rx="8" fill="url(#cardGrad)" stroke="#c084fc" stroke-width="1.4"/>
    <text x="12" y="24" class="font-sans card-title" fill="#e9d5ff">📜 投稿履歴＆リポスト</text>
    <rect x="150" y="10" width="74" height="18" rx="9" fill="#7e22ce"/>
    <text x="158" y="22" class="font-sans card-badge">ログ＆再投稿</text>
    <text x="12" y="46" class="font-sans desc">• 過去投稿の高速キーワード検索</text>
    <text x="12" y="66" class="font-sans desc">• ワンクリックで本文復元（リポスト）</text>
    <text x="12" y="86" class="font-sans desc">• スレッド返信先ポストの指定</text>
  </g>
  <!-- 矢印5: パープル点線 -->
  <path d="M 1187 186 L 1187 220 L 1260 220 L 1260 260" fill="none" stroke="#c084fc" stroke-width="2.2" stroke-dasharray="3,3" marker-end="url(#arrowPurple)"/>
  <circle cx="1260" cy="263" r="5" fill="#c084fc" stroke="#7e22ce" stroke-width="1.5"/>

  <!-- 【カード 6】⚙️ アカウント・API設定 (ブルー / 実線 / ターゲット: 設定ボタン X=1362, Y=263) -->
  <g transform="translate(1325, 80)" filter="url(#cardGlow)">
    <rect x="0" y="0" width="245" height="106" rx="8" fill="url(#cardGrad)" stroke="#60a5fa" stroke-width="1.4"/>
    <text x="12" y="24" class="font-sans card-title" fill="#bfdbfe">⚙️ アカウント・API設定</text>
    <rect x="166" y="10" width="68" height="18" rx="9" fill="#1d4ed8"/>
    <text x="174" y="22" class="font-sans card-badge">認証・外観</text>
    <text x="12" y="46" class="font-sans desc">• Bluesky / Threads 認証情報管理</text>
    <text x="12" y="66" class="font-sans desc">• LIVE未ログイン時保存非活性ガード</text>
    <text x="12" y="86" class="font-sans desc">• アクセントテーマカラー即時切替</text>
  </g>
  <!-- 矢印6: ブルー実線 -->
  <path d="M 1447 186 L 1447 230 L 1362 230 L 1362 260" fill="none" stroke="#60a5fa" stroke-width="2" marker-end="url(#arrowBlue)"/>
  <circle cx="1362" cy="263" r="5" fill="#60a5fa" stroke="#1d4ed8" stroke-width="1.5"/>

  <!-- 【カード 7】📁 サーバー登録情報 (エメラルド / 破線 5,3 / ターゲット: サーバー登録情報ボタン X=1433, Y=263) -->
  <g transform="translate(1590, 80)" filter="url(#cardGlow)">
    <rect x="0" y="0" width="290" height="106" rx="8" fill="url(#cardGrad)" stroke="#34d399" stroke-width="1.4"/>
    <text x="12" y="24" class="font-sans card-title" fill="#a7f3d0">📁 サーバー登録情報</text>
    <rect x="210" y="10" width="68" height="18" rx="9" fill="#047857"/>
    <text x="218" y="22" class="font-sans card-badge">暗号化移行</text>
    <text x="12" y="46" class="font-sans desc" fill="#a7f3d0">• /data/account_vault.json 安全管理</text>
    <text x="12" y="66" class="font-sans desc" fill="#a7f3d0">• 他PCへの暗号化移行バックアップ</text>
    <text x="12" y="86" class="font-sans desc" fill="#a7f3d0">• 未連携時ダウンロード非活性ガード</text>
  </g>
  <!-- 矢印7: エメラルド破線 -->
  <path d="M 1735 186 L 1735 215 L 1433 215 L 1433 260" fill="none" stroke="#34d399" stroke-width="2" stroke-dasharray="5,3" marker-end="url(#arrowEmerald)"/>
  <circle cx="1433" cy="263" r="5" fill="#34d399" stroke="#047857" stroke-width="1.5"/>

  <!-- ==================== 左側 2機能カード ＆ 識別矢印 ==================== -->

  <!-- 【カード 8】✨ AIアシスト ＆ タグ提案 (イエロー枠の位置 Y=235 に移動 / 白丸削除・クリーン直線 / ターゲット: AIアシストボタン X=485, Y=347) -->
  <g transform="translate(30, 235)" filter="url(#cardGlow)">
    <rect x="0" y="0" width="275" height="155" rx="8" fill="url(#cardGrad)" stroke="#facc15" stroke-width="1.4"/>
    <text x="14" y="24" class="font-sans card-title" fill="#fef08a">✨ AIアシスト ＆ タグ提案</text>
    <rect x="188" y="10" width="75" height="18" rx="9" fill="#ca8a04"/>
    <text x="196" y="22" class="font-sans card-badge">文章最適化</text>
    <text x="14" y="52" class="font-sans desc">• AI文面調整・トーン最適化</text>
    <text x="14" y="74" class="font-sans desc">• 定型文・例文・任意区切り(---)</text>
    <text x="14" y="96" class="font-sans desc">• 本文からのハッシュタグ推論候補</text>
    <text x="14" y="118" class="font-sans desc">• Threads専用トピックタグ付与</text>
  </g>
  <!-- 矢印8: イエロー直線 (白丸削除 / カード右端からAIアシストボタンへ一本のクリーンな直線を延伸) -->
  <line x1="305" y1="347" x2="485" y2="347" stroke="#facc15" stroke-width="2.2" marker-end="url(#arrowYellow)"/>

  <!-- 【カード 9】🚀 同時マルチ投稿 (位置 Y=480 / 添付図の手描き水色線の通り下回りルートで再配線) -->
  <g transform="translate(30, 480)" filter="url(#cardGlow)">
    <rect x="0" y="0" width="275" height="170" rx="8" fill="url(#cardGrad)" stroke="#38bdf8" stroke-width="1.6"/>
    <text x="14" y="24" class="font-sans card-title" fill="#bae6fd">🚀 同時マルチ投稿</text>
    <rect x="184" y="10" width="79" height="18" rx="9" fill="#0284c7"/>
    <text x="192" y="22" class="font-sans card-badge">文字数＆予約</text>
    <text x="14" y="50" class="font-sans desc">• Bluesky (300字) / Threads (500字)</text>
    <text x="14" y="71" class="font-sans desc">• 制限超過時の文末自然分割ツリー</text>
    <text x="14" y="92" class="font-sans desc" font-weight="700" fill="#38bdf8">• 即時同時送信 ＆ 日時指定の予約投稿</text>
    <text x="14" y="113" class="font-sans desc">• 画像＆動画最大20件添付＆Altテキスト</text>
    <text x="14" y="134" class="font-sans desc">• 自動下書き保存（リロード時復元）</text>
  </g>
  <!-- 矢印9: スカイ太実線 (添付図の通りカード下辺から垂直に降り、下部から水平に「⚡ 同時投稿」タブへ直結) -->
  <path d="M 190 650 L 190 918 L 512 918" fill="none" stroke="#38bdf8" stroke-width="2.4" marker-end="url(#arrowSky)"/>

  <!-- ==================== 右側 2機能カード ＆ 識別矢印 ==================== -->

  <!-- 【カード 10】📱 リアルタイム公式プレビュー (フューシャ / 破線 5,4 / ターゲット: 公式UIスキン切替 X=1330, Y=298) -->
  <g transform="translate(1615, 360)" filter="url(#cardGlow)">
    <rect x="0" y="0" width="275" height="150" rx="8" fill="url(#cardGrad)" stroke="#e879f9" stroke-width="1.4"/>
    <text x="14" y="24" class="font-sans card-title" fill="#f5d0fe">📱 リアルタイムプレビュー</text>
    <rect x="184" y="10" width="78" height="18" rx="9" fill="#a21caf"/>
    <text x="192" y="22" class="font-sans card-badge">公式UIスキン</text>
    <text x="14" y="52" class="font-sans desc">• Bluesky公式UIスキン完全シミュレート</text>
    <text x="14" y="74" class="font-sans desc">• Threads公式UIスキン完全シミュレート</text>
    <text x="14" y="96" class="font-sans desc">• スレッド連結ビジュアライザー表示</text>
    <text x="14" y="118" class="font-sans desc">• 文字サイズ切替・仕様比較モード</text>
  </g>
  <!-- 矢印10: フューシャ破線 (プレビュー上部の公式UIスキンボタンへ正確に接続) -->
  <path d="M 1615 435 L 1400 435 L 1400 298 L 1338 298" fill="none" stroke="#e879f9" stroke-width="2" stroke-dasharray="5,4" marker-end="url(#arrowFuchsia)"/>
  <circle cx="1330" cy="298" r="5" fill="#e879f9" stroke="#a21caf" stroke-width="1.5"/>

  <!-- 【カード 11】ℹ️ アプリ情報 ＆ 終了確認 (ローズ / 破線 4,3 / ターゲット: アプリ情報・終了ボタン X=1545, Y=263) -->
  <g transform="translate(1615, 580)" filter="url(#cardGlow)">
    <rect x="0" y="0" width="275" height="150" rx="8" fill="url(#cardGrad)" stroke="#f43f5e" stroke-width="1.4"/>
    <text x="14" y="24" class="font-sans card-title" fill="#fecdd3">ℹ️ アプリ情報 ＆ 終了確認</text>
    <rect x="194" y="10" width="68" height="18" rx="9" fill="#be123c"/>
    <text x="204" y="22" class="font-sans card-badge">安全終了</text>
    <text x="14" y="52" class="font-sans desc">• アプリバージョン・ライセンス確認</text>
    <text x="14" y="74" class="font-sans desc">• 未保存下書きの自動保存確認</text>
    <text x="14" y="96" class="font-sans desc">• 誤操作によるタブクローズ防止</text>
    <text x="14" y="118" class="font-sans desc">• 次回起動時の状態完全復元</text>
  </g>
  <!-- 矢印11: ローズ破線 (ヘッダー右端のアプリ情報＆終了ボタンへ正確に接続) -->
  <path d="M 1615 655 L 1545 655 L 1545 270" fill="none" stroke="#f43f5e" stroke-width="2" stroke-dasharray="4,3" marker-end="url(#arrowRose)"/>
  <circle cx="1545" cy="263" r="5" fill="#f43f5e" stroke="#be123c" stroke-width="1.5"/>

  <!-- 最下部フッターテキスト -->
  <text x="560" y="1042" class="font-sans" font-size="12" fill="#475569">
    CrossPost Web Studio • Bluesky &amp; Threads Multi-Platform Publisher • System Architecture Infographic
  </text>
</svg>
`;

// 保存
const publicPath = path.resolve('public', 'crosspost_system_infographic.svg');
const assetsPath = path.resolve('src', 'assets', 'images', 'crosspost_system_infographic.svg');

fs.writeFileSync(publicPath, svgContent, 'utf-8');
console.log('Saved to', publicPath);

fs.mkdirSync(path.dirname(assetsPath), { recursive: true });
fs.writeFileSync(assetsPath, svgContent, 'utf-8');
console.log('Saved to', assetsPath);
