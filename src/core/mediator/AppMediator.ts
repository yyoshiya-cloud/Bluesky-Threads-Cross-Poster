import {
  AppMachineState,
  AppEvent,
  RootViewModel,
  ModalType,
} from '../types';
import { IMediatorArbitrator } from '../chain/MediatorTerminalHandler';
import {
  AttachedImage,
  ApiCredentials,
  PostHistoryItem,
  DraftData,
  ToastMessage,
  ThemeAccentId,
  ScheduledPostItem,
  SnippetItem,
  ReplySettings,
  ReplyTargetInfo,
} from '../../types';
import { splitForBluesky, splitForThreads } from '../../utils/textSplitter';
import {
  saveDraftToStorage,
  clearDraftFromStorage,
} from '../../utils/draftStorage';
import {
  getSavedThemeAccent,
  applyThemeAccent,
  getThemeAccentConfig,
} from '../../utils/themeManager';
import {
  loadScheduledPostsFromStorage,
  saveScheduledPostsToStorage,
  addScheduledPost,
  clearAllScheduledPosts,
  formatToJstString,
} from '../../utils/scheduledStorage';
import {
  loadHistoryFromStorage,
  saveHistoryToStorage,
  clearHistoryFromStorage,
} from '../../utils/historyStorage';
import {
  loadSnippetsFromStorage,
  saveSnippetsToStorage,
  saveSnippet,
  deleteSnippet,
  resetSnippetsToDefault,
} from '../../utils/snippetStorage';
import {
  saveCredentialsToVault,
  getSavedAccountVault,
  restoreFromVault,
  restoreFromVaultAsync,
  deleteFromVault,
  syncVaultWithServer,
} from '../../utils/accountVault';
import { DEMO_CREDENTIALS, checkIsDemoCredentials } from '../../utils/postApi';
import { addSavedThreadsTopic } from '../../utils/topicStorage';
import {
  performCleanStateInitialization,
  CLEAN_REPLY_SETTINGS,
  isDemoReplyState,
} from '../../utils/demoStateCleaner';

const DEFAULT_TEXT = '';

export type StateListener = (viewModel: RootViewModel) => void;

/**
 * AppMediator:
 * ステートマシンとして振る舞い、Chain of Responsibility から流れてくるイベントを
 * 厳格なルールに基づいて裁定（Arbitrate）し、サブシステムと Passive View を調停する中核クラス
 */
export class AppMediator implements IMediatorArbitrator {
  // ステートマシンの現在状態
  private machineState: AppMachineState = 'READY';
  private isAppTerminated: boolean = false;

  // テーマ
  private theme: ThemeAccentId = getSavedThemeAccent();

  // エディタ状態（起動時は常にクリア）
  private text: string = '';
  private blueskyText: string = '';
  private threadsText: string = '';
  private customPlatformText: boolean = false;
  private images: AttachedImage[] = [];
  private postToBluesky: boolean = true;
  private postToThreads: boolean = true;
  private threadsTopic: string = '';
  private autoSplit: boolean = true;
  private includeNumbering: boolean = true;
  private replySettings: ReplySettings = {
    enabled: false,
    blueskyTargetUrl: '',
    threadsTargetUrl: '',
    blueskyResolved: null,
    threadsResolved: null,
  };

  // 下書き状態
  private lastSavedAt: number | null = null;
  private draftStatus: 'saved' | 'saving' | 'error' | 'idle' = 'idle';
  private draftError: string | undefined = undefined;
  private draftSaveTimer: any = null;

  // 認証・デモ
  private credentials: ApiCredentials;

  // 予約・履歴・スニペット
  private scheduledPosts: ScheduledPostItem[] = [];
  private history: PostHistoryItem[] = [];
  private snippets: SnippetItem[] = [];

  // モーダル
  private modals: Record<ModalType, boolean> = {
    settings: false,
    history: false,
    analytics: false,
    scheduled: false,
    snippetManager: false,
    userGuide: false,
    quitConfirm: false,
    posting: false,
    modePassword: false,
    aboutApp: false,
  };

  // トースト
  private toasts: ToastMessage[] = [];

  // ViewModel更新リスナー
  private listeners: Set<StateListener> = new Set();

  constructor() {
    // アプリ起動時の自動クリーンアップ: 古いDEMOモードのキャッシュデータ（予約投稿・下書き・通信ログ）を安全に一掃
    performCleanStateInitialization({
      isLiveMode: false,
      reason: 'startup',
    });

    // 起動時は投稿文の内容を完全にクリアにし、前回の古い下書きもリセット
    clearDraftFromStorage();
    this.text = '';
    this.blueskyText = '';
    this.threadsText = '';
    this.customPlatformText = false;
    this.images = [];
    this.postToBluesky = true;
    this.postToThreads = true;
    this.threadsTopic = '';
    this.autoSplit = true;
    this.includeNumbering = true;
    this.replySettings = { ...CLEAN_REPLY_SETTINGS };
    this.lastSavedAt = null;
    this.draftStatus = 'idle';

    // 認証情報初期化（保存済みの本番アカウントが存在する場合はリロード・デプロイ後も確実に復元）
    let restoredCreds: ApiCredentials | null = null;
    let isLiveAccount = false;

    try {
      const vault = getSavedAccountVault();
      if ((vault.bluesky?.identifier && vault.bluesky?.appPassword) || vault.threads?.accessToken) {
        restoredCreds = restoreFromVault({ ...DEMO_CREDENTIALS, isDemoMode: false }, 'all');
        restoredCreds.isDemoMode = false;
        isLiveAccount = true;
      } else {
        const saved = localStorage.getItem('cross_poster_creds');
        if (saved) {
          const parsed = JSON.parse(saved);
          const { blueskyIsDemo, threadsIsDemo } = checkIsDemoCredentials(parsed);
          if (!blueskyIsDemo || !threadsIsDemo) {
            saveCredentialsToVault(parsed);
            restoredCreds = { ...parsed, isDemoMode: false };
            isLiveAccount = true;
          }
        }
      }
    } catch (e) {
      console.error('Failed to backup existing credentials:', e);
    }

    if (isLiveAccount && restoredCreds) {
      this.credentials = restoredCreds;
      try {
        localStorage.setItem('cross_poster_creds', JSON.stringify(this.credentials));
      } catch (e) {
        console.warn('Failed to store credentials in localStorage:', e);
      }
    } else {
      this.credentials = {
        ...DEMO_CREDENTIALS,
        isDemoMode: true,
      };
      try {
        localStorage.setItem('cross_poster_creds', JSON.stringify(this.credentials));
      } catch (e) {
        console.warn('Failed to set demo credentials in localStorage:', e);
      }
    }

    // 履歴・予約投稿・スニペットの読み込み（クリーンアップ済みストレージから復元）
    this.history = loadHistoryFromStorage();
    this.scheduledPosts = loadScheduledPostsFromStorage();
    this.snippets = loadSnippetsFromStorage();

    // テーマ適用
    applyThemeAccent(this.theme);

    // サーバー永続ストレージとの非同期同期（デプロイ後や初回ロード・別端末での即時復元）
    this.hydrateCredentialsFromServer();
  }

  /**
   * サーバー側ファイルストレージから認証情報を非同期ロード・同期
   */
  private async hydrateCredentialsFromServer(): Promise<void> {
    try {
      const serverVault = await syncVaultWithServer();
      const hasBluesky = Boolean(serverVault.bluesky?.identifier && serverVault.bluesky?.appPassword);
      const hasThreads = Boolean(serverVault.threads?.accessToken);

      if (hasBluesky || hasThreads) {
        const { blueskyIsDemo, threadsIsDemo } = checkIsDemoCredentials(this.credentials);
        if (this.credentials.isDemoMode || blueskyIsDemo || threadsIsDemo) {
          const restored = await restoreFromVaultAsync(this.credentials, 'all');
          restored.isDemoMode = false;
          this.credentials = restored;
          try {
            localStorage.setItem('cross_poster_creds', JSON.stringify(restored));
          } catch (e) {
            console.warn('Failed to update credentials in localStorage:', e);
          }
          this.notifyListeners();
          console.log('[AppMediator] Successfully synced and restored account credentials from server vault.');
        }
      }
    } catch (e) {
      console.warn('[AppMediator] Server credentials hydration completed or skipped:', e);
    }
  }

  /**
   * 外部リスナーの登録（ReactコンポーネントがViewModelを受信）
   */
  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getViewModel());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Passive View用の完全な描画パラメータ（ViewModel）を構築
   */
  public getViewModel(): RootViewModel {
    const isDemo = this.computeIsDemoMode();

    // スレッド分割結果の算出
    const bText = this.customPlatformText && this.blueskyText.trim() ? this.blueskyText : this.text;
    const tText = this.customPlatformText && this.threadsText.trim() ? this.threadsText : this.text;

    const blueskySplits = splitForBluesky(
      bText,
      this.includeNumbering,
      this.images,
      this.autoSplit
    );

    const threadsSplits = splitForThreads(
      tText,
      this.includeNumbering,
      this.images,
      this.autoSplit
    );

    return {
      machineState: this.machineState,
      isAppTerminated: this.isAppTerminated,
      theme: this.theme,
      text: this.text,
      blueskyText: this.blueskyText,
      threadsText: this.threadsText,
      customPlatformText: this.customPlatformText,
      images: [...this.images],
      postToBluesky: this.postToBluesky,
      postToThreads: this.postToThreads,
      threadsTopic: this.threadsTopic,
      autoSplit: this.autoSplit,
      includeNumbering: this.includeNumbering,
      replySettings: { ...this.replySettings },
      blueskySplits,
      threadsSplits,
      credentials: { ...this.credentials },
      isDemoMode: isDemo,
      lastSavedAt: this.lastSavedAt,
      draftStatus: this.draftStatus,
      draftError: this.draftError,
      scheduledPosts: [...this.scheduledPosts],
      history: [...this.history],
      snippets: [...this.snippets],
      modals: { ...this.modals },
      toasts: [...this.toasts],
    };
  }

  private notifyListeners(): void {
    const vm = this.getViewModel();
    this.listeners.forEach((listener) => listener(vm));
  }

  private computeIsDemoMode(): boolean {
    if (typeof this.credentials.isDemoMode === 'boolean') {
      return this.credentials.isDemoMode;
    }
    const { blueskyIsDemo, threadsIsDemo } = checkIsDemoCredentials(this.credentials);
    return blueskyIsDemo && threadsIsDemo;
  }

  /**
   * ステートマシンの状態遷移と裁定（Arbitration）
   * Chain of Responsibility からバブリングされてきたすべてのイベントをここで裁定する
   */
  public arbitrate(event: AppEvent): void {
    // 1. 終了状態（TERMINATED）の調停
    if (this.isAppTerminated) {
      if (event.type === 'RESTART_APP') {
        this.isAppTerminated = false;
        this.machineState = 'READY';
        this.notifyListeners();
      }
      return; // 終了状態では他のイベントを安全に遮断
    }

    // 2. イベント種別ごとのステートマシン遷移と調停
    switch (event.type) {
      case 'UPDATE_TEXT':
        this.text = event.payload;
        this.scheduleDraftSave();
        this.notifyListeners();
        break;

      case 'UPDATE_BLUESKY_TEXT':
        this.blueskyText = event.payload;
        this.scheduleDraftSave();
        this.notifyListeners();
        break;

      case 'UPDATE_THREADS_TEXT':
        this.threadsText = event.payload;
        this.scheduleDraftSave();
        this.notifyListeners();
        break;

      case 'TOGGLE_CUSTOM_PLATFORM_TEXT':
        this.customPlatformText = event.payload;
        this.scheduleDraftSave();
        this.notifyListeners();
        break;

      case 'UPDATE_THREADS_TOPIC':
        this.threadsTopic = event.payload;
        this.scheduleDraftSave();
        this.notifyListeners();
        break;

      case 'TOGGLE_AUTO_SPLIT':
        this.autoSplit = event.payload;
        this.scheduleDraftSave();
        this.notifyListeners();
        break;

      case 'TOGGLE_INCLUDE_NUMBERING':
        this.includeNumbering = event.payload;
        this.scheduleDraftSave();
        this.notifyListeners();
        break;

      case 'TOGGLE_POST_TO_BLUESKY': {
        this.postToBluesky = event.payload;
        this.scheduleDraftSave();
        this.notifyListeners();
        break;
      }

      case 'TOGGLE_POST_TO_THREADS': {
        this.postToThreads = event.payload;
        this.scheduleDraftSave();
        this.notifyListeners();
        break;
      }

      case 'ADD_IMAGES': {
        const unique = event.payload.filter(
          (newImg) => !this.images.some((img) => img.name === newImg.name && img.size === newImg.size)
        );
        this.images = [...this.images, ...unique].slice(0, 20);
        this.scheduleDraftSave();
        this.notifyListeners();
        break;
      }

      case 'SET_IMAGES':
        this.images = event.payload;
        this.scheduleDraftSave();
        this.notifyListeners();
        break;

      case 'REORDER_IMAGES': {
        const { oldIndex, newIndex } = event.payload;
        if (
          oldIndex >= 0 &&
          oldIndex < this.images.length &&
          newIndex >= 0 &&
          newIndex < this.images.length
        ) {
          const next = [...this.images];
          const [moved] = next.splice(oldIndex, 1);
          next.splice(newIndex, 0, moved);
          this.images = next;
          this.scheduleDraftSave();
          this.notifyListeners();
        }
        break;
      }

      case 'REMOVE_IMAGE':
        this.images = this.images.filter((img) => img.id !== event.payload);
        this.scheduleDraftSave();
        this.notifyListeners();
        break;

      case 'CLEAR_IMAGES':
        this.images = [];
        this.scheduleDraftSave();
        this.notifyListeners();
        break;

      case 'UPDATE_IMAGE_ALT':
        this.images = this.images.map((img) =>
          img.id === event.payload.id ? { ...img, alt: event.payload.alt } : img
        );
        this.scheduleDraftSave();
        this.notifyListeners();
        break;

      case 'SELECT_THEME':
        this.theme = event.payload;
        applyThemeAccent(event.payload);
        this.addToast({
          type: 'info',
          title: '🎨 テーマを変更しました',
          message: `アクセントカラーを「${getThemeAccentConfig(event.payload).nameJa}」に設定しました。`,
          duration: 3000,
        });
        this.notifyListeners();
        break;

      case 'TOGGLE_DEMO_MODE':
        this.handleToggleDemoMode();
        break;

      case 'SAVE_CREDENTIALS': {
        const prevWasDemo = this.computeIsDemoMode();
        this.credentials = event.payload;
        localStorage.setItem('cross_poster_creds', JSON.stringify(event.payload));
        const { blueskyIsDemo, threadsIsDemo } = checkIsDemoCredentials(event.payload);
        const isNowDemo = typeof event.payload.isDemoMode === 'boolean'
          ? event.payload.isDemoMode
          : (blueskyIsDemo && threadsIsDemo);

        if (!blueskyIsDemo || !threadsIsDemo) {
          saveCredentialsToVault(event.payload);
        }

        // DEMOモードからLIVEモードへの切り替え時は、古いDEMOキャッシュを一括クリーンアップ
        if (prevWasDemo && !isNowDemo) {
          performCleanStateInitialization({
            isLiveMode: true,
            reason: 'credentials_update',
            forceHistoryClean: true,
          });
          this.scheduledPosts = loadScheduledPostsFromStorage();
          this.history = loadHistoryFromStorage();
          this.replySettings = { ...CLEAN_REPLY_SETTINGS };
          clearDraftFromStorage();
          this.addToast({
            type: 'info',
            title: '🧹 クリーン初期化完了',
            message: 'LIVEモードへの移行に伴い、DEMOモードの古いキャッシュデータを自動クリーンアップしました。',
          });
        }
        this.notifyListeners();
        break;
      }

      case 'RESTORE_SAVED_ACCOUNT': {
        const vault = getSavedAccountVault();
        if (vault.bluesky?.identifier || vault.threads?.accessToken) {
          const prevWasDemo = this.computeIsDemoMode();
          const restored = restoreFromVault(this.credentials, 'all');
          restored.isDemoMode = false;
          this.credentials = restored;
          localStorage.setItem('cross_poster_creds', JSON.stringify(restored));

          // バックグラウンドで完全復号化を完了して反映
          restoreFromVaultAsync(this.credentials, 'all').then((full) => {
            this.credentials = { ...full, isDemoMode: false };
            localStorage.setItem('cross_poster_creds', JSON.stringify(this.credentials));
            this.notifyListeners();
          });

          if (prevWasDemo) {
            performCleanStateInitialization({
              isLiveMode: true,
              reason: 'switch_to_live',
              forceHistoryClean: true,
            });
            this.scheduledPosts = loadScheduledPostsFromStorage();
            this.history = loadHistoryFromStorage();
            this.replySettings = { ...CLEAN_REPLY_SETTINGS };
            clearDraftFromStorage();
          }

          this.addToast({
            type: 'success',
            title: '🔐 保存済みアカウントを復元しました',
            message: '保管庫から安全に認証情報を読み込み、クリーンな状態で起動しました。',
          });
          this.notifyListeners();
        }
        break;
      }

      case 'DELETE_SAVED_ACCOUNT': {
        deleteFromVault(event.payload);
        this.addToast({
          type: 'info',
          title: '🗑️ 保存情報を削除しました',
          message: '保管庫内の認証情報を安全に削除しました。',
        });
        this.notifyListeners();
        break;
      }

      case 'LOGOUT': {
        const nextCreds = { ...this.credentials };
        if (event.payload === 'bluesky' || event.payload === 'all') {
          nextCreds.blueskyIdentifier = '';
          nextCreds.blueskyAppPassword = '';
          nextCreds.blueskyConnected = false;
          nextCreds.blueskyHandle = '';
          nextCreds.blueskyDid = undefined;
          nextCreds.blueskyAccessJwt = undefined;
        }
        if (event.payload === 'threads' || event.payload === 'all') {
          nextCreds.threadsUserId = '';
          nextCreds.threadsAccessToken = '';
          nextCreds.threadsConnected = false;
          nextCreds.threadsUsername = '';
          nextCreds.threadsTokenExpiresAt = undefined;
        }
        this.credentials = nextCreds;
        localStorage.setItem('cross_poster_creds', JSON.stringify(nextCreds));
        this.addToast({
          type: 'info',
          title: '🚪 ログアウトしました',
          message: 'アカウント認証の接続を解除しました。',
        });
        this.notifyListeners();
        break;
      }

      case 'SUBMIT_POST_REQUEST':
        // ステートマシン判定: 投稿可能か裁定
        if (this.machineState === 'POSTING') {
          return; // 二重実行抑止
        }
        if (!this.postToBluesky && !this.postToThreads) {
          this.addToast({
            type: 'warning',
            title: '投稿先が選択されていません',
            message: 'Bluesky または Threads のいずれかを選択してください。',
          });
          return;
        }

        // ステートを POSTING に遷移させ、モーダルを開く
        this.machineState = 'POSTING';
        this.modals.posting = true;
        this.notifyListeners();
        break;

      case 'SCHEDULE_POST_REQUEST': {
        const { scheduledAt, targetPlatform } = event.payload;
        let bFlag = this.postToBluesky;
        let tFlag = this.postToThreads;
        if (targetPlatform === 'Bluesky') {
          bFlag = true;
          tFlag = false;
        } else if (targetPlatform === 'Threads') {
          bFlag = false;
          tFlag = true;
        } else if (targetPlatform === 'All') {
          bFlag = true;
          tFlag = true;
        }

        addScheduledPost({
          scheduledAt,
          text: this.text,
          blueskyText: this.customPlatformText ? this.blueskyText : undefined,
          threadsText: this.customPlatformText ? this.threadsText : undefined,
          customPlatformText: this.customPlatformText,
          images: this.images,
          postToBluesky: bFlag,
          postToThreads: tFlag,
          threadsTopic: this.threadsTopic || undefined,
          autoSplit: this.autoSplit,
          includeNumbering: this.includeNumbering,
          replySettings: this.replySettings.enabled ? { ...this.replySettings } : undefined,
          isDemo: this.computeIsDemoMode(),
        });

        this.scheduledPosts = loadScheduledPostsFromStorage();
        this.machineState = 'SCHEDULED';
        this.addToast({
          type: 'success',
          title: '⏰ 予約投稿をセットしました',
          message: `${formatToJstString(scheduledAt)} に配信予定です。`,
        });
        this.notifyListeners();
        break;
      }

      case 'POSTING_COMPLETE': {
        const res = event.payload;
        const hasAnySuccess = res.blueskySuccess || res.threadsSuccess;
        const isFullSuccess =
          (!this.postToBluesky || res.blueskySuccess) && (!this.postToThreads || res.threadsSuccess);

        const status: 'success' | 'failed' | 'partial' = isFullSuccess
          ? 'success'
          : hasAnySuccess
          ? 'partial'
          : 'failed';

        const platforms: ('Bluesky' | 'Threads')[] = [];
        if (this.postToBluesky) platforms.push('Bluesky');
        if (this.postToThreads) platforms.push('Threads');

        const bText = this.customPlatformText && this.blueskyText.trim() ? this.blueskyText : this.text;
        const tText = this.customPlatformText && this.threadsText.trim() ? this.threadsText : this.text;
        const bSplits = splitForBluesky(bText, this.includeNumbering, this.images, this.autoSplit);
        const tSplits = splitForThreads(tText, this.includeNumbering, this.images, this.autoSplit);

        const historyItem: PostHistoryItem = {
          id: `post_${Date.now()}`,
          timestamp: formatToJstString(Date.now(), true),
          originalText: this.text,
          platforms,
          blueskyPosts: bSplits.map((s) => s.text),
          threadsPosts: tSplits.map((s) => s.text),
          threadsTopic: this.threadsTopic ? this.threadsTopic : undefined,
          images: this.images.map((i) => i.dataUrl),
          attachedImages: this.images,
          status,
          blueskySuccess: res.blueskySuccess,
          threadsSuccess: res.threadsSuccess,
          blueskyUrls: res.blueskyUrls,
          threadsUrls: res.threadsUrls,
          isDemo: res.isDemo,
          errorMessage: res.errorMessage,
          replySettings: this.replySettings.enabled ? { ...this.replySettings } : undefined,
        };

        this.history = [historyItem, ...this.history];
        saveHistoryToStorage(this.history);

        if (this.threadsTopic && this.threadsTopic.trim()) {
          addSavedThreadsTopic(this.threadsTopic.trim());
        }
        this.machineState = 'READY';
        this.modals.posting = false;
        this.notifyListeners();
        break;
      }

      case 'API_ERROR':
        this.addToast({
          type: 'error',
          title: `${event.payload.platform} API エラー`,
          message: event.payload.message,
          errorCode: event.payload.errorCode,
          platform: event.payload.platform,
          requiresReLogin: event.payload.requiresReLogin,
          duration: 10000,
        });
        this.notifyListeners();
        break;

      case 'RETRY_HISTORY_POST': {
        const { item, targetPlatform } = event.payload;
        this.text = item.originalText;
        this.threadsTopic = item.threadsTopic || '';
        if (item.attachedImages && item.attachedImages.length > 0) {
          this.images = item.attachedImages;
        }

        if (targetPlatform === 'Bluesky') {
          this.postToBluesky = true;
          this.postToThreads = false;
        } else if (targetPlatform === 'Threads') {
          this.postToBluesky = false;
          this.postToThreads = true;
        } else if (targetPlatform === 'AllFailed') {
          const bFailed = item.platforms.includes('Bluesky') && (item.blueskySuccess === false || (!item.blueskyUrls || item.blueskyUrls.length === 0));
          const tFailed = item.platforms.includes('Threads') && (item.threadsSuccess === false || (!item.threadsUrls || item.threadsUrls.length === 0));
          this.postToBluesky = bFailed || !item.platforms.includes('Threads');
          this.postToThreads = tFailed || !item.platforms.includes('Bluesky');
        } else {
          this.postToBluesky = item.platforms.includes('Bluesky');
          this.postToThreads = item.platforms.includes('Threads');
        }

        this.modals.history = false;
        this.modals.posting = true;
        this.machineState = 'POSTING';
        this.notifyListeners();
        break;
      }

      case 'LOAD_SCHEDULED_INTO_EDITOR': {
        const p = event.payload;
        this.text = p.text;
        if (p.customPlatformText) {
          this.customPlatformText = true;
          this.blueskyText = p.blueskyText || '';
          this.threadsText = p.threadsText || '';
        } else {
          this.customPlatformText = false;
        }
        if (p.images && p.images.length > 0) {
          this.images = p.images;
        }
        if (p.threadsTopic) {
          this.threadsTopic = p.threadsTopic;
        }
        this.postToBluesky = p.postToBluesky;
        this.postToThreads = p.postToThreads;
        this.autoSplit = p.autoSplit;
        this.includeNumbering = p.includeNumbering;

        this.modals.scheduled = false;
        this.addToast({
          type: 'info',
          title: '📝 予約内容をエディタに展開しました',
          message: 'エディタで内容を編集して再送信や再予約が可能です。',
        });
        this.notifyListeners();
        break;
      }

      case 'CLEAR_DRAFT':
        clearDraftFromStorage();
        this.text = '';
        this.blueskyText = '';
        this.threadsText = '';
        this.customPlatformText = false;
        this.images = [];
        this.threadsTopic = '';
        this.replySettings = {
          enabled: false,
          blueskyTargetUrl: '',
          threadsTargetUrl: '',
          blueskyResolved: null,
          threadsResolved: null,
        };
        this.lastSavedAt = null;
        this.draftStatus = 'saved';
        this.addToast({
          type: 'info',
          title: '🗑️ 下書きをクリアしました',
          message: '投稿フォームの内容をすべて削除しました。',
        });
        this.notifyListeners();
        break;

      case 'CLEAR_HISTORY':
        this.history = [];
        clearHistoryFromStorage();
        this.notifyListeners();
        break;

      case 'DELETE_HISTORY_ITEM':
        this.history = this.history.filter((item) => item.id !== event.payload);
        saveHistoryToStorage(this.history);
        this.notifyListeners();
        break;

      case 'UPDATE_HISTORY':
        this.history = event.payload;
        saveHistoryToStorage(this.history);
        this.notifyListeners();
        break;

      case 'IMPORT_BACKUP': {
        const { history: newHistory, scheduled: newScheduled, snippets: newSnippets } = event.payload;
        if (newHistory && Array.isArray(newHistory)) {
          this.history = newHistory;
          saveHistoryToStorage(this.history);
        }
        if (newScheduled && Array.isArray(newScheduled)) {
          this.scheduledPosts = newScheduled;
          saveScheduledPostsToStorage(this.scheduledPosts);
        }
        if (newSnippets && Array.isArray(newSnippets)) {
          this.snippets = newSnippets;
          saveSnippetsToStorage(this.snippets);
        }
        this.addToast({
          type: 'success',
          title: '🔄 バックアップを復元しました',
          message: `投稿履歴 ${newHistory.length}件、予約投稿 ${newScheduled.length}件を読み込みました。`,
        });
        this.notifyListeners();
        break;
      }

      case 'SAVE_SNIPPET': {
        const { id, ...data } = event.payload;
        this.snippets = saveSnippet(data, id);
        this.addToast({
          type: 'success',
          title: id ? '💾 定型文を更新しました' : '✨ 定型文を新規保存しました',
          message: `「${data.title}」を登録しました。`,
        });
        this.notifyListeners();
        break;
      }

      case 'DELETE_SNIPPET': {
        this.snippets = deleteSnippet(event.payload);
        this.addToast({
          type: 'info',
          title: '🗑️ 定型文を削除しました',
          message: '対象の定型文を削除しました。',
        });
        this.notifyListeners();
        break;
      }

      case 'RESET_SNIPPETS': {
        this.snippets = resetSnippetsToDefault();
        this.addToast({
          type: 'info',
          title: '🔄 定型文を初期化しました',
          message: 'デフォルトの定型文プリセットに戻しました。',
        });
        this.notifyListeners();
        break;
      }

      case 'APPLY_SNIPPET': {
        const snippet = this.snippets.find((s) => s.id === event.payload.id);
        if (!snippet) break;

        // 使用回数インクリメント
        this.snippets = this.snippets.map((s) =>
          s.id === snippet.id ? { ...s, useCount: (s.useCount || 0) + 1 } : s
        );
        saveSnippetsToStorage(this.snippets);

        // テキスト反映
        const contentToInsert = snippet.content;
        if (event.payload.insertMode === 'replace') {
          this.text = contentToInsert;
        } else if (event.payload.insertMode === 'prepend') {
          this.text = this.text.trim() ? `${contentToInsert}\n\n${this.text}` : contentToInsert;
        } else {
          // append
          this.text = this.text.trim() ? `${this.text}\n\n${contentToInsert}` : contentToInsert;
        }

        // 個別タブ内容があれば反映
        if (snippet.blueskyContent) {
          if (event.payload.insertMode === 'replace') {
            this.blueskyText = snippet.blueskyContent;
          } else if (event.payload.insertMode === 'prepend') {
            this.blueskyText = this.blueskyText.trim() ? `${snippet.blueskyContent}\n\n${this.blueskyText}` : snippet.blueskyContent;
          } else {
            this.blueskyText = this.blueskyText.trim() ? `${this.blueskyText}\n\n${snippet.blueskyContent}` : snippet.blueskyContent;
          }
        }
        if (snippet.threadsContent) {
          if (event.payload.insertMode === 'replace') {
            this.threadsText = snippet.threadsContent;
          } else if (event.payload.insertMode === 'prepend') {
            this.threadsText = this.threadsText.trim() ? `${snippet.threadsContent}\n\n${this.threadsText}` : snippet.threadsContent;
          } else {
            this.threadsText = this.threadsText.trim() ? `${this.threadsText}\n\n${snippet.threadsContent}` : snippet.threadsContent;
          }
        }
        if (snippet.threadsTopic) {
          this.threadsTopic = snippet.threadsTopic;
        }

        this.scheduleDraftSave();
        this.addToast({
          type: 'success',
          title: '📑 定型文を適用しました',
          message: `「${snippet.title}」を展開しました。`,
        });
        this.notifyListeners();
        break;
      }

      case 'SAVE_CURRENT_TEXT_AS_SNIPPET': {
        if (!this.text.trim()) {
          this.addToast({
            type: 'warning',
            title: '本文が空です',
            message: '定型文として保存するテキストを入力してください。',
          });
          break;
        }
        this.snippets = saveSnippet({
          title: event.payload.title,
          content: this.text,
          category: event.payload.category || 'custom',
          icon: event.payload.icon || '📑',
          blueskyContent: this.blueskyText.trim() ? this.blueskyText : undefined,
          threadsContent: this.threadsText.trim() ? this.threadsText : undefined,
          threadsTopic: this.threadsTopic.trim() ? this.threadsTopic : undefined,
        });
        this.addToast({
          type: 'success',
          title: '✨ 定型文として保存しました',
          message: `「${event.payload.title}」をテンプレートに追加しました。`,
        });
        this.notifyListeners();
        break;
      }

      case 'UPDATE_REPLY_SETTINGS': {
        const next = {
          ...this.replySettings,
          ...event.payload,
        };
        const hasTarget = Boolean(
          next.blueskyTargetUrl ||
          next.threadsTargetUrl ||
          next.blueskyResolved ||
          next.threadsResolved
        );
        next.enabled = hasTarget;
        this.replySettings = next;
        this.scheduleDraftSave();
        this.notifyListeners();
        break;
      }

      case 'SET_RESOLVED_REPLY_TARGET':
        if (event.payload.platform === 'Bluesky') {
          this.replySettings = {
            ...this.replySettings,
            enabled: true,
            blueskyResolved: event.payload.target,
            blueskyTargetUrl: this.replySettings.blueskyTargetUrl || event.payload.target.urlOrId || '',
            threadsResolved: null,
            threadsTargetUrl: '',
          };
        } else if (event.payload.platform === 'Threads') {
          this.replySettings = {
            ...this.replySettings,
            enabled: true,
            threadsResolved: event.payload.target,
            threadsTargetUrl: this.replySettings.threadsTargetUrl || event.payload.target.urlOrId || '',
            blueskyResolved: null,
            blueskyTargetUrl: '',
          };
        }
        this.scheduleDraftSave();
        this.notifyListeners();
        break;

      case 'CLEAR_REPLY_TARGET':
        if (event.payload === 'Bluesky') {
          const nextTh = this.replySettings.threadsResolved;
          this.replySettings = {
            ...this.replySettings,
            blueskyTargetUrl: '',
            blueskyResolved: null,
            enabled: Boolean(nextTh),
          };
        } else if (event.payload === 'Threads') {
          const nextBk = this.replySettings.blueskyResolved;
          this.replySettings = {
            ...this.replySettings,
            threadsTargetUrl: '',
            threadsResolved: null,
            enabled: Boolean(nextBk),
          };
        } else {
          this.replySettings = {
            enabled: false,
            blueskyTargetUrl: '',
            threadsTargetUrl: '',
            blueskyResolved: null,
            threadsResolved: null,
          };
        }
        this.scheduleDraftSave();
        this.notifyListeners();
        break;

      case 'REFRESH_SCHEDULED_POSTS':
        this.scheduledPosts = loadScheduledPostsFromStorage();
        this.notifyListeners();
        break;

      case 'REUSE_TEXT':
        this.text = event.payload;
        this.scheduleDraftSave();
        this.notifyListeners();
        break;

      case 'OPEN_MODAL':
        this.modals[event.payload] = true;
        this.notifyListeners();
        break;

      case 'CLOSE_MODAL':
        this.modals[event.payload] = false;
        if (event.payload === 'posting') {
          this.machineState = 'READY';
        }
        this.notifyListeners();
        break;

      case 'TOGGLE_MODAL':
        this.modals[event.payload] = !this.modals[event.payload];
        this.notifyListeners();
        break;

      case 'CONFIRM_QUIT':
        this.saveDraftSync();
        this.modals.quitConfirm = false;
        this.isAppTerminated = true;
        this.machineState = 'TERMINATED';
        this.notifyListeners();
        break;

      case 'NOTIFY':
        this.addToast(event.payload);
        this.notifyListeners();
        break;

      case 'DISMISS_TOAST':
        this.toasts = this.toasts.filter((t) => t.id !== event.payload);
        this.notifyListeners();
        break;

      default:
        break;
    }
  }

  private handleToggleDemoMode(): void {
    const isDemo = this.computeIsDemoMode();
    if (isDemo) {
      // 1. LIVEモードへの切り替え: 古いDEMOモードのキャッシュデータや残留ステート（予約投稿・履歴・通信ログ・リプライ設定・下書き）を一括自動クリーンアップ
      performCleanStateInitialization({
        isLiveMode: true,
        reason: 'switch_to_live',
        forceHistoryClean: true,
      });

      // 2. メディエーター側のステートも完全にクリーンな初期状態へリセット
      this.scheduledPosts = loadScheduledPostsFromStorage();
      this.history = loadHistoryFromStorage();
      this.replySettings = { ...CLEAN_REPLY_SETTINGS };
      this.text = '';
      this.blueskyText = '';
      this.threadsText = '';
      this.images = [];
      clearDraftFromStorage();

      const vault = getSavedAccountVault();
      let restoredCreds: ApiCredentials = {
        blueskyIdentifier: '',
        blueskyAppPassword: '',
        blueskyServiceUrl: 'https://bsky.social',
        blueskyConnected: false,
        blueskyHandle: '',
        threadsUserId: '',
        threadsAccessToken: '',
        threadsConnected: false,
        threadsUsername: '',
        isDemoMode: false,
      };

      if (vault.bluesky?.identifier || vault.threads?.accessToken) {
        restoredCreds = restoreFromVault(restoredCreds, 'all');
        restoredCreds.isDemoMode = false;
        this.credentials = restoredCreds;
        localStorage.setItem('cross_poster_creds', JSON.stringify(restoredCreds));

        // バックグラウンドで完全復号化を完了して反映
        restoreFromVaultAsync(restoredCreds, 'all').then((full) => {
          this.credentials = { ...full, isDemoMode: false };
          localStorage.setItem('cross_poster_creds', JSON.stringify(this.credentials));
          this.notifyListeners();
        });

        this.addToast({
          type: 'success',
          title: '🚀 LIVE（本番）モードに切り替えました',
          message: '古いDEMOキャッシュを一掃し、保存済みの本番アカウントでクリーンに開始しました。',
        });
      } else {
        this.credentials = restoredCreds;
        localStorage.setItem('cross_poster_creds', JSON.stringify(restoredCreds));
        this.addToast({
          type: 'info',
          title: '🚀 LIVE（本番）モードに切り替えました',
          message: '古いDEMOキャッシュを一掃しました。右上の「⚙️ 設定」から本番アカウントを連携してください。',
        });
      }
    } else {
      const { blueskyIsDemo, threadsIsDemo } = checkIsDemoCredentials(this.credentials);
      if (!blueskyIsDemo || !threadsIsDemo) {
        saveCredentialsToVault(this.credentials);
      }
      clearAllScheduledPosts();
      this.scheduledPosts = [];
      this.replySettings = { ...CLEAN_REPLY_SETTINGS };

      this.credentials = {
        ...DEMO_CREDENTIALS,
        isDemoMode: true,
      };
      localStorage.setItem('cross_poster_creds', JSON.stringify(this.credentials));
      this.addToast({
        type: 'info',
        title: '🎯 DEMO（シュミレーション）モードに切り替えました',
        message: '実際のSNSには送信されず、安全に投稿シミュレーションが可能です。',
      });
    }
    this.notifyListeners();
  }

  private scheduleDraftSave(): void {
    this.draftStatus = 'saving';
    this.machineState = 'DRAFT_SAVING';
    if (this.draftSaveTimer) {
      clearTimeout(this.draftSaveTimer);
    }
    this.draftSaveTimer = setTimeout(() => {
      this.saveDraftSync();
      this.machineState = 'READY';
      this.notifyListeners();
    }, 400);
  }

  public saveDraftSync(): void {
    const now = Date.now();
    const draft: DraftData = {
      text: this.text,
      blueskyText: this.blueskyText,
      threadsText: this.threadsText,
      customPlatformText: this.customPlatformText,
      images: this.images,
      postToBluesky: this.postToBluesky,
      postToThreads: this.postToThreads,
      threadsTopic: this.threadsTopic,
      autoSplit: this.autoSplit,
      includeNumbering: this.includeNumbering,
      lastSavedAt: now,
      replySettings: this.replySettings,
    };
    const result = saveDraftToStorage(draft);
    if (result.success) {
      this.draftStatus = 'saved';
      this.lastSavedAt = now;
      this.draftError = undefined;
    } else {
      this.draftStatus = 'error';
      this.draftError = result.error;
    }
  }

  private addToast(toast: Omit<ToastMessage, 'id'>): void {
    // 同一のタイトルおよびメッセージを持つトーストが現在既に表示されている場合は多重追加を防ぐ
    const isDuplicate = this.toasts.some(
      (existing) => existing.title === toast.title && existing.message === toast.message
    );
    if (isDuplicate) {
      return;
    }

    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newToast: ToastMessage = { ...toast, id };
    this.toasts = [...this.toasts.slice(-4), newToast];

    const duration = toast.duration || (toast.type === 'error' ? 8000 : 4000);
    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t.id !== id);
      this.notifyListeners();
    }, duration);
  }
}
