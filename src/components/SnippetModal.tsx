import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  FileText,
  Search,
  Check,
  RotateCcw,
  Copy,
  ArrowRight,
} from 'lucide-react';
import { SnippetItem } from '../types';
import {
  getSavedSnippets,
  saveSnippet,
  deleteSnippet,
  resetSnippetsToDefault,
} from '../utils/snippetStorage';

interface SnippetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertSnippet: (content: string, mode: 'append' | 'replace') => void;
  currentText: string;
}

type SnippetCategoryFilter = 'all' | SnippetItem['category'];

const CATEGORY_TABS: { id: SnippetCategoryFilter; label: string; icon: string }[] = [
  { id: 'all', label: 'すべて', icon: '✨' },
  { id: 'greeting', label: '挨拶・日常', icon: '☀️' },
  { id: 'announcement', label: '告知・案内', icon: '📢' },
  { id: 'blog', label: '記事更新', icon: '📝' },
  { id: 'dev', label: '開発・技術', icon: '☕' },
  { id: 'signature', label: '署名', icon: '✒️' },
  { id: 'custom', label: '自作', icon: '💡' },
];

export const SnippetModal: React.FC<SnippetModalProps> = ({
  isOpen,
  onClose,
  onInsertSnippet,
  currentText,
}) => {
  const [snippets, setSnippets] = useState<SnippetItem[]>(() => getSavedSnippets());
  const [selectedCategory, setSelectedCategory] = useState<SnippetCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // 作成・編集フォーム状態
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState<SnippetItem['category']>('custom');
  const [formIcon, setFormIcon] = useState('📑');
  const [formError, setFormError] = useState('');

  // 外部からの更新同期
  useEffect(() => {
    const handleUpdate = () => setSnippets(getSavedSnippets());
    window.addEventListener('crosspost_snippets_updated', handleUpdate);
    return () => window.removeEventListener('crosspost_snippets_updated', handleUpdate);
  }, []);

  if (!isOpen) return null;

  const filteredSnippets = snippets.filter((s) => {
    const matchesCategory = selectedCategory === 'all' || s.category === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleOpenCreate = () => {
    setEditId(null);
    setFormTitle('');
    setFormContent(currentText.trim() ? currentText : '');
    setFormCategory('custom');
    setFormIcon('📑');
    setFormError('');
    setIsEditing(true);
  };

  const handleOpenEdit = (snippet: SnippetItem) => {
    setEditId(snippet.id);
    setFormTitle(snippet.title);
    setFormContent(snippet.content);
    setFormCategory(snippet.category);
    setFormIcon(snippet.icon || '📑');
    setFormError('');
    setIsEditing(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('タイトルを入力してください。');
      return;
    }
    if (!formContent.trim()) {
      setFormError('定型文・テンプレート本文を入力してください。');
      return;
    }

    const updated = saveSnippet(
      {
        title: formTitle,
        content: formContent,
        category: formCategory,
        icon: formIcon,
      },
      editId || undefined
    );
    setSnippets(updated);
    setIsEditing(false);
    setEditId(null);
  };

  const handleDelete = (id: string, title: string) => {
    if (window.confirm(`定型文「${title}」を削除してもよろしいですか？`)) {
      const updated = deleteSnippet(id);
      setSnippets(updated);
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('定型文を初期プリセットに戻しますか？（作成した自作テンプレートもリセットされます）')) {
      const updated = resetSnippetsToDefault();
      setSnippets(updated);
    }
  };

  const handleCopy = (snippet: SnippetItem) => {
    navigator.clipboard.writeText(snippet.content).then(() => {
      setCopiedId(snippet.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        className="bg-[#12141a] border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100"
      >
        {/* モーダルヘッダー */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
                定型文・テンプレート管理
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                  {snippets.length}件
                </span>
              </h3>
              <p className="text-xs text-slate-400">よく使う決まり文句や署名、お知らせ文をワンクリックで挿入できます</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {!isEditing && (
              <button
                onClick={handleOpenCreate}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 transition cursor-pointer shadow-xs shadow-amber-500/20"
              >
                <Plus className="w-3.5 h-3.5" />
                新規作成
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 編集・新規作成フォーム */}
        {isEditing ? (
          <form onSubmit={handleSaveForm} className="p-5 overflow-y-auto space-y-4 flex-1">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-semibold text-sm text-slate-200 flex items-center gap-1.5">
                {editId ? '✏️ テンプレートの編集' : '✨ 新規テンプレートの作成'}
              </span>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                キャンセル
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-1">
                <label className="block text-xs text-slate-400 mb-1">アイコン (絵文字)</label>
                <input
                  type="text"
                  value={formIcon}
                  onChange={(e) => setFormIcon(e.target.value)}
                  maxLength={4}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-center text-lg text-slate-100 focus:outline-hidden focus:border-amber-400"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">タイトル</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="例: 朝の挨拶、定期告知、署名"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-amber-400"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="block text-xs text-slate-400 mb-1">カテゴリ</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-hidden focus:border-amber-400"
                >
                  <option value="greeting">挨拶・日常</option>
                  <option value="announcement">告知・案内</option>
                  <option value="blog">記事更新</option>
                  <option value="dev">開発・技術</option>
                  <option value="signature">署名・フッター</option>
                  <option value="custom">カスタム</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs text-slate-400">テンプレート本文</label>
                <span className="text-[10px] text-slate-500">{formContent.length}文字</span>
              </div>
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                rows={7}
                placeholder="よく使う投稿文、リンク、ハッシュタグなどを入力してください..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-amber-400 font-mono leading-relaxed resize-y"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow-xs"
              >
                {editId ? '変更を保存' : 'テンプレートを登録'}
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* 検索・カテゴリタブ */}
            <div className="px-5 py-3 border-b border-slate-800/80 bg-slate-900/30 space-y-2.5 shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="テンプレート名や本文キーワードで検索..."
                  className="w-full bg-slate-900/90 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-amber-400"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {CATEGORY_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedCategory(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                      selectedCategory === tab.id
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                        : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 border border-slate-800'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 一覧リスト */}
            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {filteredSnippets.length === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <FileText className="w-10 h-10 mx-auto stroke-1 opacity-40" />
                  <p className="text-xs">一致する定型文・テンプレートが見つかりませんでした。</p>
                </div>
              ) : (
                filteredSnippets.map((snippet) => (
                  <div
                    key={snippet.id}
                    className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/90 hover:border-slate-700 transition flex flex-col gap-3 group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl p-1.5 rounded-lg bg-slate-800/80 border border-slate-700/50">
                          {snippet.icon || '📑'}
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                            {snippet.title}
                            {snippet.isPreset && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-normal border border-slate-700">
                                プリセット
                              </span>
                            )}
                          </h4>
                          <span className="text-[10px] text-slate-400">
                            {snippet.categoryName || snippet.category} • {snippet.content.length}文字
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => handleCopy(snippet)}
                          className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                          title="クリップボードにコピー"
                        >
                          {copiedId === snippet.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleOpenEdit(snippet)}
                          className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition cursor-pointer"
                          title="編集"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(snippet.id, snippet.title)}
                          className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                          title="削除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* 本文プレビュー */}
                    <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60 font-mono text-[11px] text-slate-300 whitespace-pre-wrap max-h-28 overflow-y-auto leading-relaxed">
                      {snippet.content}
                    </div>

                    {/* 挿入アクションボタン */}
                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/40">
                      <button
                        onClick={() => {
                          onInsertSnippet(snippet.content, 'append');
                          onClose();
                        }}
                        className="px-3 py-1.5 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
                        title="現在のテキストの末尾に改行して追加"
                      >
                        <Plus className="w-3.5 h-3.5 text-amber-400" />
                        末尾に追加
                      </button>
                      <button
                        onClick={() => {
                          onInsertSnippet(snippet.content, 'replace');
                          onClose();
                        }}
                        className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                        title="エディタの内容をこのテンプレートで上書き"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                        これに置き換え
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* フッター */}
            <div className="px-5 py-3 border-t border-slate-800/80 bg-slate-900/40 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <button
                onClick={handleResetDefaults}
                className="hover:text-slate-300 flex items-center gap-1 transition cursor-pointer text-[11px]"
              >
                <RotateCcw className="w-3 h-3" />
                初期プリセットに戻す
              </button>
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};
