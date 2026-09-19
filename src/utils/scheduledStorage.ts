import { ScheduledPostItem, QuickTimePreset } from '../types';
import { getCalculatedQuickPresets } from './presetStorage';

const STORAGE_KEY = 'crosspost_scheduled_posts';

/**
 * 日本時間 (JST: UTC+9) での現在時刻 Date オブジェクトまたは文字列を取得
 */
export function getJstNow(): Date {
  const now = new Date();
  // JST offset is UTC+9
  return now;
}

/**
 * タイムスタンプ(ms)を日本時間（JST）のフォーマット文字列に変換
 * 例: "2026/09/08 12:30 JST"
 */
export function formatToJstString(timestamp: number, withSeconds = false): string {
  const date = new Date(timestamp);
  
  // Intl.DateTimeFormat を使用してタイムゾーン Asia/Tokyo で厳密にフォーマット
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };

  if (withSeconds) {
    options.second = '2-digit';
  }

  const formatter = new Intl.DateTimeFormat('ja-JP', options);
  return `${formatter.format(date)} JST`;
}

/**
 * 過去の様々な形式（ISO文字列、タイムスタンプ数値、日付文字列など）の履歴日時を
 * 統一された日本時間 (JST) 表記に変換
 */
export function formatHistoryTimestampJst(raw: string | number | undefined): string {
  if (!raw) return '';
  const str = String(raw).trim();

  if (str.endsWith('JST') || str.endsWith('JST-9')) return str;

  const num = Number(str);
  if (!isNaN(num) && num > 100000000000) {
    return formatToJstString(num, true);
  }

  const parsedDate = new Date(str);
  if (!isNaN(parsedDate.getTime())) {
    return (
      new Intl.DateTimeFormat('ja-JP', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(parsedDate) + ' JST'
    );
  }

  return `${str} JST`;
}

/**
 * 日時ピッカー（<input type="datetime-local">）用のJST初期値文字列 (YYYY-MM-DDTHH:mm) を生成
 */
export function getJstDatetimeLocalValue(timestamp: number): string {
  const date = new Date(timestamp);
  // Asia/Tokyo での年月日・時分を取得
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  let year = '';
  let month = '';
  let day = '';
  let hour = '';
  let minute = '';

  for (const p of parts) {
    if (p.type === 'year') year = p.value;
    if (p.type === 'month') month = p.value;
    if (p.type === 'day') day = p.value;
    if (p.type === 'hour') hour = p.value;
    if (p.type === 'minute') minute = p.value;
  }

  return `${year}-${month}-${day}T${hour}:${minute}`;
}

/**
 * JSTの日時文字列 (YYYY-MM-DDTHH:mm) を正確なUNIXタイムスタンプ (ms) に変換
 * 日本標準時 (UTC+09:00) として解釈
 */
export function parseJstDatetimeLocal(datetimeLocalStr: string): number {
  if (!datetimeLocalStr) return Date.now();
  // "YYYY-MM-DDTHH:mm" -> "YYYY-MM-DDTHH:mm:00+09:00"
  const isoWithJst = `${datetimeLocalStr}:00+09:00`;
  const parsed = new Date(isoWithJst).getTime();
  return isNaN(parsed) ? Date.now() : parsed;
}

/**
 * 残り時間の相対表示（例: "あと 25 分", "あと 2 時間 10 分", "予定時刻を過ぎています"）
 */
export function getRelativeTimeJst(targetTimestamp: number): {
  text: string;
  isPast: boolean;
  isSoon: boolean; // 5分以内
} {
  const diff = targetTimestamp - Date.now();
  if (diff <= 0) {
    return { text: '予定時刻に到達（実行中または待機中）', isPast: true, isSoon: true };
  }

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let text = '';
  if (days > 0) {
    text = `あと ${days} 日 ${hours % 24} 時間`;
  } else if (hours > 0) {
    text = `あと ${hours} 時間 ${minutes % 60} 分`;
  } else if (minutes > 0) {
    text = `あと ${minutes} 分`;
  } else {
    const seconds = Math.floor(diff / 1000);
    text = `あと ${seconds} 秒`;
  }

  return {
    text,
    isPast: false,
    isSoon: diff <= 5 * 60 * 1000,
  };
}

/**
 * 日本時間クイック予約プリセットを取得（設定済みのプリセットから現在時刻に合わせて計算）
 * 現在時刻（JST）よりも過去または同時の場合は翌日に設定
 */
export function getJstQuickPresets(customPresets?: QuickTimePreset[]): {
  id?: string;
  label: string;
  timeLabel: string;
  dateLabel: string;
  timestamp: number;
  jstDisplay: string;
  isTomorrow: boolean;
}[] {
  return getCalculatedQuickPresets(customPresets);
}

/**
 * 予約投稿リストの読み込み
 */
export function loadScheduledPostsFromStorage(): ScheduledPostItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // 過去データの画像・動画サムネイルの補完・正規化処理
      const repaired = parsed.map((item) => {
        if (!item || !Array.isArray(item.images)) return item;
        return {
          ...item,
          images: item.images.map((img: any) => {
            if (!img || typeof img !== 'object') return img;
            const isVideo =
              img.mediaType === 'video' ||
              Boolean(img.mimeType?.startsWith('video/')) ||
              Boolean(img.name && /\.(mp4|mov|webm|m4v|mkv|avi)$/i.test(img.name));
            const thumb = img.thumbnailUrl || img.dataUrl || '';
            return {
              ...img,
              mediaType: isVideo ? 'video' : (img.mediaType || 'image'),
              thumbnailUrl: thumb,
              dataUrl: img.dataUrl || thumb,
            };
          }),
        };
      });
      return repaired.sort((a, b) => a.scheduledAt - b.scheduledAt);
    }
  } catch (e) {
    console.error('Failed to load scheduled posts:', e);
  }
  return [];
}

/**
 * 予約投稿保存用に画像・動画Base64を軽量化するヘルパー
 * （サムネイルthumbnailUrlは必ず維持し、リストやカレンダーで確実に表示できるようにする）
 */
export function sanitizeScheduledPostForStorage(item: ScheduledPostItem): ScheduledPostItem {
  return {
    ...item,
    images: (item.images || []).map((img) => {
      const isVideo =
        img.mediaType === 'video' ||
        Boolean(img.mimeType?.startsWith('video/')) ||
        Boolean(img.name && /\.(mp4|mov|webm|m4v|mkv|avi)$/i.test(img.name));
      // サムネイルURLを確実に確保（thumbnailUrlがあればそれ、なければdataUrl）
      const thumb = img.thumbnailUrl || img.dataUrl || '';
      // dataUrl: 動画の場合は巨大Base64を避けサムネイル、画像の場合はdataUrlまたはthumb
      const effectiveDataUrl = isVideo ? (img.thumbnailUrl || '') : (img.dataUrl || thumb);

      return {
        id: img.id,
        mediaId: img.mediaId,
        name: img.name,
        size: img.size,
        dataUrl: effectiveDataUrl,
        thumbnailUrl: thumb,
        mediaType: isVideo ? 'video' : 'image',
        mimeType: img.mimeType,
        duration: img.duration,
        width: img.width,
        height: img.height,
        alt: img.alt,
      };
    }),
  };
}

/**
 * 予約投稿リストの保存
 */
export function saveScheduledPostsToStorage(items: ScheduledPostItem[]): void {
  try {
    const safeItems = items.map(sanitizeScheduledPostForStorage);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeItems));
  } catch (e) {
    console.warn('LocalStorage quota warning for scheduled posts, saving compact thumbnails:', e);
    try {
      // 容量制限に達した場合は、画像本体dataUrlを軽量サムネイル(約2KB)に縮小して安全に保持
      const ultraCompactItems = items.map((item) => ({
        ...sanitizeScheduledPostForStorage(item),
        images: (item.images || []).map((img) => ({
          ...img,
          dataUrl: img.thumbnailUrl || '',
          thumbnailUrl: img.thumbnailUrl || '',
        })),
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ultraCompactItems));
    } catch (innerErr) {
      console.error('Failed to save scheduled posts to storage:', innerErr);
    }
  }
}

/**
 * 新規予約投稿の追加
 */
export function addScheduledPost(post: Omit<ScheduledPostItem, 'id' | 'createdAt' | 'status' | 'scheduledAtJstString'>): ScheduledPostItem {
  const items = loadScheduledPostsFromStorage();
  // サムネイルが未設定の画像があればdataUrlをthumbnailUrlとして補完
  const normalizedImages = (post.images || []).map((img) => ({
    ...img,
    thumbnailUrl: img.thumbnailUrl || img.dataUrl || '',
  }));

  const newItem: ScheduledPostItem = {
    ...post,
    images: normalizedImages,
    id: `sched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    scheduledAtJstString: formatToJstString(post.scheduledAt),
    status: 'pending',
  };

  items.push(newItem);
  items.sort((a, b) => a.scheduledAt - b.scheduledAt);
  saveScheduledPostsToStorage(items);
  return newItem;
}

/**
 * 予約投稿の更新
 */
export function updateScheduledPost(id: string, updates: Partial<ScheduledPostItem>): ScheduledPostItem[] {
  const items = loadScheduledPostsFromStorage();
  const index = items.findIndex((item) => item.id === id);
  if (index !== -1) {
    items[index] = {
      ...items[index],
      ...updates,
      ...(updates.scheduledAt ? { scheduledAtJstString: formatToJstString(updates.scheduledAt) } : {}),
    };
    items.sort((a, b) => a.scheduledAt - b.scheduledAt);
    saveScheduledPostsToStorage(items);
  }
  return items;
}

/**
 * 予約投稿のキャンセルまたは削除
 */
export function deleteScheduledPost(id: string): ScheduledPostItem[] {
  const items = loadScheduledPostsFromStorage();
  const filtered = items.filter((item) => item.id !== id);
  saveScheduledPostsToStorage(filtered);
  return filtered;
}

/**
 * 実行待機中の予約投稿を取得（現在時刻を過ぎた pending アイテム）
 */
export function getPendingDueScheduledPosts(): ScheduledPostItem[] {
  const items = loadScheduledPostsFromStorage();
  const now = Date.now();
  return items.filter((item) => item.status === 'pending' && item.scheduledAt <= now);
}

/**
 * 全ての予約投稿をクリア・削除（実用モードへの切り替え時などに使用）
 */
export function clearAllScheduledPosts(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear scheduled posts:', e);
  }
}
