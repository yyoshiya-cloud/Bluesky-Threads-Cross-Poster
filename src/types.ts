export interface AttachedImage {
  id: string;
  name: string;
  size: number;
  dataUrl: string;
  previewUrl?: string; // ブラウザプレビュー用のBlob URL (URL.createObjectURL)
  file?: File; // クライアント保持の生ファイルオブジェクト (メモリ節約)
  mediaId?: string; // サーバー一時アップロード用ID
  alt?: string; // 画像・動画の代替テキスト (Alt text)
  mediaType?: 'image' | 'video'; // 'image' | 'video' (デフォルト 'image')
  mimeType?: string; // e.g. 'video/mp4', 'video/quicktime', 'image/jpeg'
  duration?: number; // 動画の再生時間 (秒)
  thumbnailUrl?: string; // 動画プレビュー用サムネイル
  publicUrl?: string; // Meta Threads API / 外部公開CDN用のダイレクトURL
  width?: number; // メディア幅
  height?: number; // メディア高さ
  uploadStatus?: 'idle' | 'uploading' | 'hosted' | 'failed'; // ホスティング状態
  uploadProgress?: number; // アップロード進捗パーセント (0〜100)
  uploadError?: string; // ホスティング失敗時のエラー詳細
}

export interface SplitThreadItem {
  index: number;
  total: number;
  text: string;
  charCount: number;
  weight: number;
  hasImages: boolean;
  images?: AttachedImage[];
}

export interface SavedBlueskyAccount {
  identifier: string;
  appPassword: string;
  serviceUrl?: string;
  handle: string;
  did?: string;
  savedAt: number;
  isEncrypted?: boolean; // AES-256-GCM 暗号化保管フラグ
}

export interface SavedThreadsAccount {
  userId: string;
  accessToken: string;
  username: string;
  savedAt: number;
  tokenExpiresAt?: number; // 有効期限タイムスタンプ(ms)
  tokenRefreshedAt?: number; // 最終更新タイムスタンプ(ms)
  expiresIn?: number; // 有効期間(秒) (通常 5184000 = 60日)
  isEncrypted?: boolean; // 暗号化保管フラグ
}

export interface SavedAccountVault {
  bluesky?: SavedBlueskyAccount;
  threads?: SavedThreadsAccount;
  vaultVersion?: number;
  encryptedAt?: number;
}

export interface ApiCredentials {
  // Bluesky 認証情報
  blueskyIdentifier: string; // handle (e.g. alice.bsky.social) or email
  blueskyAppPassword: string; // App password (e.g. xxxx-xxxx-xxxx-xxxx)
  blueskyServiceUrl?: string; // default https://bsky.social
  blueskyConnected: boolean;
  blueskyHandle: string;
  blueskyDid?: string;
  blueskyAccessJwt?: string;

  // Threads 認証情報
  threadsUserId: string;
  threadsAccessToken: string;
  threadsConnected: boolean;
  threadsUsername: string;
  threadsTokenExpiresAt?: number;
  threadsTokenRefreshedAt?: number;
  threadsTokenExpiresIn?: number;

  // デモモードフラグ
  isDemoMode?: boolean;
}

export interface PostEngagementStats {
  likes: number;
  reposts: number;
  replies?: number;
  quotes?: number;
  views?: number;
  updatedAt?: number;
}

export interface ReplyTargetInfo {
  platform: 'Bluesky' | 'Threads';
  urlOrId: string;
  resolvedId?: string; // Bluesky: atUri, Threads: mediaId
  cid?: string; // Bluesky用 CID
  rootUri?: string; // Bluesky用 ツリー最上位URI
  rootCid?: string; // Bluesky用 ツリー最上位CID
  authorName?: string;
  authorHandle?: string;
  authorAvatar?: string;
  textExcerpt?: string;
  textSnippet?: string;
  permalink?: string;
  createdAt?: string | number;
  isOwnPost?: boolean;
  isOwnerMatch?: boolean;
  canReply?: boolean;
  error?: string;
  isDemoSkipped?: boolean; // デモ版のためノーチェック
  checkStatusMessage?: string; // 事前チェック結果メッセージ
  verifiedCanReply?: boolean; // Threads APIによる事前検証済フラグ
}

export interface ReplySettings {
  enabled: boolean;
  blueskyTargetUrl: string;
  threadsTargetUrl: string;
  blueskyResolved?: ReplyTargetInfo | null;
  threadsResolved?: ReplyTargetInfo | null;
}

export interface PostHistoryItem {
  id: string;
  timestamp: string;
  originalText: string;
  platforms: ('Bluesky' | 'Threads')[];
  blueskyPosts: string[];
  threadsPosts: string[];
  threadsTopic?: string; // Threads専用トピックタグ
  images: string[];
  attachedImages?: AttachedImage[];
  imageCount?: number; // 添付画像枚数 (動画を除外)
  videoCount?: number; // 添付動画本数
  status: 'success' | 'failed' | 'partial';
  blueskySuccess?: boolean;
  threadsSuccess?: boolean;
  blueskyUrls?: string[];
  threadsUrls?: string[];
  blueskyPostUris?: string[]; // at:// uri for fetching engagement
  threadsMediaIds?: string[]; // threads media id for fetching insights
  blueskyEngagement?: PostEngagementStats;
  threadsEngagement?: PostEngagementStats;
  engagementUpdatedAt?: number;
  isDemo?: boolean;
  errorMessage?: string;
  replySettings?: ReplySettings;
}

export interface DraftData {
  text: string;
  blueskyText?: string; // Bluesky専用個別テキスト
  threadsText?: string; // Threads専用個別テキスト
  customPlatformText?: boolean; // SNS別個別分岐モードがONかどうか
  images: AttachedImage[];
  postToBluesky: boolean;
  postToThreads: boolean;
  threadsTopic?: string; // Threads専用トピックタグ
  autoSplit: boolean;
  includeNumbering: boolean;
  lastSavedAt: number;
  replySettings?: ReplySettings;
}

export interface ToastMessage {
  id: string;
  type: 'error' | 'success' | 'warning' | 'info';
  title: string;
  message: string;
  errorCode?: string | number;
  platform?: 'Bluesky' | 'Threads' | 'General';
  requiresReLogin?: boolean;
  duration?: number;
}

export type ThemeAccentId = 'sky' | 'indigo' | 'violet' | 'emerald' | 'amber' | 'rose' | 'cyan';

export interface ThemeAccentConfig {
  id: ThemeAccentId;
  name: string;
  nameJa: string;
  category: string;
  primaryColor: string; // hex
  hoverColor: string; // hex
  lightColor: string; // hex (for text/icons)
  subtleBg: string; // rgba or hex
  subtleBorder: string; // rgba or hex
  glowColor: string; // rgba
  gradient: string; // css gradient
  badgeBg: string;
  badgeText: string;
  sampleBg: string; // for UI selector preview
}

export interface ScheduledPostItem {
  id: string;
  createdAt: number;
  scheduledAt: number; // 実行予定のUNIXタイムスタンプ (ms)
  scheduledAtJstString: string; // 日本時間表示 (YYYY/MM/DD HH:mm:ss JST)
  text: string;
  blueskyText?: string; // Bluesky専用個別テキスト
  threadsText?: string; // Threads専用個別テキスト
  customPlatformText?: boolean; // SNS別個別分岐モードがONかどうか
  images: AttachedImage[];
  postToBluesky: boolean;
  postToThreads: boolean;
  threadsTopic?: string; // Threads専用トピックタグ
  autoSplit: boolean;
  includeNumbering: boolean;
  status: 'pending' | 'posting' | 'completed' | 'failed' | 'cancelled';
  error?: string;
  executedAt?: number;
  resultUrls?: {
    bluesky?: string[];
    threads?: string[];
  };
  replySettings?: ReplySettings;
}

// 投稿区分: 'all' (同時投稿) | 'bluesky' (Blueskyのみ) | 'threads' (Threadsのみ)
export type TargetPlatformCategory = 'both' | 'bluesky' | 'threads';

// 予約投稿クイック時刻プリセットのデータ構造
export interface QuickTimePreset {
  id: string;
  hour: number; // 0-23
  minute: number; // 0-59
  label?: string; // 任意ラベル (例: '朝の投稿', 'ランチタイム')
  icon?: string; // 絵文字アイコン (例: '☀️', '🍱', '☕', '🌇')
}

// 定型文・スニペット・テンプレートのデータ構造
export type SnippetCategory = 'all' | 'greeting' | 'announcement' | 'blog' | 'dev' | 'signature' | 'custom';

export interface SnippetItem {
  id: string;
  title: string;
  content: string;
  blueskyContent?: string; // Bluesky専用テキスト（省略時はcontent）
  threadsContent?: string; // Threads専用テキスト（省略時はcontent）
  threadsTopic?: string; // Threads専用トピックタグ
  category: 'greeting' | 'announcement' | 'blog' | 'dev' | 'signature' | 'custom';
  categoryName?: string;
  icon?: string;
  createdAt?: number;
  updatedAt?: number;
  useCount?: number;
  isPreset?: boolean;
}

// OGPプレビューカード情報
export interface OgpCardData {
  url: string;
  domain: string;
  title: string;
  description: string;
  image: string;
  loading?: boolean;
  error?: string;
}

// AI アシスト: スレッド分割レスポンス
export interface AiThreadSplitResult {
  posts: string[];
  formattedText: string;
  summary: string;
  postCount: number;
}

// AI アシスト: トーン調整レスポンス
export interface AiRewriteToneResult {
  blueskyText: string;
  threadsText: string;
  notes: string;
}

// AI アシスト: セーフティ・校正チェックの指摘事項
export interface AiSafetyIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'typo' | 'shadowban' | 'symbols' | 'policy';
  title: string;
  description: string;
  suggestion?: string;
  targetText?: string;
}

export interface AiLinkCheckItem {
  url: string;
  status: 'ok' | 'broken' | 'unreachable';
  statusCode?: number;
  error?: string;
}

// AI アシスト: セーフティチェックレスポンス
export interface AiSafetyCheckResult {
  safetyScore: number;
  issues: AiSafetyIssue[];
  improvedText: string;
  summary: string;
  linkChecks: AiLinkCheckItem[];
}

