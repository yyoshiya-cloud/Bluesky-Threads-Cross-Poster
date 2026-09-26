import {
  AttachedImage,
  ApiCredentials,
  PostHistoryItem,
  ToastMessage,
  ThemeAccentId,
  ScheduledPostItem,
  SplitThreadItem,
  SnippetItem,
  ReplySettings,
  ReplyTargetInfo,
} from '../types';

/**
 * ステートマシンの状態定義
 */
export type AppMachineState =
  | 'READY'            // 待機・通常編集可能
  | 'DRAFT_SAVING'     // 下書き同期・保存処理中
  | 'POSTING'          // 投稿実行モーダル処理中
  | 'SCHEDULED'        // 予約投稿完了状態
  | 'TERMINATED';      // アプリケーション終了画面

/**
 * モーダルの識別子
 */
export type ModalType =
  | 'settings'
  | 'history'
  | 'analytics'
  | 'scheduled'
  | 'snippetManager'
  | 'userGuide'
  | 'quitConfirm'
  | 'posting'
  | 'modePassword'
  | 'aboutApp'
  | 'serverVault';

/**
 * Chain of Responsibility でバブリングされるイベント群
 */
export type AppEvent =
  // テキスト・入力系
  | { type: 'UPDATE_TEXT'; payload: string }
  | { type: 'UPDATE_BLUESKY_TEXT'; payload: string }
  | { type: 'UPDATE_THREADS_TEXT'; payload: string }
  | { type: 'TOGGLE_CUSTOM_PLATFORM_TEXT'; payload: boolean }
  | { type: 'UPDATE_THREADS_TOPIC'; payload: string }
  | { type: 'TOGGLE_AUTO_SPLIT'; payload: boolean }
  | { type: 'TOGGLE_INCLUDE_NUMBERING'; payload: boolean }
  | { type: 'REUSE_TEXT'; payload: string }
  | { type: 'CLEAR_DRAFT' }

  // プラットフォーム選択
  | { type: 'TOGGLE_POST_TO_BLUESKY'; payload: boolean }
  | { type: 'TOGGLE_POST_TO_THREADS'; payload: boolean }

  // メディア（画像・動画）操作
  | { type: 'ADD_IMAGES'; payload: AttachedImage[] }
  | { type: 'SET_IMAGES'; payload: AttachedImage[] }
  | { type: 'REORDER_IMAGES'; payload: { oldIndex: number; newIndex: number } }
  | { type: 'REMOVE_IMAGE'; payload: string }
  | { type: 'CLEAR_IMAGES' }
  | { type: 'UPDATE_IMAGE_ALT'; payload: { id: string; alt: string } }

  // テーマ・外観
  | { type: 'SELECT_THEME'; payload: ThemeAccentId }

  // アカウント・認証
  | { type: 'TOGGLE_DEMO_MODE' }
  | { type: 'SAVE_CREDENTIALS'; payload: ApiCredentials }
  | { type: 'RESTORE_SAVED_ACCOUNT' }
  | { type: 'DELETE_SAVED_ACCOUNT'; payload: 'bluesky' | 'threads' | 'all' }
  | { type: 'LOGOUT'; payload: 'bluesky' | 'threads' | 'all' }

  // 投稿アクション
  | { type: 'SUBMIT_POST_REQUEST' }
  | {
      type: 'SCHEDULE_POST_REQUEST';
      payload: { scheduledAt: number; targetPlatform?: 'All' | 'Bluesky' | 'Threads' };
    }
  | {
      type: 'RETRY_HISTORY_POST';
      payload: {
        item: PostHistoryItem;
        targetPlatform?: 'All' | 'Bluesky' | 'Threads' | 'AllFailed';
      };
    }
  | {
      type: 'POSTING_COMPLETE';
      payload: {
        blueskySuccess: boolean;
        threadsSuccess: boolean;
        blueskyUrls: string[];
        threadsUrls: string[];
        isDemo: boolean;
        errorMessage?: string;
      };
    }
  | {
      type: 'API_ERROR';
      payload: {
        platform: 'Bluesky' | 'Threads';
        message: string;
        errorCode?: string | number;
        requiresReLogin?: boolean;
      };
    }

  // 予約・履歴管理
  | { type: 'REFRESH_SCHEDULED_POSTS' }
  | { type: 'LOAD_SCHEDULED_INTO_EDITOR'; payload: ScheduledPostItem }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'DELETE_HISTORY_ITEM'; payload: string }
  | { type: 'UPDATE_HISTORY'; payload: PostHistoryItem[] }
  | { type: 'IMPORT_BACKUP'; payload: { history: PostHistoryItem[]; scheduled: ScheduledPostItem[]; snippets?: SnippetItem[] } }

  // 定型文・スニペット管理
  | {
      type: 'SAVE_SNIPPET';
      payload: {
        id?: string;
        title: string;
        content: string;
        blueskyContent?: string;
        threadsContent?: string;
        threadsTopic?: string;
        category: SnippetItem['category'];
        categoryName?: string;
        icon?: string;
      };
    }
  | { type: 'DELETE_SNIPPET'; payload: string }
  | { type: 'RESET_SNIPPETS' }
  | {
      type: 'APPLY_SNIPPET';
      payload: {
        id: string;
        insertMode: 'replace' | 'append' | 'prepend';
      };
    }
  | {
      type: 'SAVE_CURRENT_TEXT_AS_SNIPPET';
      payload: {
        title: string;
        category?: SnippetItem['category'];
        icon?: string;
      };
    }

  // リプライ（返信先）設定
  | { type: 'UPDATE_REPLY_SETTINGS'; payload: Partial<ReplySettings> }
  | { type: 'SET_RESOLVED_REPLY_TARGET'; payload: { platform: 'Bluesky' | 'Threads'; target: ReplyTargetInfo | null } }
  | { type: 'CLEAR_REPLY_TARGET'; payload: 'Bluesky' | 'Threads' | 'all' }

  // モーダル操作
  | { type: 'OPEN_MODAL'; payload: ModalType }
  | { type: 'CLOSE_MODAL'; payload: ModalType }
  | { type: 'TOGGLE_MODAL'; payload: ModalType }

  // システム・終了
  | { type: 'CONFIRM_QUIT' }
  | { type: 'RESTART_APP' }

  // 通知（トースト）
  | { type: 'NOTIFY'; payload: Omit<ToastMessage, 'id'> }
  | { type: 'DISMISS_TOAST'; payload: string };

/**
 * MVPパターンの Passive View に渡す描画パラメータ（Root ViewModel）
 * View はこのパラメータを受け取って純粋に描画し、アクションは Chain にバブリングする
 */
export interface RootViewModel {
  // ステートマシン状態
  machineState: AppMachineState;
  isAppTerminated: boolean;

  // テーマ
  theme: ThemeAccentId;

  // エディタパラメータ
  text: string;
  blueskyText: string;
  threadsText: string;
  customPlatformText: boolean;
  images: AttachedImage[];
  postToBluesky: boolean;
  postToThreads: boolean;
  threadsTopic: string;
  autoSplit: boolean;
  includeNumbering: boolean;
  replySettings: ReplySettings;

  // スレッド分割結果（算出パラメータ）
  blueskySplits: SplitThreadItem[];
  threadsSplits: SplitThreadItem[];

  // 認証・デモ
  credentials: ApiCredentials;
  isDemoMode: boolean;

  // 下書きパラメータ
  lastSavedAt: number | null;
  draftStatus: 'saved' | 'saving' | 'error' | 'idle';
  draftError?: string;

  // 予約投稿・履歴データ
  scheduledPosts: ScheduledPostItem[];
  history: PostHistoryItem[];

  // 定型文・スニペット一覧
  snippets: SnippetItem[];

  // モーダル開閉状態
  modals: Record<ModalType, boolean>;

  // トースト通知
  toasts: ToastMessage[];
}
