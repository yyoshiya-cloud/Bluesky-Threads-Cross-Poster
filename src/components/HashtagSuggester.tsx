import React, { useState, useMemo, useEffect } from 'react';
import {
  Hash,
  Sparkles,
  TrendingUp,
  Plus,
  Check,
  ChevronDown,
  ChevronUp,
  Flame,
  Tag,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import {
  suggestHashtags,
  extractExistingHashtags,
  appendHashtagToText,
  appendMultipleHashtagsToText,
  toggleHashtagInText,
  TopicCategory,
  getSavedCustomTags,
  saveCustomTag,
  removeCustomTag,
  getSavedCategories,
} from '../utils/hashtagSuggester';

interface HashtagSuggesterProps {
  text: string;
  onUpdateText: (newText: string) => void;
}

export const HashtagSuggester: React.FC<HashtagSuggesterProps> = ({
  text,
  onUpdateText,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'suggestions' | 'trends'>('suggestions');
  const [customTagInput, setCustomTagInput] = useState('');
  const [justAddedTag, setJustAddedTag] = useState<string | null>(null);
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);
  const [saveToOriginalCategory, setSaveToOriginalCategory] = useState(true);

  // オリジナルカテゴリーに保存されたカスタムタグ一覧
  const [customTags, setCustomTags] = useState<string[]>(() => getSavedCustomTags());
  // トレンド・カテゴリ一覧
  const [categories, setCategories] = useState<TopicCategory[]>(() => getSavedCategories());

  // 外部からの更新イベントを購読
  useEffect(() => {
    const handleTagsUpdate = () => {
      setCustomTags(getSavedCustomTags());
    };
    const handleCategoriesUpdate = () => {
      setCategories(getSavedCategories());
    };
    window.addEventListener('crosspost_tags_updated', handleTagsUpdate);
    window.addEventListener('crosspost_categories_updated', handleCategoriesUpdate);
    return () => {
      window.removeEventListener('crosspost_tags_updated', handleTagsUpdate);
      window.removeEventListener('crosspost_categories_updated', handleCategoriesUpdate);
    };
  }, []);

  // カテゴリ一覧（「オリジナル」カテゴリーを先頭に配置）
  const allCategories = useMemo<TopicCategory[]>(() => {
    const originalCategory: TopicCategory = {
      name: 'オリジナル',
      icon: '⭐',
      tags: customTags,
    };
    return [originalCategory, ...categories];
  }, [customTags, categories]);

  const [selectedCategory, setSelectedCategory] = useState<string>('オリジナル');

  // カテゴリ削除等で選択中カテゴリが無くなった場合のフォールバック
  useEffect(() => {
    if (!allCategories.some((c) => c.name === selectedCategory)) {
      setSelectedCategory('オリジナル');
    }
  }, [allCategories, selectedCategory]);

  // 本文から既に含まれるハッシュタグを取得
  const existingTags = useMemo(() => {
    return new Set(extractExistingHashtags(text).map((t) => t.toLowerCase()));
  }, [text]);

  // 本文内容の解析によるサジェストタグ
  const suggestions = useMemo(() => {
    return suggestHashtags(text);
  }, [text]);

  // 未追加の提案タグ数
  const unaddedSuggestionsCount = useMemo(() => {
    return suggestions.filter((s) => !existingTags.has(s.tag.toLowerCase())).length;
  }, [suggestions, existingTags]);

  // タグの追加・取り消し（トグル）処理
  const handleToggleTag = (tag: string) => {
    const { text: updatedText, isAdded } = toggleHashtagInText(text, tag);
    onUpdateText(updatedText);

    if (isAdded) {
      setJustAddedTag(tag);
      setTimeout(() => setJustAddedTag(null), 1200);
    } else {
      setJustAddedTag(null);
      setNotificationMsg(`「#${tag}」を取り消しました`);
      setTimeout(() => {
        setNotificationMsg(null);
      }, 1800);
    }
  };

  const handleAddAllSuggestions = () => {
    const tagsToAdd = suggestions
      .map((s) => s.tag)
      .filter((t) => !existingTags.has(t.toLowerCase()));
    if (tagsToAdd.length === 0) return;
    const updated = appendMultipleHashtagsToText(text, tagsToAdd);
    onUpdateText(updated);
    setNotificationMsg(`${tagsToAdd.length}件のタグを追加しました`);
    setTimeout(() => setNotificationMsg(null), 2000);
  };

  const handleAddCustomTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTagInput.trim()) return;
    const clean = customTagInput.replace(/^#/, '').trim();
    if (clean) {
      // 1. 本文へ追加（まだ含まれていなければ）
      if (!existingTags.has(clean.toLowerCase())) {
        const updated = appendHashtagToText(text, clean);
        onUpdateText(updated);
        setJustAddedTag(clean);
        setTimeout(() => setJustAddedTag(null), 1200);
      }

      // 2. 「オリジナル」カテゴリーに保存
      if (saveToOriginalCategory) {
        const updated = saveCustomTag(clean);
        setCustomTags(updated);
        setNotificationMsg(`「#${clean}」をオリジナルカテゴリーに保存しました`);
        setTimeout(() => setNotificationMsg(null), 2500);
      }

      setCustomTagInput('');
    }
  };

  // 本文には追加せず、「オリジナル」カテゴリーにのみ保存する
  const handleSaveOnlyToOriginal = () => {
    if (!customTagInput.trim()) return;
    const clean = customTagInput.replace(/^#/, '').trim();
    if (clean) {
      const updated = saveCustomTag(clean);
      setCustomTags(updated);
      setNotificationMsg(`「#${clean}」をオリジナルカテゴリーに登録しました`);
      setTimeout(() => setNotificationMsg(null), 2500);
      setCustomTagInput('');
    }
  };

  // オリジナルカテゴリーからタグを完全に削除
  const handleRemoveFromOriginal = (e: React.MouseEvent, tag: string) => {
    e.stopPropagation();
    const updated = removeCustomTag(tag);
    setCustomTags(updated);
    setNotificationMsg(`「#${tag}」をオリジナルカテゴリーから削除しました`);
    setTimeout(() => setNotificationMsg(null), 2000);
  };

  return (
    <div
      id="hashtag-suggester-container"
      className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden transition-all shadow-sm"
    >
      {/* ヘッダー / トグルバー */}
      <div
        className="px-3 py-1.5 bg-slate-950/60 flex items-center justify-between cursor-pointer select-none hover:bg-slate-950/80 transition border-b border-slate-800/80"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-4.5 h-4.5 rounded-md bg-accent-subtle text-accent-light border border-accent flex items-center justify-center text-xs">
            <Hash className="w-3 h-3" />
          </div>
          <span className="text-xs font-bold text-slate-200">
            ハッシュタグ候補 & トレンド提案
          </span>
          {unaddedSuggestionsCount > 0 && (
            <span className="badge-accent text-[9px] px-1.5 py-0.2 rounded-full font-bold flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              {unaddedSuggestionsCount}件の関連タグ
            </span>
          )}
          {customTags.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[9px] font-bold flex items-center gap-1 hidden sm:flex">
              <Star className="w-2.5 h-2.5 text-amber-400" />
              <span>オリジナル {customTags.length}件</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {existingTags.size > 0 && (
            <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
              本文内: {existingTags.size}個
            </span>
          )}
          <button
            type="button"
            className="text-slate-400 hover:text-slate-200 p-0.5 rounded transition cursor-pointer"
            aria-label={isExpanded ? '折りたたむ' : '展開する'}
          >
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 展開時の中身 */}
      {isExpanded && (
        <div className="p-2.5 sm:p-3 space-y-2">
          {/* タブ切り替えバー */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-1.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('suggestions')}
                className={`px-2 py-0.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'suggestions'
                    ? 'bg-slate-800 text-accent-light border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span>本文からの推論候補</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('trends')}
                className={`px-2 py-0.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'trends'
                    ? 'bg-slate-800 text-accent-light border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <TrendingUp className="w-3 h-3" />
                <span>トレンド・カテゴリ一覧</span>
                {customTags.length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                )}
              </button>
            </div>

            {/* 一括追加ボタン (本文からの推論タブ時) */}
            {activeTab === 'suggestions' && unaddedSuggestionsCount > 1 && (
              <button
                type="button"
                onClick={handleAddAllSuggestions}
                className="text-[10px] font-bold text-accent-light hover:underline flex items-center gap-1 cursor-pointer"
                title="未追加の候補タグをすべて本文末尾に追加"
              >
                <Plus className="w-3 h-3" />
                <span>すべて追加</span>
              </button>
            )}
          </div>

          {/* タブ1: 本文からの推論サジェスト */}
          {activeTab === 'suggestions' && (
            <div className="space-y-2">
              {suggestions.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {suggestions.map((item) => {
                    const isAdded = existingTags.has(item.tag.toLowerCase());
                    const isJustAdded = justAddedTag === item.tag;

                    return (
                      <button
                        key={item.tag}
                        type="button"
                        onClick={() => handleToggleTag(item.tag)}
                        title={
                          isAdded
                            ? `「#${item.tag}」をクリックして取り消す`
                            : item.reason || `${item.category}関連のハッシュタグ（クリックで追加）`
                        }
                        className={`group px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 cursor-pointer select-none ${
                          isAdded
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/80 hover:bg-rose-950/60 hover:text-rose-300 hover:border-rose-500/60 shadow-sm'
                            : isJustAdded
                            ? 'bg-emerald-900 text-emerald-200 border border-emerald-500 scale-105'
                            : 'bg-slate-800/90 hover:bg-accent-subtle text-slate-200 hover:text-accent-light border border-slate-700/80 hover:border-accent shadow-sm active:scale-95'
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400 group-hover:hidden shrink-0" />
                            <X className="w-3 h-3 text-rose-400 hidden group-hover:block shrink-0" />
                          </>
                        ) : item.isTrending ? (
                          <Flame className="w-3 h-3 text-amber-400 shrink-0" />
                        ) : (
                          <Hash className="w-3 h-3 text-slate-400 group-hover:text-accent-light shrink-0" />
                        )}
                        <span>#{item.tag}</span>
                        {isAdded ? (
                          <>
                            <span className="text-[10px] text-emerald-400/80 group-hover:hidden font-normal">
                              (追加済)
                            </span>
                            <span className="text-[10px] text-rose-300 hidden group-hover:inline font-normal">
                              (解除)
                            </span>
                          </>
                        ) : (
                          item.category && (
                            <span className="text-[10px] text-slate-500 group-hover:text-slate-400 font-normal">
                              ({item.category})
                            </span>
                          )
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 py-1">
                  本文を入力すると、トピックやキーワードに応じたハッシュタグを自動解析して提案します。
                </p>
              )}
            </div>
          )}

          {/* タブ2: トレンド・カテゴリ別タグ */}
          {activeTab === 'trends' && (
            <div className="space-y-2.5">
              {/* カテゴリセレクター */}
              <div className="flex flex-wrap items-center gap-1">
                {allCategories.map((cat) => {
                  const isSelected = selectedCategory === cat.name;
                  const isOriginal = cat.name === 'オリジナル';

                  return (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setSelectedCategory(cat.name)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                        isSelected
                          ? isOriginal
                            ? 'bg-amber-950/90 text-amber-200 border border-amber-600/70 font-bold shadow-sm ring-1 ring-amber-500/30'
                            : 'bg-slate-800 text-slate-100 border border-slate-600 font-bold'
                          : isOriginal
                          ? 'text-amber-400/90 hover:text-amber-300 hover:bg-amber-950/40 border border-amber-800/40'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-950'
                      }`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                      {isOriginal && cat.tags.length > 0 && (
                        <span className="text-[10px] px-1 py-0.2 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                          {cat.tags.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* 選択されたカテゴリのタグ一覧 */}
              <div className="pt-1">
                {selectedCategory === 'オリジナル' ? (
                  customTags.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {customTags.map((tag) => {
                        const isAdded = existingTags.has(tag.toLowerCase());
                        const isJustAdded = justAddedTag === tag;

                        return (
                          <div
                            key={tag}
                            className={`group/item inline-flex items-center rounded-lg text-xs font-medium border transition overflow-hidden select-none ${
                              isAdded
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/80'
                                : isJustAdded
                                ? 'bg-emerald-900 text-emerald-200 border-emerald-700'
                                : 'bg-amber-950/20 text-amber-200 border-amber-700/40 hover:border-amber-500/70 hover:bg-amber-950/40'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleTag(tag)}
                              className={`px-2.5 py-1 flex items-center gap-1 cursor-pointer transition ${
                                isAdded ? 'hover:bg-rose-950/70 hover:text-rose-300' : ''
                              }`}
                              title={
                                isAdded
                                  ? `「#${tag}」をクリックして本文から取り消す`
                                  : `「#${tag}」を本文に追加`
                              }
                            >
                              {isAdded ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400 group-hover/item:hidden shrink-0" />
                                  <X className="w-3 h-3 text-rose-400 hidden group-hover/item:block shrink-0" />
                                </>
                              ) : (
                                <Star className="w-3 h-3 text-amber-400 shrink-0" />
                              )}
                              <span>#{tag}</span>
                              {isAdded && (
                                <>
                                  <span className="text-[10px] text-emerald-400/80 group-hover/item:hidden font-normal">
                                    (追加済)
                                  </span>
                                  <span className="text-[10px] text-rose-300 hidden group-hover/item:inline font-normal">
                                    (解除)
                                  </span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleRemoveFromOriginal(e, tag)}
                              className="px-1.5 py-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 border-l border-amber-900/40 transition cursor-pointer"
                              title={`オリジナルカテゴリーから「#${tag}」を完全に削除`}
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-950/50 rounded-xl border border-dashed border-amber-900/40 text-center space-y-1">
                      <div className="flex items-center justify-center gap-1 text-xs text-amber-300/90 font-bold">
                        <Star className="w-3.5 h-3.5 text-amber-400" />
                        <span>オリジナルカテゴリーはまだ空です</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        下の入力フォームに独自のハッシュタグを入力して「追加 & 保存」すると、ここに保存されて次回からいつでも再利用できます。
                      </p>
                    </div>
                  )
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {allCategories.find((c) => c.name === selectedCategory)?.tags.map((tag) => {
                      const isAdded = existingTags.has(tag.toLowerCase());
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleToggleTag(tag)}
                          title={
                            isAdded
                              ? `「#${tag}」をクリックして取り消す`
                              : `「#${tag}」を本文に追加`
                          }
                          className={`group px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1.5 cursor-pointer select-none ${
                            isAdded
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-600/80 hover:bg-rose-950/60 hover:text-rose-300 hover:border-rose-500/60 shadow-sm'
                              : 'bg-slate-800/80 hover:bg-accent-subtle text-slate-300 hover:text-accent-light border border-slate-700/70 hover:border-accent'
                          }`}
                        >
                          {isAdded ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400 group-hover:hidden shrink-0" />
                              <X className="w-3 h-3 text-rose-400 hidden group-hover:block shrink-0" />
                            </>
                          ) : (
                            <Plus className="w-3 h-3 text-slate-400 group-hover:text-accent-light shrink-0" />
                          )}
                          <span>#{tag}</span>
                          {isAdded && (
                            <>
                              <span className="text-[10px] text-emerald-400/80 group-hover:hidden font-normal">
                                (追加済)
                              </span>
                              <span className="text-[10px] text-rose-300 hidden group-hover:inline font-normal">
                                (解除)
                              </span>
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 下部：カスタムハッシュタグ追加＆オリジナル保存フォーム */}
          <div className="pt-2 border-t border-slate-800/60 space-y-1.5">
            <form
              onSubmit={handleAddCustomTag}
              className="flex flex-wrap sm:flex-nowrap items-center gap-2"
            >
              <div className="relative flex-1 min-w-[200px]">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-500">
                  <Tag className="w-3.5 h-3.5" />
                </div>
                <input
                  type="text"
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  placeholder="オリジナルのハッシュタグを入力 (例: 新機能リリース)"
                  className="w-full bg-slate-950/90 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus-ring-accent"
                />
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="submit"
                  disabled={!customTagInput.trim()}
                  className="px-3 py-1.5 rounded-lg btn-accent text-xs font-bold text-white flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition shadow-sm"
                  title="本文に追加し、オリジナルカテゴリーに保存します"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>追加 & 保存</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveOnlyToOriginal}
                  disabled={!customTagInput.trim()}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-600/40 text-xs font-semibold flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition"
                  title="本文には入れず、オリジナルカテゴリーにのみ登録（保存）します"
                >
                  <Star className="w-3 h-3 text-amber-400" />
                  <span className="hidden sm:inline">保存のみ</span>
                </button>
              </div>
            </form>

            {/* 保存オプション＆通知メッセージ */}
            <div className="flex items-center justify-between text-[11px] px-0.5 text-slate-400">
              <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-300 hover:text-white">
                <input
                  type="checkbox"
                  checked={saveToOriginalCategory}
                  onChange={(e) => setSaveToOriginalCategory(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-accent focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                />
                <span>「オリジナル」カテゴリーに保存する</span>
              </label>

              {notificationMsg && (
                <span className="text-amber-300 font-medium flex items-center gap-1 text-[10px]">
                  <Check className="w-3 h-3 text-emerald-400" />
                  {notificationMsg}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


