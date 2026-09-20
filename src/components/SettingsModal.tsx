import React, { useState, useEffect } from 'react';
import { ApiCredentials, SavedAccountVault, ThemeAccentId } from '../types';
import {
  X as CloseIcon,
  Key,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
  LogOut,
  Sparkles,
  Check,
  HelpCircle,
  Loader2,
  RotateCcw,
  BookmarkCheck,
  Trash2,
  Calendar,
  Clock,
  Shield,
  Palette,
  Settings,
  Hash,
  AlertCircle,
  FileText,
  Link as LinkIcon,
} from 'lucide-react';
import {
  getModeSecurityConfig,
  setModePasswordRequired,
  updateModePassword,
  verifyModePassword,
} from '../utils/modeSecurity';
import { authenticateBluesky, verifyThreadsToken, refreshThreadsToken } from '../utils/postApi';
import {
  getSavedAccountVault,
  saveCredentialsToVault,
  deleteFromVault,
  formatSavedDate,
  updateThreadsTokenInVault,
  restoreFromVaultAsync,
} from '../utils/accountVault';
import { calculateTokenExpiryInfo, formatRefreshedDate } from '../utils/tokenExpiry';
import { ThemeSelector } from './ThemeSelector';
import { getThemeAccentConfig } from '../utils/themeManager';
import { TagTopicMaintenance } from './TagTopicMaintenance';
import { CommErrorModal } from './CommErrorModal';
import {
  getCommErrorLogs,
  recordCommInfo,
  recordCommSuccess,
} from '../utils/commErrorLogger';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  credentials: ApiCredentials;
  onSaveCredentials: (newCreds: ApiCredentials) => void;
  isDemoMode?: boolean;
  currentTheme?: ThemeAccentId;
  onSelectTheme?: (themeId: ThemeAccentId) => void;
  onLogout?: (platform?: 'all' | 'bluesky' | 'threads') => void;
  onDeleteSavedAccount?: (platform: 'all' | 'bluesky' | 'threads') => void;
  onOpenUserGuide?: () => void;
  onOpenCommErrors?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  credentials,
  onSaveCredentials,
  isDemoMode = false,
  currentTheme = 'sky',
  onSelectTheme,
  onLogout,
  onDeleteSavedAccount,
  onOpenCommErrors,
}) => {
  const [form, setForm] = useState<ApiCredentials>({ ...credentials });
  const [vault, setVault] = useState<SavedAccountVault>(() => getSavedAccountVault());
  const [showBlueskyPassword, setShowBlueskyPassword] = useState(false);
  const [showThreadsToken, setShowThreadsToken] = useState(false);
  const [isBlueskyLoggingIn, setIsBlueskyLoggingIn] = useState(false);
  const [isThreadsVerifying, setIsThreadsVerifying] = useState(false);
  const [isRefreshingThreadsToken, setIsRefreshingThreadsToken] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [isCommLogModalOpen, setIsCommLogModalOpen] = useState(false);
  const [platformTab, setPlatformTab] = useState<'bluesky' | 'threads' | 'appearance' | 'maintenance' | 'security'>('bluesky');
  const [showAdvancedPds, setShowAdvancedPds] = useState(false);

  // デモモード判定（設定画面でのデモモード時はログボタンを非表示）
  const isEffectiveDemoMode = Boolean(isDemoMode || credentials.isDemoMode || form.isDemoMode);

  // モード切替パスワード設定用ステート
  const [secConfig, setSecConfig] = useState(() => getModeSecurityConfig());
  const [secCurrentPassword, setSecCurrentPassword] = useState('');
  const [secNewPassword, setSecNewPassword] = useState('');
  const [secConfirmPassword, setSecConfirmPassword] = useState('');
  const [showSecCurrentPassword, setShowSecCurrentPassword] = useState(false);
  const [showSecNewPassword, setShowSecNewPassword] = useState(false);
  const [showSecConfirmPassword, setShowSecConfirmPassword] = useState(false);
  const [secMessage, setSecMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    setForm({ ...credentials });
    setVault(getSavedAccountVault());
    setShowBlueskyPassword(false);
    setShowThreadsToken(false);
  }, [credentials, isOpen]);

  // Escキーでハンバーガー設定ドロワーを閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const refreshVault = () => {
    setVault(getSavedAccountVault());
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const isActualDemo =
      Boolean(form.blueskyIdentifier?.includes('demo') ||
      form.blueskyAppPassword?.includes('demo') ||
      form.threadsAccessToken?.includes('DEMO'));
    const updatedForm: ApiCredentials = {
      ...form,
      isDemoMode: isActualDemo,
    };
    onSaveCredentials(updatedForm);
    saveCredentialsToVault(updatedForm);
    refreshVault();
    onClose();
  };

  // 保存済みBlueskyアカウントでログイン
  const handleRestoreBluesky = async () => {
    if (isDemoMode) {
      setTestResult('DEMOモード中は再ログインできません。');
      return;
    }
    if (!vault.bluesky) return;
    const restored = await restoreFromVaultAsync(form, 'bluesky');
    setForm(restored);
    onSaveCredentials(restored);
    recordCommSuccess({
      platform: 'Bluesky',
      action: '記憶アカウント再ログイン',
      requestSummary: `アカウント: @${restored.blueskyHandle}`,
      message: `保存されたBlueskyアカウント (@${restored.blueskyHandle}) で再ログイン・セッション復元に成功しました`,
    });
    setTestResult(`🎉 保存済みBlueskyアカウント (@${restored.blueskyHandle}) で再ログインしました！（AES-256復号完了）`);
  };

  // 保存済みThreads認証キーで再ログイン
  const handleRestoreThreads = async () => {
    if (isDemoMode) {
      setTestResult('DEMOモード中は再ログインできません。');
      return;
    }
    if (!vault.threads) return;
    const restored = await restoreFromVaultAsync(form, 'threads');
    setForm(restored);
    onSaveCredentials(restored);
    recordCommSuccess({
      platform: 'Threads',
      action: '記憶認証キー再ログイン',
      requestSummary: `アカウント: ${restored.threadsUsername || restored.threadsUserId}`,
      message: `保存されたThreads認証キー (${restored.threadsUsername || restored.threadsUserId}) で再ログイン・セッション復元に成功しました`,
    });
    setTestResult(`🎉 保存済みThreadsアカウント (${restored.threadsUsername}) で再ログインしました！（AES-256復号完了）`);
  };

  // 保存済みの本番アカウントを一括再ログイン
  const handleRestoreAll = async () => {
    if (isDemoMode) {
      setTestResult('DEMOモード中は再ログインできません。');
      return;
    }
    if (!vault.bluesky && !vault.threads) {
      setTestResult('⚠️ 保存されている本番アカウント情報がありません。');
      return;
    }
    const restored = await restoreFromVaultAsync(form, 'all');
    setForm(restored);
    onSaveCredentials(restored);
    recordCommSuccess({
      platform: 'All',
      action: '全記憶アカウント一括再ログイン',
      message: '保存済みの本番アカウント（Bluesky & Threads）で一括再ログインしました',
    });
    setTestResult('🎉 保存済みの本番アカウント（Bluesky & Threads）で再ログインしました！（AES-256復号完了）');
  };

  // 保存済みアカウントの記憶を削除
  const handleDeleteVaultAccount = (platform: 'all' | 'bluesky' | 'threads') => {
    deleteFromVault(platform);
    refreshVault();
    if (onDeleteSavedAccount) onDeleteSavedAccount(platform);
    recordCommInfo({
      platform: platform === 'bluesky' ? 'Bluesky' : platform === 'threads' ? 'Threads' : 'All',
      action: '記憶アカウント削除',
      message: `保存されたアカウント記憶 (${platform}) を安全に削除しました`,
    });
    setTestResult(
      platform === 'bluesky'
        ? 'Blueskyの記憶されたアカウント情報を削除しました。'
        : platform === 'threads'
        ? 'Threadsの記憶された認証キーを削除しました。'
        : '保存されていたすべてのアカウント記憶を削除しました。'
    );
  };

  // Bluesky アプリパスワード認証テスト & ログイン実行
  const handleBlueskyLogin = async () => {
    if (isDemoMode) {
      setTestResult('DEMOモード中はログイン・認証変更はロックされています。');
      return;
    }
    if (!form.blueskyIdentifier || !form.blueskyAppPassword) {
      setTestResult('⚠️ Blueskyのハンドルとアプリパスワードを入力してください。');
      return;
    }

    const cleanId = form.blueskyIdentifier.trim().replace(/^@/, '').replace(/\s+/g, '');
    const cleanPass = form.blueskyAppPassword.trim().replace(/\s+/g, '').replace(/[−―ー－]/g, '-');
    const finalId = cleanId.includes('.') ? cleanId : `${cleanId}.bsky.social`;

    setIsBlueskyLoggingIn(true);
    setTestResult(null);

    const result = await authenticateBluesky(
      finalId,
      cleanPass,
      form.blueskyServiceUrl || 'https://bsky.social'
    );

    setIsBlueskyLoggingIn(false);

    if (result.success && result.session) {
      const updated: ApiCredentials = {
        ...form,
        blueskyConnected: true,
        blueskyIdentifier: finalId,
        blueskyAppPassword: cleanPass,
        blueskyHandle: result.session.handle || finalId,
        blueskyDid: result.session.did,
        blueskyAccessJwt: result.session.accessJwt,
      };
      setForm(updated);
      onSaveCredentials(updated);
      saveCredentialsToVault(updated);
      refreshVault();
      if (result.isDemo) {
        setTestResult(`ℹ️ デモ用Bluesky認証情報として設定しました（@${result.session.handle}）。`);
      } else {
        setTestResult(`🎉 Bluesky (@${result.session.handle}) への認証に成功し、アプリパスワードをAES-256暗号化保管しました！`);
      }
    } else {
      setTestResult(`❌ Bluesky接続失敗: ${result.error || '認証できませんでした。ハンドル名またはアプリパスワードをご確認ください。'}`);
    }
  };

  // Threads アクセストークン検証 & 接続実行
  const handleThreadsVerify = async () => {
    if (isDemoMode) {
      setTestResult('DEMOモード中はログイン・認証変更はロックされています。');
      return;
    }
    if (!form.threadsAccessToken || !form.threadsAccessToken.trim()) {
      setTestResult('⚠️ Threadsのアクセストークンを入力してください。');
      document.getElementById('settings-threads-token-input')?.focus();
      return;
    }

    const cleanToken = form.threadsAccessToken.trim().replace(/\s+/g, '');
    const cleanUserId = (form.threadsUserId || '').trim() || 'me';

    setIsThreadsVerifying(true);
    setTestResult(null);

    const result = await verifyThreadsToken(
      cleanUserId,
      cleanToken
    );

    setIsThreadsVerifying(false);

    if (result.success) {
      const now = Date.now();
      const defaultExpiresAt = form.threadsTokenExpiresAt && form.threadsTokenExpiresAt > now
        ? form.threadsTokenExpiresAt
        : now + (60 * 24 * 60 * 60 * 1000);

      const updated: ApiCredentials = {
        ...form,
        threadsConnected: true,
        threadsUsername: result.username ? `@${result.username}` : form.threadsUsername || '@Threads_User',
        threadsUserId: result.id || form.threadsUserId || 'me',
        threadsTokenExpiresAt: defaultExpiresAt,
        threadsTokenRefreshedAt: form.threadsTokenRefreshedAt || now,
        threadsTokenExpiresIn: 5184000,
      };
      setForm(updated);
      onSaveCredentials(updated);
      saveCredentialsToVault(updated);
      refreshVault();

      const expiryInfo = calculateTokenExpiryInfo(defaultExpiresAt);
      if (result.isDemo) {
        setTestResult('ℹ️ デモ用Threads認証情報として設定しました。（有効期限: 60日間）');
      } else {
        setTestResult(`🎉 Threads (${updated.threadsUsername}) の接続に成功し、認証キーをAES-256暗号化保管しました！（有効期限: ${expiryInfo.formattedDate}）`);
      }
    } else {
      setTestResult(`❌ Threads接続失敗: ${result.error || 'アクセストークンが無効または期限切れです。'}`);
    }
  };

  // Threads Long-Lived Token 有効期限更新
  const handleThreadsTokenRefresh = async () => {
    const tokenToRefresh = form.threadsAccessToken || vault.threads?.accessToken;
    if (!tokenToRefresh) {
      setTestResult('⚠️ 有効期限を更新するThreadsアクセストークンが入力されていません。');
      return;
    }

    setIsRefreshingThreadsToken(true);
    setTestResult(null);

    const res = await refreshThreadsToken(tokenToRefresh);
    setIsRefreshingThreadsToken(false);

    if (res.success && res.accessToken) {
      const updated: ApiCredentials = {
        ...form,
        threadsAccessToken: res.accessToken,
        threadsConnected: true,
        threadsTokenExpiresAt: res.expiresAt,
        threadsTokenRefreshedAt: res.refreshedAt || Date.now(),
        threadsTokenExpiresIn: res.expiresIn,
      };
      setForm(updated);
      onSaveCredentials(updated);
      await updateThreadsTokenInVault(
        res.accessToken,
        res.expiresIn,
        res.expiresAt,
        res.refreshedAt
      );
      refreshVault();

      const expiryInfo = calculateTokenExpiryInfo(res.expiresAt);
      setTestResult(
        `🎉 Threads Long-Lived Token の有効期限を更新（60日間延長）しました！（次回有効期限: ${expiryInfo.formattedDate}、残り約60日）`
      );
    } else {
      if (res.requiresReLogin) {
        setTestResult(
          `⚠️【再ログインが必要】ThreadsのLong-Livedトークンは有効期限（expires_in）が残っている間しか自動更新できません。有効期限が完全に切れているため、下の入力フォームに新しいアクセストークンを入力して再接続（再ログイン）してください。`
        );
      } else {
        setTestResult(`❌ トークン有効期限更新失敗: ${res.error || '通信に失敗しました。'}`);
      }
    }
  };

  const isBlueskyLoggedIn = Boolean(form.blueskyConnected || (form.blueskyIdentifier && form.blueskyAppPassword));
  const isThreadsLoggedIn = Boolean(form.threadsConnected || form.threadsAccessToken);

  return (
    <aside
      id="settings-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Bluesky & Threads 設定メニュー"
      style={{
        transform: isOpen ? 'translateX(0%)' : 'translateX(100%)',
        transition: 'transform 320ms cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'transform',
      }}
      className={`absolute inset-x-0 top-0 z-30 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-full ${
        isOpen ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      {/* モーダルヘッダー */}
      <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-800 bg-slate-950/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-accent-subtle text-accent-light border border-accent">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>設定メニュー</span>
                <span className="text-xs font-normal text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700/60 hidden sm:inline">
                  Bluesky & Threads
                </span>
              </h2>
              <p className="text-xs text-slate-400">リアルタイムプレビュー領域で認証・外観・アカウントを管理</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* タイトル行の「ログ」ボタン（デモモード時は非表示、実用モード時は画面にログファイルを表示） */}
            {!isEffectiveDemoMode && (
              <button
                id="settings-title-comm-logs-button"
                type="button"
                onClick={() => {
                  if (onOpenCommErrors) {
                    onOpenCommErrors();
                  } else {
                    setIsCommLogModalOpen(true);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-xs"
                title="通信ログ（接続試行・成功・エラー経緯）を画面に表示"
              >
                <FileText className="w-3.5 h-3.5 text-purple-400" />
                <span>ログ</span>
                {getCommErrorLogs().length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-900/80 text-purple-200 border border-purple-700/60">
                    {getCommErrorLogs().length}
                  </span>
                )}
              </button>
            )}

            <button
              id="close-settings-modal-button"
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold shadow-xs"
              title="設定メニューを閉じてリアルタイムプレビューに戻る"
            >
              <span>プレビューへ戻る</span>
              <CloseIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* プラットフォーム切り替えタブ */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-5 sm:px-6 pt-2 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setPlatformTab('bluesky')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
              platformTab === 'bluesky'
                ? 'border-[#0085ff] text-[#0085ff] bg-[#0085ff]/5 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-4 h-4 rounded-full bg-[#0085ff]/20 flex items-center justify-center text-[10px] text-[#0085ff]">
              🦋
            </span>
            <span>Bluesky</span>
            {isBlueskyLoggedIn ? (
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                連携中
              </span>
            ) : (
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400">
                未連携
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setPlatformTab('threads')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
              platformTab === 'threads'
                ? 'border-purple-500 text-purple-400 bg-purple-500/5 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🌀</span>
            <span>Threads</span>
            {isThreadsLoggedIn ? (
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                連携中
              </span>
            ) : (
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400">
                未連携
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setPlatformTab('appearance')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
              platformTab === 'appearance'
                ? 'border-accent-primary text-accent-light bg-accent-subtle rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-accent-light" />
            <span>テーマ・外観</span>
          </button>

          <button
            type="button"
            onClick={() => setPlatformTab('maintenance')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
              platformTab === 'maintenance'
                ? 'border-sky-400 text-sky-300 bg-sky-500/10 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Hash className="w-3.5 h-3.5 text-sky-400" />
            <span>ハッシュタグ・トピック</span>
          </button>

          {!isDemoMode && (
            <button
              type="button"
              onClick={() => setPlatformTab('security')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${
                platformTab === 'security'
                  ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10 rounded-t-lg'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>モード切替セキュリティ</span>
            </button>
          )}
        </div>

        {/* フォーム本体 */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* 保存済みアカウントがある場合の一括再ログイン通知バナー (Bluesky / Threadsタブのみ表示) */}
          {(platformTab === 'bluesky' || platformTab === 'threads') && !isDemoMode && (vault.bluesky || vault.threads) && (
            <div className="p-3 sm:p-3.5 rounded-xl bg-gradient-to-r from-blue-950/50 to-purple-950/40 border border-blue-800/50 flex flex-wrap items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-[#0085ff]/20 text-[#0085ff] shrink-0">
                  <BookmarkCheck className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <span className="font-bold text-slate-200">登録済みアカウント情報を記憶しています</span>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400 mt-0.5">
                    {vault.bluesky && (
                      <span className="text-sky-300">🦋 @{vault.bluesky.handle}</span>
                    )}
                    {vault.bluesky && vault.threads && <span>•</span>}
                    {vault.threads && (
                      <span className="text-purple-300">🌀 {vault.threads.username || vault.threads.userId}</span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRestoreAll}
                className="px-3 py-1.5 rounded-lg bg-[#0085ff] hover:bg-blue-600 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-600/20 cursor-pointer ml-auto shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>保存済みアカウントで再ログイン</span>
              </button>
            </div>
          )}

          {/* テスト結果メッセージ (Bluesky / Threadsタブのみ表示) */}
          {(platformTab === 'bluesky' || platformTab === 'threads') && testResult && (
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-700/80 text-xs text-slate-200 flex flex-wrap items-center justify-between gap-2 animate-in fade-in duration-200">
              <span className="flex-1 min-w-[200px]">{testResult}</span>
              <div className="flex items-center gap-2 shrink-0">
                {!isEffectiveDemoMode && (testResult.includes('❌') || testResult.includes('⚠️') || testResult.includes('失敗')) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenCommErrors) {
                        onOpenCommErrors();
                      } else {
                        setIsCommLogModalOpen(true);
                      }
                    }}
                    className="px-2.5 py-1 rounded bg-purple-950/70 hover:bg-purple-900 text-purple-200 border border-purple-800/80 text-[11px] font-medium flex items-center gap-1 transition cursor-pointer"
                    title="通信ログを画面に表示"
                  >
                    <FileText className="w-3 h-3 text-purple-400" />
                    <span>ログ表示</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setTestResult(null)}
                  className="text-slate-400 hover:text-slate-200 p-1"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 🦋 BLUESKY タブ */}
          {/* ======================================================== */}
          {platformTab === 'bluesky' && (
            <div className="space-y-5">
              {/* Bluesky 連携状態ステータスバー */}
              <div className="flex flex-wrap items-center justify-between p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0085ff]/10 text-[#0085ff] flex items-center justify-center font-bold text-base border border-[#0085ff]/30 shadow-inner">
                    🦋
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-slate-200">Bluesky (AT Protocol) 連携</h3>
                      {isBlueskyLoggedIn ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          連携済み
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          未接続
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isBlueskyLoggedIn
                        ? `ログイン中: @${form.blueskyHandle || form.blueskyIdentifier}`
                        : 'アプリパスワードを使ってBlueskyアカウントに安全に接続します'}
                    </p>
                  </div>
                </div>

                {isBlueskyLoggedIn && !isDemoMode && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onLogout) onLogout('bluesky');
                      setForm((prev) => ({
                        ...prev,
                        blueskyConnected: false,
                        blueskyIdentifier: '',
                        blueskyAppPassword: '',
                        blueskyHandle: '',
                        blueskyDid: '',
                        blueskyAccessJwt: '',
                      }));
                      recordCommInfo({
                        platform: 'Bluesky',
                        action: 'Blueskyログアウト',
                        message: 'Blueskyアカウントからログアウトしました（接続解除）',
                      });
                      setTestResult('Blueskyからログアウトしました。（※保存されたアカウント記憶からいつでも再ログイン可能です）');
                    }}
                    className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 px-3 py-1.5 rounded-lg border border-rose-900/40 transition cursor-pointer flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Blueskyからログアウト
                  </button>
                )}
              </div>

              {/* 保存済みBlueskyアカウント表示カード (実用モード時のみ表示) */}
              {!isDemoMode && vault.bluesky && (
                <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-800/40 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <BookmarkCheck className="w-4 h-4 text-[#0085ff] shrink-0" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-200">記憶されたアカウント</span>
                        <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40 flex items-center gap-1">
                          <Shield className="w-2.5 h-2.5" />
                          AES-256 暗号化
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {formatSavedDate(vault.bluesky.savedAt)} 保存
                        </span>
                      </div>
                      <p className="text-xs text-sky-400 font-mono mt-0.5">@{vault.bluesky.handle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      disabled={isDemoMode}
                      onClick={handleRestoreBluesky}
                      className="px-2.5 py-1.5 rounded-lg bg-[#0085ff]/20 hover:bg-[#0085ff]/30 disabled:opacity-40 disabled:cursor-not-allowed text-[#0085ff] border border-[#0085ff]/40 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                      title={isDemoMode ? 'DEMOモード中は再ログインできません' : '記憶されたアカウント情報で再ログインします（AES-256復号）'}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      このアカウントで再ログイン
                    </button>
                    <button
                      type="button"
                      disabled={isDemoMode}
                      onClick={() => handleDeleteVaultAccount('bluesky')}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                      title={isDemoMode ? 'DEMOモード中は削除できません' : '保存されたBlueskyアカウント記憶を削除'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Bluesky 認証入力カード */}
              <div className="bg-slate-950/50 rounded-xl p-4 sm:p-5 border border-slate-800/80 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-[#0085ff]" />
                    <span className="text-xs font-bold text-slate-200">アカウント接続情報</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40 flex items-center gap-1">
                      <Shield className="w-2.5 h-2.5" />
                      AES-256 暗号化保管
                    </span>
                  </div>
                  <a
                    href="https://bsky.app/settings/app-passwords"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-[#0085ff] hover:underline flex items-center gap-1"
                  >
                    <span>アプリパスワード管理画面を開く</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="space-y-4">
                  {/* ハンドル / メール */}
                  <div data-context-target="true" className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-300">
                      Bluesky ハンドル / ユーザー名 <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="settings-bluesky-identifier-input"
                        type="text"
                        value={form.blueskyIdentifier || ''}
                        onChange={(e) => setForm({ ...form, blueskyIdentifier: e.target.value })}
                        placeholder="例: yourname.bsky.social または customdomain.com"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#0085ff] focus:ring-1 focus:ring-[#0085ff] font-mono shadow-inner"
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Blueskyのアカウント名（@は不要、末尾の.bsky.socialまで入力）
                    </p>
                  </div>

                  {/* アプリパスワード */}
                  <div data-context-target="true" className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-300">
                      アプリパスワード (App Password) <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="settings-bluesky-password-input"
                        type={showBlueskyPassword ? 'text' : 'password'}
                        value={form.blueskyAppPassword || ''}
                        onChange={(e) => setForm({ ...form, blueskyAppPassword: e.target.value })}
                        placeholder="例: abcd-efgh-ijkl-mnop"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-10 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#0085ff] focus:ring-1 focus:ring-[#0085ff] font-mono shadow-inner"
                      />
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                          id="toggle-bluesky-password-visibility"
                          type="button"
                          onClick={() => setShowBlueskyPassword(!showBlueskyPassword)}
                          className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition cursor-pointer"
                          title={showBlueskyPassword ? "パスワードを非表示" : "パスワードを表示（覗き見）"}
                        >
                          {showBlueskyPassword ? <EyeOff className="w-3.5 h-3.5 text-sky-400" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Bluesky設定画面で発行された専用アプリパスワード（AES-256-GCM暗号化保管）
                    </p>
                  </div>

                  {/* 高度な設定 (カスタムPDS / Service URL) */}
                  <div data-context-target="true">
                    <button
                      type="button"
                      onClick={() => setShowAdvancedPds(!showAdvancedPds)}
                      className="text-[11px] text-slate-400 hover:text-slate-300 flex items-center gap-1 cursor-pointer"
                    >
                      <span>{showAdvancedPds ? '▼' : '▶'} PDSサービスURLのカスタム設定 (通常は変更不要)</span>
                    </button>
                    {showAdvancedPds && (
                      <div className="mt-2 pl-3 border-l-2 border-slate-800 space-y-1">
                        <label className="block text-[11px] text-slate-400">PDS Service URL</label>
                        <input
                          type="text"
                          value={form.blueskyServiceUrl || 'https://bsky.social'}
                          onChange={(e) => setForm({ ...form, blueskyServiceUrl: e.target.value })}
                          placeholder="https://bsky.social"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 font-mono"
                        />
                        <p className="text-[10px] text-slate-500">
                          公式PDS以外（自前ホストサーバーなど）を利用する場合のみ変更してください。
                        </p>
                      </div>
                    )}
                  </div>

                  {/* 接続・ログインボタン (実用モード時のみ表示) */}
                  {!isDemoMode && (
                    <div className="pt-2 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleBlueskyLogin}
                        disabled={isBlueskyLoggingIn || !form.blueskyIdentifier || !form.blueskyAppPassword}
                        className="px-4 py-2 rounded-xl bg-[#0085ff] hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-blue-600/20"
                      >
                        {isBlueskyLoggingIn ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            認証中...
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Blueskyに接続・暗号化保存</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const demoId = 'demo-creator.bsky.social';
                          const demoPass = 'demo-pass-xxxx-xxxx-xxxx';
                          setForm((prev) => ({
                            ...prev,
                            blueskyIdentifier: demoId,
                            blueskyAppPassword: demoPass,
                            blueskyConnected: true,
                            blueskyHandle: demoId,
                          }));
                          setTestResult('Blueskyのデモ認証情報をセットしました。（※本番アカウント記憶は保持されています）');
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 text-xs border border-slate-800 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                        デモ情報でテスト
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* アプリパスワード発行手順ガイド */}
              <div className="bg-slate-950/40 rounded-xl p-4 border border-slate-800/60 text-xs space-y-2">
                <div className="flex items-center gap-2 text-slate-200 font-bold">
                  <HelpCircle className="w-4 h-4 text-[#0085ff]" />
                  <span>Blueskyのアプリパスワード（App Password）取得手順</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-400 text-[11px] leading-relaxed">
                  <li>
                    <a
                      href="https://bsky.app"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#0085ff] hover:underline inline-flex items-center gap-0.5"
                    >
                      Bluesky (bsky.app) <ExternalLink className="w-2.5 h-2.5" />
                    </a> にログインします。
                  </li>
                  <li>左側メニューの「<strong>設定 (Settings)</strong>」をクリックします。</li>
                  <li>「<strong>プライバシーとセキュリティ</strong>」内の「<strong>アプリパスワード (App Passwords)</strong>」を選択します。</li>
                  <li>「<strong>アプリパスワードを追加</strong>」を押し、名前に「<code>CrossPost Studio</code>」と入力して生成します。</li>
                  <li>画面に表示された <code>xxxx-xxxx-xxxx-xxxx</code> 形式のパスワードをコピーし、上記フォームに貼り付けて「接続」を押してください。</li>
                </ol>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* 🌀 THREADS タブ */}
          {/* ======================================================== */}
          {platformTab === 'threads' && (
            <div className="space-y-5">
              {/* Threads 連携状態ステータスバー */}
              <div className="flex flex-wrap items-center justify-between p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-950/80 text-purple-400 flex items-center justify-center font-bold text-base border border-purple-800/40 shadow-inner">
                    🌀
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-slate-200">Threads API 連携</h3>
                      {isThreadsLoggedIn ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          連携済み
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          未接続
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isThreadsLoggedIn
                        ? `ログイン中: ${form.threadsUsername || form.threadsUserId}`
                        : 'Threads (Meta Graph API) のアクセストークンを設定します'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isThreadsLoggedIn && !isDemoMode && (
                    <button
                      id="status-bar-connect-threads-button"
                      type="button"
                      onClick={() => {
                        if (!form.threadsAccessToken || !form.threadsAccessToken.trim()) {
                          document.getElementById('settings-threads-token-input')?.focus();
                          setTestResult('⚠️ Threadsのアクセストークンを入力して「Threadsに接続する」を押してください。');
                        } else {
                          handleThreadsVerify();
                        }
                      }}
                      disabled={isThreadsVerifying}
                      className="text-xs text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-40 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm shadow-purple-950/40"
                      title="Threadsアカウントへの接続を実行します"
                    >
                      {isThreadsVerifying ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <LinkIcon className="w-3.5 h-3.5 text-purple-200" />
                      )}
                      <span>Threadsに接続する</span>
                    </button>
                  )}

                  {isThreadsLoggedIn && !isDemoMode && (
                    <button
                      type="button"
                      onClick={() => {
                        if (onLogout) onLogout('threads');
                        setForm((prev) => ({
                          ...prev,
                          threadsConnected: false,
                          threadsUserId: '',
                          threadsAccessToken: '',
                          threadsUsername: '',
                        }));
                        recordCommInfo({
                          platform: 'Threads',
                          action: 'Threadsログアウト',
                          message: 'Threadsアカウントからログアウトしました（接続解除）',
                        });
                        setTestResult('Threadsからログアウトしました。（※保存された認証キー記憶からいつでも再ログイン可能です）');
                      }}
                      className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 px-3 py-1.5 rounded-lg border border-rose-900/40 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Threadsからログアウト
                    </button>
                  )}
                </div>
              </div>

              {/* 保存済みThreadsキー表示カード (実用モード時のみ表示) */}
              {!isDemoMode && vault.threads && (() => {
                const vaultExpiryInfo = calculateTokenExpiryInfo(vault.threads.tokenExpiresAt);
                return (
                  <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/40 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <BookmarkCheck className="w-4 h-4 text-purple-400 shrink-0" />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-200">記憶されたMeta Graph APIキー</span>
                            <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40 flex items-center gap-1">
                              <Shield className="w-2.5 h-2.5" />
                              AES-256 暗号化
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {formatSavedDate(vault.threads.savedAt)} 保存
                            </span>
                          </div>
                          <p className="text-xs text-purple-300 font-mono mt-0.5">
                            {vault.threads.username || `User ID: ${vault.threads.userId}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-auto flex-wrap">
                        <button
                          type="button"
                          disabled={isDemoMode}
                          onClick={handleRestoreThreads}
                          className="px-2.5 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-purple-300 border border-purple-500/40 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                          title={isDemoMode ? 'DEMOモード中は再ログインできません' : '記憶された認証キーで再ログインします'}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          このキーで再ログイン
                        </button>
                        <button
                          type="button"
                          disabled={isDemoMode}
                          onClick={() => handleDeleteVaultAccount('threads')}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                          title={isDemoMode ? 'DEMOモード中は削除できません' : '保存されたThreads認証キー記憶を削除'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* 有効期限 & 更新バー */}
                    <div className="pt-2 border-t border-purple-900/40 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-purple-400" />
                        <span className="text-[11px] text-slate-300">有効期限:</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1.5 ${vaultExpiryInfo.badgeColor.bg} ${vaultExpiryInfo.badgeColor.text} ${vaultExpiryInfo.badgeColor.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${vaultExpiryInfo.badgeColor.dot}`} />
                          {vaultExpiryInfo.formattedRelative}
                        </span>
                        <span className="text-[10px] text-slate-400">({vaultExpiryInfo.formattedDate})</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleThreadsTokenRefresh}
                        disabled={isDemoMode || isRefreshingThreadsToken}
                        className="text-[11px] font-semibold text-purple-300 hover:text-purple-200 hover:bg-purple-900/40 px-2.5 py-1 rounded-lg border border-purple-700/50 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={isDemoMode ? 'DEMOモード中は更新できません' : 'Meta Graph APIを呼び出してLong-Lived Tokenの有効期限を60日間延長します'}
                      >
                        {isRefreshingThreadsToken ? (
                          <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                        ) : (
                          <RefreshCw className="w-3 h-3 text-purple-400" />
                        )}
                        <span>有効期限を更新</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Threads フォーム */}
              <div className="bg-slate-950/50 rounded-xl p-4 sm:p-5 border border-slate-800/80 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-slate-200">Meta Graph API 認証キー</span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40 flex items-center gap-1">
                      <Shield className="w-2.5 h-2.5" />
                      AES-256 暗号化保管
                    </span>
                  </div>
                  <a
                    href="https://developers.facebook.com/docs/threads"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-purple-400 hover:underline flex items-center gap-1"
                  >
                    <span>Threads API Docs</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="space-y-4">
                  <div data-context-target="true" className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-300">
                      Threads User ID (または "me")
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="settings-threads-userid-input"
                        type="text"
                        value={form.threadsUserId || ''}
                        onChange={(e) => setForm({ ...form, threadsUserId: e.target.value })}
                        placeholder="me または 17841400000000000"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono shadow-inner"
                      />
                    </div>
                  </div>

                  <div data-context-target="true" className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-300">
                      Threads User Access Token (Long-Lived Token) <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="settings-threads-token-input"
                        type={showThreadsToken ? 'text' : 'password'}
                        value={form.threadsAccessToken || ''}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            threadsAccessToken: e.target.value,
                            threadsConnected: e.target.value.length > 0,
                          })
                        }
                        placeholder="TH..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-10 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono shadow-inner"
                      />
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                          id="toggle-threads-token-visibility"
                          type="button"
                          onClick={() => setShowThreadsToken(!showThreadsToken)}
                          className="p-1 text-slate-400 hover:text-slate-200 rounded hover:bg-slate-800 transition cursor-pointer"
                          title={showThreadsToken ? "アクセストークンを非表示" : "アクセストークンを表示（覗き見）"}
                        >
                          {showThreadsToken ? <EyeOff className="w-3.5 h-3.5 text-purple-400" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Meta for Developersで発行されたThreadsアクセストークン（AES-256-GCM暗号化保管）
                    </p>
                  </div>

                  <div data-context-target="true" className="space-y-1.5">
                    <label className="block text-xs font-medium text-slate-300">
                      表示用Threadsアカウント名 (任意)
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="settings-threads-username-input"
                        type="text"
                        value={form.threadsUsername || ''}
                        onChange={(e) => setForm({ ...form, threadsUsername: e.target.value })}
                        placeholder="@your_threads_id"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono shadow-inner"
                      />
                    </div>
                  </div>

                  {/* Long-Lived Token 有効期限 & 更新コントロールパネル (実用モード時のみ表示) */}
                  {!isDemoMode && (form.threadsAccessToken || vault.threads?.accessToken) && (() => {
                    const currentExpiry = calculateTokenExpiryInfo(
                      form.threadsTokenExpiresAt || vault.threads?.tokenExpiresAt
                    );
                    const refreshedDateStr = formatRefreshedDate(
                      form.threadsTokenRefreshedAt || vault.threads?.tokenRefreshedAt
                    );

                    return (
                      <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-800/50 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-purple-400" />
                            <span className="text-xs font-bold text-slate-200">Long-Lived Token 有効期限ステータス</span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${currentExpiry.badgeColor.bg} ${currentExpiry.badgeColor.text} ${currentExpiry.badgeColor.border}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${currentExpiry.badgeColor.dot}`} />
                            {currentExpiry.formattedRelative}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                          <div>
                            <span className="text-[10px] text-slate-500 block">有効期限日時</span>
                            <span className="text-slate-200 font-semibold font-mono text-[11px]">
                              {currentExpiry.formattedDate}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 block">最終更新日時</span>
                            <span className="text-slate-200 font-semibold font-mono text-[11px]">
                              {refreshedDateStr}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1">
                          <p className="text-[10px] text-slate-400 leading-tight">
                            発行または前回更新から24時間経過後に有効期限をさらに60日間延長できます。
                          </p>

                          <button
                            id="refresh-threads-token-button"
                            type="button"
                            onClick={handleThreadsTokenRefresh}
                            disabled={isRefreshingThreadsToken || !form.threadsAccessToken}
                            className="w-full sm:w-auto px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-md shadow-purple-950/40"
                          >
                            {isRefreshingThreadsToken ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>有効期限更新中...</span>
                              </>
                            ) : (
                              <>
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>有効期限を更新 (60日延長)</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {!isDemoMode && (
                    <div className="pt-2 space-y-2">
                      <div className="flex flex-col sm:flex-row items-center gap-2">
                        <button
                          id="connect-threads-button"
                          type="button"
                          onClick={handleThreadsVerify}
                          disabled={isThreadsVerifying}
                          className="flex-1 w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-purple-950/50"
                          title="Threads (Meta Graph API) に接続し、アカウント連携と暗号化保管を行います"
                        >
                          {isThreadsVerifying ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Threadsに接続中... (Meta Graph API検証)</span>
                            </>
                          ) : (
                            <>
                              <LinkIcon className="w-4 h-4 text-purple-200" />
                              <span>Threadsに接続する</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const now = Date.now();
                            const expiresAt = now + (60 * 24 * 60 * 60 * 1000);
                            setForm((prev) => ({
                              ...prev,
                              threadsUserId: 'threads_user_demo_10293',
                              threadsAccessToken: 'TH_LONG_LIVED_TOKEN_DEMO_91238',
                              threadsConnected: true,
                              threadsUsername: '@Demo_Threads_Official',
                              threadsTokenExpiresAt: expiresAt,
                              threadsTokenRefreshedAt: now,
                              threadsTokenExpiresIn: 5184000,
                            }));
                            setTestResult('Threadsのデモ認証情報をセットしました。（有効期限: 60日間）');
                          }}
                          className="w-full sm:w-auto py-3 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 text-xs border border-slate-800 transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                          title="テスト用デモアカウント情報（60日間有効）を入力します"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                          <span>デモ情報でテスト</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                        <span>※ 「Threadsに接続する」を押すとアクセストークンが検証され、AES-256で安全に保管されます。</span>
                        <a
                          href="https://developers.facebook.com/apps"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-400 hover:text-purple-300 underline flex items-center gap-1 shrink-0 ml-2"
                        >
                          <span>Meta開発者ポータル</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Threads ガイド */}
              <div className="bg-slate-950/40 rounded-xl p-4 border border-slate-800/60 text-xs space-y-2">
                <div className="flex items-center gap-2 text-slate-200 font-bold">
                  <HelpCircle className="w-4 h-4 text-purple-400" />
                  <span>Threads API トークン取得の概要</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  Meta for Developers にて Threads App を登録後、<code>threads_basic</code>, <code>threads_content_publish</code> スコープを付与したユーザーアクセストークンを生成してください。
                </p>
              </div>
            </div>
          )}

          {/* テーマ・外観設定タブ */}
          {platformTab === 'appearance' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-accent-subtle flex items-center justify-center text-accent-light border border-accent">
                    <Palette className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">アクセントカラー・テーマ設定</h3>
                    <p className="text-xs text-slate-400">
                      アプリ全体のボタン、バッジ、フォーカス枠、アイコンなどのキーカラーを変更できます。
                    </p>
                  </div>
                </div>
              </div>

              {/* テーマピッカー グリッド */}
              {onSelectTheme && (
                <ThemeSelector
                  currentTheme={currentTheme}
                  onSelectTheme={onSelectTheme}
                  variant="settings-grid"
                />
              )}

              {/* プレビューサンプル */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">
                    現在のテーマプレビュー（{getThemeAccentConfig(currentTheme as ThemeAccentId).nameJa}）
                  </span>
                  <span className="text-[11px] text-accent-light font-medium">即時反映中</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 shadow-inner">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      className="btn-accent px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>アクセントボタン</span>
                    </button>
                    <span className="badge-accent px-2.5 py-1 rounded-lg text-xs font-bold">
                      アクセントバッジ
                    </span>
                    <span className="text-xs font-bold text-accent-light">
                      ハイライトテキスト
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    投稿実行ボタンやヘッダーバッジ、スレッド分割インジケータなど、アプリケーション内の各UIがこのアクセントカラーに美しく連動します。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ハッシュタグ & Threads専用トピック メンテナンス */}
          {platformTab === 'maintenance' && (
            <TagTopicMaintenance />
          )}

          {/* モード切替セキュリティ設定（ライブモード時のみ） */}
          {!isDemoMode && platformTab === 'security' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-5 h-5 text-emerald-400" />
                    <div>
                      <h4 className="text-xs font-bold text-white">
                        モード切替時のパスワード保護
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        タイトルの場所を左クリック3回でデモ/ライブを切り替える際のパスワード認証
                      </p>
                    </div>
                  </div>

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={secConfig.requirePassword}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setModePasswordRequired(val);
                        setSecConfig(getModeSecurityConfig());
                        setSecMessage({
                          text: val
                            ? '✅ パスワード保護を有効に設定しました。'
                            : '⚠️ パスワード保護を解除しました（3回クリックで直接切替）。',
                          type: 'success',
                        });
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-300 space-y-1.5 leading-relaxed">
                  <div className="font-semibold text-slate-200">💡 操作方法・セキュリティ仕様:</div>
                  <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1">
                    <li>画面左上のタイトル（<span className="text-white font-semibold">CrossPost Web Studio</span>）を左クリックで素早く3回連続クリックするとモード切替が発動します。</li>
                    <li><strong className="text-emerald-300">LIVE（本番）モードからDEMOモードへの切替</strong>: パスワード入力は求められず、即座に安全なDEMOモードへ切り替わります。</li>
                    <li><strong className="text-sky-300">DEMOモードからLIVE（本番）モードへの切替</strong>: パスワード保護が有効の場合、実アカウントへの誤投稿を防ぐため認証入力画面が表示されます。</li>
                  </ul>
                </div>
              </div>

              {/* パスワード変更フォーム */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <Key className="w-4 h-4 text-sky-400" />
                  認証パスワードの変更
                </h4>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] text-slate-300 mb-1">現在のパスワード</label>
                    <div className="relative">
                      <input
                        type={showSecCurrentPassword ? 'text' : 'password'}
                        value={secCurrentPassword}
                        onChange={(e) => setSecCurrentPassword(e.target.value)}
                        placeholder="現在のパスワード"
                        className="w-full bg-[#0A0A0B] border border-slate-700 rounded-lg px-3 py-2 pr-9 text-xs text-white placeholder:text-slate-500 font-mono focus:outline-none focus:border-sky-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecCurrentPassword(!showSecCurrentPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 rounded transition cursor-pointer"
                        title={showSecCurrentPassword ? '非表示' : '表示'}
                      >
                        {showSecCurrentPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">新しいパスワード</label>
                      <div className="relative">
                        <input
                          type={showSecNewPassword ? 'text' : 'password'}
                          value={secNewPassword}
                          onChange={(e) => setSecNewPassword(e.target.value)}
                          placeholder="4文字以上の新しいパスワード"
                          className="w-full bg-[#0A0A0B] border border-slate-700 rounded-lg px-3 py-2 pr-9 text-xs text-white placeholder:text-slate-500 font-mono focus:outline-none focus:border-sky-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecNewPassword(!showSecNewPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 rounded transition cursor-pointer"
                          title={showSecNewPassword ? '非表示' : '表示'}
                        >
                          {showSecNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-300 mb-1">新しいパスワード（確認）</label>
                      <div className="relative">
                        <input
                          type={showSecConfirmPassword ? 'text' : 'password'}
                          value={secConfirmPassword}
                          onChange={(e) => setSecConfirmPassword(e.target.value)}
                          placeholder="再入力"
                          className="w-full bg-[#0A0A0B] border border-slate-700 rounded-lg px-3 py-2 pr-9 text-xs text-white placeholder:text-slate-500 font-mono focus:outline-none focus:border-sky-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecConfirmPassword(!showSecConfirmPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 rounded transition cursor-pointer"
                          title={showSecConfirmPassword ? '非表示' : '表示'}
                        >
                          {showSecConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {secMessage && (
                    <div
                      className={`p-2.5 rounded-lg text-xs flex items-center gap-2 ${
                        secMessage.type === 'success'
                          ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                      }`}
                    >
                      {secMessage.type === 'success' ? (
                        <CheckCircle className="w-4 h-4 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0" />
                      )}
                      <span>{secMessage.text}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={!secCurrentPassword.trim() || !secNewPassword.trim() || !secConfirmPassword.trim()}
                    onClick={async () => {
                      setSecMessage(null);
                      if (!secCurrentPassword.trim()) {
                        setSecMessage({ text: '現在のパスワードを入力してください。', type: 'error' });
                        return;
                      }
                      const isValid = await verifyModePassword(secCurrentPassword);
                      if (!isValid) {
                        setSecMessage({ text: '現在のパスワードが正しくありません。', type: 'error' });
                        return;
                      }
                      if (!secNewPassword || secNewPassword.length < 4) {
                        setSecMessage({ text: '新しいパスワードは4文字以上で入力してください。', type: 'error' });
                        return;
                      }
                      if (secNewPassword !== secConfirmPassword) {
                        setSecMessage({ text: '新しいパスワードの確認入力が一致しません。', type: 'error' });
                        return;
                      }

                      await updateModePassword(secNewPassword);
                      setSecConfig(getModeSecurityConfig());
                      setSecCurrentPassword('');
                      setSecNewPassword('');
                      setSecConfirmPassword('');
                      setSecMessage({ text: '🎉 パスワードを正常に変更しました！', type: 'success' });
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition shadow flex items-center gap-1.5 ${
                      secCurrentPassword.trim() && secNewPassword.trim() && secConfirmPassword.trim()
                        ? 'bg-sky-600 hover:bg-sky-500 text-white cursor-pointer shadow-sky-950/40'
                        : 'bg-slate-800/80 text-slate-500 border border-slate-700/60 cursor-not-allowed shadow-none'
                    }`}
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>パスワードを更新する</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* モーダルフッター (セキュリティタブ以外、かつデモモード時は外観・メンテ時のみ表示) */}
        {platformTab !== 'security' && (!isDemoMode || platformTab === 'appearance' || platformTab === 'maintenance') && (
          <div className="px-5 sm:px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3 shrink-0">
            {platformTab === 'appearance' ? (
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-accent-light" />
                <span>選択したテーマカラーはアプリ全体に即座に適用されます</span>
              </div>
            ) : platformTab === 'maintenance' ? (
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <Hash className="w-3.5 h-3.5 text-sky-400" />
                <span>ハッシュタグやトピックの変更はエディタに自動同期されます</span>
              </div>
            ) : (
              <div className="text-xs text-slate-500">
                アカウント設定
              </div>
            )}

            {!isDemoMode && (
              <div className="flex items-center gap-2.5 ml-auto">
                {/* 保存ボタン */}
                <button
                  id="save-settings-button"
                  type="button"
                  onClick={handleSave}
                  className="btn-accent px-5 py-2 rounded-xl text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                  title="設定を保存"
                >
                  <Check className="w-4 h-4" />
                  <span>設定を保存</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* 画面にログファイルを表示するモーダル */}
        <CommErrorModal
          isOpen={isCommLogModalOpen}
          onClose={() => setIsCommLogModalOpen(false)}
        />
      </aside>
  );
};
