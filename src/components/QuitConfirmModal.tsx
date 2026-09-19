import React, { useEffect } from 'react';
import { LogOut, X, AlertCircle } from 'lucide-react';

interface QuitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmQuit: () => void;
  appName?: string;
}

export const QuitConfirmModal: React.FC<QuitConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirmQuit,
  appName = 'CrossPost Desktop Studio',
}) => {
  // Escapeキーでキャンセル、Enterキーで終了確認
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

  if (!isOpen) return null;

  return (
    <div
      id="quit-confirm-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="quit-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quit-modal-title"
        className="relative w-full max-w-md bg-[#0D121F] border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/80 p-5 sm:p-6 overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 上部グラデーションデコレーション */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent via-sky-500 to-rose-500 opacity-90" />

        {/* 閉じるボタン */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800/60 transition cursor-pointer"
          title="キャンセル"
        >
          <X className="w-5 h-5" />
        </button>

        {/* アイコン & タイトル */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center shrink-0 shadow-inner">
            <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
              <LogOut className="w-4 h-4 text-rose-400" />
            </div>
          </div>

          <div className="flex-1 pr-4">
            <h2 id="quit-modal-title" className="text-lg font-bold text-slate-100 tracking-tight">
              終了しますか？
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {appName}
            </p>
          </div>
        </div>

        {/* 本文説明 */}
        <div className="mt-4 bg-slate-950/60 rounded-xl p-3.5 border border-slate-800/80 space-y-2 text-xs text-slate-300">
          <div className="flex items-center gap-2 text-amber-400/90 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>アプリケーションを終了します</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed pl-6">
            入力中の下書きや保存済みアカウント情報はブラウザストレージに安全に保管されています。
          </p>
        </div>

        {/* アクションボタン */}
        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            id="quit-cancel-button"
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800/80 hover:bg-slate-800 hover:text-white border border-slate-700/70 transition cursor-pointer shadow-sm"
          >
            キャンセル
          </button>
          <button
            id="quit-confirm-button"
            type="button"
            onClick={onConfirmQuit}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 border border-rose-500 transition cursor-pointer shadow-md shadow-rose-950/50 flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>終了する</span>
          </button>
        </div>
      </div>
    </div>
  );
};
