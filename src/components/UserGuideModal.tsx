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
  const [activeTab, setActiveTab] = useState<'overview' | 'features' | 'workflow' | 'faq' | 'tips'>('overview');
  const [expandedFeatureId, setExpandedFeatureId] = useState<string | null>('feature-crosspost');

  if (!isOpen) return null;

  const features: FeatureSection[] = [
    {
      id: 'feature-crosspost',
      title: '🚀 Bluesky & Threads 同時マルチ投稿',
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
      id: 'feature-reply',
      title: '💬 スマート・リプライ投稿 & 所有権自動判定（Threads / Bluesky）',
      category: 'core',
      icon: MessageSquare,
      summary: 'BlueskyおよびThreadsの既存投稿URLを指定し、その投稿への返信（リプライ・ツリー追記）として配信できます。両SNSのAPI仕様と制限（Threadsの本人投稿限定・64bit数値Media ID必須、BlueskyのRoot/Parent構造）に対応したプラットフォーム自動判定、短縮共有リンク（/share/）自動解決、英数字コードの数値IDデコード、ハイブリッド2段階所有権判定、およびスレッド自動連鎖（チェーン）配信フローを完全解説します。',
      details: [
        '【プラットフォーム自動判定 ＆ Threads短縮共有リンク（/share/・/t/）の自動追跡】URL入力欄に貼り付けられたリンクからBluesky（bsky.app / at://）またはThreads（threads.com / threads.net / 数値ID）を即座に自動判別。特にThreads公式アプリの共有ボタンで生成される短縮リンク（https://www.threads.com/share/... や /t/...）は、サーバー側でHTTPリダイレクトを自動追跡して正規投稿URL（https://www.threads.net/@ユーザー名/post/...）へと自動解決・同期します。',
        '【Blueskyの自動判定・AT-URI解決 ＆ ツリー構造（Root/Parent）自動引き継ぎ】BlueskyのWeb URLからハンドル名とrkeyを抽出。ハンドル名の場合はAT Protocol（com.atproto.identity.resolveHandle）でDIDを解決し、app.bsky.feed.getPostThread で投稿本文・作成日時・著者情報を取得。対象が既にスレッド内の投稿である場合も、最上位の「root（URI/CID）」と直前の「parent（URI/CID）」を自動特定して引き継ぎ、正確な会話ツリーを形成します（Bluesky公式APIは他者の公開投稿への返信も許可されています）。',
        '【Threadsの英数字ショートコード ⇔ 64bit数値Media IDの自動デコード】ThreadsのURLに含まれる英数字コード（Base64URL形式、例: GiVw9OGGh）は、Meta Graph APIが要求する内部64bit数値ID（Media ID、例: 3456789...）と形式が異なります。本アプリは独自の高精度デコードエンジンにより、英数字コードから64bit数値Media IDを即座に復元。APIへの返信ID（reply_to_id）の形式不一致エラーを根本から防止します。',
        '【Threads API制限（本人投稿のみ許可）に対応したハイブリッド2段階所有権判定】Meta公式Threads API（threads_content_publish）の仕様上、外部アプリからの返信は「認証中のご自身のアカウントが投稿したスレッド」に限定され、他者投稿への返信はAPIで拒否されます。これを安全に満たすため、本アプリは2段階の判定を実施：①【第1段階（高速クライアント＆API照合）】URL内のユーザー名（@username）と連携中アカウントを瞬時に照合して他者投稿を即座にブロック。さらに /v1.0/me および /v1.0/me/threads（直近投稿一覧）や個別照会（GET /{media-id}）で所有権を突合。②【第2段階（Dry-Run プローブ検証）】投稿直後で一覧APIに未反映の場合でも、デコードMedia IDを用いてテスト用下書きコンテナ作成API（POST /threads、※公開処理は行わないためタイムラインには一切出ません）を安全に実行し、Meta APIがリプライ先として受け付けるかを事前に完全検証。',
        '【API制限を考慮したリプライ投稿フロー ＆ スレッド自動連鎖（チェーン）配信】実際の送信時はプラットフォーム間での誤爆を防ぐ「リプライガード」が稼働。Bluesky返信設定時はBlueskyのみにツリー返信し、同時投稿時のThreads側には通常新規投稿として配信（または逆も同様に分離）。さらに本文が文字数制限等で複数ポストに自動スレッド分割された場合、1件目の投稿が指定した返信先（Threadsのreply_to_id、Blueskyのparent/root）に正確に接続され、2件目以降は直前に公開された自身のポストIDへ自動で連鎖接続（チェーン）し、途切れることのない美しい連続ツリーを自動構築します。',
        '【操作支援機能（照合・事前チェック / 最近の投稿選択 / トレース可視化 / ワンクリック解除）】「照合・事前チェック」ボタンで送信前に返信先情報と本人確認ステータスバッジ（本人確認済 / 他者投稿・返信不可）を確認可能。また「🌀 自分のThreads投稿から選択」「🦋 自分のBluesky投稿から選択」から直近ポストをワンタップでセットできます。「Threads URL生成・パースのトレース詳細」パネルでは正規表現パース・デコード値・照合ログをステップごとに透明性高く確認でき、「✕ 解除」ボタンでいつでも通常新規投稿モードへ即座に戻せます。',
      ],
      tips: '過去の告知のツリー追記や連載スレッドの更新に最適です。Threadsのリプライは公式仕様によりご自身の投稿のみが対象となりますが、直近投稿からのワンクリック選択や「照合・事前チェック」を活用することで、APIエラーを起こさず確実にスレッドを延長できます。',
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
      id: 'feature-images',
      title: '🖼️ メディア添付（画像・動画対応・最大20件）・Alt属性・ドラッグ並び替え',
      category: 'editing',
      icon: ImageIcon,
      summary: '最大20件の画像・動画を添付可能。ドラッグ＆ドロップでの直感的な並び替えや全画面プレビュー、視覚障害者向けAlt設定に対応。',
      details: [
        'PNG, JPEG, WebP, GIFの各種画像形式に加え、MP4, MOV, WebM, M4V形式の動画添付とプレイヤー再生に対応。',
        'ドラッグ＆ドロップによる直感的な並び替え（一覧カードおよび拡大プレビューのサムネイル双方でスムーズに順序移動可能）。',
        '重複追加防止ガードにより、同一ファイルの二重添付を自動で防止。',
        '全画面拡大プレビューモーダル（「前へ」「次へ」ボタンや左右矢印キーでの画像送り、順序移動、削除に対応）。',
        '画像ごとに個別の代替テキスト（Alt属性 / 説明文）を入力・編集可能。',
        '【Bluesky】1投稿4枚制限に合わせ、5枚目以降の画像は4枚毎に自動でツリー（リプライ）へ分割。',
        '【Threads】1投稿あたり最大20枚のカルーセル（スワイプ表示）として一括配信。',
      ],
      tips: '画像や動画をクリックすると全画面プレビューが開き、キーボードの左右矢印キーで前後の画像をめくることができます。サムネイルをドラッグして投稿順を入れ替えることも可能です。',
    },
    {
      id: 'feature-splitter',
      title: '✂️ 任意区切り (---) & 長文自動スレッド分割',
      category: 'editing',
      icon: Scissors,
      summary: '文字数制限を超える長文を、自然な文末または指定した区切り位置でスレッド（ツリー）投稿に分割します。',
      details: [
        '【任意区切り】文章中の区切りたい場所に「---」を入力すると、その位置で確実に次の投稿へ分割。',
        '【自動分割】段落（空行）や句読点（。！？）など自然な日本語の切れ目で自動分割。',
        '【連番オプション】「(1/3)」「(2/3)」といったスレッド連番の自動付与をON/OFF可能。',
      ],
      tips: 'エディタ上部の「✂️ 区切り線を挿入」ボタンを押すと、カーソル位置に素早く --- が挿入されます。',
    },
    {
      id: 'feature-ai-assist',
      title: '✨ AIアシスト & 投稿リライト (Gemini 3.8 Flash / 高可用フォールバック搭載)',
      category: 'editing',
      icon: Sparkles,
      summary: '文脈を考慮したスレッド分割、プラットフォーム別のトーン自動調整、誤字脱字・シャドウバン規約リスク点検を搭載。一時的な混雑時も自動再試行＆代替モデルへ切り替わります。',
      details: [
        '【自然なスレッド分割】単純な文字数による機械的分割ではなく、文末・段落・起承転結を保ちながら読みやすい複数ポストに再構成。「(1/3)」などの連番付与や、Bluesky基準（300字）・Threads基準（500字）にも対応。',
        '【プラットフォーム別トーン自動調整】同じ告知内容から「Bluesky向け（落ち着いた開発者・知見オピニオン寄り、300字以内）」と「Threads向け（親しみやすい絵文字や共感フック、500字以内）」にワンクリックで文体を書き分け、各個別タブへ一括適用可能。',
        '【誤字脱字・NGワード・規約違反チェッカー】投稿本文中のURLリンク生存確認（HEAD/GETテスト）、誤字脱字の検出、過度な記号連続やシャドウバン制限を受けやすい表現を点検し、0〜100点の安全性スコアと改善案を提示。',
        '【高可用性・多重フォールバック】AIサーバーの一時的高負荷（503）やレート制限（429）を自動検知。指数バックオフによる自動再試行と、安定した代替モデル（gemini-flash-latest / gemini-3.1-flash-lite）へのシームレスな切替により、安定した動作を提供。',
      ],
      tips: 'エディタ上部の「✨ AIアシスト & 投稿リライト」ボタンからいつでも素早く実行できます。失敗時も画面上の「再試行」ボタンでワンクリック再実行が可能です。',
    },
    {
      id: 'feature-hashtag',
      title: '🏷️ AI＆トピック解析ハッシュタグ候補提案 & オリジナルタグ管理',
      category: 'editing',
      icon: Hash,
      summary: '入力テキストの内容をリアルタイム解析し、最適なハッシュタグを自動推薦・ストック管理します。',
      details: [
        '本文内のキーワード（技術、日常、AI、カフェ、写真、ビジネスなど）に応じた関連タグをリアルタイム推薦。',
        'ワンクリックで本文末尾にハッシュタグをスマート挿入（スペース・改行自動調整、重複防止）。',
        '「すべて追加」ボタンで候補タグを一括挿入可能。',
        '「トレンド・カテゴリ一覧」からジャンル別の定番タグを選択可能。',
        '独自のオリジナルタグを入力し「オリジナル」カテゴリーに保存・ストックしていつでもワンクリックで再利用可能（不要なタグの削除も可能）。',
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
        '【リアルタイムプレビュー連携】プレビュー上のThreadsスレッド投稿の「先頭」にトピックタグ（#トピック）が表示され、実際のタイムラインの見え方を忠実に再現。',
        '一度入力したトピックは候補リストとしてローカル保存され、次回以降ワンクリックで即座に呼び出し可能。',
        '候補トピックは右側の「✕」ボタンで自由に個別削除可能。「初期化」ボタンで定番トピック一覧に戻すこともできます。',
        '「#」が付いていても自動で認識・整形。リアルタイムプレビュー、予約投稿、下書き保存、投稿履歴にも完全連動。',
      ],
      tips: 'Threadsのみに反映されるため、Blueskyの文字数制限を消費せず、Threadsのトピック検索やレコメンドを最大活用できます。',
    },
    {
      id: 'feature-snippets',
      title: '📋 定型文・スニペット管理 & 例文テンプレート挿入',
      category: 'editing',
      icon: FileText,
      summary: 'よく使う挨拶文、署名、リンク集、定型ハッシュタグをスニペットとしてストックし、ワンクリックで本文に挿入できます。',
      details: [
        '「📋 定型文」ボタンからモーダルを開き、挨拶・告知・リンク集などのテンプレートを即座に本文へ挿入。',
        '独自の定型文をカテゴリ別（日常・告知・ブログ・技術など）に新規作成・編集・削除可能。',
        'エディタ右上の「📝 例文」ドロップダウンからは、長文コラムや任意分割テストなど多種多様なサンプル文章をワンクリックで読み込み可能。',
      ],
      tips: '署名や固定リンク、告知定型文を登録しておくと、日々の投稿作成時間を大幅に短縮できます。',
    },
    {
      id: 'feature-context-menu',
      title: '🖱️ マウス右クリック編集メニュー（貼り付け・コピー・切り取り・全選択）',
      category: 'editing',
      icon: MousePointerClick,
      summary: '設定メニューの各種APIキー入力欄やエディタで、マウス右クリックから即座に編集操作が可能。',
      details: [
        '設定画面の各入力欄（ユーザー名、アプリパスワード、アクセストークン等）で右クリックメニューが直接オープン。',
        '「📋 貼り付け (Paste)」「📄 コピー (Copy)」「✂️ 切り取り (Cut)」「✨ すべて選択」「🗑️ クリア」に対応。',
        'メイン投稿エディタやThreadsトピック入力欄、プリセット設定画面でも共通してスムーズに操作可能。',
      ],
      tips: 'ワンクリックで安全にクリップボードのトークンやパスワードを素早く貼り付けできます。',
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
        '【月間カレンダー】1ヶ月全体のカレンダーマスに、時刻・投稿区分（🚀同時 / 🦋BS / 🌀TH）・本文抜粋を色分けバッジ（待機中 / 完了 / エラー）で表示。日付を選択すると下部の詳細パネルにその日の予約一覧が展開されます。',
        '【月間カレンダーからの新規予約作成】「＋ 新規予約」ボタンや日付の選択から、指定した日付の新規予約ダイアログを起動。投稿先プラットフォーム（同時 / Bluesky / Threads）、予約日時（+5m / +10m / +15m / +30m / +1h / +1日加算付き）、本文、Threadsトピックタグを入力して即座に予約登録できます。',
        '【週間カレンダー】「横行表示（横スクロールタイムライン）」と「7列横並び表示」の2つのレイアウトに対応。前週・次週への移動や「今週へ」の即時ジャンプ、各曜日の配信カード（時刻・区分・本文・メディアバッジ）を直感的に確認。',
        '【カレンダー上での直接編集】予約本文の編集、Threadsトピックタグの編集、投稿区分の切替、予約日時の変更をカレンダー上で直接行い保存可能。',
        '【直感的なアクション】エディタへの復元（本文・画像等をエディタに読み込んで再編集）、今すぐ投稿（待機中の予約を即時実行）、予約解除（削除）に対応。',
        '【高度な絞り込み】「投稿区分（すべて / 🚀同時投稿 / 🦋Bluesky / 🌀Threads）」と「ステータス（すべて / 待機中 / 完了 / ⚠️エラー）」のフィルターで瞬時に目的の投稿を抽出。',
      ],
      tips: '月間カレンダーは月全体の配信バランスの把握や新規予約の追加に最適で、週間カレンダーは直近1週間の時系列スケジュール確認や日時の微調整に便利です。',
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
      id: 'feature-draft',
      title: '💾 自動下書き保存 & 投稿履歴管理',
      category: 'core',
      icon: Save,
      summary: '入力中の文章や設定を自動でローカル保存し、過去の投稿履歴も一覧・再利用できます。',
      details: [
        'キー入力と同時にsessionStorageに自動一時保存（誤ってリロードしても即時復元）。',
        '投稿した内容は「投稿履歴」に画像やステータス、投稿先URLと共に永続記録。',
        '過去の投稿履歴から「エディタにコピーして再投稿」が可能。',
      ],
    },
    {
      id: 'feature-analytics',
      title: '📊 簡易エンゲージメント分析・リアクション比較 & CSV/JSONデータエクスポート',
      category: 'core',
      icon: BarChart3,
      summary: '投稿履歴から各ポストのいいね数・リポスト数を一覧で比較し、どちらのSNSで反響が高かったかを即座に分析。全履歴と予約データのCSV/JSONエクスポート・バックアップ復元にも対応。',
      details: [
        '【エンゲージメント比較・リアクション分析】BlueskyとThreadsの「いいね数」「リポスト数」「合計リアクション数」をカード形式で可視化。「🦋 Blueskyで大好評」「🌀 Threadsで大好評」といった比較インサイトバッジを自動判定。',
        '【最新リアクションの一括/個別取得】ヘッダーやモーダル内の「最新リアクションを取得」ボタンで、各SNSのAPIから最新のエンゲージメント数を一括同期（DEMOモードでもリアルなシミュレーション値を提供）。',
        '【ソート・絞り込みフィルター】「反響が大きい順」「いいね数順」「リポスト数順」「SNS間差が大きい順」「投稿日時順」や、キーワード・投稿先SNSによる柔軟な絞り込みが可能。',
        '【CSV / JSONエクスポート & バックアップ復元】過去の投稿履歴CSV（文字コードUTF-8 BOM付き、Excel対応）、予約投稿CSV、およびアプリ全体の完全バックアップJSON（履歴＋予約リスト）のワンクリック書き出し＆安全な復元（上書き/マージ）に対応。',
      ],
      tips: 'ヘッダーの「📊 分析・データ」ボタンまたは履歴モーダル内の「📊 エンゲージメント分析」からいつでもアクセスできます。定期的なCSVバックアップにより大切な投稿データを手元に保存できます。',
    },
    {
      id: 'feature-security',
      title: '🔒 暗号化ローカル保管 & 🎯 初期DEMOモード・自動クリーンアップ',
      category: 'account',
      icon: Shield,
      summary: '認証情報はブラウザ内のみで安全に管理。初期状態はDEMOモードで安全にお試し可能。LIVE移行時や起動時の自動クリーンアップで常にクリーンな状態を維持します。',
      details: [
        '初期状態ではデモ認証が設定されており、APIキーやパスワードの入力不要で安全にシミュレーション投稿が可能。',
        '【LIVEモード切替時・アプリ起動時の自動クリーンアップ】LIVE（本番）モードへの切り替え時やアプリ起動時に、古いDEMOモードで作成されたシミュレーション予約投稿、ダミー履歴データ、通信エラーログ、リプライ残留設定、一時下書きキャッシュを自動的に完全クリーンアップ。常に混入や誤爆のないクリーンな初期状態から安全に投稿作業を開始できます。',
        '外部サーバーにパスワードを送信せず、ブラウザ内のみで暗号化して安全に管理。',
        'ブラウザのログアウトやワンクリックでの保管情報消去に対応。',
      ],
      tips: 'DEMOモード中は実際のSNSへの送信は行われないため、文章の長さや画像のレイアウトを自由にテストできます。本番アカウントへの切替時は自動クリーンアップが働くため、テスト投稿データが本番環境に残る心配はありません。',
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
    },
  ];

  const overviewCards: OverviewCard[] = [
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
      id: 'ov-images',
      icon: ImageIcon,
      title: '🖼️ 画像・動画添付 & 直感ドラッグ並び替え',
      description: '最大20件の画像・動画（MP4等）を添付可能。ドラッグ＆ドロップでの直感的な並び替えや全画面拡大プレビューに対応。',
    },
    {
      id: 'ov-splitter',
      icon: Scissors,
      title: '✂️ 任意区切り (---) & 自動スレッド分割',
      description: '文章中に --- を挟むだけで好きな位置でスレッドを分割。文字数制限を超えても自然な文末で自動的にツリー（スレッド）化します。',
    },
    {
      id: 'ov-topics',
      icon: Tag,
      title: '🌀 Threadsトピック & ハッシュタグ提案',
      description: 'Threadsの全分割投稿に公式トピックタグを一括適用。AI・キーワード解析によるタグ提案やオリジナルタグの保存も可能。',
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* ヘッダー */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent-subtle text-accent-light border border-accent flex items-center justify-center shadow-sm">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-100">
                  CrossPost Web Studio 使い方 & 機能ガイド
                </h2>
                <span className="badge-accent px-2 py-0.5 rounded-full text-[10px] font-bold">
                  最新版ドキュメント
                </span>
              </div>
              <p className="text-xs text-slate-400">
                実装されている全機能の詳細と、快適なSNSクロス投稿のためのステップガイド
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
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
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-300 text-xs sm:text-sm leading-relaxed">
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
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-accent-light uppercase tracking-wider px-1 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        実用 TIPS & 業務効率化テクニック{isSearching && ` (${filteredTips.length}件)`}
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {filteredTips.map((tip) => (
                          <div
                            key={tip.id}
                            className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1.5"
                          >
                            <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                              <span className="text-base">{tip.icon}</span>
                              <span>{tip.title}</span>
                            </div>
                            <p className="text-xs text-slate-400 leading-relaxed">
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

        {/* フッター */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="text-xs text-accent-light hover:underline font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>⚙️ アカウント設定を開く</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl btn-accent text-white text-xs font-bold transition cursor-pointer shadow-sm"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
