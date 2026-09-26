import { saveTagsTopicsToServerVaultAsync } from './tagTopicStorage';

/**
 * 投稿テキストを解析し、関連するトピック・トレンドハッシュタグを提案するユーティリティ
 */

export interface SuggestedHashtag {
  tag: string;
  category: string;
  reason?: string;
  isTrending?: boolean;
}

export interface TopicCategory {
  name: string;
  icon: string;
  tags: string[];
}

// 人気・トレンドカテゴリ定義
export const POPULAR_TOPIC_CATEGORIES: TopicCategory[] = [
  {
    name: 'SNS・クロス投稿',
    icon: '🌐',
    tags: ['Bluesky', 'Threads', 'クロス投稿', 'SNS運用', 'Bluesky日本語', 'スレッド投稿'],
  },
  {
    name: 'エンジニア・開発',
    icon: '💻',
    tags: ['個人開発', 'エンジニア', 'プログラミング', 'React', 'TypeScript', 'Web開発', 'プログラミング学習', '駆け出しエンジニアと繋がりたい', 'Tech', 'GitHub'],
  },
  {
    name: 'AI・テクノロジー',
    icon: '🤖',
    tags: ['AI', '生成AI', 'Gemini', 'ChatGPT', 'LLM', 'AI活用', 'テクノロジー', 'DX'],
  },
  {
    name: '日常・カフェ・ライフ',
    icon: '☕',
    tags: ['日常', 'カフェ巡り', '休日の過ごし方', 'コーヒー', 'ランチ', 'おうちごはん', '散歩', '日々の暮らし'],
  },
  {
    name: 'クリエイティブ・写真',
    icon: '📷',
    tags: ['写真好きな人と繋がりたい', 'カメラのある生活', 'デザイン', 'UIUX', 'イラスト', 'アート', '創作'],
  },
  {
    name: 'ビジネス・発信',
    icon: '📈',
    tags: ['ビジネス', 'マーケティング', '副業', '働き方', 'スタートアップ', '生産性向上', 'ライフハック'],
  },
];

// 単語とハッシュタグのマッピング辞書（ルールベース＆トピック推定）
const KEYWORD_TAG_MAP: { keywords: string[]; tags: { tag: string; category: string; reason: string }[] }[] = [
  {
    keywords: ['アプリ', '開発', '個人開発', 'リリース', 'web', 'サービス', 'コード', 'プログラミング', 'typescript', 'react', 'javascript', 'python', 'github', 'バグ', 'デプロイ'],
    tags: [
      { tag: '個人開発', category: '開発', reason: '開発・プログラミングに関する言及' },
      { tag: 'エンジニア', category: '開発', reason: '技術・エンジニアリング関連' },
      { tag: 'Web開発', category: '開発', reason: 'Web技術・アプリ制作' },
      { tag: 'TypeScript', category: '開発', reason: 'フロントエンド・開発言語' },
      { tag: 'プログラミング', category: '開発', reason: 'ソフトウェア開発' },
    ],
  },
  {
    keywords: ['bluesky', 'threads', 'sns', '投稿', 'フォロワー', 'ツイート', 'ポスト', 'スレッド', 'クロス投稿', 'アカウント'],
    tags: [
      { tag: 'Bluesky', category: 'SNS', reason: 'Blueskyに関連する話題' },
      { tag: 'Threads', category: 'SNS', reason: 'Threadsに関連する話題' },
      { tag: 'クロス投稿', category: 'SNS', reason: '複数SNSへの同時配信' },
      { tag: 'Bluesky日本語', category: 'SNS', reason: '国内コミュニティ向け' },
    ],
  },
  {
    keywords: ['ai', '人工知能', 'gemini', 'chatgpt', 'openai', 'llm', '機械学習', 'プロンプト', 'モデル', '生成ai'],
    tags: [
      { tag: 'AI', category: 'AI', reason: '人工知能・AI技術' },
      { tag: '生成AI', category: 'AI', reason: '最新のジェネレーティブAI' },
      { tag: 'ChatGPT', category: 'AI', reason: 'AIモデル・チャットBot' },
      { tag: 'Gemini', category: 'AI', reason: 'Google Gemini' },
      { tag: 'AI活用', category: 'AI', reason: '業務・開発でのAI実践' },
    ],
  },
  {
    keywords: ['カフェ', 'コーヒー', '珈琲', '喫茶店', 'スタバ', 'ラテ', 'カフェラテ', 'スイーツ', 'ケーキ', 'お茶'],
    tags: [
      { tag: 'カフェ巡り', category: 'カフェ', reason: 'カフェ・喫茶店の話題' },
      { tag: 'コーヒー', category: 'カフェ', reason: '珈琲・ブレイクタイム' },
      { tag: '休日の過ごし方', category: '日常', reason: 'リフレッシュ・週末ログ' },
    ],
  },
  {
    keywords: ['写真', 'カメラ', '撮影', '一眼', 'スナップ', '景色', '風景', 'ポートレート', 'フィルム', 'photo'],
    tags: [
      { tag: '写真好きな人と繋がりたい', category: '写真', reason: '写真・カメラ関連の投稿' },
      { tag: 'カメラのある生活', category: '写真', reason: 'フォトグラフィー・スナップ' },
      { tag: 'ファインダー越しの私の世界', category: '写真', reason: '写真コミュニティ' },
    ],
  },
  {
    keywords: ['デザイン', 'ui', 'ux', 'figma', 'イラスト', 'クリエイター', 'アート', '色彩', 'グラフィック'],
    tags: [
      { tag: 'デザイン', category: 'デザイン', reason: 'デザイン・ビジュアル関連' },
      { tag: 'UIUX', category: 'デザイン', reason: 'UI/UX・インターフェース' },
      { tag: 'クリエイター', category: 'クリエイティブ', reason: 'ものづくり・クリエイティブ' },
    ],
  },
  {
    keywords: ['朝', '夜', '休日', '週末', '日常', '散歩', '生活', '今日', '天気', 'お出かけ', 'ごはん', 'ランチ', 'ディナー'],
    tags: [
      { tag: '日常', category: '日常', reason: '日々の出来事・日記' },
      { tag: '日々の暮らし', category: '日常', reason: 'ライフスタイル' },
      { tag: '休日の過ごし方', category: '日常', reason: '週末・リフレッシュ' },
    ],
  },
  {
    keywords: ['仕事', 'ビジネス', '副業', '働き方', 'ミーティング', 'タスク', '生産性', '勉強', '読書', '効率化'],
    tags: [
      { tag: 'ビジネス', category: 'ビジネス', reason: '仕事・ワークスタイル' },
      { tag: '生産性向上', category: 'ビジネス', reason: 'タイムマネジメント・効率化' },
      { tag: 'ライフハック', category: 'ビジネス', reason: '知恵・ライフハック' },
      { tag: '働き方', category: 'ビジネス', reason: 'キャリア・ワークスタイル' },
    ],
  },
  {
    keywords: ['ゲーム', 'アニメ', '漫画', '映画', '読書', '小説', '音楽', 'ライブ', 'フェス'],
    tags: [
      { tag: 'エンタメ', category: 'エンタメ', reason: '趣味・カルチャー' },
      { tag: '読書記録', category: 'エンタメ', reason: '本・読書ログ' },
      { tag: 'アニメ好きと繋がりたい', category: 'エンタメ', reason: 'アニメ・コンテンツ' },
    ],
  },
];

/**
 * 投稿テキストから既に含まれているハッシュタグを抽出
 */
export function extractExistingHashtags(text: string): string[] {
  if (!text) return [];
  const regex = /(?:^|\s)#([\p{L}\p{N}_]+)/gu;
  const matches = Array.from(text.matchAll(regex));
  return matches.map((m) => m[1]);
}

/**
 * テキストから日本語のカタカナ語や英単語、キーワードを抽出
 */
function extractDynamicKeywords(text: string): string[] {
  const words: string[] = [];

  // カタカナ連続語（3文字以上）
  const katakana = text.match(/[\u30A1-\u30FA\u30FC]{3,}/g);
  if (katakana) words.push(...katakana);

  // アルファベット単語（2文字以上）
  const alpha = text.match(/[a-zA-Z]{2,}/g);
  if (alpha) words.push(...alpha);

  // 漢字熟語（2〜4文字）
  const kanji = text.match(/[\u4E00-\u9FFF]{2,4}/g);
  if (kanji) words.push(...kanji);

  return Array.from(new Set(words));
}

/**
 * 投稿テキストの内容を解析し、最適なハッシュタグ候補を提案
 */
export function suggestHashtags(text: string): SuggestedHashtag[] {
  if (!text || text.trim().length === 0) {
    // テキストが空の場合は定番のSNS用ハッシュタグをデフォルト提案
    return [
      { tag: 'Bluesky', category: 'SNS', reason: 'Bluesky定番タグ', isTrending: true },
      { tag: 'Threads', category: 'SNS', reason: 'Threads定番タグ', isTrending: true },
      { tag: 'クロス投稿', category: 'SNS', reason: '同時投稿' },
      { tag: '日常', category: '日常', reason: '日常の投稿' },
      { tag: '個人開発', category: '開発', reason: '開発・制作ログ' },
    ];
  }

  const existingTags = new Set(extractExistingHashtags(text).map((t) => t.toLowerCase()));
  const lowerText = text.toLowerCase();
  const suggestions: SuggestedHashtag[] = [];
  const addedTags = new Set<string>();

  // 1. マッピング辞書とのマッチング
  for (const group of KEYWORD_TAG_MAP) {
    const matchedCount = group.keywords.filter((kw) => lowerText.includes(kw.toLowerCase())).length;
    if (matchedCount > 0) {
      for (const item of group.tags) {
        if (!existingTags.has(item.tag.toLowerCase()) && !addedTags.has(item.tag.toLowerCase())) {
          suggestions.push({
            tag: item.tag,
            category: item.category,
            reason: item.reason,
            isTrending: matchedCount >= 2,
          });
          addedTags.add(item.tag.toLowerCase());
        }
      }
    }
  }

  // 2. 動的キーワードからのハッシュタグ候補生成（文中の特徴的な単語）
  const dynamicWords = extractDynamicKeywords(text);
  for (const word of dynamicWords) {
    // 既に類似タグがないかチェック
    const isSpecial = ['今日', 'こと', 'もの', 'これ', 'それ', 'あれ', 'ため', 'よう'].includes(word);
    if (!isSpecial && word.length >= 2 && word.length <= 15) {
      if (!existingTags.has(word.toLowerCase()) && !addedTags.has(word.toLowerCase())) {
        // 一般的・魅力的なキーワードなら提案に追加
        suggestions.push({
          tag: word,
          category: '本文から抽出',
          reason: `本文内の注目キーワード「${word}」`,
        });
        addedTags.add(word.toLowerCase());
      }
    }
  }

  // 3. SNS基本タグ（まだ無ければ補完）
  if (lowerText.includes('bluesky') && !existingTags.has('bluesky') && !addedTags.has('bluesky')) {
    suggestions.unshift({ tag: 'Bluesky', category: 'SNS', reason: 'Blueskyの言及' });
  }
  if (lowerText.includes('threads') && !existingTags.has('threads') && !addedTags.has('threads')) {
    suggestions.unshift({ tag: 'Threads', category: 'SNS', reason: 'Threadsの言及' });
  }

  // 最大10件程度に絞り込み
  return suggestions.slice(0, 10);
}

/**
 * テキストの末尾にハッシュタグを追加するヘルパー
 */
export function appendHashtagToText(currentText: string, tag: string): string {
  const cleanTag = tag.replace(/^#/, '').trim();
  if (!cleanTag) return currentText;

  // 既に含まれているか確認
  const existing = extractExistingHashtags(currentText);
  if (existing.some((t) => t.toLowerCase() === cleanTag.toLowerCase())) {
    return currentText; // すでに存在する場合はそのまま
  }

  const formattedTag = `#${cleanTag}`;

  if (!currentText.trim()) {
    return formattedTag;
  }

  // 末尾が改行で終わっているか確認
  if (currentText.endsWith('\n')) {
    return `${currentText}${formattedTag} `;
  } else if (currentText.endsWith(' ')) {
    return `${currentText}${formattedTag} `;
  } else {
    // 文章の末尾に空白を入れてタグを挿入
    return `${currentText} ${formattedTag} `;
  }
}

/**
 * 複数のハッシュタグを一括でテキスト末尾に追加
 */
export function appendMultipleHashtagsToText(currentText: string, tags: string[]): string {
  let result = currentText;
  for (const tag of tags) {
    result = appendHashtagToText(result, tag);
  }
  return result;
}

/**
 * テキストから特定のハッシュタグを削除（取り消し）するヘルパー
 */
export function removeHashtagFromText(currentText: string, tag: string): string {
  const cleanTag = tag.replace(/^#/, '').trim();
  if (!cleanTag || !currentText) return currentText;

  // 大文字小文字を区別せず、ハッシュタグを安全に削除
  const escaped = cleanTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(^|\\s)#${escaped}(?=[\\s\\n$]|$)`, 'gui');

  let updated = currentText.replace(regex, (_, prefix) => {
    return prefix && prefix.includes('\n') ? '\n' : '';
  });

  // 各行内の余計な連続スペースを整理
  updated = updated
    .split('\n')
    .map((line) => line.replace(/[ \t]{2,}/g, ' ').trimEnd())
    .join('\n');

  // 全体の不要な末尾空白を整理
  if (!updated.trim()) {
    return '';
  }

  return updated;
}

/**
 * ハッシュタグの追加と削除（トグル）を行うヘルパー
 */
export function toggleHashtagInText(currentText: string, tag: string): { text: string; isAdded: boolean } {
  const cleanTag = tag.replace(/^#/, '').trim();
  const existing = extractExistingHashtags(currentText);
  const exists = existing.some((t) => t.toLowerCase() === cleanTag.toLowerCase());

  if (exists) {
    return {
      text: removeHashtagFromText(currentText, cleanTag),
      isAdded: false,
    };
  } else {
    return {
      text: appendHashtagToText(currentText, cleanTag),
      isAdded: true,
    };
  }
}

// ユーザー独自の「オリジナル」カテゴリー保存用ストレージキー
export const CUSTOM_TAGS_STORAGE_KEY = 'cross_poster_custom_original_tags';

export const DEFAULT_CUSTOM_TAGS = [
  '日常',
  'つぶやき',
  '個人開発',
  'エンジニア',
  'テック',
  'AI',
  'Webデザイン',
  '読書記録',
];

/**
 * 保存されたオリジナルタグの一覧を取得
 */
export function getSavedCustomTags(): string[] {
  if (typeof window === 'undefined') return DEFAULT_CUSTOM_TAGS;
  try {
    const raw = localStorage.getItem(CUSTOM_TAGS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(DEFAULT_CUSTOM_TAGS));
      return DEFAULT_CUSTOM_TAGS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((t) => typeof t === 'string' && t.trim().length > 0);
    }
  } catch (e) {
    console.error('Failed to load custom tags:', e);
  }
  return DEFAULT_CUSTOM_TAGS;
}

/**
 * オリジナルカテゴリーに新しいタグを追加・保存
 */
export function saveCustomTag(tag: string): string[] {
  const clean = tag.replace(/^#/, '').trim();
  if (!clean) return getSavedCustomTags();
  const current = getSavedCustomTags();
  // 重複チェック（大文字小文字問わず）
  const exists = current.some((t) => t.toLowerCase() === clean.toLowerCase());
  const updated = exists ? current : [clean, ...current];
  try {
    localStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crosspost_tags_updated'));
      saveTagsTopicsToServerVaultAsync();
    }
  } catch (e) {
    console.error('Failed to save custom tag:', e);
  }
  return updated;
}

/**
 * 複数のタグを一括追加
 */
export function addMultipleCustomTags(tags: string[]): string[] {
  const current = getSavedCustomTags();
  const set = new Set(current.map((t) => t.toLowerCase()));
  const newItems: string[] = [];
  for (const raw of tags) {
    const clean = raw.replace(/^#/, '').trim();
    if (clean && !set.has(clean.toLowerCase())) {
      set.add(clean.toLowerCase());
      newItems.push(clean);
    }
  }
  if (newItems.length === 0) return current;
  const updated = [...newItems, ...current];
  try {
    localStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crosspost_tags_updated'));
      saveTagsTopicsToServerVaultAsync();
    }
  } catch (e) {
    console.error('Failed to save multiple custom tags:', e);
  }
  return updated;
}

/**
 * オリジナルカテゴリーからタグを削除
 */
export function removeCustomTag(tag: string): string[] {
  const clean = tag.replace(/^#/, '').trim();
  const current = getSavedCustomTags();
  const updated = current.filter((t) => t.toLowerCase() !== clean.toLowerCase());
  try {
    localStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crosspost_tags_updated'));
      saveTagsTopicsToServerVaultAsync();
    }
  } catch (e) {
    console.error('Failed to remove custom tag:', e);
  }
  return updated;
}

/**
 * カスタムタグ一覧を上書き保存
 */
export function saveCustomTagsList(tags: string[]): string[] {
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const t of tags) {
    const clean = t.replace(/^#/, '').trim();
    if (clean && !seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase());
      cleaned.push(clean);
    }
  }
  try {
    localStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(cleaned));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crosspost_tags_updated'));
      saveTagsTopicsToServerVaultAsync();
    }
  } catch (e) {
    console.error('Failed to save custom tags list:', e);
  }
  return cleaned;
}

/**
 * カスタムタグを初期状態にリセット
 */
export function resetCustomTags(): string[] {
  try {
    localStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(DEFAULT_CUSTOM_TAGS));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crosspost_tags_updated'));
      saveTagsTopicsToServerVaultAsync();
    }
  } catch (e) {
    console.error('Failed to reset custom tags:', e);
  }
  return DEFAULT_CUSTOM_TAGS;
}

/**
 * すべてのカスタムタグを消去
 */
export function clearAllCustomTags(): string[] {
  try {
    localStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify([]));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crosspost_tags_updated'));
      saveTagsTopicsToServerVaultAsync();
    }
  } catch (e) {
    console.error('Failed to clear custom tags:', e);
  }
  return [];
}

export const CATEGORIES_STORAGE_KEY = 'cross_poster_custom_categories_v1';

/**
 * 保存済みのトレンド・カテゴリ一覧を取得（未保存時はデフォルト定義を返却）
 */
export function getSavedCategories(): TopicCategory[] {
  if (typeof window === 'undefined') return POPULAR_TOPIC_CATEGORIES;
  try {
    const raw = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (!raw) return POPULAR_TOPIC_CATEGORIES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
        .map((cat: any) => ({
          name: String(cat.name || '').trim(),
          icon: String(cat.icon || '🏷️'),
          tags: Array.isArray(cat.tags)
            ? cat.tags.map((t: any) => String(t).replace(/^#+/, '').trim()).filter(Boolean)
            : [],
        }))
        .filter((c: TopicCategory) => c.name.length > 0);
    }
  } catch (e) {
    console.error('Failed to parse saved categories:', e);
  }
  return POPULAR_TOPIC_CATEGORIES;
}

/**
 * カテゴリ一覧を保存し、アプリ全体にイベント通知
 */
export function saveCategoriesList(categories: TopicCategory[]): TopicCategory[] {
  try {
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crosspost_categories_updated'));
      saveTagsTopicsToServerVaultAsync();
    }
  } catch (e) {
    console.error('Failed to save categories list:', e);
  }
  return categories;
}

/**
 * 新しいカテゴリを追加
 */
export function addCategory(name: string, icon: string = '🏷️', initialTags: string[] = []): TopicCategory[] {
  const current = getSavedCategories();
  const cleanName = name.trim();
  if (!cleanName) return current;
  if (current.some((c) => c.name.toLowerCase() === cleanName.toLowerCase())) {
    return current;
  }
  const cleanTags = initialTags
    .map((t) => t.replace(/^#+/, '').trim())
    .filter(Boolean);
  const updated = [...current, { name: cleanName, icon: icon.trim() || '🏷️', tags: cleanTags }];
  return saveCategoriesList(updated);
}

/**
 * カテゴリの名称やアイコンを更新
 */
export function updateCategory(oldName: string, updatedInfo: { name: string; icon: string }): TopicCategory[] {
  const current = getSavedCategories();
  const cleanNewName = updatedInfo.name.trim();
  if (!cleanNewName) return current;

  const updated = current.map((c) => {
    if (c.name.toLowerCase() === oldName.toLowerCase()) {
      return {
        ...c,
        name: cleanNewName,
        icon: updatedInfo.icon.trim() || c.icon,
      };
    }
    return c;
  });
  return saveCategoriesList(updated);
}

/**
 * カテゴリを削除
 */
export function removeCategory(name: string): TopicCategory[] {
  const current = getSavedCategories();
  const updated = current.filter((c) => c.name.toLowerCase() !== name.toLowerCase());
  return saveCategoriesList(updated);
}

/**
 * カテゴリの並び順を移動
 */
export function reorderCategories(fromIndex: number, toIndex: number): TopicCategory[] {
  const current = [...getSavedCategories()];
  if (fromIndex < 0 || fromIndex >= current.length || toIndex < 0 || toIndex >= current.length) {
    return current;
  }
  const [moved] = current.splice(fromIndex, 1);
  current.splice(toIndex, 0, moved);
  return saveCategoriesList(current);
}

/**
 * 特定カテゴリに単一のハッシュタグを追加
 */
export function addTagToCategory(categoryName: string, tag: string): TopicCategory[] {
  const cleanTag = tag.replace(/^#+/, '').trim();
  if (!cleanTag) return getSavedCategories();
  return addMultipleTagsToCategory(categoryName, [cleanTag]);
}

/**
 * 特定カテゴリに複数のハッシュタグを一括追加
 */
export function addMultipleTagsToCategory(categoryName: string, tags: string[]): TopicCategory[] {
  const current = getSavedCategories();
  const cleanTags = tags
    .map((t) => t.replace(/^#+/, '').trim())
    .filter(Boolean);
  if (cleanTags.length === 0) return current;

  const updated = current.map((cat) => {
    if (cat.name.toLowerCase() === categoryName.toLowerCase()) {
      const existing = new Set(cat.tags.map((t) => t.toLowerCase()));
      const toAdd = cleanTags.filter((t) => !existing.has(t.toLowerCase()));
      return {
        ...cat,
        tags: [...cat.tags, ...toAdd],
      };
    }
    return cat;
  });
  return saveCategoriesList(updated);
}

/**
 * 特定カテゴリからハッシュタグを削除
 */
export function removeTagFromCategory(categoryName: string, tagToRemove: string): TopicCategory[] {
  const current = getSavedCategories();
  const cleanTag = tagToRemove.replace(/^#+/, '').trim().toLowerCase();
  const updated = current.map((cat) => {
    if (cat.name.toLowerCase() === categoryName.toLowerCase()) {
      return {
        ...cat,
        tags: cat.tags.filter((t) => t.toLowerCase() !== cleanTag),
      };
    }
    return cat;
  });
  return saveCategoriesList(updated);
}

/**
 * カテゴリ一覧を初期デフォルトに戻す
 */
export function resetCategoriesToDefault(): TopicCategory[] {
  try {
    localStorage.removeItem(CATEGORIES_STORAGE_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crosspost_categories_updated'));
    }
  } catch (e) {
    console.error('Failed to reset categories:', e);
  }
  return POPULAR_TOPIC_CATEGORIES;
}
