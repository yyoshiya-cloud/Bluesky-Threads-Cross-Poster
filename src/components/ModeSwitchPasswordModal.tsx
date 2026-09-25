import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Key,
  Eye,
  EyeOff,
  AlertCircle,
  X as CloseIcon,
} from 'lucide-react';
import {
  verifyModePassword,
} from '../utils/modeSecurity';

interface ModeSwitchPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSwitch: () => void;
  targetModeIsLive: boolean; // true: ライブモードへ移行, false: デモモードへ移行
}

export const ModeSwitchPasswordModal: React.FC<ModeSwitchPasswordModalProps> = ({
  isOpen,
  onClose,
  onConfirmSwitch,
  targetModeIsLive,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setErrorMessage('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // パスワード認証 & モード切替の実行
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!password.trim()) {
      setErrorMessage('パスワードを入力してください。');
      return;
    }

    setIsVerifying(true);
    try {
      const isValid = await verifyModePassword(password);
      if (isValid) {
        onConfirmSwitch();
        onClose();
      } else {
        setErrorMessage('パスワードが正しくありません。');
      }
    } catch (err: any) {
      setErrorMessage(`認証エラー: ${err.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div
      id="mode-password-modal-backdrop"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="mode-password-modal"
        className="w-full max-w-md bg-[#121316] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-200"
      >
        {/* ヘッダー */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                LIVE（本番）モード切替の認証
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  LIVE（本番）へ
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                実アカウントへの投稿を有効化するためにパスワード認証を行います
              </p>
            </div>
          </div>
          <button
            id="mode-password-modal-close"
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            title="閉じる"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {/* フォーム本文 */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-start gap-2.5">
            <Key className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div className="text-[11.5px] text-slate-300 leading-relaxed">
              実アカウントへの意図しない投稿や誤操作を防ぐため、LIVE（本番）モードへの切替はパスワードで保護されています。
              <div className="mt-1.5 text-[10.5px] text-emerald-400/90 font-medium flex items-center gap-1">
                <span>✨</span>
                <span>切替時にDEMOモードの古いキャッシュ・残留ステート（予約・履歴・通信ログ・リプライ設定）は自動クリーンアップされます。</span>
              </div>
              <div className="mt-1 text-[10.5px] text-slate-400 font-normal">
                ※ LIVE（本番）モードからDEMOモードへの切替時はパスワード認証は不要です。
              </div>
            </div>
          </div>

          {/* パスワード入力フィールド */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>認証パスワード</span>
              <span className="text-[10px] text-slate-400 font-normal">Enterキーで決定</span>
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                id="mode-switch-password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                placeholder="パスワードを入力"
                className="w-full bg-[#0A0A0B] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 pr-10 font-mono"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 rounded transition cursor-pointer"
                title={showPassword ? '非表示' : '表示'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* エラーメッセージ */}
          {errorMessage && (
            <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* フッターアクション */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isVerifying || !password.trim()}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition shadow-md shadow-emerald-950/40 flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>LIVE（本番）モードに切り替える</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
