import React, { useState } from 'react';
import {
  BookOpen,
  X,
  Zap,
  Clock,
  Calendar as CalendarIcon,
  Sliders,
  Scissors,
  Hash,
  Tag,
  Image as ImageIcon,
  Eye,
  Save,
  Palette,
  Shield,
  Search,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  HelpCircle,
  FileText,
  Layers,
  MousePointerClick,
  BarChart3,
  MessageSquare,
  Reply,
  Network,
  Database,
  Link2,
} from 'lucide-react';

interface UserGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}

interface FeatureSection {
  id: string;
  title: string;
  category: 'core' | 'editing' | 'scheduling' | 'account';
  icon: any;
  summary: string;
  details: string[];
  tips?: string;
}

interface WorkflowStep {
  step: number;
  title: string;
  description: string;
}

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

interface TipItem {
  id: string;
  icon: string;
  title: string;
  description: string;
}

interface OverviewCard {
  id: string;
  icon: any;
  title: string;
  description: string;
}

export const UserGuideModal: React.FC<UserGuideModalProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'diagram' | 'features' | 'workflow' | 'faq' | 'tips'>('overview');
  const [expandedFeatureId, setExpandedFeatureId] = useState<string | null>('feature-mode');

  if (!isOpen) return null;

  const features: FeatureSection[] = [
    {
      id: 'feature-mode',
      title: '🎛️ ヘッダーナビゲーション ＆ アカウント接続ステータス管理',
      category: 'account',
      icon: Sliders,
      summary: 'ヘッダー上部からBluesky・Threadsの連携状況を常時把握でき、アカウント詳細確認や各種管理メニュー（分析、使い方、予約カレンダー、履歴、設定）へ即座にアクセスできます。',
      details: [
        '【常時可視化ステータス】ヘッダー上部のアカウントピルでBluesky（🦋）とThreads（🌀）の接続状態（接続中/未連携）をリアルタイムに確認可能。',
        '【詳細ポップアップ＆クイック操作】ステータスピルをクリックすると連携アカウント詳細が展開し、個別/一括ログアウトや保存済みアカウントの再ログインを素早く実行。',
        '【ワンクリック・機能ナビゲーション】「📊 分析・データ」「📘 使い方」「📅 予約カレンダー」「📜 履歴」「⚙️ 設定」「🚪 終了」の上部メニューボタンから各ツールへ瞬時にアクセス。',
      ],
      tips: 'ヘッダー上のメニューボタン群を活用することで、エディタで文章を作成しながらいつでも過去の投稿履歴や予約カレンダー、分析データを素早く確認できます。',
    },
    {
      id: 'feature-security',
      title: '🔒 アカウント認証・API設定 & 暗号化ローカル保管',
      category: 'account',
      icon: Shield,
      summary: 'Bluesky・Threadsの認証情報はブラウザ内（localStorage）に安全に暗号化して保管。外部サーバーへ秘密情報を無断送信することなく安全に管理されます。',
      details: [
        '【Bluesky連携】ハンドル名とアプリパスワード（App Password）を用いたセキュアなAT Protocol認証。',
        '【Threads連携】Meta Graph APIのユーザーIDと長期間アクセストークンによる公式API接続。',
        '【安全な暗号化保管】認証情報はブラウザ内のみで暗号化して保存され、ワンクリックでの全消去・ログアウトに対応。',
        '【LIVE移行時の自動クリーンアップ】LIVEモード切替時や起動時に、DEMOモードの一時テストデータやダミーキューを自動消去して本番環境の混入を防止。',
      ],
      tips: 'Blueskyはメインパスワードではなく、公式設定画面で発行できる「アプリパスワード」を使用することでより安全に連携できます。',
    },
    {
      id: 'feature-server-vault',
      title: '🗄️ サーバー登録情報一覧 & アカウント復元（LIVEモード限定）',
      category: 'account',
      icon: Database,
      summary: 'ヘッダー「設定」の右隣に新設。サーバー上の安全な保管庫（/data/account_vault.json）に登録された連携アカウント情報をいつでもワンクリックで一覧確認・再取得できます。',
      details: [
        '【設定の右隣から即座にアクセス】LIVEモード時、ヘッダー右上の「設定」の右隣にある「サーバー登録情報」ボタンから即座に開閉可能。',
        '【登録アカウントの透明な確認】サーバーに保存されているBluesky（ハンドル名・セッション情報）およびThreads（ユーザー名・アクセストークン有効期限）の登録状態を一覧で可視化。',
        '【端末変更・キャッシュ消去時の安心復元】ブラウザのシークレットモードやキャッシュクリア後でも、サーバー登録情報を元にワンクリックで即座に連携状態を復元できます。',
      ],
      tips: 'ヘッダーの設定ボタンの右隣にある「サーバー登録情報」ボタンをクリックするだけで、現在サーバーに記憶されているアカウント情報を素早く確認できます。',
    },
    {
      id: 'feature-tabs',
      title: '📑 プラットフォーム別個別タブ編集（共通 / Bluesky専用 / Threads専用）',
      category: 'editing',
      icon: Layers,
      summary: '全SNSで同じ文章を送る「共通モード」に加え、BlueskyとThreadsで文面やハッシュタグを個別に書き分けて送信できます。',
      details: [
        '「🌐 共通テキスト」「🦋 Bluesky専用」「🌀 Threads専用」の3つのタブをワンクリックで切り替え可能。',
        '個別タブを有効にすると、Blueskyには短めの技術要約、Threadsには親しみやすい長文や専用トピックといった最適な書き分けを同時に配信。',
        'AIアシストの「トーン自動調整」で生成された結果を、それぞれの個別タブへワンクリックで自動流し込みできます。',
      ],
      tips: '「共通テキスト」を編集すると各個別タブの初期値としても同期されるため、差分だけの調整もスムーズです。',
    },
    {
      id: 'feature-reply',
      title: '💬 スマート・リプライ投稿 & 所有権自動判定（Threads / Bluesky）',
      category: 'core',
      icon: MessageSquare,
      summary: 'BlueskyおよびThreadsの既存投稿URLを指定し、その投稿への返信（リプライ・ツリー追記）として配信できます。両SNSのAPI仕様と制限に対応したプラットフォーム自動判定、短縮共有リンク解決、数値IDデコード、2段階所有権判定を完備。',
      details: [
        '【プラットフォーム自動判定 ＆ 短縮共有リンク追跡】URLからBluesky/Threadsを即座に自動判別。Threads公式アプリの共有短縮リンク（/share/・/t/）もサーバー側で正規URLへ自動解決。',
        '【BlueskyのAT-URI解決 ＆ ツリー構造引き継ぎ】ハンドル名からDIDを解決し、親投稿情報（Root/Parent）を自動特定して正確な会話ツリーを形成。',
        '【Threadsの64bit数値Media ID自動デコード】英数字ショートコード（Base64URL形式）からMeta Graph APIが要求する64bit数値Media IDを瞬時に復元。',
        '【Threads API制限に対応した2段階所有権判定】Meta公式APIの仕様（本人投稿のみ返信可）を安全に満たすため、高速照合とDry-Runプローブ検証の2段階で他者投稿への誤返信を完全に事前ブロック。',
        '【スレッド自動連鎖（チェーン）配信】本文が長文分割された場合、1件目を指定リプライ先に接続し、2件目以降は直前の自ポストへ自動連鎖接続（チェーン）して連続ツリーを構築。',
      ],
      tips: '過去の告知のツリー追記や連載スレッドの更新に最適です。「照合・事前チェック」ボタンや直近投稿一覧からの選択機能で、APIエラーを起こさず確実にスレッドを延長できます。',
    },
    {
      id: 'feature-splitter',
      title: '✂️ 任意区切り (---) & 長文自然文末スレッド自動分割',
      category: 'editing',
      icon: Scissors,
      summary: '文字数制限（Bluesky 300字、Threads 500字）を超える長文を、自然な文末または指定した区切り位置でスレッド（ツリー）投稿に自動分割します。',
      details: [
        '【任意区切り】文章中の区切りたい場所に「---」を入力すると、その位置で確実に次の投稿へ分割。',
        '【自動分割】段落（空行）や句読点（。！？）など自然な日本語の切れ目で自動分割。',
        '【連番オプション】「(1/3)」「(2/3)」といったスレッド連番の自動付与をON/OFF可能。',
      ],
      tips: 'エディタ上部の「✂️ 区切る (---)」ボタンを押すと、カーソル位置に素早く --- が挿入されます。',
    },
    {
      id: 'feature-snippets',
      title: '📋 定型文・スニペット管理 & 例文ドロップダウン（文字数タグ付き）',
      category: 'editing',
      icon: FileText,
      summary: 'よく使う挨拶文、署名、リンク集をスニペットとしてストック可能。さらに多種多様な例文（全7件）を文字切り捨てなしの完全表示でワンクリック挿入できます。',
      details: [
        '【定型文モーダル】「📋 定型文」ボタンからモーダルを開き、挨拶・告知・リンク集などのテンプレートを即座に本文へ挿入。独自の定型文をカテゴリ別に新規作成・編集・削除可能。',
        '【例文ドロップダウン】エディタ右上の「✨ 例文」ボタンから全7件のサンプル文章を展開。タイトル、用途説明、文字数目安バッジ、カテゴリタグ、要約プレビューを完全表示。',
        '【スムーズな操作性】外側クリックやEscキーでも瞬時に閉じられます。',
      ],
      tips: '長文分割や任意区切り（---）の挙動をすぐ試したい時は、「✨ 例文」から「任意区切りテスト」や「長文コラム」を読み込むとプレビューが一発で確認できます。',
    },
    {
      id: 'feature-context-menu',
      title: '🖱️ マウス右クリック編集メニュー（貼り付け・コピー・切り取り・全選択）',
      category: 'editing',
      icon: MousePointerClick,
      summary: 'エディタや設定メニューの入力欄で、マウス右クリックから即座に編集操作が行えます。',
      details: [
        '設定画面の各入力欄（ユーザー名、アプリパスワード、アクセストークン等）で右クリックメニューが直接オープン。',
        '「📋 貼り付け (Paste)」「📄 コピー (Copy)」「✂️ 切り取り (Cut)」「✨ すべて選択」「🗑️ クリア」に対応。',
        'メイン投稿エディタやThreadsトピック入力欄、プリセット設定画面でも共通してスムーズに操作可能。',
      ],
      tips: 'ワンクリックで安全にクリップボードのトークンやパスワードを素早く貼り付けできます。',
    },
    {
      id: 'feature-ai-assist',
      title: '✨ AIアシスト & 投稿リライト (Gemini 3.8 Flash / 高可用フォールバック搭載)',
      category: 'editing',
      icon: Sparkles,
      summary: '文脈を考慮したスレッド分割、プラットフォーム別のトーン自動調整、誤字脱字・シャドウバン規約リスク点検を搭載。一時的な混雑時も自動再試行＆代替モデルへ切り替わります。',
      details: [
        '【自然なスレッド分割】単純な文字数による機械的分割ではなく、文末・段落・起承転結を保ちながら読みやすい複数ポストに再構成。Bluesky基準（300字）・Threads基準（500字）にも対応。',
        '【プラットフォーム別トーン自動調整】同じ告知内容から「Bluesky向け（落ち着いた開発者・知見オピニオン寄り）」と「Threads向け（親しみやすい絵文字や共感フック）」にワンクリックで書き分け、各個別タブへ一括適用。',
        '【誤字脱字・NGワード・規約違反チェッカー】URLリンク生存確認、誤字脱字検出、シャドウバン制限を受けやすい表現を点検し、0〜100点の安全性スコアと改善案を提示。',
        '【高可用性・多重フォールバック】AIサーバーの一時的高負荷（503）やレート制限（429）を自動検知し、指数バックオフ再試行と代替モデルへの自動切替で安定稼働。',
      ],
      tips: 'エディタ上部の「✨ AIアシスト」ボタンからいつでも素早く実行できます。',
    },
    {
      id: 'feature-hashtag',
      title: '🏷️ AI＆トピック解析ハッシュタグ候補提案 & オリジナルタグ管理',
      category: 'editing',
      icon: Hash,
      summary: '入力テキストの内容をリアルタイム解析し、最適なハッシュタグを自動推薦・ストック管理します。',
      details: [
        '本文内のキーワードに応じた関連タグをリアルタイム推薦。',
        'ワンクリックで本文末尾にハッシュタグをスマート挿入（スペース・改行自動調整、重複防止）。',
        '「すべて追加」ボタンで候補タグを一括挿入可能。',
        '「トレンド・カテゴリ一覧」からジャンル別の定番タグを選択可能。',
        '独自のオリジナルタグを入力し「オリジナル」カテゴリーに保存・ストックしていつでもワンクリックで再利用可能。',
      ],
      tips: 'すでに本文に含まれているタグは「追加済 ✔️」と表示され、再度クリックすると本文から簡単に取り消し（解除）できます。',
    },
    {
      id: 'feature-threads-topic',
      title: '🌀 Threads専用トピックタグ（スレッド内全適用・履歴候補管理）',
      category: 'editing',
      icon: Tag,
      summary: 'Threads公式トピックタグとしてスレッド内の全分割投稿に一括登録。よく使うタグの候補保存・削除にも対応。',
      details: [
        'スレッド分割されたすべての投稿（ツリー全体）に同一のトピックタグを一括自動適用（Blueskyには送信されません）。',
        '【リアルタイムプレビュー連携】プレビュー上のThreads投稿の先頭にトピックタグ（#トピック）が表示され、実際の見え方を忠実に再現。',
        '一度入力したトピックは候補リストとしてローカル保存され、次回以降ワンクリックで即座に呼び出し可能。',
        '候補トピックは右側の「✕」ボタンで自由に個別削除可能。「初期化」ボタンで定番トピック一覧に戻すこともできます。',
      ],
      tips: 'Threadsのみに反映されるため、Blueskyの文字数制限を消費せず、Threadsのトピック検索やレコメンドを最大活用できます。',
    },
    {
      id: 'feature-images',
      title: '🖼️ メディア添付（画像・動画対応・最大20件）・Alt属性・ドラッグ並び替え',
      category: 'editing',
      icon: ImageIcon,
      summary: '最大20件の画像・動画を添付可能。ドラッグ＆ドロップでの直感的な並び替えや全画面プレビュー、視覚障害者向けAlt設定に対応。',
      details: [
        'PNG, JPEG, WebP, GIFの各種画像形式に加え、MP4, MOV, WebM, M4V形式の動画添付とプレイヤー再生に対応。',
        'ドラッグ＆ドロップによる直感的な並び替え（一覧カードおよび拡大プレビューのサムネイル双方でスムーズに順序移動可能）。',
        '重複追加防止ガードにより、同一ファイルの二重添付を自動で防止。',
        '全画面拡大プレビューモーダル（前へ/次へ送り、順序移動、削除に対応）。',
        '画像ごとに個別の代替テキスト（Alt属性 / 説明文）を入力・編集可能。',
        '【Bluesky】1投稿4枚制限に合わせ、5枚目以降の画像は4枚毎に自動でツリー（リプライ）へ分割。',
        '【Threads】1投稿あたり最大20枚のカルーセル（スワイプ表示）として一括配信。',
      ],
      tips: '画像や動画をクリックすると全画面プレビューが開き、キーボードの左右矢印キーで前後の画像をめくることができます。',
    },
    {
      id: 'feature-ogp',
      title: '🔗 リンクOGPカード自動取得・リアルタイムプレビュー',
      category: 'editing',
      icon: Link2,
      summary: '投稿本文に含まれるWebサイトURLから、タイトル・説明文・アイキャッチ画像を自動取得して美しいOGPリンクカードとしてプレビュー＆配信します。',
      details: [
        '【URL自動検出】本文中のWebリンク（http:// / https://）を自動解析し、OGPメタデータを高速取得。',
        '【リッチリンクカード生成】Bluesky・Threadsそれぞれの公式仕様に合わせたアイキャッチ画像付きリンクカードを構築。',
        '【リアルタイムプレビュー連動】エディタおよびプレビュー画面上でリンクカードの表示状態を即座に確認可能。',
      ],
      tips: 'ブログ記事やニュース、新製品ページのURLを貼り付けるだけで、魅力的なカード付きポストが手軽に作成できます。',
    },
    {
      id: 'feature-preview',
      title: '📱 公式UIスキン＆リアルタイム・ネイティブプレビュー（Bluesky / Threads）',
      category: 'core',
      icon: Eye,
      summary: 'BlueskyとThreadsそれぞれの公式アプリUI（アイコン・ヘッダー・アクションバー・画像配置）をシミュレートしたスキンで、実際の見え方を忠実に確認できます。',
      details: [
        '【公式UIスキン】Blueskyの深いネイビー背景・公式バタフライロゴ・300字制限表示と、Threadsの漆黒背景・公式渦巻きロゴ・500字＆カルーセル表示をリアルに再現。',
        '「📱 公式UIスキン」ボタンで、公式アプリ風シミュレーターと標準コンパクト表示をワンクリックで切り替え可能。',
        '【仕様の比較ガイド】上部の「仕様の比較」ボタンで、文字数・画像制限（Bluesky 4枚グリッド vs Threads 20枚カルーセル）・ALT属性・トピックタグの差異を瞬時に比較確認。',
        '文字サイズ変更（大・中・小）や「両方並列」「Blueskyのみ」「Threadsのみ」のプラットフォーム別単独表示に対応。',
        'スレッド分割された各パートのツリー接続線や返信先シミュレーション、ALTバッジも直感的に表示。',
      ],
      tips: 'プレビューを見ながら改行位置やスレッド分割、画像カルーセルの配置を微調整できるため、投稿先ごとの最適なレイアウトで発信できます。',
    },
    {
      id: 'feature-visualizer',
      title: '🎚️ ツリー連結ビジュアライザー & ワンクリック折りたたみ機能',
      category: 'core',
      icon: Network,
      summary: '長文や複数画像でスレッド（ツリー）分割された際、各ポストの連結度合いを0%〜100%まで自在に可視化・調整。ポスト個別精査・密着ツリー表示や、ワンクリック折りたたみ・自動記憶に対応します。',
      details: [
        '【スレッド分割時の自動出現】長文や画像複数添付によって投稿が2件以上に分割された際、プレビュー上部に専用のコントローラーが展開されます。',
        '【3段階の連結表示モード】①「分離モード (0%〜25%)」: 各ポストを独立したカード枠で表示し、1投稿ごとの見た目を個別に精査可能。②「標準モード (26%〜71%)」: 公式アプリに準拠したバランスの良い返信ライン表示。③「密着モード (72%〜100%)」: 余白を密着させ光彩ネオンラインを点灯。「#1 ➔ #2 連結点（何文字目で分割されたか）」のジャンクションノードを表示。',
        '【クイックプリセット切り替え】「分離 (0%)」「標準 (50%)」「密着 (100%)」の3つのワンタップボタンで瞬時に切り替え可能。',
        '【分割ポスト・ナビゲーションインスペクター】「🦋 Bluesky: #1 (300字), #2 (240字)」などの分割ボタンをクリックするとプレビュー内の該当ポストへ瞬時にフォーカス。',
        '【ワンクリック折りたたみ・展開】ヘッダーバーまたは「折りたたむ / 展開」ボタンでコンパクトに1行化・再展開が可能。開閉状態はブラウザに自動記憶。',
      ],
      tips: 'スレッド全体の連続した読みやすさをチェックしたい時は「密着 (100%)」、1投稿ごとの見栄えを確認したい時は「分離 (0%)」が便利です。',
    },
    {
      id: 'feature-crosspost',
      title: '🚀 Bluesky & Threads 同時マルチ投稿（即時配信）',
      category: 'core',
      icon: Zap,
      summary: 'ワンクリックでBlueskyとThreadsの両方に最適化された形式で同時配信します。',
      details: [
        '投稿先のチェックボックスでBluesky単独、Threads単独、両方への同時投稿を自由に選択可能。',
        '各プラットフォームの仕様（Bluesky 300文字、Threads 500文字）に合わせた文字数検証と自動整形。',
        '投稿完了時には各SNSの実際の投稿URLを直接開けるリンクを表示。',
      ],
      tips: 'アカウント設定前の場合は「DEMOモード」で投稿フローとプレビューを安全にお試しいただけます。',
    },
    {
      id: 'feature-presets',
      title: '⚙️ 予約時刻クイック選択プリセットの自由カスタマイズ',
      category: 'scheduling',
      icon: Sliders,
      summary: 'よく使う予約時刻を自由に登録・編集・削除（最大8件）し、ワンタップで指定日時に設定できます。',
      details: [
        '初期状態では「09:00 (朝)」「12:00 (昼)」「15:00 (午後)」「18:00 (夕方)」の4件のプリセットを標準搭載。',
        '「⚙️ プリセット設定」モーダルから、表示ラベル（例: 20:00 夜配信）と指定時刻（HH:mm）を自由に追加・変更・削除可能。',
        '指定時刻が現在の日本時間を過ぎている場合、自動的に「翌日のその時刻」に賢く日時をセット。',
        'カスタムプリセットはブラウザ（localStorage）に永続保存され、いつでも「デフォルトに戻す」で初期状態に復元可能。',
      ],
      tips: 'よく投稿する時間帯（朝のニュース、お昼休み、帰宅時、ゴールデンタイム）を登録しておくと日々の予約が極めてスムーズになります。',
    },
    {
      id: 'feature-schedule',
      title: '⏰ 日本時間（JST）予約投稿 & 投稿区分指定',
      category: 'scheduling',
      icon: Clock,
      summary: '日本標準時（UTC+9）で投稿日時を指定し、同時投稿・Blueskyのみ・Threadsのみの投稿区分を設定して自動配信します。',
      details: [
        '日本時間での日時ピッカー（YYYY/MM/DD HH:mm JST）と残り時間のリアルタイムカウントダウン表示。',
        '予約ごとに「🚀 同時投稿」「🦋 Blueskyのみ」「🌀 Threadsのみ」の投稿区分を自由に設定可能。',
        'ブラウザを開いている間にバックグラウンドタイマーが自動で待機キューを監視・時間通りに自動送信。',
        '万一指定時刻を過ぎてから開いた場合でも、期限切れキューとして検知し即座に自動送信または手動実行が可能。',
      ],
      tips: '予約投稿が完了するとトースト通知でお知らせされ、投稿履歴にも自動保存されます。',
    },
    {
      id: 'feature-calendar',
      title: '📅 月間・週間カレンダービュー & 区分・ステータス絞り込み管理',
      category: 'scheduling',
      icon: CalendarIcon,
      summary: '月間グリッド・週間タイムラインで予約投稿を視覚的に一覧管理し、新規予約の作成や本文・日時・区分の編集を直接行えます。',
      details: [
        '【3種類のビュー切替】「🗓️ 月間カレンダー」「📅 週間カレンダー」「📋 リスト表示」を上部タブからワンクリックで自在に切り替え可能。',
        '【月間カレンダー】1ヶ月全体のカレンダーマスに、時刻・投稿区分・本文抜粋を色分けバッジ（待機中 / 完了 / エラー）で表示。日付を選択すると下部の詳細パネルにその日の予約一覧が展開。',
        '【月間カレンダーからの新規予約作成】「＋ 新規予約」ボタンや日付選択から新規予約ダイアログを起動。投稿先、予約日時、本文、トピックタグを入力して即座に登録。',
        '【週間カレンダー】横スクロールタイムラインと7列横並び表示の2レイアウトに対応。',
        '【カレンダー上での直接編集】予約本文の編集、Threadsトピックタグ編集、投稿区分切替、予約日時の変更をカレンダー上で直接行い保存可能。',
        '【直感的なアクション】エディタへの復元、今すぐ投稿、予約解除（削除）に対応。',
        '【高度な絞り込み】投稿区分（すべて/同時/Bluesky/Threads）とステータス（すべて/待機中/完了/エラー）のフィルターで瞬時に目的の投稿を抽出。',
      ],
      tips: '月間カレンダーは月全体の配信バランスの把握や新規予約の追加に最適で、週間カレンダーは直近1週間の時系列スケジュール確認や日時の微調整に便利です。',
    },
    {
      id: 'feature-draft',
      title: '💾 自動下書き保存 & リロード復元（作業消失防止）',
      category: 'editing',
      icon: Save,
      summary: '入力中の文章や設定、添付メディアをリアルタイムで自動ローカル保存し、ブラウザを再読み込み・再起動しても作業内容が完全に復元されます。',
      details: [
        'キー入力やメディア添付と同時にsessionStorageおよびIndexedDBへ自動一時保存。',
        '誤ってブラウザをリロードしたり閉じたりしても、次回アクセス時に下書き内容をそのまま復元。',
        '「クリア」ボタンを押すことで、下書きをいつでもまっさらな初期状態にリセット可能。',
      ],
      tips: '途中で別の作業を行ったり誤ってタブを閉じてしまっても、編集内容が消える心配はありません。',
    },
    {
      id: 'feature-history',
      title: '📜 投稿履歴検索 & ワンクリック・リポスト（エディタ復元）',
      category: 'core',
      icon: Clock,
      summary: '過去に配信した投稿履歴をローカルに完全記録。キーワード検索、SNS別フィルタリング、ワンクリックでの本文・添付メディア・設定のエディタ復元（リポスト・再編集）が可能です。',
      details: [
        '【過去投稿の高速全文検索】投稿本文、ハッシュタグ、日時、投稿先（Bluesky / Threads）でのフィルタリング検索。',
        '【ワンクリック・リポスト復元】「エディタに復元」ボタンを押すだけで、過去の投稿本文、画像添付、リプライ設定、Threadsトピックタグを現在のエディタへ即座に読み込み再投稿・派生投稿が可能。',
        '【投稿先URLのダイレクトアクセス】配信済みの各プラットフォームの公開URLリンクから、実際のポストをブラウザで即座に確認可能。',
      ],
      tips: '定期的に発信する告知やシリーズ投稿のひな型として、過去の投稿履歴からワンクリックで復元して編集・投稿できます。',
    },
    {
      id: 'feature-analytics',
      title: '📊 簡易エンゲージメント分析・リアクション比較 & 完全JSONデータ管理',
      category: 'core',
      icon: BarChart3,
      summary: '投稿履歴から各ポストのいいね数・リポスト数を一覧で比較し、どちらのSNSで反響が高かったかを即座に分析。全履歴と予約データのCSV/JSONエクスポート・バックアップ復元にも対応。',
      details: [
        '【エンゲージメント比較・リアクション分析】BlueskyとThreadsの「いいね数」「リポスト数」「合計リアクション数」をカード形式で可視化。「🦋 Blueskyで大好評」「🌀 Threadsで大好評」といった比較インサイトバッジを自動判定。',
        '【最新リアクションの一括/個別取得】ヘッダーやモーダル内の「最新リアクションを取得」ボタンで、各SNSのAPIから最新のエンゲージメント数を一括同期（DEMOモードでもリアルなシミュレーション値を提供）。',
        '【ソート・絞り込みフィルター】「反響が大きい順」「いいね数順」「リポスト数順」「SNS間差が大きい順」「投稿日時順」や、キーワード・投稿先SNSによる柔軟な絞り込みが可能。',
        '【CSV / JSONエクスポート & バックアップ復元】過去の投稿履歴CSV（Excel対応UTF-8 BOM付き）、予約投稿CSV、およびアプリ全体の完全バックアップJSON（履歴＋予約リスト）のワンクリック書き出し＆安全な復元（上書き/マージ）に対応。',
      ],
      tips: 'ヘッダーの「📊 分析・データ」ボタンまたは履歴モーダル内の「📊 エンゲージメント分析」からいつでもアクセスできます。定期的なCSV/JSONバックアップにより大切な投稿データを手元に保存できます。',
    },
    {
      id: 'feature-theme',
      title: '🎨 アクセントカラー切替テーマ（7色展開）',
      category: 'account',
      icon: Palette,
      summary: '好みに合わせてダークテーマのアクセントカラーを瞬時にカスタマイズできます。',
      details: [
        'ヘッダーのテーマドロップダウンや設定モーダルから選択可能。',
        'オーシャン・スカイ、ネオン・インディゴ、コズミック・バイオレット、エメラルド・オーロラ、サンセット・アンバー、ローズ・ルビー、サイバー・シアンの7色を搭載。',
        '選択したテーマはブラウザに自動保存されます。',
      ],
      tips: '気分や作業時間帯に合わせてアクセントカラーを切り替えることで、快適な執筆環境を作れます。',
    },
    {
      id: 'feature-app-info-exit',
      title: 'ℹ️ アプリ情報・OSSライセンス表示 & 安全終了保護（未保存下書き確認）',
      category: 'account',
      icon: Shield,
      summary: 'ヘッダー右端の「アプリ情報（ℹ️）」および「終了（🚪）」ボタン。バージョン情報や利用規約・ライセンスの確認、および誤操作による作業内容の消失を防ぐ安全終了ガードを提供します。',
      details: [
        '【アプリ情報ダイアログ】現在のCrossPost Web Studioバージョン、機能概要、公式リポジトリ、採用技術スタック、およびライセンス情報を一覧表示。',
        '【未保存下書き保護・終了確認】未送信の文章や添付メディアがある状態で「終了」ボタンを押した際、保存状態を確認し安全にブラウザタブを終了できる確認ダイアログが発動。',
        '【誤クローズ防止】誤って作業途中のタブを閉じてしまうトラブルを防止し、次回起動時への自動保存下書きの引き継ぎを保証します。',
      ],
      tips: '作業終了時は「終了」ボタンを押すことで、編集中のテキストが安全に自動保存されているかを確認してから安心して終了できます。',
    },
  ];

  const overviewCards: OverviewCard[] = [
    {
      id: 'ov-visualizer',
      icon: Network,
      title: '🎚️ ツリー連結ビジュアライザー',
      description: 'スレッド分割時に出現。スライダー（0%〜100%）で独立カード個別確認〜光彩密着ツリーまで連結度を自在に調整。ワンクリック折りたたみにも対応。',
    },
    {
      id: 'ov-reply',
      icon: MessageSquare,
      title: '💬 リプライ投稿 & 所有権自動判定',
      description: 'Bluesky・Threadsの既存ポストへの返信投稿に対応。短縮共有リンク（/share/）自動解決、英数字ショートコードの数値IDデコード、2段階の本人所有権照合・事前ガードを完備。',
    },
    {
      id: 'ov-ai',
      icon: Sparkles,
      title: '✨ AIアシスト & トーン自動調整',
      description: '自然なスレッド分割、Bluesky・Threads別のトーン自動調整、誤字脱字・シャドウバン規約リスク点検を搭載。一時的な混雑時も自動再試行＆代替モデルで安定稼働します。',
    },
    {
      id: 'ov-samples',
      icon: FileText,
      title: '📋 例文挿入（全文表示 & タグ付き）',
      description: '文字切り捨てを完全撤廃。全7件のサンプル文章を文字数バッジや用途タグ、要約プレビューと共に完全に確認してワンクリックで読み込めます。',
    },
    {
      id: 'ov-tabs',
      icon: Layers,
      title: '📑 プラットフォーム別個別タブ編集',
      description: '全SNS同じ文章を送る「共通テキスト」に加え、「Bluesky専用」「Threads専用」タブで各SNSに最適な文面・ハッシュタグを個別に書き分けて同時送信できます。',
    },
    {
      id: 'ov-schedule',
      icon: Clock,
      title: '⏰ 日本時間（JST）予約投稿 & 投稿区分',
      description: '日本標準時（UTC+9）で投稿日時を指定。「同時投稿」「Blueskyのみ」「Threadsのみ」の区分ごとに予約・管理できます。',
    },
    {
      id: 'ov-calendar',
      icon: CalendarIcon,
      title: '🗓️ 月間・週間カレンダービュー & 直接編集',
      description: '月間グリッドや週間タイムライン（横スクロール/7列）で配信予定を一括可視化。新規予約の作成や本文・日時・区分の変更、エディタ復元、即時実行を直接操作できます。',
    },
    {
      id: 'ov-server-vault',
      icon: Database,
      title: '🗄️ サーバー登録情報（設定の右）',
      description: 'ヘッダー「設定」の右隣に新設。サーバー保管庫（/data/account_vault.json）に保持された連携アカウント情報を安全に一覧確認・復元可能。',
    },
    {
      id: 'ov-preview',
      icon: Eye,
      title: '📱 公式UIスキン＆リアルタイム比較',
      description: 'Bluesky（ネイビー）とThreads（漆黒）の公式UIスキンや各プラットフォームの仕様比較表で、配信前の見栄えを忠実に確認。',
    },
  ];

  const workflowSteps: WorkflowStep[] = [
    {
      step: 1,
      title: 'アカウント連携（またはDEMOモード）',
      description: '右上の「設定（⚙️）」から、Bluesky（ハンドル名 & 公式アプリパスワード）やThreads（アクセストークン）を設定します。アカウントがない場合でも初期状態の「DEMOモード」ですぐに全機能を安全にお試しいただけます。',
    },
    {
      step: 2,
      title: '本文を入力 & リプライ設定・個別書き分け・メディア添付',
      description: 'エディタに投稿文を入力します。既存ポストへの返信を行いたい場合は「💬 返信先（リプライ）投稿の設定」を開いてURLを入力または「自分の投稿から選択」でセット。「共通テキスト」のほか、「Bluesky専用」「Threads専用」タブでの書き分けやハッシュタグ・Threadsトピックタグ、最大20件の画像・動画添付にも対応しています。',
    },
    {
      step: 3,
      title: 'AIアシスト活用 & プレビュー・任意区切り（---）の調整',
      description: '「✨ AIアシスト」でスレッド分割やトーン調整、誤字脱字・セーフティ点検を実行できます。右側のプレビュー画面では、BlueskyとThreadsそれぞれの見栄え（公式UIスキン）、文字数、動画再生をリアルタイム確認。思い通りの場所で投稿を分けたいときは「✂️ 区切り線を挿入」を押して --- を配置します。',
    },
    {
      step: 4,
      title: '「今すぐ投稿」または「投稿区分を選んで予約投稿」',
      description: '「⚡ 今すぐ投稿」ですぐに配信、または「⏰ 予約投稿」に切り替えて「🚀 同時投稿 / 🦋 Bluesky / 🌀 Threads」の区分と希望日時（クイックプリセットまたは日時ピッカー）を指定して予約完了です。',
    },
  ];

  const faqItems: FaqItem[] = [
    {
      id: 'faq-visualizer',
      question: 'スレッド分割時に表示される「ツリー連結ビジュアライザー」とは何ですか？折りたためますか？',
      answer: '長文や複数画像によって投稿が2件以上のスレッドに自動分割された際、プレビュー上部に自動出現する可視化・調整バーです。スライダーを動かすことで「分離（0%: 各ポストを独立カードで個別確認）」「標準（50%）」「密着（100%: 光彩ラインと分割点ジャンクションで連続性を確認）」を自在に切り替えられます。また、ヘッダーバーまたは右端の「折りたたむ」ボタンをクリックするとワンタッチでコンパクトに折りたため、状態はブラウザに自動記憶されます。',
    },
    {
      id: 'faq-samples',
      question: '「例文」ボタンのドロップダウンにはどんな文章が入っていますか？',
      answer: 'アプリ紹介・機能紹介、任意区切りテスト（---）、絵文字たっぷり開発ログ（約400字・Bluesky分割/Threads1投稿の境界テスト）、リンク＆@メンション自動Facet化、長文コラム（約700字・自動スレッド分割テスト）、ニュース発表、短文Tipsなど全7件が用意されています。タイトルや説明文、文字数目安タグがすべて完全表示されており、ワンクリックで本文へ反映できます。',
    },
    {
      id: 'faq-server-vault',
      question: 'ヘッダーの「サーバー登録情報」ボタン（設定の右）は何ですか？',
      answer: 'LIVE（本番）モード時に利用できる機能です。サーバー（/data/account_vault.json）に安全に保存されているBlueskyおよびThreadsの連携アカウント情報を一覧で確認できます。ブラウザのキャッシュを削除したり別の端末から開いた場合でも、サーバーからワンクリックでアカウントを再取得してログイン状態を復元できます。',
    },
    {
      id: 'faq-reply',
      question: '既存の投稿にリプライ（返信・ツリー追記）して投稿するにはどうすればよいですか？',
      answer: 'エディタ上部にある「💬 返信先（リプライ）投稿の設定」をクリックして展開し、返信したいBlueskyまたはThreadsの投稿URLを入力するか、「🌀 自分のThreads投稿から選択」「🦋 自分のBluesky投稿から選択」ボタンを押して直近の投稿一覧から対象を選択します。対象がセットされるとプレビューにも返信先ポストが接続表示され、送信時にその投稿へのツリー（リプライ）として配信されます。',
    },
    {
      id: 'faq-threads-reply-limit',
      question: 'Threadsで他人の投稿URLにリプライしようとすると警告が出るのはなぜですか？',
      answer: 'Threads公式API（Graph API）の仕様により、サードパーティ製アプリからのリプライ投稿は「認証しているご自身のアカウントが投稿したポスト（64bit数値Media ID）」に対してのみ許可されています。そのため本アプリでは、入力された短縮共有URL（/share/等）の自動展開、URL英数字コードから数値IDへの自動デコード、ログインアカウントとの照合・2段階プローブ判定を行い、他人の投稿へのリプライによるAPIエラーを送信前に未然に防止（事前ガード）しています。',
    },
    {
      id: 'faq-ai',
      question: 'AIアシスト機能でエラーが出たり動作が遅いときはどうすればよいですか？',
      answer: 'Google Gemini 3.8 Flashを標準搭載しており、AIサーバーの一時的高負荷（503）や利用制限（429）を検知すると、指数バックオフによる自動再試行と安定した代替モデル（gemini-flash-latest / gemini-3.1-flash-lite等）へのシームレスな切替を自動で行います。万一失敗した場合でも、モーダル内の「🔄 再試行」ボタンをクリックするか、数十秒おいて再実行することでスムーズに完了できます。',
    },
    {
      id: 'faq-tabs',
      question: 'BlueskyとThreadsで別の文章やハッシュタグを投稿できますか？',
      answer: 'はい、エディタ上部のタブで「🦋 Bluesky専用」「🌀 Threads専用」を選択することで、各SNS向けに独立した本文やハッシュタグを個別に編集・送信できます。AIアシストの「トーン自動調整」機能を使えば、元の文面から両プラットフォームに最適な文体をワンクリックで自動生成し、それぞれの専用タブに一括流し込みすることも可能です。',
    },
    {
      id: 'faq-media-order',
      question: '添付した画像や動画の順番を入れ替えたり、大きく確認できますか？',
      answer: 'はい、添付メディアカードをドラッグ＆ドロップするか、カード上の「◀ / ▶」ボタンで直感的に順序を並び替えできます。画像や動画をクリックすると全画面の拡大プレビューモーダルが開き、「前へ」「次へ」ボタンやキーボードの左右矢印キー（← / →）でスムーズに閲覧切り替えが可能です。さらに拡大モーダル下部のサムネイルをドラッグして投稿順を入れ替えることもできます。',
    },
    {
      id: 'faq-video',
      question: '動画ファイルも添付・投稿できますか？',
      answer: 'はい、MP4、MOV、WebM、M4Vをはじめ、MKV、AVI、3GP、TS、MTSなど幅広い動画ファイル形式に対応しています。ドラッグ＆ドロップまたはファイル選択で最大20件まで添付でき、エディタやリアルタイムプレビュー、全画面拡大モーダル上で動画プレイヤーとして直接再生確認が行えます。動画実体はIndexedDBに安全に永続保存されるため、リロード時も保持されます。',
    },
    {
      id: 'faq-splitter',
      question: 'スレッドの好きな位置で投稿を分割するにはどうすればいいですか？',
      answer: 'エディタ上で分割したい位置に --- （半角ハイフン3つ）を入力するか、エディタ上部の「✂️ 区切り線を挿入」ボタンをクリックしてください。手動区切り線を入れた場合はその位置が最優先され、区切り線がない部分はBluesky（300文字）・Threads（500文字）の上限に応じて文末・段落を考慮しつつ自動分割されます。',
    },
    {
      id: 'faq-calendar',
      question: '月間・週間カレンダーで予約投稿を管理・編集するには？',
      answer: 'ヘッダーの「⏰ 予約カレンダー」ボタンからモーダルを開き、上部の「🗓️ 月間カレンダー」または「📅 週間カレンダー」を選択します。月間カレンダーでは月全体の予約を一覧しつつ「＋新規予約」で直接登録や日別詳細パネルでの本文・日時・区分編集が可能。週間カレンダーでは横スクロールタイムラインと7列グリッドを切り替えながら、投稿区分や日時のインライン変更、エディタへの復元、今すぐ実行、予約解除がワンストップで行えます。',
    },
    {
      id: 'faq-presets',
      question: 'クイック時間プリセットを自分の好きな時間に変更できますか？',
      answer: 'はい、可能です。エディタのプリセット右側にある「⚙️ プリセット設定」ボタンから、最大8件まで好みの時刻（例: 20:00 夜配信）とラベルを自由に追加・編集・削除できます。指定時刻が現在時刻（日本時間）を過ぎている場合は自動的に「翌日のその時刻」に賢く日時がセットされます。',
    },
    {
      id: 'faq-topics',
      question: 'Threadsのトピックタグとハッシュタグの違いは何ですか？',
      answer: 'ThreadsのトピックタグはThreads公式のメタデータ（トピック検索・レコメンド対象）として登録されます。Blueskyの文字数を消費せず、スレッド内のすべての分割投稿に一括適用されます。一度入力したトピックは候補リストとして自動保存され次回ワンクリックで再利用できます。一方、ハッシュタグ（#tag）は本文内に直接テキストとして埋め込まれ、両方のSNSに送信されます。',
    },
    {
      id: 'faq-backup',
      question: '過去の投稿履歴や予約投稿データをバックアップ・復元できますか？',
      answer: 'はい、ヘッダーの「📊 分析・データ」ボタンまたは履歴モーダルから、過去の投稿履歴CSV（UTF-8 BOM付き、Excel対応）、予約投稿CSV、およびアプリ全体の完全バックアップJSON（履歴＋予約リスト）をワンクリックでエクスポートできます。JSONファイルからの完全復元（上書きまたはマージ復元）にも対応しており、端末移行やデータ保護も安心です。',
    },
    {
      id: 'faq-analytics',
      question: 'エンゲージメント分析（いいね・リポスト比較）はどのように活用できますか？',
      answer: '投稿履歴から各ポストのBlueskyとThreadsの「いいね数」「リポスト数」「合計反響」をカード形式で比較できます。「🦋 Blueskyで大好評」「🌀 Threadsで大好評」といった比較インサイトバッジが自動表示され、どちらのSNSでより反響が得られたかを一目で把握できます。「最新リアクションを取得」ボタンでAPIから最新数値をいつでも再同期可能です。',
    },
    {
      id: 'faq-schedule-close',
      question: '予約投稿はブラウザを閉じても実行されますか？',
      answer: '本アプリはユーザーのパスワードやトークンを外部サーバーに送信しないセキュアなクライアント完結構造のため、アプリのブラウザタブを開いている間にバックグラウンドで予定時刻に自動送信されます。万一指定時刻を過ぎてから再度タブを開いた場合でも、期限切れキューとして検知され即座に自動送信または手動実行されます。',
    },
    {
      id: 'faq-app-password',
      question: 'Blueskyのパスワードは通常のログインパスワードを使えますか？',
      answer: '通常のログインパスワードではなく、Bluesky公式の「設定」→「プライバシーとセキュリティ」→「アプリパスワード」で発行した専用の「アプリパスワード（例: abcd-efgh-ijkl-mnop）」をご使用ください。二要素認証（2FA）を有効にしている場合でもスムーズに連携でき、本アプリ内ではAES-256-GCMによって安全に暗号化保管されます。万一連携を解除したい場合も、Bluesky公式画面からいつでも即座にパスワードを破棄（無効化）できます。',
    },
    {
      id: 'faq-autosave',
      question: '入力途中の文章や添付メディアが消えてしまわないか心配です。',
      answer: '入力本文はキーストロークごとに自動でローカル下書き（sessionStorage）へ同期され、添付された画像や動画ファイル本体はブラウザの大容量データベース（IndexedDB）に安全に永続保存されます。ブラウザを誤ってリロードしたりタブを閉じたりしても、復元してそのまま続きから編集できます。',
    },
  ];

  const tipsItems: TipItem[] = [
    {
      id: 'tip-reply-selector',
      icon: '💬',
      title: '最近の自分の投稿からワンクリックで返信先選択',
      description: '返信先設定の「自分の投稿から選択」を使うと、過去のポストURLをコピーしに行かなくても直近の投稿一覧から即座に返信先を指定できます。',
    },
    {
      id: 'tip-context-menu',
      icon: '🖱️',
      title: 'マウス右クリック編集メニュー',
      description: '本文エディタ上で右クリックすると、専用メニューから「クリップボードから貼り付け」「コピー」「切り取り」「すべて選択」を素早く実行できます。',
    },
    {
      id: 'tip-ai-tone',
      icon: '⚡',
      title: 'AIトーン調整から専用タブへ一括反映',
      description: '「✨ AIアシスト」のトーン調整で生成されたBluesky向け・Threads向けの文面は、「個別タブに反映」ボタンで各専用タブへワンタップで流し込みできます。',
    },
    {
      id: 'tip-media-keyboard',
      icon: '⌨️',
      title: 'キーボード矢印キーでメディア閲覧',
      description: '添付画像や動画をクリックして全画面プレビューを開いた後、キーボードの「← / →」キーで前後のメディアを素早く切り替え・確認できます。',
    },
    {
      id: 'tip-topic-chips',
      icon: '🏷️',
      title: 'Threadsトピック候補のワンタップ登録',
      description: '一度使用したトピックタグは候補チップとして自動保存されます。次回投稿時はチップをクリックするだけで即座に入力完了します（✕で個別削除も可能）。',
    },
    {
      id: 'tip-calendar-inline',
      icon: '📅',
      title: 'カレンダーからの直接編集 & 新規予約',
      description: '月間カレンダーの「＋ 新規予約」や日別詳細パネルでの本文編集、週間カレンダー上での日時・区分クイック変更など、エディタに戻らなくてもスケジュール調整が完結します。',
    },
    {
      id: 'tip-backup-json',
      icon: '💾',
      title: '定期的な完全JSONバックアップ',
      description: '「📊 分析・データ」から完全JSONバックアップを書き出しておけば、ブラウザのストレージ消去時や他PCへの移行時にも安全に全データを復元（マージ）可能です。',
    },
  ];

  // -------------------------------------------------------------
  // 検索フィルター処理
  // -------------------------------------------------------------
  const query = searchQuery.trim().toLowerCase();
  const isSearching = query.length > 0;

  const filteredFeatures = features.filter((f) => {
    if (!isSearching) return true;
    return (
      f.title.toLowerCase().includes(query) ||
      f.summary.toLowerCase().includes(query) ||
      f.details.some((d) => d.toLowerCase().includes(query)) ||
      (f.tips && f.tips.toLowerCase().includes(query))
    );
  });

  const filteredOverviewCards = overviewCards.filter((card) => {
    if (!isSearching) return true;
    return (
      card.title.toLowerCase().includes(query) ||
      card.description.toLowerCase().includes(query)
    );
  });

  const filteredWorkflow = workflowSteps.filter((step) => {
    if (!isSearching) return true;
    return (
      step.title.toLowerCase().includes(query) ||
      step.description.toLowerCase().includes(query)
    );
  });

  const filteredFaq = faqItems.filter((faq) => {
    if (!isSearching) return true;
    return (
      faq.question.toLowerCase().includes(query) ||
      faq.answer.toLowerCase().includes(query)
    );
  });

  const filteredTips = tipsItems.filter((tip) => {
    if (!isSearching) return true;
    return (
      tip.title.toLowerCase().includes(query) ||
      tip.description.toLowerCase().includes(query)
    );
  });

  const totalHits =
    filteredFeatures.length +
    filteredOverviewCards.length +
    filteredWorkflow.length +
    filteredFaq.length +
    filteredTips.length;

  const faqAndTipsHits = filteredFaq.length + filteredTips.length;

  // 検索クエリで自動的に最初のヒットがあるタブをサジェストまたは保持
  const handleClearSearch = () => {
    setSearchQuery('');
  };

  return (
    <div
      id="user-guide-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-4xl rounded-2xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
        {/* ヘッダー */}
        <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-accent-subtle text-accent-light border border-accent flex items-center justify-center shadow-sm shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
                  CrossPost Web Studio 使い方 & 機能ガイド
                </h2>
                <span className="badge-accent px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold">
                  最新版ドキュメント
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate sm:whitespace-normal">
                実装されている全機能の詳細と、快適なSNSクロス投稿のためのステップガイド
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent hover:border-slate-700/80 transition cursor-pointer flex items-center justify-center shrink-0"
            title="閉じる (Esc)"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* タブバー & 検索フォーム */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-950/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'overview'
                  ? 'btn-accent text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>🚀 クイックスタート</span>
              {isSearching && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    filteredOverviewCards.length > 0
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {filteredOverviewCards.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('diagram')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'diagram'
                  ? 'btn-accent text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>🗺️ 画面説明図</span>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                図解
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('workflow')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'workflow'
                  ? 'btn-accent text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>📋 投稿の流れ</span>
              {isSearching && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    filteredWorkflow.length > 0
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {filteredWorkflow.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('features')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'features'
                  ? 'btn-accent text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>✨ 実装機能一覧</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                  isSearching
                    ? filteredFeatures.length > 0
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-500'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {isSearching ? filteredFeatures.length : features.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('faq')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'faq'
                  ? 'btn-accent text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>❓ FAQ</span>
              {isSearching && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    filteredFaq.length > 0
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {filteredFaq.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tips')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'tips'
                  ? 'btn-accent text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <span>💡 TIPS</span>
              {isSearching && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    filteredTips.length > 0
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {filteredTips.length}
                </span>
              )}
            </button>
          </div>

          {/* 検索入力欄 */}
          <div className="relative w-full sm:w-64">
            <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="全機能・FAQ・TIPSを検索..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus-ring-accent"
            />
            {isSearching && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
                title="検索をクリア"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 検索中ステータスバー */}
        {isSearching && (
          <div className="px-6 py-2 bg-slate-950/90 border-b border-slate-800/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <Search className="w-3.5 h-3.5 text-accent-light" />
              <span>
                「<strong className="text-white">{searchQuery}</strong>」の検索結果:{' '}
                <strong className={totalHits > 0 ? 'text-accent-light' : 'text-rose-400'}>
                  {totalHits} 件
                </strong>
              </span>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                （機能: {filteredFeatures.length}件, FAQ: {filteredFaq.length}件, TIPS: {filteredTips.length}件, 使い方: {filteredWorkflow.length}件）
              </span>
            </div>
            <button
              type="button"
              onClick={handleClearSearch}
              className="text-[11px] text-accent-light hover:underline cursor-pointer"
            >
              検索条件をリセット
            </button>
          </div>
        )}

        {/* コンテンツ本体 */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-slate-300 text-xs sm:text-sm">
          {/* 全体で検索結果0件の場合の表示 */}
          {isSearching && totalHits === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-200">
                  該当するガイド項目が見つかりませんでした
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  「{searchQuery}」に一致する機能、FAQ、TIPS、操作ガイドはありませんでした。別のキーワードでお試しいただくか、検索をリセットしてください。
                </p>
              </div>
              <button
                type="button"
                onClick={handleClearSearch}
                className="px-4 py-1.5 rounded-lg btn-accent text-white text-xs font-bold transition cursor-pointer"
              >
                すべてのガイドを表示する
              </button>
            </div>
          ) : (
            <>
              {/* TAB 1: 概要 / クイックスタート */}
              {activeTab === 'overview' && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  {!isSearching && (
                    <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3 shadow-md">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-accent-light" />
                        <h3 className="text-base font-bold text-slate-100">
                          CrossPost Web Studio とは？
                        </h3>
                      </div>
                      <p className="text-slate-300 leading-relaxed">
                        <strong>Bluesky</strong>（AT Protocol）と <strong>Threads</strong>（Meta Graph API）への同時投稿・個別予約を直感的に行えるオールインワンWebスタジオです。
                        長文の自動スレッド分割、任意位置での区切り（<code>---</code>）、日本時間（JST）での予約投稿、投稿区分指定（同時 / Bluesky / Threads）、カスタム時間プリセット、週間横スクロールタイムライン・月間カレンダー管理、Threadsトピックタグ、画像・動画（MP4等）の添付・ドラッグ並び替え・全画面プレビュー、AIアシスト（スレッド分割・トーン自動調整・セーフティ点検）など、快適なSNS発信に必要なプロ仕様の機能がすべて揃っています。
                      </p>
                    </div>
                  )}

                  {/* 現在タブで0件だが他タブにヒットがある場合 */}
                  {isSearching && filteredOverviewCards.length === 0 && (
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center space-y-2">
                      <p className="text-xs text-slate-400">
                        クイックスタート内に「{searchQuery}」に一致する概要カードはありません。
                      </p>
                      <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
                        {filteredFeatures.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('features')}
                            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-accent-light text-xs font-bold transition cursor-pointer"
                          >
                            ✨ 実装機能一覧を見る ({filteredFeatures.length}件)
                          </button>
                        )}
                        {filteredFaq.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('faq')}
                            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-accent-light text-xs font-bold transition cursor-pointer"
                          >
                            ❓ FAQを見る ({filteredFaq.length}件)
                          </button>
                        )}
                        {filteredTips.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('tips')}
                            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-accent-light text-xs font-bold transition cursor-pointer"
                          >
                            💡 TIPSを見る ({filteredTips.length}件)
                          </button>
                        )}
                        {filteredWorkflow.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('workflow')}
                            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-accent-light text-xs font-bold transition cursor-pointer"
                          >
                            📋 投稿の流れを見る ({filteredWorkflow.length}件)
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 主要な強みカード */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {filteredOverviewCards.map((card) => {
                      const IconComp = card.icon;
                      return (
                        <div
                          key={card.id}
                          className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2"
                        >
                          <div className="flex items-center gap-2 text-accent-light font-bold">
                            <IconComp className="w-4 h-4" />
                            <span>{card.title}</span>
                          </div>
                          <p className="text-xs text-slate-400">{card.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB: 画面説明図（インフォグラフィック） */}
              {activeTab === 'diagram' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                      <div>
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          🗺️ 画面説明図（日本語版）
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40">
                            完全日本語・フルHDベクター
                          </span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">
                          メイン投稿エディタ画面を中心に、各機能モーダルへの遷移・連携フローをすべて日本語で可視化した画面説明図です。
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href="/infographic_viewer.html"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>全画面表示</span>
                        </a>
                      </div>
                    </div>

                    {/* インフォグラフィック図（添付スクリーンショット原画完全内包版） */}
                    <div 
                      className="relative group rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 shadow-2xl w-full cursor-zoom-in"
                      onClick={() => window.open('/infographic_viewer.html', '_blank')}
                      title="クリックで全画面ビューアーを開く"
                    >
                      <img
                        src="/crosspost_system_infographic.svg"
                        alt="CrossPost Web Studio 画面説明図"
                        className="w-full h-auto object-contain block hover:brightness-105 transition duration-200"
                      />
                      <div className="absolute bottom-3 right-3 pointer-events-none opacity-0 group-hover:opacity-100 transition duration-200 bg-slate-950/80 backdrop-blur-xs px-2.5 py-1 rounded-md text-[11px] text-slate-300 border border-slate-700">
                        🔍 クリックして全画面で拡大
                      </div>
                    </div>

                    {/* 図解の日本語ガイド一覧 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                        <span className="font-bold text-sky-400 flex items-center gap-1.5">
                          📱 メイン投稿エディタ画面（中央）
                        </span>
                        <p className="text-slate-400 leading-relaxed text-[11px]">
                          左ペインの投稿本文・AIアシスト・ハッシュタグ候補・Threadsトピックタグ、右ペインのリアルタイムプレビュー（Bluesky / Threads）が常時連動。文字数上限に応じた自動ツリー分割をリアルタイムにシミュレートします。
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                        <span className="font-bold text-sky-400 flex items-center gap-1.5">
                          🎛️ ヘッダーナビゲーション＆連携ステータス（上部）
                        </span>
                        <p className="text-slate-400 leading-relaxed text-[11px]">
                          ヘッダー上部から各SNS（Bluesky / Threads）の接続ステータス確認、分析・データ管理、使い方ガイド、予約カレンダー、投稿履歴、設定モーダルをワンクリックで素早く呼び出せます。
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                        <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                          📁 サーバー登録情報 ＆ API設定（左側）
                        </span>
                        <p className="text-slate-400 leading-relaxed text-[11px]">
                          /data/account_vault.json によるアカウント永続化、他端末移行用の暗号化ダウンロード（未連携時非活性ガード搭載）、トークン有効期限の自動カウントダウンおよび更新を行います。
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                        <span className="font-bold text-purple-400 flex items-center gap-1.5">
                          📊 予約・分析・履歴管理（右側）
                        </span>
                        <p className="text-slate-400 leading-relaxed text-[11px]">
                          日時指定予約カレンダー（月間/週間）、過去ポストの検索・ワンクリック再投稿・スレッド返信先指定、プラットフォーム別比率の統計グラフや完全JSONバックアップ書き出し/マージ復元を提供します。
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: 投稿の流れ（ワークフロー） */}
              {activeTab === 'workflow' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <h3 className="text-sm font-bold text-slate-200">
                    🚀 快適なクロス投稿のための 4つのステップ
                  </h3>

                  {/* 現在タブで0件だが他タブにヒットがある場合 */}
                  {isSearching && filteredWorkflow.length === 0 && (
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center space-y-2">
                      <p className="text-xs text-slate-400">
                        ステップガイド内に「{searchQuery}」に一致する項目はありません。
                      </p>
                      <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
                        {filteredFeatures.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('features')}
                            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-accent-light text-xs font-bold transition cursor-pointer"
                          >
                            ✨ 実装機能一覧を見る ({filteredFeatures.length}件)
                          </button>
                        )}
                        {filteredFaq.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('faq')}
                            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-accent-light text-xs font-bold transition cursor-pointer"
                          >
                            ❓ FAQを見る ({filteredFaq.length}件)
                          </button>
                        )}
                        {filteredTips.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('tips')}
                            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-accent-light text-xs font-bold transition cursor-pointer"
                          >
                            💡 TIPSを見る ({filteredTips.length}件)
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {filteredWorkflow.map((item) => (
                      <div
                        key={item.step}
                        className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex gap-3.5 items-start"
                      >
                        <div className="w-7 h-7 rounded-lg btn-accent text-white font-bold flex items-center justify-center shrink-0 text-xs">
                          {item.step}
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-slate-100 text-sm">
                            {item.title}
                          </h4>
                          <p className="text-xs text-slate-400">{item.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: 実装機能一覧 */}
              {activeTab === 'features' && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  {/* 現在タブで0件だが他タブにヒットがある場合 */}
                  {isSearching && filteredFeatures.length === 0 && (
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center space-y-2">
                      <p className="text-xs text-slate-400">
                        機能一覧内に「{searchQuery}」に一致する機能はありません。
                      </p>
                      <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
                        {filteredFaq.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('faq')}
                            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-accent-light text-xs font-bold transition cursor-pointer"
                          >
                            ❓ FAQを見る ({filteredFaq.length}件)
                          </button>
                        )}
                        {filteredTips.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('tips')}
                            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-accent-light text-xs font-bold transition cursor-pointer"
                          >
                            💡 TIPSを見る ({filteredTips.length}件)
                          </button>
                        )}
                        {filteredWorkflow.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('workflow')}
                            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-accent-light text-xs font-bold transition cursor-pointer"
                          >
                            📋 投稿の流れを見る ({filteredWorkflow.length}件)
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {filteredFeatures.map((feat) => {
                    const isExpanded = isSearching || expandedFeatureId === feat.id;
                    const IconComponent = feat.icon;

                    return (
                      <div
                        key={feat.id}
                        className="bg-slate-950/70 border border-slate-800 rounded-xl overflow-hidden transition-all"
                      >
                        <div
                          className="p-3.5 flex items-center justify-between cursor-pointer select-none hover:bg-slate-900/50 transition"
                          onClick={() =>
                            setExpandedFeatureId(expandedFeatureId === feat.id ? null : feat.id)
                          }
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-lg bg-accent-subtle text-accent-light border border-accent flex items-center justify-center shrink-0">
                              <IconComponent className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-100 text-sm">
                                  {feat.title}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 line-clamp-1">{feat.summary}</p>
                            </div>
                          </div>

                          <ChevronRight
                            className={`w-4 h-4 text-slate-400 transition-transform ${
                              isExpanded ? 'rotate-90 text-accent-light' : ''
                            }`}
                          />
                        </div>

                        {isExpanded && (
                          <div className="px-4 pb-4 pt-1 border-t border-slate-800/60 space-y-2.5 bg-slate-900/40">
                            <ul className="space-y-1.5 text-xs text-slate-300">
                              {feat.details.map((detail, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-accent-light shrink-0 mt-0.5" />
                                  <span>{detail}</span>
                                </li>
                              ))}
                            </ul>

                            {feat.tips && (
                              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-accent-light flex items-center gap-2 font-medium">
                                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                                <span>TIPS: {feat.tips}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 4: よくある質問（FAQ） */}
              {activeTab === 'faq' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* 現在タブで0件だが他タブにヒットがある場合 */}
                  {isSearching && filteredFaq.length === 0 && (
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center space-y-2">
                      <p className="text-xs text-slate-400">
                        FAQ内に「{searchQuery}」に一致する質問はありません。
                      </p>
                      <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
                        {filteredTips.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('tips')}
                            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-accent-light text-xs font-bold transition cursor-pointer"
                          >
                            💡 TIPSを見る ({filteredTips.length}件)
                          </button>
                        )}
                        {filteredFeatures.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('features')}
                            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-accent-light text-xs font-bold transition cursor-pointer"
                          >
                            ✨ 実装機能一覧を見る ({filteredFeatures.length}件)
                          </button>
                        )}
                        {filteredWorkflow.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('workflow')}
                            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-accent-light text-xs font-bold transition cursor-pointer"
                          >
                            📋 投稿の流れを見る ({filteredWorkflow.length}件)
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* FAQ リスト */}
                  {filteredFaq.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-accent-light" />
                        よくある質問（FAQ）{isSearching && ` (${filteredFaq.length}件)`}
                      </h3>

                      {filteredFaq.map((faq) => (
                        <div
                          key={faq.id}
                          className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-1.5"
                        >
                          <h4 className="font-bold text-slate-100 text-xs sm:text-sm flex items-center gap-1.5">
                            <HelpCircle className="w-4 h-4 text-accent-light shrink-0" />
                            <span>Q. {faq.question}</span>
                          </h4>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            A. {faq.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: お役立ちTIPS */}
              {activeTab === 'tips' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* 現在タブで0件だが他タブにヒットがある場合 */}
                  {isSearching && filteredTips.length === 0 && (
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center space-y-2">
                      <p className="text-xs text-slate-400">
                        TIPS内に「{searchQuery}」に一致する項目はありません。
                      </p>
                      <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
                        {filteredFaq.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('faq')}
                            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-accent-light text-xs font-bold transition cursor-pointer"
                          >
                            ❓ FAQを見る ({filteredFaq.length}件)
                          </button>
                        )}
                        {filteredFeatures.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('features')}
                            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-accent-light text-xs font-bold transition cursor-pointer"
                          >
                            ✨ 実装機能一覧を見る ({filteredFeatures.length}件)
                          </button>
                        )}
                        {filteredWorkflow.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('workflow')}
                            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-accent-light text-xs font-bold transition cursor-pointer"
                          >
                            📋 投稿の流れを見る ({filteredWorkflow.length}件)
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 実用 TIPS・裏ワザ セクション */}
                  {filteredTips.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <h3 className="text-xs font-bold text-accent-light uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          実用 TIPS & 業務効率化テクニック{isSearching && ` (${filteredTips.length}件)`}
                        </h3>
                        <span className="text-[11px] text-slate-400 font-mono">全{filteredTips.length}件</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {filteredTips.map((tip) => (
                          <div
                            key={tip.id}
                            className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700/80 transition-colors flex flex-col gap-1.5"
                          >
                            <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5 leading-tight">
                              <span className="text-sm shrink-0">{tip.icon}</span>
                              <span>{tip.title}</span>
                            </div>
                            <p className="text-[11px] sm:text-xs text-slate-400 leading-normal">
                              {tip.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
