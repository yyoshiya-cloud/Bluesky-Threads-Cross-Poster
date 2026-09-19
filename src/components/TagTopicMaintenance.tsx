import React, { useState, useEffect, useMemo } from 'react';
import {
  Hash,
  Plus,
  Trash2,
  RotateCcw,
  Search,
  Check,
  Sparkles,
  Info,
  X,
  Flame,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Edit2,
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  Layers,
} from 'lucide-react';
import {
  getSavedCustomTags,
  saveCustomTag,
  addMultipleCustomTags,
  removeCustomTag,
  resetCustomTags,
  clearAllCustomTags,
  TopicCategory,
  getSavedCategories,
  saveCategoriesList,
  addCategory,
  updateCategory,
  removeCategory,
  reorderCategories,
  addMultipleTagsToCategory,
  removeTagFromCategory,
  resetCategoriesToDefault,
} from '../utils/hashtagSuggester';
import {
  getSavedThreadsTopics,
  addSavedThreadsTopic,
  addMultipleThreadsTopics,
  removeSavedThreadsTopic,
  resetSavedThreadsTopics,
  clearAllThreadsTopics,
} from '../utils/topicStorage';

interface TagTopicMaintenanceProps {
  onNotify?: (message: string) => void;
}

// カテゴリ作成時のクイック選択用絵文字
const EMOJI_PRESETS = ['🏷️', '🌐', '💻', '🤖', '☕', '📷', '📈', '🎨', '🎵', '🐱', '🍣', '🍜', '🍚', '✈️', '🎮', '📚', '⚾', '💡', '🔥', '🌸'];

export const TagTopicMaintenance: React.FC<TagTopicMaintenanceProps> = ({ onNotify }) => {
  // サブタブ: 'hashtags' (お気に入り) | 'categories' (トレンド・カテゴリ一覧) | 'threads_topics' (Threads専用)
  const [activeSubTab, setActiveSubTab] = useState<'hashtags' | 'categories' | 'threads_topics'>('hashtags');

  // --- お気に入りハッシュタグ状態 ---
  const [customTags, setCustomTags] = useState<string[]>(() => getSavedCustomTags());
  const [hashtagInput, setHashtagInput] = useState('');
  const [hashtagSearch, setHashtagSearch] = useState('');
  const [showCategoryPills, setShowCategoryPills] = useState(false);

  // --- トレンド・カテゴリ一覧状態 ---
  const [categories, setCategories] = useState<TopicCategory[]>(() => getSavedCategories());
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>(() => {
    const cats = getSavedCategories();
    return cats.length > 0 ? cats[0].name : '';
  });
  const [categoryTagInput, setCategoryTagInput] = useState('');
  const [categoryTagSearch, setCategoryTagSearch] = useState('');

  // カテゴリ新規作成状態
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('🏷️');
  const [newCatInitialTags, setNewCatInitialTags] = useState('');

  // カテゴリ編集状態
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [editCatName, setEditCatName] = useState('');
  const [editCatIcon, setEditCatIcon] = useState('');

  // --- Threadsトピック状態 ---
  const [threadsTopics, setThreadsTopics] = useState<string[]>(() => getSavedThreadsTopics());
  const [topicInput, setTopicInput] = useState('');
  const [topicSearch, setTopicSearch] = useState('');

  // アクション通知トースト
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotice(msg);
    if (onNotify) onNotify(msg);
    setTimeout(() => {
      setNotice((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  // 外部からの更新イベントを購読
  useEffect(() => {
    const handleTagsUpdated = () => {
      setCustomTags(getSavedCustomTags());
    };
    const handleCategoriesUpdated = () => {
      const cats = getSavedCategories();
      setCategories(cats);
      // 選択中カテゴリが無くなった場合は先頭を選択
      setSelectedCategoryName((prev) => {
        if (cats.some((c) => c.name === prev)) return prev;
        return cats.length > 0 ? cats[0].name : '';
      });
    };
    const handleTopicsUpdated = () => {
      setThreadsTopics(getSavedThreadsTopics());
    };

    window.addEventListener('crosspost_tags_updated', handleTagsUpdated);
    window.addEventListener('crosspost_categories_updated', handleCategoriesUpdated);
    window.addEventListener('crosspost_topics_updated', handleTopicsUpdated);

    return () => {
      window.removeEventListener('crosspost_tags_updated', handleTagsUpdated);
      window.removeEventListener('crosspost_categories_updated', handleCategoriesUpdated);
      window.removeEventListener('crosspost_topics_updated', handleTopicsUpdated);
    };
  }, []);

  // 現在選択中のカテゴリ
  const currentCategory = useMemo(() => {
    return categories.find((c) => c.name === selectedCategoryName) || categories[0] || null;
  }, [categories, selectedCategoryName]);

  const currentCategoryIndex = useMemo(() => {
    return categories.findIndex((c) => c.name === (currentCategory ? currentCategory.name : ''));
  }, [categories, currentCategory]);

  // --- お気に入りハッシュタグ操作 ---
  const handleAddHashtags = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!hashtagInput.trim()) return;

    const splitTokens = hashtagInput
      .split(/[\s,、\n]+/)
      .map((t) => t.trim().replace(/^#+/, ''))
      .filter(Boolean);

    if (splitTokens.length === 0) return;

    const updated = addMultipleCustomTags(splitTokens);
    setCustomTags(updated);
    setHashtagInput('');
    showNotification(
      splitTokens.length === 1
        ? `ハッシュタグ「#${splitTokens[0]}」を追加しました`
        : `${splitTokens.length}件のハッシュタグを一括追加しました`
    );
  };

  const handleRemoveHashtag = (tag: string) => {
    const updated = removeCustomTag(tag);
    setCustomTags(updated);
    showNotification(`ハッシュタグ「#${tag}」を削除しました`);
  };

  const handleResetHashtags = () => {
    if (window.confirm('お気に入りハッシュタグを初期デフォルト（8件）に戻しますか？')) {
      const updated = resetCustomTags();
      setCustomTags(updated);
      showNotification('ハッシュタグを初期デフォルトにリセットしました');
    }
  };

  const handleClearAllHashtags = () => {
    if (window.confirm('すべてのお気に入りハッシュタグを削除しますか？')) {
      const updated = clearAllCustomTags();
      setCustomTags(updated);
      showNotification('すべてのお気に入りハッシュタグをクリアしました');
    }
  };

  const handleQuickAddHashtagFromCategory = (tag: string) => {
    const clean = tag.replace(/^#+/, '').trim();
    if (!clean) return;
    if (customTags.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      showNotification(`「#${clean}」は既に登録されています`);
      return;
    }
    const updated = saveCustomTag(clean);
    setCustomTags(updated);
    showNotification(`「#${clean}」をお気に入りハッシュタグに追加しました`);
  };

  // --- トレンド・カテゴリ一覧操作 ---
  const handleAddCategoryTag = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentCategory || !categoryTagInput.trim()) return;

    const splitTokens = categoryTagInput
      .split(/[\s,、\n]+/)
      .map((t) => t.trim().replace(/^#+/, ''))
      .filter(Boolean);

    if (splitTokens.length === 0) return;

    const updated = addMultipleTagsToCategory(currentCategory.name, splitTokens);
    setCategories(updated);
    setCategoryTagInput('');
    showNotification(
      splitTokens.length === 1
        ? `カテゴリ「${currentCategory.name}」に「#${splitTokens[0]}」を追加しました`
        : `カテゴリ「${currentCategory.name}」に${splitTokens.length}件のタグを一括追加しました`
    );
  };

  const handleRemoveCategoryTag = (tagToRemove: string) => {
    if (!currentCategory) return;
    const updated = removeTagFromCategory(currentCategory.name, tagToRemove);
    setCategories(updated);
    showNotification(`カテゴリ「${currentCategory.name}」から「#${tagToRemove}」を削除しました`);
  };

  const handleClearAllCategoryTags = () => {
    if (!currentCategory) return;
    if (window.confirm(`カテゴリ「${currentCategory.name}」内のすべてのタグを削除しますか？`)) {
      const updated = categories.map((c) =>
        c.name === currentCategory.name ? { ...c, tags: [] } : c
      );
      saveCategoriesList(updated);
      setCategories(updated);
      showNotification(`カテゴリ「${currentCategory.name}」のタグをすべてクリアしました`);
    }
  };

  // 新規カテゴリ作成
  const handleCreateCategorySubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = newCatName.trim();
    if (!cleanName) return;

    if (categories.some((c) => c.name.toLowerCase() === cleanName.toLowerCase())) {
      showNotification(`カテゴリ名「${cleanName}」は既に存在します`);
      return;
    }

    const initialTags = newCatInitialTags
      .split(/[\s,、\n]+/)
      .map((t) => t.trim().replace(/^#+/, ''))
      .filter(Boolean);

    const updated = addCategory(cleanName, newCatIcon || '🏷️', initialTags);
    setCategories(updated);
    setSelectedCategoryName(cleanName);
    setNewCatName('');
    setNewCatIcon('🏷️');
    setNewCatInitialTags('');
    setIsCreatingCategory(false);
    showNotification(`新しいカテゴリ「${cleanName}」を作成しました`);
  };

  // カテゴリ編集
  const handleStartEditCategory = () => {
    if (!currentCategory) return;
    setEditCatName(currentCategory.name);
    setEditCatIcon(currentCategory.icon);
    setIsEditingCategory(true);
  };

  const handleSaveEditCategory = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentCategory) return;
    const cleanName = editCatName.trim();
    if (!cleanName) return;

    if (
      cleanName.toLowerCase() !== currentCategory.name.toLowerCase() &&
      categories.some((c) => c.name.toLowerCase() === cleanName.toLowerCase())
    ) {
      showNotification(`カテゴリ名「${cleanName}」は既に存在します`);
      return;
    }

    const updated = updateCategory(currentCategory.name, {
      name: cleanName,
      icon: editCatIcon || currentCategory.icon,
    });
    setCategories(updated);
    setSelectedCategoryName(cleanName);
    setIsEditingCategory(false);
    showNotification(`カテゴリ「${cleanName}」の情報を更新しました`);
  };

  // カテゴリ削除
  const handleDeleteCurrentCategory = () => {
    if (!currentCategory) return;
    if (
      window.confirm(
        `カテゴリ「${currentCategory.icon} ${currentCategory.name}」（登録タグ${currentCategory.tags.length}件）を完全に削除しますか？`
      )
    ) {
      const updated = removeCategory(currentCategory.name);
      setCategories(updated);
      setSelectedCategoryName(updated.length > 0 ? updated[0].name : '');
      setIsEditingCategory(false);
      showNotification(`カテゴリ「${currentCategory.name}」を削除しました`);
    }
  };

  // カテゴリの並び順移動
  const handleMoveCategory = (direction: 'prev' | 'next') => {
    if (currentCategoryIndex < 0) return;
    const toIndex = direction === 'prev' ? currentCategoryIndex - 1 : currentCategoryIndex + 1;
    if (toIndex < 0 || toIndex >= categories.length) return;

    const updated = reorderCategories(currentCategoryIndex, toIndex);
    setCategories(updated);
  };

  // カテゴリ・タグ全体の初期化
  const handleResetCategories = () => {
    if (
      window.confirm(
        'トレンド・カテゴリ一覧と登録ハッシュタグを初期デフォルト定義（6カテゴリ）に戻しますか？\n※追加したカスタムカテゴリやタグはリセットされます。'
      )
    ) {
      const updated = resetCategoriesToDefault();
      setCategories(updated);
      setSelectedCategoryName(updated.length > 0 ? updated[0].name : '');
      setIsEditingCategory(false);
      setIsCreatingCategory(false);
      showNotification('トレンド・カテゴリ一覧を初期デフォルトにリセットしました');
    }
  };

  // --- Threadsトピック操作 ---
  const handleAddTopics = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!topicInput.trim()) return;

    const splitTokens = topicInput
      .split(/[\s,、\n]+/)
      .map((t) => t.trim().replace(/^#+/, ''))
      .filter(Boolean);

    if (splitTokens.length === 0) return;

    const updated = addMultipleThreadsTopics(splitTokens);
    setThreadsTopics(updated);
    setTopicInput('');
    showNotification(
      splitTokens.length === 1
        ? `Threadsトピック「#${splitTokens[0]}」を追加しました`
        : `${splitTokens.length}件のThreadsトピックを一括追加しました`
    );
  };

  const handleRemoveTopic = (topic: string) => {
    const updated = removeSavedThreadsTopic(topic);
    setThreadsTopics(updated);
    showNotification(`Threadsトピック「#${topic}」を削除しました`);
  };

  const handleResetTopics = () => {
    if (window.confirm('Threads専用トピック候補を初期デフォルト（8件）に戻しますか？')) {
      const updated = resetSavedThreadsTopics();
      setThreadsTopics(updated);
      showNotification('Threadsトピックを初期デフォルトにリセットしました');
    }
  };

  const handleClearAllTopics = () => {
    if (window.confirm('すべてのThreads専用トピック候補を削除しますか？')) {
      const updated = clearAllThreadsTopics();
      setThreadsTopics(updated);
      showNotification('すべてのThreadsトピックをクリアしました');
    }
  };

  const handleQuickAddTopic = (topic: string) => {
    const clean = topic.replace(/^#+/, '').trim();
    if (!clean) return;
    if (threadsTopics.some((t) => t.toLowerCase() === clean.toLowerCase())) {
      showNotification(`トピック「#${clean}」は既に登録されています`);
      return;
    }
    const updated = addSavedThreadsTopic(clean);
    setThreadsTopics(updated);
    showNotification(`トピック「#${clean}」を候補に追加しました`);
  };

  const handleCopyTag = (text: string) => {
    const formatted = `#${text}`;
    navigator.clipboard?.writeText?.(formatted).catch(() => {});
    setCopiedItem(text);
    setTimeout(() => setCopiedItem((prev) => (prev === text ? null : prev)), 1500);
  };

  // フィルタリング
  const filteredHashtags = useMemo(() => {
    const q = hashtagSearch.trim().toLowerCase().replace(/^#+/, '');
    if (!q) return customTags;
    return customTags.filter((t) => t.toLowerCase().includes(q));
  }, [customTags, hashtagSearch]);

  const filteredCurrentCategoryTags = useMemo(() => {
    if (!currentCategory) return [];
    const q = categoryTagSearch.trim().toLowerCase().replace(/^#+/, '');
    if (!q) return currentCategory.tags;
    return currentCategory.tags.filter((t) => t.toLowerCase().includes(q));
  }, [currentCategory, categoryTagSearch]);

  const filteredTopics = useMemo(() => {
    const q = topicSearch.trim().toLowerCase().replace(/^#+/, '');
    if (!q) return threadsTopics;
    return threadsTopics.filter((t) => t.toLowerCase().includes(q));
  }, [threadsTopics, topicSearch]);

  // トレンド・カテゴリ全体のタグ総数
  const totalCategoryTagsCount = useMemo(() => {
    return categories.reduce((acc, cat) => acc + cat.tags.length, 0);
  }, [categories]);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* 上部ヘッダー情報 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30 shrink-0">
            <Hash className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>ハッシュタグ & トピック メンテナンス</span>
            </h3>
            <p className="text-xs text-slate-400">
              エディタで利用するハッシュタグ、トレンド・カテゴリ一覧、Threadsトピックを自由に編集・追加できます。
            </p>
          </div>
        </div>
      </div>

      {/* アクション通知バナー */}
      {notice && (
        <div className="p-3 rounded-xl bg-sky-950/60 border border-sky-500/40 text-xs text-sky-200 flex items-center justify-between animate-in fade-in slide-in-from-top-1 shadow-sm">
          <div className="flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-sky-400 hover:text-sky-200 ml-2 cursor-pointer p-0.5"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* サブタブ切り替え（セグメントコントロール） */}
      <div className="p-1 rounded-xl bg-slate-950 border border-slate-800/80 grid grid-cols-3 gap-1">
        <button
          type="button"
          onClick={() => setActiveSubTab('hashtags')}
          className={`py-2 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeSubTab === 'hashtags'
              ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Hash className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span>お気に入りタグ</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono shrink-0">
            {customTags.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('categories')}
          className={`py-2 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeSubTab === 'categories'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>トレンド・カテゴリ一覧</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono shrink-0">
            {categories.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('threads_topics')}
          className={`py-2 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeSubTab === 'threads_topics'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <span className="text-xs shrink-0">🌀</span>
          <span>Threadsトピック</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono shrink-0">
            {threadsTopics.length}
          </span>
        </button>
      </div>

      {/* === タブ1: お気に入りハッシュタグ管理 === */}
      {activeSubTab === 'hashtags' && (
        <div className="space-y-5">
          {/* 説明カード */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-slate-200">
                お気に入りハッシュタグ（オリジナル）
              </p>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                エディタ下部の「⭐ オリジナル」カテゴリに表示され、いつでもワンクリックで挿入できるお気に入りタグです。カンマやスペース区切りで複数まとめて追加できます。
              </p>
            </div>
          </div>

          {/* 新規追加フォーム */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span>新規ハッシュタグの追加</span>
              <span className="text-[11px] text-slate-500 font-normal">
                ※「#」は入力時に自動除去されます
              </span>
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">
                  #
                </span>
                <input
                  type="text"
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddHashtags();
                    }
                  }}
                  placeholder="タグ名（例: カフェ巡り, 個人開発, Webデザイン）"
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-7 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-sky-400 transition"
                />
              </div>
              <button
                type="button"
                onClick={() => handleAddHashtags()}
                disabled={!hashtagInput.trim()}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>追加</span>
              </button>
            </div>
          </div>

          {/* タグ一覧・検索・フィルター */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200">
                  登録済みお気に入りタグ ({customTags.length}件)
                </span>
              </div>

              {customTags.length > 5 && (
                <div className="relative w-full sm:w-48">
                  <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={hashtagSearch}
                    onChange={(e) => setHashtagSearch(e.target.value)}
                    placeholder="タグを検索..."
                    className="w-full bg-slate-900/90 border border-slate-800 rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-sky-400 transition"
                  />
                  {hashtagSearch && (
                    <button
                      type="button"
                      onClick={() => setHashtagSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* バッジ一覧 */}
            <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 min-h-[110px] flex flex-wrap content-start items-center gap-2">
              {filteredHashtags.length === 0 ? (
                <div className="w-full py-6 text-center text-xs text-slate-500">
                  {hashtagSearch ? (
                    <span>「{hashtagSearch}」に一致するハッシュタグはありません</span>
                  ) : (
                    <div className="space-y-2">
                      <p>登録されているハッシュタグはありません。</p>
                      <button
                        type="button"
                        onClick={handleResetHashtags}
                        className="text-sky-400 hover:underline inline-flex items-center gap-1 text-xs cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>初期おすすめタグ（8件）を読み込む</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                filteredHashtags.map((tag) => {
                  const isCopied = copiedItem === tag;
                  return (
                    <div
                      key={tag}
                      className="group inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800/90 border border-slate-700/60 hover:border-sky-500/40 text-slate-200 text-xs transition shadow-xs"
                    >
                      <button
                        type="button"
                        onClick={() => handleCopyTag(tag)}
                        title="クリックして「#タグ」をクリップボードにコピー"
                        className="cursor-pointer font-medium hover:text-sky-300 flex items-center gap-1"
                      >
                        <span className="text-sky-400 font-bold">#</span>
                        <span>{tag}</span>
                        {isCopied && <Check className="w-3 h-3 text-emerald-400 ml-0.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveHashtag(tag)}
                        title={`「#${tag}」を削除`}
                        className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* おすすめカテゴリから一括追加セクション */}
            <div className="border border-slate-800/80 rounded-xl bg-slate-950/30 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowCategoryPills(!showCategoryPills)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-300 hover:bg-slate-900/60 transition cursor-pointer select-none"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>トレンド・カテゴリ一覧の登録タグからお気に入りに追加</span>
                </div>
                {showCategoryPills ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                )}
              </button>

              {showCategoryPills && (
                <div className="p-3.5 border-t border-slate-800/60 space-y-3 bg-slate-950/60">
                  {categories.map((cat) => (
                    <div key={cat.name} className="space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                        <span>{cat.icon}</span>
                        <span>{cat.name}</span>
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {cat.tags.map((t) => {
                          const isAlreadyAdded = customTags.some(
                            (c) => c.toLowerCase() === t.toLowerCase()
                          );
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => handleQuickAddHashtagFromCategory(t)}
                              disabled={isAlreadyAdded}
                              className={`text-[11px] px-2 py-0.8 rounded-md border transition flex items-center gap-1 cursor-pointer ${
                                isAlreadyAdded
                                  ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                                  : 'bg-slate-900/80 hover:bg-sky-950 hover:text-sky-300 hover:border-sky-500/40 text-slate-300 border-slate-700/60'
                              }`}
                              title={isAlreadyAdded ? '登録済み' : `クリックして「#${t}」をお気に入りに追加`}
                            >
                              <span className="text-sky-400">#</span>
                              <span>{t}</span>
                              {isAlreadyAdded ? (
                                <Check className="w-2.5 h-2.5 text-slate-500" />
                              ) : (
                                <Plus className="w-2.5 h-2.5 text-slate-400" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 一括リセット・クリアボタン */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={handleResetHashtags}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs border border-slate-800 transition flex items-center gap-1.5 cursor-pointer"
                title="推奨の基本お気に入りハッシュタグ一覧に戻します"
              >
                <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                <span>初期デフォルトに戻す</span>
              </button>

              {customTags.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllHashtags}
                  className="px-3 py-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-950/60 text-rose-400 text-xs border border-rose-900/30 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>すべてクリア</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === タブ2: トレンド・カテゴリ一覧 メンテナンス === */}
      {activeSubTab === 'categories' && (
        <div className="space-y-5">
          {/* 説明カード */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-slate-200">
                トレンド・カテゴリ一覧 & 登録ハッシュタグのメンテナンス
              </p>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                エディタ下部の「トレンド・カテゴリ一覧」タブに表示されるカテゴリと、各カテゴリに属するハッシュタグを管理します。新しいカテゴリの作成や既存カテゴリ内のタグの追加・削除が可能です。
              </p>
            </div>
          </div>

          {/* カテゴリ切り替え & 新規カテゴリ追加バー */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  <span>カテゴリ選択 ({categories.length}カテゴリ / 計{totalCategoryTagsCount}タグ)</span>
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingCategory(!isCreatingCategory);
                    setIsEditingCategory(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    isCreatingCategory
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40'
                  }`}
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>新規カテゴリ追加</span>
                </button>

                <button
                  type="button"
                  onClick={handleResetCategories}
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-800 transition cursor-pointer"
                  title="カテゴリ一覧を初期状態に戻す"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 新規カテゴリ作成フォーム */}
            {isCreatingCategory && (
              <form
                onSubmit={handleCreateCategorySubmit}
                className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/40 space-y-3 animate-in fade-in duration-200"
              >
                <div className="flex items-center justify-between border-b border-amber-800/40 pb-2">
                  <span className="text-xs font-bold text-amber-200 flex items-center gap-1.5">
                    <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
                    <span>新しいカテゴリを作成</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingCategory(false)}
                    className="text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-1 space-y-1">
                    <label className="text-[11px] font-bold text-slate-300">アイコン (絵文字)</label>
                    <input
                      type="text"
                      value={newCatIcon}
                      onChange={(e) => setNewCatIcon(e.target.value)}
                      maxLength={4}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-center text-xl text-slate-100 focus:outline-hidden focus:border-amber-400"
                    />
                  </div>

                  <div className="sm:col-span-3 space-y-1">
                    <label className="text-[11px] font-bold text-slate-300">カテゴリ名</label>
                    <input
                      type="text"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      placeholder="例: ペット・動物, 読書・本, ライフハック"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* 絵文字プリセット（2倍のサイズ） */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-xs text-slate-400 block font-medium">おすすめアイコン:</span>
                  <div className="flex flex-wrap items-center gap-2">
                    {EMOJI_PRESETS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setNewCatIcon(emoji)}
                        className={`text-2xl p-2 rounded-xl transition cursor-pointer flex items-center justify-center min-w-[42px] min-h-[42px] ${
                          newCatIcon === emoji
                            ? 'bg-amber-500/30 border-2 border-amber-400 scale-105 shadow-md shadow-amber-500/20'
                            : 'bg-slate-900/90 hover:bg-slate-800 hover:scale-105 border border-slate-700/60'
                        }`}
                        title={`アイコンに「${emoji}」を選択`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 初期タグ入力 */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                    <span>初期登録ハッシュタグ (任意・カンマ区切り)</span>
                  </label>
                  <input
                    type="text"
                    value={newCatInitialTags}
                    onChange={(e) => setNewCatInitialTags(e.target.value)}
                    placeholder="例: 犬好き, 猫のいる暮らし, ペット写真"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-amber-400"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCreatingCategory(false)}
                    className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 text-xs transition cursor-pointer"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={!newCatName.trim()}
                    className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>カテゴリを作成</span>
                  </button>
                </div>
              </form>
            )}

            {/* カテゴリ選択ピル群 */}
            <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-slate-950/70 border border-slate-800/80">
              {categories.map((cat) => {
                const isSelected = currentCategory?.name === cat.name;
                return (
                  <button
                    key={cat.name}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryName(cat.name);
                      setIsEditingCategory(false);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-amber-500/20 text-amber-200 border border-amber-500/50 font-bold shadow-xs'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        isSelected
                          ? 'bg-amber-500/30 text-amber-200'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {cat.tags.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 選択されたカテゴリの詳細およびタグ編集パネル */}
          {currentCategory && (
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
              {/* カテゴリヘッダー（名前、編集、削除、並び替え） */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-800">
                {!isEditingCategory ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xl p-1.5 rounded-lg bg-slate-900 border border-slate-800">
                      {currentCategory.icon}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        <span>{currentCategory.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-normal">
                          {currentCategory.tags.length}件のタグ
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        エディタのトレンド・カテゴリ一覧で選択可能です
                      </p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSaveEditCategory} className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={editCatIcon}
                      onChange={(e) => setEditCatIcon(e.target.value)}
                      maxLength={4}
                      className="w-12 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-center text-xs text-slate-100 focus:outline-hidden focus:border-amber-400"
                    />
                    <input
                      type="text"
                      value={editCatName}
                      onChange={(e) => setEditCatName(e.target.value)}
                      placeholder="カテゴリ名"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-hidden focus:border-amber-400"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs transition cursor-pointer"
                    >
                      保存
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingCategory(false)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs transition cursor-pointer"
                    >
                      キャンセル
                    </button>
                  </form>
                )}

                {!isEditingCategory && (
                  <div className="flex items-center gap-1">
                    {/* 並び順移動 */}
                    <button
                      type="button"
                      onClick={() => handleMoveCategory('prev')}
                      disabled={currentCategoryIndex <= 0}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 border border-slate-800 transition cursor-pointer"
                      title="このカテゴリを左（前）に移動"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveCategory('next')}
                      disabled={currentCategoryIndex >= categories.length - 1}
                      className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 border border-slate-800 transition cursor-pointer"
                      title="このカテゴリを右（後）に移動"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={handleStartEditCategory}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-300 text-xs border border-slate-800 transition flex items-center gap-1 cursor-pointer"
                      title="カテゴリ名・アイコンを編集"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span className="hidden sm:inline">編集</span>
                    </button>

                    {categories.length > 1 && (
                      <button
                        type="button"
                        onClick={handleDeleteCurrentCategory}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-950/60 text-rose-400 text-xs border border-rose-900/30 transition flex items-center gap-1 cursor-pointer"
                        title="このカテゴリを削除"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span className="hidden sm:inline">削除</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* タグ追加フォーム */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                  <span>「{currentCategory.name}」にハッシュタグを追加</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    カンマやスペース区切りで一括追加可能
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xs">
                      #
                    </span>
                    <input
                      type="text"
                      value={categoryTagInput}
                      onChange={(e) => setCategoryTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCategoryTag();
                        }
                      }}
                      placeholder={`「${currentCategory.name}」に追加するタグ名（例: タグA, タグB）`}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-7 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-amber-400 transition"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddCategoryTag()}
                    disabled={!categoryTagInput.trim()}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>追加</span>
                  </button>
                </div>
              </div>

              {/* 登録タグ一覧 */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <span className="text-xs font-bold text-slate-200">
                    登録済みハッシュタグ ({currentCategory.tags.length}件)
                  </span>

                  {currentCategory.tags.length > 5 && (
                    <div className="relative w-full sm:w-48">
                      <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={categoryTagSearch}
                        onChange={(e) => setCategoryTagSearch(e.target.value)}
                        placeholder="このカテゴリ内を検索..."
                        className="w-full bg-slate-900/90 border border-slate-800 rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-amber-400 transition"
                      />
                      {categoryTagSearch && (
                        <button
                          type="button"
                          onClick={() => setCategoryTagSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* タグバッジ群 */}
                <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 min-h-[100px] flex flex-wrap content-start items-center gap-2">
                  {filteredCurrentCategoryTags.length === 0 ? (
                    <div className="w-full py-6 text-center text-xs text-slate-500">
                      {categoryTagSearch ? (
                        <span>「{categoryTagSearch}」に一致するタグはありません</span>
                      ) : (
                        <p>このカテゴリにはハッシュタグがまだ登録されていません。</p>
                      )}
                    </div>
                  ) : (
                    filteredCurrentCategoryTags.map((tag) => {
                      const isCopied = copiedItem === tag;
                      return (
                        <div
                          key={tag}
                          className="group inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800/90 border border-slate-700/60 hover:border-amber-500/40 text-slate-200 text-xs transition shadow-xs"
                        >
                          <button
                            type="button"
                            onClick={() => handleCopyTag(tag)}
                            title="クリックして「#タグ」をクリップボードにコピー"
                            className="cursor-pointer font-medium hover:text-amber-300 flex items-center gap-1"
                          >
                            <span className="text-amber-400 font-bold">#</span>
                            <span>{tag}</span>
                            {isCopied && <Check className="w-3 h-3 text-emerald-400 ml-0.5" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRemoveCategoryTag(tag)}
                            title={`「#${tag}」をこのカテゴリから削除`}
                            className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* カテゴリ内タグ一括クリア */}
                {currentCategory.tags.length > 0 && (
                  <div className="pt-2 flex justify-end border-t border-slate-800/60">
                    <button
                      type="button"
                      onClick={handleClearAllCategoryTags}
                      className="px-3 py-1 rounded-lg bg-rose-950/20 hover:bg-rose-950/50 text-rose-400 text-xs border border-rose-900/30 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>このカテゴリのタグをすべてクリア</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* === タブ3: Threads専用トピック管理 === */}
      {activeSubTab === 'threads_topics' && (
        <div className="space-y-5">
          {/* 説明カード */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-slate-200">Threads専用トピックタグ (Topic Tags)</p>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Meta Threadsの公式機能として、スレッド投稿1件につき1つの公式トピックタグを紐づけられます。設定したトピックはThreads上でハイライトされ、同じ関心を持つユーザーへのおすすめ表示を促進します。
              </p>
            </div>
          </div>

          {/* 新規トピック追加フォーム */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
              <span>新規Threadsトピックの追加</span>
              <span className="text-[11px] text-slate-500 font-normal">
                ※「#」は入力時に自動除去されます
              </span>
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400 font-bold text-xs">
                  #
                </span>
                <input
                  type="text"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTopics();
                    }
                  }}
                  placeholder="トピック名（例: テクノロジー, カフェ, 個人開発）"
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-7 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-purple-400 transition"
                />
              </div>
              <button
                type="button"
                onClick={() => handleAddTopics()}
                disabled={!topicInput.trim()}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>追加</span>
              </button>
            </div>
          </div>

          {/* トピック一覧 */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <span className="text-xs font-bold text-slate-200">
                登録済みトピック候補 ({threadsTopics.length}件)
              </span>

              {threadsTopics.length > 5 && (
                <div className="relative w-full sm:w-48">
                  <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={topicSearch}
                    onChange={(e) => setTopicSearch(e.target.value)}
                    placeholder="トピックを検索..."
                    className="w-full bg-slate-900/90 border border-slate-800 rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-purple-400 transition"
                  />
                  {topicSearch && (
                    <button
                      type="button"
                      onClick={() => setTopicSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* バッジ一覧 */}
            <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 min-h-[100px] flex flex-wrap content-start items-center gap-2">
              {filteredTopics.length === 0 ? (
                <div className="w-full py-6 text-center text-xs text-slate-500">
                  {topicSearch ? (
                    <span>「{topicSearch}」に一致するトピックはありません</span>
                  ) : (
                    <div className="space-y-2">
                      <p>登録されているトピック候補はありません。</p>
                      <button
                        type="button"
                        onClick={handleResetTopics}
                        className="text-purple-400 hover:underline inline-flex items-center gap-1 text-xs cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>初期デフォルト（8件）を読み込む</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                filteredTopics.map((topic) => {
                  return (
                    <div
                      key={topic}
                      className="group inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800/90 border border-slate-700/60 hover:border-purple-500/40 text-slate-200 text-xs transition shadow-xs"
                    >
                      <span className="font-medium text-slate-200 flex items-center gap-1">
                        <span className="text-purple-400 font-bold">#</span>
                        <span>{topic}</span>
                      </span>

                      <button
                        type="button"
                        onClick={() => handleRemoveTopic(topic)}
                        title={`トピック「#${topic}」を削除`}
                        className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* おすすめThreadsトピック */}
            <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-purple-400" />
                <span>よく使われる定番トピックから追加</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'テクノロジー',
                  '写真',
                  '日常',
                  '個人開発',
                  'カフェ',
                  'AI',
                  'ブログ',
                  'ライフハック',
                  'デザイン',
                  '旅行',
                  '読書',
                  '料理',
                  'ビジネス',
                  '音楽',
                  'エンタメ',
                ].map((t) => {
                  const exists = threadsTopics.some((item) => item.toLowerCase() === t.toLowerCase());
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleQuickAddTopic(t)}
                      disabled={exists}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition flex items-center gap-1 cursor-pointer ${
                        exists
                          ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                          : 'bg-slate-900/80 hover:bg-purple-950 hover:text-purple-300 hover:border-purple-500/40 text-slate-300 border-slate-700/60'
                      }`}
                      title={exists ? '登録済み' : `クリックして「#${t}」を候補に追加`}
                    >
                      <span className="text-purple-400">#</span>
                      <span>{t}</span>
                      {exists ? (
                        <Check className="w-2.5 h-2.5 text-slate-500" />
                      ) : (
                        <Plus className="w-2.5 h-2.5 text-slate-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 一括リセット・クリアボタン */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={handleResetTopics}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs border border-slate-800 transition flex items-center gap-1.5 cursor-pointer"
                title="推奨の基本Threadsトピック一覧に戻します"
              >
                <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
                <span>初期デフォルトに戻す</span>
              </button>

              {threadsTopics.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllTopics}
                  className="px-3 py-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-950/60 text-rose-400 text-xs border border-rose-900/30 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>すべてクリア</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
