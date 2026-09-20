import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Play,
  Trash2,
  Edit3,
  CalendarDays,
  AlignJustify,
  Columns,
} from 'lucide-react';
import { ScheduledPostItem, ApiCredentials, TargetPlatformCategory } from '../types';
import {
  formatToJstString,
  getRelativeTimeJst,
  getJstDatetimeLocalValue,
  parseJstDatetimeLocal,
  updateScheduledPost,
  deleteScheduledPost,
} from '../utils/scheduledStorage';
import {
  getPlatformCategory,
  PLATFORM_CATEGORY_CONFIG,
} from '../utils/presetStorage';
import { getPostMediaCounts } from '../utils/mediaValidation';
import { executeScheduledPostItem } from '../utils/scheduledExecutor';

interface ScheduledWeekViewProps {
  scheduledPosts: ScheduledPostItem[];
  onRefreshScheduledPosts: () => void;
  credentials: ApiCredentials;
  onLoadIntoEditor: (item: ScheduledPostItem) => void;
  onNotify: (toast: { type: 'success' | 'error' | 'info'; title: string; message: string }) => void;
  onCloseModal: () => void;
  onSwitchToMonthView?: () => void;
  isDemoMode?: boolean;
}

/**
 * タイムスタンプをJSTの年月日キー (YYYY-MM-DD) に変換
 */
function getJstDateKey(timestamp: number): string {
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date(timestamp));
  let y = '', m = '', d = '';
  for (const p of parts) {
    if (p.type === 'year') y = p.value;
    if (p.type === 'month') m = p.value;
    if (p.type === 'day') d = p.value;
  }
  return `${y}-${m}-${d}`;
}

/**
 * タイムスタンプをJSTの時分文字列 (HH:mm) に変換
 */
function getJstTimeString(timestamp: number): string {
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return formatter.format(new Date(timestamp));
}

/**
 * JSTでの現在の年月日と曜日 (0:日..6:土)
 */
function getJstNowInfo(): { year: number; month: number; day: number; dayOfWeek: number; todayKey: string } {
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  const parts = formatter.formatToParts(new Date());
  let year = 2026, month = 1, day = 1;
  for (const p of parts) {
    if (p.type === 'year') year = parseInt(p.value, 10);
    if (p.type === 'month') month = parseInt(p.value, 10);
    if (p.type === 'day') day = parseInt(p.value, 10);
  }
  const jstNoon = new Date(Date.UTC(year, month - 1, day, 3, 0, 0));
  const dayOfWeek = jstNoon.getUTCDay();
  const mStr = month < 10 ? `0${month}` : `${month}`;
  const dStr = day < 10 ? `0${day}` : `${day}`;
  return { year, month, day, dayOfWeek, todayKey: `${year}-${mStr}-${dStr}` };
}

interface WeekDayInfo {
  dateKey: string;
  year: number;
  month: number;
  day: number;
  dayOfWeek: number;
  dayName: string;
  isToday: boolean;
  posts: ScheduledPostItem[];
}

export const ScheduledWeekView: React.FC<ScheduledWeekViewProps> = ({
  scheduledPosts,
  onRefreshScheduledPosts,
  credentials,
  onLoadIntoEditor,
  onNotify,
  onCloseModal,
  onSwitchToMonthView,
  isDemoMode,
}) => {
  const { todayKey } = useMemo(() => getJstNowInfo(), []);

  // レイアウト形式 ('row': 横行タイムライン形式, 'column': 7列横並びカラム形式)
  const [layoutMode, setLayoutMode] = useState<'row' | 'column'>(() => {
    try {
      const saved = localStorage.getItem('crosspost_week_layout_mode');
      if (saved === 'column') return 'column';
    } catch {
      // ignore
    }
    return 'row';
  });

  const handleSetLayoutMode = (mode: 'row' | 'column') => {
    setLayoutMode(mode);
    try {
      localStorage.setItem('crosspost_week_layout_mode', mode);
    } catch {
      // ignore
    }
  };

  // 週のオフセット (0: 今週, -1: 先週, +1: 来週)
  const [weekOffset, setWeekOffset] = useState<number>(0);

  // 選択中の日付 (YYYY-MM-DD)
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);

  // ステータスフィルター ('all' | 'pending' | 'completed' | 'failed')
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed' | 'failed'>('all');

  // 投稿区分フィルター ('all' | TargetPlatformCategory)
  const [filterCategory, setFilterCategory] = useState<'all' | TargetPlatformCategory>('all');

  // インライン編集状態
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDatetimeLocal, setEditDatetimeLocal] = useState<string>('');
  const [editPostToBluesky, setEditPostToBluesky] = useState<boolean>(true);
  const [editPostToThreads, setEditPostToThreads] = useState<boolean>(true);
  const [executingId, setExecutingId] = useState<string | null>(null);

  // フィルタリングされた予約投稿
  const filteredPosts = useMemo(() => {
    return scheduledPosts.filter((p) => {
      if (filterStatus !== 'all' && p.status !== filterStatus) return false;
      if (filterCategory !== 'all') {
        const cat = getPlatformCategory(p.postToBluesky, p.postToThreads);
        if (cat !== filterCategory) return false;
      }
      return true;
    });
  }, [scheduledPosts, filterStatus, filterCategory]);

  // 日付キーごとの投稿マップ
  const postsByDateMap = useMemo(() => {
    const map = new Map<string, ScheduledPostItem[]>();
    for (const post of filteredPosts) {
      const key = getJstDateKey(post.scheduledAt);
      const list = map.get(key) || [];
      list.push(post);
      map.set(key, list);
    }
    // 時刻昇順ソート
    map.forEach((list) => {
      list.sort((a, b) => a.scheduledAt - b.scheduledAt);
    });
    return map;
  }, [filteredPosts]);

  // 1週間の7日間のデータを算出
  const { weekDays, weekRangeLabel, totalWeekPosts } = useMemo(() => {
    const { year, month, day, dayOfWeek } = getJstNowInfo();
    // 今週の日曜日の日付 (UTC Noon)
    const sundayDate = new Date(Date.UTC(year, month - 1, day - dayOfWeek + weekOffset * 7, 3, 0, 0));

    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const days: WeekDayInfo[] = [];
    let count = 0;

    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.UTC(
        sundayDate.getUTCFullYear(),
        sundayDate.getUTCMonth(),
        sundayDate.getUTCDate() + i,
        3,
        0,
        0
      ));
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      const dt = d.getUTCDate();
      const dow = d.getUTCDay();
      const mStr = m < 10 ? `0${m}` : `${m}`;
      const dStr = dt < 10 ? `0${dt}` : `${dt}`;
      const dateKey = `${y}-${mStr}-${dStr}`;
      const posts = postsByDateMap.get(dateKey) || [];
      count += posts.length;

      days.push({
        dateKey,
        year: y,
        month: m,
        day: dt,
        dayOfWeek: dow,
        dayName: dayNames[dow],
        isToday: dateKey === todayKey,
        posts,
      });
    }

    const start = days[0];
    const end = days[6];
    const label = `${start.year}年${start.month}月${start.day}日(${start.dayName}) 〜 ${
      start.year !== end.year ? `${end.year}年` : ''
    }${end.month}月${end.day}日(${end.dayName})`;

    return { weekDays: days, weekRangeLabel: label, totalWeekPosts: count };
  }, [weekOffset, postsByDateMap, todayKey]);

  // ナビゲーション
  const handlePrevWeek = () => setWeekOffset((prev) => prev - 1);
  const handleNextWeek = () => setWeekOffset((prev) => prev + 1);
  const handleGoThisWeek = () => {
    setWeekOffset(0);
    setSelectedDateKey(todayKey);
  };

  // 編集ハンドラー
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

  // 予約カードの描画関数
  const renderCard = (item: ScheduledPostItem, isRowView: boolean) => {
    const timeStr = getJstTimeString(item.scheduledAt);
    const rel = getRelativeTimeJst(item.scheduledAt);
    const cat = getPlatformCategory(item.postToBluesky, item.postToThreads);
    const catConfig = PLATFORM_CATEGORY_CONFIG[cat];
    const isEditing = editingItemId === item.id;
    const isExecuting = executingId === item.id || item.status === 'posting';

    return (
      <div
        key={item.id}
        className={`rounded-xl border transition-all flex flex-col justify-between overflow-hidden ${
          isRowView
            ? 'min-w-[280px] max-w-[340px] flex-shrink-0 p-2.5 text-xs'
            : 'w-full p-2 text-[11px]'
        } ${
          item.status === 'pending'
            ? rel.isSoon
              ? 'bg-amber-950/40 border-amber-500/60 shadow-xs'
              : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
            : item.status === 'completed'
            ? 'bg-emerald-950/30 border-emerald-800/40 opacity-90'
            : 'bg-rose-950/30 border-rose-800/50'
        }`}
      >
        {/* 上部: 時刻 & 区分バッジ */}
        <div className="flex items-center justify-between gap-1 mb-1 min-w-0">
          <span className="font-mono font-bold text-accent-light text-[10px] sm:text-[11px] flex items-center gap-0.5 shrink-0">
            <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
            <span>{timeStr}</span>
          </span>

          <span
            className={`px-1.5 py-0.2 sm:py-0.5 rounded text-[9px] sm:text-[10px] font-bold flex items-center gap-0.5 truncate shrink-0 ${catConfig.badgeClass}`}
            title={catConfig.name}
          >
            <span>{catConfig.icon}</span>
            <span>{isRowView ? catConfig.name : cat === 'both' ? '同時' : cat === 'bluesky' ? 'BS' : 'TH'}</span>
          </span>
        </div>

        {/* 状態 / 残り時間 */}
        <div className="mb-1 min-w-0">
          {item.status === 'pending' && (
            <span
              className={`text-[8px] sm:text-[9px] px-1.5 py-0.2 rounded font-bold inline-flex items-center gap-0.5 truncate ${
                rel.isSoon
                  ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                  : 'badge-accent'
              }`}
            >
              {rel.text}
            </span>
          )}
          {item.status === 'completed' && (
            <span className="bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.2 rounded text-[8px] sm:text-[9px] font-bold inline-flex items-center gap-0.5">
              <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
              <span>完了</span>
            </span>
          )}
          {item.status === 'failed' && (
            <span className="bg-rose-950 text-rose-300 border border-rose-800/60 px-1.5 py-0.2 rounded text-[8px] sm:text-[9px] font-bold inline-flex items-center gap-0.5">
              <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
              <span>失敗</span>
            </span>
          )}
        </div>

        {/* 本文プレビュー */}
        <p className="text-[10px] sm:text-[11px] text-slate-200 line-clamp-2 sm:line-clamp-3 mb-1.5 font-sans whitespace-pre-wrap leading-relaxed bg-slate-900/80 p-1.5 rounded-lg border border-slate-800/60 break-words min-w-0">
          {item.text}
        </p>

        {/* トピックタグ & メディアバッジ */}
        <div className="flex items-center gap-1 flex-wrap mb-1.5">
          {item.threadsTopic && (
            <span className="px-1.5 py-0.2 rounded-full bg-purple-950/90 text-purple-300 border border-purple-800/60 text-[8px] sm:text-[9px] font-medium flex items-center gap-0.5 truncate max-w-full">
              <span className="text-purple-400 font-bold">#</span>
              <span className="truncate">{item.threadsTopic}</span>
            </span>
          )}
          {(() => {
            const counts = getPostMediaCounts(item);
            return (
              <>
                {counts.imageCount > 0 && (
                  <span className="px-1 py-0.2 rounded bg-slate-800 text-sky-300 text-[8px] sm:text-[9px] font-medium border border-sky-900/40">
                    📷 {counts.imageCount}
                  </span>
                )}
                {counts.videoCount > 0 && (
                  <span className="px-1 py-0.2 rounded bg-purple-950/70 text-purple-300 text-[8px] sm:text-[9px] font-medium border border-purple-800/50">
                    📹 {counts.videoCount}
                  </span>
                )}
              </>
            );
          })()}
        </div>

        {/* インライン編集フォーム */}
        {isEditing && (
          <div className="bg-slate-950 rounded-lg p-2 border border-slate-700 space-y-1.5 mb-1.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between text-[9px] text-slate-300 font-bold">
              <span>日時変更:</span>
              <button
                type="button"
                onClick={() => setEditingItemId(null)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* 区分選択 */}
            <div className="grid grid-cols-3 gap-0.5 bg-slate-900 p-0.5 rounded border border-slate-800 text-[9px]">
              <button
                type="button"
                onClick={() => {
                  setEditPostToBluesky(true);
                  setEditPostToThreads(true);
                }}
                className={`py-0.5 rounded text-center font-bold cursor-pointer ${
                  editPostToBluesky && editPostToThreads
                    ? 'btn-accent text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🚀
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditPostToBluesky(true);
                  setEditPostToThreads(false);
                }}
                className={`py-0.5 rounded text-center font-bold cursor-pointer ${
                  editPostToBluesky && !editPostToThreads
                    ? 'bg-[#0085ff] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🦋
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditPostToBluesky(false);
                  setEditPostToThreads(true);
                }}
                className={`py-0.5 rounded text-center font-bold cursor-pointer ${
                  !editPostToBluesky && editPostToThreads
                    ? 'bg-purple-700 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🌀
              </button>
            </div>

            {/* 日時選択 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[9px]">
                <span className="text-slate-400">日時 (JST):</span>
                <button
                  type="button"
                  onClick={() => setEditDatetimeLocal(getJstDatetimeLocalValue(Date.now()))}
                  className="text-accent-light hover:underline font-bold"
                  title="現在の日本時間（JST）を設定"
                >
                  現在
                </button>
              </div>
              <input
                type="datetime-local"
                value={editDatetimeLocal}
                onChange={(e) => setEditDatetimeLocal(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-slate-100 font-mono"
              />
              <div className="grid grid-cols-4 gap-0.5 text-[8px] font-bold">
                <button
                  type="button"
                  onClick={() => {
                    const cur = parseJstDatetimeLocal(editDatetimeLocal) || Date.now();
                    setEditDatetimeLocal(getJstDatetimeLocalValue(cur + 5 * 60 * 1000));
                  }}
                  className="py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-center cursor-pointer"
                >
                  +5m
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cur = parseJstDatetimeLocal(editDatetimeLocal) || Date.now();
                    setEditDatetimeLocal(getJstDatetimeLocalValue(cur + 15 * 60 * 1000));
                  }}
                  className="py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-center cursor-pointer"
                >
                  +15m
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cur = parseJstDatetimeLocal(editDatetimeLocal) || Date.now();
                    setEditDatetimeLocal(getJstDatetimeLocalValue(cur + 60 * 60 * 1000));
                  }}
                  className="py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-center cursor-pointer"
                >
                  +1h
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cur = parseJstDatetimeLocal(editDatetimeLocal) || Date.now();
                    setEditDatetimeLocal(getJstDatetimeLocalValue(cur + 24 * 60 * 60 * 1000));
                  }}
                  className="py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-center cursor-pointer"
                >
                  +1日
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleSaveEdit(item.id)}
              className="w-full py-1 rounded btn-accent text-[10px] font-bold text-white cursor-pointer shadow-xs"
            >
              保存
            </button>
          </div>
        )}

        {/* クイックアクションバー */}
        <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-800/80 text-[10px] min-w-0">
          <div className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              onClick={() => {
                onLoadIntoEditor(item);
                onCloseModal();
              }}
              className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 transition cursor-pointer flex items-center gap-0.5 text-[9px] sm:text-[10px] truncate"
              title="エディタに復元して編集"
            >
              <Edit3 className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
              <span>{isRowView ? 'エディタ復元' : '復元'}</span>
            </button>

            {item.status === 'pending' && !isEditing && (
              <button
                type="button"
                onClick={() => handleStartEdit(item)}
                className="p-1 rounded text-slate-400 hover:text-accent-light hover:bg-slate-800 transition cursor-pointer shrink-0"
                title="日時・区分を変更"
              >
                <CalendarIcon className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            {item.status === 'pending' && (
              <button
                type="button"
                disabled={isExecuting}
                onClick={() => handleExecuteNow(item)}
                className={`px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold transition cursor-pointer flex items-center gap-0.5 disabled:opacity-50 ${
                  isDemoMode || credentials.isDemoMode
                    ? 'bg-sky-500/20 text-sky-200 hover:bg-sky-500/30'
                    : 'btn-accent text-white'
                }`}
                title={isDemoMode || credentials.isDemoMode ? '今すぐ実行(デモ)' : '今すぐ投稿'}
              >
                {isExecuting ? (
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                ) : (
                  <Play className="w-2.5 h-2.5" />
                )}
                <span>実行</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleDelete(item.id)}
              className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition cursor-pointer"
              title="予約を解除"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0 space-y-3 animate-in fade-in duration-150">
      {/* 週間カレンダーコントロールバー */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800">
        {/* 週ナビゲーション */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevWeek}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
            title="前週へ"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 px-1">
            <CalendarDays className="w-4 h-4 text-accent-light" />
            <span className="text-xs sm:text-sm font-bold text-slate-100 font-mono">
              {weekRangeLabel}
            </span>
            <span className="badge-accent px-2 py-0.5 rounded-full text-[10px] font-bold">
              {totalWeekPosts}件の予定
            </span>
          </div>

          <button
            type="button"
            onClick={handleNextWeek}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
            title="次週へ"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleGoThisWeek}
            className={`ml-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition cursor-pointer ${
              weekOffset === 0
                ? 'bg-slate-800 text-accent-light border-accent/40 font-bold'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-accent-light border-slate-700'
            }`}
            title="今週に戻る"
          >
            今週へ
          </button>

          {onSwitchToMonthView && (
            <button
              type="button"
              onClick={onSwitchToMonthView}
              className="ml-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition cursor-pointer flex items-center gap-1"
              title="月間カレンダーに切り替え"
            >
              <CalendarIcon className="w-3.5 h-3.5 text-accent-light" />
              <span>月間表示</span>
            </button>
          )}
        </div>

        {/* コントロール右側: 横表示レイアウト切替 & フィルター群 */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* レイアウト切り替え (横行タイムライン vs 7列横並び) */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => handleSetLayoutMode('row')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer flex items-center gap-1.5 ${
                layoutMode === 'row'
                  ? 'btn-accent text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="横行タイムライン表示（各曜日が行として横に広がり予定が流れる）"
            >
              <AlignJustify className="w-3.5 h-3.5" />
              <span>横行表示</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetLayoutMode('column')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer flex items-center gap-1.5 ${
                layoutMode === 'column'
                  ? 'btn-accent text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="7列横並びカラム表示（日〜土が横一列に並ぶ）"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>7列横並び</span>
            </button>
          </div>

          {/* 区分フィルター */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-medium px-1">区分:</span>
            <button
              type="button"
              onClick={() => setFilterCategory('all')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                filterCategory === 'all' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              すべて
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory('both')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                filterCategory === 'both' ? 'bg-sky-950 text-sky-200 border border-sky-600/60 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🚀</span>
              <span>同時</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory('bluesky')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                filterCategory === 'bluesky' ? 'bg-[#0085ff]/30 text-[#0085ff] border border-[#0085ff]/60 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🦋</span>
              <span>BS</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory('threads')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                filterCategory === 'threads' ? 'bg-purple-950 text-purple-300 border border-purple-700/60 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🌀</span>
              <span>TH</span>
            </button>
          </div>

          {/* ステータスフィルター */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setFilterStatus('all')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                filterStatus === 'all' ? 'btn-accent text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              すべて
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('pending')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                filterStatus === 'pending' ? 'btn-accent text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              待機中
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('completed')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                filterStatus === 'completed' ? 'btn-accent text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              完了
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('failed')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                filterStatus === 'failed'
                  ? 'bg-rose-600 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-rose-300'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>エラー</span>
            </button>
          </div>
        </div>
      </div>

      {/* 週間メインコンテンツ (明細行・タイムラインのみ縦スクロール) */}
      {layoutMode === 'row' ? (
        /* 横行タイムライン表示 (各曜日を行として横に展開し、予定が横方向に流れる) */
        <div className="flex-1 min-h-0 space-y-3 overflow-y-auto pr-1">
          {weekDays.map((dayInfo) => {
            const isSelected = dayInfo.dateKey === selectedDateKey;
            const hasPosts = dayInfo.posts.length > 0;

            return (
              <div
                key={dayInfo.dateKey}
                onClick={() => setSelectedDateKey(dayInfo.dateKey)}
                className={`rounded-2xl border transition-all p-3 flex flex-col md:flex-row items-stretch gap-3 ${
                  isSelected
                    ? 'border-accent ring-2 ring-accent/30 bg-slate-900/95 shadow-md'
                    : dayInfo.isToday
                    ? 'border-accent/60 bg-slate-900/70'
                    : 'border-slate-800/80 bg-slate-950/60 hover:border-slate-700'
                }`}
              >
                {/* 左側: 曜日・日付ヘッダー */}
                <div
                  className={`md:w-44 md:min-w-[176px] flex-shrink-0 flex md:flex-col justify-between md:justify-center items-center md:items-start p-2.5 rounded-xl border transition ${
                    dayInfo.isToday
                      ? 'bg-accent/15 border-accent/40'
                      : isSelected
                      ? 'bg-accent-subtle/50 border-accent/30'
                      : 'bg-slate-900/80 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-base font-black px-2 py-0.5 rounded-lg ${
                        dayInfo.dayOfWeek === 0
                          ? 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                          : dayInfo.dayOfWeek === 6
                          ? 'bg-sky-950/80 text-sky-400 border border-sky-800/60'
                          : 'bg-slate-800 text-slate-200 border border-slate-700'
                      }`}
                    >
                      {dayInfo.dayName}
                    </span>
                    <span className="text-sm font-mono font-bold text-slate-100">
                      {dayInfo.month}月{dayInfo.day}日
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 mt-0 md:mt-2">
                    {dayInfo.isToday && (
                      <span className="badge-accent text-[9px] px-2 py-0.5 rounded-full font-bold">
                        本日
                      </span>
                    )}
                    {hasPosts ? (
                      <span className="text-[10px] px-2 py-0.5 font-bold rounded-full bg-slate-800 text-accent-light border border-accent/40 font-mono">
                        {dayInfo.posts.length}件の予定
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-medium">
                        予定なし
                      </span>
                    )}
                  </div>
                </div>

                {/* 右側: 予約投稿カードの横並びストリーム */}
                <div className="flex-1 min-w-0 flex items-stretch gap-3 overflow-x-auto py-1">
                  {!hasPosts ? (
                    <div className="flex items-center gap-2 text-slate-500 text-xs py-3 px-4 bg-slate-900/40 rounded-xl border border-dashed border-slate-800/70 w-full justify-center md:justify-start">
                      <Clock className="w-4 h-4 opacity-40" />
                      <span>この日の予約投稿はありません</span>
                    </div>
                  ) : (
                    dayInfo.posts.map((item) => renderCard(item, true))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* 7列横並びカラム表示 (常時横一列に日〜土が並ぶグリッド) */
        <div className="flex-1 min-h-0 bg-slate-950/80 rounded-2xl border border-slate-800 p-2.5 shadow-inner flex flex-col">
          <div className="flex-1 min-h-0 overflow-x-auto pb-1">
            <div className="grid grid-cols-7 gap-2.5 min-w-[920px] h-full">
              {weekDays.map((dayInfo) => {
                const isSelected = dayInfo.dateKey === selectedDateKey;
                const hasPosts = dayInfo.posts.length > 0;

                return (
                  <div
                    key={dayInfo.dateKey}
                    onClick={() => setSelectedDateKey(dayInfo.dateKey)}
                    className={`rounded-xl border transition-all flex flex-col h-full min-h-0 ${
                      isSelected
                        ? 'border-accent ring-2 ring-accent/30 bg-slate-900/90 shadow-lg'
                        : dayInfo.isToday
                        ? 'border-accent/60 bg-slate-900/60'
                        : 'border-slate-800/80 bg-slate-900/40 hover:border-slate-700'
                    }`}
                  >
                    {/* 曜日・日付ヘッダー */}
                    <div
                      className={`shrink-0 px-2.5 py-2 border-b rounded-t-xl flex items-center justify-between ${
                        dayInfo.isToday
                          ? 'bg-accent/15 border-accent/40'
                          : isSelected
                          ? 'bg-accent-subtle/50 border-accent/30'
                          : 'bg-slate-950/60 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-xs font-bold ${
                            dayInfo.dayOfWeek === 0
                              ? 'text-rose-400'
                              : dayInfo.dayOfWeek === 6
                              ? 'text-sky-400'
                              : 'text-slate-300'
                          }`}
                        >
                          {dayInfo.dayName}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-100">
                          {dayInfo.month}/{dayInfo.day}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {dayInfo.isToday && (
                          <span className="badge-accent text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                            本日
                          </span>
                        )}
                        {hasPosts && (
                          <span className="text-[10px] px-1.5 py-0.2 font-bold rounded-full bg-slate-800 text-accent-light border border-accent/40 font-mono">
                            {dayInfo.posts.length}件
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 予定ポスト一覧 (カラム内のみ縦スクロール) */}
                    <div className="p-2 space-y-2 flex-1 min-h-0 overflow-y-auto">
                      {!hasPosts ? (
                        <div className="h-full flex flex-col items-center justify-center py-8 text-slate-500 text-[11px]">
                          <Clock className="w-4 h-4 opacity-30 mb-1" />
                          <span>予定なし</span>
                        </div>
                      ) : (
                        dayInfo.posts.map((item) => renderCard(item, false))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
