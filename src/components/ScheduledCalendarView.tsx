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
  Film,
  Image as ImageIcon,
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

interface ScheduledCalendarViewProps {
  scheduledPosts: ScheduledPostItem[];
  onRefreshScheduledPosts: () => void;
  credentials: ApiCredentials;
  onLoadIntoEditor: (item: ScheduledPostItem) => void;
  onNotify: (toast: { type: 'success' | 'error' | 'info'; title: string; message: string }) => void;
  onCloseModal: () => void;
  onSwitchToWeekView?: () => void;
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
 * 現在のJSTの年月を取得
 */
function getCurrentJstYearMonth(): { year: number; month: number; todayKey: string } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(now);
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  let day = '01';
  for (const p of parts) {
    if (p.type === 'year') year = parseInt(p.value, 10);
    if (p.type === 'month') month = parseInt(p.value, 10);
    if (p.type === 'day') day = p.value;
  }
  const mStr = month < 10 ? `0${month}` : `${month}`;
  return { year, month, todayKey: `${year}-${mStr}-${day}` };
}

export const ScheduledCalendarView: React.FC<ScheduledCalendarViewProps> = ({
  scheduledPosts,
  onRefreshScheduledPosts,
  credentials,
  onLoadIntoEditor,
  onNotify,
  onCloseModal,
  onSwitchToWeekView,
  isDemoMode,
}) => {
  const { year: currentYear, month: currentMonth, todayKey } = useMemo(() => getCurrentJstYearMonth(), []);

  // 表示中の年月
  const [viewYear, setViewYear] = useState<number>(currentYear);
  const [viewMonth, setViewMonth] = useState<number>(currentMonth); // 1-12

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
    // 各日付内で時刻昇順ソート
    map.forEach((list) => {
      list.sort((a, b) => a.scheduledAt - b.scheduledAt);
    });
    return map;
  }, [filteredPosts]);

  // 前月へ
  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  // 次月へ
  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // 今月へリセット
  const handleGoToday = () => {
    setViewYear(currentYear);
    setViewMonth(currentMonth);
    setSelectedDateKey(todayKey);
  };

  // カレンダーグリッドの日付セルデータ計算
  const calendarCells = useMemo(() => {
    // 1日のDate（ローカル）
    const firstDay = new Date(viewYear, viewMonth - 1, 1);
    const startingDayOfWeek = firstDay.getDay(); // 0:日, 1:月, ... 6:土

    // 当月の日数
    const lastDay = new Date(viewYear, viewMonth, 0);
    const daysInMonth = lastDay.getDate();

    // 前月の日数
    const prevMonthLastDay = new Date(viewYear, viewMonth - 1, 0);
    const daysInPrevMonth = prevMonthLastDay.getDate();

    const cells: {
      dateNumber: number;
      dateKey: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      dayOfWeek: number;
      posts: ScheduledPostItem[];
    }[] = [];

    // 前月のはみ出し日
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevM = viewMonth === 1 ? 12 : viewMonth - 1;
      const prevY = viewMonth === 1 ? viewYear - 1 : viewYear;
      const mStr = prevM < 10 ? `0${prevM}` : `${prevM}`;
      const dStr = d < 10 ? `0${d}` : `${d}`;
      const key = `${prevY}-${mStr}-${dStr}`;
      const dayOfWeek = (startingDayOfWeek - 1 - i) % 7;
      cells.push({
        dateNumber: d,
        dateKey: key,
        isCurrentMonth: false,
        isToday: key === todayKey,
        dayOfWeek,
        posts: postsByDateMap.get(key) || [],
      });
    }

    // 当月の日
    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = viewMonth < 10 ? `0${viewMonth}` : `${viewMonth}`;
      const dStr = d < 10 ? `0${d}` : `${d}`;
      const key = `${viewYear}-${mStr}-${dStr}`;
      const dayOfWeek = (startingDayOfWeek + d - 1) % 7;
      cells.push({
        dateNumber: d,
        dateKey: key,
        isCurrentMonth: true,
        isToday: key === todayKey,
        dayOfWeek,
        posts: postsByDateMap.get(key) || [],
      });
    }

    // 翌月のはみ出し日（グリッドを35または42マスに揃える）
    const totalCells = cells.length <= 35 ? 35 : 42;
    const remaining = totalCells - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextM = viewMonth === 12 ? 1 : viewMonth + 1;
      const nextY = viewMonth === 12 ? viewYear + 1 : viewYear;
      const mStr = nextM < 10 ? `0${nextM}` : `${nextM}`;
      const dStr = d < 10 ? `0${d}` : `${d}`;
      const key = `${nextY}-${mStr}-${dStr}`;
      const dayOfWeek = (cells.length) % 7;
      cells.push({
        dateNumber: d,
        dateKey: key,
        isCurrentMonth: false,
        isToday: key === todayKey,
        dayOfWeek,
        posts: postsByDateMap.get(key) || [],
      });
    }

    return cells;
  }, [viewYear, viewMonth, todayKey, postsByDateMap]);

  // 当月の予約総件数
  const currentMonthPostsCount = useMemo(() => {
    let count = 0;
    const mStr = viewMonth < 10 ? `0${viewMonth}` : `${viewMonth}`;
    const prefix = `${viewYear}-${mStr}-`;
    for (const post of filteredPosts) {
      const key = getJstDateKey(post.scheduledAt);
      if (key.startsWith(prefix)) {
        count++;
      }
    }
    return count;
  }, [viewYear, viewMonth, filteredPosts]);

  // 選択中の日付の予約投稿リスト
  const selectedDatePosts = useMemo(() => {
    return postsByDateMap.get(selectedDateKey) || [];
  }, [selectedDateKey, postsByDateMap]);

  // 選択中の日付の読みやすいフォーマット (例: 2026年9月8日 (火))
  const selectedDateFormatted = useMemo(() => {
    if (!selectedDateKey) return '';
    const [y, m, d] = selectedDateKey.split('-').map((v) => parseInt(v, 10));
    const dt = new Date(y, m - 1, d);
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const isT = selectedDateKey === todayKey;
    return `${y}年${m}月${d}日 (${dayNames[dt.getDay()]})${isT ? ' 【本日】' : ''}`;
  }, [selectedDateKey, todayKey]);

  // アクションハンドラ
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

  const weekDayHeaders = [
    { label: '日', isSun: true, isSat: false },
    { label: '月', isSun: false, isSat: false },
    { label: '火', isSun: false, isSat: false },
    { label: '水', isSun: false, isSat: false },
    { label: '木', isSun: false, isSat: false },
    { label: '金', isSun: false, isSat: false },
    { label: '土', isSun: false, isSat: true },
  ];

  return (
    <div className="flex flex-col h-full min-h-0 space-y-3 animate-in fade-in duration-150">
      {/* カレンダーコントロールバー */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800">
        {/* 月切り替え */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
            title="前月へ"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 px-2">
            <CalendarIcon className="w-4 h-4 text-accent-light" />
            <span className="text-sm font-bold text-slate-100 font-mono">
              {viewYear}年 {viewMonth}月
            </span>
            <span className="badge-accent px-2 py-0.5 rounded-full text-[10px] font-bold">
              {currentMonthPostsCount}件の予定
            </span>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
            title="次月へ"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleGoToday}
            className="ml-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-accent-light border border-slate-700 text-xs font-medium transition cursor-pointer"
            title="現在の日本時間の月に戻る"
          >
            今月へ
          </button>

          {onSwitchToWeekView && (
            <button
              type="button"
              onClick={onSwitchToWeekView}
              className="ml-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition cursor-pointer flex items-center gap-1"
              title="週間カレンダーに切り替え"
            >
              <CalendarDays className="w-3.5 h-3.5 text-accent-light" />
              <span>週間表示</span>
            </button>
          )}
        </div>

        {/* フィルター群 */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
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

      {/* カレンダー本体グリッド */}
      <div className="shrink-0 bg-slate-950/80 rounded-2xl border border-slate-800 p-2.5 shadow-inner">
        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 gap-1 pb-1.5 border-b border-slate-800 text-center font-bold text-xs">
          {weekDayHeaders.map((h, i) => (
            <div
              key={i}
              className={`py-0.5 ${
                h.isSun ? 'text-rose-400' : h.isSat ? 'text-sky-400' : 'text-slate-400'
              }`}
            >
              {h.label}
            </div>
          ))}
        </div>

        {/* 日付セルグリッド */}
        <div className="grid grid-cols-7 gap-1 pt-1.5">
          {calendarCells.map((cell) => {
            const isSelected = cell.dateKey === selectedDateKey;
            const hasPosts = cell.posts.length > 0;

            return (
              <div
                key={cell.dateKey}
                onClick={() => setSelectedDateKey(cell.dateKey)}
                className={`min-h-[52px] sm:min-h-[60px] p-1 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                  isSelected
                    ? 'border-accent ring-2 ring-accent/30 bg-accent-subtle/40 shadow-md'
                    : cell.isCurrentMonth
                    ? 'border-slate-800/80 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700'
                    : 'border-slate-900 bg-slate-950/30 text-slate-600 hover:bg-slate-900/40'
                }`}
              >
                {/* セル上部: 日付とバッジ */}
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-flex items-center justify-center text-xs font-bold font-mono rounded-full w-5 h-5 ${
                      cell.isToday
                        ? 'bg-accent text-white shadow-sm'
                        : cell.dayOfWeek === 0
                        ? cell.isCurrentMonth ? 'text-rose-400' : 'text-rose-900'
                        : cell.dayOfWeek === 6
                        ? cell.isCurrentMonth ? 'text-sky-400' : 'text-sky-900'
                        : cell.isCurrentMonth ? 'text-slate-200' : 'text-slate-600'
                    }`}
                  >
                    {cell.dateNumber}
                  </span>

                  {hasPosts && (
                    <span className="text-[10px] px-1.5 py-0.2 font-bold rounded-full bg-slate-800 text-accent-light border border-accent/40 font-mono">
                      {cell.posts.length}件
                    </span>
                  )}
                </div>

                {/* セル下部: 投稿プレビューバッジ */}
                <div className="space-y-0.5 mt-0.5 overflow-hidden">
                  {cell.posts.slice(0, 2).map((p) => {
                    const timeStr = getJstTimeString(p.scheduledAt);
                    const cat = getPlatformCategory(p.postToBluesky, p.postToThreads);
                    const catConfig = PLATFORM_CATEGORY_CONFIG[cat];
                    return (
                      <div
                        key={p.id}
                        className={`text-[9px] px-1 py-0.5 rounded truncate font-mono flex items-center gap-1 ${
                          p.status === 'pending'
                            ? 'bg-amber-950/80 text-amber-200 border border-amber-800/40'
                            : p.status === 'completed'
                            ? 'bg-emerald-950/80 text-emerald-200 border border-emerald-800/40'
                            : 'bg-rose-950/80 text-rose-200 border border-rose-800/40'
                        }`}
                        title={`${timeStr} [${catConfig.name}] - ${p.text}`}
                      >
                        <span className="shrink-0">{catConfig.icon}</span>
                        <span className="font-bold shrink-0">{timeStr}</span>
                        <span className="truncate opacity-90">{p.text}</span>
                      </div>
                    );
                  })}

                  {cell.posts.length > 2 && (
                    <div className="text-[8px] text-slate-400 text-center font-mono leading-none pt-0.5">
                      他 +{cell.posts.length - 2}件
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 選択された日付の予約詳細パネル (明細行のみ縦スクロール) */}
      <div className="flex-1 min-h-0 bg-slate-950/90 rounded-2xl border border-slate-800 p-3.5 flex flex-col">
        <div className="shrink-0 flex items-center justify-between pb-2 border-b border-slate-800 mb-2.5">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-accent-light" />
            <h3 className="text-sm font-bold text-slate-100">
              {selectedDateFormatted}
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              ({selectedDatePosts.length}件の予約)
            </span>
          </div>
        </div>

        {selectedDatePosts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-6 text-slate-500 text-xs space-y-1">
            <Clock className="w-6 h-6 mx-auto opacity-40 text-slate-400" />
            <p>この日（{selectedDateFormatted}）に設定された予約投稿はありません。</p>
            <p className="text-[11px] text-slate-600">
              エディタで「⏰ 予約投稿」を選択し、この日付を指定して予約できます。
            </p>
          </div>
        ) : (
          <div className="flex-1 min-h-0 space-y-2.5 overflow-y-auto pr-1">
            {selectedDatePosts.map((item) => {
              const rel = getRelativeTimeJst(item.scheduledAt);
              const isEditing = editingItemId === item.id;
              const isExecuting = executingId === item.id || item.status === 'posting';
              const cat = getPlatformCategory(item.postToBluesky, item.postToThreads);
              const catConfig = PLATFORM_CATEGORY_CONFIG[cat];

              return (
                <div
                  key={item.id}
                  className={`bg-slate-900/90 border rounded-xl p-3.5 space-y-2.5 transition-all ${
                    item.status === 'pending'
                      ? rel.isSoon
                        ? 'border-amber-500/50 shadow-md'
                        : 'border-slate-800 hover:border-slate-700'
                      : item.status === 'completed'
                      ? 'border-emerald-800/40 opacity-90'
                      : 'border-rose-800/50'
                  }`}
                >
                  {/* アイテムヘッダー */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-accent-light bg-slate-950 px-2 py-0.5 rounded border border-slate-800 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{getJstTimeString(item.scheduledAt)} JST</span>
                      </span>

                      {item.status === 'pending' && (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1 ${
                            rel.isSoon
                              ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                              : 'badge-accent'
                          }`}
                        >
                          {rel.text}
                        </span>
                      )}

                      {item.status === 'completed' && (
                        <span className="bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>投稿完了</span>
                        </span>
                      )}

                      {item.status === 'failed' && (
                        <span className="bg-rose-950 text-rose-300 border border-rose-800/60 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>失敗</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold flex items-center gap-1 ${catConfig.badgeClass}`}>
                        <span>{catConfig.icon}</span>
                        <span>{catConfig.name}</span>
                      </span>

                      {item.threadsTopic && (
                        <span className="px-1.5 py-0.5 rounded-full bg-purple-950/90 text-purple-300 border border-purple-800/60 text-[9px] font-medium flex items-center gap-0.5">
                          <span className="text-purple-400 font-bold">#</span>
                          <span>{item.threadsTopic}</span>
                        </span>
                      )}
                      {(() => {
                        const counts = getPostMediaCounts(item);
                        return (
                          <>
                            {counts.imageCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 text-[9px] font-medium border border-sky-900/40">
                                📷 画像 {counts.imageCount}枚
                              </span>
                            )}
                            {counts.videoCount > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-purple-950/70 text-purple-300 text-[9px] font-medium border border-purple-800/50">
                                📹 動画 {counts.videoCount}本
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* 本文 */}
                  <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed max-h-24 overflow-y-auto bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60 font-sans">
                    {item.text}
                  </div>

                  {/* 画像・動画プレビュー */}
                  {item.images.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.images.map((img, idx) => {
                        const src = img.thumbnailUrl || img.dataUrl;
                        const isVideo =
                          img.mediaType === 'video' ||
                          Boolean(img.mimeType?.startsWith('video/')) ||
                          Boolean(img.name && /\.(mp4|mov|webm|m4v|mkv|avi)$/i.test(img.name));

                        return (
                          <div
                            key={img.id || idx}
                            className="group relative w-10 h-10 rounded-md border border-slate-700/80 overflow-hidden bg-slate-950 shrink-0 flex items-center justify-center transition-all hover:border-slate-500 hover:scale-105 shadow-xs"
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
                                    <div className="w-4 h-4 rounded-full bg-purple-600/90 text-white flex items-center justify-center shadow-xs">
                                      <Play className="w-2 h-2 fill-white text-white translate-x-0.5" />
                                    </div>
                                    <span className="absolute bottom-0.5 right-0.5 px-0.5 py-0.2 bg-black/80 rounded text-[6px] font-mono text-purple-200 font-bold leading-none">
                                      動画
                                    </span>
                                  </div>
                                )}
                              </>
                            ) : isVideo ? (
                              <div className="w-full h-full bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center text-purple-300 p-0.5">
                                <Film className="w-3.5 h-3.5 text-purple-400 mb-0.5" />
                                <span className="text-[6px] font-bold leading-none">動画</span>
                              </div>
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-slate-900 to-slate-950 flex flex-col items-center justify-center text-sky-400 p-0.5 border border-slate-800">
                                <ImageIcon className="w-3.5 h-3.5 text-sky-400/80 mb-0.5" />
                                <span className="text-[6px] font-mono text-slate-400 leading-none">#{idx + 1}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 日時・区分変更インラインフォーム */}
                  {isEditing && (
                    <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 space-y-2.5 animate-in fade-in duration-150">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200">
                          予約日時および投稿区分の変更:
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingItemId(null)}
                          className="text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
                        >
                          キャンセル
                        </button>
                      </div>

                      {/* 投稿区分切り替え */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-semibold text-slate-400">投稿区分:</span>
                        <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                          <button
                            type="button"
                            onClick={() => {
                              setEditPostToBluesky(true);
                              setEditPostToThreads(true);
                            }}
                            className={`px-1.5 py-1 rounded text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
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
                            className={`px-1.5 py-1 rounded text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
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
                            className={`px-1.5 py-1 rounded text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
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
                            className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus-ring-accent font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => setEditDatetimeLocal(getJstDatetimeLocalValue(Date.now()))}
                            className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer"
                            title="現在日時に変更"
                          >
                            <Clock className="w-3.5 h-3.5 text-accent-light" />
                            <span>現在日時</span>
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(item.id)}
                          className="px-3 py-1 rounded-lg btn-accent text-xs font-bold text-white cursor-pointer"
                        >
                          内容を保存
                        </button>
                      </div>
                    </div>
                  )}

                  {/* アクションボタン */}
                  <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onLoadIntoEditor(item);
                          onCloseModal();
                        }}
                        className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 px-2 py-1 rounded-md border border-slate-800 transition cursor-pointer flex items-center gap-1 font-medium text-[11px]"
                        title="エディタに復元"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>エディタで開く</span>
                      </button>

                      {item.status === 'pending' && !isEditing && (
                        <button
                          type="button"
                          onClick={() => handleStartEdit(item)}
                          className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 px-2 py-1 rounded-md border border-slate-800 transition cursor-pointer flex items-center gap-1 font-medium text-[11px]"
                        >
                          <CalendarIcon className="w-3 h-3" />
                          <span>日時・区分変更</span>
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
                          } px-2.5 py-1 rounded-md transition flex items-center gap-1 cursor-pointer disabled:opacity-50 text-[11px]`}
                        >
                          {isExecuting ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Play className="w-3 h-3" />
                          )}
                          <span>{isDemoMode || credentials.isDemoMode ? '今すぐ実行(デモ)' : '今すぐ投稿'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 px-2 py-1 rounded-md border border-rose-900/40 transition cursor-pointer flex items-center gap-1 text-[11px]"
                        title="削除"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>{item.status === 'pending' ? '予約解除' : '削除'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
