import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, KeyRound, RefreshCw, Tag, X, Check, Lock, Unlock, AlertTriangle, Sparkles, MousePointer, Sliders } from 'lucide-react';
import {
  verifyAdminPassword,
  setAdminPassword,
  getAppVersion,
  setAppVersion,
  resetAccountConnections,
  getModeSwitchClickCount,
  setModeSwitchClickCount,
} from '../utils/adminConfig';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdminMode: boolean;
  onActivateAdminMode: () => void;
  onDeactivateAdminMode: () => void;
  onResetCredentials: () => void;
  onVersionChanged?: (newVersion: string) => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  isAdminMode,
  onActivateAdminMode,
  onDeactivateAdminMode,
  onResetCredentials,
  onVersionChanged,
}) => {
  // ログインフォーム用
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // パスワード変更用
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // バージョン変更用
  const [versionInput, setVersionInput] = useState('');
  const [versionMessage, setVersionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // モード切替クリック回数設定用
  const [clickCountInput, setClickCountInput] = useState<number>(3);
  const [clickCountMessage, setClickCountMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 初期化二重確認用
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPasswordInput('');
      setLoginError('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage(null);
      setVersionInput(getAppVersion());
      setVersionMessage(null);
      setClickCountInput(getModeSwitchClickCount());
      setClickCountMessage(null);
      setShowResetConfirm(false);
      setResetMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 管理者モード起動処理
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput) {
      setLoginError('パスワードを入力してください。');
      return;
    }

    if (verifyAdminPassword(passwordInput)) {
      setLoginError('');
      setPasswordInput('');
      onActivateAdminMode();
    } else {
      setLoginError('管理者パスワードが正しくありません。（初期値: admin）');
    }
  };

  // パスワード変更処理
  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (!newPassword.trim()) {
      setPasswordMessage({ type: 'error', text: '新しいパスワードを入力してください。' });
      return;
    }

    if (newPassword.trim() !== confirmPassword.trim()) {
      setPasswordMessage({ type: 'error', text: '確認用パスワードが一致しません。' });
      return;
    }

    const success = setAdminPassword(newPassword.trim());
    if (success) {
      setPasswordMessage({ type: 'success', text: '管理者パスワードを変更しました。次回より新しいパスワードを使用してください。' });
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setPasswordMessage({ type: 'error', text: 'パスワードの変更に失敗しました。' });
    }
  };

  // バージョン更新処理
  const handleUpdateVersion = (e: React.FormEvent) => {
    e.preventDefault();
    setVersionMessage(null);

    if (!versionInput.trim()) {
      setVersionMessage({ type: 'error', text: 'バージョン番号を入力してください。' });
      return;
    }

    const success = setAppVersion(versionInput.trim());
    if (success) {
      setVersionMessage({ type: 'success', text: `アプリバージョンを "Ver ${versionInput.trim()}" に更新しました。` });
      if (onVersionChanged) {
        onVersionChanged(versionInput.trim());
      }
    } else {
      setVersionMessage({ type: 'error', text: 'バージョンの更新に失敗しました。' });
    }
  };

  // モード切替クリック回数更新処理
  const handleUpdateClickCount = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setClickCountMessage(null);

    const val = Number(clickCountInput);
    if (isNaN(val) || val < 1 || val > 20) {
      setClickCountMessage({ type: 'error', text: '1〜20の範囲で回数を指定してください。' });
      return;
    }

    const success = setModeSwitchClickCount(val);
    if (success) {
      setClickCountMessage({ type: 'success', text: `DEMO/LIVE切替の左クリック回数を「${val}回」に設定しました。` });
    } else {
      setClickCountMessage({ type: 'error', text: 'クリック回数の設定に失敗しました。' });
    }
  };

  // 接続情報初期化実行
  const handleExecuteReset = () => {
    try {
      resetAccountConnections();
      onResetCredentials();
      setShowResetConfirm(false);
      setResetMessage({
        type: 'success',
        text: 'LIVEモードのアカウント接続情報を初期化しました。（※ DEMOモードの接続情報は保持されています）',
      });
    } catch {
      setResetMessage({ type: 'error', text: '初期化処理に失敗しました。' });
    }
  };

  return (
    <div
      id="admin-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        // ウインドウ外・背景領域をクリックしても閉じたり画面遷移させない
        e.stopPropagation();
      }}
    >
      <div
        id="admin-modal"
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-xl bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden animate-in zoom-in-95 duration-150 text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 上部グラデーションデコレーション */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 opacity-90" />

        {/* ヘッダーエリア */}
        <div className="px-4 sm:px-5 py-2.5 sm:py-3 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm border ${
              isAdminMode
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}>
              {isAdminMode ? <ShieldCheck className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  管理者モード設定 (ADMIN MODE)
                </h2>
                {isAdminMode && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                    🔒 ADMIN MODE 起動中
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate sm:whitespace-normal">
                {isAdminMode
                  ? 'システム管理者専用設定パネル（投稿・ヘッダー操作はロック中）'
                  : '管理者モードを起動するにはパスワードを入力してください（初期値: admin）'}
              </p>
            </div>
          </div>
        </div>

        {/* モーダルコンテンツ */}
        <div className="p-3.5 sm:p-4 space-y-3 max-h-[82vh] overflow-y-auto">
          {!isAdminMode ? (
            /* 未認証時: 管理者ログインフォーム */
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-300 text-[11px] space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-200">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>管理者認証</span>
                </div>
                <p className="text-amber-300/90 leading-normal">
                  管理者モードを起動すると、投稿操作およびヘッダーボタンの押下がロックされ、システム管理設定（アカウント接続初期化、パスワード変更、アプリバージョン変更）が利用可能になります。
                </p>
                <div className="text-[10.5px] text-amber-400/80 bg-amber-950/40 p-1.5 rounded-lg font-mono">
                  ※ 初期パスワード: <strong className="text-amber-200">admin</strong>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-300">
                  管理者パスワード
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                    <Lock className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="パスワードを入力 (初期値: admin)"
                    autoFocus
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
                  />
                </div>
                {loginError && (
                  <p className="text-[11px] text-rose-400 flex items-center gap-1 font-medium pt-0.5">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>{loginError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition cursor-pointer shadow-md flex items-center gap-1.5"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>管理者モード起動 (ADMIN MODE)</span>
                </button>
              </div>
            </form>
          ) : (
            /* 認証完了時: 管理者設定パネル (コンパクト配置) */
            <div className="space-y-3">
              {/* ステータス告知 */}
              <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="flex-1 text-[11px] leading-tight">
                  <strong className="text-amber-300 font-bold mr-1.5">🔒 ADMIN MODE 起動中:</strong>
                  投稿・ヘッダーボタンの押下はロックされています。通常操作に戻すには最下部の「管理者モード終了」を押してください。
                </div>
              </div>

              {/* 1. アプリバージョンの変更 */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <Tag className="w-3.5 h-3.5 text-sky-400" />
                    <span>アプリバージョンの変更</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    現在: Ver {getAppVersion()}
                  </span>
                </div>

                <form onSubmit={handleUpdateVersion} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={versionInput}
                    onChange={(e) => setVersionInput(e.target.value)}
                    placeholder="例: 1.0.4"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition cursor-pointer shrink-0"
                  >
                    バージョン更新
                  </button>
                </form>
                {versionMessage && (
                  <p className={`text-[11px] flex items-center gap-1 ${
                    versionMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {versionMessage.type === 'success' ? <Check className="w-3 h-3 shrink-0" /> : <AlertTriangle className="w-3 h-3 shrink-0" />}
                    <span>{versionMessage.text}</span>
                  </p>
                )}
              </div>

              {/* 2. モード切替の左クリック回数設定（DEMO ↔ LIVE） */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <MousePointer className="w-3.5 h-3.5 text-cyan-400" />
                    <span>モード切替の左クリック回数設定 (DEMO ↔ LIVE)</span>
                  </div>
                  <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                    現在: {getModeSwitchClickCount()}回
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-tight">
                  ヘッダー左上のロゴ・タイトルを連続左クリックしてDEMO/LIVEモード切替（認証ダイアログ）を開く際の必要クリック回数を設定します。
                </p>

                <form onSubmit={handleUpdateClickCount} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[1, 2, 3, 4, 5, 7, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          setClickCountInput(num);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                          Number(clickCountInput) === num
                            ? 'bg-cyan-600 text-white border-cyan-400 shadow-sm'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {num}回{num === 3 ? ' (初期値)' : ''}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-0.5">
                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1">
                      <span className="text-xs text-slate-400">指定回数:</span>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={clickCountInput}
                        onChange={(e) => setClickCountInput(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)))}
                        className="w-14 bg-transparent text-xs text-cyan-300 font-bold text-center focus:outline-none font-mono"
                      />
                      <span className="text-xs text-slate-400">回</span>
                    </div>

                    <button
                      type="submit"
                      className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition cursor-pointer shrink-0 shadow-sm"
                    >
                      設定を保存
                    </button>
                  </div>

                  {clickCountMessage && (
                    <p className={`text-[11px] flex items-center gap-1 ${
                      clickCountMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {clickCountMessage.type === 'success' ? <Check className="w-3 h-3 shrink-0" /> : <AlertTriangle className="w-3 h-3 shrink-0" />}
                      <span>{clickCountMessage.text}</span>
                    </p>
                  )}
                </form>
              </div>

              {/* 3. 初期化設定（LIVEモードのアカウント接続情報の初期化） */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                    <RefreshCw className="w-3.5 h-3.5 text-orange-400" />
                    <span>初期化設定（LIVEモード接続情報の初期化）</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-slate-400 leading-tight flex-1">
                    LIVEモード（本番環境）で記憶されている Bluesky（ハンドル・PW）および Threads（トークン・ユーザー名）の接続情報を消去します。<br />
                    <span className="text-slate-500 font-medium">※ DEMOモードの接続情報は変更・初期化されません。</span>
                  </p>

                  {!showResetConfirm ? (
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(true)}
                      className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 text-xs font-bold transition cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
                      <span>LIVE接続情報を初期化</span>
                    </button>
                  ) : null}
                </div>

                {showResetConfirm && (
                  <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-600/60 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-200">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>LIVEモードで記憶している接続情報を初期化しますか？</span>
                    </div>
                    <p className="text-[10.5px] text-rose-300/80 leading-tight">
                      本番アカウントの接続データがクリアされます。（※ DEMOモードの接続情報は保持されます）
                    </p>
                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={handleExecuteReset}
                        className="px-3 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold transition cursor-pointer"
                      >
                        はい、LIVE接続情報を初期化します
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowResetConfirm(false)}
                        className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition cursor-pointer"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                )}

                {resetMessage && (
                  <p className={`text-[11px] flex items-center gap-1 ${
                    resetMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {resetMessage.type === 'success' ? <Check className="w-3 h-3 shrink-0" /> : <AlertTriangle className="w-3 h-3 shrink-0" />}
                    <span>{resetMessage.text}</span>
                  </p>
                )}
              </div>

              {/* 3. 管理者パスワード変更 */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 border-b border-slate-800/80 pb-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>管理者パスワードの変更</span>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="新しいパスワード"
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                    />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="パスワードの再入力"
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[10px] text-slate-500">
                      ※ 暗号化ストレージに即時記憶されます
                    </span>
                    <button
                      type="submit"
                      className="px-3.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition cursor-pointer shrink-0"
                    >
                      パスワード変更
                    </button>
                  </div>

                  {passwordMessage && (
                    <p className={`text-[11px] flex items-center gap-1 ${
                      passwordMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {passwordMessage.type === 'success' ? <Check className="w-3 h-3 shrink-0" /> : <AlertTriangle className="w-3 h-3 shrink-0" />}
                      <span>{passwordMessage.text}</span>
                    </p>
                  )}
                </form>
              </div>

              {/* 4. 管理者モード終了 */}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400">
                  通常モードに戻すとボタン押下ロックが解除されます。
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onDeactivateAdminMode();
                    onClose();
                  }}
                  className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition cursor-pointer border border-slate-700 flex items-center gap-1.5 shrink-0 shadow-sm"
                >
                  <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>管理者モード終了</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
