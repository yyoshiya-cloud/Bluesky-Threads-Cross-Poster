import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  Search,
  Type,
  LayoutTemplate,
  HelpCircle,
  Plus,
  Star,
  Edit2,
  Trash2,
  RotateCcw,
  Save,
  AlertTriangle,
  Palette,
  Sliders,
} from 'lucide-react';
import {
  UNICODE_STYLES,
  UnicodeStyle,
  DECORATION_CATEGORIES,
  DecorationItem,
  addQuickDecoration,
  loadDecorationTemplatesFromStorage,
  saveDecorationTemplatesToStorage,
  addDecorationTemplate,
  updateDecorationTemplate,
  removeDecorationTemplate,
  resetDecorationTemplates,
  loadQuickDecorationsFromStorage,
  removeQuickDecoration,
  updateQuickDecoration,
  resetQuickDecorations,
  QuickDecorationItem,
} from '../utils/unicodeFontConverter';
import { ConfirmModal } from './ConfirmModal';

interface UnicodeDecoratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedText?: string;
  onInsertText: (text: string) => void;
  onNotify?: (msg: { type: 'success' | 'error' | 'warning' | 'info'; title: string; message: string }) => void;
  hideMaintenance?: boolean;
}

export const UnicodeDecoratorModal: React.FC<UnicodeDecoratorModalProps> = ({
  isOpen,
  onClose,
  selectedText = '',
  onInsertText,
  onNotify,
  hideMaintenance = false,
}) => {
  const [activeTab, setActiveTab] = useState<'fonts' | 'decorations' | 'quick'>('fonts');
  
  // フォント変換ステート
  const [inputText, setInputText] = useState(selectedText || 'CrossPost 2026');
  const [fontCategoryFilter, setFontCategoryFilter] = useState<string>('all');
  const [fontSearch, setFontSearch] = useState('');
  
  // 飾り罫線ステート（LocalStorageと同期）
  const [decorations, setDecorations] = useState<DecorationItem[]>(() => loadDecorationTemplatesFromStorage());
  const [activeDecorCategory, setActiveDecorCategory] = useState<string>('all');
  const [decorSearch, setDecorSearch] = useState('');

  // 編集モードおよび新規作成/編集フォーム（飾り罫線用）
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingItem, setEditingItem] = useState<DecorationItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<DecorationItem['category']>('divider');
  const [formContent, setFormContent] = useState('');
  const [formError, setFormError] = useState('');

  // クイック装飾ステート（LocalStorageと同期）
  const [quickDecors, setQuickDecors] = useState<QuickDecorationItem[]>(() => loadQuickDecorationsFromStorage());
  const [quickSearch, setQuickSearch] = useState('');
  const [quickCatFilter, setQuickCatFilter] = useState<'all' | 'line' | 'box' | 'number' | 'emoji'>('all');
  const [isEditingQuickMode, setIsEditingQuickMode] = useState(false);
  const [isAddingNewQuick, setIsAddingNewQuick] = useState(false);
  const [editingQuickItem, setEditingQuickItem] = useState<QuickDecorationItem | null>(null);
  const [formQdLabel, setFormQdLabel] = useState('');
  const [formQdInsert, setFormQdInsert] = useState('');
  const [formQdTitle, setFormQdTitle] = useState('');
  const [formQdCategory, setFormQdCategory] = useState<'line' | 'box' | 'number' | 'emoji'>('line');
  const [formQdError, setFormQdError] = useState('');

  // コピー/挿入/クイック追加フィードバック
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [insertedId, setInsertedId] = useState<string | null>(null);
  const [addedQuickId, setAddedQuickId] = useState<string | null>(null);

  // 確認モーダル状態
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

  // ストレージ同期イベントの購読
  useEffect(() => {
    const handleStorageUpdated = () => {
      setDecorations(loadDecorationTemplatesFromStorage());
      setQuickDecors(loadQuickDecorationsFromStorage());
    };
    window.addEventListener('crosspost_decoration_templates_updated', handleStorageUpdated);
    window.addEventListener('crosspost_quick_decorations_updated', handleStorageUpdated);
    return () => {
      window.removeEventListener('crosspost_decoration_templates_updated', handleStorageUpdated);
      window.removeEventListener('crosspost_quick_decorations_updated', handleStorageUpdated);
    };
  }, []);

  // モーダルが開いた時、選択中のテキストがあれば自動入力
  useEffect(() => {
    if (isOpen) {
      setDecorations(loadDecorationTemplatesFromStorage());
      setQuickDecors(loadQuickDecorationsFromStorage());
      if (selectedText && selectedText.trim().length > 0) {
        setInputText(selectedText.trim());
      } else if (!inputText) {
        setInputText('CrossPost 2026');
      }
    } else {
      // 閉じたときは編集モードをリセット
      setIsEditingMode(false);
      setIsAddingNew(false);
      setEditingItem(null);
      setFormError('');
      setIsEditingQuickMode(false);
      setIsAddingNewQuick(false);
      setEditingQuickItem(null);
      setFormQdError('');
    }
  }, [isOpen, selectedText]);

  // Escキーで閉じる
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (isAddingNew || editingItem) {
          setIsAddingNew(false);
          setEditingItem(null);
          setFormError('');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isAddingNew, editingItem, onClose]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard?.writeText?.(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1800);
  };

  const handleInsert = (text: string, id: string) => {
    onInsertText(text);
    setInsertedId(id);
    setTimeout(() => {
      setInsertedId((prev) => (prev === id ? null : prev));
      onClose();
    }, 300);
  };

  const handleAddToQuick = (label: string, insertText: string, id: string, title?: string) => {
    addQuickDecoration(label, insertText, title);
    setAddedQuickId(id);
    if (onNotify) {
      onNotify({
        type: 'success',
        title: 'クイック装飾バーに追加しました',
        message: `「${label}」をクイック装飾バーに登録しました。`,
      });
    }
    setTimeout(() => setAddedQuickId((prev) => (prev === id ? null : prev)), 2000);
  };

  // 新規追加フォームを開く
  const handleOpenAddNew = () => {
    setEditingItem(null);
    setFormName('');
    setFormCategory(activeDecorCategory !== 'all' ? (activeDecorCategory as any) : 'divider');
    setFormContent('');
    setFormError('');
    setIsAddingNew(true);
  };

  // 編集フォームを開く
  const handleOpenEdit = (item: DecorationItem) => {
    setIsAddingNew(false);
    setEditingItem(item);
    setFormName(item.name);
    setFormCategory(item.category);
    setFormContent(item.content);
    setFormError('');
  };

  // フォーム保存ハンドラ
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formName.trim();
    const cleanContent = formContent.trim();

    if (!cleanName) {
      setFormError('名称を入力してください');
      return;
    }
    if (!cleanContent) {
      setFormError('装飾・罫線テキストを入力してください');
      return;
    }

    if (editingItem) {
      const updated = updateDecorationTemplate({
        ...editingItem,
        name: cleanName,
        category: formCategory,
        content: formContent,
      });
      setDecorations(updated);
      setEditingItem(null);
      setFormError('');
      if (onNotify) {
        onNotify({
          type: 'success',
          title: '装飾アイテムを更新しました',
          message: `「${cleanName}」を更新しました。`,
        });
      }
    } else {
      const updated = addDecorationTemplate({
        name: cleanName,
        category: formCategory,
        content: formContent,
      });
      setDecorations(updated);
      setIsAddingNew(false);
      setFormError('');
      if (onNotify) {
        onNotify({
          type: 'success',
          title: '新規装飾アイテムを追加しました',
          message: `「${cleanName}」をパレットに登録しました。`,
        });
      }
    }
  };

  // 削除ハンドラ
  const handleDeleteItem = (item: DecorationItem) => {
    requestConfirm({
      title: '装飾アイテムの削除',
      message: `装飾アイテム「${item.name}」を削除してもよろしいですか？`,
      confirmLabel: '削除する',
      iconType: 'trash',
      variant: 'danger',
      onConfirm: () => {
        const updated = removeDecorationTemplate(item.id);
        setDecorations(updated);
        if (editingItem?.id === item.id) {
          setEditingItem(null);
          setFormError('');
        }
        if (onNotify) {
          onNotify({
            type: 'info',
            title: '装飾アイテムを削除しました',
            message: `「${item.name}」を削除しました。`,
          });
        }
      },
    });
  };

  // 初期デフォルトに戻す
  const handleResetDefaults = () => {
    requestConfirm({
      title: '飾り罫線パレットの初期化',
      message: '飾り罫線・枠線パレットのアイテムを初期状態（24種類）に戻しますか？\n※自作・編集した装飾アイテムはリセットされます。',
      confirmLabel: '初期デフォルトに戻す (24種類)',
      iconType: 'reset',
      variant: 'warning',
      onConfirm: () => {
        const reset = resetDecorationTemplates();
        setDecorations(reset);
        setIsAddingNew(false);
        setEditingItem(null);
        setFormError('');
        if (onNotify) {
          onNotify({
            type: 'info',
            title: 'パレットを初期化しました',
            message: '飾り罫線・枠線パレットを初期デフォルト状態に戻しました。',
          });
        }
      },
    });
  };

  // クイック装飾フォーム送信（追加または編集保存）
  const handleSaveQuickForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormQdError('');

    const cleanLabel = formQdLabel.trim();
    if (!cleanLabel) {
      setFormQdError('ボタンラベル（表示文字）を入力してください。');
      return;
    }
    if (!formQdInsert) {
      setFormQdError('本文挿入テキストを入力してください。');
      return;
    }

    if (editingQuickItem) {
      const updated = updateQuickDecoration(editingQuickItem.id, {
        label: cleanLabel,
        insert: formQdInsert,
        title: formQdTitle.trim() || undefined,
        category: formQdCategory,
      });
      setQuickDecors(updated);
      setEditingQuickItem(null);
      if (onNotify) {
        onNotify({
          type: 'success',
          title: 'クイック装飾を更新しました',
          message: `「${cleanLabel}」の変更を保存しました。`,
        });
      }
    } else {
      const updated = addQuickDecoration(cleanLabel, formQdInsert, formQdTitle.trim() || undefined, formQdCategory);
      setQuickDecors(updated);
      setIsAddingNewQuick(false);
      setFormQdLabel('');
      setFormQdInsert('');
      setFormQdTitle('');
      if (onNotify) {
        onNotify({
          type: 'success',
          title: '新規クイック装飾を追加しました',
          message: `「${cleanLabel}」をクイック装飾バーに登録しました。`,
        });
      }
    }
  };

  // クイック装飾削除
  const handleDeleteQuickItem = (item: QuickDecorationItem) => {
    requestConfirm({
      title: 'クイック装飾の削除',
      message: `クイック装飾「${item.label}」を削除してもよろしいですか？`,
      confirmLabel: '削除する',
      iconType: 'trash',
      variant: 'danger',
      onConfirm: () => {
        const updated = removeQuickDecoration(item.id);
        setQuickDecors(updated);
        if (editingQuickItem?.id === item.id) {
          setEditingQuickItem(null);
          setFormQdError('');
        }
        if (onNotify) {
          onNotify({
            type: 'info',
            title: 'クイック装飾を削除しました',
            message: `「${item.label}」を削除しました。`,
          });
        }
      },
    });
  };

  // クイック装飾初期デフォルトに戻す
  const handleResetQuickDefaults = () => {
    requestConfirm({
      title: 'クイック装飾バーの初期化',
      message: 'クイック装飾バーを初期デフォルト一覧（17種類）に戻しますか？\n※追加・編集したクイック装飾はリセットされます。',
      confirmLabel: '初期デフォルトに戻す (17種類)',
      iconType: 'reset',
      variant: 'warning',
      onConfirm: () => {
        const reset = resetQuickDecorations();
        setQuickDecors(reset);
        setIsAddingNewQuick(false);
        setEditingQuickItem(null);
        setFormQdError('');
        if (onNotify) {
          onNotify({
            type: 'info',
            title: 'クイック装飾バーを初期化しました',
            message: 'クイック装飾バーを初期デフォルト一覧に戻しました。',
          });
        }
      },
    });
  };

  // フィルタリングされたクイック装飾
  const filteredQuickDecors = useMemo(() => {
    return quickDecors.filter((item) => {
      if (quickCatFilter !== 'all' && (item.category || 'emoji') !== quickCatFilter) {
        return false;
      }
      if (quickSearch.trim()) {
        const q = quickSearch.toLowerCase();
        return (
          item.label.toLowerCase().includes(q) ||
          item.insert.toLowerCase().includes(q) ||
          (item.title && item.title.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [quickDecors, quickCatFilter, quickSearch]);

  const handleOpenSettingsMaintenance = () => {
    onClose();
    window.dispatchEvent(new CustomEvent('crosspost_open_settings_maintenance'));
    window.dispatchEvent(new CustomEvent('crosspost_set_maintenance_subtab', { detail: 'decor_templates' }));
  };

  // フィルタリングされたフォントスタイル
  const filteredStyles = useMemo(() => {
    return UNICODE_STYLES.filter((style) => {
      if (fontCategoryFilter !== 'all' && style.category !== fontCategoryFilter) {
        return false;
      }
      if (fontSearch.trim()) {
        const q = fontSearch.toLowerCase();
        return style.name.toLowerCase().includes(q) || style.sample.toLowerCase().includes(q);
      }
      return true;
    });
  }, [fontCategoryFilter, fontSearch]);

  // フィルタリングされた装飾テンプレート
  const filteredDecorations = useMemo(() => {
    return decorations.filter((item) => {
      if (activeDecorCategory !== 'all' && item.category !== activeDecorCategory) {
        return false;
      }
      if (decorSearch.trim()) {
        const q = decorSearch.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.content.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [decorations, activeDecorCategory, decorSearch]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* モーダルヘッダー */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>特殊フォント ＆ 飾り罫線パレット</span>
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-purple-950/60 text-purple-300 border border-purple-800/60">
                  Unicode
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                太字・筆記体・囲み文字への変換や、見栄えを整える枠線・見出しをワンクリック挿入
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!hideMaintenance && (
              <button
                type="button"
                onClick={handleOpenSettingsMaintenance}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-purple-300 hover:text-white border border-purple-500/40 text-xs font-bold transition cursor-pointer shadow-xs"
                title="設定メニューの装飾メンテナンスを開く"
              >
                <Sliders className="w-3.5 h-3.5 text-purple-400" />
                <span>⚙️ 詳細設定</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="閉じる (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* タブ切り替え（セグメントコントロール） */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-800/80 bg-slate-950/40 shrink-0 flex items-center justify-between gap-3">
          <div className="p-1 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-3 gap-1 w-full max-w-md">
            <button
              type="button"
              onClick={() => setActiveTab('fonts')}
              className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'fonts'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>特殊フォント</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('decorations')}
              className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'decorations'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <LayoutTemplate className="w-3.5 h-3.5" />
              <span>飾り罫線・枠線</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('quick')}
              className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'quick'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>クイック装飾バー</span>
            </button>
          </div>

          <span className="text-[11px] text-slate-400 hidden sm:flex items-center gap-1">
            <HelpCircle className="w-3 h-3 text-slate-500" />
            <span>Bluesky / Threads の両方でそのまま表示されます</span>
          </span>
        </div>

        {/* モーダルコンテンツ本体 */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* ======================= 1. 特殊フォント変換タブ ======================= */}
          {activeTab === 'fonts' && (
            <div className="space-y-4">
              
              {/* 入力欄 */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                  <span>変換したいテキスト（半角英数字・記号対応）:</span>
                  {selectedText && (
                    <span className="text-[10px] text-purple-300 bg-purple-950/50 px-1.5 py-0.5 rounded border border-purple-800/40">
                      エディタ選択テキスト適用中
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="例: CrossPost Studio 2026, New Release!"
                    className="w-full bg-slate-900 border border-slate-700/90 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 font-sans shadow-inner placeholder:text-slate-600"
                  />
                  {inputText && (
                    <button
                      type="button"
                      onClick={() => setInputText('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* クイックカテゴリ ＆ 検索バー */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {[
                    { id: 'all', label: 'すべて' },
                    { id: 'bold', label: '太字 (Bold)' },
                    { id: 'script', label: '筆記体 (Script)' },
                    { id: 'circle', label: '丸囲み (Circle)' },
                    { id: 'square', label: '四角囲み (Square)' },
                    { id: 'gothic', label: 'ゴシック (Fraktur)' },
                    { id: 'decor', label: '下線/取り消し線' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setFontCategoryFilter(cat.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer border ${
                        fontCategoryFilter === cat.id
                          ? 'bg-purple-600/30 text-purple-200 border-purple-500/60 shadow-xs'
                          : 'bg-slate-950/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-44 shrink-0">
                  <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={fontSearch}
                    onChange={(e) => setFontSearch(e.target.value)}
                    placeholder="スタイル検索..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-purple-500 placeholder:text-slate-600"
                  />
                </div>
              </div>

              {/* 変換スタイル一覧 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredStyles.map((style) => {
                  const converted = inputText ? style.convert(inputText) : style.sample;
                  const isCopied = copiedId === style.id;
                  const isInserted = insertedId === style.id;

                  return (
                    <div
                      key={style.id}
                      className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700/80 transition flex flex-col justify-between gap-2 group"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-300 group-hover:text-purple-300 transition-colors">
                          {style.name}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {style.category}
                        </span>
                      </div>

                      {/* 変換プレビュー表示 */}
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 text-white font-sans text-sm break-all select-all min-h-[42px] flex items-center">
                        <span className="leading-snug">{converted || '(テキストを入力してください)'}</span>
                      </div>

                      {/* アクションボタン */}
                      <div className="flex items-center justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleAddToQuick(converted.slice(0, 8), converted, style.id, style.name)}
                          disabled={!converted}
                          className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 hover:text-amber-200 border border-amber-500/40 text-xs font-medium transition flex items-center gap-1 cursor-pointer disabled:opacity-30 shadow-xs"
                          title="クイック装飾バーに登録"
                        >
                          {addedQuickId === style.id ? (
                            <>
                              <Check className="w-3 h-3 text-amber-400" />
                              <span className="text-[11px] text-amber-300">登録済</span>
                            </>
                          ) : (
                            <>
                              <Star className="w-3 h-3 text-amber-400" />
                              <span className="text-[11px]">登録</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopy(converted, style.id)}
                          disabled={!converted}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition flex items-center gap-1 cursor-pointer disabled:opacity-30 shadow-xs"
                          title="クリップボードにコピー"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">コピー完了</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-slate-400" />
                              <span>コピー</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleInsert(converted, style.id)}
                          disabled={!converted}
                          className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-30 shadow-xs"
                          title="エディタに挿入"
                        >
                          {isInserted ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>挿入完了</span>
                            </>
                          ) : (
                            <>
                              <span>挿入する</span>
                              <ArrowRight className="w-3 h-3" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ======================= 2. 飾り罫線・枠線パレットタブ ======================= */}
          {activeTab === 'decorations' && (
            <div className="space-y-4">
              
              {/* ツールバー: カテゴリフィルター、検索、編集・新規追加 */}
              <div className="flex flex-col gap-2.5 bg-slate-950/70 border border-slate-800 rounded-xl p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* カテゴリ切り替えボタン群 */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveDecorCategory('all')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer border ${
                        activeDecorCategory === 'all'
                          ? 'bg-purple-600/30 text-purple-200 border-purple-500/60 shadow-xs'
                          : 'bg-slate-950/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800'
                      }`}
                    >
                      すべて ({decorations.length})
                    </button>

                    {DECORATION_CATEGORIES.map((cat) => {
                      const count = decorations.filter((d) => d.category === cat.id).length;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setActiveDecorCategory(cat.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer border flex items-center gap-1 ${
                            activeDecorCategory === cat.id
                              ? 'bg-purple-600/30 text-purple-200 border-purple-500/60 shadow-xs'
                              : 'bg-slate-950/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800'
                          }`}
                        >
                          <span>{cat.icon}</span>
                          <span>{cat.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">({count})</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* パレット管理アクションボタン (新規追加・編集モード切替・初期化: hideMaintenance時は非表示) */}
                  {!hideMaintenance && (
                    <div className="flex items-center gap-1.5">
                      {!isAddingNew && !editingItem && (
                        <button
                          type="button"
                          onClick={handleOpenAddNew}
                          className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                          title="新しい飾り罫線・枠線をパレットに追加"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>新規追加</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingMode(!isEditingMode);
                          if (isEditingMode) {
                            setIsAddingNew(false);
                            setEditingItem(null);
                            setFormError('');
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer border shadow-xs ${
                          isEditingMode
                            ? 'bg-amber-600 text-white border-amber-500'
                            : 'bg-slate-900 hover:bg-slate-800 text-amber-300 hover:text-amber-200 border-amber-500/40'
                        }`}
                        title={isEditingMode ? '編集モードを終了' : '装飾項目の編集・削除モードに切替'}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>{isEditingMode ? '編集完了' : '編集'}</span>
                      </button>

                      {isEditingMode && (
                        <button
                          type="button"
                          onClick={handleResetDefaults}
                          className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/50 text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                          title="初期デフォルトの装飾一覧に戻す"
                        >
                          <RotateCcw className="w-3 h-3 text-rose-400" />
                          <span className="text-[11px]">初期化</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* 検索バー ＆ 編集モードインジケーター */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                  <div className="flex items-center gap-2 text-xs">
                    {!hideMaintenance && isEditingMode ? (
                      <span className="text-amber-300 bg-amber-950/50 border border-amber-500/40 px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1">
                        <Edit2 className="w-3 h-3 text-amber-400" />
                        <span>編集モード稼働中：各アイテムの「編集」「削除」が可能です</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[11px]">
                        ワンクリックで本文挿入、または「コピー」でクリップボードに保存
                      </span>
                    )}
                  </div>

                  <div className="relative w-full sm:w-48 shrink-0">
                    <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={decorSearch}
                      onChange={(e) => setDecorSearch(e.target.value)}
                      placeholder="枠線・罫線検索..."
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-purple-500 placeholder:text-slate-600"
                    />
                  </div>
                </div>
              </div>

              {/* 新規登録・編集用インラインフォーム */}
              {!hideMaintenance && (isAddingNew || editingItem) && (
                <form
                  onSubmit={handleSaveForm}
                  className="p-4 rounded-xl bg-slate-950 border border-purple-500/60 shadow-xl space-y-3 animate-in fade-in slide-in-from-top-2"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-xs text-white flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span>{editingItem ? `「${editingItem.name}」の編集` : '新しい飾り罫線・枠線の登録'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingNew(false);
                        setEditingItem(null);
                        setFormError('');
                      }}
                      className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {formError && (
                    <div className="p-2 rounded bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300">装飾アイテム名:</label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="例: ダイヤ二重ライン (◆═◆)"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300">カテゴリ分類:</label>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                      >
                        {DECORATION_CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.icon} {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                      <span>装飾テキスト（改行や特殊記号をそのまま挿入）:</span>
                      <span className="text-[10px] text-slate-500">等幅プレビュー表示</span>
                    </label>
                    <textarea
                      rows={3}
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      placeholder={'━━━━━━━━━━━━━━━━━━━━\n✦ ──────────────── ✦'}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs font-mono text-white focus:outline-none focus:border-purple-500 whitespace-pre"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingNew(false);
                        setEditingItem(null);
                        setFormError('');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{editingItem ? '変更を保存' : 'パレットに追加'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* 罫線・枠線テンプレート一覧 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredDecorations.map((item) => {
                  const isCopied = copiedId === item.id;
                  const isInserted = insertedId === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl bg-slate-950/80 border transition flex flex-col justify-between gap-2.5 group ${
                        isEditingMode
                          ? 'border-amber-500/50 hover:border-amber-400 bg-amber-950/10'
                          : 'border-slate-800 hover:border-slate-700/80'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-200 group-hover:text-purple-300 transition-colors">
                            {item.name}
                          </span>
                          {item.isCustom && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950/80 text-purple-300 border border-purple-800/60">
                              カスタム
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500">
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
                      <pre className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 font-mono text-xs whitespace-pre-wrap break-all select-all leading-relaxed max-h-32 overflow-y-auto">
                        {item.content}
                      </pre>

                      {/* 操作ボタン */}
                      <div className="flex items-center justify-between gap-1.5 pt-0.5">
                        {/* 編集モード時のアクション (hideMaintenance時は非表示) */}
                        {!hideMaintenance && isEditingMode ? (
                          <div className="flex items-center gap-1.5 w-full justify-between">
                            <button
                              type="button"
                              onClick={() => handleAddToQuick(item.name.slice(0, 10), item.content, item.id, item.name)}
                              className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 hover:text-amber-200 border border-amber-500/40 text-xs font-medium transition flex items-center gap-1 cursor-pointer shadow-xs"
                              title="クイック装飾バーに登録"
                            >
                              <Star className="w-3 h-3 text-amber-400" />
                              <span className="text-[11px]">バー登録</span>
                            </button>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(item)}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-300 hover:text-sky-200 border border-sky-500/40 text-xs font-medium transition flex items-center gap-1 cursor-pointer shadow-xs"
                                title="この装飾を編集"
                              >
                                <Edit2 className="w-3 h-3 text-sky-400" />
                                <span>編集</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item)}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-rose-950/70 text-rose-300 hover:text-rose-200 border border-rose-500/40 text-xs font-medium transition flex items-center gap-1 cursor-pointer shadow-xs"
                                title="この装飾を削除"
                              >
                                <Trash2 className="w-3 h-3 text-rose-400" />
                                <span>削除</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* 通常モード時のアクション */
                          <div className="flex items-center justify-end gap-1.5 w-full">
                            {!hideMaintenance && (
                              <button
                                type="button"
                                onClick={() => handleAddToQuick(item.name.slice(0, 10), item.content, item.id, item.name)}
                                className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 hover:text-amber-200 border border-amber-500/40 text-xs font-medium transition flex items-center gap-1 cursor-pointer shadow-xs"
                                title="クイック装飾バーに登録"
                              >
                                {addedQuickId === item.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-amber-400" />
                                    <span className="text-[11px] text-amber-300">登録済</span>
                                  </>
                                ) : (
                                  <>
                                    <Star className="w-3 h-3 text-amber-400" />
                                    <span className="text-[11px]">登録</span>
                                  </>
                                )}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleCopy(item.content, item.id)}
                              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition flex items-center gap-1 cursor-pointer shadow-xs"
                              title="クリップボードにコピー"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400">コピー完了</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 text-slate-400" />
                                  <span>コピー</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleInsert(item.content, item.id)}
                              className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                              title="エディタに挿入"
                            >
                              {isInserted ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  <span>挿入完了</span>
                                </>
                              ) : (
                                <>
                                  <span>挿入する</span>
                                  <ArrowRight className="w-3 h-3" />
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ======================= 3. クイック装飾バー設定タブ ======================= */}
          {activeTab === 'quick' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* 操作バー */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
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
                        onClick={() => setQuickCatFilter(cat.id as any)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                          quickCatFilter === cat.id
                            ? 'bg-purple-600/30 text-purple-200 border-purple-500/60 shadow-xs'
                            : 'bg-slate-950/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-800'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {!hideMaintenance && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingNewQuick(!isAddingNewQuick);
                          if (isAddingNewQuick) {
                            setEditingQuickItem(null);
                            setFormQdError('');
                          } else {
                            setIsEditingQuickMode(false);
                            setFormQdLabel('');
                            setFormQdInsert('');
                            setFormQdTitle('');
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer border shadow-xs ${
                          isAddingNewQuick
                            ? 'bg-purple-600 text-white border-purple-500'
                            : 'bg-purple-600/20 hover:bg-purple-600/40 text-purple-200 border-purple-500/40'
                        }`}
                        title="新しい装飾をクイックバーに登録"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isAddingNewQuick ? 'キャンセル' : '新規追加'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingQuickMode(!isEditingQuickMode);
                          if (isEditingQuickMode) {
                            setIsAddingNewQuick(false);
                            setEditingQuickItem(null);
                            setFormQdError('');
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer border shadow-xs ${
                          isEditingQuickMode
                            ? 'bg-amber-600 text-white border-amber-500'
                            : 'bg-slate-900 hover:bg-slate-800 text-amber-300 hover:text-amber-200 border-amber-500/40'
                        }`}
                        title={isEditingQuickMode ? '編集モードを終了' : 'クイック装飾の編集・削除モードに切替'}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>{isEditingQuickMode ? '編集完了' : '編集'}</span>
                      </button>

                      {isEditingQuickMode && (
                        <button
                          type="button"
                          onClick={handleResetQuickDefaults}
                          className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/50 text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                          title="初期デフォルト一覧（17種類）に戻す"
                        >
                          <RotateCcw className="w-3 h-3 text-rose-400" />
                          <span className="text-[11px]">初期化</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* 検索バー */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                  <span className="text-slate-400 text-[11px]">
                    {!hideMaintenance && isEditingQuickMode
                      ? '編集モード稼働中：各装飾の「編集」「削除」が可能です'
                      : 'エディタの「🎨 装飾」バーに登録されているアイテム（初期17種類）です'}
                  </span>

                  <div className="relative w-full sm:w-48 shrink-0">
                    <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={quickSearch}
                      onChange={(e) => setQuickSearch(e.target.value)}
                      placeholder="装飾検索..."
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-200 focus:outline-hidden focus:border-purple-500 placeholder:text-slate-600"
                    />
                  </div>
                </div>
              </div>

              {/* 新規登録・編集用インラインフォーム */}
              {!hideMaintenance && (isAddingNewQuick || editingQuickItem) && (
                <form
                  onSubmit={handleSaveQuickForm}
                  className="p-4 rounded-xl bg-slate-950 border border-purple-500/60 shadow-xl space-y-3 animate-in fade-in duration-150"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-xs text-white flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                      <span>{editingQuickItem ? `「${editingQuickItem.label}」の編集` : '新しいクイック装飾の登録'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingNewQuick(false);
                        setEditingQuickItem(null);
                        setFormQdError('');
                      }}
                      className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {formQdError && (
                    <div className="p-2 rounded bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>{formQdError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300">ボタンラベル (表示文字):</label>
                      <input
                        type="text"
                        value={formQdLabel}
                        onChange={(e) => setFormQdLabel(e.target.value)}
                        placeholder="例: ━━━━, 【  】"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-purple-500 font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300">カテゴリ:</label>
                      <select
                        value={formQdCategory}
                        onChange={(e) => setFormQdCategory(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-purple-500"
                      >
                        <option value="line">━ 罫線・区切り</option>
                        <option value="box">【】囲み・見出し</option>
                        <option value="number">1️⃣ 数字・リスト</option>
                        <option value="emoji">😀 記号・絵文字</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-300">ツールチップ説明 (任意):</label>
                      <input
                        type="text"
                        value={formQdTitle}
                        onChange={(e) => setFormQdTitle(e.target.value)}
                        placeholder="例: 太二重線区切り"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-hidden focus:border-purple-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-300">本文挿入テキスト:</label>
                    <textarea
                      rows={2}
                      value={formQdInsert}
                      onChange={(e) => setFormQdInsert(e.target.value)}
                      placeholder={'例: \\n━━━━━━━━━━━━━━━━━━━━\\n'}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs font-mono text-white focus:outline-hidden focus:border-purple-500 whitespace-pre"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingNewQuick(false);
                        setEditingQuickItem(null);
                        setFormQdError('');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{editingQuickItem ? '変更を保存' : 'クイックバーに登録'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* クイック装飾カード一覧 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {filteredQuickDecors.length === 0 ? (
                  <div className="col-span-full py-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                    {quickSearch ? '検索に一致する装飾はありません' : '登録されている装飾はありません'}
                  </div>
                ) : (
                  filteredQuickDecors.map((item) => {
                    const isCopied = copiedId === item.id;
                    const isInserted = insertedId === item.id;

                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-xl bg-slate-950/80 border transition flex flex-col justify-between gap-2 group ${
                          isEditingQuickMode
                            ? 'border-amber-500/50 hover:border-amber-400 bg-amber-950/10'
                            : 'border-slate-800 hover:border-slate-700/80'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-white font-mono font-bold text-xs truncate">
                              {item.label}
                            </span>
                            <span className="text-[10px] text-purple-300/80 bg-purple-950/50 px-1.5 py-0.2 rounded border border-purple-800/40 shrink-0">
                              {item.category === 'line'
                                ? '罫線'
                                : item.category === 'box'
                                ? '囲み'
                                : item.category === 'number'
                                ? '数字'
                                : '記号'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 truncate max-w-[90px]" title={item.title}>
                            {item.title || item.label}
                          </span>
                        </div>

                        {/* プレビュー表示 */}
                        <div className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[11px] whitespace-pre-wrap break-all select-all max-h-16 overflow-y-auto">
                          {item.insert}
                        </div>

                        {/* 操作ボタン */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/70">
                          {!hideMaintenance && isEditingQuickMode ? (
                            <div className="flex items-center justify-end gap-1.5 w-full">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingQuickItem(item);
                                  setFormQdLabel(item.label);
                                  setFormQdInsert(item.insert);
                                  setFormQdTitle(item.title || '');
                                  setFormQdCategory(item.category || 'emoji');
                                  setIsAddingNewQuick(false);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-sky-300 hover:text-sky-200 border border-sky-500/40 text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                                title="この装飾を編集"
                              >
                                <Edit2 className="w-3 h-3 text-sky-400" />
                                <span>編集</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteQuickItem(item)}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-rose-950/70 text-rose-300 hover:text-rose-200 border border-rose-500/40 text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                                title="この装飾を削除"
                              >
                                <Trash2 className="w-3 h-3 text-rose-400" />
                                <span>削除</span>
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleCopy(item.insert, item.id)}
                                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition cursor-pointer"
                                title="挿入テキストをコピー"
                              >
                                {isCopied ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span className="text-emerald-400">コピー済</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 text-slate-400" />
                                    <span>コピー</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleInsert(item.insert, item.id)}
                                className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                                title="エディタに挿入"
                              >
                                {isInserted ? (
                                  <>
                                    <Check className="w-3 h-3" />
                                    <span>挿入済</span>
                                  </>
                                ) : (
                                  <>
                                    <span>挿入する</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </>
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* モーダルフッター */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <span>💡 日本語文章の一部を英字太字や囲み枠で装飾すると視認性が大幅にアップします</span>
          </div>
        </div>

      </div>

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
