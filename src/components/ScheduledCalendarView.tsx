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
  Plus,
  Hash,
  Send,
  X,
  Sparkles,
} from 'lucide-react';
import { ScheduledPostItem, ApiCredentials, TargetPlatformCategory } from '../types';
import {
  formatToJstString,
  getRelativeTimeJst,
  getJstDatetimeLocalValue,
  parseJstDatetimeLocal,
  updateScheduledPost,
  deleteScheduledPost,
  addScheduledPost,
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

  // 編集モーダル・インライン編集状態
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDatetimeLocal, setEditDatetimeLocal] = useState<string>('');
  const [editText, setEditText] = useState<string>('');
  const [editThreadsTopic, setEditThreadsTopic] = useState<string>('');
  const [editPostToBluesky, setEditPostToBluesky] = useState<boolean>(true);
  const [editPostToThreads, setEditPostToThreads] = useState<boolean>(true);
  const [executingId, setExecutingId] = useState<string | null>(null);

  // 新規予約作成ダイアログ
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);
  const [newPostText, setNewPostText] = useState<string>('');
  const [newPostDatetimeLocal, setNewPostDatetimeLocal] = useState<string>('');
  const [newPostToBluesky, setNewPostToBluesky] = useState<boolean>(true);
  const [newPostToThreads, setNewPostToThreads] = useState<boolean>(true);
  const [newPostThreadsTopic, setNewPostThreadsTopic] = useState<string>('');

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
    const firstDay = new Date(viewYear, viewMonth - 1, 1);
    const startingDayOfWeek = firstDay.getDay(); // 0:日, 1:月, ... 6:土

    const lastDay = new Date(viewYear, viewMonth, 0);
    const daysInMonth = lastDay.getDate();

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
      const dayOfWeek = cells.length % 7;
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

  // 選択中の日付のフォーマット (例: 2026年9月20日 (日))
  const selectedDateFormatted = useMemo(() => {
    if (!selectedDateKey) return '';
    const [y, m, d] = selectedDateKey.split('-').map((v) => parseInt(v, 10));
    const dt = new Date(y, m - 1, d);
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const isT = selectedDateKey === todayKey;
    return `${y}年${m}月${d}日 (${dayNames[dt.getDay()]})${isT ? ' 【本日】' : ''}`;
  }, [selectedDateKey, todayKey]);

  // 編集開始
  const handleStartEdit = (item: ScheduledPostItem) => {
    setEditingItemId(item.id);
    setEditDatetimeLocal(getJstDatetimeLocalValue(item.scheduledAt));
    setEditText(item.text);
    setEditThreadsTopic(item.threadsTopic || '');
    setEditPostToBluesky(item.postToBluesky);
    setEditPostToThreads(item.postToThreads);
  };

  // 編集保存
  const handleSaveEdit = (id: string) => {
    if (!editText.trim()) {
      onNotify({
        type: 'error',
        title: '投稿本文が空です',
        message: '投稿するテキストを入力してください。',
      });
      return;
    }

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
      text: editText.trim(),
      threadsTopic: editThreadsTopic.trim() || undefined,
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

  // 新規予約の作成開始（特定の日付または選択日付）
  const handleOpenNewPost = (dateKey?: string) => {
    const targetDate = dateKey || selectedDateKey || todayKey;
    // デフォルトでその日の午前10:00（または現在から1時間後）
    const now = Date.now();
    const defaultTime = `${targetDate}T10:00`;
    const parsed = parseJstDatetimeLocal(defaultTime);
    if (parsed > now) {
      setNewPostDatetimeLocal(defaultTime);
    } else {
      setNewPostDatetimeLocal(getJstDatetimeLocalValue(now + 60 * 60 * 1000));
    }
    setNewPostText('');
    setNewPostThreadsTopic('');
    setNewPostToBluesky(true);
    setNewPostToThreads(true);
    setIsCreatingNew(true);
  };

  // 新規予約保存
  const handleSaveNewPost = () => {
    if (!newPostText.trim()) {
      onNotify({
        type: 'error',
        title: '投稿本文が空です',
        message: '予約するテキストを入力してください。',
      });
      return;
    }

    const timestamp = parseJstDatetimeLocal(newPostDatetimeLocal);
    if (timestamp <= Date.now()) {
      onNotify({
        type: 'error',
        title: '無効な日時',
        message: '予約日時は現在時刻（日本時間）より未来の日時を指定してください。',
      });
      return;
    }

    if (!newPostToBluesky && !newPostToThreads) {
      onNotify({
        type: 'error',
        title: '投稿先が未選択',
        message: 'Bluesky または Threads のいずれかを選択してください。',
      });
      return;
    }

    addScheduledPost({
      text: newPostText.trim(),
      scheduledAt: timestamp,
      postToBluesky: newPostToBluesky,
      postToThreads: newPostToThreads,
      threadsTopic: newPostThreadsTopic.trim() || undefined,
      images: [],
      autoSplit: false,
      includeNumbering: false,
    });

    setIsCreatingNew(false);
    onRefreshScheduledPosts();
    onNotify({
      type: 'success',
      title: '予約投稿を作成しました',
      message: `日本時間 ${formatToJstString(timestamp)} に配信予約しました。`,
    });
  };

  // 予約削除
  const handleDelete = (id: string) => {
    deleteScheduledPost(id);
    onRefreshScheduledPosts();
    onNotify({
      type: 'info',
      title: '予約をキャンセルしました',
      message: '予約投稿を削除しました。',
    });
  };

  // 即時投稿
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

  // クイック日時オフセット付与
  const addHoursToEdit = (hours: number) => {
    const current = parseJstDatetimeLocal(editDatetimeLocal) || Date.now();
    const next = current + hours * 60 * 60 * 1000;
    setEditDatetimeLocal(getJstDatetimeLocalValue(next));
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
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2.5 bg-slate-950/70 p-2.5 rounded-2xl border border-slate-800 shadow-sm">
        {/* 月切り替え */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
            title="前月へ"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 px-1.5 sm:px-2">
            <CalendarIcon className="w-4 h-4 text-accent-light" />
            <span className="text-sm font-bold text-slate-100 font-mono">
              {viewYear}年 {viewMonth}月
            </span>
            <span className="badge-accent px-2 py-0.5 rounded-full text-[10px] font-bold font-mono">
              {currentMonthPostsCount}件
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
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-accent-light border border-slate-700 text-xs font-medium transition cursor-pointer"
            title="現在の日本時間の月に戻る"
          >
            今月へ
          </button>

          {onSwitchToWeekView && (
            <button
              type="button"
              onClick={onSwitchToWeekView}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition cursor-pointer flex items-center gap-1"
              title="週間タイムラインカレンダーに切り替え"
            >
              <CalendarDays className="w-3.5 h-3.5 text-accent-light" />
              <span className="hidden sm:inline">週間表示</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleOpenNewPost(selectedDateKey)}
            className="px-2.5 py-1 rounded-lg btn-accent text-white text-xs font-bold transition cursor-pointer flex items-center gap-1 shadow-sm"
            title="選択した日付で新規予約を作成"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>新規予約</span>
          </button>
        </div>

        {/* フィルター群 */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* 区分フィルター */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-medium px-1 hidden sm:inline">区分:</span>
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
              <span className="hidden sm:inline">同時</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory('bluesky')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                filterCategory === 'bluesky' ? 'bg-[#0085ff]/30 text-[#0085ff] border border-[#0085ff]/60 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🦋</span>
              <span className="hidden sm:inline">BS</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterCategory('threads')}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                filterCategory === 'threads' ? 'bg-purple-950 text-purple-300 border border-purple-700/60 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>🌀</span>
              <span className="hidden sm:inline">TH</span>
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
      <div className="shrink-0 bg-slate-950/80 rounded-2xl border border-slate-800 p-2 sm:p-3 shadow-inner">
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
                className={`min-h-[58px] sm:min-h-[66px] p-1 sm:p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                  isSelected
                    ? 'border-accent ring-2 ring-accent/30 bg-accent-subtle/40 shadow-md'
                    : cell.isCurrentMonth
                    ? 'border-slate-800/80 bg-slate-900/60 hover:bg-slate-900 hover:border-slate-700'
                    : 'border-slate-900/60 bg-slate-950/30 text-slate-600 hover:bg-slate-900/40'
                }`}
              >
                {/* セル上部: 日付とバッジ & 追加ボタン */}
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

                  <div className="flex items-center gap-1">
                    {hasPosts && (
                      <span className="text-[10px] px-1.5 py-0.2 font-bold rounded-full bg-slate-800 text-accent-light border border-accent/40 font-mono">
                        {cell.posts.length}
                      </span>
                    )}
                  </div>
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
                        <span className="shrink-0 text-[10px]">{catConfig.icon}</span>
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

      {/* 新規予約作成オーバーレイモーダル */}
      {isCreatingNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-accent-subtle text-accent-light border border-accent flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-100">新規予約投稿を作成</h3>
                  <p className="text-[11px] text-slate-400">日本時間（JST）を指定して投稿を予約します</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* 投稿先プラットフォーム */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-300">投稿先プラットフォーム:</span>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setNewPostToBluesky(true);
                      setNewPostToThreads(true);
                    }}
                    className={`px-2 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      newPostToBluesky && newPostToThreads
                        ? 'btn-accent text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <span>🚀</span>
                    <span>同時投稿</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewPostToBluesky(true);
                      setNewPostToThreads(false);
                    }}
                    className={`px-2 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      newPostToBluesky && !newPostToThreads
                        ? 'bg-[#0085ff] text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <span>🦋</span>
                    <span>Bluesky</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewPostToBluesky(false);
                      setNewPostToThreads(true);
                    }}
                    className={`px-2 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      !newPostToBluesky && newPostToThreads
                        ? 'bg-purple-700 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                  >
                    <span>🌀</span>
                    <span>Threads</span>
                  </button>
                </div>
              </div>

              {/* 予約日時 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">予約日時 (JST):</span>
                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      type="button"
                      onClick={() => setNewPostDatetimeLocal(getJstDatetimeLocalValue(Date.now()))}
                      className="text-accent-light hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                      title="現在の日本時間（JST）を設定"
                    >
                      <Clock className="w-2.5 h-2.5" />
                      <span>現在の時間</span>
                    </button>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
                  <input
                    type="datetime-local"
                    value={newPostDatetimeLocal}
                    onChange={(e) => setNewPostDatetimeLocal(e.target.value)}
                    className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus-ring-accent font-mono"
                  />
                  <div className="flex items-center gap-1 flex-wrap sm:flex-nowrap">
                    <button
                      type="button"
                      onClick={() => {
                        const cur = parseJstDatetimeLocal(newPostDatetimeLocal) || Date.now();
                        setNewPostDatetimeLocal(getJstDatetimeLocalValue(cur + 5 * 60 * 1000));
                      }}
                      className="flex-1 sm:flex-initial px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-bold transition shrink-0 cursor-pointer text-center"
                      title="5分加算"
                    >
                      +5m
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = parseJstDatetimeLocal(newPostDatetimeLocal) || Date.now();
                        setNewPostDatetimeLocal(getJstDatetimeLocalValue(cur + 10 * 60 * 1000));
                      }}
                      className="flex-1 sm:flex-initial px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-bold transition shrink-0 cursor-pointer text-center"
                      title="10分加算"
                    >
                      +10m
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = parseJstDatetimeLocal(newPostDatetimeLocal) || Date.now();
                        setNewPostDatetimeLocal(getJstDatetimeLocalValue(cur + 15 * 60 * 1000));
                      }}
                      className="flex-1 sm:flex-initial px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-bold transition shrink-0 cursor-pointer text-center"
                      title="15分加算"
                    >
                      +15m
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = parseJstDatetimeLocal(newPostDatetimeLocal) || Date.now();
                        setNewPostDatetimeLocal(getJstDatetimeLocalValue(cur + 30 * 60 * 1000));
                      }}
                      className="flex-1 sm:flex-initial px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-bold transition shrink-0 cursor-pointer text-center"
                      title="30分加算"
                    >
                      +30m
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = parseJstDatetimeLocal(newPostDatetimeLocal) || Date.now();
                        setNewPostDatetimeLocal(getJstDatetimeLocalValue(cur + 60 * 60 * 1000));
                      }}
                      className="flex-1 sm:flex-initial px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-bold transition shrink-0 cursor-pointer text-center"
                      title="1時間加算"
                    >
                      +1h
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const cur = parseJstDatetimeLocal(newPostDatetimeLocal) || Date.now();
                        setNewPostDatetimeLocal(getJstDatetimeLocalValue(cur + 24 * 60 * 60 * 1000));
                      }}
                      className="flex-1 sm:flex-initial px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-bold transition shrink-0 cursor-pointer text-center"
                      title="1日加算"
                    >
                      +1日
                    </button>
                  </div>
                </div>
              </div>

              {/* 本文入力 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">投稿本文:</span>
                  <span className="text-[10px] text-slate-400 font-mono">{newPostText.length} 文字</span>
                </div>
                <textarea
                  rows={4}
                  value={newPostText}
                  onChange={(e) => setNewPostText(e.target.value)}
                  placeholder="予約投稿する本文を入力してください..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 focus-ring-accent font-sans leading-relaxed resize-none"
                />
              </div>

              {/* Threads トピック (Threadsが有効な場合) */}
              {newPostToThreads && (
                <div className="flex items-center gap-2 bg-slate-950/80 p-2.5 rounded-xl border border-purple-900/40">
                  <Hash className="w-4 h-4 text-purple-400 shrink-0" />
                  <input
                    type="text"
                    value={newPostThreadsTopic}
                    onChange={(e) => setNewPostThreadsTopic(e.target.value)}
                    placeholder="Threads トピックタグ（任意、例: 写真部、開発日記）"
                    className="flex-1 bg-transparent border-none text-xs text-purple-200 placeholder:text-purple-400/40 focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsCreatingNew(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer transition"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSaveNewPost}
                className="px-5 py-2 rounded-xl btn-accent text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>予約を登録する</span>
              </button>
            </div>
          </div>
        </div>
      )}

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

          <button
            type="button"
            onClick={() => handleOpenNewPost(selectedDateKey)}
            className="text-xs font-semibold text-accent-light hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>この日に予約を作成</span>
          </button>
        </div>

        {selectedDatePosts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-6 text-slate-500 text-xs space-y-2">
            <Clock className="w-7 h-7 mx-auto opacity-40 text-slate-400" />
            <p className="font-medium text-slate-400">この日（{selectedDateFormatted}）に設定された予約投稿はありません。</p>
            <button
              type="button"
              onClick={() => handleOpenNewPost(selectedDateKey)}
              className="mt-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-accent-light border border-accent/30 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>この日に予約を追加する</span>
            </button>
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

                  {/* 本文（非編集時） */}
                  {!isEditing && (
                    <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed max-h-28 overflow-y-auto bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60 font-sans">
                      {item.text}
                    </div>
                  )}

                  {/* 画像・動画プレビュー */}
                  {item.images.length > 0 && !isEditing && (
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

                  {/* 本文・日時・区分 総合インライン編集フォーム */}
                  {isEditing && (
                    <div className="bg-slate-950 rounded-xl p-3.5 border border-accent/60 space-y-3 animate-in fade-in duration-150 shadow-lg">
                      <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
                        <span className="text-xs font-bold text-accent-light flex items-center gap-1.5">
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>予約投稿内容の編集</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingItemId(null)}
                          className="text-slate-400 hover:text-slate-200 text-xs cursor-pointer font-medium"
                        >
                          キャンセル
                        </button>
                      </div>

                      {/* 投稿区分切り替え */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-slate-300">投稿先プラットフォーム:</span>
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

                      {/* 本文編集 */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-slate-300">投稿本文:</span>
                          <span className="text-[10px] text-slate-400 font-mono">{editText.length} 文字</span>
                        </div>
                        <textarea
                          rows={3}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 focus-ring-accent font-sans leading-relaxed"
                        />
                      </div>

                      {/* Threadsトピック (Threadsが有効な場合) */}
                      {editPostToThreads && (
                        <div className="flex items-center gap-2 bg-slate-900/80 p-2 rounded-lg border border-purple-900/40">
                          <Hash className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          <input
                            type="text"
                            value={editThreadsTopic}
                            onChange={(e) => setEditThreadsTopic(e.target.value)}
                            placeholder="Threads トピックタグ（任意）"
                            className="flex-1 bg-transparent border-none text-xs text-purple-200 placeholder:text-purple-400/40 focus:outline-none"
                          />
                        </div>
                      )}

                      {/* 日時編集 & クイックボタン */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between flex-wrap gap-1">
                          <span className="text-[11px] font-semibold text-slate-300">予約日時 (JST):</span>
                          <button
                            type="button"
                            onClick={() => setEditDatetimeLocal(getJstDatetimeLocalValue(Date.now()))}
                            className="text-accent-light hover:underline font-bold flex items-center gap-0.5 text-[10px] cursor-pointer"
                            title="現在の日本時間（JST）を設定"
                          >
                            <Clock className="w-2.5 h-2.5" />
                            <span>現在の時間</span>
                          </button>
                        </div>
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5">
                          <input
                            type="datetime-local"
                            value={editDatetimeLocal}
                            onChange={(e) => setEditDatetimeLocal(e.target.value)}
                            className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus-ring-accent font-mono"
                          />
                          <div className="flex items-center gap-1 flex-wrap sm:flex-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                const cur = parseJstDatetimeLocal(editDatetimeLocal) || Date.now();
                                setEditDatetimeLocal(getJstDatetimeLocalValue(cur + 5 * 60 * 1000));
                              }}
                              className="flex-1 sm:flex-initial px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] font-bold transition text-center cursor-pointer"
                              title="5分加算"
                            >
                              +5m
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const cur = parseJstDatetimeLocal(editDatetimeLocal) || Date.now();
                                setEditDatetimeLocal(getJstDatetimeLocalValue(cur + 10 * 60 * 1000));
                              }}
                              className="flex-1 sm:flex-initial px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] font-bold transition text-center cursor-pointer"
                              title="10分加算"
                            >
                              +10m
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const cur = parseJstDatetimeLocal(editDatetimeLocal) || Date.now();
                                setEditDatetimeLocal(getJstDatetimeLocalValue(cur + 15 * 60 * 1000));
                              }}
                              className="flex-1 sm:flex-initial px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] font-bold transition text-center cursor-pointer"
                              title="15分加算"
                            >
                              +15m
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const cur = parseJstDatetimeLocal(editDatetimeLocal) || Date.now();
                                setEditDatetimeLocal(getJstDatetimeLocalValue(cur + 30 * 60 * 1000));
                              }}
                              className="flex-1 sm:flex-initial px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] font-bold transition text-center cursor-pointer"
                              title="30分加算"
                            >
                              +30m
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const cur = parseJstDatetimeLocal(editDatetimeLocal) || Date.now();
                                setEditDatetimeLocal(getJstDatetimeLocalValue(cur + 60 * 60 * 1000));
                              }}
                              className="flex-1 sm:flex-initial px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] font-bold transition text-center cursor-pointer"
                              title="1時間加算"
                            >
                              +1h
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const cur = parseJstDatetimeLocal(editDatetimeLocal) || Date.now();
                                setEditDatetimeLocal(getJstDatetimeLocalValue(cur + 24 * 60 * 60 * 1000));
                              }}
                              className="flex-1 sm:flex-initial px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] font-bold transition text-center cursor-pointer"
                              title="1日加算"
                            >
                              +1日
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-1 border-t border-slate-800">
                        <button
                          type="button"
                          onClick={() => setEditingItemId(null)}
                          className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
                        >
                          キャンセル
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(item.id)}
                          className="px-3.5 py-1 rounded-lg btn-accent text-xs font-bold text-white cursor-pointer shadow-sm"
                        >
                          変更を保存
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
                        title="エディタに復元して編集"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>エディタで開く</span>
                      </button>

                      {item.status === 'pending' && !isEditing && (
                        <button
                          type="button"
                          onClick={() => handleStartEdit(item)}
                          className="text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-md border border-slate-700 transition cursor-pointer flex items-center gap-1 font-semibold text-[11px]"
                        >
                          <CalendarIcon className="w-3 h-3 text-accent-light" />
                          <span>予約を編集</span>
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
                          } px-2.5 py-1 rounded-md transition flex items-center gap-1 cursor-pointer disabled:opacity-50 text-[11px]` }
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
