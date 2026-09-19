import { SnippetItem } from '../types';

const SNIPPETS_STORAGE_KEY = 'crosspost_snippets_v1';

export const DEFAULT_SNIPPETS: SnippetItem[] = [
  {
    id: 'preset-morning',
    title: '☀️ 朝の挨拶・今日の予定',
    content: `おはようございます！☀️\n今日も一日頑張りましょう！\n\n【本日のタスク】\n・\n・\n\n#今日の積み上げ #おはよう`,
    category: 'greeting',
    categoryName: '挨拶',
    icon: '☀️',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    useCount: 0,
    isPreset: true,
  },
  {
    id: 'preset-blog-post',
    title: '📝 新着ブログ記事・技術記事の告知',
    content: `【ブログ更新】新しい記事を公開しました！📝\n\n『記事タイトルを入力』\n\n記事のポイントや見どころをここに記入します。\n👇 ぜひご一読ください！\nhttps://example.com/blog/article`,
    blueskyContent: `【ブログ更新】『記事タイトル』を公開しました！📝\n\n要約ポイント:\n・要点1\n・要点2\n\n詳細はこちら👇\nhttps://example.com/blog/article\n#tech #blog`,
    threadsContent: `新しい記事をブログにアップしました！✨\n\n今回は『記事タイトル』について詳しく解説しています。\nぜひチェックしてみてくださいね！👇\nhttps://example.com/blog/article`,
    threadsTopic: 'ブログ更新',
    category: 'blog',
    categoryName: 'ブログ告知',
    icon: '📝',
    createdAt: 1700000001000,
    updatedAt: 1700000001000,
    useCount: 0,
    isPreset: true,
  },
  {
    id: 'preset-dev-release',
    title: '🚀 プロダクトリリース・アップデート報告',
    content: `🚀 アップデートのお知らせ\n\n本日、新機能をリリースしました！\n\n✨ アップデート内容:\n・機能Aの追加\n・UI/UXの改善\n・パフォーマンス向上\n\nフィードバックや感想お待ちしています！\n#release #update`,
    category: 'dev',
    categoryName: '開発・リリース',
    icon: '🚀',
    createdAt: 1700000002000,
    updatedAt: 1700000002000,
    useCount: 0,
    isPreset: true,
  },
  {
    id: 'preset-event',
    title: '📢 イベント・登壇・勉強会の告知',
    content: `📢 イベント登壇のお知らせ！\n\n『イベント名』にて登壇します。\n\n🗓️ 日時: \n📍 形式: オンライン / 現地\n💡 テーマ: \n\n参加登録はこちらから👇\nhttps://example.com/event`,
    category: 'announcement',
    categoryName: '告知・イベント',
    icon: '📢',
    createdAt: 1700000003000,
    updatedAt: 1700000003000,
    useCount: 0,
    isPreset: true,
  },
  {
    id: 'preset-signature',
    title: '🏷️ 定番ハッシュタグ・リンクフッター',
    content: `\n\n---\n🌐 ポートフォリオ: https://example.com\n#Bluesky #Threads #クロスポスト`,
    category: 'signature',
    categoryName: '署名・フッター',
    icon: '🏷️',
    createdAt: 1700000004000,
    updatedAt: 1700000004000,
    useCount: 0,
    isPreset: true,
  },
];

/**
 * LocalStorage からスニペット一覧を読み込む
 */
export function loadSnippetsFromStorage(): SnippetItem[] {
  try {
    const raw = localStorage.getItem(SNIPPETS_STORAGE_KEY);
    if (!raw) {
      saveSnippetsToStorage(DEFAULT_SNIPPETS);
      return DEFAULT_SNIPPETS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_SNIPPETS;
  } catch (err) {
    console.warn('[snippetStorage] Failed to load snippets from localStorage:', err);
    return DEFAULT_SNIPPETS;
  }
}

/**
 * 外部互換用エイリアス
 */
export const getSavedSnippets = loadSnippetsFromStorage;

/**
 * スニペット一覧を LocalStorage に保存する
 */
export function saveSnippetsToStorage(snippets: SnippetItem[]): void {
  try {
    localStorage.setItem(SNIPPETS_STORAGE_KEY, JSON.stringify(snippets));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crosspost_snippets_updated', { detail: snippets }));
    }
  } catch (err) {
    console.error('[snippetStorage] Failed to save snippets to localStorage:', err);
  }
}

/**
 * 単一のスニペットを新規作成または更新する
 */
export function saveSnippet(
  data: {
    title: string;
    content: string;
    category: SnippetItem['category'];
    categoryName?: string;
    icon?: string;
    blueskyContent?: string;
    threadsContent?: string;
    threadsTopic?: string;
  },
  editId?: string
): SnippetItem[] {
  const current = loadSnippetsFromStorage();
  const now = Date.now();

  let updated: SnippetItem[];
  if (editId) {
    updated = current.map((item) => {
      if (item.id === editId) {
        return {
          ...item,
          ...data,
          updatedAt: now,
        };
      }
      return item;
    });
  } else {
    const newSnippet: SnippetItem = {
      id: `snippet-${now}-${Math.random().toString(36).substring(2, 7)}`,
      ...data,
      createdAt: now,
      updatedAt: now,
      useCount: 0,
      isPreset: false,
    };
    updated = [newSnippet, ...current];
  }

  saveSnippetsToStorage(updated);
  return updated;
}

/**
 * スニペットを削除する
 */
export function deleteSnippet(id: string): SnippetItem[] {
  const current = loadSnippetsFromStorage();
  const updated = current.filter((item) => item.id !== id);
  saveSnippetsToStorage(updated);
  return updated;
}

/**
 * 初期プリセットにリセットする
 */
export function resetSnippetsToDefault(): SnippetItem[] {
  saveSnippetsToStorage(DEFAULT_SNIPPETS);
  return DEFAULT_SNIPPETS;
}
