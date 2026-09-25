import { PostHistoryItem } from '../types';
import { getPostMediaCounts } from './mediaValidation';
import { generateSimulatedEngagement } from './engagementApi';

export const HISTORY_STORAGE_KEY = 'cross_poster_history';
export const MAX_HISTORY_COUNT = 30;

/**
 * 履歴アイテムから容量を圧迫するbase64画像・動画データを取り除き、軽量な識別子に置換
 */
export function sanitizeHistoryItem(item: PostHistoryItem): PostHistoryItem {
  const mediaCounts = getPostMediaCounts(item);

  // エンゲージメント情報が未設定の場合はシミュレーション値を自動補完
  let blueskyEng = item.blueskyEngagement;
  let threadsEng = item.threadsEngagement;
  if (!blueskyEng || !threadsEng) {
    const sim = generateSimulatedEngagement(item);
    blueskyEng = blueskyEng || sim.bluesky;
    threadsEng = threadsEng || sim.threads;
  }

  return {
    ...item,
    imageCount: mediaCounts.imageCount,
    videoCount: mediaCounts.videoCount,
    blueskyEngagement: blueskyEng,
    threadsEngagement: threadsEng,
    engagementUpdatedAt: item.engagementUpdatedAt || Date.now(),
    // base64の巨大な画像データ(data:image/...)は保存せず、軽量な参照用トークンに置換
    images: (item.images || []).map((img, idx) => {
      if (typeof img === 'string' && img.startsWith('data:')) {
        const isVid = img.startsWith('data:video/');
        return isVid ? `video_${idx + 1}` : `image_${idx + 1}`;
      }
      return img || `media_${idx + 1}`;
    }),
    // 添付メディアオブジェクトからも巨大な動画・画像Base64を排除し、サムネイルまたは軽量メタデータのみ保持
    attachedImages: (item.attachedImages || []).map((img) => ({
      id: img.id,
      name: img.name,
      size: img.size,
      mediaType:
        img.mediaType ||
        (img.mimeType?.startsWith('video/') || img.dataUrl?.startsWith('data:video')
          ? 'video'
          : 'image'),
      mimeType: img.mimeType,
      duration: img.duration,
      width: img.width,
      height: img.height,
      alt: img.alt || '',
      // dataUrlには動画本体(数MB〜数十MB)を保存せず、軽量なサムネイルを保持
      dataUrl: img.thumbnailUrl || img.dataUrl || '',
      thumbnailUrl: img.thumbnailUrl || img.dataUrl || '',
    })),
  };
}

/**
 * LocalStorageから投稿履歴を安全に読み込み
 * （過去の投稿で巨大なbase64が含まれている場合は自動クリーンアップして容量を解放）
 */
export function loadHistoryFromStorage(): PostHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    let hasBloatedData = false;
    const sanitizedList: PostHistoryItem[] = [];

    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const images = item.images || [];
      const hasBase64 = images.some((img: any) => typeof img === 'string' && img.startsWith('data:'));
      if (hasBase64) {
        hasBloatedData = true;
      }
      sanitizedList.push(sanitizeHistoryItem(item));
    }

    // 過去の保存データにbase64画像が含まれていた場合、即座に軽量版で上書きしてストレージ容量を解放
    if (hasBloatedData) {
      saveHistoryToStorage(sanitizedList);
    }

    return sanitizedList.slice(0, MAX_HISTORY_COUNT);
  } catch (err) {
    console.error('Failed to load history from localStorage:', err);
    return [];
  }
}

/**
 * 投稿履歴をLocalStorageに安全に保存
 * - base64画像の排除
 * - 最大件数の制限
 * - QuotaExceededError発生時の自動削減フォールバック
 */
export function saveHistoryToStorage(items: PostHistoryItem[]): void {
  try {
    // 1. 各アイテムをサニタイズ（画像base64を排除）し最大件数に切り詰め
    const sanitized = items.slice(0, MAX_HISTORY_COUNT).map(sanitizeHistoryItem);
    const serialized = JSON.stringify(sanitized);

    localStorage.setItem(HISTORY_STORAGE_KEY, serialized);
  } catch (err: any) {
    console.warn('LocalStorage quota warning for cross_poster_history:', err);

    // 容量上限エラー（QuotaExceededError）時の段階的リカバリ
    try {
      // リカバリ1: 直近15件に縮小
      const smallerList = items.slice(0, 15).map(sanitizeHistoryItem);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(smallerList));
    } catch (innerErr1) {
      try {
        // リカバリ2: 直近5件、かつテキストのみに軽量化
        const minimalList = items.slice(0, 5).map((item) => ({
          ...sanitizeHistoryItem(item),
          blueskyPosts: [],
          threadsPosts: [],
          images: [],
        }));
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(minimalList));
      } catch (innerErr2) {
        console.error('Failed to save even minimal history to localStorage:', innerErr2);
      }
    }
  }
}

/**
 * 投稿履歴をLocalStorageから削除
 */
export function clearHistoryFromStorage(): void {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch (err) {
    console.error('Failed to clear history from localStorage:', err);
  }
}

/**
 * 投稿履歴からDEMOモードで作成されたアイテムやシミュレーションキャッシュを完全に除去
 */
export function cleanupDemoHistoryFromStorage(): { cleaned: PostHistoryItem[]; removedCount: number } {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return { cleaned: [], removedCount: 0 };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return { cleaned: [], removedCount: 0 };

    const cleaned: PostHistoryItem[] = [];
    let removedCount = 0;

    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const isDemo = Boolean(
        item.isDemo ||
        (Array.isArray(item.blueskyUrls) && item.blueskyUrls.some((u: string) => typeof u === 'string' && (u.includes('demo-creator') || u.includes('/post/demo-')))) ||
        (Array.isArray(item.threadsUrls) && item.threadsUrls.some((u: string) => typeof u === 'string' && (u.includes('threads_user_demo') || u.includes('demo')))) ||
        (Array.isArray(item.threadsMediaIds) && item.threadsMediaIds.some((id: string) => typeof id === 'string' && id.includes('demo'))) ||
        (Array.isArray(item.blueskyPostUris) && item.blueskyPostUris.some((uri: string) => typeof uri === 'string' && uri.includes('demo'))) ||
        item.replySettings?.threadsResolved?.isDemoSkipped ||
        (item.replySettings?.threadsResolved?.resolvedId && String(item.replySettings.threadsResolved.resolvedId).toLowerCase().includes('demo'))
      );

      if (isDemo) {
        removedCount++;
      } else {
        cleaned.push(sanitizeHistoryItem(item));
      }
    }

    if (removedCount > 0) {
      saveHistoryToStorage(cleaned);
    }

    return { cleaned, removedCount };
  } catch (err) {
    console.error('Failed to cleanup demo history from storage:', err);
    return { cleaned: [], removedCount: 0 };
  }
}

