import React from 'react';
import { X, Sparkles, ArrowRight } from 'lucide-react';
import { SAMPLE_TEXTS } from '../config/sampleTexts';

interface SampleTextsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSample: (text: string) => void;
  onNotify?: (toast: { type: 'success' | 'error' | 'warning' | 'info'; title: string; message: string }) => void;
}

export const SampleTextsModal: React.FC<SampleTextsModalProps> = ({
  isOpen,
  onClose,
  onSelectSample,
  onNotify,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="サンプル文章（例文）を選択"
        className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col w-full max-w-2xl max-h-[90vh] overflow-hidden text-slate-200 relative animate-in zoom-in-95 duration-150"
      >
        {/* ヘッダー */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>サンプル文章（例文）を選択</span>
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60">
                  全{SAMPLE_TEXTS.length}件
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                自動スレッド分割、---区切り、リンク化、文字数テスト用のサンプル例文をワンクリックで読み込みます
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="閉じる (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* サンプル一覧 */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3">
          {SAMPLE_TEXTS.map((s, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/50 transition flex flex-col gap-2 group shadow-sm"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-200 group-hover:text-amber-300 transition-colors">
                  {s.label}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                    {s.tag}
                  </span>
                  <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 font-mono">
                    {s.charCount}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                {s.summary}
              </p>

              <pre className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-sans text-xs whitespace-pre-wrap break-all leading-relaxed max-h-28 overflow-y-auto">
                {s.text}
              </pre>

              <div className="flex items-center justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onSelectSample(s.text);
                    onClose();
                    if (onNotify) {
                      onNotify({
                        type: 'success',
                        title: '例文を適用しました',
                        message: `「${s.label}」をエディタに読み込みました。`,
                      });
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20 active:scale-98"
                >
                  <span>この例文を読み込む</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* フッター */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400">
            💡 読み込んだ後で自由に変更・編集していただけます
          </span>
        </div>
      </div>
    </div>
  );
};
