import React from 'react';
import { ToastMessage } from '../types';
import { AlertTriangle, CheckCircle2, Info, XCircle, LogIn, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
  onOpenSettings?: () => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
  onOpenSettings,
}) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4 sm:px-0">
      <AnimatePresence>
        {toasts.map((t) => {
          const isError = t.type === 'error';
          const isWarning = t.type === 'warning';
          const isSuccess = t.type === 'success';

          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto rounded-xl shadow-xl border p-4 bg-white dark:bg-slate-900 ${
                isError
                  ? 'border-red-300 dark:border-red-800/60 shadow-red-500/10'
                  : isWarning
                  ? 'border-amber-300 dark:border-amber-800/60 shadow-amber-500/10'
                  : isSuccess
                  ? 'border-emerald-300 dark:border-emerald-800/60 shadow-emerald-500/10'
                  : 'border-blue-300 dark:border-blue-800/60 shadow-blue-500/10'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  {isError && <XCircle className="w-5 h-5 text-red-500" />}
                  {isWarning && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                  {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                  {!isError && !isWarning && !isSuccess && <Info className="w-5 h-5 text-blue-500" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                      {t.title}
                    </span>

                    {t.platform && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          t.platform === 'Bluesky'
                            ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                            : t.platform === 'Threads'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {t.platform}
                      </span>
                    )}

                    {t.errorCode && (
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/50">
                        {String(t.errorCode).startsWith('Code:') ? t.errorCode : `Code: ${t.errorCode}`}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed break-words">
                    {t.message}
                  </p>

                  {/* 再ログインが必要な場合のボタン */}
                  {t.requiresReLogin && onOpenSettings && (
                    <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          onOpenSettings();
                          onDismiss(t.id);
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors shadow-sm cursor-pointer"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        設定を開いて再ログイン
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onDismiss(t.id)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
