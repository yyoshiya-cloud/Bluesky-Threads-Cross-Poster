import React, { useState, useRef, useEffect } from 'react';
import { ApiCredentials, ThemeAccentId } from '../types';
import { Settings, History, LogOut, RotateCcw, Clock, BookOpen, Sparkles, Power, BarChart3, Info, Database, ShieldAlert, KeyRound, Lock, Unlock } from 'lucide-react';
import { hasSavedAccountInVault } from '../utils/accountVault';
import { calculateTokenExpiryInfo } from '../utils/tokenExpiry';
import { ThemeSelector } from './ThemeSelector';
import { getModeSecurityConfig } from '../utils/modeSecurity';
import { getAppVersion, getModeSwitchClickCount } from '../utils/adminConfig';

interface HeaderProps {
  credentials: ApiCredentials;
  isDemoMode?: boolean;
  onToggleDemoMode?: () => void;
  onOpenModePasswordModal?: () => void;
  onOpenSettings: () => void;
  isSettingsOpen?: boolean;
  onToggleSettings?: () => void;
  onOpenHistory: () => void;
  historyCount: number;
  onOpenAnalytics?: () => void;
  onOpenScheduledPosts?: () => void;
  scheduledPostsCount?: number;
  onOpenUserGuide?: () => void;
  onOpenQuitConfirm?: () => void;
  onOpenAboutApp?: () => void;
  onOpenServerVault?: () => void;
  isServerVaultOpen?: boolean;
  onToggleServerVault?: () => void;
  currentTheme: ThemeAccentId;
  onSelectTheme: (themeId: ThemeAccentId) => void;
  onLogout?: (platform?: 'all' | 'bluesky' | 'threads') => void;
  onRestoreSavedAccount?: (platform?: 'all' | 'bluesky' | 'threads') => void;
  isAdminMode?: boolean;
  onOpenAdminModal?: () => void;
  onDeactivateAdminMode?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  credentials,
  isDemoMode = false,
  onToggleDemoMode,
  onOpenModePasswordModal,
  onOpenSettings,
  isSettingsOpen = false,
  onToggleSettings,
  onOpenHistory,
  historyCount = 0,
  onOpenAnalytics,
  onOpenScheduledPosts,
  scheduledPostsCount = 0,
  onOpenUserGuide,
  onOpenQuitConfirm,
  onOpenAboutApp,
  onOpenServerVault,
  isServerVaultOpen = false,
  onToggleServerVault,
  currentTheme,
  onSelectTheme,
  onLogout,
  onRestoreSavedAccount,
  isAdminMode = false,
  onOpenAdminModal,
  onDeactivateAdminMode,
}) => {
  const [showQuickLogout, setShowQuickLogout] = useState(false);
  const hasSaved = hasSavedAccountInVault();

  // タイトル場所の左クリック3回用カウンター
  const titleClickCountRef = useRef<number>(0);
  const titleClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // パスワード設定（オン/オフ）に応じたモード切替トリガー
  const triggerModeSwitch = () => {
    // ライブモードからデモモードへの切替はパスワード入力を求めず即時切替
    if (!isDemoMode) {
      if (onToggleDemoMode) {
        onToggleDemoMode();
      }
      return;
    }

    // デモモードからライブ（本番）モードへの切替：
    // パスワード保護設定を確認（明示的にfalseでない限りは必ず認証モーダルを表示）
    const secConfig = getModeSecurityConfig();
    if (secConfig.requirePassword !== false && onOpenModePasswordModal) {
      onOpenModePasswordModal();
    } else if (onToggleDemoMode) {
      onToggleDemoMode();
    }
  };

  const [requiredClickCount, setRequiredClickCount] = useState<number>(() => getModeSwitchClickCount());

  useEffect(() => {
    const handleCountChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ count: number }>;
      if (customEvent.detail?.count) {
        setRequiredClickCount(customEvent.detail.count);
      } else {
        setRequiredClickCount(getModeSwitchClickCount());
      }
    };
    window.addEventListener('crosspost_mode_click_count_changed', handleCountChange);
    return () => {
      window.removeEventListener('crosspost_mode_click_count_changed', handleCountChange);
    };
  }, []);

  // タイトルの場所を左クリック指定回数検知（管理者設定値、初期値: 3回）
  const handleTitleClick = (e: React.MouseEvent) => {
    // 左クリック（e.button === 0）のみを検知（undefinedも許容）
    if (e.button !== 0 && e.button !== undefined) return;

    const targetClicks = requiredClickCount || 3;

    // ブラウザ標準の連続クリック（e.detail >= targetClicks）を即座に検知
    if (e.detail && e.detail >= targetClicks) {
      titleClickCountRef.current = 0;
      if (titleClickTimerRef.current) {
        clearTimeout(titleClickTimerRef.current);
        titleClickTimerRef.current = null;
      }
      triggerModeSwitch();
      return;
    }

    // 手動タイマーによる指定回数クリックカウント
    titleClickCountRef.current += 1;
    const count = titleClickCountRef.current;

    if (titleClickTimerRef.current) {
      clearTimeout(titleClickTimerRef.current);
    }

    if (count >= targetClicks) {
      titleClickCountRef.current = 0;
      titleClickTimerRef.current = null;
      triggerModeSwitch();
    } else {
      // クリック間隔猶予（回数に応じて3.5秒〜十分な時間を確保）
      const timeoutMs = Math.max(3500, targetClicks * 1200);
      titleClickTimerRef.current = setTimeout(() => {
        titleClickCountRef.current = 0;
        titleClickTimerRef.current = null;
      }, timeoutMs);
    }
  };

  const isBlueskyLoggedIn = Boolean(
    credentials.blueskyConnected || (credentials.blueskyIdentifier && credentials.blueskyAppPassword)
  );
  const isThreadsLoggedIn = Boolean(credentials.threadsConnected || credentials.threadsAccessToken);

  return (
    <div className="flex flex-col w-full shrink-0">
      {/* 管理者モード起動中バー */}
      {isAdminMode && (
        <div className="w-full bg-amber-950/90 border-b border-amber-500/50 px-4 py-1.5 flex items-center justify-between text-xs text-amber-200 shadow-md z-40">
          <div className="flex items-center gap-2 font-bold">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            <span>🔒 ADMIN MODE 起動中 — 投稿処理およびヘッダーボタンの操作はロックされています</span>
          </div>
          <div className="flex items-center gap-2">
            {onOpenAdminModal && (
              <button
                type="button"
                onClick={onOpenAdminModal}
                className="px-2.5 py-0.5 rounded-lg bg-amber-500/30 hover:bg-amber-500/50 text-amber-100 border border-amber-400/40 font-bold transition cursor-pointer text-[11px]"
              >
                ⚙️ 管理者設定
              </button>
            )}
            {onDeactivateAdminMode && (
              <button
                type="button"
                onClick={onDeactivateAdminMode}
                className="px-2.5 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold transition cursor-pointer text-[11px] border border-slate-700"
              >
                🔓 管理者モード終了
              </button>
            )}
          </div>
        </div>
      )}

      <header className="bg-[#0E1320]/95 backdrop-blur-md border-b border-slate-700/80 sticky top-0 z-30 px-3 sm:px-5 lg:px-6 h-13 flex items-center justify-between gap-3 shrink-0 shadow-sm">
      {/* ロゴ & タイトル（左クリック3回でモード切替） */}
      <div
        id="app-logo-button"
        onClick={handleTitleClick}
        className="flex items-center gap-2.5 select-none cursor-pointer group py-1 px-1.5 -ml-1.5 rounded-xl hover:bg-slate-800/60 transition relative"
      >
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden shadow-md shadow-blue-950/40 border border-slate-600/70 flex items-center justify-center bg-slate-900 shrink-0 group-hover:scale-105 group-hover:border-accent transition duration-200">
          <img
            src="/favicon.svg"
            alt="CrossPost Icon"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xs sm:text-sm font-bold text-slate-100 tracking-tight group-hover:text-white transition">
              CrossPost Web Studio
            </h1>
            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold tracking-wider badge-accent">
              BLUESKY & THREADS
            </span>

            {isDemoMode ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerModeSwitch();
                }}
                title="クリックしてLIVE（本番）モードに切り替え"
                className="px-1.5 py-0.2 rounded text-[9px] font-bold tracking-wider bg-sky-500/20 text-sky-300 border border-sky-400/40 flex items-center gap-1 shadow-sm hover:bg-sky-500/30 hover:text-white transition cursor-pointer"
              >
                <Sparkles className="w-2.5 h-2.5 text-sky-300" />
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                DEMO MODE
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerModeSwitch();
                }}
                title="クリックして安全なDEMOモードに切り替え"
                className="px-1.5 py-0.2 rounded text-[9px] font-bold tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shadow-sm hover:bg-emerald-500/30 hover:text-white transition cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                LIVE MODE
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-400 hidden md:block group-hover:text-slate-300 transition">
            Bluesky & Threads 同時投稿・長文自動分割・画像添付マネージャー
          </p>
        </div>
      </div>

      {/* ナビゲーション & アクション */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {/* 認証ステータスインジケータ */}
        <div className="relative">
          <div
            id="header-account-status-pill"
            onClick={() => setShowQuickLogout(!showQuickLogout)}
            className="cursor-pointer bg-[#0A0F1D] hover:bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/80 flex items-center gap-2.5 transition text-xs select-none shadow-xs"
            title="クリックしてアカウント接続状態を表示"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[11px]">🦋</span>
              {isBlueskyLoggedIn ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-slate-500" />
              )}
              <span className="text-[10px] text-slate-300 font-medium hidden md:inline truncate max-w-[120px]">
                {isBlueskyLoggedIn ? (credentials.blueskyHandle || 'Bluesky連携中') : '未連携'}
              </span>
            </div>
            <div className="h-3 w-[1px] bg-slate-700" />
            <div className="flex items-center gap-1.5">
              <span className="text-[11px]">🌀</span>
              {isThreadsLoggedIn ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-slate-500" />
              )}
              <span className="text-[10px] text-slate-300 font-medium hidden md:inline truncate max-w-[120px]">
                {isThreadsLoggedIn ? (credentials.threadsUsername || 'Threads連携中') : '未連携'}
              </span>
            </div>
          </div>

          {/* アカウント状態 & クイックログアウト ポップアップ */}
          {showQuickLogout && (
            <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 z-40 space-y-2.5 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-semibold text-slate-200">
                <span>連携アカウント情報</span>
                <button
                  type="button"
                  onClick={() => setShowQuickLogout(false)}
                  className="text-slate-400 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Bluesky アカウント状態 */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-base">🦋</span>
                  <div className="leading-tight">
                    <p className="font-medium text-slate-200 text-[11px] truncate max-w-[100px]">
                      {isBlueskyLoggedIn ? (credentials.blueskyHandle || '連携済み') : '未連携'}
                    </p>
                    <p className="text-[10px] text-slate-500">Bluesky</p>
                  </div>
                </div>
                {isBlueskyLoggedIn && onLogout && !isDemoMode && (
                  <button
                    type="button"
                    onClick={() => {
                      onLogout('bluesky');
                      setShowQuickLogout(false);
                    }}
                    className="text-[10px] text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 px-2 py-1 rounded transition cursor-pointer flex items-center gap-1"
                  >
                    <LogOut className="w-2.5 h-2.5" />
                    ログアウト
                  </button>
                )}
              </div>

              {/* Threads アカウント状態 */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-base">🌀</span>
                  <div className="leading-tight">
                    <p className="font-medium text-slate-200 text-[11px] truncate max-w-[100px]">
                      {isThreadsLoggedIn ? (credentials.threadsUsername || '連携済み') : '未連携'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-[10px] text-slate-500">Threads</p>
                      {!isDemoMode && isThreadsLoggedIn && credentials.threadsTokenExpiresAt && (() => {
                        const expiry = calculateTokenExpiryInfo(credentials.threadsTokenExpiresAt);
                        return (
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded font-medium ${
                              expiry.status === 'expired'
                                ? 'text-rose-400 bg-rose-950/60'
                                : expiry.status === 'warning'
                                ? 'text-amber-400 bg-amber-950/60'
                                : 'text-emerald-400 bg-emerald-950/60'
                            }`}
                            title={`有効期限: ${expiry.formattedDate}`}
                          >
                            {expiry.remainingDays > 0 ? `残${expiry.remainingDays}日` : expiry.formattedRelative}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                {isThreadsLoggedIn && onLogout && !isDemoMode && (
                  <button
                    type="button"
                    onClick={() => {
                      onLogout('threads');
                      setShowQuickLogout(false);
                    }}
                    className="text-[10px] text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 px-2 py-1 rounded transition cursor-pointer flex items-center gap-1"
                  >
                    <LogOut className="w-2.5 h-2.5" />
                    ログアウト
                  </button>
                )}
              </div>

              {/* 保存済みアカウントで再ログイン (実用モード時のみ有効) */}
              {hasSaved && onRestoreSavedAccount && !isDemoMode && (
                <div className="pt-1 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      onRestoreSavedAccount('all');
                      setShowQuickLogout(false);
                    }}
                    className="w-full text-center text-[10px] text-[#0085ff] hover:text-blue-300 py-1 hover:bg-[#0085ff]/10 rounded transition cursor-pointer flex items-center justify-center gap-1 font-semibold"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    保存済みアカウントで再ログイン
                  </button>
                </div>
              )}

              {/* 全ログアウト (実用モード時のみ有効) */}
              {(isBlueskyLoggedIn || isThreadsLoggedIn) && onLogout && !isDemoMode && (
                <div className="pt-1 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      onLogout('all');
                      setShowQuickLogout(false);
                    }}
                    className="w-full text-center text-[10px] text-rose-400 hover:text-rose-300 py-1 hover:bg-rose-950/20 rounded transition cursor-pointer"
                  >
                    すべてのアカウントからログアウト
                  </button>
                </div>
              )}

              {/* アプリ終了 */}
              {onOpenQuitConfirm && (
                <div className="pt-1 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickLogout(false);
                      onOpenQuitConfirm();
                    }}
                    className="w-full text-center text-[10px] text-slate-400 hover:text-rose-400 py-1 hover:bg-rose-950/20 rounded transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Power className="w-2.5 h-2.5" />
                    アプリケーションを終了 (Ctrl+Q)
                  </button>
                </div>
              )}

              {/* アプリ情報 */}
              {onOpenAboutApp && (
                <div className="pt-1 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={() => {
                      setShowQuickLogout(false);
                      onOpenAboutApp();
                    }}
                    className="w-full text-center text-[10px] text-slate-300 hover:text-sky-300 py-1 hover:bg-sky-950/20 rounded transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Info className="w-2.5 h-2.5 text-sky-400" />
                    アプリ情報 (Version {getAppVersion()})
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 分析・データボタン */}
        {onOpenAnalytics && (
          <button
            id="header-analytics-button"
            type="button"
            onClick={onOpenAnalytics}
            disabled={isAdminMode}
            className={`relative bg-gradient-to-r from-blue-600/10 to-purple-600/10 text-sky-300 p-2 sm:px-3 sm:py-1.5 rounded-lg border border-sky-500/30 transition flex items-center gap-1.5 text-xs font-semibold shadow-xs ${
              isAdminMode ? 'opacity-40 cursor-not-allowed' : 'hover:from-blue-600/20 hover:to-purple-600/20 hover:text-sky-200 hover:border-sky-500/50 cursor-pointer'
            }`}
            title={isAdminMode ? '管理者モード起動中のため操作不可' : 'Bluesky & Threads のエンゲージメント分析・リアクション比較・データエクスポート'}
          >
            <BarChart3 className="w-4 h-4 text-sky-400" />
            <span className="hidden sm:inline">分析・データ</span>
          </button>
        )}

        {/* 使い方ガイドボタン */}
        {onOpenUserGuide && (
          <button
            id="header-user-guide-button"
            type="button"
            onClick={onOpenUserGuide}
            disabled={isAdminMode}
            className={`relative bg-slate-900 text-slate-300 p-2 sm:px-3 sm:py-1.5 rounded-lg border border-slate-800 transition flex items-center gap-1.5 text-xs font-medium ${
              isAdminMode ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-800 hover:text-white cursor-pointer'
            }`}
            title={isAdminMode ? '管理者モード起動中のため操作不可' : 'アプリの使い方と機能一覧ガイドを表示'}
          >
            <BookOpen className="w-4 h-4 text-accent-light" />
            <span className="hidden md:inline">使い方</span>
          </button>
        )}

        {/* 予約カレンダーボタン */}
        {onOpenScheduledPosts && (
          <button
            id="header-scheduled-posts-button"
            type="button"
            onClick={onOpenScheduledPosts}
            disabled={isAdminMode}
            className={`relative bg-slate-900 text-slate-300 p-2 sm:px-3 sm:py-1.5 rounded-lg border border-slate-800 transition flex items-center gap-1.5 text-xs font-medium ${
              isAdminMode ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-800 hover:text-white cursor-pointer'
            }`}
            title={isAdminMode ? '管理者モード起動中のため操作不可' : 'カレンダー形式で予約済みの投稿を表示・編集・管理'}
          >
            <Clock className="w-4 h-4 text-accent-light" />
            <span className="hidden sm:inline">予約カレンダー</span>
            {scheduledPostsCount > 0 && (
              <span className="badge-accent text-[10px] font-bold px-1.5 py-0.2 rounded-full shadow-sm">
                {scheduledPostsCount}
              </span>
            )}
          </button>
        )}

        {/* 履歴ボタン */}
        <button
          id="header-history-button"
          type="button"
          onClick={onOpenHistory}
          disabled={isAdminMode}
          className={`relative bg-slate-900 text-slate-300 p-2 sm:px-3 sm:py-1.5 rounded-lg border border-slate-800 transition flex items-center gap-1.5 text-xs font-medium ${
            isAdminMode ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-800 hover:text-white cursor-pointer'
          }`}
          title={isAdminMode ? '管理者モード起動中のため操作不可' : '投稿履歴を表示'}
        >
          <History className="w-4 h-4" />
          <span className="hidden sm:inline">履歴</span>
          {historyCount > 0 && (
            <span className="bg-accent-primary text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full shadow-sm">
              {historyCount}
            </span>
          )}
        </button>

        {/* テーマカラー切り替え */}
        <div className={isAdminMode ? 'opacity-40 pointer-events-none' : ''}>
          <ThemeSelector
            currentTheme={currentTheme}
            onSelectTheme={onSelectTheme}
            variant="header-dropdown"
          />
        </div>

        {/* 設定ボタン (設定画面が開いていない時のみ表示) */}
        {!isSettingsOpen && (
          <button
            id="header-settings-button"
            type="button"
            onClick={onToggleSettings || onOpenSettings}
            disabled={isAdminMode}
            className={`bg-accent-subtle text-accent-light border border-accent p-2 sm:px-3.5 sm:py-1.5 rounded-lg transition flex items-center gap-1.5 text-xs font-bold shadow-sm ${
              isAdminMode ? 'opacity-40 cursor-not-allowed' : 'hover:brightness-110 cursor-pointer'
            }`}
            title={isAdminMode ? '管理者モード起動中のため操作不可' : 'API・アカウント認証設定 & テーマ変更'}
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">設定</span>
          </button>
        )}

        {/* LIVEモード限定: サーバー登録情報一覧ボタン（設定の右に配置） */}
        {!isDemoMode && (onOpenServerVault || onToggleServerVault) && (
          <button
            id="header-server-vault-button"
            type="button"
            onClick={onToggleServerVault || onOpenServerVault}
            disabled={isAdminMode}
            className={`relative p-2 sm:px-3 sm:py-1.5 rounded-lg border transition flex items-center gap-1.5 text-xs font-semibold shadow-xs ${
              isAdminMode
                ? 'opacity-40 cursor-not-allowed bg-emerald-950/40 text-emerald-300 border-emerald-500/40'
                : isServerVaultOpen
                  ? 'bg-emerald-600 text-white border-emerald-400 shadow-emerald-900/30 cursor-pointer'
                  : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 hover:text-emerald-200 border-emerald-500/40 hover:border-emerald-500/60 cursor-pointer'
            }`}
            title={isAdminMode ? '管理者モード起動中のため操作不可' : 'LIVEモードでサーバー（/data/account_vault.json）に登録されているBluesky・Threadsのアカウント情報を一覧で確認'}
          >
            <Database className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">サーバー登録情報</span>
          </button>
        )}

        {/* アプリ説明ウインド表示ボタン */}
        {onOpenAboutApp && (
          <button
            id="header-about-app-button"
            type="button"
            onClick={onOpenAboutApp}
            disabled={isAdminMode}
            className={`bg-slate-900 text-slate-300 border border-slate-800 p-2 sm:px-3 sm:py-1.5 rounded-lg transition flex items-center gap-1.5 text-xs font-medium shadow-sm ${
              isAdminMode ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-800 hover:text-sky-300 hover:border-sky-500/50 cursor-pointer'
            }`}
            title={isAdminMode ? '管理者モード起動中のため操作不可' : 'CrossPost Web Studio アプリ情報・制作者プロフィールを表示'}
          >
            <Info className="w-4 h-4 text-sky-400" />
            <span className="hidden lg:inline">アプリ情報</span>
          </button>
        )}

        {/* アプリ終了ボタン */}
        {onOpenQuitConfirm && (
          <button
            id="header-quit-button"
            type="button"
            onClick={onOpenQuitConfirm}
            disabled={isAdminMode}
            className={`bg-slate-900 text-slate-400 border border-slate-800 p-2 sm:px-3 sm:py-1.5 rounded-lg transition flex items-center gap-1.5 text-xs font-medium shadow-sm ${
              isAdminMode ? 'opacity-40 cursor-not-allowed' : 'hover:bg-rose-950/40 hover:text-rose-300 hover:border-rose-900/60 cursor-pointer'
            }`}
            title={isAdminMode ? '管理者モード起動中のため操作不可' : 'アプリケーションを終了 (Ctrl+Q / Cmd+Q)'}
          >
            <Power className="w-4 h-4 text-rose-400/80" />
            <span className="hidden lg:inline">終了</span>
          </button>
        )}
      </div>
    </header>
  </div>
  );
};
