import React, { useState } from 'react';
import { PostHistoryItem } from '../types';
import {
  X as CloseIcon,
  History,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  Image as ImageIcon,
  Film,
  Trash2,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Download,
  Heart,
  Repeat,
  Flame,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react';
import { formatToJstString } from '../utils/scheduledStorage';
import { getPostMediaCounts } from '../utils/mediaValidation';
import { exportHistoryToCsv } from '../utils/exportImportHelper';
import { calculateEngagementComparison } from '../utils/engagementApi';

/**
 * 過去の様々な形式（ISO文字列、タイムスタンプ数値、日付文字列など）の履歴日時を
 * 統一された日本時間 (JST: UTC+9) 表記に変換
 */
function formatHistoryTimestampJst(raw: string | number | undefined): string {
  if (!raw) return '';
  const str = String(raw).trim();

  // すでに "JST" または "JST-9" が含まれている場合はそのまま返す
  if (str.endsWith('JST') || str.endsWith('JST-9')) return str;

  // 数値タイムスタンプ（ミリ秒）の場合
  const num = Number(str);
  if (!isNaN(num) && num > 100000000000) {
    return formatToJstString(num, true);
  }

  // 日付オブジェクトとしてパース可能か試行
  const parsedDate = new Date(str);
  if (!isNaN(parsedDate.getTime())) {
    return new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(parsedDate) + ' JST';
  }

  // 既にフォーマットされた文字列の場合は JST を付与
  return `${str} JST`;
}

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: PostHistoryItem[];
  onClearHistory: () => void;
  onDeleteItem?: (id: string) => void;
  onReuseText: (text: string) => void;
  onRetryPost?: (item: PostHistoryItem, targetPlatform: 'Bluesky' | 'Threads' | 'AllFailed' | 'All') => void;
  onOpenAnalytics?: () => void;
  onOpenCommErrors?: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onClearHistory,
  onDeleteItem,
  onReuseText,
  onRetryPost,
  onOpenAnalytics,
  onOpenCommErrors,
}) => {
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<
    null | { type: 'all' } | { type: 'single'; item: PostHistoryItem }
  >(null);

  if (!isOpen) return null;

  const handleExecuteDelete = () => {
    if (!deleteConfirmTarget) return;

    if (deleteConfirmTarget.type === 'all') {
      onClearHistory();
    } else if (deleteConfirmTarget.type === 'single' && onDeleteItem) {
      onDeleteItem(deleteConfirmTarget.item.id);
    }
    setDeleteConfirmTarget(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
      <div
        id="history-modal"
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-950 text-[#0085ff] border border-[#0085ff]/30">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">同時投稿の履歴ログ</h2>
              <p className="text-xs text-slate-400">これまでに送信された投稿の記録 (日本時間 / JST-9) & 失敗ツリーの再投稿</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => exportHistoryToCsv(history)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                title="CSVでエクスポート"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>CSV</span>
              </button>
            )}

            {history.length > 0 && (
              <button
                type="button"
                onClick={() => setDeleteConfirmTarget({ type: 'all' })}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 p-1.5 rounded hover:bg-slate-800 transition cursor-pointer"
                title="履歴全削除"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              id="close-history-modal-button"
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {history.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              まだ投稿履歴がありません。
            </div>
          ) : (
            history.map((item) => {
              const blueskyCount = (item.blueskyPosts || []).length;
              const threadsCount = (item.threadsPosts || []).length;

              const isBlueskyTarget = item.platforms.includes('Bluesky');
              const isThreadsTarget = item.platforms.includes('Threads');
              const mediaCounts = getPostMediaCounts(item);

              // エンゲージメント勝敗判定
              const comparison = calculateEngagementComparison(
                item.blueskyEngagement,
                item.threadsEngagement,
                item.platforms
              );

              // 各プラットフォームの成否判定（後方互換性対応）
              const isBlueskySuccess = item.blueskySuccess ?? (
                item.status === 'success' || (item.blueskyUrls && item.blueskyUrls.length > 0)
              );
              const isThreadsSuccess = item.threadsSuccess ?? (
                item.status === 'success' || (item.threadsUrls && item.threadsUrls.length > 0)
              );

              const hasBlueskyFailed = isBlueskyTarget && !isBlueskySuccess;
              const hasThreadsFailed = isThreadsTarget && !isThreadsSuccess;
              const hasAnyFailed = hasBlueskyFailed || hasThreadsFailed;

              return (
                <div
                  key={item.id}
                  className={`bg-slate-950 border rounded-xl p-4 space-y-3 transition ${
                    hasAnyFailed
                      ? 'border-rose-900/60 hover:border-rose-800'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* ヘッダー情報 */}
                  <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1 text-slate-400 font-mono">
                        <Clock className="w-3.5 h-3.5 text-accent-light" />
                        <span>{formatHistoryTimestampJst(item.timestamp)}</span>
                      </span>

                      {/* プラットフォーム個別バッジ */}
                      {isBlueskyTarget && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                            isBlueskySuccess
                              ? 'bg-[#0085ff]/10 text-[#0085ff] border-[#0085ff]/30'
                              : 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                          }`}
                        >
                          <span>🦋 Bluesky</span>
                          {isBlueskySuccess ? (
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                          ) : (
                            <XCircle className="w-2.5 h-2.5 text-rose-400" />
                          )}
                        </span>
                      )}

                      {isThreadsTarget && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 ${
                            isThreadsSuccess
                              ? 'bg-purple-950/60 text-purple-300 border-purple-800/50'
                              : 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                          }`}
                        >
                          <span>🌀 Threads</span>
                          {isThreadsSuccess ? (
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                          ) : (
                            <XCircle className="w-2.5 h-2.5 text-rose-400" />
                          )}
                        </span>
                      )}

                      {/* 反響インサイトバッジ */}
                      {comparison.winner === 'Bluesky' && (
                        <span className="px-2 py-0.5 rounded-full bg-[#0085ff]/15 text-[#0085ff] border border-[#0085ff]/30 text-[10px] font-bold flex items-center gap-1">
                          <Flame className="w-2.5 h-2.5 text-[#0085ff]" />
                          <span>{comparison.summaryText}</span>
                        </span>
                      )}
                      {comparison.winner === 'Threads' && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/60 text-[10px] font-bold flex items-center gap-1">
                          <Flame className="w-2.5 h-2.5 text-pink-400" />
                          <span>{comparison.summaryText}</span>
                        </span>
                      )}

                      {item.threadsTopic && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/60 text-[10px] font-medium flex items-center gap-0.5">
                          <span className="text-purple-400 font-bold">#</span>
                          <span>{item.threadsTopic}</span>
                        </span>
                      )}

                      {item.isDemo && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[9px] font-bold flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" />
                          デモ投稿
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {item.status === 'success' && (
                        <span className="flex items-center gap-1 text-emerald-400 font-medium text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          全送信成功
                        </span>
                      )}
                      {item.status === 'partial' && (
                        <span className="flex items-center gap-1 text-amber-400 font-medium text-xs">
                          <AlertCircle className="w-3.5 h-3.5" />
                          一部失敗
                        </span>
                      )}
                      {item.status === 'failed' && (
                        <span className="flex items-center gap-1 text-rose-400 font-medium text-xs">
                          <XCircle className="w-3.5 h-3.5" />
                          送信失敗
                        </span>
                      )}

                      {onDeleteItem && (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmTarget({ type: 'single', item })}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                          title="この履歴を削除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* リプライ先情報 */}
                  {item.replySettings?.enabled && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-indigo-300 bg-indigo-950/40 border border-indigo-800/40 px-2.5 py-1 rounded-lg">
                      <MessageSquare className="w-3 h-3 text-indigo-400 shrink-0" />
                      <span className="font-medium">返信先:</span>
                      {item.replySettings.blueskyResolved && (
                        <span className="text-[10px] text-sky-300">
                          Bsky: @{item.replySettings.blueskyResolved.authorHandle || item.replySettings.blueskyResolved.authorName}
                        </span>
                      )}
                      {item.replySettings.threadsResolved && (
                        <span className="text-[10px] text-purple-300">
                          Threads: 本人投稿
                        </span>
                      )}
                    </div>
                  )}

                  {/* 本文プレビュー */}
                  <p className="text-xs text-slate-200 whitespace-pre-wrap line-clamp-3 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60 font-sans">
                    {item.originalText}
                  </p>

                  {/* エンゲージメント簡易バー */}
                  {(item.blueskyEngagement || item.threadsEngagement) && (
                    <div className="flex items-center gap-4 text-xs font-mono bg-slate-900/40 px-3 py-1.5 rounded-lg border border-slate-800/40 flex-wrap">
                      {isBlueskyTarget && item.blueskyEngagement && (
                        <div className="flex items-center gap-2 text-slate-300">
                          <span className="text-[11px] font-bold text-[#0085ff]">🦋 Bluesky:</span>
                          <span className="flex items-center gap-1">
                            <Heart className="w-3 h-3 text-rose-400" />
                            <span className="font-bold">{item.blueskyEngagement.likes}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Repeat className="w-3 h-3 text-emerald-400" />
                            <span className="font-bold">{item.blueskyEngagement.reposts}</span>
                          </span>
                        </div>
                      )}
                      {isThreadsTarget && item.threadsEngagement && (
                        <div className="flex items-center gap-2 text-slate-300">
                          <span className="text-[11px] font-bold text-purple-300">🌀 Threads:</span>
                          <span className="flex items-center gap-1">
                            <Heart className="w-3 h-3 text-pink-400" />
                            <span className="font-bold">{item.threadsEngagement.likes}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Repeat className="w-3 h-3 text-emerald-400" />
                            <span className="font-bold">{item.threadsEngagement.reposts}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* エラーメッセージ */}
                  {item.errorMessage && (
                    <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-900/60">
                      <p className="text-[11px] text-rose-300 font-mono break-all leading-relaxed">
                        <strong className="text-rose-400">エラー詳細:</strong> {item.errorMessage}
                      </p>
                    </div>
                  )}

                  {/* 失敗時の「該当ツリーだけ再投稿」クイックアクション */}
                  {hasAnyFailed && onRetryPost && (
                    <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-rose-300 font-bold flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                          <span>失敗したツリーの個別再投稿:</span>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        {/* Bluesky のみ再投稿ボタン */}
                        {hasBlueskyFailed && (
                          <button
                            type="button"
                            onClick={() => onRetryPost(item, 'Bluesky')}
                            className="px-2.5 py-1.5 rounded-lg bg-[#0085ff] hover:bg-blue-600 text-white text-[11px] font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>🦋 Blueskyツリー ({blueskyCount}件) だけ再投稿</span>
                          </button>
                        )}

                        {/* Threads のみ再投稿ボタン */}
                        {hasThreadsFailed && (
                          <button
                            type="button"
                            onClick={() => onRetryPost(item, 'Threads')}
                            className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-[11px] font-bold transition flex items-center gap-1.5 shadow-md shadow-purple-500/20 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>🌀 Threadsツリー ({threadsCount}件) だけ再投稿</span>
                          </button>
                        )}

                        {/* 両方失敗時のまとめて再投稿ボタン */}
                        {hasBlueskyFailed && hasThreadsFailed && (
                          <button
                            type="button"
                            onClick={() => onRetryPost(item, 'AllFailed')}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3 text-amber-400" />
                            <span>両方のツリーを再送信</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* フッターアクションバー */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-900 flex-wrap gap-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {mediaCounts.imageCount > 0 && (
                        <span className="flex items-center gap-1 text-sky-400 font-medium">
                          <ImageIcon className="w-3.5 h-3.5" /> 画像 {mediaCounts.imageCount}枚
                        </span>
                      )}
                      {mediaCounts.videoCount > 0 && (
                        <span className="flex items-center gap-1 text-purple-400 font-medium">
                          <Film className="w-3.5 h-3.5" /> 動画 {mediaCounts.videoCount}本
                        </span>
                      )}
                      <span>
                        Bluesky: {blueskyCount}件 / Threads: {threadsCount}件
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {onRetryPost && (
                        <button
                          type="button"
                          onClick={() => onRetryPost(item, 'All')}
                          className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1 transition cursor-pointer"
                          title="この内容で新規投稿を実行"
                        >
                          <RotateCcw className="w-3 h-3 text-[#0085ff]" />
                          <span>再投稿</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          onReuseText(item.originalText);
                          onClose();
                        }}
                        className="text-xs font-semibold text-[#0085ff] hover:text-blue-400 flex items-center gap-1 cursor-pointer"
                      >
                        <span>エディタに復元</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 削除確認ダイアログ */}
        {deleteConfirmTarget && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-100">
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-100">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-rose-950/80 text-rose-400 border border-rose-800/80 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <h3 className="text-sm font-bold text-slate-100">
                    {deleteConfirmTarget.type === 'all'
                      ? '投稿履歴の全件削除'
                      : '投稿履歴の削除'}
                  </h3>
                  {deleteConfirmTarget.type === 'all' ? (
                    <p className="text-xs text-slate-400 leading-relaxed">
                      これまでに記録されたすべての投稿履歴（計 <strong className="text-slate-200">{history.length} 件</strong>）を完全に削除しますか？
                    </p>
                  ) : (
                    <div className="space-y-1.5 text-xs text-slate-400">
                      <p>
                        以下の投稿履歴（日時: <span className="font-mono text-slate-200">{formatHistoryTimestampJst(deleteConfirmTarget.item.timestamp)}</span>）を削除しますか？
                      </p>
                      <p className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300 line-clamp-3 italic">
                        "{deleteConfirmTarget.item.originalText}"
                      </p>
                    </div>
                  )}
                  <p className="text-[11px] text-rose-400 font-medium">
                    ※ この操作は取り消せません。
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmTarget(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleExecuteDelete}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-rose-950/50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    {deleteConfirmTarget.type === 'all'
                      ? '全件削除する'
                      : '削除する'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

