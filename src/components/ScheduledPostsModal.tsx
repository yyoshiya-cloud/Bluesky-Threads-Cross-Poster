import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  X,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Play,
  List,
  CalendarDays,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Film,
  Image as ImageIcon,
  MessageSquare,
} from 'lucide-react';
import { ScheduledPostItem, ApiCredentials, TargetPlatformCategory } from '../types';
import {
  formatToJstString,
  getRelativeTimeJst,
  updateScheduledPost,
  deleteScheduledPost,
  getJstDatetimeLocalValue,
  parseJstDatetimeLocal,
  getJstQuickPresets,
} from '../utils/scheduledStorage';
import {
  getPlatformCategory,
  PLATFORM_CATEGORY_CONFIG,
} from '../utils/presetStorage';
import { getPostMediaCounts } from '../utils/mediaValidation';
import { executeScheduledPostItem } from '../utils/scheduledExecutor';
import { ScheduledCalendarView } from './ScheduledCalendarView';
import { ScheduledWeekView } from './ScheduledWeekView';

interface ScheduledPostsModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduledPosts: ScheduledPostItem[];
  onRefreshScheduledPosts: () => void;
  credentials: ApiCredentials;
  onLoadIntoEditor: (item: ScheduledPostItem) => void;
  onNotify: (toast: { type: 'success' | 'error' | 'info'; title: string; message: string }) => void;
  isDemoMode?: boolean;
}

export const ScheduledPostsModal: React.FC<ScheduledPostsModalProps> = ({
  isOpen,
  onClose,
  scheduledPosts,
  onRefreshScheduledPosts,
  credentials,
  onLoadIntoEditor,
  onNotify,
  isDemoMode,
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'week'>('list');
  const [activeTab, setActiveTab] = useState<'pending' | 'completed' | 'failed' | 'all'>('pending');
  const [platformCategoryFilter, setPlatformCategoryFilter] = useState<'all' | TargetPlatformCategory>('all');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDatetimeLocal, setEditDatetimeLocal] = useState<string>('');
  const [editPostToBluesky, setEditPostToBluesky] = useState<boolean>(true);
  const [editPostToThreads, setEditPostToThreads] = useState<boolean>(true);
  const [executingId, setExecutingId] = useState<string | null>(null);

  // 投稿日時のソート順 ('asc': 昇順・近い順, 'desc': 降順・新しい順)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() => {
    try {
      const saved = localStorage.getItem('cross_poster_scheduled_sort_order');
      if (saved === 'asc' || saved === 'desc') return saved;
    } catch {}
    return 'asc';
  });

  const handleSortOrderChange = (order: 'asc' | 'desc') => {
    setSortOrder(order);
    try {
      localStorage.setItem('cross_poster_scheduled_sort_order', order);
    } catch {}
  };

  // 定期的に残り時間の表示を更新
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const pendingPosts = scheduledPosts.filter((p) => p.status === 'pending');
  const completedPosts = scheduledPosts.filter((p) => p.status === 'completed');
  const failedPosts = scheduledPosts.filter((p) => p.status === 'failed');

  const statusFiltered =
    activeTab === 'pending'
      ? pendingPosts
      : activeTab === 'completed'
      ? completedPosts
      : activeTab === 'failed'
      ? failedPosts
      : scheduledPosts;

  const filteredPosts = statusFiltered.filter((item) => {
    if (platformCategoryFilter === 'all') return true;
    const cat = getPlatformCategory(item.postToBluesky, item.postToThreads);
    return cat === platformCategoryFilter;
  });

  const sortedPosts = [...filteredPosts].sort((a, b) => {
    if (sortOrder === 'asc') {
      return a.scheduledAt - b.scheduledAt;
    } else {
      return b.scheduledAt - a.scheduledAt;
    }
  });

  const handleStartEdit = (item: ScheduledPostItem) => {
    setEditingItemId(item.id);
    setEditDatetimeLocal(getJstDatetimeLocalValue(item.scheduledAt));
    setEditPostToBluesky(item.postToBluesky);
    setEditPostToThreads(item.postToThreads);
  };

  const handleSaveEdit = (id: string) => {
    const newTimestamp = parseJstDatetimeLocal(editDatetimeLocal);
    if (newTimestamp <= Date.now()) {
      onNotify({
        type: 'error',
        title: '無効な日時',
        message: '予約日時は現在時刻（日本時間）より未来の日時を指定してください。',
      });
      return;
    }

    if (!editPostToBluesky && !editPostToThreads) {
      onNotify({
        type: 'error',
        title: '投稿先が未選択',
        message: 'Bluesky または Threads のいずれかを選択してください。',
      });
      return;
    }

    updateScheduledPost(id, {
      scheduledAt: newTimestamp,
      postToBluesky: editPostToBluesky,
      postToThreads: editPostToThreads,
      status: 'pending',
    });
    setEditingItemId(null);
    onRefreshScheduledPosts();
    onNotify({
      type: 'success',
      title: '予約内容を更新しました',
      message: `日本時間 ${formatToJstString(newTimestamp)} に変更しました。`,
    });
  };

  const handleDelete = (id: string) => {
    deleteScheduledPost(id);
    onRefreshScheduledPosts();
    onNotify({
      type: 'info',
      title: '予約をキャンセルしました',
      message: '予約投稿を削除しました。',
    });
  };

  const handleExecuteNow = async (item: ScheduledPostItem) => {
    setExecutingId(item.id);
    try {
      await executeScheduledPostItem(item, credentials, (res) => {
        onNotify({
          type: res.success ? 'success' : 'error',
          title: res.success ? '投稿完了' : '投稿エラー',
          message: res.message,
        });
      });
      onRefreshScheduledPosts();
    } catch (e: any) {
      onNotify({
        type: 'error',
        title: '実行失敗',
        message: e.message || 'エラーが発生しました',
      });
    } finally {
      setExecutingId(null);
    }
  };

  const quickPresets = getJstQuickPresets();

  return (
    <div
      id="scheduled-posts-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-800 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* モーダルヘッダー */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-accent-subtle text-accent-light border border-accent flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">予約投稿マネージャー</h2>
                <span className="badge-accent px-2 py-0.5 rounded-full text-[10px] font-bold font-mono">
                  JST 日本時間 (UTC+9)
                </span>
              </div>
              <p className="text-xs text-slate-400">
                指定した日本時間に自動で Bluesky & Threads へマルチ配信します
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* DEMOモード時の注意バナー */}
        {(isDemoMode || credentials.isDemoMode) && (
          <div className="px-6 py-2 bg-sky-950/40 border-b border-sky-800/40 text-xs text-sky-200 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-300/80 shrink-0" />
              <span>DEMOモード中：予約投稿の追加・編集・キャンセルをテストできます。LIVE（本番）モード変更時に予約は自動消去されます。</span>
            </span>
          </div>
        )}

        {/* ビュー切り替えバー & サマリー */}
        <div className="px-6 py-2.5 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
          {/* 表示形式切り替え: リスト / 月間カレンダー / 週間カレンダー */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              id="scheduled-view-list-tab"
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'list'
                  ? 'btn-accent text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>📋 リスト表示 ({scheduledPosts.length})</span>
            </button>

            <button
              id="scheduled-view-calendar-tab"
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'calendar'
                  ? 'btn-accent text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>🗓️ 月間カレンダー</span>
            </button>

            <button
              id="scheduled-view-week-tab"
              type="button"
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'week'
                  ? 'btn-accent text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>📅 週間カレンダー</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>ブラウザ稼働中に自動監視・投稿実行中</span>
          </div>
        </div>

        {/* 月間カレンダービュー */}
        {viewMode === 'calendar' ? (
          <div className="p-4 flex-1 min-h-0 flex flex-col overflow-hidden">
            <ScheduledCalendarView
              scheduledPosts={scheduledPosts}
              onRefreshScheduledPosts={onRefreshScheduledPosts}
              credentials={credentials}
              onLoadIntoEditor={onLoadIntoEditor}
              onNotify={onNotify}
              onCloseModal={onClose}
              onSwitchToWeekView={() => setViewMode('week')}
              isDemoMode={isDemoMode}
            />
          </div>
        ) : viewMode === 'week' ? (
          <div className="p-4 flex-1 min-h-0 flex flex-col overflow-hidden">
            <ScheduledWeekView
              scheduledPosts={scheduledPosts}
              onRefreshScheduledPosts={onRefreshScheduledPosts}
              credentials={credentials}
              onLoadIntoEditor={onLoadIntoEditor}
              onNotify={onNotify}
              onCloseModal={onClose}
              onSwitchToMonthView={() => setViewMode('calendar')}
              isDemoMode={isDemoMode}
            />
          </div>
        ) : (
          <>
            {/* リスト形式用フィルターバー */}
            <div className="px-6 py-2.5 border-b border-slate-800/80 bg-slate-950/40 flex flex-wrap items-center justify-between gap-3">
              {/* ステータスタブ */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab('pending')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'pending'
                      ? 'bg-slate-800 text-accent-light border border-accent/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>待機中 ({pendingPosts.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('completed')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'completed'
                      ? 'bg-slate-800 text-accent-light border border-accent/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>完了済み ({completedPosts.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('failed')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'failed'
                      ? 'bg-rose-950/80 text-rose-300 border border-rose-600/60 shadow-sm'
                      : 'text-slate-400 hover:text-rose-300 hover:bg-slate-800/40'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  <span>エラー ({failedPosts.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'all'
                      ? 'bg-slate-800 text-accent-light border border-accent/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <span>すべて ({scheduledPosts.length})</span>
                </button>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* 🎯 投稿区分フィルター（同時投稿 / Bluesky / Threads） */}
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-[11px] text-slate-400 font-medium mr-1">区分:</span>
                  <button
                    type="button"
                    onClick={() => setPlatformCategoryFilter('all')}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                      platformCategoryFilter === 'all'
                        ? 'bg-slate-800 text-white border border-slate-700'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    すべて
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlatformCategoryFilter('both')}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                      platformCategoryFilter === 'both'
                        ? 'bg-sky-950 text-sky-200 border border-sky-600/60'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <span>🚀</span>
                    <span>同時投稿</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlatformCategoryFilter('bluesky')}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                      platformCategoryFilter === 'bluesky'
                        ? 'bg-[#0085ff]/30 text-[#0085ff] border border-[#0085ff]/60'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <span>🦋</span>
                    <span>Bluesky</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlatformCategoryFilter('threads')}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                      platformCategoryFilter === 'threads'
                        ? 'bg-purple-950 text-purple-300 border border-purple-700/60'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <span>🌀</span>
                    <span>Threads</span>
                  </button>
                </div>

                {/* 🔃 投稿日時の昇順/降順ソートボタン */}
                <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs shadow-xs">
                  <span className="text-[11px] text-slate-400 px-1.5 flex items-center gap-1 select-none">
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    <span>日時:</span>
                  </span>
                  <button
                    id="scheduled-sort-asc-btn"
                    type="button"
                    onClick={() => handleSortOrderChange('asc')}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                      sortOrder === 'asc'
                        ? 'bg-slate-800 text-sky-300 border border-slate-700 shadow-xs font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="投稿日時が早い順（昇順・近い順）"
                  >
                    <ArrowUp className="w-3 h-3" />
                    <span>昇順</span>
                  </button>
                  <button
                    id="scheduled-sort-desc-btn"
                    type="button"
                    onClick={() => handleSortOrderChange('desc')}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition cursor-pointer flex items-center gap-1 ${
                      sortOrder === 'desc'
                        ? 'bg-slate-800 text-sky-300 border border-slate-700 shadow-xs font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="投稿日時が遅い順（降順・新しい順）"
                  >
                    <ArrowDown className="w-3 h-3" />
                    <span>降順</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 投稿リスト */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {sortedPosts.length === 0 ? (
            <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-2xl space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/80 mx-auto flex items-center justify-center text-slate-500">
                <Clock className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-300">
                {activeTab === 'pending'
                  ? '現在、条件に一致する予約待機中の投稿はありません'
                  : '表示する予約履歴がありません'}
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                エディタ画面で「⏰ 予約投稿」に切り替えて日本時間の日時と投稿区分を指定すると、自動でキューに追加されます。
              </p>
            </div>
          ) : (
            sortedPosts.map((item) => {
              const rel = getRelativeTimeJst(item.scheduledAt);
              const isEditing = editingItemId === item.id;
              const isExecuting = executingId === item.id || item.status === 'posting';
              const cat = getPlatformCategory(item.postToBluesky, item.postToThreads);
              const catConfig = PLATFORM_CATEGORY_CONFIG[cat];

              return (
                <div
                  key={item.id}
                  className={`bg-slate-950/70 border rounded-2xl p-4.5 space-y-3 transition-all ${
                    item.status === 'pending'
                      ? rel.isSoon
                        ? 'border-amber-500/50 shadow-lg shadow-amber-950/20'
                        : 'border-slate-800 hover:border-slate-700'
                      : item.status === 'completed'
                      ? 'border-emerald-800/40 opacity-90'
                      : 'border-rose-800/50'
                  }`}
                >
                  {/* カードヘッダー */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-xs font-mono font-bold text-slate-200">
                        <Calendar className="w-3.5 h-3.5 text-accent-light" />
                        <span>{item.scheduledAtJstString}</span>
                      </div>

                      {item.status === 'pending' && (
                        <span
                          className={`text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 ${
                            rel.isSoon
                              ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                              : 'badge-accent'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          <span>{rel.text}</span>
                        </span>
                      )}

                      {item.status === 'completed' && (
                        <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-lg text-xs font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>投稿完了</span>
                        </span>
                      )}

                      {item.status === 'failed' && (
                        <span className="bg-rose-950/80 text-rose-300 border border-rose-800/60 px-2 py-0.5 rounded-lg text-xs font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>失敗</span>
                        </span>
                      )}

                      {item.status === 'posting' && (
                        <span className="bg-sky-950 text-sky-300 border border-sky-800/60 px-2 py-0.5 rounded-lg text-xs font-bold flex items-center gap-1 animate-pulse">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>投稿実行中...</span>
                        </span>
                      )}
                    </div>

                    {/* プラットフォーム・投稿区分バッジ */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 ${catConfig.badgeClass}`}>
                        <span>{catConfig.icon}</span>
                        <span>{catConfig.name}</span>
                      </span>

                      {item.threadsTopic && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-950/90 text-purple-300 border border-purple-800/60 text-[10px] font-medium flex items-center gap-0.5">
                          <span className="text-purple-400 font-bold">#</span>
                          <span>{item.threadsTopic}</span>
                        </span>
                      )}
                      {(() => {
                        const counts = getPostMediaCounts(item);
                        return (
                          <>
                            {counts.imageCount > 0 && (
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-sky-300 text-[10px] font-medium flex items-center gap-1 border border-sky-900/40">
                                📷 画像 {counts.imageCount}枚
                              </span>
                            )}
                            {counts.videoCount > 0 && (
                              <span className="px-2 py-0.5 rounded bg-purple-950/70 text-purple-300 text-[10px] font-medium flex items-center gap-1 border border-purple-800/50">
                                📹 動画 {counts.videoCount}本
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* リプライ先情報 */}
                  {item.replySettings?.enabled && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-indigo-300 bg-indigo-950/40 border border-indigo-800/40 px-2.5 py-1 rounded-lg">
                      <MessageSquare className="w-3 h-3 text-indigo-400 shrink-0" />
                      <span className="font-medium">返信先設定あり</span>
                      {item.replySettings.blueskyResolved && (
                        <span className="text-[10px] text-sky-300">
                          (Bluesky: @{item.replySettings.blueskyResolved.authorHandle || item.replySettings.blueskyResolved.authorName})
                        </span>
                      )}
                      {item.replySettings.threadsResolved && (
                        <span className="text-[10px] text-purple-300">
                          (Threads: 本人投稿)
                        </span>
                      )}
                    </div>
                  )}

                  {/* 本文プレビュー */}
                  <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800/80 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                    {item.text}
                  </div>

                  {/* 添付画像・動画サムネイル */}
                  {item.images.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {item.images.map((img, idx) => {
                        const src = img.thumbnailUrl || img.dataUrl;
                        const isVideo =
                          img.mediaType === 'video' ||
                          Boolean(img.mimeType?.startsWith('video/')) ||
                          Boolean(img.name && /\.(mp4|mov|webm|m4v|mkv|avi)$/i.test(img.name));

                        return (
                          <div
                            key={img.id || idx}
                            className="group relative w-12 h-12 rounded-lg border border-slate-700/80 overflow-hidden bg-slate-900 shrink-0 flex items-center justify-center transition-all hover:border-slate-500 hover:scale-105 shadow-xs"
                            title={
                              img.name
                                ? `${img.name} (${isVideo ? '動画' : '画像'})`
                                : isVideo
                                ? `添付動画 #${idx + 1}`
                                : `添付画像 #${idx + 1}`
                            }
                          >
                            {src ? (
                              <>
                                <img
                                  src={src}
                                  alt={img.alt || img.name || (isVideo ? '添付動画' : '添付画像')}
                                  className="w-full h-full object-cover"
                                />
                                {isVideo && (
                                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none group-hover:bg-black/25 transition-colors">
                                    <div className="w-5 h-5 rounded-full bg-purple-600/90 text-white flex items-center justify-center shadow-xs">
                                      <Play className="w-2.5 h-2.5 fill-white text-white translate-x-0.5" />
                                    </div>
                                    <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 bg-black/80 rounded text-[7px] font-mono text-purple-200 font-bold leading-none">
                                      動画
                                    </span>
                                  </div>
                                )}
                              </>
                            ) : isVideo ? (
                              <div className="w-full h-full bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center text-purple-300 p-0.5">
                                <Film className="w-4 h-4 text-purple-400 mb-0.5" />
                                <span className="text-[7px] font-bold leading-none">動画</span>
                              </div>
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-slate-900 to-slate-950 flex flex-col items-center justify-center text-sky-400 p-0.5 border border-slate-800">
                                <ImageIcon className="w-4 h-4 text-sky-400/80 mb-0.5" />
                                <span className="text-[7px] font-mono text-slate-400 leading-none">#{idx + 1}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* エラーメッセージ（失敗時） */}
                  {item.error && (
                    <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/50 text-xs text-rose-300 flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                      <span>{item.error}</span>
                    </div>
                  )}

                  {/* 日時・区分変更インラインフォーム */}
                  {isEditing && (
                    <div className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800 space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-accent-light" />
                          <span>予約日時および投稿区分の変更</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingItemId(null)}
                          className="text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
                        >
                          キャンセル
                        </button>
                      </div>

                      {/* 投稿区分の変更 */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-slate-400">投稿区分:</span>
                        <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                          <button
                            type="button"
                            onClick={() => {
                              setEditPostToBluesky(true);
                              setEditPostToThreads(true);
                            }}
                            className={`px-2 py-1 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                              editPostToBluesky && editPostToThreads
                                ? 'btn-accent text-white'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span>🚀</span>
                            <span>同時投稿</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditPostToBluesky(true);
                              setEditPostToThreads(false);
                            }}
                            className={`px-2 py-1 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                              editPostToBluesky && !editPostToThreads
                                ? 'bg-[#0085ff] text-white'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span>🦋</span>
                            <span>Bluesky</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditPostToBluesky(false);
                              setEditPostToThreads(true);
                            }}
                            className={`px-2 py-1 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                              !editPostToBluesky && editPostToThreads
                                ? 'bg-purple-700 text-white'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <span>🌀</span>
                            <span>Threads</span>
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-slate-400">予約日時 (JST):</span>
                          <button
                            type="button"
                            onClick={() => setEditDatetimeLocal(getJstDatetimeLocalValue(Date.now()))}
                            className="text-[10px] text-accent-light hover:text-white flex items-center gap-1 font-bold cursor-pointer transition hover:underline"
                            title="予約日時を現在の日本時間（JST）に変更します"
                          >
                            <Clock className="w-3 h-3" />
                            <span>現在日時に変更</span>
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="datetime-local"
                            value={editDatetimeLocal}
                            onChange={(e) => setEditDatetimeLocal(e.target.value)}
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus-ring-accent font-mono min-w-0"
                          />
                          <button
                            type="button"
                            onClick={() => setEditDatetimeLocal(getJstDatetimeLocalValue(Date.now()))}
                            className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer"
                            title="現在日時に変更"
                          >
                            <Clock className="w-3.5 h-3.5 text-accent-light" />
                            <span>現在日時</span>
                          </button>
                        </div>
                      </div>

                      {/* プリセットボタン */}
                      <div className="flex flex-wrap gap-1.5">
                        {quickPresets.slice(0, 4).map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            onClick={() => setEditDatetimeLocal(getJstDatetimeLocalValue(p.timestamp))}
                            className="px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition cursor-pointer"
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(item.id)}
                          className="px-4 py-1.5 rounded-xl btn-accent text-xs font-bold text-white cursor-pointer"
                        >
                          日時を保存
                        </button>
                      </div>
                    </div>
                  )}

                  {/* アクションボタンバー */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onLoadIntoEditor(item);
                          onClose();
                        }}
                        className="text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-800 transition cursor-pointer flex items-center gap-1 font-medium"
                        title="エディタにこの内容を復元"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>エディタで開く</span>
                      </button>

                      {item.status === 'pending' && !isEditing && (
                        <button
                          type="button"
                          onClick={() => handleStartEdit(item)}
                          className="text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-800 transition cursor-pointer flex items-center gap-1 font-medium"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>日時変更</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      {item.status === 'pending' && (
                        <button
                          type="button"
                          disabled={isExecuting}
                          onClick={() => handleExecuteNow(item)}
                          className={`${
                            isDemoMode || credentials.isDemoMode
                              ? 'bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-400/40 font-bold'
                              : 'btn-accent text-white font-bold'
                          } px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50`}
                          title={isDemoMode || credentials.isDemoMode ? '予定時刻を待たずに今すぐテスト実行' : '予定時刻を待たずに今すぐ投稿'}
                        >
                          {isExecuting ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                          <span>{isDemoMode || credentials.isDemoMode ? '今すぐ実行 (デモ)' : '今すぐ投稿'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 px-2.5 py-1.5 rounded-lg border border-rose-900/40 transition cursor-pointer flex items-center gap-1"
                        title="予約のキャンセル・削除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{item.status === 'pending' ? '予約解除' : '削除'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
            </div>
          </>
        )}

        {/* モーダルフッター */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            ※ アプリのタブが開いている間にバックグラウンドで指定の日本時間に自動投稿されます。
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
