/**
 * ハッシュタグおよびThreads専用トピックのサーバー永続同期ヘルパー
 * （リロード・デプロイ時も保存されたカスタムタグ・トピックを完全維持）
 */

import { getSavedThreadsTopics } from './topicStorage';
import { getSavedCustomTags, getSavedCategories, CUSTOM_TAGS_STORAGE_KEY, CATEGORIES_STORAGE_KEY } from './hashtagSuggester';

const THREADS_TOPICS_KEY = 'crosspost_threads_saved_topics_v1';

/**
 * 現在のハッシュタグ・トピック情報をサーバーファイル（data/user_tags_topics.json）へ永続保存
 */
export async function saveTagsTopicsToServerVaultAsync(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const threadsTopics = getSavedThreadsTopics();
    const customTags = getSavedCustomTags();
    const categories = getSavedCategories();

    await fetch('/api/tags-topics/vault', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        threadsTopics,
        customTags,
        categories,
        savedAt: Date.now(),
      }),
    });
  } catch (e) {
    console.warn('[TagTopicStorage] Failed to persist tags/topics to server vault:', e);
  }
}

/**
 * サーバーファイルストレージからハッシュタグ・トピック情報を同期・復元
 */
export async function syncTagsTopicsWithServerAsync(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch('/api/tags-topics/vault');
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));

    if (data.success && data.vault && typeof data.vault === 'object') {
      const { threadsTopics, customTags, categories } = data.vault;
      let hasServerData = false;

      if (Array.isArray(threadsTopics) && threadsTopics.length > 0) {
        localStorage.setItem(THREADS_TOPICS_KEY, JSON.stringify(threadsTopics));
        window.dispatchEvent(new CustomEvent('crosspost_topics_updated'));
        hasServerData = true;
      }

      if (Array.isArray(customTags) && customTags.length > 0) {
        localStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(customTags));
        window.dispatchEvent(new CustomEvent('crosspost_tags_updated'));
        hasServerData = true;
      }

      if (Array.isArray(categories) && categories.length > 0) {
        localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
        window.dispatchEvent(new CustomEvent('crosspost_categories_updated'));
        hasServerData = true;
      }

      // サーバーにデータがまだなければローカルのデータをバックアップ
      if (!hasServerData) {
        await saveTagsTopicsToServerVaultAsync();
      }
    }
  } catch (e) {
    console.warn('[TagTopicStorage] Failed to sync tags/topics from server vault:', e);
  }
}
