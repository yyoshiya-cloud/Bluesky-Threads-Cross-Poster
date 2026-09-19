/**
 * CrossPost Web Studio - 通信ログ & エラーログ管理 & ダウンロードユーティリティ
 * すべての日時表記は日本標準時 (JST: UTC+9) で厳密に出力されます。
 * Bluesky / Threads の接続試行、認証成功、トークン検証、エラー発生などの経緯を永続的に記録します。
 */

import { getBrowserDetails, getBrowserSummaryString } from './browserDetector';

export type CommLogLevel = 'error' | 'success' | 'info' | 'warning';

export interface CommErrorLogEntry {
  id: string;
  timestamp: number; // Unixミリ秒
  timestampJst: string; // 例: "2026/09/17 16:01:45 JST"
  level?: CommLogLevel; // 'error' | 'success' | 'info' | 'warning' (省略時は'error')
  platform: 'Bluesky' | 'Threads' | 'All' | 'Network' | 'System';
  action: string; // 操作内容 (例: "Bluesky接続試行", "Threads接続成功", "Threadsアクセストークン検証")
  browser?: string; // 実行ブラウザ名称 & バージョン & OS (例: "Google Chrome 128.0.6613.120 (Windows 10/11 64-bit)")
  userAgent?: string; // ブラウザUser-Agent
  endpoint?: string;
  httpStatus?: number | string;
  errorCode?: string | number;
  errorMessage?: string;
  detailMessage?: string;
  requestSummary?: string;
  rawResponse?: string;
  suggestedAction?: string;
  isDemo?: boolean;
}

// 別名エクスポート（通信ログ全体を指す型として）
export type CommLogEntry = CommErrorLogEntry;

const STORAGE_KEY = 'crosspost_communication_error_logs';
const MAX_LOGS = 300;

/**
 * タイムスタンプ(ms)を日本標準時 (JST: UTC+9) の統一された文字列へ変換
 * 例: "2026/09/17 16:01:45 (UTC+09:00)"
 */
export function formatToJstDetailedString(timestamp: number | Date = Date.now()): string {
  const d = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  if (isNaN(d.getTime())) return '';

  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return `${formatter.format(d)} (UTC+09:00)`;
}

/**
 * タイムスタンプ(ms)を短いJST文字列に変換 (例: "2026/09/17 16:01:45")
 */
export function formatToJstShortString(timestamp: number | Date = Date.now()): string {
  const d = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  if (isNaN(d.getTime())) return '';

  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  return formatter.format(d);
}

/**
 * ログエントリまたは現在の環境がデモモードかどうかを厳密に判定
 */
export function isDemoLogEntry(
  entry: Partial<CommLogEntry> & { message?: string }
): boolean {
  if (entry.isDemo === true) return true;

  // テキストフィールド内のデモキーワード判定
  const textFields = [
    entry.action || '',
    entry.errorMessage || '',
    entry.requestSummary || '',
    entry.endpoint || '',
    entry.message || '',
    entry.detailMessage || '',
  ]
    .join(' ')
    .toLowerCase();

  if (
    textFields.includes('demo') ||
    textFields.includes('シミュレーション') ||
    textFields.includes('demo-creator') ||
    textFields.includes('th_long_lived_token_demo') ||
    textFields.includes('demo-pass')
  ) {
    return true;
  }

  // localStorage に保存された認証情報からデモモード稼働中かを判定
  if (typeof window !== 'undefined') {
    try {
      const rawCreds = localStorage.getItem('cross_poster_creds');
      if (rawCreds) {
        const creds = JSON.parse(rawCreds);
        if (creds.isDemoMode === true) {
          return true;
        }
        const bId = String(creds.blueskyIdentifier || '').toLowerCase();
        const bPass = String(creds.blueskyAppPassword || '').toLowerCase();
        const tToken = String(creds.threadsAccessToken || '').toLowerCase();
        const tId = String(creds.threadsUserId || '').toLowerCase();
        if (
          bId.includes('demo') ||
          bPass.includes('demo') ||
          tToken.includes('demo') ||
          tId.includes('demo')
        ) {
          return true;
        }
      }
    } catch {
      // ignore
    }
  }

  return false;
}

/**
 * 保存されている通信ログを全件取得（デモモードのログは完全に除外）
 */
export function getCommErrorLogs(): CommLogEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // デモモードのログを徹底的にフィルタリング
    const filtered = parsed.filter((item) => !isDemoLogEntry(item));

    // 以前のデモログが保存されていた場合は自動クリーンアップ
    if (filtered.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }

    return filtered;
  } catch (err) {
    console.warn('Failed to load communication logs from localStorage:', err);
    return [];
  }
}

/**
 * 新しい通信ログを記録・保存 (汎用)
 * ※デモモード中のログは一切記録・保存しません。
 */
export function recordCommLog(
  entry: Omit<CommLogEntry, 'id' | 'timestamp' | 'timestampJst'> & {
    timestamp?: number;
    message?: string;
  }
): CommLogEntry {
  const ts = entry.timestamp || Date.now();
  const level: CommLogLevel = entry.level || (entry.errorMessage ? 'error' : 'info');
  const browserDetails = getBrowserDetails();
  const isClient = browserDetails.name !== 'Server / Node.js';

  const newLog: CommLogEntry = {
    id: `log_${ts}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: ts,
    timestampJst: formatToJstShortString(ts),
    level,
    browser: entry.browser || (isClient ? browserDetails.summary : undefined),
    userAgent: entry.userAgent || (isClient ? browserDetails.userAgent : undefined),
    ...entry,
  };

  // デモモードのログは記録しない
  if (isDemoLogEntry(entry)) {
    return newLog;
  }

  if (typeof window === 'undefined') return newLog;

  try {
    const logs = getCommErrorLogs();
    // 直近3秒以内の同一レベル・同一プラットフォーム・同一アクション・同一メッセージの重複記録を抑止
    const isDuplicate = logs.some(
      (l) =>
        Math.abs(l.timestamp - ts) < 3000 &&
        l.level === newLog.level &&
        l.platform === newLog.platform &&
        l.action === newLog.action &&
        l.errorMessage === newLog.errorMessage
    );

    if (!isDuplicate) {
      logs.unshift(newLog);
      if (logs.length > MAX_LOGS) {
        logs.splice(MAX_LOGS);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
    }
  } catch (err) {
    console.warn('Failed to save communication log:', err);
  }

  return newLog;
}

/**
 * 通信エラーログを記録（既存コードとの互換性用）
 */
export function recordCommError(
  entry: Omit<CommLogEntry, 'id' | 'timestamp' | 'timestampJst' | 'level'> & {
    timestamp?: number;
    errorMessage: string;
  }
): CommLogEntry {
  return recordCommLog({
    ...entry,
    level: 'error',
  });
}

/**
 * 接続成功・通信成功ログを記録するヘルパー
 */
export function recordCommSuccess(
  entry: Omit<CommLogEntry, 'id' | 'timestamp' | 'timestampJst' | 'level'> & {
    timestamp?: number;
    message?: string;
  }
): CommLogEntry {
  return recordCommLog({
    ...entry,
    level: 'success',
    errorMessage: entry.message || entry.errorMessage || '処理が正常に完了しました',
  });
}

/**
 * 接続試行・進行中情報を記録するヘルパー
 */
export function recordCommInfo(
  entry: Omit<CommLogEntry, 'id' | 'timestamp' | 'timestampJst' | 'level'> & {
    timestamp?: number;
    message?: string;
  }
): CommLogEntry {
  return recordCommLog({
    ...entry,
    level: 'info',
    errorMessage: entry.message || entry.errorMessage || '通信処理を開始しました',
  });
}

/**
 * 通信ログを全削除
 */
export function clearCommErrorLogs(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear communication logs:', err);
  }
}

/**
 * 通信ログリストをテキスト形式のログファイル本文にフォーマット
 * （JST表記、成功・情報・エラー経緯、詳細診断付き）
 */
export function generateCommErrorLogText(
  logs: CommLogEntry[],
  title = 'CrossPost Studio - 通信接続経緯 & エラーログレポート'
): string {
  const generatedAtJst = formatToJstDetailedString(Date.now());
  const separator = '='.repeat(84);
  const subSeparator = '-'.repeat(84);

  const errorCount = logs.filter((l) => l.level === 'error').length;
  const successCount = logs.filter((l) => l.level === 'success').length;
  const infoCount = logs.filter((l) => l.level === 'info' || l.level === 'warning').length;

  const browserDetails = getBrowserDetails();

  const lines: string[] = [
    separator,
    `  ${title}`,
    separator,
    `出力日時 (JST)    : ${generatedAtJst}`,
    `対象環境          : Web Studio (Client & API Gateway)`,
    `利用ブラウザ      : ${browserDetails.summary}`,
    `ブラウザ名称      : ${browserDetails.name}`,
    `ブラウザバージョン: ${browserDetails.version}`,
    `実行環境OS        : ${browserDetails.os} (${browserDetails.osArch})`,
    `ユーザーエージェント: ${browserDetails.userAgent}`,
    `記録総件数        : ${logs.length} 件 (エラー: ${errorCount}件, 成功: ${successCount}件, 接続経緯: ${infoCount}件)`,
    `タイムゾーン      : Asia/Tokyo (JST, UTC+09:00)`,
    separator,
    '',
  ];

  if (logs.length === 0) {
    lines.push('現在、記録されている通信ログはありません。');
    lines.push(separator);
    return lines.join('\n');
  }

  logs.forEach((log, idx) => {
    const levelLabel =
      log.level === 'error'
        ? '【❌ エラー】'
        : log.level === 'success'
        ? '【✅ 成功】'
        : log.level === 'warning'
        ? '【⚠️ 警告】'
        : '【ℹ️ 接続経緯/情報】';

    lines.push(`${levelLabel} #${idx + 1}`);
    lines.push(`  発生日時 (JST)  : ${log.timestampJst}`);
    const bSummary = log.browser || browserDetails.summary;
    lines.push(`  実行ブラウザ    : ${bSummary}`);
    lines.push(`  ブラウザ名称    : ${browserDetails.name}`);
    lines.push(`  ブラウザバージョン: ${browserDetails.version}`);
    lines.push(`  プラットフォーム: ${log.platform}`);
    lines.push(`  操作内容        : ${log.action}`);
    if (log.endpoint) {
      lines.push(`  エンドポイント  : ${log.endpoint}`);
    }
    if (log.httpStatus) {
      lines.push(`  HTTPステータス  : ${log.httpStatus}`);
    }
    if (log.errorCode) {
      lines.push(`  エラーコード    : ${log.errorCode}`);
    }
    if (log.errorMessage) {
      lines.push(`  メッセージ/詳細 : ${log.errorMessage}`);
    }
    if (log.detailMessage) {
      lines.push(`  追加情報        : ${log.detailMessage}`);
    }
    if (log.suggestedAction) {
      lines.push(`  推奨アクション  : ${log.suggestedAction}`);
    }
    if (log.requestSummary) {
      lines.push(`  リクエスト概要  : ${log.requestSummary}`);
    }
    if (log.rawResponse) {
      lines.push(`  生レスポンス詳細:`);
      const rawIndent = log.rawResponse
        .split('\n')
        .map((l) => `    | ${l}`)
        .join('\n');
      lines.push(rawIndent);
    }
    if (log.isDemo) {
      lines.push(`  モード区分      : DEMOモード`);
    }
    lines.push(subSeparator);
    lines.push('');
  });

  lines.push('--- レポート終了 ---');
  return lines.join('\n');
}

/**
 * 単一の投稿履歴アイテムから、JST時刻付きのエラーログテキストを生成
 */
export function generateHistoryItemErrorLogText(item: {
  timestamp: string | number;
  originalText?: string;
  platforms?: string[];
  errorMessage?: string;
  threadsTopic?: string;
  imageCount?: number;
  videoCount?: number;
}): string {
  const generatedAtJst = formatToJstDetailedString(Date.now());
  const separator = '='.repeat(84);

  // 日時をJSTに変換 (末尾のJST表記は除外)
  let occurrenceTimeJst = String(item.timestamp).replace(/\s*JST\b/g, '').trim();
  const num = Number(item.timestamp);
  if (!isNaN(num) && num > 100000000000) {
    occurrenceTimeJst = formatToJstShortString(num);
  } else {
    const parsed = new Date(item.timestamp);
    if (!isNaN(parsed.getTime())) {
      occurrenceTimeJst = formatToJstShortString(parsed);
    }
  }

  const bDetails = getBrowserDetails();
  const lines: string[] = [
    separator,
    `  CrossPost Studio - 投稿通信エラー個別診断ログ`,
    separator,
    `ログ出力日時 (JST): ${generatedAtJst}`,
    `利用ブラウザ      : ${getBrowserSummaryString()}`,
    `ブラウザ名称      : ${bDetails.name}`,
    `ブラウザバージョン: ${bDetails.version}`,
    `投稿試行日時 (JST): ${occurrenceTimeJst}`,
    `対象プラットフォーム: ${(item.platforms || []).join(', ') || '不明'}`,
    separator,
    '',
    `[エラーメッセージ]`,
    item.errorMessage || 'エラーメッセージなし',
    '',
  ];

  if (item.threadsTopic) {
    lines.push(`[Threadsトピックタグ]`);
    lines.push(`#${item.threadsTopic.replace(/^#+/, '')}`);
    const byteLen = new TextEncoder().encode(item.threadsTopic.replace(/^#+/, '')).length;
    lines.push(`(バイト数: ${byteLen}/50バイト, 文字数: ${item.threadsTopic.length})`);
    lines.push('');
  }

  lines.push(`[添付メディア情報]`);
  lines.push(`画像枚数: ${item.imageCount ?? 0}枚, 動画本数: ${item.videoCount ?? 0}本`);
  lines.push('');

  if (item.originalText) {
    lines.push(`[送信テキスト本文プレビュー]`);
    lines.push(item.originalText);
    lines.push('');
  }

  lines.push(separator);
  lines.push(`※ 本ログはサポート窓口や不具合調査時にそのままご活用いただけます。`);
  lines.push(separator);

  return lines.join('\n');
}

/**
 * テキストデータをファイルとしてブラウザからダウンロードさせる
 */
export function downloadTextFile(
  content: string,
  filename = `crosspost-error-log-${new Date().toISOString().replace(/[:.]/g, '-')}.log`,
  mimeType = 'text/plain;charset=utf-8'
): void {
  if (typeof window === 'undefined') return;

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * タイムスタンプ(ms)から JST基準の日付キー (YYYY-MM-DD) を取得
 */
export function getJstDateKey(timestamp: number | Date = Date.now()): string {
  const d = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  if (isNaN(d.getTime())) return 'unknown-date';
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value || '2026';
  const m = parts.find((p) => p.type === 'month')?.value || '01';
  const day = parts.find((p) => p.type === 'day')?.value || '01';
  return `${y}-${m}-${day}`;
}

/**
 * タイムスタンプ(ms)から JST基準の人間向け日付表示 ("2026年09月17日") を取得
 */
export function getJstDateLabel(timestamp: number | Date = Date.now()): string {
  const d = typeof timestamp === 'number' ? new Date(timestamp) : timestamp;
  if (isNaN(d.getTime())) return '日時不明';
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value || '2026';
  const m = parts.find((p) => p.type === 'month')?.value || '01';
  const day = parts.find((p) => p.type === 'day')?.value || '01';
  return `${y}年${m}月${day}日`;
}

export interface DailyLogGroup {
  dateKey: string; // "2026-09-17"
  dateLabelJst: string; // "2026年09月17日"
  logs: CommLogEntry[];
  errorCount: number;
  successCount: number;
  infoCount: number;
}

/**
 * ログ配列を1日ごと (JST日付) にグループ化して返却
 */
export function groupLogsByJstDay(logs: CommLogEntry[]): DailyLogGroup[] {
  const map = new Map<string, CommLogEntry[]>();

  logs.forEach((log) => {
    const key = getJstDateKey(log.timestamp);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(log);
  });

  // 日付の降順（最新の日付が先頭）
  const sortedKeys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));

  return sortedKeys.map((dateKey) => {
    const dayLogs = map.get(dateKey) || [];
    // ログ内も新しい順にソート
    dayLogs.sort((a, b) => b.timestamp - a.timestamp);

    const firstTs = dayLogs[0]?.timestamp || Date.now();
    return {
      dateKey,
      dateLabelJst: getJstDateLabel(firstTs),
      logs: dayLogs,
      errorCount: dayLogs.filter((l) => (l.level || 'error') === 'error').length,
      successCount: dayLogs.filter((l) => l.level === 'success').length,
      infoCount: dayLogs.filter((l) => l.level === 'info' || l.level === 'warning').length,
    };
  });
}

/**
 * 特定の1日分 (JST) のログを1つのログファイルテキストとして生成
 */
export function generateDailyLogFileContent(dateKey: string, logs: CommLogEntry[]): string {
  const title = `CrossPost Studio - 日別通信ログレポート (${dateKey} JST)`;
  return generateCommErrorLogText(logs, title);
}

/**
 * 1日分のログを1ファイルとしてダウンロード保存
 * 例: crosspost-log-2026-09-17-JST.log
 */
export function downloadDailyLogFile(dateKey: string, logs: CommLogEntry[]): void {
  const filename = `crosspost-log-${dateKey}-JST.log`;
  const content = generateDailyLogFileContent(dateKey, logs);
  downloadTextFile(content, filename);
}

/**
 * 全通信ログをJST日付入りのファイル名でダウンロード
 */
export function downloadAllCommErrorLogs(logs?: CommLogEntry[]): void {
  const targetLogs = logs || getCommErrorLogs();
  // ログが特定日のみの場合はその日付の1日1ファイルとして保存
  const dayGroups = groupLogsByJstDay(targetLogs);
  if (dayGroups.length === 1) {
    downloadDailyLogFile(dayGroups[0].dateKey, dayGroups[0].logs);
    return;
  }

  // 複数日ある場合、本日の日付または最新日付の1日1ファイル保存
  const todayKey = getJstDateKey(Date.now());
  const todayGroup = dayGroups.find((g) => g.dateKey === todayKey) || dayGroups[0];
  if (todayGroup) {
    downloadDailyLogFile(todayGroup.dateKey, todayGroup.logs);
  } else {
    downloadTextFile(generateCommErrorLogText(targetLogs), `crosspost-log-${todayKey}-JST.log`);
  }
}
