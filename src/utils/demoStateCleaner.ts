/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ReplySettings, DraftData, PostHistoryItem, ScheduledPostItem } from '../types';
import {
  cleanupDemoScheduledPostsFromStorage,
  loadScheduledPostsFromStorage,
} from './scheduledStorage';
import {
  cleanupDemoHistoryFromStorage,
  loadHistoryFromStorage,
} from './historyStorage';
import { cleanupDemoCommLogsFromStorage } from './commErrorLogger';
import { clearDraftFromStorage, loadDraftFromStorage } from './draftStorage';
import { cleanupOldMediaBlobs } from './indexedMediaStorage';

export interface CleanupResult {
  timestamp: number;
  reason: 'startup' | 'switch_to_live' | 'credentials_update' | 'manual';
  scheduledPostsRemoved: number;
  historyItemsRemoved: number;
  commLogsRemoved: number;
  draftCleared: boolean;
  replySettingsReset: boolean;
  mediaCleaned: boolean;
}

export const CLEAN_REPLY_SETTINGS: ReplySettings = {
  enabled: false,
  blueskyTargetUrl: '',
  threadsTargetUrl: '',
  blueskyResolved: null,
  threadsResolved: null,
};

/**
 * リプライ設定（ReplySettings）がDEMOモードのシミュレーション値や残留ステートを含んでいるかを厳密に判定
 */
export function isDemoReplyState(reply?: ReplySettings | null): boolean {
  if (!reply) return false;

  // 1. Threads解決結果のデモ判定
  const th = reply.threadsResolved;
  if (th) {
    if (th.isDemoSkipped === true) return true;
    const resId = String(th.resolvedId || '').toLowerCase();
    if (resId.includes('demo') || resId.includes('simulat')) return true;
    const author = String(th.authorName || th.authorHandle || '').toLowerCase();
    if (author.includes('demo') || author === 'demo_threads_official') return true;
  }

  // 2. Bluesky解決結果のデモ判定
  const bsky = reply.blueskyResolved;
  if (bsky) {
    const resId = String(bsky.resolvedId || bsky.rootUri || bsky.urlOrId || '').toLowerCase();
    const cid = String(bsky.cid || '').toLowerCase();
    if (resId.includes('demo') || cid.includes('demo')) return true;
    const handle = String(bsky.authorHandle || bsky.authorName || '').toLowerCase();
    if (handle.includes('demo') || handle === 'demo-creator.bsky.social') return true;
  }

  // 3. 対象URL文字列のデモ判定
  const bTarget = String(reply.blueskyTargetUrl || '').toLowerCase();
  const tTarget = String(reply.threadsTargetUrl || '').toLowerCase();
  if (bTarget.includes('demo-creator') || bTarget.includes('/post/demo-')) return true;
  if (tTarget.includes('threads_user_demo') || tTarget.includes('demo_threads')) return true;

  return false;
}

/**
 * DEMOモードの痕跡がある下書きデータを判定
 */
export function isDemoDraftData(draft: DraftData | null): boolean {
  if (!draft) return false;
  if (isDemoReplyState(draft.replySettings)) return true;
  return false;
}

/**
 * アプリ起動時、またはLIVE（本番）モード切り替え時に
 * 古いDEMOモードのキャッシュデータおよび残留ステートを一括自動クリーンアップ
 *
 * @param options.isLiveMode 現在または切り替え先がLIVEモードかどうか
 * @param options.reason クリーンアップ実行契機
 * @param options.forceHistoryClean 履歴内のDEMO投稿も強制クリアするかどうか (LIVEモード時は常にtrue推奨)
 */
export async function performCleanStateInitialization(options: {
  isLiveMode: boolean;
  reason?: 'startup' | 'switch_to_live' | 'credentials_update' | 'manual';
  forceHistoryClean?: boolean;
}): Promise<CleanupResult> {
  const reason = options.reason || (options.isLiveMode ? 'switch_to_live' : 'startup');
  const shouldCleanHistory = options.isLiveMode || options.forceHistoryClean === true;

  let scheduledPostsRemoved = 0;
  let historyItemsRemoved = 0;
  let commLogsRemoved = 0;
  let draftCleared = false;
  let replySettingsReset = false;
  let mediaCleaned = false;

  try {
    // 1. 予約投稿（Scheduled Posts）内のDEMOキャッシュ・シミュレーション予約を完全除去
    const schedResult = cleanupDemoScheduledPostsFromStorage();
    scheduledPostsRemoved = schedResult.removedCount;

    // 2. 履歴（History）内のDEMO投稿・シミュレーションエンゲージメントを除去
    if (shouldCleanHistory) {
      const histResult = cleanupDemoHistoryFromStorage();
      historyItemsRemoved = histResult.removedCount;
    }

    // 3. 通信エラーログ（Communication Logs）内のDEMO試行・ダミーログを除去
    const logResult = cleanupDemoCommLogsFromStorage();
    commLogsRemoved = logResult.removedCount;

    // 4. 下書き（Draft）およびリプライ設定内のDEMO残留ステートをクリーンアップ
    const existingDraft = loadDraftFromStorage();
    if (isDemoDraftData(existingDraft) || reason === 'startup' || options.isLiveMode) {
      clearDraftFromStorage();
      draftCleared = true;
      replySettingsReset = true;
    }

    // 5. IndexedDB内の孤立・期限切れメディアBlobを非同期クリーンアップ
    try {
      await cleanupOldMediaBlobs();
      mediaCleaned = true;
    } catch (e) {
      console.warn('[performCleanStateInitialization] Media cleanup warning:', e);
    }
  } catch (err) {
    console.error('[performCleanStateInitialization] Cleanup error:', err);
  }

  const result: CleanupResult = {
    timestamp: Date.now(),
    reason,
    scheduledPostsRemoved,
    historyItemsRemoved,
    commLogsRemoved,
    draftCleared,
    replySettingsReset,
    mediaCleaned,
  };

  return result;
}
