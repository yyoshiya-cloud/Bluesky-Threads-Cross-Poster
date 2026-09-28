import { PostHistoryItem, ScheduledPostItem, SnippetItem } from '../types';
import { formatToJstString, formatHistoryTimestampJst } from './scheduledStorage';
import { loadSnippetsFromStorage, saveSnippetsToStorage } from './snippetStorage';
import {
  getSavedCustomTags,
  saveCustomTagsList,
  TopicCategory,
  getSavedCategories,
  saveCategoriesList,
} from './hashtagSuggester';
import { getSavedThreadsTopics, saveThreadsTopicsList } from './topicStorage';

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

/**
  * 5. ハッシュタグ・Threadsトピック・トレンドカテゴリ・定型文のバックアップデータ構造
  */
export interface CustomTagsAndSnippetsBackupData {
  version: string;
  exportedAt: number;
  exportedAtJst: string;
  app: string;
  dataType: 'crosspost_tags_and_templates';
  customHashtags: string[];
  threadsTopics: string[];
  categories: TopicCategory[];
  snippets: SnippetItem[];
  metadata?: {
    totalCustomHashtagsCount: number;
    totalThreadsTopicsCount: number;
    totalCategoriesCount: number;
    totalCategoryTagsCount: number;
    totalSnippetsCount: number;
  };
}

/**
  * 登録ハッシュタグ、Threadsトピック、トレンド・カテゴリ、定型文をまとめてJSONファイルとしてダウンロード
  */
export function exportTagsAndSnippetsJson(): void {
  const now = Date.now();
  const customHashtags = getSavedCustomTags();
  const threadsTopics = getSavedThreadsTopics();
  const categories = getSavedCategories();
  const snippets = loadSnippetsFromStorage();

  const totalCategoryTags = categories.reduce((sum, cat) => sum + (cat.tags?.length || 0), 0);

  const backupData: CustomTagsAndSnippetsBackupData = {
    version: '1.0.0',
    exportedAt: now,
    exportedAtJst: formatToJstString(now),
    app: 'CrossPost Web Studio',
    dataType: 'crosspost_tags_and_templates',
    customHashtags: customHashtags || [],
    threadsTopics: threadsTopics || [],
    categories: categories || [],
    snippets: snippets || [],
    metadata: {
      totalCustomHashtagsCount: customHashtags?.length || 0,
      totalThreadsTopicsCount: threadsTopics?.length || 0,
      totalCategoriesCount: categories?.length || 0,
      totalCategoryTagsCount: totalCategoryTags,
      totalSnippetsCount: snippets?.length || 0,
    },
  };

  const jsonContent = JSON.stringify(backupData, null, 2);
  const filename = `crosspost_tags_templates_${getFilenameTimestamp()}.json`;
  downloadFile(jsonContent, filename, 'application/json;charset=utf-8;');
}

/**
  * 6. アップロードされたハッシュタグ・トピック・定型文JSONファイルのパース & 検証
  */
export interface ParseTagsAndSnippetsResult {
  success: boolean;
  customHashtags: string[];
  threadsTopics: string[];
  categories: TopicCategory[];
  snippets: SnippetItem[];
  error?: string;
  stats?: {
    customHashtagsCount: number;
    threadsTopicsCount: number;
    categoriesCount: number;
    categoryTagsCount: number;
    snippetsCount: number;
    exportedAtJst?: string;
  };
}

export function parseAndValidateTagsAndSnippetsJson(jsonString: string): ParseTagsAndSnippetsResult {
  try {
    const data = JSON.parse(jsonString);

    if (!data || typeof data !== 'object') {
      return {
        success: false,
        customHashtags: [],
        threadsTopics: [],
        categories: [],
        snippets: [],
        error: 'JSONの形式が無効です。',
      };
    }

    // 1. お気に入りハッシュタグの抽出と整形
    const rawHashtags = Array.isArray(data.customHashtags)
      ? data.customHashtags
      : Array.isArray(data.customTags)
      ? data.customTags
      : [];
    const validHashtags: string[] = rawHashtags
      .map((t: any) => String(t || '').replace(/^#+/, '').trim())
      .filter(Boolean);

    // 2. Threads専用トピックタグの抽出と整形
    const rawTopics = Array.isArray(data.threadsTopics)
      ? data.threadsTopics
      : Array.isArray(data.savedTopics)
      ? data.savedTopics
      : [];
    const validTopics: string[] = rawTopics
      .map((t: any) => String(t || '').replace(/^#+/, '').trim())
      .filter(Boolean);

    // 3. トレンド・カテゴリの抽出と整形
    const rawCategories = Array.isArray(data.categories) ? data.categories : [];
    const validCategories: TopicCategory[] = rawCategories
      .filter((cat: any) => cat && typeof cat === 'object' && cat.name)
      .map((cat: any) => ({
        name: String(cat.name).trim(),
        icon: String(cat.icon || '🏷️').trim() || '🏷️',
        tags: Array.isArray(cat.tags)
          ? cat.tags.map((t: any) => String(t || '').replace(/^#+/, '').trim()).filter(Boolean)
          : [],
      }))
      .filter((c) => c.name.length > 0);

    // 4. 定型文（スニペット）の抽出と整形
    const rawSnippets = Array.isArray(data.snippets)
      ? data.snippets
      : Array.isArray(data.templates)
      ? data.templates
      : [];
    const validSnippets: SnippetItem[] = rawSnippets
      .filter((s: any) => s && typeof s === 'object' && (s.title || s.content))
      .map((s: any) => ({
        id: String(s.id || `snippet-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`),
        title: String(s.title || '無題の定型文'),
        content: String(s.content || ''),
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

    const totalCategoryTags = validCategories.reduce((sum, c) => sum + c.tags.length, 0);

    if (
      validHashtags.length === 0 &&
      validTopics.length === 0 &&
      validCategories.length === 0 &&
      validSnippets.length === 0
    ) {
      return {
        success: false,
        customHashtags: [],
        threadsTopics: [],
        categories: [],
        snippets: [],
        error: 'ファイル内に有効なハッシュタグ、トピック、カテゴリ、または定型文データが見つかりませんでした。',
      };
    }

    return {
      success: true,
      customHashtags: validHashtags,
      threadsTopics: validTopics,
      categories: validCategories,
      snippets: validSnippets,
      stats: {
        customHashtagsCount: validHashtags.length,
        threadsTopicsCount: validTopics.length,
        categoriesCount: validCategories.length,
        categoryTagsCount: totalCategoryTags,
        snippetsCount: validSnippets.length,
        exportedAtJst: data.exportedAtJst,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      customHashtags: [],
      threadsTopics: [],
      categories: [],
      snippets: [],
      error: `JSONファイルの解析に失敗しました: ${err?.message || '構文エラー'}`,
    };
  }
}

/**
  * 7. 読み込んだハッシュタグ・トピック・カテゴリ・定型文をブラウザストレージに適用（追加マージ または 完全上書き）
  */
export interface ApplyTagsAndSnippetsOptions {
  mode: 'merge' | 'overwrite'; // 'merge': 既存データを残して追加, 'overwrite': ファイル内容で完全上書き
}

export function applyTagsAndSnippetsData(
  data: {
    customHashtags: string[];
    threadsTopics: string[];
    categories: TopicCategory[];
    snippets: SnippetItem[];
  },
  options: ApplyTagsAndSnippetsOptions
): {
  addedHashtagsCount: number;
  addedTopicsCount: number;
  addedCategoriesCount: number;
  addedSnippetsCount: number;
} {
  const { mode } = options;

  let addedHashtagsCount = 0;
  let addedTopicsCount = 0;
  let addedCategoriesCount = 0;
  let addedSnippetsCount = 0;

  // 1. お気に入りハッシュタグの適用
  if (data.customHashtags && data.customHashtags.length > 0) {
    if (mode === 'overwrite') {
      saveCustomTagsList(data.customHashtags);
      addedHashtagsCount = data.customHashtags.length;
    } else {
      const current = getSavedCustomTags();
      const existingSet = new Set(current.map((t) => t.toLowerCase()));
      const toAdd = data.customHashtags.filter((t) => !existingSet.has(t.toLowerCase()));
      if (toAdd.length > 0) {
        saveCustomTagsList([...current, ...toAdd]);
        addedHashtagsCount = toAdd.length;
      }
    }
  }

  // 2. Threads専用トピックタグの適用
  if (data.threadsTopics && data.threadsTopics.length > 0) {
    if (mode === 'overwrite') {
      saveThreadsTopicsList(data.threadsTopics);
      addedTopicsCount = data.threadsTopics.length;
    } else {
      const current = getSavedThreadsTopics();
      const existingSet = new Set(current.map((t) => t.toLowerCase()));
      const toAdd = data.threadsTopics.filter((t) => !existingSet.has(t.toLowerCase()));
      if (toAdd.length > 0) {
        saveThreadsTopicsList([...current, ...toAdd]);
        addedTopicsCount = toAdd.length;
      }
    }
  }

  // 3. トレンド・カテゴリの適用
  if (data.categories && data.categories.length > 0) {
    if (mode === 'overwrite') {
      saveCategoriesList(data.categories);
      addedCategoriesCount = data.categories.length;
    } else {
      const current = getSavedCategories();
      const currentCatMap = new Map(current.map((c) => [c.name.toLowerCase(), { ...c, tags: [...c.tags] }]));

      let newCatCount = 0;
      for (const importedCat of data.categories) {
        const key = importedCat.name.toLowerCase();
        if (currentCatMap.has(key)) {
          // 既存カテゴリが存在する場合はタグをマージ
          const existingCat = currentCatMap.get(key)!;
          const tagSet = new Set(existingCat.tags.map((t) => t.toLowerCase()));
          for (const t of importedCat.tags) {
            if (!tagSet.has(t.toLowerCase())) {
              existingCat.tags.push(t);
              tagSet.add(t.toLowerCase());
            }
          }
          if (importedCat.icon && importedCat.icon !== '🏷️' && existingCat.icon === '🏷️') {
            existingCat.icon = importedCat.icon;
          }
        } else {
          // 新規カテゴリを追加
          currentCatMap.set(key, { ...importedCat, tags: [...importedCat.tags] });
          newCatCount++;
        }
      }
      const mergedCategories = Array.from(currentCatMap.values());
      saveCategoriesList(mergedCategories);
      addedCategoriesCount = newCatCount;
    }
  }

  // 4. 定型文（スニペット）の適用
  if (data.snippets && data.snippets.length > 0) {
    if (mode === 'overwrite') {
      saveSnippetsToStorage(data.snippets);
      addedSnippetsCount = data.snippets.length;
    } else {
      const current = loadSnippetsFromStorage();
      const currentTitleMap = new Set(current.map((s) => s.title.trim().toLowerCase()));
      const currentIdMap = new Set(current.map((s) => s.id));

      const toAdd: SnippetItem[] = [];
      for (const item of data.snippets) {
        // 重複判定（タイトルかIDが一致するか）
        if (!currentTitleMap.has(item.title.trim().toLowerCase()) && !currentIdMap.has(item.id)) {
          toAdd.push(item);
          currentTitleMap.add(item.title.trim().toLowerCase());
          currentIdMap.add(item.id);
        }
      }

      if (toAdd.length > 0) {
        saveSnippetsToStorage([...current, ...toAdd]);
        addedSnippetsCount = toAdd.length;
      }
    }
  }

  return {
    addedHashtagsCount,
    addedTopicsCount,
    addedCategoriesCount,
    addedSnippetsCount,
  };
}
