import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Download,
  Copy,
  Check,
  Trash2,
  X as CloseIcon,
  Clock,
  Info,
  RefreshCw,
  CheckCircle,
  FileText,
  Calendar,
  Layers,
  Code2,
  Globe,
} from 'lucide-react';
import {
  CommErrorLogEntry,
  getCommErrorLogs,
  clearCommErrorLogs,
  downloadDailyLogFile,
  downloadTextFile,
  generateCommErrorLogText,
  generateDailyLogFileContent,
  formatToJstDetailedString,
  formatToJstShortString,
  groupLogsByJstDay,
  DailyLogGroup,
  getJstDateKey,
} from '../utils/commErrorLogger';
import { getBrowserDetails } from '../utils/browserDetector';
import { PostHistoryItem } from '../types';

interface CommErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  history?: PostHistoryItem[];
}

export const CommErrorModal: React.FC<CommErrorModalProps> = ({
  isOpen,
  onClose,
  history = [],
}) => {
  const [logs, setLogs] = useState<CommErrorLogEntry[]>([]);
  const [filterLevel, setFilterLevel] = useState<'all' | 'error' | 'process'>('all');
  const [selectedDateKey, setSelectedDateKey] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'raw_file'>('cards');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // ログの読み込み & 過去の履歴からのエラー自動マージ
  const refreshLogs = () => {
    const stored = getCommErrorLogs();

    // 履歴アイテムの中でエラーがあり、まだlogsに含まれていないものをマージ（デモモードは完全に除外）
    const historyErrors: CommErrorLogEntry[] = [];
    history.forEach((item) => {
      // デモモードの履歴はエラーも含め記録・表示しない
      if (item.isDemo) return;

      if (item.errorMessage || item.status === 'failed' || item.status === 'partial') {
        const errorMsg = item.errorMessage || '送信処理に失敗しました';
        // 既存のログに同一メッセージのものがあるか確認
        const exists = stored.some((s) => s.errorMessage === errorMsg);
        if (!exists) {
          const ts = new Date(item.timestamp).getTime();
          const validTs = isNaN(ts) ? Date.now() : ts;
          const platform =
            item.platforms.includes('Threads') && !item.platforms.includes('Bluesky')
              ? 'Threads'
              : item.platforms.includes('Bluesky') && !item.platforms.includes('Threads')
              ? 'Bluesky'
              : 'All';

          historyErrors.push({
            id: `hist_${item.id}`,
            timestamp: validTs,
            timestampJst: String(item.timestamp).replace(/\s*JST\b/g, '').trim().includes(':')
              ? String(item.timestamp).replace(/\s*JST\b/g, '').trim()
              : formatToJstShortString(validTs),
            platform,
            action: 'スレッド一括同時投稿',
            errorMessage: errorMsg,
            level: 'error',
            requestSummary: `本文: ${item.originalText?.slice(0, 60)}... / トピック: ${
              item.threadsTopic || 'なし'
            }`,
          });
        }
      }
    });

    // 日時の新しい順にソート
    const all = [...stored, ...historyErrors].sort((a, b) => b.timestamp - a.timestamp);
    setLogs(all);

    // デフォルトで最新日の日付キーを選択
    if (all.length > 0) {
      const today = getJstDateKey(Date.now());
      const groups = groupLogsByJstDay(all);
      const hasToday = groups.some((g) => g.dateKey === today);
      setSelectedDateKey(hasToday ? today : groups[0].dateKey);
    } else {
      setSelectedDateKey('all');
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshLogs();
      setCopiedId(null);
      setCopiedAll(false);
    }
  }, [isOpen, history]);

  // 日付グループの算出
  const dailyGroups: DailyLogGroup[] = useMemo(() => {
    return groupLogsByJstDay(logs);
  }, [logs]);

  // 選択中の日付グループ
  const currentDayGroup = useMemo(() => {
    if (selectedDateKey === 'all') return null;
    return dailyGroups.find((g) => g.dateKey === selectedDateKey) || null;
  }, [dailyGroups, selectedDateKey]);

  // 表示対象のログ（日付フィルター + レベルフィルター）
  const displayedLogs = useMemo(() => {
    const base = currentDayGroup ? currentDayGroup.logs : logs;
    return base.filter((log) => {
      const lvl = log.level || 'error';
      if (filterLevel === 'error') return lvl === 'error';
      if (filterLevel === 'process') return lvl === 'info' || lvl === 'success';
      return true;
    });
  }, [currentDayGroup, logs, filterLevel]);

  // 画面表示用の生ログファイルテキスト
  const rawLogFileText = useMemo(() => {
    if (currentDayGroup) {
      return generateDailyLogFileContent(currentDayGroup.dateKey, displayedLogs);
    }
    const title = 'CrossPost Studio - 通信接続経緯 & エラーログレポート';
    return generateCommErrorLogText(displayedLogs, title);
  }, [currentDayGroup, displayedLogs]);

  const currentBrowserDetails = useMemo(() => getBrowserDetails(), []);

  if (!isOpen) return null;

  const errorLogsCount = logs.filter((l) => (l.level || 'error') === 'error').length;
  const processLogsCount = logs.filter((l) => l.level === 'info' || l.level === 'success').length;

  // 単一ログのコピー
  const handleCopySingle = (log: CommErrorLogEntry) => {
    const text = [
      `【CrossPost 通信ログ】`,
      `レベル: ${(log.level || 'error').toUpperCase()}`,
      `発生日時 (JST): ${log.timestampJst}`,
      `実行ブラウザ: ${log.browser || currentBrowserDetails.summary}`,
      `ブラウザ名称: ${currentBrowserDetails.name}`,
      `ブラウザバージョン: ${currentBrowserDetails.version}`,
      `プラットフォーム: ${log.platform}`,
      `操作: ${log.action}`,
      log.errorCode ? `エラーコード: ${log.errorCode}` : '',
      log.httpStatus ? `HTTPステータス: ${log.httpStatus}` : '',
      `メッセージ: ${log.errorMessage}`,
      log.suggestedAction ? `推奨対処: ${log.suggestedAction}` : '',
      log.requestSummary ? `リクエスト情報: ${log.requestSummary}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(text);
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 単一ログのダウンロード (.log)
  const handleDownloadSingle = (log: CommErrorLogEntry) => {
    const content = generateCommErrorLogText([log], `CrossPost - 通信ログ (${log.platform})`);
    const dateStr = log.timestampJst.replace(/[^0-9]/g, '').slice(0, 14);
    downloadTextFile(
      content,
      `crosspost-log-${log.platform.toLowerCase()}-${dateStr || Date.now()}-JST.log`
    );
  };

  // 全文コピー
  const handleCopyAll = () => {
    navigator.clipboard.writeText(rawLogFileText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  };

  // 1日分を1ファイルとして保存（ダウンロード）
  const handleDownloadDailyFile = (dateKey?: string) => {
    const targetKey = dateKey || (currentDayGroup ? currentDayGroup.dateKey : dailyGroups[0]?.dateKey);
    if (!targetKey) {
      downloadDailyLogFile(getJstDateKey(Date.now()), logs);
      return;
    }
    const group = dailyGroups.find((g) => g.dateKey === targetKey);
    const targetLogs = group ? group.logs : logs;
    downloadDailyLogFile(targetKey, targetLogs);
  };

  // 全日分を1日1ファイルずつ保存
  const handleDownloadAllDaysAsSeparateFiles = () => {
    if (dailyGroups.length === 0) {
      downloadDailyLogFile(getJstDateKey(Date.now()), logs);
      return;
    }
    dailyGroups.forEach((group, index) => {
      setTimeout(() => {
        downloadDailyLogFile(group.dateKey, group.logs);
      }, index * 250);
    });
  };

  // 全ログの消去ダイアログを開く
  const handleClearAll = () => {
    setIsDeleteConfirmOpen(true);
  };

  // 全ログの消去を実行
  const handleConfirmClearAll = () => {
    clearCommErrorLogs();
    setLogs([]);
    setIsDeleteConfirmOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4">
      <div
        id="comm-error-modal"
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-800 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-950/80 text-purple-400 border border-purple-800/60 shadow-inner">
              <FileText className="w-5 h-5 text-purple-300" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-100 flex items-center gap-1.5">
                  <span>通信ログファイル</span>
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  計 {logs.length} 件 ({dailyGroups.length} 日分)
                </span>
                {errorLogsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                    エラー {errorLogsCount} 件
                  </span>
                )}
                <span className="text-[11px] font-mono text-amber-300/90 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>JST (UTC+09:00)</span>
                </span>
                <span
                  className="text-[11px] font-mono text-cyan-300/90 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40 flex items-center gap-1"
                  title={`UserAgent: ${currentBrowserDetails.userAgent}`}
                >
                  <Globe className="w-3 h-3 text-cyan-400" />
                  <span>
                    {currentBrowserDetails.name} {currentBrowserDetails.version} ({currentBrowserDetails.os})
                  </span>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Bluesky & Threads の接続・認証・投稿時の全経緯（1日分を1ファイル形式で保存・プレビュー表示）
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={refreshLogs}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
              title="ログ一覧を更新"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              id="close-comm-error-modal-button"
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 1日単位の日付セレクター & 表示モード切り替えツールバー */}
        <div className="px-5 sm:px-6 py-2.5 bg-slate-950/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {/* 日付切り替えセレクター */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 text-slate-400 text-xs font-semibold">
              <Calendar className="w-3.5 h-3.5 text-purple-400" />
              <span>対象日:</span>
            </div>

            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 max-w-full overflow-x-auto">
              {dailyGroups.map((group) => {
                const isSelected = selectedDateKey === group.dateKey;
                const isToday = group.dateKey === getJstDateKey(Date.now());
                return (
                  <button
                    key={group.dateKey}
                    type="button"
                    onClick={() => setSelectedDateKey(group.dateKey)}
                    className={`px-2.5 py-1 rounded-md transition font-medium cursor-pointer text-xs whitespace-nowrap flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-purple-600 text-white shadow-xs font-bold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <span>
                      {isToday ? '今日 ' : ''}
                      {group.dateKey}
                    </span>
                    <span
                      className={`text-[10px] px-1 py-0.2 rounded-full font-mono ${
                        isSelected
                          ? 'bg-purple-800 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {group.logs.length}
                    </span>
                    {group.errorCount > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    )}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setSelectedDateKey('all')}
                className={`px-2.5 py-1 rounded-md transition font-medium cursor-pointer text-xs whitespace-nowrap ${
                  selectedDateKey === 'all'
                    ? 'bg-purple-600 text-white shadow-xs font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                全期間 ({logs.length})
              </button>
            </div>
          </div>

          {/* 表示形式切り替え: カード vs ログファイル全文 */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`px-2 py-1 rounded-md transition font-medium cursor-pointer text-xs flex items-center gap-1.5 ${
                  viewMode === 'cards'
                    ? 'bg-slate-800 text-white shadow-xs font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="タイムラインカード形式で表示"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>カード表示</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('raw_file')}
                className={`px-2 py-1 rounded-md transition font-medium cursor-pointer text-xs flex items-center gap-1.5 ${
                  viewMode === 'raw_file'
                    ? 'bg-slate-800 text-white shadow-xs font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="1ファイル形式の生テキスト（.log）を画面に表示"
              >
                <Code2 className="w-3.5 h-3.5 text-purple-400" />
                <span>ファイル表示 (.log)</span>
              </button>
            </div>
          </div>
        </div>

        {/* サブツールバー（レベルフィルター & 1日分保存ボタン） */}
        <div className="px-5 sm:px-6 py-2 bg-slate-950/40 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {/* レベルフィルター */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterLevel('all')}
              className={`px-2 py-0.5 rounded text-[11px] transition font-medium cursor-pointer ${
                filterLevel === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              全レベル ({logs.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterLevel('error')}
              className={`px-2 py-0.5 rounded text-[11px] transition font-medium cursor-pointer ${
                filterLevel === 'error'
                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                  : 'text-slate-400 hover:text-rose-300'
              }`}
            >
              エラーのみ ({errorLogsCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterLevel('process')}
              className={`px-2 py-0.5 rounded text-[11px] transition font-medium cursor-pointer ${
                filterLevel === 'process'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'text-slate-400 hover:text-emerald-300'
              }`}
            >
              接続・成功経緯 ({processLogsCount})
            </button>
          </div>

          {/* 保存 & アクション */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyAll}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition flex items-center gap-1.5 cursor-pointer text-xs"
              title="表示中のログファイルテキストをクリップボードにコピー"
            >
              {copiedAll ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedAll ? 'コピー完了' : 'ログコピー'}</span>
            </button>

            {/* 1日分を1ファイルとして保存するボタン */}
            <button
              id="download-daily-log-file-button"
              type="button"
              onClick={() => handleDownloadDailyFile()}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold transition flex items-center gap-1.5 shadow-md shadow-purple-950/40 cursor-pointer text-xs"
              title={
                currentDayGroup
                  ? `【${currentDayGroup.dateKey}】の1日分を crosspost-log-${currentDayGroup.dateKey}-JST.log として保存`
                  : '1日分を1ファイルとして保存 (.log)'
              }
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {currentDayGroup
                  ? `${currentDayGroup.dateKey} ログ保存 (1日分 .log)`
                  : '本日分ログ保存 (1日分 .log)'}
              </span>
            </button>

            {dailyGroups.length > 1 && selectedDateKey === 'all' && (
              <button
                type="button"
                onClick={handleDownloadAllDaysAsSeparateFiles}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition cursor-pointer"
                title="全期間のログを各日付ごとに1日1ファイルとして順次保存"
              >
                各日一括保存
              </button>
            )}

            <button
              type="button"
              onClick={handleClearAll}
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
              title="通信ログをすべて消去"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ログ一覧ボディ */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 bg-slate-950/30">
          {displayedLogs.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-xs space-y-2">
              <AlertTriangle className="w-8 h-8 mx-auto text-slate-600 stroke-[1.5]" />
              <p className="text-slate-300 font-medium">
                {selectedDateKey === 'all'
                  ? '記録されている通信ログはありません。'
                  : `日付【${selectedDateKey}】の該当ログはありません。`}
              </p>
              <p className="text-slate-500 text-[11px]">
                Bluesky や Threads への接続・認証・投稿時の動作ログが1日単位で記録されます。
              </p>
            </div>
          ) : viewMode === 'raw_file' ? (
            /* 生ログファイル表示ビュー (.log の内容をそのまま画面に表示) */
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 font-mono">
                <span className="flex items-center gap-1.5 text-purple-300 font-bold">
                  <FileText className="w-3.5 h-3.5" />
                  <span>
                    ファイル名: crosspost-log-
                    {currentDayGroup ? currentDayGroup.dateKey : getJstDateKey(Date.now())}
                    -JST.log
                  </span>
                </span>
                <span>文字エンコード: UTF-8 / 改行コード: LF / タイムゾーン: JST</span>
              </div>
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre selection:bg-purple-900 selection:text-white max-h-[58vh]">
                {rawLogFileText}
              </pre>
            </div>
          ) : (
            /* カード表示ビュー */
            displayedLogs.map((log) => {
              const lvl = log.level || 'error';
              const isError = lvl === 'error';
              const isSuccess = lvl === 'success';

              return (
                <div
                  key={log.id}
                  className={`p-4 rounded-xl border transition space-y-2.5 text-xs ${
                    isError
                      ? 'bg-slate-950/90 border-rose-900/50 hover:border-rose-800/70'
                      : isSuccess
                      ? 'bg-slate-950/90 border-emerald-900/40 hover:border-emerald-800/60'
                      : 'bg-slate-950/90 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* ログヘッダー */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/70 pb-2">
                    <div className="flex items-center gap-2">
                      {/* レベルバッジ */}
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                          isError
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : isSuccess
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-sky-950 text-sky-300 border border-sky-800'
                        }`}
                      >
                        {isError ? (
                          <AlertTriangle className="w-3 h-3" />
                        ) : isSuccess ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <Info className="w-3 h-3" />
                        )}
                        <span>{lvl.toUpperCase()}</span>
                      </span>

                      {/* プラットフォームバッジ */}
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          log.platform === 'Bluesky'
                            ? 'bg-[#0085ff]/20 text-sky-300 border border-[#0085ff]/40'
                            : log.platform === 'Threads'
                            ? 'bg-purple-950/60 text-purple-300 border border-purple-800/60'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {log.platform === 'Bluesky'
                          ? '🦋 Bluesky'
                          : log.platform === 'Threads'
                          ? '🌀 Threads'
                          : '🌐 全体'}
                      </span>

                      <span className="font-semibold text-slate-200">{log.action}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-amber-300/90 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-400" />
                        <span>{log.timestampJst}</span>
                      </span>

                      {/* 個別アクション */}
                      <button
                        type="button"
                        onClick={() => handleCopySingle(log)}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                        title="このログをコピー"
                      >
                        {copiedId === log.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadSingle(log)}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                        title="このログを個別 .log ファイルとしてダウンロード"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* メッセージ本文 */}
                  <div
                    className={`p-2.5 rounded-lg font-mono text-[11px] break-all whitespace-pre-wrap border ${
                      isError
                        ? 'bg-rose-950/30 border-rose-900/50 text-rose-300'
                        : isSuccess
                        ? 'bg-emerald-950/30 border-emerald-900/40 text-emerald-300'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300'
                    }`}
                  >
                    {log.errorMessage}
                  </div>

                  {/* エラーコード & HTTPステータス & エンドポイント & 実行ブラウザ */}
                  {(log.errorCode || log.httpStatus || log.endpoint || log.browser) && (
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-slate-400">
                      {log.browser && (
                        <span
                          className="bg-slate-800 px-1.5 py-0.5 rounded text-cyan-300 flex items-center gap-1 border border-slate-700"
                          title={log.userAgent || log.browser}
                        >
                          <Globe className="w-2.5 h-2.5 text-cyan-400" />
                          <span>{log.browser}</span>
                        </span>
                      )}
                      {log.httpStatus && (
                        <span className="bg-slate-800 px-1.5 py-0.5 rounded">
                          HTTP: {log.httpStatus}
                        </span>
                      )}
                      {log.errorCode && (
                        <span className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-300">
                          Code: {log.errorCode}
                        </span>
                      )}
                      {log.endpoint && (
                        <span className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                          Endpoint: {log.endpoint}
                        </span>
                      )}
                    </div>
                  )}

                  {/* 推奨アクション */}
                  {log.suggestedAction && (
                    <div className="p-2 rounded bg-emerald-950/30 border border-emerald-900/40 text-[11px] text-emerald-200 flex items-start gap-1.5">
                      <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{log.suggestedAction}</span>
                    </div>
                  )}

                  {/* リクエスト概要 */}
                  {log.requestSummary && (
                    <div className="text-[10px] text-slate-500 font-mono bg-slate-900/40 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 font-bold">リクエスト概要:</span>{' '}
                      {log.requestSummary}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* モーダルフッター */}
        <div className="px-5 sm:px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span>
              ※ ログファイルは1日単位（crosspost-log-YYYY-MM-DD-JST.log）としてダウンロード保存されます。
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleDownloadDailyFile()}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-900/50 transition cursor-pointer font-bold flex items-center gap-1.5 text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>1日分保存 (.log)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer font-medium"
            >
              閉じる
            </button>
          </div>
        </div>
        {/* 削除確認ダイアログ */}
        {isDeleteConfirmOpen && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-100">
            <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-100">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-rose-950/80 text-rose-400 border border-rose-800/80 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-100">
                    通信ログの全件消去
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    保存されているすべての通信ログ（計 <strong className="text-slate-200">{logs.length} 件</strong>）を消去しますか？
                  </p>
                  <p className="text-[11px] text-rose-400 font-medium">
                    ※ この操作は取り消せません。
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClearAll}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-rose-950/50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>ログを消去する</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
