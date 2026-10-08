import React from 'react';
import { calculateBlueskyCharCount, calculateThreadsCharCount, countGraphemes } from '../utils/textSplitter';
import { Layers, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';

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

  const BLUESKY_MAX = 300;
  const THREADS_MAX = 500;

  // Bluesky 状態計算
  const blueskyRemaining = BLUESKY_MAX - blueskyCount;
  const blueskyIsOver = blueskyCount > BLUESKY_MAX;
  const blueskyIsWarning = !blueskyIsOver && blueskyRemaining <= 50; // 残り50文字以下で黄色
  const blueskyPercent = Math.min(100, Math.max(0, Math.round((blueskyCount / BLUESKY_MAX) * 100)));

  // Threads 状態計算
  const threadsRemaining = THREADS_MAX - threadsCount;
  const threadsIsOver = threadsCount > THREADS_MAX;
  const threadsIsWarning = !threadsIsOver && threadsRemaining <= 50; // 残り50文字以下で黄色
  const threadsPercent = Math.min(100, Math.max(0, Math.round((threadsCount / THREADS_MAX) * 100)));

  if (isCompact) {
    return (
      <div id="char-counter-container" className="inline-flex items-center gap-2 flex-wrap">
        {/* 全体文字数 (Grapheme Cluster) */}
        <div className="flex items-center gap-1 font-mono text-xs text-slate-300 px-1 py-0.5">
          <span className="font-extrabold text-white text-xs sm:text-sm">{graphemeLength}</span>
          <span className="text-[11px] text-slate-400">字</span>
        </div>

        {/* Bluesky リアルタイムカウンター */}
        {postToBluesky && (
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all duration-200 font-sans shadow-xs ${
              blueskyIsOver && !autoSplit
                ? 'bg-rose-950/60 border-rose-500/80 text-rose-200 ring-1 ring-rose-500/30'
                : blueskyIsOver && autoSplit
                ? 'bg-sky-950/50 border-sky-600/60 text-sky-200'
                : blueskyIsWarning
                ? 'bg-amber-950/50 border-amber-500/80 text-amber-200 ring-1 ring-amber-500/30'
                : 'bg-slate-900/90 border-slate-700/80 text-slate-200'
            }`}
            title={`Bluesky: ${blueskyCount}/${BLUESKY_MAX}文字 (${
              blueskyIsOver ? `${blueskyCount - BLUESKY_MAX}文字超過` : `残り${blueskyRemaining}文字`
            })`}
          >
            <span className="text-xs">🦋</span>

            {/* 文字数比率 */}
            <div className="flex items-center font-mono text-[11px] font-bold">
              <span
                className={
                  blueskyIsOver && !autoSplit
                    ? 'text-rose-400 font-black'
                    : blueskyIsWarning
                    ? 'text-amber-300 font-black'
                    : 'text-sky-300 font-semibold'
                }
              >
                {blueskyCount}
              </span>
              <span className="text-slate-500 text-[10px]">/{BLUESKY_MAX}</span>
            </div>

            {/* ミニプログレスバー */}
            <div className="w-10 sm:w-12 bg-slate-950 h-2 rounded-full overflow-hidden shrink-0 border border-slate-800">
              <div
                className={`h-full transition-all duration-200 ${
                  blueskyIsOver && !autoSplit
                    ? 'bg-rose-500'
                    : blueskyIsOver && autoSplit
                    ? 'bg-gradient-to-r from-sky-400 to-[#0085ff]'
                    : blueskyIsWarning
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-[#0085ff]'
                }`}
                style={{ width: `${blueskySplitsCount > 1 ? 100 : blueskyPercent}%` }}
              />
            </div>

            {/* ステータスバッジ（残り文字数 / 超過 / 分割数） */}
            {blueskySplitsCount > 1 ? (
              <span className="text-[10px] text-sky-300 font-bold bg-sky-950/80 px-1 py-0.2 rounded border border-sky-800/60">
                {blueskySplitsCount}通
              </span>
            ) : blueskyIsOver && !autoSplit ? (
              <span className="text-[10px] text-rose-300 font-extrabold bg-rose-900/60 px-1.5 py-0.2 rounded border border-rose-500/60 flex items-center gap-0.5 animate-pulse">
                <AlertCircle className="w-2.5 h-2.5" />
                +{blueskyCount - BLUESKY_MAX}字
              </span>
            ) : blueskyIsWarning ? (
              <span className="text-[10px] text-amber-300 font-extrabold bg-amber-900/60 px-1.5 py-0.2 rounded border border-amber-500/60 flex items-center gap-0.5">
                <AlertTriangle className="w-2.5 h-2.5" />
                残{blueskyRemaining}字
              </span>
            ) : (
              <span className="text-[10px] text-emerald-400 font-mono font-medium hidden sm:inline">
                残{blueskyRemaining}字
              </span>
            )}
          </div>
        )}

        {/* Threads リアルタイムカウンター */}
        {postToThreads && (
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-all duration-200 font-sans shadow-xs ${
              threadsIsOver && !autoSplit
                ? 'bg-rose-950/60 border-rose-500/80 text-rose-200 ring-1 ring-rose-500/30'
                : threadsIsOver && autoSplit
                ? 'bg-purple-950/50 border-purple-600/60 text-purple-200'
                : threadsIsWarning
                ? 'bg-amber-950/50 border-amber-500/80 text-amber-200 ring-1 ring-amber-500/30'
                : 'bg-slate-900/90 border-slate-700/80 text-slate-200'
            }`}
            title={`Threads: ${threadsCount}/${THREADS_MAX}文字 (${
              threadsIsOver ? `${threadsCount - THREADS_MAX}文字超過` : `残り${threadsRemaining}文字`
            })`}
          >
            <span className="text-xs">🌀</span>

            {/* 文字数比率 */}
            <div className="flex items-center font-mono text-[11px] font-bold">
              <span
                className={
                  threadsIsOver && !autoSplit
                    ? 'text-rose-400 font-black'
                    : threadsIsWarning
                    ? 'text-amber-300 font-black'
                    : 'text-purple-300 font-semibold'
                }
              >
                {threadsCount}
              </span>
              <span className="text-slate-500 text-[10px]">/{THREADS_MAX}</span>
            </div>

            {/* ミニプログレスバー */}
            <div className="w-10 sm:w-12 bg-slate-950 h-2 rounded-full overflow-hidden shrink-0 border border-slate-800">
              <div
                className={`h-full transition-all duration-200 ${
                  threadsIsOver && !autoSplit
                    ? 'bg-rose-500'
                    : threadsIsOver && autoSplit
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                    : threadsIsWarning
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-purple-500'
                }`}
                style={{ width: `${threadsSplitsCount > 1 ? 100 : threadsPercent}%` }}
              />
            </div>

            {/* ステータスバッジ（残り文字数 / 超過 / 分割数） */}
            {threadsSplitsCount > 1 ? (
              <span className="text-[10px] text-purple-300 font-bold bg-purple-950/80 px-1 py-0.2 rounded border border-purple-800/60">
                {threadsSplitsCount}通
              </span>
            ) : threadsIsOver && !autoSplit ? (
              <span className="text-[10px] text-rose-300 font-extrabold bg-rose-900/60 px-1.5 py-0.2 rounded border border-rose-500/60 flex items-center gap-0.5 animate-pulse">
                <AlertCircle className="w-2.5 h-2.5" />
                +{threadsCount - THREADS_MAX}字
              </span>
            ) : threadsIsWarning ? (
              <span className="text-[10px] text-amber-300 font-extrabold bg-amber-900/60 px-1.5 py-0.2 rounded border border-amber-500/60 flex items-center gap-0.5">
                <AlertTriangle className="w-2.5 h-2.5" />
                残{threadsRemaining}字
              </span>
            ) : (
              <span className="text-[10px] text-emerald-400 font-mono font-medium hidden sm:inline">
                残{threadsRemaining}字
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // 詳細カード表示（モーダルや設定パネル等で使用）
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
          className={`p-2.5 rounded-lg border transition-all ${
            !postToBluesky
              ? 'bg-slate-950/40 border-slate-800/40 opacity-50'
              : blueskyIsOver && !autoSplit
              ? 'bg-rose-950/40 border-rose-600/80 ring-1 ring-rose-500/30'
              : blueskyIsWarning
              ? 'bg-amber-950/40 border-amber-500/70 ring-1 ring-amber-500/30'
              : 'bg-slate-950/80 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#0085ff]/20 text-[#0085ff] flex items-center justify-center text-xs font-bold border border-[#0085ff]/30">
                🦋
              </span>
              <span className="text-xs font-bold text-slate-200">Bluesky</span>
            </div>

            <div className="flex items-center gap-1 font-mono text-xs">
              {blueskyIsOver && !autoSplit ? (
                <span className="text-rose-400 text-[11px] font-extrabold flex items-center gap-1 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-600/60">
                  <AlertCircle className="w-3 h-3" /> {blueskyCount - BLUESKY_MAX}文字超過 (要分割)
                </span>
              ) : blueskySplitsCount > 1 ? (
                <span className="text-[#0085ff] text-[11px] font-bold bg-[#0085ff]/10 px-2 py-0.5 rounded border border-[#0085ff]/30">
                  {blueskySplitsCount} 件のスレッド
                </span>
              ) : blueskyIsWarning ? (
                <span className="text-amber-300 text-[11px] font-bold flex items-center gap-1 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/60 animate-pulse">
                  <AlertTriangle className="w-3 h-3" /> 残り {blueskyRemaining}文字
                </span>
              ) : (
                <span className="text-emerald-400 text-[11px] font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> 残り {blueskyRemaining}文字
                </span>
              )}
            </div>
          </div>

          {/* プログレスバー */}
          <div className="space-y-1">
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-200 ${
                  blueskyIsOver && !autoSplit
                    ? 'bg-rose-500'
                    : blueskyIsOver && autoSplit
                    ? 'bg-gradient-to-r from-sky-400 to-[#0085ff]'
                    : blueskyIsWarning
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-[#0085ff]'
                }`}
                style={{ width: `${blueskySplitsCount > 1 ? 100 : blueskyPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
              <span className={blueskyIsOver && !autoSplit ? 'text-rose-400 font-bold' : blueskyIsWarning ? 'text-amber-300 font-bold' : 'text-slate-300'}>
                文字数: {blueskyCount}/{BLUESKY_MAX}
              </span>
              <span className={blueskyIsOver && !autoSplit ? 'text-rose-400 font-bold' : blueskyIsWarning ? 'text-amber-300 font-bold' : ''}>
                {blueskySplitsCount > 1
                  ? `分割後 各${blueskySplitsCount}投稿`
                  : blueskyIsOver
                  ? `${blueskyCount - BLUESKY_MAX}文字超過`
                  : `残り ${blueskyRemaining}文字`}
              </span>
            </div>
          </div>
        </div>

        {/* Threads カウンター */}
        <div
          id="threads-char-counter-card"
          className={`p-2.5 rounded-lg border transition-all ${
            !postToThreads
              ? 'bg-slate-950/40 border-slate-800/40 opacity-50'
              : threadsIsOver && !autoSplit
              ? 'bg-rose-950/40 border-rose-600/80 ring-1 ring-rose-500/30'
              : threadsIsWarning
              ? 'bg-amber-950/40 border-amber-500/70 ring-1 ring-amber-500/30'
              : 'bg-slate-950/80 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-purple-950/60 text-purple-400 flex items-center justify-center text-xs border border-purple-800/40">
                🌀
              </span>
              <span className="text-xs font-bold text-slate-200">Threads</span>
            </div>

            <div className="flex items-center gap-1 font-mono text-xs">
              {threadsIsOver && !autoSplit ? (
                <span className="text-rose-400 text-[11px] font-extrabold flex items-center gap-1 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-600/60">
                  <AlertCircle className="w-3 h-3" /> {threadsCount - THREADS_MAX}文字超過 (要分割)
                </span>
              ) : threadsSplitsCount > 1 ? (
                <span className="text-purple-400 text-[11px] font-bold bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800/50">
                  {threadsSplitsCount} 件のスレッド
                </span>
              ) : threadsIsWarning ? (
                <span className="text-amber-300 text-[11px] font-bold flex items-center gap-1 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/60 animate-pulse">
                  <AlertTriangle className="w-3 h-3" /> 残り {threadsRemaining}文字
                </span>
              ) : (
                <span className="text-emerald-400 text-[11px] font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> 残り {threadsRemaining}文字
                </span>
              )}
            </div>
          </div>

          {/* プログレスバー */}
          <div className="space-y-1">
            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-200 ${
                  threadsIsOver && !autoSplit
                    ? 'bg-rose-500'
                    : threadsIsOver && autoSplit
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500'
                    : threadsIsWarning
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-purple-500'
                }`}
                style={{ width: `${threadsSplitsCount > 1 ? 100 : threadsPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
              <span className={threadsIsOver && !autoSplit ? 'text-rose-400 font-bold' : threadsIsWarning ? 'text-amber-300 font-bold' : 'text-slate-300'}>
                文字数: {threadsCount}/{THREADS_MAX}
              </span>
              <span className={threadsIsOver && !autoSplit ? 'text-rose-400 font-bold' : threadsIsWarning ? 'text-amber-300 font-bold' : ''}>
                {threadsSplitsCount > 1
                  ? `分割後 各${threadsSplitsCount}投稿`
                  : threadsIsOver
                  ? `${threadsCount - THREADS_MAX}文字超過`
                  : `残り ${threadsRemaining}文字`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
