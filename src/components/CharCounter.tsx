import React from 'react';
import { calculateBlueskyCharCount, calculateThreadsCharCount, countGraphemes } from '../utils/textSplitter';
import { Layers, AlertCircle, CheckCircle2 } from 'lucide-react';

interface CharCounterProps {
  text: string;
  postToBluesky: boolean;
  postToThreads: boolean;
  blueskySplitsCount: number;
  threadsSplitsCount: number;
  autoSplit: boolean;
  isCompact?: boolean;
}

export const CharCounter: React.FC<CharCounterProps> = ({
  text,
  postToBluesky,
  postToThreads,
  blueskySplitsCount,
  threadsSplitsCount,
  autoSplit,
  isCompact = false,
}) => {
  const graphemeLength = countGraphemes(text);
  const blueskyCount = calculateBlueskyCharCount(text);
  const threadsCount = calculateThreadsCharCount(text);
  const blueskyPercent = Math.min(100, Math.round((blueskyCount / 300) * 100));
  const threadsPercent = Math.min(100, Math.round((threadsCount / 500) * 100));

  const blueskyOver = blueskyCount > 300;
  const threadsOver = threadsCount > 500;

  if (isCompact) {
    return (
      <div id="char-counter-container" className="inline-flex items-center gap-2 flex-wrap">
        {/* 文字数 */}
        <div className="flex items-center gap-1 font-mono text-xs text-slate-300">
          <span className="font-bold text-slate-100 text-xs sm:text-sm">{graphemeLength}</span>
          <span className="text-[11px] text-slate-400">字</span>
        </div>

        {/* Bluesky */}
        {postToBluesky && (
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs transition ${
              blueskyOver && !autoSplit
                ? 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                : 'bg-slate-900/90 border-slate-800 text-slate-300'
            }`}
          >
            <span className="text-[10px]">🦋</span>
            <div className="flex items-center font-mono text-[11px]">
              <span className={blueskyOver && !autoSplit ? 'text-rose-400 font-bold' : 'text-slate-200 font-semibold'}>
                {blueskyCount}
              </span>
              <span className="text-slate-500">/300</span>
            </div>
            {/* ミニプログレスバー */}
            <div className="w-10 bg-slate-800 h-1.5 rounded-full overflow-hidden shrink-0">
              <div
                className={`h-full transition-all duration-200 ${
                  blueskyOver && !autoSplit
                    ? 'bg-rose-500'
                    : blueskyOver
                    ? 'bg-gradient-to-r from-sky-400 to-[#0085ff]'
                    : blueskyPercent > 85
                    ? 'bg-amber-400'
                    : 'bg-[#0085ff]'
                }`}
                style={{ width: `${blueskySplitsCount > 1 ? 100 : blueskyPercent}%` }}
              />
            </div>
            {blueskySplitsCount > 1 ? (
              <span className="text-[10px] text-sky-400 font-bold font-sans">({blueskySplitsCount}通)</span>
            ) : blueskyOver && !autoSplit ? (
              <span className="text-[10px] text-rose-400 font-bold font-sans">超過</span>
            ) : (
              <span className="text-[10px] text-emerald-400 font-sans hidden sm:inline">収容可</span>
            )}
          </div>
        )}

        {/* Threads */}
        {postToThreads && (
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs transition ${
              threadsOver && !autoSplit
                ? 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                : 'bg-slate-900/90 border-slate-800 text-slate-300'
            }`}
          >
            <span className="text-[10px]">🌀</span>
            <div className="flex items-center font-mono text-[11px]">
              <span className={threadsOver && !autoSplit ? 'text-rose-400 font-bold' : 'text-slate-200 font-semibold'}>
                {threadsCount}
              </span>
              <span className="text-slate-500">/500</span>
            </div>
            {/* ミニプログレスバー */}
            <div className="w-10 bg-slate-800 h-1.5 rounded-full overflow-hidden shrink-0">
              <div
                className={`h-full transition-all duration-200 ${
                  threadsOver && !autoSplit
                    ? 'bg-rose-500'
                    : threadsOver
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                    : threadsPercent > 85
                    ? 'bg-amber-400'
                    : 'bg-purple-500'
                }`}
                style={{ width: `${threadsSplitsCount > 1 ? 100 : threadsPercent}%` }}
              />
            </div>
            {threadsSplitsCount > 1 ? (
              <span className="text-[10px] text-purple-300 font-bold font-sans">({threadsSplitsCount}通)</span>
            ) : threadsOver && !autoSplit ? (
              <span className="text-[10px] text-rose-400 font-bold font-sans">超過</span>
            ) : (
              <span className="text-[10px] text-emerald-400 font-sans hidden sm:inline">収容可</span>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div id="char-counter-container" className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 sm:p-3 space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-400 font-medium pb-1.5 border-b border-slate-800/80">
        <span className="flex items-center gap-1.5">
          <span className="text-slate-200 font-bold text-xs sm:text-sm">{graphemeLength}</span>
          <span className="text-[11px]">文字 (Grapheme Cluster準拠)</span>
        </span>
        {(blueskySplitsCount > 1 || threadsSplitsCount > 1) && (
          <span className="flex items-center gap-1 font-medium badge-accent px-2 py-0.5 rounded-full text-[10px]">
            <Layers className="w-3 h-3" />
            スレッド分割有効
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {/* Bluesky カウンター */}
        <div
          id="bluesky-char-counter-card"
          className={`p-2 sm:p-2.5 rounded-lg border transition-all ${
            !postToBluesky
              ? 'bg-slate-950/40 border-slate-800/40 opacity-50'
              : blueskyOver && !autoSplit
              ? 'bg-rose-950/30 border-rose-800/60 ring-1 ring-rose-500/20'
              : 'bg-slate-950/80 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span className="w-4.5 h-4.5 rounded-full bg-[#0085ff]/20 text-[#0085ff] flex items-center justify-center text-[10px] font-bold border border-[#0085ff]/30">
                🦋
              </span>
              <span className="text-xs font-semibold text-slate-200">Bluesky</span>
            </div>

            <div className="flex items-center gap-1">
              {blueskyOver && !autoSplit ? (
                <span className="text-rose-400 text-[11px] font-bold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> 超過 (要分割)
                </span>
              ) : blueskySplitsCount > 1 ? (
                <span className="text-[#0085ff] text-[10px] font-bold bg-[#0085ff]/10 px-1.5 py-0.2 rounded border border-[#0085ff]/30">
                  {blueskySplitsCount} 件のスレッド
                </span>
              ) : (
                <span className="text-emerald-400 text-[11px] font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> 1投稿に収まります
                </span>
              )}
            </div>
          </div>

          {/* プログレスバー */}
          <div className="space-y-0.5">
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${
                  blueskyOver && !autoSplit
                    ? 'bg-rose-500'
                    : blueskyOver
                    ? 'bg-gradient-to-r from-sky-400 to-[#0085ff]'
                    : blueskyPercent > 85
                    ? 'bg-amber-400'
                    : 'bg-[#0085ff]'
                }`}
                style={{ width: `${blueskySplitsCount > 1 ? 100 : blueskyPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>
                文字数: {blueskyCount}/300文字
              </span>
              <span className={blueskyOver && !autoSplit ? 'text-rose-400 font-bold' : ''}>
                {blueskySplitsCount > 1
                  ? `分割後 各${blueskySplitsCount}投稿`
                  : blueskyOver
                  ? `${blueskyCount - 300}文字超過`
                  : `残り ${300 - blueskyCount}文字`}
              </span>
            </div>
          </div>
        </div>

        {/* Threads カウンター */}
        <div
          id="threads-char-counter-card"
          className={`p-2 sm:p-2.5 rounded-lg border transition-all ${
            !postToThreads
              ? 'bg-slate-950/40 border-slate-800/40 opacity-50'
              : threadsOver && !autoSplit
              ? 'bg-rose-950/30 border-rose-800/60 ring-1 ring-rose-500/20'
              : 'bg-slate-950/80 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <span className="w-4.5 h-4.5 rounded-full bg-purple-950/60 text-purple-400 flex items-center justify-center text-[10px] border border-purple-800/40">
                🌀
              </span>
              <span className="text-xs font-semibold text-slate-200">Threads</span>
            </div>

            <div className="flex items-center gap-1">
              {threadsOver && !autoSplit ? (
                <span className="text-rose-400 text-[11px] font-bold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> 超過 (要分割)
                </span>
              ) : threadsSplitsCount > 1 ? (
                <span className="text-purple-400 text-[10px] font-bold bg-purple-950/80 px-1.5 py-0.2 rounded border border-purple-800/50">
                  {threadsSplitsCount} 件のスレッド
                </span>
              ) : (
                <span className="text-emerald-400 text-[11px] font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> 1投稿に収まります
                </span>
              )}
            </div>
          </div>

          {/* プログレスバー */}
          <div className="space-y-0.5">
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-200 ${
                  threadsOver && !autoSplit
                    ? 'bg-rose-500'
                    : threadsOver
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                    : threadsPercent > 85
                    ? 'bg-amber-400'
                    : 'bg-purple-500'
                }`}
                style={{ width: `${threadsSplitsCount > 1 ? 100 : threadsPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>
                文字数: {threadsCount}/500文字
              </span>
              <span className={threadsOver && !autoSplit ? 'text-rose-400 font-bold' : ''}>
                {threadsSplitsCount > 1
                  ? `分割後 各${threadsSplitsCount}投稿`
                  : threadsOver
                  ? `${threadsCount - 500}文字超過`
                  : `残り ${500 - threadsCount}文字`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
