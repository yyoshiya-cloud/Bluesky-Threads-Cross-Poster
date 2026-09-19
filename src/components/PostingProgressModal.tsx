import React, { useEffect, useState, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  CheckCircle2,
  Loader2,
  Share2,
  Sparkles,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Settings,
  RefreshCw,
  Film,
  Bug,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ShieldAlert,
  UploadCloud,
  Send,
  Terminal,
  Activity,
  Download,
  Ban,
  X,
} from 'lucide-react';
import { ApiCredentials, AttachedImage } from '../types';
import { sendBlueskyPost, sendThreadsPost, checkIsDemoCredentials, uploadMediaItem, abortableWait } from '../utils/postApi';
import { validateMediaForPosting } from '../utils/mediaValidation';
import { VideoSpecsModal } from './VideoSpecsModal';
import { formatToJstDetailedString, downloadTextFile } from '../utils/commErrorLogger';
import { getBrowserSummaryString } from '../utils/browserDetector';

export type DiagnosticStage = 'validation' | 'auth' | 'media_upload' | 'api_request' | 'network';

export interface StageDiagnostic {
  platform: 'Bluesky' | 'Threads' | 'General';
  stage: DiagnosticStage;
  stageNameJa: string;
  status: 'success' | 'error' | 'running' | 'idle';
  summary: string;
  rootCause: string;
  actionableStep: string;
  errorCode?: string | number;
  rawError?: string;
  timestamp: string;
}

interface PostingProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentials: ApiCredentials;
  postToBluesky: boolean;
  postToThreads: boolean;
  blueskyPosts: string[];
  threadsPosts: string[];
  threadsTopic?: string;
  images: AttachedImage[];
  onComplete: (result: {
    blueskySuccess: boolean;
    threadsSuccess: boolean;
    blueskyUrls: string[];
    threadsUrls: string[];
    isDemo: boolean;
    errorMessage?: string;
  }) => void;
  onOpenSettings: () => void;
  onUseDemoCredentials?: () => void;
  onApiError?: (error: {
    platform: 'Bluesky' | 'Threads';
    message: string;
    errorCode?: string | number;
    requiresReLogin?: boolean;
  }) => void;
}

interface LogEntry {
  text: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  detail?: string;
  link?: string;
}

/**
 * エラーメッセージとコンテキストから失敗段階・原因・対策を診断する分析エンジン
 */
function analyzePostingError(
  platform: 'Bluesky' | 'Threads' | 'General',
  errorMessage: string,
  errorCode?: string | number
): StageDiagnostic {
  const msg = errorMessage || '';
  const lower = msg.toLowerCase();
  const time = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date());

  // 0. ユーザー操作による中止
  if (lower.includes('abort') || lower.includes('中止') || lower.includes('キャンセル') || lower.includes('canceled') || lower.includes('cancelled')) {
    return {
      platform,
      stage: 'network',
      stageNameJa: 'ユーザー操作による処理中止',
      status: 'error',
      errorCode: errorCode || 'USER_ABORTED',
      summary: 'ユーザー操作により投稿処理が即座に中止されました',
      rootCause: '投稿処理の実行中にユーザーによって中止（キャンセル）ボタンが押されたため、通信・公開処理を停止しました。',
      actionableStep: '投稿内容や添付ファイルをご確認の上、準備ができたら再度「再試行」または「投稿する」を実行してください。',
      rawError: errorMessage,
      timestamp: time,
    };
  }

  // 1. バリデーション段階のエラー
  if (lower.includes('公式制限') || lower.includes('バリデーション') || lower.includes('仕様チェック')) {
    return {
      platform,
      stage: 'validation',
      stageNameJa: '事前仕様バリデーション',
      status: 'error',
      errorCode: errorCode || 'SPEC_VALIDATION_FAILED',
      summary: '添付メディアが公式の制限仕様に準拠していません',
      rootCause: '各SNSで規定されている動画の長さ・容量、画像枚数、またはファイル形式の制限を超過しています。',
      actionableStep: '動画はBluesky最大60秒・Threads最大5分、MP4形式に変換し、画像枚数（Blueskyは1投稿4枚まで）を調整してください。',
      rawError: errorMessage,
      timestamp: time,
    };
  }

  // 2. 認証・トークン段階のエラー
  const isAuthError =
    lower.includes('invalid identifier or password') ||
    lower.includes('cannot parse access token') ||
    lower.includes('invalid oauth access token') ||
    lower.includes('expiredtoken') ||
    lower.includes('authenticationrequired') ||
    lower.includes('code: 190') ||
    lower.includes('subcode: 463') ||
    lower.includes('subcode: 467') ||
    lower.includes('再ログイン') ||
    lower.includes('認証情報') ||
    lower.includes('oauth') ||
    lower.includes('session');

  if (isAuthError) {
    if (platform === 'Bluesky') {
      return {
        platform: 'Bluesky',
        stage: 'auth',
        stageNameJa: 'Bluesky セッション認証 (createSession)',
        status: 'error',
        errorCode: errorCode || 'AUTH_INVALID_CREDENTIALS',
        summary: 'ハンドル名またはアプリパスワードが正しくありません',
        rootCause: '通常のログインパスワードが入力されているか、ハンドル名にドメイン（例: .bsky.social）が含まれていない可能性があります。',
        actionableStep: '公式Blueskyの「設定」→「プライバシーとセキュリティ」→「アプリパスワード」で専用パスワードを新規作成し、設定画面に再入力してください。',
        rawError: errorMessage,
        timestamp: time,
      };
    } else {
      return {
        platform: 'Threads',
        stage: 'auth',
        stageNameJa: 'Threads トークン認証 & スコープ検証',
        status: 'error',
        errorCode: errorCode || 'OAUTH_TOKEN_EXPIRED_OR_INVALID',
        summary: 'Threadsアクセストークンが無効または有効期限切れです',
        rootCause: 'トークンが失効しているか、投稿に必要な threads_content_publish 権限が付与されていない可能性があります。',
        actionableStep: 'Meta for DevelopersでLong-Livedアクセストークンを再取得し、設定画面から更新してください。',
        rawError: errorMessage,
        timestamp: time,
      };
    }
  }

  // 3. メディアアップロード・トランスコード処理段階のエラー
  const isMediaUploadError =
    lower.includes('カルーセルアイテム') ||
    lower.includes('is_carousel_item') ||
    lower.includes('単一メディアコンテナ') ||
    lower.includes('uploadblueskyvideo') ||
    lower.includes('uploadblob') ||
    lower.includes('blobtoolarge') ||
    lower.includes('getjobstatus') ||
    lower.includes('aspect ratio') ||
    lower.includes('dimension') ||
    lower.includes('range') ||
    lower.includes('code: 2') ||
    lower.includes('code: 36001') ||
    lower.includes('code: 36002') ||
    lower.includes('code: 36003') ||
    lower.includes('動画「') ||
    lower.includes('本体ファイルが見つかりません') ||
    lower.includes('トランスコード');

  if (isMediaUploadError) {
    if (platform === 'Bluesky') {
      return {
        platform: 'Bluesky',
        stage: 'media_upload',
        stageNameJa: 'Bluesky メディアアップロード (video.bsky.app / uploadBlob)',
        status: 'error',
        errorCode: errorCode || 'BLUESKY_MEDIA_UPLOAD_FAILED',
        summary: 'Bluesky動画・画像サーバーへのバイナリ送信またはエンコード処理でエラーが発生しました',
        rootCause: '動画サイズ（50MB上限）の超過、一時的なXRPC動画サービスの混雑、またはファイル参照の切れが考えられます。',
        actionableStep: '動画がMP4/MOV形式で50MB以下であることを確認し、一度動画を削除して再添付した上で再試行してください。',
        rawError: errorMessage,
        timestamp: time,
      };
    } else {
      return {
        platform: 'Threads',
        stage: 'media_upload',
        stageNameJa: 'Threads メディアコンテナ作成 & Metaクローラー取得 (Graph API)',
        status: 'error',
        errorCode: errorCode || 'THREADS_MEDIA_CONTAINER_FAILED',
        summary: 'Threadsメディアコンテナの作成またはMeta側での素材取得に失敗しました',
        rootCause: 'Meta Graph APIへの短時間同時リクエスト（Code 2）、アスペクト比の制限（1.91:1〜4:5）、またはMetaクローラーの外部素材ダウンロード待機タイムアウトが原因です。',
        actionableStep: '自動リトライ機能とRange配信対応により対策済みですが、失敗が続く場合は「デモ設定で動作テスト」または画像を数枚減らして再試行してください。',
        rawError: errorMessage,
        timestamp: time,
      };
    }
  }

  // 4. 投稿APIリクエスト・公開段階のエラー
  const isPublishError =
    lower.includes('createrecord') ||
    lower.includes('duplicatecreate') ||
    lower.includes('threads_publish') ||
    lower.includes('親コンテナ') ||
    lower.includes('テキストコンテナ') ||
    lower.includes('公開api') ||
    lower.includes('code 24') ||
    lower.includes('subcode 4279009') ||
    lower.includes('reply_to_id');

  if (isPublishError) {
    if (platform === 'Bluesky') {
      return {
        platform: 'Bluesky',
        stage: 'api_request',
        stageNameJa: 'Bluesky レコード作成 (com.atproto.repo.createRecord)',
        status: 'error',
        errorCode: errorCode || 'BLUESKY_RECORD_CREATE_FAILED',
        summary: 'Blueskyへのポスト（投稿レコード）書き込みに失敗しました',
        rootCause: lower.includes('duplicate')
          ? '直近に全く同一のテキスト・添付内容が送信されたため、重複投稿防止ガードにより拒否されました。'
          : 'PDSリポジトリへの書き込みリクエスト中にエラーが発生しました。',
        actionableStep: '本文の末尾に文字を追加して内容を変更するか、数分待ってから再試行してください。',
        rawError: errorMessage,
        timestamp: time,
      };
    } else {
      return {
        platform: 'Threads',
        stage: 'api_request',
        stageNameJa: 'Threads コンテナ公開リクエスト (threads_publish)',
        status: 'error',
        errorCode: errorCode || 'THREADS_PUBLISH_FAILED',
        summary: 'Threadsへの親コンテナ公開（Publish）処理に失敗しました',
        rootCause: 'Meta側でメディアの最終エンコード準備が完了する前に公開リクエストが送信されたか、レートリミットに達した可能性があります。',
        actionableStep: '数秒〜数分待ってから「再試行」を押すか、投稿テキストを調整して送信してください。',
        rawError: errorMessage,
        timestamp: time,
      };
    }
  }

  // 5. ネットワーク・通信エラー
  return {
    platform,
    stage: 'network',
    stageNameJa: 'ネットワーク・サーバー間通信',
    status: 'error',
    errorCode: errorCode || 'NETWORK_CONNECTION_ERROR',
    summary: 'SNSのAPIサーバーまたはローカルプロキシとの通信に失敗しました',
    rootCause: lower.includes('413')
      ? '添付ファイルの合計サイズがサーバーの受信用量上限を超えています。'
      : lower.includes('504') || lower.includes('timeout')
      ? '通信相手のAPIサーバーからの応答がタイムアウトしました。'
      : 'インターネット接続の切断、またはCORS/リクエストタイムアウトが発生しました。',
    actionableStep: 'ネットワーク環境を確認の上、大容量メディアの添付時はファイルサイズを軽量化して再試行してください。',
    rawError: errorMessage,
    timestamp: time,
  };
}

export const PostingProgressModal: React.FC<PostingProgressModalProps> = ({
  isOpen,
  onClose,
  credentials,
  postToBluesky,
  postToThreads,
  blueskyPosts,
  threadsPosts,
  threadsTopic,
  images,
  onComplete,
  onOpenSettings,
  onUseDemoCredentials,
  onApiError,
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isDemoPosting, setIsDemoPosting] = useState(false);
  const [blueskyLinks, setBlueskyLinks] = useState<string[]>([]);
  const [threadsLinks, setThreadsLinks] = useState<string[]>([]);
  const [isVideoSpecsModalOpen, setIsVideoSpecsModalOpen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // デバッグ・診断情報ステート
  const [diagnostics, setDiagnostics] = useState<StageDiagnostic[]>([]);
  const [showDebugRawLogs, setShowDebugRawLogs] = useState(false);
  const [copiedDebug, setCopiedDebug] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 動画アイテムの判定と情報取得
  const videoItems = images.filter(
    (img) =>
      img.mediaType === 'video' ||
      Boolean(img.mimeType?.startsWith('video/')) ||
      (typeof img.dataUrl === 'string' && img.dataUrl.startsWith('data:video'))
  );
  const hasVideo = videoItems.length > 0;
  const primaryVideo = videoItems[0] || null;

  // 経過秒数に応じた動的進捗メッセージ
  const getDynamicVideoStatus = (seconds: number) => {
    if (seconds < 4) {
      return '動画ファイルをAPIサーバーへストリーム転送しています...';
    }
    if (seconds < 12) {
      return 'Bluesky公式動画サービス および Meta Threads APIへ高速アップロード中...';
    }
    if (seconds < 25) {
      return '各SNSサーバー側で動画のトランスコード（解像度・ビットレート最適化）を実行中...';
    }
    return '動画エンコードの完了を確認中... もう間もなく投稿が公開されます。このままお待ちください。';
  };

  // 投稿中の経過時間タイマー
  useEffect(() => {
    let timer: any = null;
    if (isPosting) {
      setElapsedSeconds(0);
      timer = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPosting]);

  // ユーザーによる即時中止（キャンセル）処理
  const handleCancelPosting = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsCancelled(true);
    setIsPosting(false);
    setIsFinished(true);
    setHasError(true);

    const time = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date());

    const cancelDiag: StageDiagnostic = {
      platform: 'General',
      stage: 'network',
      stageNameJa: 'ユーザー操作による処理中止',
      status: 'error',
      errorCode: 'USER_CANCELLED',
      summary: 'ユーザー操作により投稿処理が即座に中止されました',
      rootCause: '投稿処理の実行中に「投稿を中止」ボタンが押されたため、通信・メディア転送・公開処理を停止しました。',
      actionableStep: '投稿内容や添付ファイルをご確認の上、準備ができたら再度「再試行」または「投稿する」を実行してください。',
      rawError: 'DOMException: The user aborted a request.',
      timestamp: time,
    };

    setDiagnostics((prev) => [cancelDiag, ...prev]);
    setLogs((prev) => [
      ...prev.map((l) => (l.status === 'loading' ? { ...l, status: 'error' as const, detail: '中止されました' } : l)),
      {
        text: '⛔ 投稿処理がユーザー操作により中止されました',
        status: 'error',
        detail: '以降のAPIリクエストおよびメディアアップロードを停止しました',
      },
    ]);
  };

  const startPosting = async () => {
    // 既存の通信があれば中断
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const signal = abortController.signal;

    setIsCancelled(false);
    setIsPosting(true);
    setIsFinished(false);
    setHasError(false);
    setBlueskyLinks([]);
    setThreadsLinks([]);
    setDiagnostics([]);
    setShowDebugRawLogs(false);
    setElapsedSeconds(0);

    const { blueskyIsDemo, threadsIsDemo } = checkIsDemoCredentials(credentials);
    const demoActive = Boolean(credentials.isDemoMode) || (postToBluesky && blueskyIsDemo) || (postToThreads && threadsIsDemo);
    setIsDemoPosting(demoActive);

    // デモ投稿時は安全なデモ用クレデンシャルを適用
    const effectiveCredentials: ApiCredentials = demoActive
      ? {
          ...credentials,
          blueskyIdentifier: credentials.blueskyIdentifier || 'demo-creator.bsky.social',
          blueskyAppPassword: credentials.blueskyAppPassword || 'demo-pass-xxxx-xxxx-xxxx',
          blueskyHandle: credentials.blueskyHandle || 'demo-creator.bsky.social',
          threadsUserId: credentials.threadsUserId || 'threads_user_demo_10293',
          threadsAccessToken: credentials.threadsAccessToken || 'TH_LONG_LIVED_TOKEN_DEMO_91238',
          threadsUsername: credentials.threadsUsername || '@Demo_Threads_Official',
          isDemoMode: true,
        }
      : credentials;

    // 事前の公式仕様バリデーション
    if (images.length > 0 && !demoActive) {
      const mediaValidation = validateMediaForPosting(
        { bluesky: postToBluesky, threads: postToThreads },
        images
      );

      if (!mediaValidation.isValid) {
        const valErrorMsg = `【公式制限エラー】${mediaValidation.errors.join(' / ')}`;
        setLogs([
          {
            text: '🚫 添付メディアの公式仕様チェック',
            status: 'error',
            detail: valErrorMsg,
          },
        ]);
        
        const diag = analyzePostingError(postToBluesky ? 'Bluesky' : 'Threads', valErrorMsg, 'VALIDATION_FAILED');
        setDiagnostics([diag]);
        setHasError(true);
        setIsPosting(false);
        setIsFinished(true);
        if (onApiError) {
          onApiError({
            platform: postToBluesky ? 'Bluesky' : 'Threads',
            message: mediaValidation.errors.join('\n'),
          });
        }
        return;
      }
    }

    const initialLogs: LogEntry[] = [];
    if (demoActive) {
      initialLogs.push({
        text: 'デモ用アカウントでシミュレーション投稿を実行します',
        status: 'pending',
        detail: '※実際のアカウントへ投稿するには「API・認証設定」で本物のキーを入力してください。',
      });
    }

    let mediaLogIdx = -1;
    if (images.length > 0) {
      mediaLogIdx = initialLogs.length;
      initialLogs.push({
        text: hasVideo
          ? `📹 動画メディア (${videoItems.length}件${images.length > videoItems.length ? ` / 他画像${images.length - videoItems.length}枚` : ''}) の準備・ストリーム転送`
          : `📷 添付画像 (${images.length}枚) の準備・フォーマット処理`,
        status: 'pending',
      });
    }

    let blueskyLogIdx = -1;
    if (postToBluesky) {
      blueskyLogIdx = initialLogs.length;
      const bPostCount = Math.max(
        blueskyPosts.length,
        Math.ceil((images.length || 0) / 4)
      );
      initialLogs.push({
        text: hasVideo
          ? `🦋 Bluesky 公式動画サービス (video.bsky.app) へのアップロード & 投稿`
          : `🦋 Bluesky へのスレッド投稿 (${bPostCount}件)`,
        status: 'pending',
      });
    }

    let threadsLogIdx = -1;
    if (postToThreads) {
      threadsLogIdx = initialLogs.length;
      initialLogs.push({
        text: hasVideo
          ? `🌀 Threads (Meta Graph API) 動画コンテナ作成 & 投稿${threadsTopic ? ` [トピック: #${threadsTopic}]` : ''}`
          : `🌀 Threads へのスレッド投稿 (${threadsPosts.length}件)${threadsTopic ? ` [トピック: #${threadsTopic}]` : ''}`,
        status: 'pending',
      });
    }

    setLogs(initialLogs);

    const updateCurrentLog = (idx: number, patch: Partial<LogEntry>) => {
      if (idx < 0) return;
      setLogs((prev) =>
        prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
      );
    };

    if (demoActive) {
      updateCurrentLog(0, { status: 'success' });
    }

    if (signal.aborted) {
      return;
    }

    // 1. メディア（動画・画像）事前ストリームアップロード
    if (images.length > 0 && mediaLogIdx !== -1) {
      updateCurrentLog(mediaLogIdx, {
        status: 'loading',
        detail: hasVideo
          ? `動画ファイル（${primaryVideo?.name || '添付動画'}, ${(primaryVideo?.size ? (primaryVideo.size / 1024 / 1024).toFixed(1) + 'MB' : '大容量')}）をAPIサーバーへストリーム送信中...`
          : '画像ファイルをアップロード準備中...',
      });

      // 全メディアの事前アップロードを並列実行してmediaIdをキャッシュ
      try {
        await Promise.all(
          images.map(async (img) => {
            if (signal.aborted) return;
            try {
              await uploadMediaItem(img, signal);
            } catch (upErr) {
              if (signal.aborted) throw upErr;
              console.warn('Pre-upload notice:', upErr);
            }
          })
        );
      } catch (upAllErr: any) {
        if (signal.aborted) {
          return;
        }
      }

      if (signal.aborted) return;

      const imageCount = images.filter(
        (img) => img.mediaType !== 'video' && !img.mimeType?.startsWith('video/')
      ).length;
      const videoCount = videoItems.length;

      let mediaDetail = '';
      if (videoCount > 0 && imageCount > 0) {
        mediaDetail = `画像${imageCount}枚・動画${videoCount}本をストリーム転送完了 (並列配信準備完了)`;
      } else if (videoCount > 0) {
        mediaDetail = `動画${videoCount}本をストリーム転送完了 (Bluesky & Threads への並列アップロード準備完了)`;
      } else if (imageCount > 4) {
        mediaDetail = `画像${imageCount}枚を準備完了 (Bluesky: 4枚毎に${Math.ceil(imageCount / 4)}件へ分割 / Threads: カルーセル${imageCount}枚)`;
      } else {
        mediaDetail = `画像${imageCount}枚を準備完了`;
      }

      updateCurrentLog(mediaLogIdx, {
        status: 'success',
        detail: mediaDetail,
      });
    }

    if (signal.aborted) return;

    let bSuccess = false;
    let bUrls: string[] = [];
    let bError: string | undefined;

    let tSuccess = false;
    let tUrls: string[] = [];
    let tError: string | undefined;

    const collectedDiagnostics: StageDiagnostic[] = [];

    // Bluesky 投稿実行関数
    const executeBlueskyTask = async () => {
      if (!postToBluesky || blueskyLogIdx === -1 || signal.aborted) return;
      updateCurrentLog(blueskyLogIdx, {
        status: 'loading',
        detail: hasVideo
          ? 'Bluesky公式動画サービス (video.bsky.app) へアップロード中 & トランスコード待機中...'
          : 'Bluesky APIと通信中...',
      });

      try {
        const result = await sendBlueskyPost(effectiveCredentials, blueskyPosts, images, signal);
        if (signal.aborted) return;
        if (result.success) {
          bSuccess = true;
          bUrls = result.urls || [];
          setBlueskyLinks(bUrls);
          updateCurrentLog(blueskyLogIdx, {
            status: 'success',
            detail: result.message || `${bUrls.length}件の投稿が完了しました`,
            link: bUrls[0],
          });
        } else {
          bError = result.error || 'Bluesky投稿に失敗しました';
          updateCurrentLog(blueskyLogIdx, {
            status: 'error',
            detail: bError,
          });

          // エラーコード抽出
          const codeMatch = bError.match(/\[Bluesky APIエラー:\s*([^\]]+)\]/i);
          const rawCode = result.errorCode || (codeMatch ? codeMatch[1].trim() : undefined);
          const diag = analyzePostingError('Bluesky', bError, rawCode);
          collectedDiagnostics.push(diag);

          const needsAuth = bError.includes('ExpiredToken') || bError.includes('AuthenticationRequired') || bError.includes('再ログイン');

          if (onApiError) {
            onApiError({
              platform: 'Bluesky',
              message: bError,
              errorCode: rawCode,
              requiresReLogin: needsAuth,
            });
          }
        }
      } catch (e: any) {
        if (signal.aborted) return;
        bError = e.message || '通信エラー';
        updateCurrentLog(blueskyLogIdx, {
          status: 'error',
          detail: bError,
        });
        const diag = analyzePostingError('Bluesky', bError, 'NETWORK_ERROR');
        collectedDiagnostics.push(diag);
        if (onApiError) {
          onApiError({
            platform: 'Bluesky',
            message: bError,
          });
        }
      }
    };

    // Threads 投稿実行関数
    const executeThreadsTask = async () => {
      if (!postToThreads || threadsLogIdx === -1 || signal.aborted) return;
      updateCurrentLog(threadsLogIdx, {
        status: 'loading',
        detail: hasVideo
          ? 'Meta Threads API 動画コンテナ作成 & エンコード完了待機中...'
          : 'Threads APIと通信中...',
      });

      try {
        const result = await sendThreadsPost(effectiveCredentials, threadsPosts, images, threadsTopic, signal);
        if (signal.aborted) return;
        if (result.success) {
          tSuccess = true;
          tUrls = result.urls || [];
          setThreadsLinks(tUrls);
          updateCurrentLog(threadsLogIdx, {
            status: 'success',
            detail: result.message || `${tUrls.length}件の投稿が公開されました`,
            link: tUrls[0],
          });
        } else {
          tError = result.error || 'Threads投稿に失敗しました';
          updateCurrentLog(threadsLogIdx, {
            status: 'error',
            detail: tError,
          });

          // エラーコード抽出
          const codeMatch = tError.match(/\[Threads (?:API|メディア).*?\(([^)]+)\)\]/i) || tError.match(/Code:\s*([0-9a-zA-Z_]+)/i);
          const rawCode = result.errorCode || (codeMatch ? codeMatch[1].trim() : undefined);
          const diag = analyzePostingError('Threads', tError, rawCode);
          collectedDiagnostics.push(diag);

          const needsAuth = tError.includes('再ログイン') || tError.includes('190') || tError.includes('expired') || tError.includes('session');

          if (onApiError) {
            onApiError({
              platform: 'Threads',
              message: tError,
              errorCode: rawCode,
              requiresReLogin: needsAuth,
            });
          }
        }
      } catch (e: any) {
        if (signal.aborted) return;
        tError = e.message || '通信エラー';
        updateCurrentLog(threadsLogIdx, {
          status: 'error',
          detail: tError,
        });
        const diag = analyzePostingError('Threads', tError, 'NETWORK_ERROR');
        collectedDiagnostics.push(diag);
        if (onApiError) {
          onApiError({
            platform: 'Threads',
            message: tError,
          });
        }
      }
    };

    // 2. 投稿実行タスクの調整
    // ※ 動画が添付された同時投稿の場合、両プラットフォームへ大容量動画を完全同時にストリームアップロードすると帯域が奪い合われ、
    // Meta側クローラーへのCDN提供がタイムアウトする原因になります。
    // そのためThreadsの外部CDN登録とコンテナ作成リクエストを先行（2.5秒差）させ、帯域競合を安全に回避します。
    if (hasVideo && postToBluesky && postToThreads) {
      const threadsPromise = executeThreadsTask();
      try {
        await abortableWait(2500, signal);
      } catch (waitErr) {
        // aborted
      }
      if (!signal.aborted) {
        const blueskyPromise = executeBlueskyTask();
        await Promise.all([threadsPromise, blueskyPromise]);
      } else {
        await threadsPromise;
      }
    } else {
      const postingTasks: Promise<void>[] = [];
      if (postToBluesky) postingTasks.push(executeBlueskyTask());
      if (postToThreads) postingTasks.push(executeThreadsTask());
      await Promise.all(postingTasks);
    }

    if (signal.aborted) {
      return;
    }

    setIsPosting(false);
    setIsFinished(true);

    const overallError = (postToBluesky && !bSuccess) || (postToThreads && !tSuccess);
    setHasError(overallError);
    setDiagnostics(collectedDiagnostics);

    if (!overallError) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }

    onComplete({
      blueskySuccess: bSuccess,
      threadsSuccess: tSuccess,
      blueskyUrls: bUrls,
      threadsUrls: tUrls,
      isDemo: demoActive,
      errorMessage: [bError, tError].filter(Boolean).join(' / '),
    });
  };

  useEffect(() => {
    if (isOpen) {
      startPosting();
    } else {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setIsPosting(false);
      setIsFinished(false);
      setHasError(false);
      setIsCancelled(false);
      setLogs([]);
      setDiagnostics([]);
      setShowDebugRawLogs(false);
      setCopiedDebug(false);
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isOpen]);

  // デバッグ情報のクリップボードコピー
  const handleCopyDebugInfo = () => {
    const jstNow = formatToJstDetailedString(Date.now());
    const browserSummary = getBrowserSummaryString();
    const debugText = [
      `=== CrossPost Web Studio 投稿デバッグ診断ログ ===`,
      `日時: ${jstNow} (日本時間 / JST-9)`,
      `利用ブラウザ: ${browserSummary}`,
      `Bluesky選択: ${postToBluesky ? 'YES' : 'NO'}, Threads選択: ${postToThreads ? 'YES' : 'NO'}`,
      `メディア添付数: ${images.length} (動画: ${videoItems.length}, 画像: ${images.length - videoItems.length})`,
      `DEMOモード: ${isDemoPosting ? 'YES' : 'NO'}`,
      ``,
      `--- 診断結果 (${diagnostics.length}件) ---`,
      ...diagnostics.map((d, i) => [
        `[#${i + 1}] プラットフォーム: ${d.platform}`,
        `  失敗段階: ${d.stageNameJa} (${d.stage})`,
        `  エラーコード: ${d.errorCode || 'N/A'}`,
        `  診断サマリー: ${d.summary}`,
        `  原因分析: ${d.rootCause}`,
        `  推奨アクション: ${d.actionableStep}`,
        `  生エラーログ: ${d.rawError || 'N/A'}`,
      ].join('\n')),
      ``,
      `--- 実行ログ詳細 ---`,
      ...logs.map((l) => `[${l.status.toUpperCase()}] ${l.text} -> ${l.detail || 'N/A'}`),
    ].join('\n');

    navigator.clipboard.writeText(debugText);
    setCopiedDebug(true);
    setTimeout(() => setCopiedDebug(false), 2500);
  };

  // 通信エラーログのテキストファイル (.log) ダウンロード (JST表記)
  const handleDownloadDebugInfo = () => {
    const jstNow = formatToJstDetailedString(Date.now());
    const browserSummary = getBrowserSummaryString();
    const separator = '='.repeat(84);
    const subSeparator = '-'.repeat(84);

    const lines = [
      separator,
      `  CrossPost Web Studio - 投稿通信エラー詳細診断ログ`,
      separator,
      `出力日時 (JST)    : ${jstNow}`,
      `利用ブラウザ      : ${browserSummary}`,
      `タイムゾーン      : Asia/Tokyo (日本時間 / JST-9: UTC+09:00)`,
      `Bluesky選択       : ${postToBluesky ? 'YES' : 'NO'}`,
      `Threads選択       : ${postToThreads ? 'YES' : 'NO'}`,
      `添付メディア数    : ${images.length} (動画: ${videoItems.length}本, 画像: ${images.length - videoItems.length}枚)`,
      `トピックタグ      : ${threadsTopic ? `#${threadsTopic}` : 'なし'}`,
      `DEMOモード        : ${isDemoPosting ? 'YES' : 'NO'}`,
      separator,
      '',
      `--- 診断結果 (${diagnostics.length}件) ---`,
      ...diagnostics.map((d, i) => [
        `【#${i + 1}】プラットフォーム: ${d.platform}`,
        `  失敗段階      : ${d.stageNameJa} (${d.stage})`,
        `  エラーコード  : ${d.errorCode || 'N/A'}`,
        `  診断サマリー  : ${d.summary}`,
        `  根本原因分析  : ${d.rootCause}`,
        `  推奨アクション: ${d.actionableStep}`,
        `  生エラーログ  : ${d.rawError || 'N/A'}`,
        subSeparator,
      ].join('\n')),
      '',
      `--- 実行ステップログ (${logs.length}件) ---`,
      ...logs.map((l) => `[${l.status.toUpperCase()}] ${l.text} -> ${l.detail || 'N/A'}`),
      '',
      separator,
      `※ 本ログファイルは不具合調査やサポート窓口への報告時にそのままお使いいただけます。`,
      separator,
    ];

    const now = new Date();
    const formatter = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '00';
    const filename = `crosspost-comm-error-${getPart('year')}${getPart('month')}${getPart('day')}-${getPart('hour')}${getPart('minute')}${getPart('second')}-JST.log`;

    downloadTextFile(lines.join('\n'), filename);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div
        id="posting-progress-modal"
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-5 my-auto max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-950 flex items-center justify-center text-[#0085ff] border border-[#0085ff]/30 shrink-0">
            {isCancelled ? (
              <Ban className="w-5 h-5 text-rose-400" />
            ) : isFinished && !hasError ? (
              <Sparkles className="w-5 h-5 text-amber-400" />
            ) : hasError ? (
              <XCircle className="w-5 h-5 text-rose-400" />
            ) : (
              <Share2 className="w-5 h-5 animate-pulse" />
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">
              {isCancelled
                ? '⛔ 投稿処理をユーザー操作により中止しました'
                : isFinished
                ? hasError
                  ? '⚠️ 投稿処理でエラーが発生しました'
                  : hasVideo
                    ? '🎉 Bluesky & Threads への動画投稿が完了しました！'
                    : '🎉 Bluesky & Threads への投稿が完了しました！'
                : hasVideo
                  ? '📹 動画アップロード & SNS同時投稿中...'
                  : '🚀 Bluesky & Threads に同時投稿中...'}
            </h3>
            <p className="text-xs text-slate-400">
              {isCancelled
                ? '送信処理およびAPI通信を即座に停止しました。再試行または内容を再編集できます。'
                : isFinished
                ? hasError
                  ? '失敗した処理段階と詳細な原因を自動診断しました。下記をご確認ください。'
                  : hasVideo
                    ? 'スレッドおよび動画が各プラットフォームで正常に公開されました。'
                    : 'スレッドと添付メディアが正常に送信されました。'
                : hasVideo
                  ? '動画のストリーム送信および各SNSサーバーでの公式トランスコード処理を実行しています'
                  : '各SNSのAPIサーバーと直接通信し、投稿を実行しています'}
            </p>
          </div>
        </div>

        {/* 投稿パイプライン段階ステッパー (Pipeline Stage Stepper) */}
        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Activity className="w-3.5 h-3.5 text-[#0085ff]" />
              <span>投稿パイプライン処理フロー</span>
            </span>
            <span>{isPosting ? '処理中...' : isFinished ? (hasError ? '一部中断' : '全段階完了') : '待機中'}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {/* Stage 1: 認証 */}
            {(() => {
              const hasAuthErr = diagnostics.some((d) => d.stage === 'auth');
              return (
                <div
                  className={`p-2 rounded-lg border flex flex-col items-center justify-center gap-1 transition ${
                    hasAuthErr
                      ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                      : isFinished
                      ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                      : isPosting
                      ? 'bg-sky-950/30 border-sky-800 text-sky-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-1 text-[11px] font-bold">
                    {hasAuthErr ? (
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>1. 認証検証</span>
                  </div>
                  <span className="text-[10px] opacity-80">
                    {hasAuthErr ? '❌ 認証失敗' : isFinished ? '✅ 検証完了' : 'トークン確認'}
                  </span>
                </div>
              );
            })()}

            {/* Stage 2: メディア処理 */}
            {(() => {
              const hasMediaErr = diagnostics.some((d) => d.stage === 'media_upload' || d.stage === 'validation');
              const hasMedia = images.length > 0;
              return (
                <div
                  className={`p-2 rounded-lg border flex flex-col items-center justify-center gap-1 transition ${
                    hasMediaErr
                      ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                      : isFinished && !hasMediaErr
                      ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                      : isPosting
                      ? 'bg-sky-950/30 border-sky-800 text-sky-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-1 text-[11px] font-bold">
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>2. メディア処理</span>
                  </div>
                  <span className="text-[10px] opacity-80">
                    {!hasMedia ? 'スキップ(テキストのみ)' : hasMediaErr ? '❌ 転送/変換エラー' : isFinished ? '✅ 準備完了' : 'アップロード中'}
                  </span>
                </div>
              );
            })()}

            {/* Stage 3: APIリクエスト・公開 */}
            {(() => {
              const hasApiErr = diagnostics.some((d) => d.stage === 'api_request' || d.stage === 'network');
              return (
                <div
                  className={`p-2 rounded-lg border flex flex-col items-center justify-center gap-1 transition ${
                    hasApiErr
                      ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                      : isFinished && !hasApiErr && !hasError
                      ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
                      : isPosting
                      ? 'bg-sky-950/30 border-sky-800 text-sky-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-1 text-[11px] font-bold">
                    <Send className="w-3.5 h-3.5" />
                    <span>3. 投稿・公開</span>
                  </div>
                  <span className="text-[10px] opacity-80">
                    {hasApiErr ? '❌ リクエスト失敗' : isFinished && !hasError ? '✅ 公開完了' : '送信処理'}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>

        {/* 動画投稿中の明確なステータス・進捗表示バナー */}
        {hasVideo && isPosting && (
          <div
            id="video-upload-in-progress-banner"
            className="p-4 rounded-xl bg-sky-950/40 border border-sky-600/40 text-xs text-sky-100 space-y-3 shadow-lg"
          >
            <div className="flex items-center justify-between gap-2 border-b border-sky-800/40 pb-2.5">
              <div className="flex items-center gap-2 font-bold text-sky-200">
                <Film className="w-4 h-4 text-sky-400 animate-pulse shrink-0" />
                <span>動画をアップロード & 各SNSで処理中</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-900/60 border border-sky-700/50 text-[11px] font-mono text-sky-300">
                <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
                <span>経過: {elapsedSeconds}秒</span>
              </div>
            </div>

            {/* 動的ステータスメッセージ */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-sky-200 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                <span>{getDynamicVideoStatus(elapsedSeconds)}</span>
              </p>

              {/* アニメーションプログレスバー */}
              <div className="w-full bg-slate-950/80 rounded-full h-2 overflow-hidden border border-sky-800/50">
                <div
                  className="bg-gradient-to-r from-sky-500 via-blue-500 to-indigo-500 h-full transition-all duration-1000 ease-out rounded-full relative"
                  style={{
                    width: `${Math.min(95, Math.max(15, elapsedSeconds < 4 ? 20 + elapsedSeconds * 8 : elapsedSeconds < 15 ? 50 + (elapsedSeconds - 4) * 3 : 80 + Math.min(15, (elapsedSeconds - 15) * 1)))}%`,
                  }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                </div>
              </div>
            </div>

            {/* 動画メタ情報 & 案内 */}
            <div className="pt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">添付:</span>
                <span className="font-semibold text-slate-200 truncate max-w-[200px]">
                  {primaryVideo?.name || '添付動画ファイル'}
                </span>
                {primaryVideo?.size && (
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 font-mono">
                    {(primaryVideo.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                )}
                {primaryVideo?.duration && (
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 font-mono">
                    {Math.round(primaryVideo.duration)}秒
                  </span>
                )}
              </div>
              <span className="text-sky-300 text-[10px]">
                ※ 画面を閉じずにお待ちください
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed border-t border-sky-900/40 pt-2">
              💡 各プラットフォーム（Bluesky公式動画・Threads）の公式仕様に基づき、各SNSサーバーで高画質配信のためのトランスコード（最適化）が行われます。動画の長さや通信状況により10〜30秒程度かかる場合がありますが、正常に通信処理中です。
            </p>
          </div>
        )}

        {/* 動画投稿完了時の完了バナー */}
        {hasVideo && isFinished && !hasError && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-200 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-bold">動画付き投稿の配信に成功しました！</span>
              <span className="text-slate-300 ml-1">各SNSで最適化エンコードされた動画が公開されています。</span>
            </div>
          </div>
        )}

        {/* デモ認証時の注記バナー */}
        {isDemoPosting && (
          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold">【デモアカウントによるシミュレーション動作中】</p>
              <p className="text-slate-300 text-[11px] leading-relaxed">
                現在サンプル認証情報が設定されているため、実際のアカウントへの送信ではなくシミュレーション結果を表示しています。実際のアカウントに投稿するには、右上の「API・認証設定」から本物のBlueskyアプリパスワード・Threadsアクセストークンを設定してください。
              </p>
            </div>
          </div>
        )}

        {/* ログ一覧 */}
        <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-3 max-h-56 overflow-y-auto font-mono text-xs">
          {logs.map((log, idx) => (
            <div key={idx} className="space-y-1 border-b border-slate-900 pb-2 last:border-0 last:pb-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-200 font-sans font-medium">{log.text}</span>
                <span>
                  {log.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                  {log.status === 'error' && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                  {log.status === 'loading' && <Loader2 className="w-4 h-4 text-[#0085ff] animate-spin shrink-0" />}
                  {log.status === 'pending' && <span className="w-2 h-2 rounded-full bg-slate-700 shrink-0" />}
                </span>
              </div>
              {log.detail && (
                <p className={`text-[11px] ${log.status === 'error' ? 'text-rose-400 font-semibold' : 'text-slate-400'}`}>
                  {log.detail}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* ========================================================= */}
        {/* 新機能: エラー段階診断 & デバッグ詳細パネル (Error Diagnosis Box) */}
        {/* ========================================================= */}
        {hasError && diagnostics.length > 0 && (
          <div
            id="error-stage-diagnosis-panel"
            className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/80 space-y-3 shadow-lg"
          >
            <div className="flex items-center justify-between gap-2 border-b border-rose-900/60 pb-2.5">
              <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
                <Bug className="w-4 h-4 text-rose-400 shrink-0" />
                <span>エラー段階の自動診断 & デバッグ解析</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyDebugInfo}
                  className="px-2.5 py-1 rounded bg-rose-900/50 hover:bg-rose-900 text-rose-200 border border-rose-700/60 text-[11px] font-medium flex items-center gap-1.5 transition cursor-pointer"
                >
                  {copiedDebug ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedDebug ? 'コピー完了' : 'デバッグ情報をコピー'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadDebugInfo}
                  className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                  title="通信エラーログを JST 時刻付きでダウンロード (.log)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>エラーログ出力 (JST)</span>
                </button>
              </div>
            </div>

            {/* 各診断レポートカード */}
            <div className="space-y-3">
              {diagnostics.map((diag, dIdx) => (
                <div
                  key={dIdx}
                  className="bg-slate-900/90 rounded-xl p-3.5 border border-rose-900/60 space-y-2.5 text-xs"
                >
                  {/* ヘッダー: プラットフォーム + 失敗段階バッジ */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        diag.platform === 'Bluesky' ? 'bg-[#0085ff]/20 text-sky-300 border border-[#0085ff]/40' : 'bg-purple-950/60 text-purple-300 border border-purple-800/60'
                      }`}>
                        {diag.platform === 'Bluesky' ? '🦋 Bluesky' : '🌀 Threads'}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 font-mono text-[10px] font-bold">
                        失敗段階: {diag.stageNameJa}
                      </span>
                    </div>
                    {diag.errorCode && (
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                        コード: {diag.errorCode}
                      </span>
                    )}
                  </div>

                  {/* 診断サマリー */}
                  <div className="space-y-1">
                    <p className="font-bold text-slate-100 text-[12px]">
                      {diag.summary}
                    </p>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      <span className="text-rose-400 font-semibold">【原因分析】</span> {diag.rootCause}
                    </p>
                  </div>

                  {/* 解決手順アクション */}
                  <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-[11px] text-emerald-200 flex items-start gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-emerald-300">【解決アクション】: </span>
                      <span className="text-slate-200">{diag.actionableStep}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 生のデバッグログ & 技術詳細のアコーディオン */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowDebugRawLogs((prev) => !prev)}
                className="w-full py-1.5 px-3 rounded-lg bg-slate-900/80 hover:bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-mono flex items-center justify-between transition cursor-pointer"
              >
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Terminal className="w-3.5 h-3.5 text-sky-400" />
                  <span>技術デバッグログ & 生のAPIレスポンスを展開</span>
                </span>
                {showDebugRawLogs ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
              </button>

              {showDebugRawLogs && (
                <div className="mt-2 p-3 rounded-lg bg-black border border-slate-800 font-mono text-[10px] text-slate-300 space-y-2 max-h-48 overflow-y-auto">
                  <div className="text-slate-500 border-b border-slate-900 pb-1">
                    --- Raw Diagnostic Payload ({new Date().toISOString()}) ---
                  </div>
                  {diagnostics.map((d, i) => (
                    <div key={i} className="space-y-0.5">
                      <p className="text-sky-400">[{d.platform}] Stage: {d.stage} ({d.stageNameJa})</p>
                      <p className="text-rose-400 whitespace-pre-wrap break-all">{d.rawError || 'No error string captured'}</p>
                    </div>
                  ))}
                  <div className="text-slate-500 border-t border-slate-900 pt-1">
                    --- Execution Steps Log ---
                  </div>
                  {logs.map((l, i) => (
                    <p key={i} className="text-slate-400">
                      <span className={l.status === 'error' ? 'text-rose-400' : l.status === 'success' ? 'text-emerald-400' : 'text-sky-400'}>
                        [{l.status.toUpperCase()}]
                      </span>{' '}
                      {l.text}: {l.detail}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 投稿リンク（成功時・本番投稿のみ表示） */}
        {isFinished && !isDemoPosting && !credentials.isDemoMode && (blueskyLinks.length > 0 || threadsLinks.length > 0) && (
          <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
            <span className="text-xs font-semibold text-slate-300">公開された投稿を確認:</span>
            <div className="flex flex-col gap-1.5 text-xs">
              {blueskyLinks[0] && (
                <a
                  href={blueskyLinks[0]}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-[#0085ff] hover:underline font-medium"
                >
                  <span>🦋 Blueskyで投稿を見る</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {threadsLinks[0] && (
                <a
                  href={threadsLinks[0]}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-purple-400 hover:underline font-medium"
                >
                  <span>🌀 Threadsで投稿を見る</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        )}

        {/* 投稿中のフッター・即座中止ボタン */}
        {isPosting && (
          <div className="pt-3 flex items-center justify-between gap-3 border-t border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin text-[#0085ff]" />
              <span>
                処理を実行中... ({elapsedSeconds}秒経過)
              </span>
            </div>
            <button
              id="footer-cancel-posting-button"
              type="button"
              onClick={handleCancelPosting}
              className="px-4 py-2 rounded-xl bg-rose-950/90 hover:bg-rose-900 border border-rose-700/80 text-rose-200 hover:text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-lg shadow-rose-950/50 active:scale-95"
            >
              <Ban className="w-4 h-4 text-rose-400" />
              <span>投稿を中止（キャンセル）</span>
            </button>
          </div>
        )}

        {/* アクションボタン */}
        {isFinished && (
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800">
            {hasError ? (
              <>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-[#0085ff]" />
                    <span>認証設定を確認・再入力</span>
                  </button>
                  {onUseDemoCredentials && (
                    <button
                      type="button"
                      onClick={() => {
                        onUseDemoCredentials();
                        setTimeout(startPosting, 100);
                      }}
                      className="px-3 py-2 rounded-xl bg-amber-950/60 hover:bg-amber-900/60 text-amber-200 border border-amber-800/60 text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>デモ設定で動作テスト</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={startPosting}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>再試行</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer"
                  >
                    閉じる
                  </button>
                </div>
              </>
            ) : (
              <div className="w-full flex justify-end">
                <button
                  id="close-success-modal-button"
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-[#0085ff] hover:bg-blue-600 text-white text-xs font-bold transition shadow-lg shadow-blue-600/30 cursor-pointer"
                >
                  完了
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 公式動画仕様モーダル */}
      <VideoSpecsModal
        isOpen={isVideoSpecsModalOpen}
        onClose={() => setIsVideoSpecsModalOpen(false)}
        videoItem={images.find((m) => m.mediaType === 'video') || null}
      />
    </div>
  );
};

