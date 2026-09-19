import { ScheduledPostItem, ApiCredentials, PostHistoryItem } from '../types';
import { sendBlueskyPost, sendThreadsPost, checkIsDemoCredentials } from './postApi';
import { splitForBluesky, splitForThreads } from './textSplitter';
import {
  updateScheduledPost,
  formatToJstString,
} from './scheduledStorage';
import { saveHistoryToStorage, loadHistoryFromStorage } from './historyStorage';

/**
 * 期限到来の予約投稿を1件実行する
 */
export async function executeScheduledPostItem(
  item: ScheduledPostItem,
  credentials: ApiCredentials,
  onNotify?: (result: {
    success: boolean;
    item: ScheduledPostItem;
    message: string;
  }) => void
): Promise<boolean> {
  // ステータスを posting に更新
  updateScheduledPost(item.id, { status: 'posting' });

  const { blueskyIsDemo, threadsIsDemo } = checkIsDemoCredentials(credentials);
  const isDemo =
    (item.postToBluesky && blueskyIsDemo) || (item.postToThreads && threadsIsDemo);

  const bskyText = (item.customPlatformText && item.blueskyText) ? item.blueskyText : item.text;
  const thrText = (item.customPlatformText && item.threadsText) ? item.threadsText : item.text;

  const bskySplits = splitForBluesky(bskyText, item.includeNumbering, item.images, item.autoSplit);
  const threadsSplits = splitForThreads(thrText, item.includeNumbering, item.images, item.autoSplit);

  const bskyPosts = bskySplits.map((s) => s.text);
  const thrPosts = threadsSplits.map((s) => s.text);

  let blueskySuccess = false;
  let threadsSuccess = false;
  let bskyUrls: string[] = [];
  let thrUrls: string[] = [];
  let errorMsg = '';

  try {
    // 1. Bluesky 投稿
    if (item.postToBluesky) {
      const bskyRes = await sendBlueskyPost(credentials, bskyPosts, item.images);
      if (bskyRes.success) {
        blueskySuccess = true;
        bskyUrls = bskyRes.urls || [];
      } else {
        errorMsg += `[Bluesky] ${bskyRes.error || '投稿エラー'} `;
      }
    }

    // 2. Threads 投稿
    if (item.postToThreads) {
      const thrRes = await sendThreadsPost(credentials, thrPosts, item.images, item.threadsTopic);
      if (thrRes.success) {
        threadsSuccess = true;
        thrUrls = thrRes.urls || [];
      } else {
        errorMsg += `[Threads] ${thrRes.error || '投稿エラー'} `;
      }
    }

    const overallSuccess =
      (!item.postToBluesky || blueskySuccess) && (!item.postToThreads || threadsSuccess);

    // 予約ステータス更新
    updateScheduledPost(item.id, {
      status: overallSuccess ? 'completed' : 'failed',
      error: overallSuccess ? undefined : errorMsg.trim(),
      executedAt: Date.now(),
      resultUrls: {
        bluesky: bskyUrls,
        threads: thrUrls,
      },
    });

    // 履歴に追加
    const platforms: ('Bluesky' | 'Threads')[] = [];
    if (item.postToBluesky) platforms.push('Bluesky');
    if (item.postToThreads) platforms.push('Threads');

    const imageItems = (item.images || []).filter(
      (img) => img.mediaType !== 'video' && !img.mimeType?.startsWith('video/')
    );
    const videoItems = (item.images || []).filter(
      (img) => img.mediaType === 'video' || Boolean(img.mimeType?.startsWith('video/'))
    );

    const historyItem: PostHistoryItem = {
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: formatToJstString(Date.now()),
      originalText: item.text,
      platforms,
      blueskyPosts: bskyPosts,
      threadsPosts: thrPosts,
      threadsTopic: item.threadsTopic,
      images: (item.images || []).map((img, idx) =>
        img.name || (img.mediaType === 'video' ? `video_${idx + 1}` : `image_${idx + 1}`)
      ),
      imageCount: imageItems.length,
      videoCount: videoItems.length,
      attachedImages: item.images,
      status: overallSuccess ? 'success' : blueskySuccess || threadsSuccess ? 'partial' : 'failed',
      blueskySuccess,
      threadsSuccess,
      blueskyUrls: bskyUrls,
      threadsUrls: thrUrls,
      isDemo,
      errorMessage: overallSuccess ? undefined : `[予約投稿エラー] ${errorMsg}`,
    };

    const currentHistory = loadHistoryFromStorage();
    saveHistoryToStorage([historyItem, ...currentHistory]);

    if (onNotify) {
      onNotify({
        success: overallSuccess,
        item,
        message: overallSuccess
          ? `⏰ 【日本時間 ${item.scheduledAtJstString}】に予約されていた投稿を正常に完了しました！`
          : `⚠️ 予約投稿の実行中にエラーが発生しました: ${errorMsg}`,
      });
    }

    return overallSuccess;
  } catch (err: any) {
    const message = err?.message || '不明なエラー';
    updateScheduledPost(item.id, {
      status: 'failed',
      error: message,
      executedAt: Date.now(),
    });

    if (onNotify) {
      onNotify({
        success: false,
        item,
        message: `⚠️ 予約投稿の実行に失敗しました: ${message}`,
      });
    }
    return false;
  }
}
