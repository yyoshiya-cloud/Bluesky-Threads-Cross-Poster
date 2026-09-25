import React, { useState, useRef } from 'react';
import { ApiCredentials, ThemeAccentId } from '../types';
import { Settings, History, LogOut, RotateCcw, Clock, BookOpen, Sparkles, Power, BarChart3, Info } from 'lucide-react';
import { hasSavedAccountInVault } from '../utils/accountVault';
import { calculateTokenExpiryInfo } from '../utils/tokenExpiry';
import { ThemeSelector } from './ThemeSelector';
import { getModeSecurityConfig } from '../utils/modeSecurity';
import { APP_VERSION } from '../config/appInfo';

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
  currentTheme: ThemeAccentId;
  onSelectTheme: (themeId: ThemeAccentId) => void;
  onLogout?: (platform?: 'all' | 'bluesky' | 'threads') => void;
  onRestoreSavedAccount?: (platform?: 'all' | 'bluesky' | 'threads') => void;
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
  currentTheme,
  onSelectTheme,
  onLogout,
  onRestoreSavedAccount,
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

  // タイトルの場所を左クリック3回検知
  const handleTitleClick = (e: React.MouseEvent) => {
    // 左クリック（e.button === 0）のみを検知（undefinedも許容）
    if (e.button !== 0 && e.button !== undefined) return;

    // ブラウザ標準のトリプルクリック（e.detail >= 3）を即座に検知
    if (e.detail && e.detail >= 3) {
      titleClickCountRef.current = 0;
      if (titleClickTimerRef.current) {
        clearTimeout(titleClickTimerRef.current);
        titleClickTimerRef.current = null;
      }
      triggerModeSwitch();
      return;
    }

    // 手動タイマーによる3回クリックカウント
    titleClickCountRef.current += 1;
    const count = titleClickCountRef.current;

    if (titleClickTimerRef.current) {
      clearTimeout(titleClickTimerRef.current);
    }

    if (count >= 3) {
      titleClickCountRef.current = 0;
      titleClickTimerRef.current = null;
      triggerModeSwitch();
    } else {
      // 3.5秒以内に3回クリックすれば判定
      titleClickTimerRef.current = setTimeout(() => {
        titleClickCountRef.current = 0;
        titleClickTimerRef.current = null;
      }, 3500);
    }
  };

  const isBlueskyLoggedIn = Boolean(
    credentials.blueskyConnected || (credentials.blueskyIdentifier && credentials.blueskyAppPassword)
  );
  const isThreadsLoggedIn = Boolean(credentials.threadsConnected || credentials.threadsAccessToken);

  return (
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
                    アプリ情報 (Version {APP_VERSION})
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
            className="relative bg-gradient-to-r from-blue-600/10 to-purple-600/10 hover:from-blue-600/20 hover:to-purple-600/20 text-sky-300 hover:text-sky-200 p-2 sm:px-3 sm:py-1.5 rounded-lg border border-sky-500/30 hover:border-sky-500/50 transition flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-xs"
            title="Bluesky & Threads のエンゲージメント分析・リアクション比較・データエクスポート"
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
            className="relative bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white p-2 sm:px-3 sm:py-1.5 rounded-lg border border-slate-800 transition flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            title="アプリの使い方と機能一覧ガイドを表示"
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
            className="relative bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white p-2 sm:px-3 sm:py-1.5 rounded-lg border border-slate-800 transition flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            title="カレンダー形式で予約済みの投稿を表示・編集・管理"
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
          className="relative bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white p-2 sm:px-3 sm:py-1.5 rounded-lg border border-slate-800 transition flex items-center gap-1.5 text-xs font-medium cursor-pointer"
          title="投稿履歴を表示"
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
        <ThemeSelector
          currentTheme={currentTheme}
          onSelectTheme={onSelectTheme}
          variant="header-dropdown"
        />

        {/* 設定ボタン (設定画面が開いていない時のみ表示) */}
        {!isSettingsOpen && (
          <button
            id="header-settings-button"
            type="button"
            onClick={onToggleSettings || onOpenSettings}
            className="bg-accent-subtle hover:brightness-110 text-accent-light border border-accent p-2 sm:px-3.5 sm:py-1.5 rounded-lg transition flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-sm"
            title="API・アカウント認証設定 & テーマ変更"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">設定</span>
          </button>
        )}

        {/* アプリ終了ボタン */}
        {onOpenQuitConfirm && (
          <button
            id="header-quit-button"
            type="button"
            onClick={onOpenQuitConfirm}
            className="bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-900/60 p-2 sm:px-3 sm:py-1.5 rounded-lg transition flex items-center gap-1.5 text-xs font-medium cursor-pointer shadow-sm"
            title="アプリケーションを終了 (Ctrl+Q / Cmd+Q)"
          >
            <Power className="w-4 h-4 text-rose-400/80" />
            <span className="hidden lg:inline">終了</span>
          </button>
        )}

        {/* 終了ボタンの右: アプリ説明ウインド表示ボタン */}
        {onOpenAboutApp && (
          <button
            id="header-about-app-button"
            type="button"
            onClick={onOpenAboutApp}
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-sky-300 border border-slate-800 hover:border-sky-500/50 p-2 sm:px-3 sm:py-1.5 rounded-lg transition flex items-center gap-1.5 text-xs font-medium cursor-pointer shadow-sm"
            title="CrossPost Web Studio アプリ情報・制作者プロフィールを表示"
          >
            <Info className="w-4 h-4 text-sky-400" />
            <span className="hidden lg:inline">アプリ情報</span>
          </button>
        )}
      </div>
    </header>
  );
};
