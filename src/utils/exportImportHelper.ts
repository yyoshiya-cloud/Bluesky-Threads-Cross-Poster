import { PostHistoryItem, ScheduledPostItem, SnippetItem } from '../types';
import { formatToJstString, formatHistoryTimestampJst } from './scheduledStorage';
import { loadSnippetsFromStorage } from './snippetStorage';

/**
 * CSVセル用エスケープ処理（カンマ、ダブルクォート、改行を含む文字列を安全にクォート）
 */
function escapeCsvCell(val: any): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * 文字列をUTF-8 BOM付きBlobとしてブラウザダウンロード実行
 */
export function downloadFile(content: string, filename: string, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 現在日時からファイル名用のYYYYMMDD_HHmmタイムスタンプを生成
 */
function getFilenameTimestamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${y}${m}${d}_${h}${min}`;
}

/**
 * 1. 投稿履歴・エンゲージメントログのCSVエクスポート
 */
export function exportHistoryToCsv(history: PostHistoryItem[]): void {
  const headers = [
    '投稿日時(JST)',
    '投稿ID',
    '投稿本文',
    '対象プラットフォーム',
    '全体ステータス',
    'Bluesky成否',
    'Blueskyツリー数',
    'Blueskyいいね数',
    'Blueskyリポスト数',
    'Blueskyリプライ数',
    'Bluesky投稿URL',
    'Threads成否',
    'Threadsツリー数',
    'Threadsいいね数',
    'Threadsリポスト数',
    'Threadsリプライ数',
    'Threadsトピック',
    'Threads投稿URL',
    '添付画像数',
    '添付動画数',
    'デモ投稿フラグ',
    'エラーメッセージ',
  ];

  const rows = history.map((item) => {
    const bLikes = item.blueskyEngagement?.likes ?? 0;
    const bReposts = item.blueskyEngagement?.reposts ?? 0;
    const bReplies = item.blueskyEngagement?.replies ?? 0;
    const tLikes = item.threadsEngagement?.likes ?? 0;
    const tReposts = item.threadsEngagement?.reposts ?? 0;
    const tReplies = item.threadsEngagement?.replies ?? 0;

    const bSuccess = item.blueskySuccess ? '成功' : item.platforms.includes('Bluesky') ? '失敗' : '対象外';
    const tSuccess = item.threadsSuccess ? '成功' : item.platforms.includes('Threads') ? '失敗' : '対象外';

    return [
      escapeCsvCell(formatHistoryTimestampJst(item.timestamp)),
      escapeCsvCell(item.id),
      escapeCsvCell(item.originalText),
      escapeCsvCell(item.platforms.join(' / ')),
      escapeCsvCell(item.status === 'success' ? '全送信成功' : item.status === 'partial' ? '一部失敗' : '失敗'),
      escapeCsvCell(bSuccess),
      escapeCsvCell((item.blueskyPosts || []).length),
      escapeCsvCell(bLikes),
      escapeCsvCell(bReposts),
      escapeCsvCell(bReplies),
      escapeCsvCell((item.blueskyUrls || []).join('; ')),
      escapeCsvCell(tSuccess),
      escapeCsvCell((item.threadsPosts || []).length),
      escapeCsvCell(tLikes),
      escapeCsvCell(tReposts),
      escapeCsvCell(tReplies),
      escapeCsvCell(item.threadsTopic || ''),
      escapeCsvCell((item.threadsUrls || []).join('; ')),
      escapeCsvCell(item.imageCount || (item.images || []).length || 0),
      escapeCsvCell(item.videoCount || 0),
      escapeCsvCell(item.isDemo ? 'はい(DEMO)' : 'いいえ'),
      escapeCsvCell(item.errorMessage || ''),
    ].join(',');
  });

  // Excel等で文字化けしないよう UTF-8 BOM (\uFEFF) を付与
  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const filename = `crosspost_history_${getFilenameTimestamp()}.csv`;
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
}

/**
 * 2. 予約投稿データのCSVエクスポート
 */
export function exportScheduledToCsv(scheduledPosts: ScheduledPostItem[]): void {
  const headers = [
    '予約実行日時(JST)',
    '予約ID',
    '作成日時(JST)',
    'ステータス',
    '対象プラットフォーム',
    '投稿本文',
    'Bluesky個別テキスト',
    'Threads個別テキスト',
    'Threadsトピック',
    '添付画像数',
    '添付動画数',
    '自動分割',
    '連番付与',
    'デモ予約フラグ',
    '実行結果エラー',
  ];

  const rows = scheduledPosts.map((post) => {
    return [
      escapeCsvCell(post.scheduledAtJstString || formatToJstString(post.scheduledAt)),
      escapeCsvCell(post.id),
      escapeCsvCell(formatToJstString(post.createdAt)),
      escapeCsvCell(post.status === 'pending' ? '待機中' : post.status === 'completed' ? '完了' : post.status === 'failed' ? '失敗' : 'キャンセル'),
      escapeCsvCell([post.postToBluesky ? 'Bluesky' : null, post.postToThreads ? 'Threads' : null].filter(Boolean).join(' / ')),
      escapeCsvCell(post.text),
      escapeCsvCell(post.blueskyText || ''),
      escapeCsvCell(post.threadsText || ''),
      escapeCsvCell(post.threadsTopic || ''),
      escapeCsvCell((post.images || []).filter((i) => i.mediaType !== 'video').length),
      escapeCsvCell((post.images || []).filter((i) => i.mediaType === 'video').length),
      escapeCsvCell(post.autoSplit ? 'ON' : 'OFF'),
      escapeCsvCell(post.includeNumbering ? 'ON' : 'OFF'),
      escapeCsvCell(post.error ? 'はい' : 'いいえ'),
      escapeCsvCell(post.error || ''),
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const filename = `crosspost_scheduled_${getFilenameTimestamp()}.csv`;
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
}

/**
 * 3. 完全バックアップデータのJSONエクスポート
 */
export interface FullBackupData {
  version: string;
  exportedAt: number;
  exportedAtJst: string;
  app: string;
  history: PostHistoryItem[];
  scheduledPosts: ScheduledPostItem[];
  snippets?: SnippetItem[];
  metadata?: {
    totalHistoryCount: number;
    totalScheduledCount: number;
    totalSnippetCount?: number;
  };
}

export function exportFullBackupJson(
  history: PostHistoryItem[],
  scheduledPosts: ScheduledPostItem[]
): void {
  const now = Date.now();
  const snippets = loadSnippetsFromStorage();
  const backup: FullBackupData = {
    version: '1.0.0',
    exportedAt: now,
    exportedAtJst: formatToJstString(now),
    app: 'CrossPost Web Studio',
    history: history || [],
    scheduledPosts: scheduledPosts || [],
    snippets: snippets || [],
    metadata: {
      totalHistoryCount: history?.length || 0,
      totalScheduledCount: scheduledPosts?.length || 0,
      totalSnippetCount: snippets?.length || 0,
    },
  };

  const jsonContent = JSON.stringify(backup, null, 2);
  const filename = `crosspost_backup_full_${getFilenameTimestamp()}.json`;
  downloadFile(jsonContent, filename, 'application/json;charset=utf-8;');
}

/**
 * 4. バックアップJSONのパース & 検証
 */
export interface ImportBackupResult {
  success: boolean;
  history: PostHistoryItem[];
  scheduledPosts: ScheduledPostItem[];
  snippets?: SnippetItem[];
  error?: string;
  stats?: {
    historyCount: number;
    scheduledCount: number;
    snippetCount?: number;
    exportedAtJst?: string;
  };
}

export function parseAndValidateBackupJson(jsonString: string): ImportBackupResult {
  try {
    const data = JSON.parse(jsonString);

    if (!data || typeof data !== 'object') {
      return { success: false, history: [], scheduledPosts: [], error: 'JSONの形式が無効です。' };
    }

    // 履歴データの抽出と整形
    const rawHistory = Array.isArray(data.history) ? data.history : [];
    const validHistory: PostHistoryItem[] = rawHistory
      .filter((item: any) => item && typeof item === 'object' && item.id)
      .map((item: any) => ({
        id: String(item.id),
        timestamp: String(item.timestamp || formatToJstString(Date.now())),
        originalText: String(item.originalText || ''),
        platforms: Array.isArray(item.platforms) ? item.platforms : ['Bluesky', 'Threads'],
        blueskyPosts: Array.isArray(item.blueskyPosts) ? item.blueskyPosts : [],
        threadsPosts: Array.isArray(item.threadsPosts) ? item.threadsPosts : [],
        threadsTopic: item.threadsTopic ? String(item.threadsTopic) : undefined,
        images: Array.isArray(item.images) ? item.images : [],
        imageCount: typeof item.imageCount === 'number' ? item.imageCount : 0,
        videoCount: typeof item.videoCount === 'number' ? item.videoCount : 0,
        status: item.status === 'failed' || item.status === 'partial' ? item.status : 'success',
        blueskySuccess: Boolean(item.blueskySuccess),
        threadsSuccess: Boolean(item.threadsSuccess),
        blueskyUrls: Array.isArray(item.blueskyUrls) ? item.blueskyUrls : [],
        threadsUrls: Array.isArray(item.threadsUrls) ? item.threadsUrls : [],
        blueskyEngagement: item.blueskyEngagement,
        threadsEngagement: item.threadsEngagement,
        isDemo: Boolean(item.isDemo),
        errorMessage: item.errorMessage ? String(item.errorMessage) : undefined,
      }));

    // 予約投稿データの抽出と整形
    const rawScheduled = Array.isArray(data.scheduledPosts) ? data.scheduledPosts : [];
    const validScheduled: ScheduledPostItem[] = rawScheduled
      .filter((post: any) => post && typeof post === 'object' && post.id && post.scheduledAt)
      .map((post: any) => ({
        id: String(post.id),
        createdAt: Number(post.createdAt || Date.now()),
        scheduledAt: Number(post.scheduledAt),
        scheduledAtJstString: String(post.scheduledAtJstString || formatToJstString(post.scheduledAt)),
        text: String(post.text || ''),
        blueskyText: post.blueskyText ? String(post.blueskyText) : undefined,
        threadsText: post.threadsText ? String(post.threadsText) : undefined,
        images: Array.isArray(post.images) ? post.images : [],
        postToBluesky: Boolean(post.postToBluesky),
        postToThreads: Boolean(post.postToThreads),
        threadsTopic: post.threadsTopic ? String(post.threadsTopic) : undefined,
        autoSplit: Boolean(post.autoSplit),
        includeNumbering: Boolean(post.includeNumbering),
        status: post.status === 'completed' || post.status === 'failed' || post.status === 'cancelled' ? post.status : 'pending',
        isDemo: Boolean(post.isDemo),
        lastError: post.lastError ? String(post.lastError) : undefined,
      }));

    // スニペットデータの抽出と整形
    const rawSnippets = Array.isArray(data.snippets) ? data.snippets : [];
    const validSnippets: SnippetItem[] = rawSnippets
      .filter((s: any) => s && typeof s === 'object' && s.id && s.title && s.content)
      .map((s: any) => ({
        id: String(s.id),
        title: String(s.title),
        content: String(s.content),
        blueskyContent: s.blueskyContent ? String(s.blueskyContent) : undefined,
        threadsContent: s.threadsContent ? String(s.threadsContent) : undefined,
        threadsTopic: s.threadsTopic ? String(s.threadsTopic) : undefined,
        category: s.category || 'custom',
        categoryName: s.categoryName ? String(s.categoryName) : undefined,
        icon: s.icon ? String(s.icon) : '📑',
        createdAt: Number(s.createdAt || Date.now()),
        updatedAt: Number(s.updatedAt || Date.now()),
        useCount: Number(s.useCount || 0),
        isPreset: Boolean(s.isPreset),
      }));

    if (validHistory.length === 0 && validScheduled.length === 0 && validSnippets.length === 0) {
      return {
        success: false,
        history: [],
        scheduledPosts: [],
        snippets: [],
        error: '有効な投稿履歴、予約データ、または定型文が見つかりませんでした。',
      };
    }

    return {
      success: true,
      history: validHistory,
      scheduledPosts: validScheduled,
      snippets: validSnippets,
      stats: {
        historyCount: validHistory.length,
        scheduledCount: validScheduled.length,
        snippetCount: validSnippets.length,
        exportedAtJst: data.exportedAtJst,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      history: [],
      scheduledPosts: [],
      error: `JSONファイルの解析に失敗しました: ${err?.message || '構文エラー'}`,
    };
  }
}
