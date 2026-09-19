/**
 * Threads トピックタグ (Topic Tags) のローカルストレージ永続化管理
 */

export const DEFAULT_THREADS_TOPICS = [
  'テクノロジー',
  '写真',
  '日常',
  '個人開発',
  'カフェ',
  'AI',
  'ブログ',
  'ライフハック',
];

const STORAGE_KEY = 'crosspost_threads_saved_topics_v1';

/**
 * 保存されたトピック候補を取得（初期値がない場合はデフォルトを設定）
 */
export function getSavedThreadsTopics(): string[] {
  if (typeof window === 'undefined') return DEFAULT_THREADS_TOPICS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_THREADS_TOPICS));
      return DEFAULT_THREADS_TOPICS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((t) => String(t).trim().replace(/^#+/, '')).filter(Boolean);
    }
    return DEFAULT_THREADS_TOPICS;
  } catch (e) {
    console.error('Failed to load saved threads topics from localStorage:', e);
    return DEFAULT_THREADS_TOPICS;
  }
}

/**
 * 新しいトピックを候補に追加・保存
 */
export function addSavedThreadsTopic(topic: string): string[] {
  const clean = topic.trim().replace(/^#+/, '');
  if (!clean) return getSavedThreadsTopics();

  const current = getSavedThreadsTopics();
  // すでに存在していれば順序を先頭に更新
  const filtered = current.filter((t) => t.toLowerCase() !== clean.toLowerCase());
  const updated = [clean, ...filtered];

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crosspost_topics_updated'));
    }
  } catch (e) {
    console.error('Failed to save threads topic to localStorage:', e);
  }
  return updated;
}

/**
 * 複数トピックを一括追加
 */
export function addMultipleThreadsTopics(topics: string[]): string[] {
  const current = getSavedThreadsTopics();
  const set = new Set(current.map((t) => t.toLowerCase()));
  const newItems: string[] = [];

  for (const raw of topics) {
    const clean = raw.trim().replace(/^#+/, '');
    if (clean && !set.has(clean.toLowerCase())) {
      set.add(clean.toLowerCase());
      newItems.push(clean);
    }
  }

  if (newItems.length === 0) return current;
  const updated = [...newItems, ...current];

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crosspost_topics_updated'));
    }
  } catch (e) {
    console.error('Failed to save threads topics to localStorage:', e);
  }
  return updated;
}

/**
 * 候補からトピックを削除
 */
export function removeSavedThreadsTopic(topicToRemove: string): string[] {
  const clean = topicToRemove.trim().replace(/^#+/, '');
  const current = getSavedThreadsTopics();
  const updated = current.filter((t) => t.toLowerCase() !== clean.toLowerCase());

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crosspost_topics_updated'));
    }
  } catch (e) {
    console.error('Failed to remove threads topic from localStorage:', e);
  }
  return updated;
}

/**
 * トピック候補リストを上書き保存
 */
export function saveThreadsTopicsList(topics: string[]): string[] {
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const t of topics) {
    const clean = t.trim().replace(/^#+/, '');
    if (clean && !seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase());
      cleaned.push(clean);
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crosspost_topics_updated'));
    }
  } catch (e) {
    console.error('Failed to save threads topics list:', e);
  }
  return cleaned;
}

/**
 * 候補を初期デフォルト状態にリセット
 */
export function resetSavedThreadsTopics(): string[] {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_THREADS_TOPICS));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crosspost_topics_updated'));
    }
  } catch (e) {
    console.error('Failed to reset threads topics in localStorage:', e);
  }
  return DEFAULT_THREADS_TOPICS;
}

/**
 * 全てのトピックを消去
 */
export function clearAllThreadsTopics(): string[] {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crosspost_topics_updated'));
    }
  } catch (e) {
    console.error('Failed to clear threads topics in localStorage:', e);
  }
  return [];
}
