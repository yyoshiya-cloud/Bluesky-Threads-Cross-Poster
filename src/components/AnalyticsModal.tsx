import React, { useState, useMemo } from 'react';
import {
  PostHistoryItem,
  ScheduledPostItem,
  ApiCredentials,
  SnippetItem,
} from '../types';
import {
  X as CloseIcon,
  BarChart3,
  Download,
  Upload,
  RefreshCw,
  Heart,
  Repeat,
  MessageCircle,
  TrendingUp,
  FileSpreadsheet,
  FileJson,
  CheckCircle2,
  AlertCircle,
  Clock,
  Search,
  ArrowUpDown,
  ExternalLink,
  Trash2,
  Database,
  Flame,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { formatHistoryTimestampJst } from '../utils/scheduledStorage';
import {
  exportHistoryToCsv,
  exportScheduledToCsv,
  exportFullBackupJson,
  parseAndValidateBackupJson,
} from '../utils/exportImportHelper';
import {
  calculateEngagementComparison,
  syncAllHistoryEngagements,
  fetchPostEngagement,
} from '../utils/engagementApi';

interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: PostHistoryItem[];
  scheduledPosts: ScheduledPostItem[];
  credentials: ApiCredentials;
  onUpdateHistory: (newHistory: PostHistoryItem[]) => void;
  onImportBackup?: (history: PostHistoryItem[], scheduled: ScheduledPostItem[], snippets?: SnippetItem[]) => void;
  onClearHistory?: () => void;
  onReuseText?: (text: string) => void;
  onNotify?: (toast: { type: 'success' | 'error' | 'info' | 'warning'; title: string; message: string }) => void;
  initialTab?: 'analytics' | 'export' | 'history';
}

type TabType = 'analytics' | 'export' | 'history';
type SortKey = 'total_reactions' | 'likes' | 'reposts' | 'diff' | 'newest';

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({
  isOpen,
  onClose,
  history,
  scheduledPosts,
  credentials,
  onUpdateHistory,
  onImportBackup,
  onClearHistory,
  onReuseText,
  onNotify,
  initialTab = 'analytics',
}) => {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('total_reactions');
  const [filterPlatform, setFilterPlatform] = useState<'all' | 'both' | 'bluesky' | 'threads'>('all');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  // インポート復元用ステート
  const [importJsonText, setImportJsonText] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [importPreview, setImportPreview] = useState<{
    success: boolean;
    historyCount: number;
    scheduledCount: number;
    error?: string;
  } | null>(null);

  // -------------------------------------------------------------
  // 総合エンゲージメント集計
  // -------------------------------------------------------------
  const summary = useMemo(() => {
    let totalBlueskyLikes = 0;
    let totalBlueskyReposts = 0;
    let totalBlueskyReplies = 0;

    let totalThreadsLikes = 0;
    let totalThreadsReposts = 0;
    let totalThreadsReplies = 0;

    let blueskyWins = 0;
    let threadsWins = 0;
    let ties = 0;

    let comparedCount = 0;

    history.forEach((item) => {
      const bLikes = item.blueskyEngagement?.likes || 0;
      const bReposts = item.blueskyEngagement?.reposts || 0;
      const bReplies = item.blueskyEngagement?.replies || 0;

      const tLikes = item.threadsEngagement?.likes || 0;
      const tReposts = item.threadsEngagement?.reposts || 0;
      const tReplies = item.threadsEngagement?.replies || 0;

      totalBlueskyLikes += bLikes;
      totalBlueskyReposts += bReposts;
      totalBlueskyReplies += bReplies;

      totalThreadsLikes += tLikes;
      totalThreadsReposts += tReposts;
      totalThreadsReplies += tReplies;

      const comparison = calculateEngagementComparison(
        item.blueskyEngagement,
        item.threadsEngagement,
        item.platforms
      );

      if (comparison.winner === 'Bluesky') blueskyWins++;
      else if (comparison.winner === 'Threads') threadsWins++;
      else if (comparison.winner === 'Tie') ties++;

      if (item.platforms.includes('Bluesky') && item.platforms.includes('Threads')) {
        comparedCount++;
      }
    });

    const totalBlueskyReactions = totalBlueskyLikes + totalBlueskyReposts + totalBlueskyReplies;
    const totalThreadsReactions = totalThreadsLikes + totalThreadsReposts + totalThreadsReplies;
    const grandTotal = totalBlueskyReactions + totalThreadsReactions;

    const blueskyShare = grandTotal > 0 ? Math.round((totalBlueskyReactions / grandTotal) * 100) : 50;
    const threadsShare = grandTotal > 0 ? 100 - blueskyShare : 50;

    return {
      totalPosts: history.length,
      comparedCount,
      totalBlueskyLikes,
      totalBlueskyReposts,
      totalBlueskyReplies,
      totalBlueskyReactions,
      totalThreadsLikes,
      totalThreadsReposts,
      totalThreadsReplies,
      totalThreadsReactions,
      grandTotal,
      blueskyWins,
      threadsWins,
      ties,
      blueskyShare,
      threadsShare,
    };
  }, [history]);

  // -------------------------------------------------------------
  // フィルタ・ソートされた履歴一覧
  // -------------------------------------------------------------
  const filteredAndSortedHistory = useMemo(() => {
    let result = [...history];

    // 検索フィルタ
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.originalText.toLowerCase().includes(q) ||
          item.threadsTopic?.toLowerCase().includes(q) ||
          item.id.toLowerCase().includes(q)
      );
    }

    // プラットフォームフィルタ
    if (filterPlatform === 'both') {
      result = result.filter((item) => item.platforms.includes('Bluesky') && item.platforms.includes('Threads'));
    } else if (filterPlatform === 'bluesky') {
      result = result.filter((item) => item.platforms.includes('Bluesky') && !item.platforms.includes('Threads'));
    } else if (filterPlatform === 'threads') {
      result = result.filter((item) => item.platforms.includes('Threads') && !item.platforms.includes('Bluesky'));
    }

    // ソート
    result.sort((a, b) => {
      const aBLikes = a.blueskyEngagement?.likes || 0;
      const aBReposts = a.blueskyEngagement?.reposts || 0;
      const aTLikes = a.threadsEngagement?.likes || 0;
      const aTReposts = a.threadsEngagement?.reposts || 0;

      const bBLikes = b.blueskyEngagement?.likes || 0;
      const bBReposts = b.blueskyEngagement?.reposts || 0;
      const bTLikes = b.threadsEngagement?.likes || 0;
      const bTReposts = b.threadsEngagement?.reposts || 0;

      const aTotal = aBLikes + aBReposts * 2 + aTLikes + aTReposts * 2;
      const bTotal = bBLikes + bBReposts * 2 + bTLikes + bTReposts * 2;

      if (sortKey === 'total_reactions') {
        return bTotal - aTotal;
      }
      if (sortKey === 'likes') {
        return (bBLikes + bTLikes) - (aBLikes + aTLikes);
      }
      if (sortKey === 'reposts') {
        return (bBReposts + bTReposts) - (aBReposts + aTReposts);
      }
      if (sortKey === 'diff') {
        const aDiff = Math.abs((aBLikes + aBReposts) - (aTLikes + aTReposts));
        const bDiff = Math.abs((bBLikes + bBReposts) - (bTLikes + bTReposts));
        return bDiff - aDiff;
      }
      // 'newest'
      return 0; // デフォルト配列順 (降順)
    });

    return result;
  }, [history, searchQuery, filterPlatform, sortKey]);

  if (!isOpen) return null;

  // -------------------------------------------------------------
  // 一括エンゲージメント更新処理
  // -------------------------------------------------------------
  const handleSyncAll = async () => {
    if (history.length === 0 || isSyncing) return;
    setIsSyncing(true);
    setSyncProgress({ current: 0, total: history.length });

    try {
      const updated = await syncAllHistoryEngagements(history, credentials, (curr, tot) => {
        setSyncProgress({ current: curr, total: tot });
      });
      onUpdateHistory(updated);
      onNotify?.({
        type: 'success',
        title: '📊 エンゲージメントを更新しました',
        message: `${history.length}件の投稿リアクションデータを最新状態に同期しました。`,
      });
    } catch {
      onNotify?.({
        type: 'error',
        title: '同期失敗',
        message: 'リアクションデータの取得中にエラーが発生しました。',
      });
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  // -------------------------------------------------------------
  // 個別エンゲージメント更新処理
  // -------------------------------------------------------------
  const handleSyncSingle = async (item: PostHistoryItem) => {
    setUpdatingItemId(item.id);
    try {
      const stats = await fetchPostEngagement(item, credentials);
      const updated = history.map((h) =>
        h.id === item.id
          ? {
              ...h,
              blueskyEngagement: stats.bluesky || h.blueskyEngagement,
              threadsEngagement: stats.threads || h.threadsEngagement,
              engagementUpdatedAt: stats.updatedAt,
            }
          : h
      );
      onUpdateHistory(updated);
      onNotify?.({
        type: 'success',
        title: 'リアクション更新完了',
        message: '対象ポストのいいね・リポスト数を最新化しました。',
      });
    } catch {
      onNotify?.({
        type: 'error',
        title: '更新エラー',
        message: 'リアクションの取得に失敗しました。',
      });
    } finally {
      setUpdatingItemId(null);
    }
  };

  // -------------------------------------------------------------
  // ファイルインポート処理
  // -------------------------------------------------------------
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportJsonText(content);
      const res = parseAndValidateBackupJson(content);
      if (res.success) {
        setImportPreview({
          success: true,
          historyCount: res.history.length,
          scheduledCount: res.scheduledPosts.length,
        });
      } else {
        setImportPreview({
          success: false,
          historyCount: 0,
          scheduledCount: 0,
          error: res.error,
        });
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = () => {
    if (!importJsonText) return;
    const res = parseAndValidateBackupJson(importJsonText);
    if (!res.success) {
      onNotify?.({
        type: 'error',
        title: 'インポート失敗',
        message: res.error || '無効なJSONファイルです。',
      });
      return;
    }

    if (onImportBackup) {
      if (importMode === 'replace') {
        onImportBackup(res.history, res.scheduledPosts, res.snippets);
      } else {
        // マージモード（ID重複を上書き、新規を追加）
        const historyMap = new Map(history.map((h) => [h.id, h]));
        res.history.forEach((h) => historyMap.set(h.id, h));
        const mergedHistory = Array.from(historyMap.values());

        const scheduledMap = new Map(scheduledPosts.map((s) => [s.id, s]));
        res.scheduledPosts.forEach((s) => scheduledMap.set(s.id, s));
        const mergedScheduled = Array.from(scheduledMap.values());

        onImportBackup(mergedHistory, mergedScheduled, res.snippets);
      }

      onNotify?.({
        type: 'success',
        title: '🎉 バックアップを復元しました',
        message: `履歴 ${res.history.length}件、予約投稿 ${res.scheduledPosts.length}件を読み込みました。`,
      });
      setImportJsonText('');
      setImportPreview(null);
      setActiveTab('analytics');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-3 sm:p-5">
      <div
        id="analytics-modal"
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 text-sky-400 border border-sky-500/30 shadow-inner">
              <BarChart3 className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-100">分析・データ活用スタジオ</h2>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30">
                  Analytics & Backup
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Bluesky & Threads のリアクション比較・エンゲージメント分析・データ書き出し
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="閉じる"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* タブナビゲーション */}
        <div className="flex items-center justify-between px-5 pt-2 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition flex items-center gap-2 border-b-2 cursor-pointer ${
                activeTab === 'analytics'
                  ? 'text-sky-400 border-sky-500 bg-slate-900'
                  : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>リアクション分析 & 比較</span>
              {history.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-950 text-sky-400 border border-sky-800/60 font-mono">
                  {history.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('export')}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition flex items-center gap-2 border-b-2 cursor-pointer ${
                activeTab === 'export'
                  ? 'text-sky-400 border-sky-500 bg-slate-900'
                  : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>CSV / JSON エクスポート & 復元</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition flex items-center gap-2 border-b-2 cursor-pointer ${
                activeTab === 'history'
                  ? 'text-sky-400 border-sky-500 bg-slate-900'
                  : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-900/50'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>投稿ログ一覧</span>
            </button>
          </div>

          {/* 右側アクション（一括更新ボタンなど） */}
          {activeTab === 'analytics' && history.length > 0 && (
            <button
              type="button"
              onClick={handleSyncAll}
              disabled={isSyncing}
              className="mb-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-sky-600/20 cursor-pointer disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? `更新中 (${syncProgress?.current}/${syncProgress?.total})...` : '最新リアクションを一括同期'}</span>
            </button>
          )}
        </div>

        {/* タブコンテンツ */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* ========================================================= */}
          {/* タブ 1: エンゲージメント分析 & リアクション比較 */}
          {/* ========================================================= */}
          {activeTab === 'analytics' && (
            <div className="space-y-5">
              {history.length === 0 ? (
                <div className="text-center py-16 bg-slate-950/40 border border-dashed border-slate-800 rounded-2xl p-8 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-sky-950/60 border border-sky-800/40 text-sky-400 flex items-center justify-center mx-auto">
                    <BarChart3 className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-200">まだ分析対象の投稿データがありません</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                    BlueskyやThreadsへ同時に投稿すると、自動的に各ポストのいいね数・リポスト数が記録され、どちらのSNSで好評だったかの比較グラフやインサイトが表示されます。
                  </p>
                </div>
              ) : (
                <>
                  {/* 1. 総合KPI サマリーカード */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Bluesky 合計リアクション */}
                    <div className="bg-gradient-to-br from-slate-950 to-[#0085ff]/10 border border-[#0085ff]/30 rounded-xl p-4 space-y-2 relative overflow-hidden shadow-sm">
                      <div className="flex items-center justify-between text-xs font-bold text-[#0085ff]">
                        <span className="flex items-center gap-1.5">
                          <span className="text-sm">🦋</span>
                          Bluesky リアクション
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#0085ff]/20 font-mono">
                          反響シェア {summary.blueskyShare}%
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-100 font-mono">
                          {summary.totalBlueskyReactions.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-slate-400">総リアクション</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-800/80 text-[11px]">
                        <div className="flex items-center gap-1 text-slate-300">
                          <Heart className="w-3 h-3 text-rose-400" />
                          <span className="font-mono font-bold">{summary.totalBlueskyLikes}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-300">
                          <Repeat className="w-3 h-3 text-emerald-400" />
                          <span className="font-mono font-bold">{summary.totalBlueskyReposts}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-300">
                          <MessageCircle className="w-3 h-3 text-sky-400" />
                          <span className="font-mono font-bold">{summary.totalBlueskyReplies}</span>
                        </div>
                      </div>
                    </div>

                    {/* Threads 合計リアクション */}
                    <div className="bg-gradient-to-br from-slate-950 to-purple-600/10 border border-purple-800/40 rounded-xl p-4 space-y-2 relative overflow-hidden shadow-sm">
                      <div className="flex items-center justify-between text-xs font-bold text-purple-300">
                        <span className="flex items-center gap-1.5">
                          <span className="text-sm">🌀</span>
                          Threads リアクション
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950/80 font-mono text-purple-300 border border-purple-800/60">
                          反響シェア {summary.threadsShare}%
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-slate-100 font-mono">
                          {summary.totalThreadsReactions.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-slate-400">総リアクション</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-800/80 text-[11px]">
                        <div className="flex items-center gap-1 text-slate-300">
                          <Heart className="w-3 h-3 text-pink-400" />
                          <span className="font-mono font-bold">{summary.totalThreadsLikes}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-300">
                          <Repeat className="w-3 h-3 text-emerald-400" />
                          <span className="font-mono font-bold">{summary.totalThreadsReposts}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-300">
                          <MessageCircle className="w-3 h-3 text-purple-400" />
                          <span className="font-mono font-bold">{summary.totalThreadsReplies}</span>
                        </div>
                      </div>
                    </div>

                    {/* プラットフォーム勝敗インサイト */}
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5 flex flex-col justify-between shadow-sm">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                        <span className="flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4 text-amber-400" />
                          反響比較サマリー
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">同時投稿 {summary.comparedCount}件</span>
                      </div>

                      {/* 比較バー */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-mono font-bold">
                          <span className="text-[#0085ff]">🦋 {summary.blueskyWins}勝</span>
                          <span className="text-slate-500">{summary.ties}分</span>
                          <span className="text-purple-400">🌀 {summary.threadsWins}勝</span>
                        </div>
                        <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden flex border border-slate-800">
                          <div
                            className="bg-[#0085ff] h-full transition-all duration-500"
                            style={{ width: `${summary.blueskyShare}%` }}
                            title={`Bluesky: ${summary.blueskyShare}%`}
                          />
                          <div
                            className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-500"
                            style={{ width: `${summary.threadsShare}%` }}
                            title={`Threads: ${summary.threadsShare}%`}
                          />
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-400 leading-tight">
                        {summary.blueskyWins > summary.threadsWins ? (
                          <span className="text-sky-300 font-medium">
                            💡 このアカウントは現在 <strong className="text-[#0085ff]">Bluesky</strong> で反響が伸びやすい傾向にあります。
                          </span>
                        ) : summary.threadsWins > summary.blueskyWins ? (
                          <span className="text-purple-300 font-medium">
                            💡 このアカウントは現在 <strong className="text-purple-400">Threads</strong> で反響が伸びやすい傾向にあります。
                          </span>
                        ) : (
                          <span className="text-slate-300 font-medium">
                            💡 両プラットフォームでバランス良くリアクションを獲得しています。
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* 2. 検索・ソート・フィルタバー */}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-950/80 border border-slate-800 rounded-xl">
                    <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="本文・トピックを検索..."
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500"
                        />
                      </div>
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="text-[10px] text-slate-400 hover:text-white px-1.5 py-1 rounded bg-slate-800"
                        >
                          クリア
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* ソートセレクタ */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <ArrowUpDown className="w-3.5 h-3.5" />
                        <select
                          value={sortKey}
                          onChange={(e) => setSortKey(e.target.value as SortKey)}
                          className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                        >
                          <option value="total_reactions">🔥 総リアクションが多い順</option>
                          <option value="likes">❤️ いいねが多い順</option>
                          <option value="reposts">🔁 リポスト・再シェア順</option>
                          <option value="diff">⚖️ 反響差が大きい順</option>
                          <option value="newest">🕒 投稿日時が新しい順</option>
                        </select>
                      </div>

                      {/* プラットフォーム絞り込み */}
                      <div className="flex items-center rounded-lg bg-slate-900 p-0.5 border border-slate-800 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setFilterPlatform('all')}
                          className={`px-2 py-1 rounded cursor-pointer ${
                            filterPlatform === 'all' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          すべて
                        </button>
                        <button
                          type="button"
                          onClick={() => setFilterPlatform('both')}
                          className={`px-2 py-1 rounded cursor-pointer ${
                            filterPlatform === 'both' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          両方投稿のみ
                        </button>
                        <button
                          type="button"
                          onClick={() => setFilterPlatform('bluesky')}
                          className={`px-2 py-1 rounded cursor-pointer ${
                            filterPlatform === 'bluesky' ? 'bg-[#0085ff]/30 text-[#0085ff] font-bold' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          🦋のみ
                        </button>
                        <button
                          type="button"
                          onClick={() => setFilterPlatform('threads')}
                          className={`px-2 py-1 rounded cursor-pointer ${
                            filterPlatform === 'threads' ? 'bg-purple-950/60 text-purple-300 font-bold' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          🌀のみ
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 3. 投稿ごとのエンゲージメント比較カード一覧 */}
                  <div className="space-y-3">
                    {filteredAndSortedHistory.map((item) => {
                      const bStats = item.blueskyEngagement || { likes: 0, reposts: 0, replies: 0 };
                      const tStats = item.threadsEngagement || { likes: 0, reposts: 0, replies: 0 };
                      const comparison = calculateEngagementComparison(bStats, tStats, item.platforms);

                      const bTotal = bStats.likes + bStats.reposts + (bStats.replies || 0);
                      const tTotal = tStats.likes + tStats.reposts + (tStats.replies || 0);
                      const bothTotal = bTotal + tTotal;

                      const bPercent = bothTotal > 0 ? Math.round((bTotal / bothTotal) * 100) : 50;
                      const tPercent = bothTotal > 0 ? 100 - bPercent : 50;

                      const isUpdating = updatingItemId === item.id;

                      return (
                        <div
                          key={item.id}
                          className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-4 space-y-3 transition shadow-sm"
                        >
                          {/* ヘッダー情報（日時、勝敗バッジ、個別更新） */}
                          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-slate-400 flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-slate-500" />
                                {formatHistoryTimestampJst(item.timestamp)}
                              </span>

                              {/* 勝敗判定バッジ */}
                              {comparison.winner === 'Bluesky' && (
                                <span className="px-2 py-0.5 rounded-full bg-[#0085ff]/15 text-[#0085ff] border border-[#0085ff]/30 text-[11px] font-bold flex items-center gap-1">
                                  <Flame className="w-3 h-3 text-[#0085ff]" />
                                  <span>{comparison.summaryText}</span>
                                </span>
                              )}
                              {comparison.winner === 'Threads' && (
                                <span className="px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 border border-purple-800/60 text-[11px] font-bold flex items-center gap-1">
                                  <Flame className="w-3 h-3 text-pink-400" />
                                  <span>{comparison.summaryText}</span>
                                </span>
                              )}
                              {comparison.winner === 'Tie' && bothTotal > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 text-[11px] font-medium">
                                  {comparison.summaryText}
                                </span>
                              )}

                              {item.threadsTopic && (
                                <span className="px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800/50 text-[10px]">
                                  #{item.threadsTopic}
                                </span>
                              )}

                              {item.isDemo && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[9px] font-bold">
                                  DEMO
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleSyncSingle(item)}
                                disabled={isUpdating}
                                className="text-[11px] text-slate-400 hover:text-sky-300 flex items-center gap-1 px-2 py-1 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 transition cursor-pointer"
                                title="このポストのリアクション数を再取得"
                              >
                                <RefreshCw className={`w-3 h-3 ${isUpdating ? 'animate-spin text-sky-400' : ''}`} />
                                <span>再取得</span>
                              </button>
                            </div>
                          </div>

                          {/* 本文スニペット */}
                          <p className="text-xs text-slate-200 line-clamp-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60 font-sans leading-relaxed">
                            {item.originalText}
                          </p>

                          {/* エンゲージメント詳細比較ブロック */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            {/* Bluesky側 */}
                            <div
                              className={`p-2.5 rounded-lg border flex flex-col justify-between space-y-1.5 ${
                                item.platforms.includes('Bluesky')
                                  ? comparison.winner === 'Bluesky'
                                    ? 'bg-[#0085ff]/5 border-[#0085ff]/40'
                                    : 'bg-slate-900/60 border-slate-800'
                                  : 'bg-slate-950/40 border-slate-900 opacity-50'
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-[#0085ff] flex items-center gap-1">
                                  <span>🦋 Bluesky</span>
                                  {item.blueskySuccess && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                                </span>
                                {item.blueskyUrls?.[0] && (
                                  <a
                                    href={item.blueskyUrls[0]}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[10px] text-slate-400 hover:text-[#0085ff] flex items-center gap-0.5"
                                  >
                                    <span>投稿を開く</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>

                              <div className="flex items-center gap-4 text-xs font-mono">
                                <div className="flex items-center gap-1.5 text-slate-200" title="いいね数">
                                  <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400/20" />
                                  <span className="font-bold">{bStats.likes}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-slate-200" title="リポスト数">
                                  <Repeat className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="font-bold">{bStats.reposts}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-slate-200" title="リプライ数">
                                  <MessageCircle className="w-3.5 h-3.5 text-sky-400" />
                                  <span className="font-bold">{bStats.replies || 0}</span>
                                </div>
                              </div>
                            </div>

                            {/* Threads側 */}
                            <div
                              className={`p-2.5 rounded-lg border flex flex-col justify-between space-y-1.5 ${
                                item.platforms.includes('Threads')
                                  ? comparison.winner === 'Threads'
                                    ? 'bg-purple-950/20 border-purple-800/60'
                                    : 'bg-slate-900/60 border-slate-800'
                                  : 'bg-slate-950/40 border-slate-900 opacity-50'
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-purple-300 flex items-center gap-1">
                                  <span>🌀 Threads</span>
                                  {item.threadsSuccess && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                                </span>
                                {item.threadsUrls?.[0] && (
                                  <a
                                    href={item.threadsUrls[0]}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[10px] text-slate-400 hover:text-purple-300 flex items-center gap-0.5"
                                  >
                                    <span>投稿を開く</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>

                              <div className="flex items-center gap-4 text-xs font-mono">
                                <div className="flex items-center gap-1.5 text-slate-200" title="いいね数">
                                  <Heart className="w-3.5 h-3.5 text-pink-400 fill-pink-400/20" />
                                  <span className="font-bold">{tStats.likes}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-slate-200" title="再シェア数">
                                  <Repeat className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="font-bold">{tStats.reposts}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-slate-200" title="返信数">
                                  <MessageCircle className="w-3.5 h-3.5 text-purple-400" />
                                  <span className="font-bold">{tStats.replies || 0}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* 比較バー（両方投稿の場合のみ） */}
                          {item.platforms.includes('Bluesky') && item.platforms.includes('Threads') && (
                            <div className="space-y-1 pt-1 border-t border-slate-900">
                              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                                <span className="text-[#0085ff]">Bluesky {bPercent}%</span>
                                <span>総リアクション: {bothTotal}</span>
                                <span className="text-purple-400">Threads {tPercent}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden flex border border-slate-800">
                                <div
                                  className="bg-[#0085ff] h-full transition-all duration-300"
                                  style={{ width: `${bPercent}%` }}
                                />
                                <div
                                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-300"
                                  style={{ width: `${tPercent}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* タブ 2: CSV / JSON エクスポート & バックアップ復元 */}
          {/* ========================================================= */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              {/* セクション 1: ワンクリック書き出し (CSV / JSON) */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-800/80">
                  <Download className="w-4 h-4 text-sky-400" />
                  <h3 className="text-sm font-bold text-slate-100">データのエクスポート・バックアップ書き出し</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* 1. 投稿履歴ログ CSV */}
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3 hover:border-slate-700 transition">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>投稿ログ CSV</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        過去の送信ログ（日時、本文、いいね・リポスト数、URL、成否など）をExcel対応UTF-8 BOM付きCSVで出力。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        exportHistoryToCsv(history);
                        onNotify?.({
                          type: 'success',
                          title: 'CSVエクスポート完了',
                          message: `投稿ログ (${history.length}件) をCSVでダウンロードしました。`,
                        });
                      }}
                      disabled={history.length === 0}
                      className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shadow-md shadow-emerald-600/20"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>投稿履歴 CSV を保存 ({history.length}件)</span>
                    </button>
                  </div>

                  {/* 2. 予約投稿データ CSV */}
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3 hover:border-slate-700 transition">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-sky-400 font-bold text-xs">
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>予約投稿 CSV</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        現在スケジュールされている予約投稿データ（実行日時、本文、ステータス）をCSVで出力。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        exportScheduledToCsv(scheduledPosts);
                        onNotify?.({
                          type: 'success',
                          title: 'CSVエクスポート完了',
                          message: `予約投稿データ (${scheduledPosts.length}件) をCSVでダウンロードしました。`,
                        });
                      }}
                      disabled={scheduledPosts.length === 0}
                      className="w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shadow-md shadow-sky-600/20"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>予約データ CSV を保存 ({scheduledPosts.length}件)</span>
                    </button>
                  </div>

                  {/* 3. 完全バックアップ JSON */}
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3 hover:border-slate-700 transition">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
                        <FileJson className="w-4 h-4" />
                        <span>完全バックアップ JSON</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        投稿履歴ログと予約投稿データを完全な構造化JSONとして一括バックアップ。いつでも復元可能です。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        exportFullBackupJson(history, scheduledPosts);
                        onNotify?.({
                          type: 'success',
                          title: 'JSONバックアップ完了',
                          message: '全データをJSONバックアップファイルとして保存しました。',
                        });
                      }}
                      className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-purple-600/20"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>完全バックアップ JSON 保存</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* セクション 2: バックアップの復元 (JSON インポート) */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-bold text-slate-100">バックアップJSONからの復元・インポート</h3>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  過去に書き出した完全バックアップJSONファイルを読み込み、投稿履歴や予約データを本アプリへ復元します。
                </p>

                {/* ファイル選択 & プレビュー */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold cursor-pointer transition flex items-center gap-2">
                      <Upload className="w-3.5 h-3.5 text-sky-400" />
                      <span>JSONファイルを選択</span>
                      <input
                        type="file"
                        accept=".json,application/json"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </label>

                    {/* 復元モード選択 */}
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <span className="text-slate-500">復元方式:</span>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'merge'}
                          onChange={() => setImportMode('merge')}
                          className="text-sky-500"
                        />
                        <span>マージ（既存データと統合）</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer ml-2">
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'replace'}
                          onChange={() => setImportMode('replace')}
                          className="text-rose-500"
                        />
                        <span className="text-rose-400">上書き（既存を全置換）</span>
                      </label>
                    </div>
                  </div>

                  {/* プレビュー結果 */}
                  {importPreview && (
                    <div
                      className={`p-3.5 rounded-xl border text-xs space-y-2 ${
                        importPreview.success
                          ? 'bg-emerald-950/20 border-emerald-800/60 text-emerald-200'
                          : 'bg-rose-950/20 border-rose-800/60 text-rose-200'
                      }`}
                    >
                      {importPreview.success ? (
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span className="font-bold">有効なバックアップファイルが読み込まれました:</span>
                            <span className="font-mono bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-700/60">
                              履歴 {importPreview.historyCount}件 / 予約 {importPreview.scheduledCount}件
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleExecuteImport}
                            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-1.5 shadow-md cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>復元を実行する</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-rose-300">
                          <AlertCircle className="w-4 h-4 text-rose-400" />
                          <span>{importPreview.error || 'ファイルの読み込みに失敗しました。'}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* タブ 3: 投稿ログ一覧 */}
          {/* ========================================================= */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-400" />
                  <h3 className="text-sm font-bold text-slate-100">同時投稿の履歴ログ ({history.length}件)</h3>
                </div>
                {history.length > 0 && onClearHistory && (
                  <button
                    type="button"
                    onClick={() => setIsClearConfirmOpen(true)}
                    className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 p-1.5 rounded hover:bg-slate-800 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    履歴全削除
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  まだ投稿履歴がありません。
                </div>
              ) : (
                history.map((item) => {
                  const isBlueskyTarget = item.platforms.includes('Bluesky');
                  const isThreadsTarget = item.platforms.includes('Threads');

                  const isBlueskySuccess = item.blueskySuccess ?? (
                    item.status === 'success' || (item.blueskyUrls && item.blueskyUrls.length > 0)
                  );
                  const isThreadsSuccess = item.threadsSuccess ?? (
                    item.status === 'success' || (item.threadsUrls && item.threadsUrls.length > 0)
                  );

                  return (
                    <div
                      key={item.id}
                      className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-4 space-y-3 transition"
                    >
                      <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {formatHistoryTimestampJst(item.timestamp)}
                          </span>

                          {isBlueskyTarget && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0085ff]/10 text-[#0085ff] border border-[#0085ff]/30">
                              🦋 Bluesky {isBlueskySuccess ? '✓' : '✗'}
                            </span>
                          )}
                          {isThreadsTarget && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-950/60 text-purple-300 border border-purple-800/50">
                              🌀 Threads {isThreadsSuccess ? '✓' : '✗'}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
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

                      <p className="text-xs text-slate-200 whitespace-pre-wrap line-clamp-3 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60 font-sans">
                        {item.originalText}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
        {/* 履歴全削除確認ダイアログ */}
        {isClearConfirmOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-100">
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-100">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-rose-950/80 text-rose-400 border border-rose-800/80 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1.5 flex-1">
                  <h3 className="text-sm font-bold text-slate-100">
                    投稿履歴の全件削除
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    これまでに記録されたすべての投稿履歴（計 <strong className="text-slate-200">{history.length} 件</strong>）を完全に削除しますか？
                  </p>
                  <p className="text-[11px] text-rose-400 font-medium">
                    ※ この操作は取り消せません。
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsClearConfirmOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onClearHistory) onClearHistory();
                    setIsClearConfirmOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-rose-950/50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>全件削除する</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
