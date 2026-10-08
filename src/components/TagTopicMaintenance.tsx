import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Download,
  Upload,
  FileJson,
  AlertTriangle,
  FileText,
  Palette,
  Copy,
  Save,
  Star,
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
import {
  exportTagsAndSnippetsJson,
  parseAndValidateTagsAndSnippetsJson,
  applyTagsAndSnippetsData,
  ParseTagsAndSnippetsResult,
} from '../utils/exportImportHelper';
import { getSavedSnippets } from '../utils/snippetStorage';
import { ConfirmModal } from './ConfirmModal';
import {
  loadQuickDecorationsFromStorage,
  loadDecorationTemplatesFromStorage,
  addQuickDecoration,
  removeQuickDecoration,
  updateQuickDecoration,
  resetQuickDecorations,
  addDecorationTemplate,
  removeDecorationTemplate,
  updateDecorationTemplate,
  resetDecorationTemplates,
  QuickDecorationItem,
  DecorationItem,
  DECORATION_CATEGORIES,
  DEFAULT_QUICK_DECORATIONS,
  DEFAULT_DECORATION_TEMPLATES,
} from '../utils/unicodeFontConverter';

interface TagTopicMaintenanceProps {
  onNotify?: (message: string) => void;
  isDemoMode?: boolean;
}

// カテゴリ作成時のクイック選択用絵文字
const EMOJI_PRESETS = ['🏷️', '🌐', '💻', '🤖', '☕', '📷', '📈', '🎨', '🎵', '🐱', '🍣', '🍜', '🍚', '✈️', '🎮', '📚', '⚾', '💡', '🔥', '🌸'];

export type MaintenanceSubTab = 'hashtags' | 'categories' | 'threads_topics' | 'quick_decors' | 'decor_templates';

export const TagTopicMaintenance: React.FC<TagTopicMaintenanceProps> = ({ onNotify, isDemoMode = false }) => {
  // サブタブ: 'hashtags' (お気に入り) | 'categories' (トレンド・カテゴリ一覧) | 'threads_topics' (Threads専用) | 'quick_decors' (装飾バー) | 'decor_templates' (飾り罫線パレット)
  const [activeSubTab, setActiveSubTab] = useState<MaintenanceSubTab>('hashtags');

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

  // --- クイック装飾バー状態 ---
  const [quickDecors, setQuickDecors] = useState<QuickDecorationItem[]>(() => loadQuickDecorationsFromStorage());
  const [quickDecorSearch, setQuickDecorSearch] = useState('');
  const [quickDecorCategoryFilter, setQuickDecorCategoryFilter] = useState<'all' | 'line' | 'box' | 'number' | 'emoji'>('all');
  const [isAddingQuickDecor, setIsAddingQuickDecor] = useState(false);
  const [newQdLabel, setNewQdLabel] = useState('');
  const [newQdInsert, setNewQdInsert] = useState('');
  const [newQdTitle, setNewQdTitle] = useState('');
  const [newQdCategory, setNewQdCategory] = useState<'line' | 'box' | 'number' | 'emoji'>('line');
  const [editingQdItem, setEditingQdItem] = useState<QuickDecorationItem | null>(null);
  const [editQdLabel, setEditQdLabel] = useState('');
  const [editQdInsert, setEditQdInsert] = useState('');
  const [editQdTitle, setEditQdTitle] = useState('');
  const [editQdCategory, setEditQdCategory] = useState<'line' | 'box' | 'number' | 'emoji'>('line');

  // --- 飾り罫線・枠線パレット状態 ---
  const [decorTemplates, setDecorTemplates] = useState<DecorationItem[]>(() => loadDecorationTemplatesFromStorage());
  const [decorSearch, setDecorSearch] = useState('');
  const [decorCategoryFilter, setDecorCategoryFilter] = useState<string>('all');
  const [isAddingDecorTemplate, setIsAddingDecorTemplate] = useState(false);
  const [newDtName, setNewDtName] = useState('');
  const [newDtCategory, setNewDtCategory] = useState<DecorationItem['category']>('divider');
  const [newDtContent, setNewDtContent] = useState('');
  const [editingDtItem, setEditingDtItem] = useState<DecorationItem | null>(null);
  const [editDtName, setEditDtName] = useState('');
  const [editDtCategory, setEditDtCategory] = useState<DecorationItem['category']>('divider');
  const [editDtContent, setEditDtContent] = useState('');

  // --- 定型文・装飾バー・飾り罫線パレット件数（同期表示用） ---
  const [snippetsCount, setSnippetsCount] = useState<number>(() => getSavedSnippets().length);
  const [quickDecorCount, setQuickDecorCount] = useState<number>(() => loadQuickDecorationsFromStorage().length);
  const [decorTemplatesCount, setDecorTemplatesCount] = useState<number>(() => loadDecorationTemplatesFromStorage().length);

  // アクション通知トースト
  const [notice, setNotice] = useState<string | null>(null);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  // --- 確認モーダル状態 ---
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'primary';
    iconType?: 'alert' | 'reset' | 'trash';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const requestConfirm = (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'primary';
    iconType?: 'alert' | 'reset' | 'trash';
    onConfirm: () => void;
  }) => {
    setConfirmState({
      isOpen: true,
      ...options,
    });
  };

  // --- ダウンロード・アップロード（インポート/エクスポート）状態 ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [parsedImportData, setParsedImportData] = useState<ParseTagsAndSnippetsResult | null>(null);
  const [importMode, setImportMode] = useState<'merge' | 'overwrite'>('merge');
  const [isImporting, setIsImporting] = useState(false);

  const showNotification = (msg: string) => {
    setNotice(msg);
    if (onNotify) onNotify(msg);
    setTimeout(() => {
      setNotice((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  // JSONダウンロード実行
  const handleExportJson = () => {
    try {
      exportTagsAndSnippetsJson();
      showNotification('💾 ハッシュタグ・トピック・定型文・装飾バー・飾り罫線パレットをダウンロードしました');
    } catch (e: any) {
      showNotification(`❌ エクスポートに失敗しました: ${e?.message || 'エラー'}`);
    }
  };

  // ファイル選択トリガー
  const handleTriggerUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // ファイル読み込みハンドラ
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;
      const result = parseAndValidateTagsAndSnippetsJson(content);
      setParsedImportData(result);
      setImportModalOpen(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.onerror = () => {
      showNotification('❌ ファイルの読み込みに失敗しました');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // インポート実行
  const handleExecuteImport = () => {
    if (!parsedImportData || !parsedImportData.success) return;
    setIsImporting(true);
    try {
      const result = applyTagsAndSnippetsData(
        {
          customHashtags: parsedImportData.customHashtags,
          threadsTopics: parsedImportData.threadsTopics,
          categories: parsedImportData.categories,
          snippets: parsedImportData.snippets,
          quickDecorations: parsedImportData.quickDecorations,
          decorationTemplates: parsedImportData.decorationTemplates,
        },
        { mode: importMode }
      );

      // 最新化
      setCustomTags(getSavedCustomTags());
      const updatedCats = getSavedCategories();
      setCategories(updatedCats);
      setThreadsTopics(getSavedThreadsTopics());
      setSnippetsCount(getSavedSnippets().length);
      setQuickDecorCount(loadQuickDecorationsFromStorage().length);
      setDecorTemplatesCount(loadDecorationTemplatesFromStorage().length);

      setImportModalOpen(false);
      setParsedImportData(null);

      const modeText = importMode === 'overwrite' ? '完全上書き' : '追加マージ';
      const parts = [
        `タグ: ${result.addedHashtagsCount}件`,
        `トピック: ${result.addedTopicsCount}件`,
        `カテゴリ: ${result.addedCategoriesCount}件`,
        `定型文: ${result.addedSnippetsCount}件`,
      ];
      if (result.addedQuickDecorationsCount > 0 || parsedImportData.quickDecorations.length > 0) {
        parts.push(`装飾バー: ${result.addedQuickDecorationsCount}件`);
      }
      if (result.addedDecorationTemplatesCount > 0 || parsedImportData.decorationTemplates.length > 0) {
        parts.push(`飾り罫線: ${result.addedDecorationTemplatesCount}件`);
      }

      showNotification(
        `🎉 データのインポート（${modeText}）が完了しました！（${parts.join(', ')}）`
      );
    } catch (e: any) {
      showNotification(`❌ インポート適用に失敗しました: ${e?.message || 'エラー'}`);
    } finally {
      setIsImporting(false);
    }
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
    const handleSnippetsUpdated = () => {
      setSnippetsCount(getSavedSnippets().length);
    };
    const handleDecorationsUpdated = () => {
      const qd = loadQuickDecorationsFromStorage();
      const dt = loadDecorationTemplatesFromStorage();
      setQuickDecors(qd);
      setQuickDecorCount(qd.length);
      setDecorTemplates(dt);
      setDecorTemplatesCount(dt.length);
    };
    const handleSetSubTab = (e: any) => {
      if (e?.detail) {
        setActiveSubTab(e.detail);
      }
    };

    window.addEventListener('crosspost_tags_updated', handleTagsUpdated);
    window.addEventListener('crosspost_categories_updated', handleCategoriesUpdated);
    window.addEventListener('crosspost_topics_updated', handleTopicsUpdated);
    window.addEventListener('crosspost_snippets_updated', handleSnippetsUpdated);
    window.addEventListener('crosspost_quick_decorations_updated', handleDecorationsUpdated);
    window.addEventListener('crosspost_decoration_templates_updated', handleDecorationsUpdated);
    window.addEventListener('crosspost_set_maintenance_subtab', handleSetSubTab as EventListener);

    return () => {
      window.removeEventListener('crosspost_tags_updated', handleTagsUpdated);
      window.removeEventListener('crosspost_categories_updated', handleCategoriesUpdated);
      window.removeEventListener('crosspost_topics_updated', handleTopicsUpdated);
      window.removeEventListener('crosspost_snippets_updated', handleSnippetsUpdated);
      window.removeEventListener('crosspost_quick_decorations_updated', handleDecorationsUpdated);
      window.removeEventListener('crosspost_decoration_templates_updated', handleDecorationsUpdated);
      window.removeEventListener('crosspost_set_maintenance_subtab', handleSetSubTab as EventListener);
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
    requestConfirm({
      title: 'お気に入りハッシュタグの初期化',
      message: 'お気に入りハッシュタグを初期デフォルト（8件）に戻しますか？\n※追加したハッシュタグはリセットされます。',
      confirmLabel: '初期デフォルトに戻す',
      iconType: 'reset',
      variant: 'warning',
      onConfirm: () => {
        const updated = resetCustomTags();
        setCustomTags(updated);
        showNotification('ハッシュタグを初期デフォルトにリセットしました');
      },
    });
  };

  const handleClearAllHashtags = () => {
    requestConfirm({
      title: 'お気に入りハッシュタグの全削除',
      message: 'すべてのお気に入りハッシュタグを削除しますか？\n※この操作は取り消せません。',
      confirmLabel: 'すべて削除する',
      iconType: 'trash',
      variant: 'danger',
      onConfirm: () => {
        const updated = clearAllCustomTags();
        setCustomTags(updated);
        showNotification('すべてのお気に入りハッシュタグをクリアしました');
      },
    });
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
    requestConfirm({
      title: 'カテゴリ内タグの全削除',
      message: `カテゴリ「${currentCategory.icon} ${currentCategory.name}」内のすべての登録タグを削除しますか？`,
      confirmLabel: 'タグをすべて削除',
      iconType: 'trash',
      variant: 'danger',
      onConfirm: () => {
        const updated = categories.map((c) =>
          c.name === currentCategory.name ? { ...c, tags: [] } : c
        );
        saveCategoriesList(updated);
        setCategories(updated);
        showNotification(`カテゴリ「${currentCategory.name}」のタグをすべてクリアしました`);
      },
    });
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
    requestConfirm({
      title: 'カテゴリの削除',
      message: `カテゴリ「${currentCategory.icon} ${currentCategory.name}」（登録タグ${currentCategory.tags.length}件）を完全に削除しますか？`,
      confirmLabel: 'カテゴリを削除',
      iconType: 'trash',
      variant: 'danger',
      onConfirm: () => {
        const updated = removeCategory(currentCategory.name);
        setCategories(updated);
        setSelectedCategoryName(updated.length > 0 ? updated[0].name : '');
        setIsEditingCategory(false);
        showNotification(`カテゴリ「${currentCategory.name}」を削除しました`);
      },
    });
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
    requestConfirm({
      title: 'トレンド・カテゴリ一覧の初期化',
      message: 'トレンド・カテゴリ一覧と登録ハッシュタグを初期デフォルト定義（6カテゴリ）に戻しますか？\n※追加したカスタムカテゴリやタグはリセットされます。',
      confirmLabel: '初期デフォルトに戻す',
      iconType: 'reset',
      variant: 'warning',
      onConfirm: () => {
        const updated = resetCategoriesToDefault();
        setCategories(updated);
        setSelectedCategoryName(updated.length > 0 ? updated[0].name : '');
        setIsEditingCategory(false);
        setIsCreatingCategory(false);
        showNotification('トレンド・カテゴリ一覧を初期デフォルトにリセットしました');
      },
    });
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
    requestConfirm({
      title: 'Threadsトピック候補の初期化',
      message: 'Threads専用トピック候補を初期デフォルト（8件）に戻しますか？\n※追加したトピックはリセットされます。',
      confirmLabel: '初期デフォルトに戻す',
      iconType: 'reset',
      variant: 'warning',
      onConfirm: () => {
        const updated = resetSavedThreadsTopics();
        setThreadsTopics(updated);
        showNotification('Threadsトピックを初期デフォルトにリセットしました');
      },
    });
  };

  const handleClearAllTopics = () => {
    requestConfirm({
      title: 'Threadsトピック候補の全削除',
      message: 'すべてのThreads専用トピック候補を削除しますか？\n※この操作は取り消せません。',
      confirmLabel: 'すべて削除する',
      iconType: 'trash',
      variant: 'danger',
      onConfirm: () => {
        const updated = clearAllThreadsTopics();
        setThreadsTopics(updated);
        showNotification('すべてのThreadsトピックをクリアしました');
      },
    });
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

  // クイック装飾フィルタリング
  const filteredQuickDecors = useMemo(() => {
    return quickDecors.filter((item) => {
      const matchCat = quickDecorCategoryFilter === 'all' || (item.category || 'emoji') === quickDecorCategoryFilter;
      if (!matchCat) return false;
      if (!quickDecorSearch.trim()) return true;
      const q = quickDecorSearch.trim().toLowerCase();
      return (
        item.label.toLowerCase().includes(q) ||
        item.insert.toLowerCase().includes(q) ||
        (item.title && item.title.toLowerCase().includes(q))
      );
    });
  }, [quickDecors, quickDecorCategoryFilter, quickDecorSearch]);

  // 飾り罫線パレットフィルタリング
  const filteredDecorTemplates = useMemo(() => {
    return decorTemplates.filter((item) => {
      const matchCat = decorCategoryFilter === 'all' || item.category === decorCategoryFilter;
      if (!matchCat) return false;
      if (!decorSearch.trim()) return true;
      const q = decorSearch.trim().toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.content.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q))
      );
    });
  }, [decorTemplates, decorCategoryFilter, decorSearch]);

  // クイック装飾新規追加
  const handleAddNewQuickDecor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQdLabel.trim() || !newQdInsert) {
      showNotification('ラベルと挿入テキストを入力してください。');
      return;
    }
    const updated = addQuickDecoration(newQdLabel.trim(), newQdInsert, newQdTitle.trim() || undefined, newQdCategory);
    setQuickDecors(updated);
    setQuickDecorCount(updated.length);
    setNewQdLabel('');
    setNewQdInsert('');
    setNewQdTitle('');
    setIsAddingQuickDecor(false);
    showNotification(`「${newQdLabel.trim()}」をクイック装飾バーに登録しました。`);
  };

  // クイック装飾更新保存
  const handleSaveEditQuickDecor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQdItem || !editQdLabel.trim() || !editQdInsert) return;
    const updated = updateQuickDecoration(editingQdItem.id, {
      label: editQdLabel.trim(),
      insert: editQdInsert,
      title: editQdTitle.trim() || undefined,
      category: editQdCategory,
    });
    setQuickDecors(updated);
    setEditingQdItem(null);
    showNotification(`「${editQdLabel.trim()}」の変更を保存しました。`);
  };

  // クイック装飾削除
  const handleDeleteQuickDecor = (item: QuickDecorationItem) => {
    requestConfirm({
      title: 'クイック装飾の削除',
      message: `クイック装飾「${item.label}」をクイック装飾バーから削除してもよろしいですか？`,
      confirmLabel: '削除する',
      iconType: 'trash',
      variant: 'danger',
      onConfirm: () => {
        const updated = removeQuickDecoration(item.id);
        setQuickDecors(updated);
        setQuickDecorCount(updated.length);
        showNotification(`「${item.label}」をクイック装飾バーから削除しました。`);
      },
    });
  };

  // クイック装飾初期デフォルトリセット
  const handleResetQuickDecors = () => {
    requestConfirm({
      title: 'クイック装飾バーの初期化',
      message: 'クイック装飾バーを初期デフォルト一覧（17種類）に戻しますか？\n※追加・編集したクイック装飾ボタンはリセットされます。',
      confirmLabel: '初期デフォルトに戻す',
      iconType: 'reset',
      variant: 'warning',
      onConfirm: () => {
        const updated = resetQuickDecorations();
        setQuickDecors(updated);
        setQuickDecorCount(updated.length);
        showNotification('クイック装飾バーを初期デフォルト一覧に戻しました。');
      },
    });
  };

  // 飾り罫線パレット新規追加
  const handleAddNewDecorTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDtName.trim() || !newDtContent.trim()) {
      showNotification('名前と装飾テキストを入力してください。');
      return;
    }
    const updated = addDecorationTemplate({
      name: newDtName.trim(),
      category: newDtCategory,
      content: newDtContent,
    });
    setDecorTemplates(updated);
    setDecorTemplatesCount(updated.length);
    setNewDtName('');
    setNewDtContent('');
    setIsAddingDecorTemplate(false);
    showNotification(`「${newDtName.trim()}」を飾り罫線パレットに登録しました。`);
  };

  // 飾り罫線パレット更新保存
  const handleSaveEditDecorTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDtItem || !editDtName.trim() || !editDtContent.trim()) return;
    const updated = updateDecorationTemplate({
      ...editingDtItem,
      name: editDtName.trim(),
      category: editDtCategory,
      content: editDtContent,
    });
    setDecorTemplates(updated);
    setEditingDtItem(null);
    showNotification(`「${editDtName.trim()}」の変更を保存しました。`);
  };

  // 飾り罫線パレット削除
  const handleDeleteDecorTemplate = (item: DecorationItem) => {
    requestConfirm({
      title: '装飾アイテムの削除',
      message: `装飾アイテム「${item.name}」を飾り罫線パレットから削除してもよろしいですか？`,
      confirmLabel: '削除する',
      iconType: 'trash',
      variant: 'danger',
      onConfirm: () => {
        const updated = removeDecorationTemplate(item.id);
        setDecorTemplates(updated);
        setDecorTemplatesCount(updated.length);
        showNotification(`「${item.name}」を飾り罫線パレットから削除しました。`);
      },
    });
  };

  // 飾り罫線パレット初期デフォルトリセット
  const handleResetDecorTemplates = () => {
    requestConfirm({
      title: '飾り罫線パレットの初期化',
      message: '飾り罫線・枠線パレットを初期デフォルト一覧（24種類）に戻しますか？\n※自作・編集した装飾テンプレートはリセットされます。',
      confirmLabel: '初期デフォルトに戻す (24種類)',
      iconType: 'reset',
      variant: 'warning',
      onConfirm: () => {
        const updated = resetDecorationTemplates();
        setDecorTemplates(updated);
        setDecorTemplatesCount(updated.length);
        showNotification('飾り罫線パレットを初期デフォルト一覧に戻しました。');
      },
    });
  };

  // パレット項目をクイック装飾バーに登録
  const handleAddTemplateToQuickBar = (item: DecorationItem) => {
    const cleanLabel = item.name.slice(0, 10);
    const updated = addQuickDecoration(cleanLabel, item.content, item.name);
    setQuickDecors(updated);
    setQuickDecorCount(updated.length);
    showNotification(`「${cleanLabel}」をクイック装飾バーに登録しました。`);
  };

  // クリップボードコピー
  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(id);
    setTimeout(() => setCopiedItem(null), 1800);
    showNotification('クリップボードにコピーしました。');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* 隠しファイル入力要素 */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".json,application/json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* 上部ヘッダー情報 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30 shrink-0">
            <Hash className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <span>ハッシュタグ・トピック・装飾・定型文</span>
            </h3>
            <p className="text-xs text-slate-400">
              エディタで利用するハッシュタグ、トレンド・カテゴリ一覧、Threads専用トピックに加え、定型文、装飾クイックバー、特殊フォント＆飾り罫線パレットを含めた全設定データのJSONダウンロード（一括バックアップ）およびアップロード（復元・同期）が可能です。
            </p>
          </div>
        </div>

        {/* ダウンロード（エクスポート） / アップロード（インポート）ボタン（LIVEモード時のみ表示） */}
        {!isDemoMode && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportJson}
              title="登録したハッシュタグ・Threadsトピック・トレンドカテゴリ・定型文・装飾バー・飾り罫線パレットをJSONファイルとしてダウンロード"
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-300 hover:text-white border border-sky-500/40 hover:border-sky-400 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>ダウンロード</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerUpload}
              title="保存したJSONファイルからハッシュタグ・トピック・カテゴリ・定型文・装飾バー・飾り罫線パレットを一括アップロードして反映"
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Upload className="w-3.5 h-3.5 shrink-0" />
              <span>アップロード</span>
            </button>
          </div>
        )}
      </div>

      {/* 収録データ（全6種）のリアルタイムステータスパネル */}
      <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="font-bold text-slate-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span>メンテナンス対象データ一覧（エディタ・JSON完全同期）</span>
          </span>
          <span className="text-[10px] text-slate-500">
            全6カテゴリー収録
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveSubTab('hashtags')}
            className={`p-2 rounded-lg border flex items-center justify-between transition cursor-pointer text-left ${
              activeSubTab === 'hashtags'
                ? 'bg-sky-950/40 border-sky-500/60 shadow-xs'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
            title="お気に入りタグ管理に切り替え"
          >
            <span className="text-slate-400 text-[11px] flex items-center gap-1">🏷️ お気に入りタグ</span>
            <span className="font-mono font-bold text-sky-300">{customTags.length}件</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('categories')}
            className={`p-2 rounded-lg border flex items-center justify-between transition cursor-pointer text-left ${
              activeSubTab === 'categories'
                ? 'bg-amber-950/40 border-amber-500/60 shadow-xs'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
            title="トレンド・カテゴリ管理に切り替え"
          >
            <span className="text-slate-400 text-[11px] flex items-center gap-1">📂 カテゴリ一覧</span>
            <span className="font-mono font-bold text-amber-300">{categories.length}件</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('threads_topics')}
            className={`p-2 rounded-lg border flex items-center justify-between transition cursor-pointer text-left ${
              activeSubTab === 'threads_topics'
                ? 'bg-purple-950/40 border-purple-500/60 shadow-xs'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
            title="Threadsトピック管理に切り替え"
          >
            <span className="text-slate-400 text-[11px] flex items-center gap-1">💬 Threadsトピック</span>
            <span className="font-mono font-bold text-purple-300">{threadsTopics.length}件</span>
          </button>
          <div className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <span className="text-slate-400 text-[11px] flex items-center gap-1">📋 定型文</span>
            <span className="font-mono font-bold text-emerald-300">{snippetsCount}件</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveSubTab('quick_decors')}
            className={`p-2 rounded-lg border flex items-center justify-between transition cursor-pointer text-left ${
              activeSubTab === 'quick_decors'
                ? 'bg-pink-950/40 border-pink-500/60 shadow-xs'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
            title="装飾バー管理に切り替え"
          >
            <span className="text-slate-400 text-[11px] flex items-center gap-1">🎨 装飾バー</span>
            <span className="font-mono font-bold text-pink-300">{quickDecorCount}件</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('decor_templates')}
            className={`p-2 rounded-lg border flex items-center justify-between transition cursor-pointer text-left ${
              activeSubTab === 'decor_templates'
                ? 'bg-indigo-950/40 border-indigo-500/60 shadow-xs'
                : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
            }`}
            title="飾り罫線パレット管理に切り替え"
          >
            <span className="text-slate-400 text-[11px] flex items-center gap-1">🕱 飾り罫線パレット</span>
            <span className="font-mono font-bold text-indigo-300">{decorTemplatesCount}件</span>
          </button>
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
      <div className="p-1 rounded-xl bg-slate-950 border border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1">
        <button
          type="button"
          onClick={() => setActiveSubTab('hashtags')}
          className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
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
          className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeSubTab === 'categories'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>トレンド・カテゴリ</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono shrink-0">
            {categories.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('threads_topics')}
          className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
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

        <button
          type="button"
          onClick={() => setActiveSubTab('quick_decors')}
          className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeSubTab === 'quick_decors'
              ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40 shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Palette className="w-3.5 h-3.5 text-pink-400 shrink-0" />
          <span>🎨 装飾バー</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono shrink-0">
            {quickDecors.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('decor_templates')}
          className={`py-2 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeSubTab === 'decor_templates'
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span>🕱 飾り罫線パレット</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono shrink-0">
            {decorTemplates.length}
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

            {/* 一括リセットボタン */}
            <div className="pt-2 flex flex-wrap items-center justify-start gap-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={handleResetHashtags}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs border border-slate-800 transition flex items-center gap-1.5 cursor-pointer"
                title="推奨の基本お気に入りハッシュタグ一覧に戻します"
              >
                <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                <span>初期デフォルトに戻す</span>
              </button>
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

            {/* 一括リセットボタン */}
            <div className="pt-2 flex flex-wrap items-center justify-start gap-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={handleResetTopics}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs border border-slate-800 transition flex items-center gap-1.5 cursor-pointer"
                title="推奨の基本Threadsトピック一覧に戻します"
              >
                <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
                <span>初期デフォルトに戻す</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === タブ4: 🎨 クイック装飾バー設定 === */}
      {activeSubTab === 'quick_decors' && (
        <div className="space-y-5">
          {/* 説明カード */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
            <Palette className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-slate-200">
                クイック装飾バー設定（初期登録アイテムの編集・追加・削除）
              </p>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                エディタの1行ツールバー「🎨 装飾」を開いた際に展開されるクイック装飾バーの項目（初期17種類）を設定できます。ワンクリックで挿入される文字や記号、ボタンラベル、カテゴリ（━ 罫線、【】囲み、1️⃣ 数字、😀 記号）を自由に変更・追加・削除できます。ここで設定した内容はエディタの装飾バーに即時反映されます。
              </p>
            </div>
          </div>

          {/* 新規装飾追加フォーム */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-pink-400" />
                <span>新規クイック装飾の登録</span>
              </label>
              {!isAddingQuickDecor && (
                <button
                  type="button"
                  onClick={() => setIsAddingQuickDecor(true)}
                  className="px-3 py-1 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>＋ 新規装飾を追加</span>
                </button>
              )}
            </div>

            {isAddingQuickDecor && (
              <form onSubmit={handleAddNewQuickDecor} className="space-y-3 pt-1 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300">ボタンラベル (表示文字):</label>
                    <input
                      type="text"
                      value={newQdLabel}
                      onChange={(e) => setNewQdLabel(e.target.value)}
                      placeholder="例: ━━━━, 【  】, ①"
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-pink-400 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300">カテゴリ分類:</label>
                    <select
                      value={newQdCategory}
                      onChange={(e) => setNewQdCategory(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-pink-400"
                    >
                      <option value="line">━ 罫線・区切り (line)</option>
                      <option value="box">【】囲み・見出し (box)</option>
                      <option value="number">1️⃣ 数字・リスト (number)</option>
                      <option value="emoji">😀 記号・絵文字 (emoji)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300">ツールチップ説明 (任意):</label>
                    <input
                      type="text"
                      value={newQdTitle}
                      onChange={(e) => setNewQdTitle(e.target.value)}
                      placeholder="例: 太二重線区切り"
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-pink-400"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                    <span>本文挿入テキスト:</span>
                    <span className="text-[10px] text-slate-500 font-normal">改行や特殊記号をそのまま含められます</span>
                  </label>
                  <textarea
                    rows={2}
                    value={newQdInsert}
                    onChange={(e) => setNewQdInsert(e.target.value)}
                    placeholder={'例: \\n━━━━━━━━━━━━━━━━━━━━\\n'}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg p-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-hidden focus:border-pink-400 whitespace-pre"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingQuickDecor(false);
                      setNewQdLabel('');
                      setNewQdInsert('');
                      setNewQdTitle('');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={!newQdLabel.trim() || !newQdInsert}
                    className="px-4 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>クイックバーに追加</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* 編集モーダル・インラインフォーム */}
          {editingQdItem && (
            <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/60 shadow-xl space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-xs text-white flex items-center gap-2">
                  <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>「{editingQdItem.label}」の編集</span>
                </span>
                <button
                  type="button"
                  onClick={() => setEditingQdItem(null)}
                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditQuickDecor} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300">ボタンラベル:</label>
                    <input
                      type="text"
                      value={editQdLabel}
                      onChange={(e) => setEditQdLabel(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-amber-400 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300">カテゴリ:</label>
                    <select
                      value={editQdCategory}
                      onChange={(e) => setEditQdCategory(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-amber-400"
                    >
                      <option value="line">━ 罫線・区切り</option>
                      <option value="box">【】囲み・見出し</option>
                      <option value="number">1️⃣ 数字・リスト</option>
                      <option value="emoji">😀 記号・絵文字</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300">ツールチップ説明:</label>
                    <input
                      type="text"
                      value={editQdTitle}
                      onChange={(e) => setEditQdTitle(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">挿入テキスト:</label>
                  <textarea
                    rows={2}
                    value={editQdInsert}
                    onChange={(e) => setEditQdInsert(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs font-mono text-white focus:outline-hidden focus:border-amber-400 whitespace-pre"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingQdItem(null)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>変更を保存</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 検索・カテゴリフィルター・一覧 */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {[
                  { id: 'all', label: 'すべて' },
                  { id: 'line', label: '━ 罫線' },
                  { id: 'box', label: '【】囲み' },
                  { id: 'number', label: '1️⃣ 数字' },
                  { id: 'emoji', label: '😀 記号' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setQuickDecorCategoryFilter(cat.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                      quickDecorCategoryFilter === cat.id
                        ? 'bg-pink-600/30 text-pink-200 border-pink-500/60 shadow-xs'
                        : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-48">
                <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={quickDecorSearch}
                  onChange={(e) => setQuickDecorSearch(e.target.value)}
                  placeholder="装飾を検索..."
                  className="w-full bg-slate-900/90 border border-slate-800 rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-pink-400 transition"
                />
                {quickDecorSearch && (
                  <button
                    type="button"
                    onClick={() => setQuickDecorSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 装飾アイテムカード一覧 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {filteredQuickDecors.length === 0 ? (
                <div className="col-span-full py-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800/80">
                  {quickDecorSearch ? '検索に一致する装飾アイテムはありません' : '登録されている装飾アイテムがありません'}
                </div>
              ) : (
                filteredQuickDecors.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between gap-2 shadow-xs group"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700/80 text-white font-mono font-bold text-xs truncate">
                          {item.label}
                        </span>
                        <span className="text-[10px] text-pink-300/80 bg-pink-950/50 px-1.5 py-0.2 rounded border border-pink-800/40 shrink-0">
                          {item.category === 'line'
                            ? '罫線'
                            : item.category === 'box'
                            ? '囲み'
                            : item.category === 'number'
                            ? '数字'
                            : '記号'}
                        </span>
                      </div>
                      <span className="text-[10.5px] text-slate-500 truncate max-w-[100px]" title={item.title}>
                        {item.title || item.label}
                      </span>
                    </div>

                    {/* 挿入テキストプレビュー */}
                    <div className="p-2 rounded bg-slate-900 border border-slate-800/90 text-slate-300 font-mono text-[11px] whitespace-pre-wrap break-all select-all max-h-16 overflow-y-auto">
                      {item.insert}
                    </div>

                    {/* アクションボタン */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/70">
                      <button
                        type="button"
                        onClick={() => handleCopyText(item.insert, item.id)}
                        className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition cursor-pointer"
                        title="挿入テキストをコピー"
                      >
                        {copiedItem === item.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">コピー済</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>コピー</span>
                          </>
                        )}
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingQdItem(item);
                            setEditQdLabel(item.label);
                            setEditQdInsert(item.insert);
                            setEditQdTitle(item.title || '');
                            setEditQdCategory(item.category || 'emoji');
                          }}
                          className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-sky-300 hover:text-sky-200 border border-sky-500/40 text-[11px] font-medium transition flex items-center gap-1 cursor-pointer"
                          title="この装飾を編集"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>編集</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuickDecor(item)}
                          className="px-2 py-0.5 rounded bg-slate-900 hover:bg-rose-950/70 text-rose-300 hover:text-rose-200 border border-rose-500/40 text-[11px] font-medium transition flex items-center gap-1 cursor-pointer"
                          title="この装飾を削除"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>削除</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 初期化リセットボタン */}
            <div className="pt-2 flex flex-wrap items-center justify-start gap-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={handleResetQuickDecors}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs border border-slate-800 transition flex items-center gap-1.5 cursor-pointer"
                title="初期デフォルト一覧（17種類）に戻します"
              >
                <RotateCcw className="w-3.5 h-3.5 text-pink-400" />
                <span>初期デフォルトに戻す (17種類)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === タブ5: 🕱 飾り罫線・枠線パレット設定 === */}
      {activeSubTab === 'decor_templates' && (
        <div className="space-y-5">
          {/* 説明カード */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-slate-200">
                飾り罫線・枠線パレット設定（装飾ウインドウ初期アイテム設定）
              </p>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                エディタの装飾ウインドウ（「𝕱 パレット」）の「飾り罫線・枠線」タブに初期登録されているテンプレート項目（初期24種類）を設定・管理できます。見出しや囲み枠、二重ライン、箇条書き、顔文字の追加・編集・削除や初期化が可能です。「バー登録」を押すとクイック装飾バーにも連携追加されます。
              </p>
            </div>
          </div>

          {/* 新規テンプレート追加フォーム */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-indigo-400" />
                <span>新規飾り罫線・枠線の登録</span>
              </label>
              {!isAddingDecorTemplate && (
                <button
                  type="button"
                  onClick={() => setIsAddingDecorTemplate(true)}
                  className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>＋ 新規枠線・罫線を追加</span>
                </button>
              )}
            </div>

            {isAddingDecorTemplate && (
              <form onSubmit={handleAddNewDecorTemplate} className="space-y-3 pt-1 animate-in fade-in duration-150">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300">装飾アイテム名:</label>
                    <input
                      type="text"
                      value={newDtName}
                      onChange={(e) => setNewDtName(e.target.value)}
                      placeholder="例: ダイヤ二重ライン (◆═◆)"
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300">カテゴリ分類:</label>
                    <select
                      value={newDtCategory}
                      onChange={(e) => setNewDtCategory(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-indigo-400"
                    >
                      <option value="divider">区切り線・罫線 (divider)</option>
                      <option value="box">囲み枠・ボックス (box)</option>
                      <option value="headers">見出し・タイトル (headers)</option>
                      <option value="bullets">箇条書き・リスト (bullets)</option>
                      <option value="emoticons">特殊記号・顔文字 (emoticons)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                    <span>装飾テキスト（改行や特殊記号をそのまま挿入）:</span>
                    <span className="text-[10px] text-slate-500 font-normal">等幅プレビュー表示</span>
                  </label>
                  <textarea
                    rows={3}
                    value={newDtContent}
                    onChange={(e) => setNewDtContent(e.target.value)}
                    placeholder={'━━━━━━━━━━━━━━━━━━━━\n✦ ──────────────── ✦'}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg p-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-hidden focus:border-indigo-400 whitespace-pre"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingDecorTemplate(false);
                      setNewDtName('');
                      setNewDtContent('');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={!newDtName.trim() || !newDtContent.trim()}
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>パレットに追加</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* 編集モーダル・インラインフォーム */}
          {editingDtItem && (
            <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/60 shadow-xl space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="font-bold text-xs text-white flex items-center gap-2">
                  <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>「{editingDtItem.name}」の編集</span>
                </span>
                <button
                  type="button"
                  onClick={() => setEditingDtItem(null)}
                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditDecorTemplate} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300">装飾アイテム名:</label>
                    <input
                      type="text"
                      value={editDtName}
                      onChange={(e) => setEditDtName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-amber-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300">カテゴリ分類:</label>
                    <select
                      value={editDtCategory}
                      onChange={(e) => setEditDtCategory(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-amber-400"
                    >
                      <option value="divider">区切り線・罫線</option>
                      <option value="box">囲み枠・ボックス</option>
                      <option value="headers">見出し・タイトル</option>
                      <option value="bullets">箇条書き・リスト</option>
                      <option value="emoticons">特殊記号・顔文字</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300">装飾テキスト:</label>
                  <textarea
                    rows={3}
                    value={editDtContent}
                    onChange={(e) => setEditDtContent(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs font-mono text-white focus:outline-hidden focus:border-amber-400 whitespace-pre"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingDtItem(null)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>変更を保存</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* 検索・カテゴリフィルター・一覧 */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {[
                  { id: 'all', label: 'すべて' },
                  { id: 'divider', label: '区切り線' },
                  { id: 'box', label: '囲み枠' },
                  { id: 'headers', label: '見出し' },
                  { id: 'bullets', label: '箇条書き' },
                  { id: 'emoticons', label: '顔文字' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setDecorCategoryFilter(cat.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                      decorCategoryFilter === cat.id
                        ? 'bg-indigo-600/30 text-indigo-200 border-indigo-500/60 shadow-xs'
                        : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-48">
                <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={decorSearch}
                  onChange={(e) => setDecorSearch(e.target.value)}
                  placeholder="罫線・枠線を検索..."
                  className="w-full bg-slate-900/90 border border-slate-800 rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-indigo-400 transition"
                />
                {decorSearch && (
                  <button
                    type="button"
                    onClick={() => setDecorSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </div>

            {/* 飾り罫線カード一覧 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredDecorTemplates.length === 0 ? (
                <div className="col-span-full py-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800/80">
                  {decorSearch ? '検索に一致する飾り罫線はありません' : '登録されている飾り罫線がありません'}
                </div>
              ) : (
                filteredDecorTemplates.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between gap-2.5 shadow-xs group"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-bold text-slate-200 group-hover:text-indigo-300 transition-colors truncate">
                          {item.name}
                        </span>
                        {item.isCustom && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 shrink-0">
                            カスタム
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 shrink-0">
                        {item.category === 'divider'
                          ? '区切り線'
                          : item.category === 'box'
                          ? '囲み枠'
                          : item.category === 'headers'
                          ? '見出し'
                          : item.category === 'bullets'
                          ? '箇条書き'
                          : '顔文字'}
                      </span>
                    </div>

                    {/* プレビュー表示 */}
                    <pre className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 font-mono text-xs whitespace-pre-wrap break-all select-all leading-relaxed max-h-28 overflow-y-auto">
                      {item.content}
                    </pre>

                    {/* アクションボタン */}
                    <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-800/70">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAddTemplateToQuickBar(item)}
                          className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 hover:text-amber-200 border border-amber-500/40 text-xs font-medium transition flex items-center gap-1 cursor-pointer shadow-xs"
                          title="クイック装飾バーに登録"
                        >
                          <Star className="w-3 h-3 text-amber-400" />
                          <span className="text-[11px]">バー登録</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopyText(item.content, item.id)}
                          className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition flex items-center gap-1 cursor-pointer shadow-xs"
                          title="クリップボードにコピー"
                        >
                          {copiedItem === item.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-[11px] text-emerald-400">コピー済</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span className="text-[11px]">コピー</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDtItem(item);
                            setEditDtName(item.name);
                            setEditDtCategory(item.category);
                            setEditDtContent(item.content);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-300 hover:text-sky-200 border border-sky-500/40 text-xs font-medium transition flex items-center gap-1 cursor-pointer shadow-xs"
                          title="この装飾を編集"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>編集</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDecorTemplate(item)}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-rose-950/70 text-rose-300 hover:text-rose-200 border border-rose-500/40 text-xs font-medium transition flex items-center gap-1 cursor-pointer shadow-xs"
                          title="この装飾を削除"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>削除</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 初期化リセットボタン */}
            <div className="pt-2 flex flex-wrap items-center justify-start gap-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={handleResetDecorTemplates}
                className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs border border-slate-800 transition flex items-center gap-1.5 cursor-pointer"
                title="初期デフォルト一覧（24種類）に戻します"
              >
                <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
                <span>初期デフォルトに戻す (24種類)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== インポート（アップロード）確認モーダル ==================== */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* モーダルヘッダー */}
            <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
                  <Upload className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-white">
                  データ読み込み（インポート）の確認
                </h4>
              </div>
              <button
                type="button"
                onClick={() => {
                  setImportModalOpen(false);
                  setParsedImportData(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* モーダルボディ */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {parsedImportData && !parsedImportData.success ? (
                <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-rose-200">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>ファイルの読み込みに失敗しました</span>
                  </div>
                  <p className="text-xs text-rose-300/90 leading-relaxed">
                    {parsedImportData.error || '有効なJSONファイルではありません。形式を確認してください。'}
                  </p>
                </div>
              ) : parsedImportData && parsedImportData.success ? (
                <>
                  {/* データサマリー */}
                  <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between text-slate-300 border-b border-slate-800 pb-2">
                      <span className="font-bold flex items-center gap-1.5 text-white">
                        <FileJson className="w-4 h-4 text-sky-400" />
                        <span>検出されたデータ内訳</span>
                      </span>
                      {parsedImportData.stats?.exportedAtJst && (
                        <span className="text-[10px] text-slate-400">
                          出力日時: {parsedImportData.stats.exportedAtJst}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-[11px] text-slate-400 block">🏷️ お気に入りハッシュタグ</span>
                        <span className="text-sm font-bold text-sky-400 font-mono">
                          {parsedImportData.customHashtags.length} 件
                        </span>
                      </div>

                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-[11px] text-slate-400 block">💬 Threadsトピック</span>
                        <span className="text-sm font-bold text-purple-400 font-mono">
                          {parsedImportData.threadsTopics.length} 件
                        </span>
                      </div>

                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-[11px] text-slate-400 block">📂 トレンド・カテゴリ</span>
                        <span className="text-sm font-bold text-emerald-400 font-mono">
                          {parsedImportData.categories.length} カテゴリ ({parsedImportData.stats?.categoryTagsCount || 0} タグ)
                        </span>
                      </div>

                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-[11px] text-slate-400 block">📑 定型文（スニペット）</span>
                        <span className="text-sm font-bold text-amber-400 font-mono">
                          {parsedImportData.snippets.length} 件
                        </span>
                      </div>

                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-[11px] text-slate-400 block">🎨 装飾クイックバー</span>
                        <span className="text-sm font-bold text-pink-400 font-mono">
                          {parsedImportData.quickDecorations.length} 件
                        </span>
                      </div>

                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                        <span className="text-[11px] text-slate-400 block">𝕱 飾り罫線・枠線パレット</span>
                        <span className="text-sm font-bold text-indigo-400 font-mono">
                          {parsedImportData.decorationTemplates.length} 件
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 取り込み方式の選択 */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-200 block">
                      取り込み方法の選択:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setImportMode('merge')}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                          importMode === 'merge'
                            ? 'bg-sky-950/60 border-sky-500/80 text-white shadow-xs'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs flex items-center gap-1.5 text-sky-300">
                            <span>➕ 既存に追加（マージ）</span>
                          </span>
                          {importMode === 'merge' && <Check className="w-3.5 h-3.5 text-sky-400" />}
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                          現在の登録データを残し、新しいタグ・カテゴリ・定型文・装飾アイテムのみを追加します（重複はスキップ）。
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setImportMode('overwrite')}
                        className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                          importMode === 'overwrite'
                            ? 'bg-rose-950/60 border-rose-500/80 text-white shadow-xs'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs flex items-center gap-1.5 text-rose-300">
                            <span>⚠️ 完全上書き</span>
                          </span>
                          {importMode === 'overwrite' && <Check className="w-3.5 h-3.5 text-rose-400" />}
                        </div>
                        <p className="text-[10px] text-slate-400 leading-tight">
                          現在の登録データをすべて削除し、ファイルの内容で完全に置き換えます。
                        </p>
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* モーダルフッター */}
            <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setImportModalOpen(false);
                  setParsedImportData(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                キャンセル
              </button>

              {parsedImportData && parsedImportData.success && (
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={handleExecuteImport}
                  className={`px-4 py-2 rounded-xl text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm ${
                    importMode === 'overwrite'
                      ? 'bg-rose-600 hover:bg-rose-500'
                      : 'bg-sky-600 hover:bg-sky-500'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{importMode === 'overwrite' ? '完全上書きで登録' : '追加マージで登録'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* アクション確認モーダル */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        cancelLabel={confirmState.cancelLabel}
        variant={confirmState.variant}
        iconType={confirmState.iconType}
        onConfirm={confirmState.onConfirm}
        onClose={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
