import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Database,
  RefreshCw,
  ShieldCheck,
  CheckCircle,
  ExternalLink,
  Copy,
  Check,
  Clock,
  Sparkles,
  Settings,
  FileCode,
  AlertCircle,
  Key,
  Download,
  Upload,
  FileJson,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  ArrowRight,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { SavedAccountVault, ApiCredentials } from '../types';
import { calculateTokenExpiryInfo, formatRefreshedDate } from '../utils/tokenExpiry';
import { formatSavedDate } from '../utils/accountVault';
import {
  downloadAccountCredentialsBackup,
  parseAndDecryptAccountBackup,
  applyImportedAccountToSession,
  DecryptedAccountResult,
} from '../utils/accountTransfer';

interface ServerVaultViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
  isBlueskyLoggedIn?: boolean;
  isThreadsLoggedIn?: boolean;
}

export const ServerVaultViewerModal: React.FC<ServerVaultViewerModalProps> = ({
  isOpen,
  onClose,
  onOpenSettings,
  isBlueskyLoggedIn = false,
  isThreadsLoggedIn = false,
}) => {
  const [serverVault, setServerVault] = useState<SavedAccountVault | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // ダウンロード・アップロード関連のステート
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);
  const [customExportPassphrase, setCustomExportPassphrase] = useState('');
  const [showExportPassInput, setShowExportPassInput] = useState(false);

  const [isImporting, setIsImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPassphrase, setImportPassphrase] = useState('');
  const [needsImportPassphrase, setNeedsImportPassphrase] = useState(false);
  const [importDecrypted, setImportDecrypted] = useState<DecryptedAccountResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [isApplyingImport, setIsApplyingImport] = useState(false);
  const [showImportedBlueskyPass, setShowImportedBlueskyPass] = useState(false);
  const [showImportedThreadsToken, setShowImportedThreadsToken] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // サーバー上の保管データを取得
  const fetchServerVault = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/credentials/vault', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: サーバーからデータを取得できませんでした`);
      }
      const data = await res.json();
      if (data && typeof data.vault === 'object') {
        setServerVault(data.vault);
        setLastFetchedAt(new Date());
      } else {
        setServerVault({});
        setLastFetchedAt(new Date());
      }
    } catch (err: any) {
      console.error('[ServerVaultViewer] Failed to fetch server vault:', err);
      setFetchError(err.message || 'サーバー保管情報の取得中にエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchServerVault();
      setShowRawJson(false);
      setCopiedKey(null);
      setExportSuccessMsg(null);
      setImportError(null);
      setImportSuccessMsg(null);
      setImportDecrypted(null);
      setImportFile(null);
      setNeedsImportPassphrase(false);
      setImportPassphrase('');
    }
  }, [isOpen]);

  // Escキーで閉じる
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // アカウント情報のダウンロード実行 (AES-256暗号化)
  const handleDownloadBackup = async () => {
    setIsExporting(true);
    setExportSuccessMsg(null);
    setFetchError(null);
    try {
      const { filename } = await downloadAccountCredentialsBackup(
        customExportPassphrase.trim() ? customExportPassphrase.trim() : undefined
      );
      setExportSuccessMsg(`✅ アカウント設定バックアップ「${filename}」をダウンロードしました。（AES-256暗号化保護）`);
      setTimeout(() => setExportSuccessMsg(null), 6000);
    } catch (err: any) {
      console.error('[ServerVault] Export error:', err);
      setFetchError(`ダウンロードに失敗しました: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // ファイル選択トリガー
  const handleTriggerFileInput = () => {
    setImportError(null);
    setImportSuccessMsg(null);
    setImportDecrypted(null);
    setNeedsImportPassphrase(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // ファイル解析 & AES-256復号
  const handleProcessImportFile = async (file: File, passToUse?: string) => {
    setIsImporting(true);
    setImportError(null);
    setImportSuccessMsg(null);
    setImportFile(file);

    try {
      const result = await parseAndDecryptAccountBackup(file, passToUse || importPassphrase);
      setImportDecrypted(result);
      setNeedsImportPassphrase(false);
    } catch (err: any) {
      console.error('[ServerVault] Import error:', err);
      const msg = err.message || 'アカウントファイルの解析に失敗しました。';
      if (msg.includes('復号化に失敗') || msg.includes('パスワード')) {
        setNeedsImportPassphrase(true);
        setImportError('🔑 このファイルはパスワードで保護されているか、復号に失敗しました。パスワードを入力して再試行してください。');
      } else {
        setImportError(msg);
      }
    } finally {
      setIsImporting(false);
    }
  };

  // ファイル選択ハンドラ
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessImportFile(file);
    }
  };

  // ドラッグ＆ドロップ
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.json')) {
      handleProcessImportFile(file);
    } else if (file) {
      setImportError('JSON形式のファイル (.json) をドロップしてください。');
    }
  };

  // 復号されたアカウント情報を取り込んでログイン & サーバー登録実行
  const handleApplyImport = async () => {
    if (!importDecrypted) return;
    setIsApplyingImport(true);
    setImportError(null);
    try {
      const res = await applyImportedAccountToSession(importDecrypted);
      setImportSuccessMsg(res.message);
      await fetchServerVault(); // 最新のサーバー保管庫を再取得して表示
      setImportDecrypted(null);
      setImportFile(null);
      setTimeout(() => setImportSuccessMsg(null), 8000);
    } catch (err: any) {
      console.error('[ServerVault] Apply import error:', err);
      setImportError(`アカウント情報の適用に失敗しました: ${err.message}`);
    } finally {
      setIsApplyingImport(false);
    }
  };

  if (!isOpen) return null;

  const hasBluesky = Boolean(serverVault?.bluesky?.identifier);
  const hasThreads = Boolean(serverVault?.threads?.accessToken);
  const rawJsonString = JSON.stringify(serverVault || {}, null, 2);

  // Threads有効期限計算
  const threadsExpiry = serverVault?.threads?.tokenExpiresAt
    ? calculateTokenExpiryInfo(serverVault.threads.tokenExpiresAt)
    : null;

  // 60日間のうちの残りパーセンテージ（プログレスバー用）
  const remainingDays = threadsExpiry?.remainingDays ?? 0;
  const progressPercent = Math.min(100, Math.max(0, Math.round((remainingDays / 60) * 100)));

  return (
    <div
      id="server-vault-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="server-vault-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="server-vault-modal-title"
        className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-[#0B0F19] border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/90 overflow-hidden animate-in zoom-in-95 duration-150 text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 上部グラデーションデコレーション */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-sky-500 to-purple-500" />

        {/* 隠しファイル入力 */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json,application/json"
          className="hidden"
        />

        {/* ヘッダーエリア */}
        <div className="px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between gap-3 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0 shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="server-vault-modal-title" className="text-sm sm:text-base font-bold text-white tracking-tight">
                  サーバー登録情報
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE MODE
                </span>
                <span className="text-[11px] text-slate-400 hidden sm:inline-block font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  /data/account_vault.json
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                クラウドディスクストレージに安全（AES-256暗号化）に永続化されている認証情報
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={fetchServerVault}
              disabled={isLoading}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer disabled:opacity-40"
              title="サーバー保管情報を再取得"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
              title="閉じる (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* モーダル本文 (スクロール可能) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {/* サーバー同期ステータスバー */}
          <div className="p-3 sm:p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/30 via-slate-900 to-sky-950/20 border border-emerald-800/40 flex flex-wrap items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-emerald-300">サーバーディスク同期ステータス: 良好</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  リロードや再デプロイ後も、サーバー側のファイル保管庫（/data/account_vault.json）より自動復元されます。
                </p>
              </div>
            </div>

            {lastFetchedAt && (
              <span className="text-[10px] text-slate-400 bg-slate-950/60 px-2 py-1 rounded-md border border-slate-800/80">
                最終同期取得: {lastFetchedAt.toLocaleTimeString('ja-JP')}
              </span>
            )}
          </div>

          {/* 🌟 他PC・別ブラウザへの移行（ダウンロード・アップロード）コントロールボックス */}
          <div className="p-3.5 sm:p-4 rounded-xl bg-slate-900/90 border border-sky-500/30 shadow-lg space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                    他のPC・ブラウザへのアカウント情報移行
                    <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/30">
                      AES-256 暗号化対応
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    アカウント情報をダウンロードして他の端末に読み込ませることで、即座にログイン・サーバー登録が可能です。
                  </p>
                </div>
              </div>

              {/* ダウンロード & アップロード 操作ボタン群 */}
              <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  disabled={isExporting || (!hasBluesky && !hasThreads)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-emerald-600/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="アカウント情報をAES-256暗号化してダウンロード"
                >
                  <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
                  <span>{isExporting ? '暗号化出力中...' : 'ダウンロード'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleTriggerFileInput}
                  disabled={isImporting}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-sky-600/20 disabled:opacity-40"
                  title="他のPCやバックアップからアカウントファイルをアップロード"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>アップロード</span>
                </button>
              </div>
            </div>

            {/* 仕様・平文と暗号化の説明 */}
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] space-y-1 text-slate-300">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                <HelpCircle className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>移行データの暗号化仕様について:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-slate-400 pl-1">
                <li>
                  <span className="text-emerald-300 font-medium">平文で出力・保持される情報:</span>{' '}
                  Blueskyハンドル、Threadsアカウント名、Threads USER ID、AccessToken有効期限
                </li>
                <li>
                  <span className="text-purple-300 font-medium">AES-256で強固に暗号化される情報:</span>{' '}
                  Blueskyアプリパスワード、Threads AccessToken
                </li>
              </ul>
            </div>

            {/* ダウンロード成功メッセージ */}
            {exportSuccessMsg && (
              <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 flex items-center gap-2 animate-in fade-in duration-150">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="flex-1">{exportSuccessMsg}</span>
              </div>
            )}

            {/* アップロード成功メッセージ */}
            {importSuccessMsg && (
              <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-200 flex items-center gap-2 animate-in fade-in duration-150">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="flex-1">{importSuccessMsg}</span>
              </div>
            )}

            {/* エラーメッセージ */}
            {(importError || fetchError) && (
              <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-200 flex items-center gap-2 animate-in fade-in duration-150">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="flex-1">{importError || fetchError}</span>
              </div>
            )}

            {/* パスワード保護されているファイルの再試行フォーム */}
            {needsImportPassphrase && (
              <div className="p-3 rounded-lg bg-slate-950 border border-amber-500/40 space-y-2 animate-in fade-in duration-150">
                <span className="text-amber-300 font-bold flex items-center gap-1.5 text-xs">
                  <Lock className="w-3.5 h-3.5" />
                  復号パスワードを入力してください
                </span>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={importPassphrase}
                    onChange={(e) => setImportPassphrase(e.target.value)}
                    placeholder="バックアップ作成時に指定したパスワード"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (importFile) handleProcessImportFile(importFile, importPassphrase);
                    }}
                    className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition cursor-pointer"
                  >
                    復号して再試行
                  </button>
                </div>
              </div>
            )}

            {/* 🌟 アップロード成功時のアカウント情報確認 & ログイン適用カード */}
            {importDecrypted && (
              <div className="p-3.5 rounded-xl bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950/40 border border-emerald-500/50 space-y-3 animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-emerald-300 text-xs sm:text-sm">
                      アカウント情報の読み込み・AES-256復号が完了しました
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {importFile ? importFile.name : 'バックアップファイル'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                  {/* 抽出されたBluesky情報 */}
                  <div className="p-3 rounded-lg bg-slate-950/80 border border-sky-800/40 space-y-1.5">
                    <div className="flex items-center justify-between font-bold text-sky-300 pb-1 border-b border-slate-800">
                      <span className="flex items-center gap-1.5">
                        <span className="text-base">🦋</span> Bluesky 抽出情報
                      </span>
                      {importDecrypted.hasBluesky ? (
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          平文 & 復号OK
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[10px]">情報なし</span>
                      )}
                    </div>
                    {importDecrypted.hasBluesky && importDecrypted.bluesky ? (
                      <div className="space-y-1 text-slate-300">
                        <div>
                          <span className="text-slate-500 text-[10px] block">ハンドル (平文):</span>
                          <span className="font-mono text-sky-200 font-semibold">
                            @{importDecrypted.bluesky.handle}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px] block">パスワード (AES-256復号):</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-slate-300">
                              {showImportedBlueskyPass
                                ? importDecrypted.bluesky.appPassword
                                : '••••••••••••••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowImportedBlueskyPass(!showImportedBlueskyPass)}
                              className="text-slate-400 hover:text-white p-0.5"
                            >
                              {showImportedBlueskyPass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-500 italic block py-2">Bluesky情報は含まれていません</span>
                    )}
                  </div>

                  {/* 抽出されたThreads情報 */}
                  <div className="p-3 rounded-lg bg-slate-950/80 border border-purple-800/40 space-y-1.5">
                    <div className="flex items-center justify-between font-bold text-purple-300 pb-1 border-b border-slate-800">
                      <span className="flex items-center gap-1.5">
                        <span className="text-base">🌀</span> Threads 抽出情報
                      </span>
                      {importDecrypted.hasThreads ? (
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          平文 & 復号OK
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[10px]">情報なし</span>
                      )}
                    </div>
                    {importDecrypted.hasThreads && importDecrypted.threads ? (
                      <div className="space-y-1 text-slate-300">
                        <div className="grid grid-cols-2 gap-1">
                          <div>
                            <span className="text-slate-500 text-[10px] block">アカウント名 (平文):</span>
                            <span className="font-mono text-purple-200 font-semibold">
                              {importDecrypted.threads.username}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px] block">Threads USER ID (平文):</span>
                            <span className="font-mono text-slate-300">
                              {importDecrypted.threads.userId}
                            </span>
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px] block">AccessToken (AES-256復号):</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-slate-300 truncate max-w-[180px]">
                              {showImportedThreadsToken
                                ? importDecrypted.threads.accessToken
                                : '••••••••••••••••••••••••••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowImportedThreadsToken(!showImportedThreadsToken)}
                              className="text-slate-400 hover:text-white p-0.5"
                            >
                              {showImportedThreadsToken ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                            </button>
                          </div>
                        </div>
                        {importDecrypted.threads.tokenExpiresAt && (
                          <div>
                            <span className="text-slate-500 text-[10px] block">有効期限 (平文):</span>
                            <span className="text-slate-300 text-[10px]">
                              {new Date(importDecrypted.threads.tokenExpiresAt).toLocaleString('ja-JP')}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-500 italic block py-2">Threads情報は含まれていません</span>
                    )}
                  </div>
                </div>

                {/* 適用・ログイン確定ボタン */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setImportDecrypted(null);
                      setImportFile(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition cursor-pointer"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyImport}
                    disabled={isApplyingImport}
                    className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-sky-600 hover:from-emerald-500 hover:to-sky-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-lg shadow-emerald-900/40 disabled:opacity-40"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>
                      {isApplyingImport
                        ? 'サーバー登録・ログイン処理中...'
                        : 'このアカウントでログインし、サーバー登録する'}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2カラム構成: Bluesky & Threads */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. Bluesky アカウント情報カード */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/90 flex flex-col justify-between space-y-3 shadow-md">
              <div>
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🦋</span>
                    <div>
                      <h3 className="font-bold text-white text-xs sm:text-sm">Bluesky (AT Protocol)</h3>
                      <span className="text-[10px] text-sky-400">Decentralized Social Network</span>
                    </div>
                  </div>
                  {hasBluesky ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      サーバー保管中
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                      未登録
                    </span>
                  )}
                </div>

                {hasBluesky ? (
                  <div className="space-y-2.5 pt-3">
                    {/* アカウント名 / ハンドル (平文) */}
                    <div>
                      <span className="text-[10px] text-slate-500 block">アカウント (Handle) - 平文</span>
                      <div className="flex items-center justify-between gap-1.5 mt-0.5 bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
                        <span className="font-semibold text-sky-300 font-mono truncate">
                          @{serverVault?.bluesky?.handle || serverVault?.bluesky?.identifier}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopy(
                              serverVault?.bluesky?.handle || serverVault?.bluesky?.identifier || '',
                              'bluesky-handle'
                            )
                          }
                          className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
                          title="ハンドル名をコピー"
                        >
                          {copiedKey === 'bluesky-handle' ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* DID (Decentralized Identifier) */}
                    <div>
                      <span className="text-[10px] text-slate-500 block">分散ID (DID)</span>
                      <div className="flex items-center justify-between gap-1.5 mt-0.5 bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
                        <span className="text-[11px] text-slate-300 font-mono truncate max-w-[200px]" title={serverVault?.bluesky?.did}>
                          {serverVault?.bluesky?.did || '未取得'}
                        </span>
                        {serverVault?.bluesky?.did && (
                          <button
                            type="button"
                            onClick={() => handleCopy(serverVault.bluesky!.did!, 'bluesky-did')}
                            className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
                            title="DIDをコピー"
                          >
                            {copiedKey === 'bluesky-did' ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* PDS サービスURL */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] text-slate-500 block">PDS 接続先</span>
                        <span className="text-slate-300 font-mono text-[11px] truncate block mt-0.5">
                          {serverVault?.bluesky?.serviceUrl || 'https://bsky.social'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">保存日時</span>
                        <span className="text-slate-300 text-[11px] block mt-0.5">
                          {formatSavedDate(serverVault?.bluesky?.savedAt)}
                        </span>
                      </div>
                    </div>

                    {/* 暗号化保護状態 */}
                    <div className="p-2 rounded-lg bg-sky-950/20 border border-sky-800/30 flex items-center justify-between text-[11px] text-sky-200">
                      <span className="flex items-center gap-1.5">
                        <Key className="w-3 h-3 text-sky-400" />
                        アプリパスワード保護:
                      </span>
                      <span className="font-semibold text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        AES-256 暗号化保管
                      </span>
                    </div>

                    {/* 現在のセッション状態 */}
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="text-slate-400">現在のセッション:</span>
                      {isBlueskyLoggedIn ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          現在ログイン中
                        </span>
                      ) : (
                        <span className="text-slate-400">未接続</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-slate-500 space-y-2">
                    <p className="text-xs">サーバーに登録されたBlueskyアカウントはありません</p>
                    <p className="text-[10px] text-slate-400">
                      右上の「設定」からBlueskyアカウントを連携するか、上部の「アップロード」から設定ファイルを読み込んでください。
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Threads アカウント情報カード */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/90 flex flex-col justify-between space-y-3 shadow-md">
              <div>
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🌀</span>
                    <div>
                      <h3 className="font-bold text-white text-xs sm:text-sm">Threads (Meta Graph API)</h3>
                      <span className="text-[10px] text-purple-400">Meta Platform Official API</span>
                    </div>
                  </div>
                  {hasThreads ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      サーバー保管中
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                      未登録
                    </span>
                  )}
                </div>

                {hasThreads ? (
                  <div className="space-y-2.5 pt-3">
                    {/* アカウントユーザー名 (平文) */}
                    <div>
                      <span className="text-[10px] text-slate-500 block">アカウント名 (平文)</span>
                      <div className="flex items-center justify-between gap-1.5 mt-0.5 bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
                        <span className="font-semibold text-purple-300 font-mono truncate">
                          {serverVault?.threads?.username || 'Threads連携アカウント'}
                        </span>
                        {serverVault?.threads?.username && (
                          <button
                            type="button"
                            onClick={() => handleCopy(serverVault.threads!.username!, 'threads-user')}
                            className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
                            title="ユーザー名をコピー"
                          >
                            {copiedKey === 'threads-user' ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Threads User ID (平文) */}
                    <div>
                      <span className="text-[10px] text-slate-500 block">Threads User ID (平文)</span>
                      <div className="flex items-center justify-between gap-1.5 mt-0.5 bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
                        <span className="text-[11px] text-slate-300 font-mono truncate">
                          {serverVault?.threads?.userId || 'me'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(serverVault?.threads?.userId || 'me', 'threads-id')}
                          className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
                          title="ユーザーIDをコピー"
                        >
                          {copiedKey === 'threads-id' ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Long-Lived Token 有効期限 (平文) */}
                    {threadsExpiry && (
                      <div className="p-2.5 rounded-lg bg-purple-950/20 border border-purple-800/40 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-purple-400" />
                            Token 有効期限 (平文)
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${threadsExpiry.badgeColor.bg} ${threadsExpiry.badgeColor.text} ${threadsExpiry.badgeColor.border}`}
                          >
                            {threadsExpiry.formattedRelative}
                          </span>
                        </div>

                        {/* プログレスバー */}
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              threadsExpiry.status === 'expired'
                                ? 'bg-rose-500'
                                : threadsExpiry.status === 'warning'
                                ? 'bg-amber-400'
                                : 'bg-emerald-400'
                            }`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                          <span>期限: {threadsExpiry.formattedDate}</span>
                          <span>更新: {formatRefreshedDate(serverVault?.threads?.tokenRefreshedAt)}</span>
                        </div>
                      </div>
                    )}

                    {/* 暗号化保護状態 */}
                    <div className="p-2 rounded-lg bg-purple-950/20 border border-purple-800/30 flex items-center justify-between text-[11px] text-purple-200">
                      <span className="flex items-center gap-1.5">
                        <Key className="w-3 h-3 text-purple-400" />
                        アクセストークン保護:
                      </span>
                      <span className="font-semibold text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        AES-256 暗号化保管
                      </span>
                    </div>

                    {/* 現在のセッション状態 */}
                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="text-slate-400">現在のセッション:</span>
                      {isThreadsLoggedIn ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          現在連携中
                        </span>
                      ) : (
                        <span className="text-slate-400">未連携</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-slate-500 space-y-2">
                    <p className="text-xs">サーバーに登録されたThreadsキーはありません</p>
                    <p className="text-[10px] text-slate-400">
                      右上の「設定」からThreadsアクセストークンを接続するか、上部の「アップロード」から設定ファイルを読み込んでください。
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* サーバー生データ (JSON) プレビュー アコーディオン */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={() => setShowRawJson(!showRawJson)}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition cursor-pointer py-1"
            >
              <FileCode className="w-3.5 h-3.5 text-sky-400" />
              <span>{showRawJson ? 'サーバー保管生データ（JSON）を非表示' : 'サーバー保管生データ（JSON）を確認・コピー'}</span>
              <span className="text-[10px] text-slate-500 ml-1">({rawJsonString.length} bytes)</span>
            </button>

            {showRawJson && (
              <div className="mt-2 p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-mono">/data/account_vault.json</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(rawJsonString, 'raw-json')}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold flex items-center gap-1 transition cursor-pointer"
                  >
                    {copiedKey === 'raw-json' ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>コピー完了</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>JSONをコピー</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-[10px] text-slate-300 font-mono overflow-x-auto max-h-48 p-2 rounded bg-black/60 border border-slate-800/80 leading-relaxed">
                  {rawJsonString}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* フッターエリア */}
        <div className="px-5 py-3 border-t border-slate-800/80 bg-slate-950/80 flex items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">LIVEモードではすべての投稿が上記のアカウントへ直接送信されます</span>
            <span className="sm:hidden">LIVEモード運用中</span>
          </div>

          <div className="flex items-center gap-2">
            {onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>アカウント設定を開く</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-[#0085ff] hover:bg-blue-600 text-white text-xs font-bold transition cursor-pointer shadow-md shadow-blue-600/20"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
