import React, { useState, useRef, useEffect } from 'react';
import { AttachedImage, SplitThreadItem, ApiCredentials, ThemeAccentId, ReplySettings, ReplyTargetInfo } from '../types';
import { compressImageFileWithThumbnail, processVideoFile } from '../utils/draftStorage';
import { saveMediaBlob } from '../utils/indexedMediaStorage';
import { uploadMediaItem } from '../utils/postApi';
import { CharCounter } from './CharCounter';
import { ImageAttachment } from './ImageAttachment';
import { HashtagSuggester } from './HashtagSuggester';
import { ThreadPreview } from './ThreadPreview';
import { SettingsModal } from './SettingsModal';
import { ServerVaultViewerModal } from './ServerVaultViewerModal';
import { QuickPresetSettingsModal } from './QuickPresetSettingsModal';
import { SnippetModal } from './SnippetModal';
import { SampleTextsModal } from './SampleTextsModal';
import { OgpPreviewSection } from './OgpPreviewSection';
import { AiAssistModal, AiAssistTab } from './AiAssistModal';
import { ReplySettingsSection } from './ReplySettingsSection';
import { UnicodeDecoratorModal } from './UnicodeDecoratorModal';
import {
  QuickDecorationItem,
  QuickDecorCategory,
  loadQuickDecorationsFromStorage,
  addQuickDecoration,
  removeQuickDecoration,
  resetQuickDecorations,
} from '../utils/unicodeFontConverter';
import {
  Send,
  Sparkles,
  Sliders,
  Hash,
  AlertCircle,
  Layers,
  CheckCircle2,
  Trash2,
  Loader2,
  Scissors,
  Clock,
  Calendar,
  Tag,
  Plus,
  RotateCcw,
  MessageSquare,
  X,
  Settings,
  Film,
  FileText,
  Split,
  Copy,
  Globe,
  ShieldCheck,
  Wand2,
  Image as ImageIcon,
  Link2,
  Type,
  Edit2,
  Check,
  Focus,
  Maximize2,
  Minimize2,
  Palette,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { QuickTimePreset, TargetPlatformCategory } from '../types';
import {
  getSavedThreadsTopics,
  addSavedThreadsTopic,
  removeSavedThreadsTopic,
  resetSavedThreadsTopics,
} from '../utils/topicStorage';
import {
  loadQuickPresetsFromStorage,
  getPlatformCategory,
  PLATFORM_CATEGORY_CONFIG,
} from '../utils/presetStorage';
import {
  formatToJstString,
  getJstDatetimeLocalValue,
  parseJstDatetimeLocal,
  getJstQuickPresets,
  getRelativeTimeJst,
} from '../utils/scheduledStorage';

interface EditorSectionProps {
  text: string;
  onChangeText: (text: string) => void;
  blueskyText?: string;
  onChangeBlueskyText?: (text: string) => void;
  threadsText?: string;
  onChangeThreadsText?: (text: string) => void;
  customPlatformText?: boolean;
  onToggleCustomPlatformText?: (val: boolean) => void;
  images: AttachedImage[];
  onAddImages: (imgs: AttachedImage[]) => void;
  onReorderImages?: (newImages: AttachedImage[]) => void;
  onRemoveImage: (id: string) => void;
  onClearImages: () => void;
  onUpdateImageAlt: (id: string, alt: string) => void;
  postToBluesky: boolean;
  onTogglePostToBluesky: (val: boolean) => void;
  postToThreads: boolean;
  onTogglePostToThreads: (val: boolean) => void;
  threadsTopic?: string;
  onChangeThreadsTopic?: (topic: string) => void;
  autoSplit: boolean;
  onToggleAutoSplit: (val: boolean) => void;
  includeNumbering: boolean;
  onToggleIncludeNumbering: (val: boolean) => void;
  blueskySplits: SplitThreadItem[];
  threadsSplits: SplitThreadItem[];
  credentials: ApiCredentials;
  isDemoMode?: boolean;
  onSubmitPost: () => void;
  onSchedulePost?: (scheduledAtTimestamp: number) => void;
  onOpenScheduledPosts?: () => void;
  scheduledPostsCount?: number;
  onOpenSettings: () => void;
  isSettingsOpen?: boolean;
  onToggleSettings?: () => void;
  onCloseSettings?: () => void;
  onSaveCredentials?: (creds: ApiCredentials) => void;
  currentTheme?: ThemeAccentId;
  onSelectTheme?: (theme: ThemeAccentId) => void;
  onLogout?: (platform?: 'all' | 'bluesky' | 'threads') => void;
  onDeleteSavedAccount?: (platform: 'bluesky' | 'threads') => void;
  onOpenUserGuide?: () => void;
  onOpenCommErrors?: () => void;
  onNotify?: (msg: { type: 'success' | 'error' | 'warning' | 'info'; title: string; message: string }) => void;
  lastSavedAt: number | null;
  draftStatus: 'saved' | 'saving' | 'error' | 'idle';
  draftError?: string;
  onClearDraft: () => void;
  replySettings?: ReplySettings;
  onUpdateReplySettings?: (settings: Partial<ReplySettings>) => void;
  onSetResolvedReplyTarget?: (platform: 'Bluesky' | 'Threads', target: ReplyTargetInfo) => void;
  onClearReplyTarget?: (platform?: 'Bluesky' | 'Threads') => void;
  onOpenServerVault?: () => void;
  isServerVaultOpen?: boolean;
  onCloseServerVault?: () => void;
  onToggleServerVault?: () => void;
  isAdminMode?: boolean;
  onOpenAdminModal?: () => void;
}

import { SAMPLE_TEXTS } from '../config/sampleTexts';

type EditorFontSize = 'sm' | 'md' | 'lg';

const EDITOR_FONT_SIZE_CONFIG: Record<EditorFontSize, { label: string; textClass: string }> = {
  sm: { label: '小', textClass: 'text-xs leading-relaxed' },
  md: { label: '中', textClass: 'text-sm leading-relaxed' },
  lg: { label: '大', textClass: 'text-base leading-relaxed' },
};

export const EditorSection: React.FC<EditorSectionProps> = ({
  text,
  onChangeText,
  blueskyText = '',
  onChangeBlueskyText,
  threadsText = '',
  onChangeThreadsText,
  customPlatformText = false,
  onToggleCustomPlatformText,
  images,
  onAddImages,
  onReorderImages,
  onRemoveImage,
  onClearImages,
  onUpdateImageAlt,
  postToBluesky,
  onTogglePostToBluesky,
  postToThreads,
  onTogglePostToThreads,
  threadsTopic = '',
  onChangeThreadsTopic,
  autoSplit,
  onToggleAutoSplit,
  includeNumbering,
  onToggleIncludeNumbering,
  blueskySplits,
  threadsSplits,
  credentials,
  isDemoMode,
  onSubmitPost,
  onSchedulePost,
  onOpenScheduledPosts,
  scheduledPostsCount = 0,
  onOpenSettings,
  isSettingsOpen = false,
  onToggleSettings,
  onCloseSettings,
  onSaveCredentials,
  currentTheme = 'sky',
  onSelectTheme,
  onLogout,
  onDeleteSavedAccount,
  onOpenUserGuide,
  onOpenCommErrors,
  onNotify,
  lastSavedAt,
  draftStatus,
  draftError,
  onClearDraft,
  replySettings,
  onUpdateReplySettings,
  onSetResolvedReplyTarget,
  onClearReplyTarget,
  onOpenServerVault,
  isServerVaultOpen = false,
  onCloseServerVault,
  onToggleServerVault,
  isAdminMode = false,
  onOpenAdminModal,
}) => {
  const [showSamples, setShowSamples] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // エディタタブ状態: 'common' (共通ベース) | 'bluesky' (Bluesky個別) | 'threads' (Threads個別)
  const [activeEditorTab, setActiveEditorTab] = useState<'common' | 'bluesky' | 'threads'>('common');
  // スニペット（定型文・テンプレート）モーダル表示状態
  const [isSnippetModalOpen, setIsSnippetModalOpen] = useState(false);
  // 特殊フォント＆飾り罫線モーダル表示状態
  const [isUnicodeModalOpen, setIsUnicodeModalOpen] = useState(false);
  const [selectedEditorText, setSelectedEditorText] = useState('');
  // クイック装飾アイテム状態（登録・削除可能・カテゴリ分類）
  const [quickDecorations, setQuickDecorations] = useState<QuickDecorationItem[]>(() => loadQuickDecorationsFromStorage());
  const [selectedDecorCategory, setSelectedDecorCategory] = useState<QuickDecorCategory>('all');
  const [isManagingQuickDecor, setIsManagingQuickDecor] = useState(false);
  const [isAddingQuickDecor, setIsAddingQuickDecor] = useState(false);
  const [newQuickLabel, setNewQuickLabel] = useState('');
  const [newQuickInsert, setNewQuickInsert] = useState('');
  const [newQuickCategory, setNewQuickCategory] = useState<'line' | 'box' | 'number' | 'emoji'>('line');

  // 装飾機能の折りたたみメニュー表示状態（localStorageに永続保存・初期値はすっきりしたエディタのため折りたたみ状態）
  const [isDecorMenuOpen, setIsDecorMenuOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('crosspost_decor_menu_open');
      return saved !== null ? saved === 'true' : false;
    } catch {
      return false;
    }
  });

  const handleToggleDecorMenu = () => {
    setIsDecorMenuOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('crosspost_decor_menu_open', String(next));
      } catch {}
      // 装飾メニュー/ウインドウを閉じた時、実行中の「削除」「追加」「新しい飾り・定型記号をクイックバーに登録」処理を中止し、削除・追加ボタンをオフにする
      if (!next) {
        setIsManagingQuickDecor(false);
        setIsAddingQuickDecor(false);
        setNewQuickLabel('');
        setNewQuickInsert('');
      }
      return next;
    });
  };

  // 装飾メニュー/ウインドウが閉じられた際、削除・追加・登録処理を自動で中止・オフ化
  useEffect(() => {
    if (!isDecorMenuOpen) {
      setIsManagingQuickDecor(false);
      setIsAddingQuickDecor(false);
      setNewQuickLabel('');
      setNewQuickInsert('');
    }
  }, [isDecorMenuOpen]);

  // クイック装飾更新イベントの購読
  useEffect(() => {
    const handleQuickDecorUpdated = () => {
      setQuickDecorations(loadQuickDecorationsFromStorage());
    };
    window.addEventListener('crosspost_quick_decorations_updated', handleQuickDecorUpdated);
    return () => window.removeEventListener('crosspost_quick_decorations_updated', handleQuickDecorUpdated);
  }, []);

  // 新規クイック装飾追加
  const handleAddNewQuickDecor = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newQuickLabel.trim() || !newQuickInsert) return;
    const updated = addQuickDecoration(newQuickLabel.trim(), newQuickInsert, newQuickLabel.trim(), newQuickCategory);
    setQuickDecorations(updated);
    setNewQuickLabel('');
    setNewQuickInsert('');
    setIsAddingQuickDecor(false);
    if (onNotify) {
      onNotify({
        type: 'success',
        title: 'クイック装飾を追加しました',
        message: `「${newQuickLabel.trim()}」をクイック装飾バーに登録しました。`,
      });
    }
  };

  // クイック装飾削除
  const handleRemoveQuickDecor = (id: string, label: string) => {
    const updated = removeQuickDecoration(id);
    setQuickDecorations(updated);
    if (onNotify) {
      onNotify({
        type: 'info',
        title: 'クイック装飾を削除しました',
        message: `「${label}」をクイック装飾バーから削除しました。`,
      });
    }
  };

  // クイック装飾初期リセット
  const handleResetQuickDecors = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const updated = resetQuickDecorations();
    setQuickDecorations(updated);
    setIsManagingQuickDecor(false);
    if (onNotify) {
      onNotify({
        type: 'success',
        title: 'クイック装飾を初期化しました',
        message: 'クイック装飾バーを初期デフォルト一覧（12種類）に戻しました。',
      });
    }
  };

  // AIアシストモーダル表示状態
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiModalInitialTab, setAiModalInitialTab] = useState<AiAssistTab>('split');

  // 🎯 入力集中モード (Focus Mode) 状態
  const [isFocusMode, setIsFocusMode] = useState(false);

  // Escキーで集中モードを解除
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFocusMode) {
        setIsFocusMode(false);
        if (onNotify) {
          onNotify({
            type: 'info',
            title: '集中モードを解除しました',
            message: '通常のエディタ表示に戻りました。',
          });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocusMode, onNotify]);

  // 個別分岐が実際に有効（非空で共通とは別内容）かどうかの判定
  const isBlueskyCustomized = Boolean(customPlatformText && blueskyText && blueskyText.trim().length > 0);
  const isThreadsCustomized = Boolean(customPlatformText && threadsText && threadsText.trim().length > 0);

  // 現在アクティブなタブのテキストを取得
  const currentActiveText =
    activeEditorTab === 'bluesky'
      ? (isBlueskyCustomized ? blueskyText : text)
      : activeEditorTab === 'threads'
      ? (isThreadsCustomized ? threadsText : text)
      : text;

  // 左右連動：現在エディタで編集中のスレッドインデックス（0-indexed）
  const [activeThreadIndex, setActiveThreadIndex] = useState<number>(0);

  // フローティング投稿ボタン用：静的投稿ボタンの可視状態検知
  const submitButtonContainerRef = useRef<HTMLDivElement>(null);
  const [isStaticButtonVisible, setIsStaticButtonVisible] = useState<boolean>(true);

  useEffect(() => {
    const el = submitButtonContainerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsStaticButtonVisible(entry.isIntersecting);
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // カーソル位置からスレッド番号を計算（手動区切り線および自動分割に対応）
  const updateActiveThreadIndexFromCursor = (cursorPos: number) => {
    const textBefore = currentActiveText.slice(0, cursorPos);
    const matches = textBefore.match(/^\s*(?:-{3,}|={3,})\s*$/gm) || [];
    if (matches.length > 0) {
      setActiveThreadIndex(matches.length);
      return;
    }

    // 手動区切りがない場合は自動分割リストから位置を算出
    const activeSplits = postToBluesky ? blueskySplits : threadsSplits;
    if (activeSplits && activeSplits.length > 1) {
      let accumulatedLen = 0;
      let foundIdx = 0;
      for (let i = 0; i < activeSplits.length; i++) {
        accumulatedLen += activeSplits[i].text.length;
        if (cursorPos <= accumulatedLen) {
          foundIdx = i;
          break;
        }
        foundIdx = i;
      }
      setActiveThreadIndex(foundIdx);
    } else {
      setActiveThreadIndex(0);
    }
  };

  // プレビュー側カードクリックでエディタの該当スレッド位置へジャンプ
  const handleJumpToThread = (targetIndex: number) => {
    setActiveThreadIndex(targetIndex);
    const textarea = textareaRef.current;
    if (!textarea) return;

    if (targetIndex === 0) {
      textarea.focus();
      textarea.setSelectionRange(0, 0);
      textarea.scrollTop = 0;
      return;
    }

    const regex = /^\s*(?:-{3,}|={3,})\s*$/gm;
    let match: RegExpExecArray | null = null;
    let count = 0;
    let foundManual = false;
    while ((match = regex.exec(currentActiveText)) !== null) {
      count++;
      if (count === targetIndex) {
        foundManual = true;
        const nextPos = Math.min(match.index + match[0].length + 1, currentActiveText.length);
        textarea.focus();
        textarea.setSelectionRange(nextPos, nextPos);
        const lineHeight = 24;
        const lineCount = currentActiveText.slice(0, nextPos).split('\n').length;
        textarea.scrollTop = Math.max(0, (lineCount - 2) * lineHeight);
        break;
      }
    }

    if (!foundManual) {
      // 自動分割時のオフセットジャンプ
      const activeSplits = postToBluesky ? blueskySplits : threadsSplits;
      let offset = 0;
      for (let i = 0; i < targetIndex && i < activeSplits.length; i++) {
        offset += activeSplits[i].text.length;
      }
      textarea.focus();
      textarea.setSelectionRange(offset, offset);
      const lineHeight = 24;
      const lineCount = currentActiveText.slice(0, offset).split('\n').length;
      textarea.scrollTop = Math.max(0, (lineCount - 2) * lineHeight);
    }
  };

  // サブパネル用：本文中のハッシュタグ検出
  const hashtagMatches = currentActiveText.match(/#[^\s#　]+/g) || [];
  const hashtagCount = hashtagMatches.length;

  // サブパネル用：本文中のURL検出
  const urlMatches = currentActiveText.match(/https?:\/\/[^\s]+/g) || [];
  const urlCount = urlMatches.length;

  // サブパネル用：添付メディアのALTテキスト入力状況 & 画像・動画分類
  const altFilledCount = images.filter((img) => img.alt && img.alt.trim().length > 0).length;
  const imageCount = images.filter((img) => img.mediaType !== 'video').length;
  const videoCount = images.filter((img) => img.mediaType === 'video').length;

  // スレッド分割数
  const totalThreadCount = Math.max(blueskySplits.length, threadsSplits.length);

  // 現在アクティブなタブのテキスト更新ハンドラ
  const handleActiveTextChange = (newVal: string) => {
    if (activeEditorTab === 'bluesky') {
      if (!isBlueskyCustomized && onToggleCustomPlatformText) {
        onToggleCustomPlatformText(true);
      }
      if (onChangeBlueskyText) onChangeBlueskyText(newVal);
    } else if (activeEditorTab === 'threads') {
      if (!isThreadsCustomized && onToggleCustomPlatformText) {
        onToggleCustomPlatformText(true);
      }
      if (onChangeThreadsText) onChangeThreadsText(newVal);
    } else {
      onChangeText(newVal);
    }
  };

  // Bluesky専用テキストの分岐を有効化
  const handleEnableBlueskyCustom = () => {
    if (onToggleCustomPlatformText) onToggleCustomPlatformText(true);
    if (onChangeBlueskyText) onChangeBlueskyText(text);
    if (onNotify) {
      onNotify({
        type: 'info',
        title: '🦋 Bluesky個別編集を有効化',
        message: '共通テキストを複製しました。ハッシュタグや文面をBluesky専用に微調整できます。',
      });
    }
  };

  // Bluesky専用テキストの分岐を解除（共通と再同期）
  const handleDisableBlueskyCustom = () => {
    if (onChangeBlueskyText) onChangeBlueskyText('');
    if (!isThreadsCustomized && onToggleCustomPlatformText) {
      onToggleCustomPlatformText(false);
    }
    if (onNotify) {
      onNotify({
        type: 'info',
        title: '🦋 Bluesky同期に戻しました',
        message: 'Bluesky専用テキストを解除し、共通本文と同期させました。',
      });
    }
  };

  // Threads専用テキストの分岐を有効化
  const handleEnableThreadsCustom = () => {
    if (onToggleCustomPlatformText) onToggleCustomPlatformText(true);
    if (onChangeThreadsText) onChangeThreadsText(text);
    if (onNotify) {
      onNotify({
        type: 'info',
        title: '🌀 Threads個別編集を有効化',
        message: '共通テキストを複製しました。リンクや文字数をThreads専用に微調整できます。',
      });
    }
  };

  // Threads専用テキストの分岐を解除（共通と再同期）
  const handleDisableThreadsCustom = () => {
    if (onChangeThreadsText) onChangeThreadsText('');
    if (!isBlueskyCustomized && onToggleCustomPlatformText) {
      onToggleCustomPlatformText(false);
    }
    if (onNotify) {
      onNotify({
        type: 'info',
        title: '🌀 Threads同期に戻しました',
        message: 'Threads専用テキストを解除し、共通本文と同期させました。',
      });
    }
  };

  // テンプレート・定型文の挿入
  const handleInsertSnippet = (content: string, mode: 'append' | 'replace') => {
    if (mode === 'replace') {
      handleActiveTextChange(content);
    } else {
      const base = currentActiveText;
      const prefix = base ? (base.endsWith('\n\n') ? '' : base.endsWith('\n') ? '\n' : '\n\n') : '';
      handleActiveTextChange(base + prefix + content);
    }
    if (onNotify) {
      onNotify({
        type: 'success',
        title: '📑 定型文を挿入しました',
        message: mode === 'replace' ? '本文をテンプレートで置き換えました。' : '本文の末尾に追加しました。',
      });
    }
  };

  // URL置換（短縮時など）
  const handleReplaceUrl = (oldUrl: string, newUrl: string) => {
    if (text.includes(oldUrl)) {
      onChangeText(text.split(oldUrl).join(newUrl));
    }
    if (blueskyText && blueskyText.includes(oldUrl) && onChangeBlueskyText) {
      onChangeBlueskyText(blueskyText.split(oldUrl).join(newUrl));
    }
    if (threadsText && threadsText.includes(oldUrl) && onChangeThreadsText) {
      onChangeThreadsText(threadsText.split(oldUrl).join(newUrl));
    }
  };

  // 入力エリア文字サイズ: 'sm' (小: text-xs) | 'md' (中: text-sm) | 'lg' (大: text-base)
  const [editorFontSize, setEditorFontSize] = useState<EditorFontSize>(() => {
    try {
      const saved = localStorage.getItem('cross_poster_editor_font_size');
      if (saved === 'sm' || saved === 'md' || saved === 'lg') {
        return saved;
      }
    } catch {}
    return 'sm'; // プレビューの小と同じ text-xs を初期値に設定
  });

  const handleEditorFontSizeChange = (size: EditorFontSize) => {
    setEditorFontSize(size);
    try {
      localStorage.setItem('cross_poster_editor_font_size', size);
    } catch {}
  };

  // Threads トピック候補のローカルストレージ管理
  const [savedTopics, setSavedTopics] = useState<string[]>(() => getSavedThreadsTopics());

  // 外部（設定画面等）からのトピック更新イベントを購読
  useEffect(() => {
    const handleUpdate = () => {
      setSavedTopics(getSavedThreadsTopics());
    };
    window.addEventListener('crosspost_topics_updated', handleUpdate);
    return () => window.removeEventListener('crosspost_topics_updated', handleUpdate);
  }, []);

  // トピック追加ハンドラ
  const handleAddTopicToSaved = (topicToAdd?: string) => {
    const target = topicToAdd || threadsTopic;
    const clean = target.trim().replace(/^#+/, '');
    if (!clean) return;
    const updated = addSavedThreadsTopic(clean);
    setSavedTopics(updated);
    if (onChangeThreadsTopic) {
      onChangeThreadsTopic(clean);
    }
  };

  // トピック削除ハンドラ
  const handleRemoveTopicFromSaved = (topicToRemove: string) => {
    const updated = removeSavedThreadsTopic(topicToRemove);
    setSavedTopics(updated);
    if (threadsTopic === topicToRemove && onChangeThreadsTopic) {
      onChangeThreadsTopic('');
    }
  };

  // トピック初期化ハンドラ
  const handleResetTopics = () => {
    const reset = resetSavedThreadsTopics();
    setSavedTopics(reset);
  };

  const isDemo = isDemoMode ?? credentials.isDemoMode;

  // 投稿モード: 'instant' (同時投稿) | 'scheduled' (予約投稿)
  const [postMode, setPostMode] = useState<'instant' | 'scheduled'>('instant');

  // 下部パネルドックタブ: 'media' (画像・動画) | 'tags' (ハッシュタグ・トピック) | 'reply' (リプライ設定) | 'ogp' (リンクプレビュー) | 'settings' (分割設定)
  const [bottomDockTab, setBottomDockTab] = useState<'media' | 'tags' | 'reply' | 'ogp' | 'settings'>(() =>
    images.length > 0 ? 'media' : 'tags'
  );

  // 画像が追加された場合は自動でメディアタブを開く
  useEffect(() => {
    if (images.length > 0 && bottomDockTab === 'ogp') {
      setBottomDockTab('media');
    }
  }, [images.length]);

  // クイック時刻プリセット管理
  const [customPresets, setCustomPresets] = useState<QuickTimePreset[]>(() => loadQuickPresetsFromStorage());
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);

  const [scheduledDatetimeLocal, setScheduledDatetimeLocal] = useState<string>(() =>
    getJstDatetimeLocalValue(Date.now() + 30 * 60 * 1000)
  );

  const isConfigured =
    (postToBluesky
      ? credentials.blueskyConnected || (credentials.blueskyIdentifier && credentials.blueskyAppPassword)
      : true) &&
    (postToThreads ? credentials.threadsConnected || credentials.threadsAccessToken : true);

  const formatSavedTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  // リプライ投稿の妥当性判定（スイッチ不要：返信先URL/ターゲットが入力されている場合にリプライモードとして動作）
  const hasBlueskyReply = Boolean(
    replySettings?.blueskyResolved ||
    (replySettings?.blueskyTargetUrl && replySettings.blueskyTargetUrl.trim().length > 0)
  );
  const hasThreadsReply = Boolean(
    replySettings?.threadsResolved ||
    (replySettings?.threadsTargetUrl && replySettings.threadsTargetUrl.trim().length > 0)
  );
  const isReplyActive = hasBlueskyReply || hasThreadsReply;

  // 投稿先の選択状態
  const isBothSelected = Boolean(postToBluesky && postToThreads);
  const isNeitherSelected = Boolean(!postToBluesky && !postToThreads);

  // リプライ先プラットフォームに応じた投稿先および個別編集タブの自動制御
  useEffect(() => {
    if (hasThreadsReply) {
      if (postToBluesky) onTogglePostToBluesky(false);
      if (!postToThreads) onTogglePostToThreads(true);
      if (activeEditorTab !== 'threads') setActiveEditorTab('threads');
    } else if (hasBlueskyReply) {
      if (postToThreads) onTogglePostToThreads(false);
      if (!postToBluesky) onTogglePostToBluesky(true);
      if (activeEditorTab !== 'bluesky') setActiveEditorTab('bluesky');
    } else {
      // 通常時：片方のみ選択されている場合、共通タブは無効化されるため対象プラットフォームのタブへ自動切替
      if (postToBluesky && !postToThreads) {
        if (activeEditorTab !== 'bluesky') {
          setActiveEditorTab('bluesky');
        }
      } else if (!postToBluesky && postToThreads) {
        if (activeEditorTab !== 'threads') {
          setActiveEditorTab('threads');
        }
      }
    }
  }, [hasThreadsReply, hasBlueskyReply, postToBluesky, postToThreads, activeEditorTab, onTogglePostToBluesky, onTogglePostToThreads]);

  // 各プラットフォームおよび共通タブの無効化（グレーアウト）判定
  // 共通タブ: BlueskyとThreadsの両方が選択されている時のみ活性化
  const isCommonDisabled = !isBothSelected;
  // 個別タブ: 対応するプラットフォームが選択されていない、または他方リプライ設定時に無効化
  const isBlueskyDisabled = Boolean(hasThreadsReply || !postToBluesky);
  const isThreadsDisabled = Boolean(hasBlueskyReply || !postToThreads);

  // 1. Threads返信先が指定されているが未照合またはリプライ不可（Threads投稿時のみ判定）
  const isThreadsReplyInvalid = Boolean(
    postToThreads &&
    hasThreadsReply &&
    (!replySettings?.threadsResolved || replySettings.threadsResolved.canReply === false)
  );

  // 2. Bluesky返信先が指定されているが未照合またはリプライ不可（Bluesky投稿時のみ判定）
  const isBlueskyReplyInvalid = Boolean(
    postToBluesky &&
    hasBlueskyReply &&
    (!replySettings?.blueskyResolved || replySettings.blueskyResolved.canReply === false)
  );

  const isNoReplyTarget = false;
  const isReplyBlocked = isThreadsReplyInvalid || isBlueskyReplyInvalid;

  // 即時投稿前の妥当性チェック
  const handleSafeSubmitPost = () => {
    if (isReplyBlocked) {
      if (onNotify) {
        if (isThreadsReplyInvalid) {
          onNotify({
            type: 'warning',
            title: 'Threadsのリプライ先をご確認ください',
            message: 'Threadsのリプライ先が正しく照合されていません。「https://www.threads.com/...」の形式で有効な投稿URLを入力・照合してください。',
          });
        } else if (isBlueskyReplyInvalid) {
          onNotify({
            type: 'warning',
            title: 'Blueskyのリプライ先をご確認ください',
            message: 'Blueskyのリプライ先が正しく照合されていません。「https://bsky.app/...」の形式で有効な投稿URLを入力・照合してください。',
          });
        }
      }
      setBottomDockTab('reply');
      return;
    }
    onSubmitPost();
  };

  const handleScheduleSubmit = () => {
    if (!onSchedulePost) return;
    if (isReplyBlocked) {
      if (onNotify) {
        if (isThreadsReplyInvalid) {
          onNotify({
            type: 'warning',
            title: 'Threadsのリプライ先をご確認ください',
            message: 'Threadsのリプライ先が正しく照合されていません。「https://www.threads.com/...」の形式で有効な投稿URLを入力・照合してください。',
          });
        } else if (isBlueskyReplyInvalid) {
          onNotify({
            type: 'warning',
            title: 'Blueskyのリプライ先をご確認ください',
            message: 'Blueskyのリプライ先が正しく照合されていません。「https://bsky.app/...」の形式で有効な投稿URLを入力・照合してください。',
          });
        }
      }
      setBottomDockTab('reply');
      return;
    }
    const targetTimestamp = parseJstDatetimeLocal(scheduledDatetimeLocal);
    onSchedulePost(targetTimestamp);
  };

  const scheduledTargetTimestamp = parseJstDatetimeLocal(scheduledDatetimeLocal);
  const relativeJst = getRelativeTimeJst(scheduledTargetTimestamp);
  const quickPresets = getJstQuickPresets(customPresets);

  // 投稿区分の切り替えハンドラ
  const handleSelectPlatformCategory = (cat: TargetPlatformCategory) => {
    if (cat === 'both') {
      onTogglePostToBluesky(true);
      onTogglePostToThreads(true);
    } else if (cat === 'bluesky') {
      onTogglePostToBluesky(true);
      onTogglePostToThreads(false);
    } else if (cat === 'threads') {
      onTogglePostToBluesky(false);
      onTogglePostToThreads(true);
    }
  };

  const currentPlatformCategory: TargetPlatformCategory = getPlatformCategory(postToBluesky, postToThreads);

  const handleInsertSeparator = () => {
    const textarea = textareaRef.current;
    if (!textarea) {
      const newText = text ? `${text.trimEnd()}\n\n---\n\n` : '---\n\n';
      onChangeText(newText);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = text.substring(0, start);
    const after = text.substring(end);

    const prefix = before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : before ? '\n\n' : '';
    const suffix = after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
    const insertText = `${prefix}---${suffix}`;
    const updated = before + insertText + after;
    onChangeText(updated);

    setTimeout(() => {
      textarea.focus();
      const newPos = start + insertText.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  // 特殊フォント・飾り罫線の挿入ハンドラ
  const handleInsertDecoratedText = (insertContent: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      const newText = currentActiveText ? `${currentActiveText}\n${insertContent}` : insertContent;
      handleActiveTextChange(newText);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = currentActiveText.substring(0, start);
    const after = currentActiveText.substring(end);

    const updated = before + insertContent + after;
    handleActiveTextChange(updated);

    setTimeout(() => {
      textarea.focus();
      const newPos = start + insertContent.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const hasContent = Boolean(
    text.trim().length > 0 ||
    blueskyText.trim().length > 0 ||
    threadsText.trim().length > 0 ||
    (images && images.length > 0)
  );
  const hasMediaOnly = text.trim().length === 0 && Boolean(images && images.length > 0);
  const hasVideo = images.some(
    (img) =>
      img.mediaType === 'video' ||
      Boolean(img.mimeType?.startsWith('video/')) ||
      (typeof img.dataUrl === 'string' && img.dataUrl.startsWith('data:video'))
  );

  const getPostButtonLabel = () => {
    if (!postToBluesky && !postToThreads) {
      return '投稿先を選択してください';
    }
    const bCount = Math.max(1, blueskySplits.length);
    const tCount = Math.max(1, threadsSplits.length);
    if (postToBluesky && postToThreads) {
      if (hasVideo) {
        return isDemo
          ? `Bluesky & Threads に動画を同時投稿（デモテスト）`
          : `Bluesky & Threads に動画を同時投稿する`;
      }
      if (hasMediaOnly) {
        return isDemo
          ? `Bluesky & Threads に同時投稿する（メディアのみデモ: ${images.length}件）`
          : `Bluesky & Threads に同時投稿する（添付メディア: ${images.length}件）`;
      }
      return isDemo
        ? `Bluesky (${bCount}件) & Threads (${tCount}件) に同時投稿する（デモテスト）`
        : `Bluesky (${bCount}件) & Threads (${tCount}件) に同時投稿`;
    }
    if (postToBluesky) {
      return isDemo
        ? `Bluesky にテスト投稿（デモ: ${bCount}件${hasVideo ? '・動画' : ''}）`
        : `Bluesky に${hasVideo ? '動画' : ''}投稿 (${bCount}件${hasMediaOnly ? '・メディアのみ' : 'のツリー'})`;
    }
    return isDemo
      ? `Threads にテスト投稿（デモ: ${tCount}件${hasVideo ? '・動画' : ''}）`
      : `Threads に${hasVideo ? '動画' : ''}投稿 (${tCount}件${hasMediaOnly ? '・メディアのみ' : 'のツリー'})`;
  };

  return (
    <div id="editor-section-container" className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start lg:items-stretch pb-16 lg:pb-0">
      {/* 左側：エディタ & 設定（アイコン表示のため幅を確保） */}
      <div className="lg:col-span-7 xl:col-span-7 2xl:col-span-6 space-y-3 min-w-0 w-full flex flex-col">
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-xl">
          {/* 上部バー：投稿先トグル & サンプル挿入 */}
          {/* 一体化上部バー：投稿先トグル & エディタ分岐タブ & 例文・クリア */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-700/80">
            {/* 投稿先セレクター */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xs font-bold text-slate-200">投稿先:</span>
              <label
                id="toggle-post-bluesky-label"
                title={
                  hasThreadsReply
                    ? 'Threadsリプライ投稿中はBlueskyへの同時投稿はできません'
                    : 'Blueskyに投稿'
                }
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold transition select-none shadow-xs ${
                  hasThreadsReply
                    ? 'opacity-35 cursor-not-allowed bg-slate-900/50 text-slate-500 border-slate-800 grayscale pointer-events-none'
                    : postToBluesky
                    ? 'bg-[#0085ff]/20 text-[#38bdf8] border-[#0085ff]/60 ring-1 ring-[#0085ff]/30 cursor-pointer'
                    : 'bg-[#131d31] text-slate-300 border-slate-700 hover:border-slate-600 hover:text-white cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  checked={postToBluesky && !hasThreadsReply}
                  disabled={hasThreadsReply}
                  onChange={(e) => {
                    if (!hasThreadsReply) {
                      onTogglePostToBluesky(e.target.checked);
                    }
                  }}
                  className="hidden"
                />
                <span>🦋 Bluesky</span>
                {postToBluesky && !hasThreadsReply && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0085ff]" />
                )}
                {hasThreadsReply && (
                  <span className="text-[10px] text-slate-500 font-normal">（無効）</span>
                )}
              </label>

              <label
                id="toggle-post-threads-label"
                title={
                  hasBlueskyReply
                    ? 'Blueskyリプライ投稿中はThreadsへの同時投稿はできません'
                    : 'Threadsに投稿'
                }
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold transition select-none shadow-xs ${
                  hasBlueskyReply
                    ? 'opacity-35 cursor-not-allowed bg-slate-900/50 text-slate-500 border-slate-800 grayscale pointer-events-none'
                    : postToThreads
                    ? 'bg-purple-950/40 text-purple-200 border-purple-500/70 ring-1 ring-purple-500/40 cursor-pointer'
                    : 'bg-[#131d31] text-slate-300 border-slate-700 hover:border-slate-600 hover:text-white cursor-pointer'
                }`}
              >
                <input
                  type="checkbox"
                  checked={postToThreads && !hasBlueskyReply}
                  disabled={hasBlueskyReply}
                  onChange={(e) => {
                    if (!hasBlueskyReply) {
                      onTogglePostToThreads(e.target.checked);
                    }
                  }}
                  className="hidden"
                />
                <span>🌀 Threads</span>
                {postToThreads && !hasBlueskyReply && (
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                )}
                {hasBlueskyReply && (
                  <span className="text-[10px] text-slate-500 font-normal">（無効）</span>
                )}
              </label>
            </div>

            {/* プラットフォーム別テキスト分岐タブ (インラインコンパクト) */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xs font-bold text-slate-200">文書編集:</span>
              <div className="inline-flex items-center p-0.5 bg-[#131d31] border border-slate-700/80 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => {
                    if (!isCommonDisabled) {
                      setActiveEditorTab('common');
                    }
                  }}
                  disabled={isCommonDisabled}
                  className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1 transition select-none ${
                    isCommonDisabled
                      ? 'opacity-35 cursor-not-allowed bg-slate-900/50 text-slate-500 pointer-events-none grayscale'
                      : activeEditorTab === 'common'
                      ? 'bg-[#1e293b] text-white shadow-sm border border-slate-600 cursor-pointer'
                      : 'text-slate-300 hover:text-white cursor-pointer'
                  }`}
                  title={
                    isCommonDisabled
                      ? '共通本文の編集はBluesky・Threadsの両方が投稿先に選択されている時のみ有効です'
                      : '共通ベース文章の編集'
                  }
                >
                  <Globe className={`w-3 h-3 ${isCommonDisabled ? 'text-slate-500' : 'text-sky-400'}`} />
                  <span>共通</span>
                  {isCommonDisabled && (
                    <span className="text-[10px] text-slate-500 font-normal">（無効）</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!isBlueskyDisabled) {
                      setActiveEditorTab('bluesky');
                    }
                  }}
                  disabled={isBlueskyDisabled}
                  title={
                    hasThreadsReply
                      ? 'Threadsリプライ設定中はBluesky個別編集は無効です'
                      : !postToBluesky
                      ? 'Blueskyが投稿先に選択されていません'
                      : 'Bluesky個別文章の編集'
                  }
                  className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1 transition select-none ${
                    isBlueskyDisabled
                      ? 'opacity-35 cursor-not-allowed text-slate-500 pointer-events-none grayscale'
                      : activeEditorTab === 'bluesky'
                      ? 'bg-[#0085ff]/25 text-[#38bdf8] shadow-sm border border-[#0085ff]/50 cursor-pointer'
                      : 'text-slate-300 hover:text-sky-300 cursor-pointer'
                  }`}
                >
                  <span>🦋 Bluesky</span>
                  {isBlueskyDisabled ? (
                    <span className="text-[10px] text-slate-500 font-normal">（無効）</span>
                  ) : isBlueskyCustomized ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0085ff]" />
                  ) : null}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!isThreadsDisabled) {
                      setActiveEditorTab('threads');
                    }
                  }}
                  disabled={isThreadsDisabled}
                  title={
                    hasBlueskyReply
                      ? 'Blueskyリプライ設定中はThreads個別編集は無効です'
                      : !postToThreads
                      ? 'Threadsが投稿先に選択されていません'
                      : 'Threads個別文章の編集'
                  }
                  className={`px-2.5 py-1 rounded-md font-bold flex items-center gap-1 transition select-none ${
                    isThreadsDisabled
                      ? 'opacity-35 cursor-not-allowed text-slate-500 pointer-events-none grayscale'
                      : activeEditorTab === 'threads'
                      ? 'bg-purple-600/25 text-purple-200 shadow-sm border border-purple-500/50 cursor-pointer'
                      : 'text-slate-300 hover:text-purple-300 cursor-pointer'
                  }`}
                >
                  <span>🌀 Threads</span>
                  {isThreadsDisabled ? (
                    <span className="text-[10px] text-slate-500 font-normal">（無効）</span>
                  ) : isThreadsCustomized ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  ) : null}
                </button>
              </div>
            </div>
          </div>

          {/* 投稿先が両方未選択（投稿不可状態）時の案内バナー */}
          {isNeitherSelected && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs flex items-center gap-2 shadow-sm animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="font-bold">
                投稿先が選択されていません。上部の「投稿先（🦋 Bluesky / 🌀 Threads）」を選択してください。
              </span>
            </div>
          )}

          {/* エディタ本体 & 各種設定（投稿先が両方未選択時は全体を不活性化） */}
          <div className={`space-y-3 ${isNeitherSelected ? 'opacity-35 pointer-events-none select-none cursor-not-allowed grayscale' : ''}`}>

          {/* 個別編集タブ時の分岐ガイド & 操作バナー */}
          {activeEditorTab === 'bluesky' && (
            <div className={`p-2.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
              isBlueskyCustomized
                ? 'bg-sky-950/40 border-sky-800/60 text-sky-200'
                : 'bg-slate-950/60 border-slate-800 text-slate-400'
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-base">{isBlueskyCustomized ? '✨' : '🔗'}</span>
                <div>
                  <div className="font-bold text-slate-200 text-xs">
                    {isBlueskyCustomized ? '🦋 Bluesky専用テキストを編集中' : 'Blueskyテキストは現在「共通本文」と同期中'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {isBlueskyCustomized
                      ? 'ハッシュタグや文字数制限（300文字）に合わせた専用の本文です。'
                      : 'Bluesky専用のハッシュタグ追加や文章調整を行うには個別編集を開始してください。'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isBlueskyCustomized ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (onChangeBlueskyText) onChangeBlueskyText(text);
                        if (onNotify) {
                          onNotify({
                            type: 'success',
                            title: '共通本文を反映',
                            message: '共通本文の内容をBluesky専用テキストへコピーしました。',
                          });
                        }
                      }}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition"
                      title="共通本文の内容を再取得"
                    >
                      <Copy className="w-3 h-3" />
                      共通からコピー
                    </button>
                    <button
                      type="button"
                      onClick={handleDisableBlueskyCustom}
                      className="px-2 py-1 rounded bg-rose-950/60 hover:bg-rose-900/70 border border-rose-800/60 text-rose-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition"
                      title="個別テキストを破棄して共通と再同期"
                    >
                      <RotateCcw className="w-3 h-3" />
                      同期に戻す
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleEnableBlueskyCustom}
                    className="px-3 py-1.5 rounded-lg bg-[#0085ff] hover:bg-[#0077e6] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition"
                  >
                    <Split className="w-3.5 h-3.5" />
                    Bluesky個別編集を開始
                  </button>
                )}
              </div>
            </div>
          )}

          {activeEditorTab === 'threads' && (
            <div className="space-y-2">
              <div className={`p-2.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
                isThreadsCustomized
                  ? 'bg-purple-950/40 border-purple-800/60 text-purple-200'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-base">{isThreadsCustomized ? '✨' : '🔗'}</span>
                  <div>
                    <div className="font-bold text-slate-200 text-xs">
                      {isThreadsCustomized ? '🌀 Threads専用テキストを編集中' : 'Threadsテキストは現在「共通本文」と同期中'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {isThreadsCustomized
                        ? 'Threads向け（500文字制限やリンク配置）に調整された専用の本文です。'
                        : 'Threads専用の文章微調整やリンク変更を行うには個別編集を開始してください。'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isThreadsCustomized ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (onChangeThreadsText) onChangeThreadsText(text);
                          if (onNotify) {
                            onNotify({
                              type: 'success',
                              title: '共通本文を反映',
                              message: '共通本文の内容をThreads専用テキストへコピーしました。',
                            });
                          }
                        }}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition"
                        title="共通本文の内容を再取得"
                      >
                        <Copy className="w-3 h-3" />
                        共通からコピー
                      </button>
                      <button
                        type="button"
                        onClick={handleDisableThreadsCustom}
                        className="px-2 py-1 rounded bg-rose-950/60 hover:bg-rose-900/70 border border-rose-800/60 text-rose-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition"
                        title="個別テキストを破棄して共通と再同期"
                      >
                        <RotateCcw className="w-3 h-3" />
                        同期に戻す
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleEnableThreadsCustom}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition"
                    >
                      <Split className="w-3.5 h-3.5" />
                      Threads個別編集を開始
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* エディタツールバー：AIアシストからクリアボタンまで1行表示 */}
          <div className="flex items-center justify-between gap-1.5 px-0.5 text-xs pb-1 overflow-x-auto scrollbar-none whitespace-nowrap">
            {/* 左グループ: 【執筆・AI支援 & 装飾トグル】 */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* ✨ AIアシストボタン群 */}
              <div className="inline-flex items-center bg-[#131d31] p-0.5 rounded-lg border border-slate-700 shadow-xs">
                <button
                  id="open-ai-assist-modal-button"
                  type="button"
                  onClick={() => {
                    setAiModalInitialTab('split');
                    setIsAiModalOpen(true);
                  }}
                  className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md bg-sky-500/25 hover:bg-sky-500/35 text-sky-200 hover:text-white transition text-xs font-bold cursor-pointer"
                  title="AIによる自然なスレッド分割・校正"
                >
                  <Sparkles className="w-3.5 h-3.5 text-sky-300" />
                  <span>AIアシスト</span>
                </button>

                <button
                  id="quick-ai-tone-button"
                  type="button"
                  onClick={() => {
                    setAiModalInitialTab('tone');
                    setIsAiModalOpen(true);
                  }}
                  className="px-1.5 sm:px-2 py-1 rounded-md hover:bg-purple-500/25 text-purple-300 hover:text-purple-100 transition text-[11px] font-medium cursor-pointer"
                  title="Bluesky/Threads向けトーン自動調整"
                >
                  <Wand2 className="w-3 h-3 text-purple-300" />
                </button>

                <button
                  id="quick-ai-safety-button"
                  type="button"
                  onClick={() => {
                    setAiModalInitialTab('safety');
                    setIsAiModalOpen(true);
                  }}
                  className="px-1.5 sm:px-2 py-1 rounded-md hover:bg-emerald-500/25 text-emerald-300 hover:text-emerald-100 transition text-[11px] font-medium cursor-pointer"
                  title="セーフティ点検・事前校正"
                >
                  <ShieldCheck className="w-3 h-3 text-emerald-300" />
                </button>
              </div>

              {/* 定型文・スニペット */}
              <button
                id="open-snippets-button"
                type="button"
                onClick={() => setIsSnippetModalOpen(true)}
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/40 transition text-xs font-medium cursor-pointer shadow-xs"
                title="定型文・スニペット挿入"
              >
                <FileText className="w-3 h-3 text-amber-300" />
                <span>定型文</span>
              </button>

              {/* 例文挿入ボタン */}
              <button
                id="open-samples-button"
                type="button"
                onClick={() => setShowSamples(true)}
                disabled={isNeitherSelected}
                className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-[#131d31] hover:bg-slate-800 text-slate-200 border border-slate-700 transition text-xs font-medium shadow-xs ${
                  isNeitherSelected ? 'opacity-35 pointer-events-none cursor-not-allowed' : 'cursor-pointer hover:text-amber-300'
                }`}
                title="サンプル文章（例文）を一覧から挿入"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>例文</span>
              </button>

              {/* 🎨 装飾機能の折りたたみメニュートグルボタン */}
              <button
                id="toggle-decor-menu-button"
                type="button"
                onClick={handleToggleDecorMenu}
                className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg border transition text-xs font-medium cursor-pointer shadow-xs ${
                  isDecorMenuOpen
                    ? 'bg-purple-600/30 text-purple-200 border-purple-500/70 ring-1 ring-purple-500/30 font-bold'
                    : 'bg-[#131d31] hover:bg-slate-800 text-slate-200 hover:text-purple-300 border-slate-700'
                }`}
                title={isDecorMenuOpen ? '装飾メニューを折りたたむ' : '装飾メニューを展開（特殊フォント・飾り罫線・囲み・絵文字）'}
              >
                <Palette className="w-3.5 h-3.5 text-purple-400" />
                <span>装飾</span>
                {isDecorMenuOpen ? (
                  <ChevronUp className="w-3 h-3 text-purple-300 ml-0.5" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
                )}
              </button>
            </div>

            {/* 中央の区切り線（画面幅に余裕がある場合） */}
            <div className="h-4 w-px bg-slate-700/60 mx-0.5 shrink-0 hidden md:block" />

            {/* 右グループ: 【書式・操作・集中モード・クリア】 */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-auto">
              {/* 区切り線挿入 */}
              <button
                id="insert-manual-separator-button"
                type="button"
                onClick={handleInsertSeparator}
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-[#131d31] hover:bg-slate-800 text-slate-200 border border-slate-700 transition text-xs font-medium cursor-pointer shadow-xs"
                title="カーソル位置に区切り線 (---) を挿入してスレッド分割"
              >
                <Scissors className="w-3 h-3 text-sky-400" />
                <span>区切る</span>
                <span className="hidden lg:inline text-[10px] text-slate-400 font-mono">(---)</span>
              </button>

              {/* 文字サイズ切り替え */}
              <div className="flex items-center bg-[#131d31] p-0.5 rounded-lg border border-slate-700 text-xs font-semibold shadow-xs">
                {(['sm', 'md', 'lg'] as EditorFontSize[]).map((size) => (
                  <button
                    key={size}
                    id={`editor-font-size-${size}-btn`}
                    type="button"
                    onClick={() => handleEditorFontSizeChange(size)}
                    className={`px-1.5 sm:px-2 py-0.5 rounded text-[11px] transition cursor-pointer ${
                      editorFontSize === size
                        ? 'bg-[#1e293b] text-sky-200 border border-slate-600 shadow-xs font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title={`文字サイズ: ${EDITOR_FONT_SIZE_CONFIG[size].label}`}
                  >
                    {EDITOR_FONT_SIZE_CONFIG[size].label}
                  </button>
                ))}
              </div>

              {/* 🎯 入力集中モード切り替えボタン */}
              <button
                id="toggle-focus-mode-button"
                type="button"
                onClick={() => {
                  const nextState = !isFocusMode;
                  setIsFocusMode(nextState);
                  if (onNotify) {
                    onNotify({
                      type: 'info',
                      title: nextState ? '🎯 集中モードを開始しました' : '集中モードを解除しました',
                      message: nextState
                        ? 'エディタを広げ、執筆に専念できます（Escキーで解除）。'
                        : '通常のエディタ表示に戻りました。',
                    });
                  }
                }}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs border ${
                  isFocusMode
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 ring-1 ring-amber-500/30'
                    : 'bg-[#131d31] hover:bg-slate-800 text-slate-200 hover:text-sky-300 border-slate-700'
                }`}
                title={isFocusMode ? '集中モードを解除 (Esc)' : '入力集中モードに切り替え（執筆に没頭）'}
              >
                {isFocusMode ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                    <span>集中解除</span>
                  </>
                ) : (
                  <>
                    <Focus className="w-3.5 h-3.5 text-sky-400" />
                    <span>集中</span>
                  </>
                )}
              </button>

              {/* 投稿内容クリアボタン */}
              <button
                id="editor-clear-draft-button"
                type="button"
                onClick={onClearDraft}
                disabled={!hasContent || isNeitherSelected}
                className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-lg bg-[#131d31] text-xs font-medium border border-slate-700 transition shadow-xs ${
                  !hasContent || isNeitherSelected
                    ? 'opacity-35 pointer-events-none cursor-not-allowed text-slate-500'
                    : 'text-slate-300 hover:text-rose-300 hover:bg-rose-950/30 hover:border-rose-800/60 cursor-pointer'
                }`}
                title="投稿内容をクリア"
              >
                <Trash2 className={`w-3 h-3 ${hasContent && !isNeitherSelected ? 'text-rose-400' : 'text-slate-500'}`} />
                <span>クリア</span>
              </button>
            </div>
          </div>

          {/* クイック罫線・装飾バー（折りたたみメニュー展開時 & 集中モード解除時） */}
          {!isFocusMode && isDecorMenuOpen && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="p-2.5 bg-[#131d31]/95 border border-purple-500/40 rounded-xl text-xs space-y-2 shadow-md">
                {/* 1段目: アクションボタン & カテゴリ切り替えピルタブ & 閉じるボタン */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                  {/* 左: 𝕱 パレット & 編集/追加ボタン */}
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {/* 「𝕱 装飾・フォント」ボタン */}
                    <button
                      id="open-unicode-decorator-button"
                      type="button"
                      onClick={() => {
                        const textarea = textareaRef.current;
                        if (textarea) {
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          if (start !== end) {
                            setSelectedEditorText(currentActiveText.substring(start, end));
                          } else {
                            setSelectedEditorText('');
                          }
                        }
                        setIsUnicodeModalOpen(true);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 hover:text-white border border-purple-500/50 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs group"
                      title="特殊フォント（太字/筆記体/囲み文字等）＆ 飾り罫線パレットを開く"
                    >
                      <Type className="w-3.5 h-3.5 text-purple-300 group-hover:scale-110 transition-transform" />
                      <span>𝕱 パレット</span>
                    </button>

                    {/* 新規登録ボタン */}
                    <button
                      type="button"
                      onClick={() => {
                        const next = !isAddingQuickDecor;
                        setIsAddingQuickDecor(next);
                        if (next) {
                          setIsManagingQuickDecor(false); // 追加時は削除モードをオフ
                        } else {
                          setNewQuickLabel('');
                          setNewQuickInsert('');
                        }
                      }}
                      className={`px-2 py-1 rounded-lg border text-xs transition cursor-pointer flex items-center gap-1 ${
                        isAddingQuickDecor
                          ? 'bg-purple-600 text-white border-purple-500 shadow-xs font-bold'
                          : 'bg-[#182234] hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700 shadow-xs'
                      }`}
                      title="新しい飾りをクイックバーに登録"
                    >
                      <Plus className="w-3.5 h-3.5 text-purple-300" />
                      <span className="text-[11px] font-medium">追加</span>
                    </button>

                    {/* 管理・削除モード切り替えボタン */}
                    <button
                      type="button"
                      onClick={() => {
                        const next = !isManagingQuickDecor;
                        setIsManagingQuickDecor(next);
                        if (next) {
                          setIsAddingQuickDecor(false); // 削除モード時は追加フォームをオフ
                          setNewQuickLabel('');
                          setNewQuickInsert('');
                        }
                      }}
                      className={`px-2 py-1 rounded-lg border text-xs transition cursor-pointer flex items-center gap-1 ${
                        isManagingQuickDecor
                          ? 'bg-amber-600/30 text-amber-200 border-amber-500/60 shadow-xs font-bold'
                          : 'bg-[#182234] hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700 shadow-xs'
                      }`}
                      title={isManagingQuickDecor ? '装飾の管理を完了' : '登録した飾りを削除・管理'}
                    >
                      {isManagingQuickDecor ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-amber-300" />
                          <span className="text-[11px] text-amber-200 font-bold">完了</span>
                        </>
                      ) : (
                        <>
                          <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-[11px] font-medium">編集</span>
                        </>
                      )}
                    </button>

                    {/* 管理モード時の初期リセットボタン */}
                    {isManagingQuickDecor && (
                      <button
                        type="button"
                        onClick={handleResetQuickDecors}
                        className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-[11px] transition cursor-pointer flex items-center gap-1"
                        title="初期デフォルトの飾りにリセット"
                      >
                        <RotateCcw className="w-3 h-3 text-purple-400" />
                        <span>初期化</span>
                      </button>
                    )}

                    {/* 設定画面の装飾メンテナンスを開くボタン */}
                    <button
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('crosspost_open_settings_maintenance'));
                        window.dispatchEvent(new CustomEvent('crosspost_set_maintenance_subtab', { detail: 'quick_decors' }));
                        if (onOpenSettings) onOpenSettings();
                      }}
                      className="px-2 py-1 rounded-lg bg-[#182234] hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs transition cursor-pointer flex items-center gap-1 shadow-xs"
                      title="設定メニューで装飾バー・飾り罫線を一覧管理"
                    >
                      <Sliders className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-[11px] font-medium">設定</span>
                    </button>
                  </div>

                  {/* 右: カテゴリ切り替えピルタブ ＆ 折りたたみボタン */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
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
                          onClick={() => setSelectedDecorCategory(cat.id as QuickDecorCategory)}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition whitespace-nowrap cursor-pointer ${
                            selectedDecorCategory === cat.id
                              ? 'bg-[#1e293b] text-purple-300 border border-purple-500/50 shadow-2xs'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>

                    {/* 折りたたみ閉じるボタン */}
                    <button
                      type="button"
                      onClick={handleToggleDecorMenu}
                      className="p-1 rounded-md text-slate-400 hover:text-purple-300 hover:bg-slate-800/80 transition cursor-pointer flex items-center gap-1 text-[11px]"
                      title="装飾メニューを折りたたむ"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">閉じる</span>
                    </button>
                  </div>
                </div>

                {/* 2段目: フィルタリングされたクイック装飾アイテム一覧 */}
                <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
                  {quickDecorations
                    .filter((item) => selectedDecorCategory === 'all' || (item.category || 'emoji') === selectedDecorCategory)
                    .map((item) => (
                      <div key={item.id} className="relative group/item shrink-0">
                        <button
                          type="button"
                          onClick={() => !isManagingQuickDecor && handleInsertDecoratedText(item.insert)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition font-mono border shadow-2xs ${
                            isManagingQuickDecor
                              ? 'bg-[#1e293b] text-slate-300 border-slate-700 pr-5 cursor-default'
                              : 'bg-[#182234] hover:bg-purple-950/60 text-slate-100 hover:text-purple-200 border-slate-700 hover:border-purple-600/80 hover:shadow-xs cursor-pointer'
                          }`}
                          title={item.title || item.label}
                        >
                          {item.label}
                        </button>

                        {/* 管理モード時の削除ボタン */}
                        {isManagingQuickDecor && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveQuickDecor(item.id, item.label);
                            }}
                            className="absolute right-0.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center cursor-pointer shadow-xs transition-transform hover:scale-110"
                            title={`「${item.label}」を削除`}
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    ))}

                  {quickDecorations.filter((item) => selectedDecorCategory === 'all' || (item.category || 'emoji') === selectedDecorCategory).length === 0 && (
                    <span className="text-[11px] text-slate-500 py-0.5">
                      このカテゴリにはまだ装飾がありません。「＋追加」から登録できます。
                    </span>
                  )}
                </div>
              </div>

              {/* 新規装飾アイテムの登録フォーム（展開時） */}
              {isAddingQuickDecor && (
                <form
                  onSubmit={handleAddNewQuickDecor}
                  className="p-3 bg-[#0f172a] border border-purple-500/50 rounded-xl space-y-2.5 animate-in fade-in slide-in-from-top-1 text-xs shadow-lg"
                >
                  <div className="flex items-center justify-between text-purple-300 font-bold border-b border-slate-800 pb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-purple-400" />
                      <span>新しい飾り・定型記号をクイックバーに登録</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingQuickDecor(false)}
                      className="text-slate-400 hover:text-slate-200 p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* カテゴリ選択 */}
                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-300 font-medium block">
                      登録カテゴリ:
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { id: 'line', label: '━ 罫線・区切り' },
                        { id: 'box', label: '【】囲み・見出し' },
                        { id: 'number', label: '1️⃣ 数字・リスト' },
                        { id: 'emoji', label: '😀 記号・絵文字' },
                      ].map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setNewQuickCategory(cat.id as any)}
                          className={`px-2 py-1 rounded-lg text-xs font-bold transition border cursor-pointer ${
                            newQuickCategory === cat.id
                              ? 'bg-purple-600 text-white border-purple-500 shadow-2xs'
                              : 'bg-[#182234] text-slate-300 hover:text-white border-slate-700'
                          }`}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-4 space-y-1">
                      <label className="text-[11px] text-slate-300 font-medium block">
                        ボタン表示名（ラベル）:
                      </label>
                      <input
                        type="text"
                        value={newQuickLabel}
                        onChange={(e) => setNewQuickLabel(e.target.value)}
                        placeholder="例: 【 注目 】, ✦✦✦"
                        className="w-full bg-[#182234] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 placeholder:text-slate-500"
                      />
                    </div>

                    <div className="sm:col-span-8 space-y-1">
                      <label className="text-[11px] text-slate-300 font-medium block">
                        エディタに挿入する文字列:
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={newQuickInsert}
                          onChange={(e) => setNewQuickInsert(e.target.value)}
                          placeholder="例: 【 📌 注目 】\n, ✦ ────── ✦\n"
                          className="flex-1 bg-[#182234] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500 placeholder:text-slate-500 font-mono"
                        />
                        <button
                          type="submit"
                          disabled={!newQuickLabel.trim() || !newQuickInsert}
                          className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-xs transition cursor-pointer shrink-0 shadow-xs flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>登録する</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* 集中モード時の案内バナー */}
          {isFocusMode && (
            <div className="px-3 py-1.5 rounded-xl bg-sky-950/60 border border-sky-500/50 text-sky-200 text-xs flex items-center justify-between shadow-xs animate-in fade-in">
              <div className="flex items-center gap-2">
                <Focus className="w-4 h-4 text-sky-400 animate-pulse" />
                <span className="font-bold">🎯 入力集中モード中</span>
                <span className="text-[11px] text-sky-300/80 hidden sm:inline">（エディタを広く表示中）</span>
              </div>
              <button
                type="button"
                onClick={() => setIsFocusMode(false)}
                className="text-[11px] font-bold text-sky-300 hover:text-white px-2 py-0.5 rounded-md bg-sky-900/60 hover:bg-sky-800/80 border border-sky-600/50 transition cursor-pointer flex items-center gap-1"
              >
                <span>解除 (Esc)</span>
              </button>
            </div>
          )}

          {/* 左右連動：スレッド分割ナビゲーター（複数ポスト時に即時ジャンプ & 文字数状況 & 左右連動ハイライト） */}
          {totalThreadCount > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 px-1 bg-[#131d31]/90 rounded-xl border border-slate-700/80 text-xs shadow-xs animate-in fade-in">
              <div className="flex items-center gap-1 text-[11px] text-slate-300 font-bold shrink-0 select-none px-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span>スレッド:</span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                {Array.from({ length: totalThreadCount }).map((_, idx) => {
                  const isActive = activeThreadIndex === idx;
                  const bskySplit = blueskySplits[idx];
                  const threadsSplit = threadsSplits[idx];
                  const charCount =
                    (activeEditorTab === 'threads' ? threadsSplit : bskySplit)?.charCount ??
                    (bskySplit || threadsSplit)?.charCount ??
                    0;
                  const maxLimit = activeEditorTab === 'threads' ? 500 : 300;
                  const isOver = charCount > maxLimit;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleJumpToThread(idx)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-mono transition-all duration-150 cursor-pointer shrink-0 ${
                        isActive
                          ? 'bg-sky-500/25 text-sky-100 border-sky-400 ring-2 ring-sky-400/40 font-bold shadow-sm'
                          : 'bg-slate-900/80 text-slate-300 border-slate-700 hover:border-slate-500 hover:text-white'
                      } ${isOver ? 'border-rose-500 text-rose-300 bg-rose-950/40' : ''}`}
                      title={`${idx + 1}通目へジャンプ (現在: ${charCount}文字 / 上限${maxLimit}文字)`}
                    >
                      {isActive ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse shrink-0" />
                      ) : (
                        <span className="text-[10px] text-slate-500">#</span>
                      )}
                      <span>{idx + 1}通目</span>
                      <span
                        className={`text-[10px] font-normal ${
                          isOver ? 'text-rose-400 font-bold' : isActive ? 'text-sky-300' : 'text-slate-400'
                        }`}
                      >
                        ({charCount}字)
                      </span>
                    </button>
                  );
                })}
              </div>
              <span className="text-[10px] text-slate-400 ml-auto hidden sm:inline px-1 select-none">
                クリックで該当ポストへ移動
              </span>
            </div>
          )}

          {/* テキスト入力エリア */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              id="main-post-textarea"
              value={currentActiveText}
              onChange={(e) => handleActiveTextChange(e.target.value)}
              onDragOver={(e) => {
                if (e.dataTransfer) {
                  const types = Array.from(e.dataTransfer.types || []);
                  if (
                    !types.includes('application/x-media-reorder') &&
                    (types.some((t) => t.toLowerCase() === 'files' || t === 'public.file-url') || types.length === 0)
                  ) {
                    e.preventDefault();
                  }
                }
              }}
              onDrop={async (e) => {
                if (e.dataTransfer.types.includes('application/x-media-reorder')) {
                  return;
                }
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  const SUPPORTED_VIDEO_EXTS = [
                    'mp4', 'mov', 'webm', 'm4v', 'mkv', 'avi', '3gp', 'ts', 'mts', 'm2ts', 'qt', 'flv', 'hevc'
                  ];
                  const files = Array.from(e.dataTransfer.files as FileList);
                  const validFiles = files.filter((f) => {
                    const type = (f.type || '').toLowerCase();
                    const ext = f.name.split('.').pop()?.toLowerCase() || '';
                    return (
                      type.startsWith('image/') ||
                      type.startsWith('video/') ||
                      SUPPORTED_VIDEO_EXTS.includes(ext)
                    );
                  });
                  const nonDuplicateValidFiles = validFiles.filter((f) => {
                    return !images.some((img) => img.name === f.name && img.size === f.size);
                  });
                  if (nonDuplicateValidFiles.length > 0) {
                    e.preventDefault();
                    const remaining = 20 - images.length;
                    if (remaining <= 0) return;
                    const toProcess = nonDuplicateValidFiles.slice(0, remaining);
                    const processed: AttachedImage[] = [];
                    for (let i = 0; i < toProcess.length; i++) {
                      const f = toProcess[i];
                      const fileExt = f.name.split('.').pop()?.toLowerCase() || '';
                      const isVideo =
                        (f.type || '').startsWith('video/') ||
                        SUPPORTED_VIDEO_EXTS.includes(fileExt);
                      if (isVideo) {
                        try {
                          const vRes = await processVideoFile(f);
                          const newVideoItem: AttachedImage = {
                            id: `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 9)}`,
                            name: f.name,
                            size: f.size,
                            dataUrl: vRes.thumbnailUrl,
                            previewUrl: vRes.previewUrl,
                            file: vRes.file,
                            thumbnailUrl: vRes.thumbnailUrl,
                            mediaType: 'video',
                            mimeType: vRes.mimeType,
                            duration: vRes.duration,
                            width: vRes.width,
                            height: vRes.height,
                          };
                          saveMediaBlob(newVideoItem.id, f, f.name, vRes.mimeType).catch(() => {});
                          uploadMediaItem(newVideoItem).then((res) => {
                            if (res.mediaId) {
                              newVideoItem.mediaId = res.mediaId;
                              saveMediaBlob(res.mediaId, f, f.name, vRes.mimeType).catch(() => {});
                            }
                          }).catch(() => {});
                          processed.push(newVideoItem);
                        } catch (vErr) {
                          console.error('Error processing dropped video:', vErr);
                        }
                      } else {
                        const { dataUrl, thumbnailUrl, file: jpegFile } = await compressImageFileWithThumbnail(f);
                        const standardizedFile = jpegFile || f;
                        const newImgItem: AttachedImage = {
                          id: `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 9)}`,
                          name: standardizedFile.name,
                          size: standardizedFile.size,
                          dataUrl,
                          thumbnailUrl,
                          file: standardizedFile,
                          mediaType: 'image',
                          mimeType: 'image/jpeg',
                          alt: '',
                          uploadStatus: 'idle',
                          uploadProgress: 0,
                        };
                        saveMediaBlob(newImgItem.id, standardizedFile, standardizedFile.name, 'image/jpeg').catch(() => {});
                        processed.push(newImgItem);
                      }
                      await new Promise((resolve) => setTimeout(resolve, 25));
                    }
                    if (processed.length > 0) {
                      onAddImages(processed);
                    }
                  }
                }
              }}
              onPaste={async (e) => {
                const clipboardFiles = e.clipboardData?.files ? Array.from(e.clipboardData.files) : [];
                const mediaFiles = clipboardFiles.filter((f) => {
                  const type = (f.type || '').toLowerCase();
                  const ext = f.name.split('.').pop()?.toLowerCase() || '';
                  return type.startsWith('image/') || type.startsWith('video/') || ['mp4', 'mov', 'webm'].includes(ext);
                });

                if (mediaFiles.length > 0) {
                  const remaining = 20 - images.length;
                  if (remaining <= 0) return;
                  e.preventDefault();
                  const toProcess = mediaFiles.slice(0, remaining);
                  const processed: AttachedImage[] = [];

                  for (let i = 0; i < toProcess.length; i++) {
                    const f = toProcess[i];
                    const isVideo = (f.type || '').startsWith('video/');
                    if (isVideo) {
                      try {
                        const vRes = await processVideoFile(f);
                        const newVideoItem: AttachedImage = {
                          id: `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 9)}`,
                          name: f.name,
                          size: f.size,
                          dataUrl: vRes.thumbnailUrl,
                          previewUrl: vRes.previewUrl,
                          file: vRes.file,
                          thumbnailUrl: vRes.thumbnailUrl,
                          mediaType: 'video',
                          mimeType: vRes.mimeType,
                          duration: vRes.duration,
                          width: vRes.width,
                          height: vRes.height,
                        };
                        saveMediaBlob(newVideoItem.id, f, f.name, vRes.mimeType).catch(() => {});
                        uploadMediaItem(newVideoItem).then((res) => {
                          if (res.mediaId) {
                            newVideoItem.mediaId = res.mediaId;
                            saveMediaBlob(res.mediaId, f, f.name, vRes.mimeType).catch(() => {});
                          }
                        }).catch(() => {});
                        processed.push(newVideoItem);
                      } catch (vErr) {
                        console.error('Error processing pasted video:', vErr);
                      }
                    } else {
                      const { dataUrl, thumbnailUrl, file: jpegFile } = await compressImageFileWithThumbnail(f);
                      const standardizedFile = jpegFile || f;
                      const newImgItem: AttachedImage = {
                        id: `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 9)}`,
                        name: standardizedFile.name,
                        size: standardizedFile.size,
                        dataUrl,
                        thumbnailUrl,
                        file: standardizedFile,
                        mediaType: 'image',
                        mimeType: 'image/jpeg',
                        alt: '',
                        uploadStatus: 'idle',
                        uploadProgress: 0,
                      };
                      saveMediaBlob(newImgItem.id, standardizedFile, standardizedFile.name, 'image/jpeg').catch(() => {});
                      processed.push(newImgItem);
                    }
                    await new Promise((resolve) => setTimeout(resolve, 25));
                  }

                  if (processed.length > 0) {
                    onAddImages(processed);
                  }
                }
              }}
              placeholder={
                activeEditorTab === 'bluesky' && isBlueskyCustomized
                  ? '🦋 Bluesky専用の投稿文を入力してください...（ハッシュタグや300文字制限に最適化）'
                  : activeEditorTab === 'threads' && isThreadsCustomized
                  ? '🌀 Threads専用の投稿文を入力してください...（500文字制限やリンク配置に最適化）'
                  : isFocusMode
                  ? '🎯 集中モード中... 思考を遮られずに本文を入力してください（Escキーで解除）'
                  : 'ここに投稿内容を入力してください...（---でスレッド分割）'
              }
              rows={isFocusMode ? 10 : 4}
              onClick={(e) => updateActiveThreadIndexFromCursor(e.currentTarget.selectionStart)}
              onKeyUp={(e) => updateActiveThreadIndexFromCursor(e.currentTarget.selectionStart)}
              onSelect={(e) => updateActiveThreadIndexFromCursor(e.currentTarget.selectionStart)}
              className={`w-full bg-[#182234] border ${
                isFocusMode
                  ? 'border-sky-400/90 ring-2 ring-sky-500/30 shadow-lg shadow-sky-950/40'
                  : activeEditorTab === 'bluesky' && isBlueskyCustomized
                  ? 'border-sky-500/80 focus:border-sky-400'
                  : activeEditorTab === 'threads' && isThreadsCustomized
                  ? 'border-purple-500/80 focus:border-purple-400'
                  : 'border-slate-700 focus:border-sky-400'
              } rounded-t-xl rounded-b-none border-b-0 p-3.5 text-slate-50 placeholder-slate-400 font-medium ${
                EDITOR_FONT_SIZE_CONFIG[editorFontSize].textClass
              } focus-ring-accent transition-all resize-y font-sans ${
                isFocusMode ? 'min-h-[220px]' : 'min-h-[96px]'
              } shadow-inner`}
            />

            {/* テキストエリア直下の一体型スマートステータスバー */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-[#1a2336] border border-slate-700 rounded-b-xl -mt-[1px] shadow-xs">
              {/* 左側: コンパクトインライン文字数カウンター & スレッド位置 */}
              <div className="flex items-center gap-2 flex-wrap">
                <CharCounter
                  text={currentActiveText}
                  postToBluesky={postToBluesky}
                  postToThreads={postToThreads}
                  blueskySplitsCount={blueskySplits.length}
                  threadsSplitsCount={threadsSplits.length}
                  autoSplit={autoSplit}
                  isCompact={true}
                />

                {/* 左右連動：現在編集中スレッドバッジ */}
                {totalThreadCount > 1 && (
                  <span className="text-[10px] text-sky-200 font-bold bg-sky-950/90 border border-sky-600/70 px-1.5 py-0.2 rounded-md flex items-center gap-1 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                    <span>#{activeThreadIndex + 1}/{totalThreadCount}通目を編集中</span>
                  </span>
                )}

                {/* 集中モードバッジ */}
                {isFocusMode && (
                  <span className="text-[10px] text-sky-300 font-bold bg-sky-950/90 border border-sky-600/70 px-1.5 py-0.2 rounded-md flex items-center gap-1 shadow-2xs animate-pulse">
                    <Focus className="w-2.5 h-2.5 text-sky-400" />
                    <span>集中ON (Escで戻る)</span>
                  </span>
                )}
              </div>

              {/* 右側: 保存ステータス & 個別編集バッジ */}
              <div className="flex items-center gap-2 text-[11px] text-slate-300 ml-auto font-medium">
                {customPlatformText && (isBlueskyCustomized || isThreadsCustomized) && (
                  <span className="text-[10px] text-sky-300 font-mono bg-sky-950/90 border border-sky-800/80 px-1.5 py-0.2 rounded font-bold">
                    {activeEditorTab === 'bluesky' ? '🦋 Bluesky個別' : activeEditorTab === 'threads' ? '🌀 Threads個別' : '個別設定あり'}
                  </span>
                )}

                {draftStatus === 'saving' && (
                  <span className="flex items-center gap-1 text-sky-300 text-[10px]">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    保存中...
                  </span>
                )}
                {draftStatus === 'saved' && lastSavedAt && (
                  <span className="flex items-center gap-1 text-emerald-400 font-mono text-[10px]" title="下書きはブラウザに自動保存されています">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>保存済 ({formatSavedTime(lastSavedAt)})</span>
                  </span>
                )}
                {draftStatus === 'error' && (
                  <span className="flex items-center gap-1 text-rose-400 text-[10px]">
                    <AlertCircle className="w-3 h-3" />
                    {draftError || '保存失敗'}
                  </span>
                )}
                {draftStatus === 'idle' && (
                  <span className="text-[10px] text-slate-400">自動保存ON</span>
                )}
              </div>
            </div>
          </div>

          {/* ドック型サブパネルナビゲーションタブ（集中モード時は省スペース表示） */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-1.5">
              <div className="flex items-center gap-1 overflow-x-auto text-xs">
                {/* 1. メディアタブ */}
                <button
                  type="button"
                  onClick={() => setBottomDockTab('media')}
                  className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer text-xs ${
                    bottomDockTab === 'media'
                      ? 'bg-[#1A2238] text-white border border-slate-600 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                  <span>メディア</span>
                  {images.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-500 text-white font-mono font-bold shadow-2xs">
                      {images.length}枚
                    </span>
                  )}
                  {images.length > 0 && (
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-bold font-mono ${
                        altFilledCount === images.length
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/80'
                          : 'bg-amber-950 text-amber-300 border border-amber-700/80'
                      }`}
                      title={altFilledCount === images.length ? 'すべての画像にALT説明文が設定されています' : `ALT説明文未入力: ${images.length - altFilledCount}枚`}
                    >
                      {altFilledCount === images.length ? 'ALT済' : `ALT ${altFilledCount}/${images.length}`}
                    </span>
                  )}
                </button>

                {/* 2. タグ & トピックタブ */}
                <button
                  type="button"
                  onClick={() => setBottomDockTab('tags')}
                  className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer text-xs ${
                    bottomDockTab === 'tags'
                      ? 'bg-[#1A2238] text-white border border-slate-600 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5 text-purple-400" />
                  <span>タグ & トピック</span>
                  {hashtagCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-600 text-white font-mono font-bold shadow-2xs">
                      #{hashtagCount}件
                    </span>
                  )}
                  {threadsTopic && (
                    <span
                      className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-700 font-sans hidden sm:inline truncate max-w-[85px]"
                      title={`Threadsトピック: #${threadsTopic}`}
                    >
                      #{threadsTopic}
                    </span>
                  )}
                </button>

                {/* 3. リプライタブ */}
                <button
                  type="button"
                  onClick={() => setBottomDockTab('reply')}
                  className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer text-xs ${
                    bottomDockTab === 'reply'
                      ? 'bg-[#1A2238] text-white border border-indigo-500/60 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                  <span>リプライ</span>
                  {isReplyActive && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500 text-white font-bold animate-pulse shadow-2xs">
                      {hasBlueskyReply && hasThreadsReply ? '両方設定' : hasBlueskyReply ? 'Bsky設定' : 'Threads設定'}
                    </span>
                  )}
                </button>

                {/* 4. リンクOGPタブ */}
                <button
                  type="button"
                  onClick={() => setBottomDockTab('ogp')}
                  className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer text-xs ${
                    bottomDockTab === 'ogp'
                      ? 'bg-[#1A2238] text-white border border-slate-600 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>リンク OGP</span>
                  {urlCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-600 text-white font-mono font-bold shadow-2xs">
                      {urlCount}件
                    </span>
                  )}
                </button>

                {/* 5. 分割設定タブ */}
                <button
                  type="button"
                  onClick={() => setBottomDockTab('settings')}
                  className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer text-xs ${
                    bottomDockTab === 'settings'
                      ? 'bg-[#1A2238] text-white border border-slate-600 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <span>分割設定</span>
                  {totalThreadCount > 1 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-600 text-white font-mono font-bold shadow-2xs">
                      {totalThreadCount}通
                    </span>
                  )}
                </button>
              </div>

              <span className="text-[10px] text-slate-400 hidden sm:inline font-medium">
                {isFocusMode ? '🎯 集中モード中' : 'パネル切替'}
              </span>
            </div>

            {/* ドックコンテンツエリア */}
            <div className="pt-1">
              {bottomDockTab === 'media' && (
                <ImageAttachment
                  images={images}
                  onAddImages={onAddImages}
                  onReorderImages={onReorderImages}
                  onRemoveImage={onRemoveImage}
                  onClearImages={onClearImages}
                  onUpdateImageAlt={onUpdateImageAlt}
                  postToBluesky={postToBluesky}
                  postToThreads={postToThreads}
                />
              )}

              {bottomDockTab === 'tags' && (
                <div className="space-y-3">
                  {/* ハッシュタグ候補 & トレンド提案 UI */}
                  <HashtagSuggester
                    text={currentActiveText}
                    onUpdateText={handleActiveTextChange}
                  />

                  {/* Threads専用設定エリア（トピック） */}
                  {postToThreads && (
                    <div className="p-3 bg-slate-950/80 rounded-xl border border-purple-900/50 hover:border-purple-800/70 transition-colors space-y-2.5">
                      {onChangeThreadsTopic && (
                        <>
                          <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-300">
                              <Tag className="w-3.5 h-3.5 text-purple-400" />
                              <span>🌀 Threads専用トピック (Topic Tag)</span>
                            </div>
                            {savedTopics.length > 0 && (
                              <button
                                type="button"
                                onClick={handleResetTopics}
                                className="text-[10px] text-slate-400 hover:text-purple-300 transition flex items-center gap-0.5 cursor-pointer"
                                title="候補タグを初期状態にリセット"
                              >
                                <RotateCcw className="w-2.5 h-2.5" />
                                <span>初期化</span>
                              </button>
                            )}
                          </div>

                      {/* トピック入力フィールド */}
                      {(() => {
                        const rawCleanTopic = threadsTopic.replace(/^#+/, '').trim();
                        const topicBytes = new TextEncoder().encode(rawCleanTopic).length;
                        const isByteOver = topicBytes > 50;
                        const hasForbidden = /[.&]/.test(rawCleanTopic);

                        const handleAutoFixTopic = () => {
                          let fixed = rawCleanTopic.replace(/[.&]/g, '').slice(0, 50);
                          const encoder = new TextEncoder();
                          while (encoder.encode(fixed).length > 50 && fixed.length > 0) {
                            fixed = fixed.slice(0, -1);
                          }
                          onChangeThreadsTopic(fixed.trim());
                        };

                        return (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5">
                              <div className="relative flex-1 flex items-center">
                                <div className="absolute left-3 text-purple-400 font-bold text-xs pointer-events-none select-none">
                                  #
                                </div>
                                <input
                                  id="threads-topic-input"
                                  type="text"
                                  value={threadsTopic}
                                  onChange={(e) => {
                                    const clean = e.target.value.replace(/^#+/, '').trimStart();
                                    onChangeThreadsTopic(clean);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddTopicToSaved();
                                    }
                                  }}
                                  placeholder="トピックを入力 (例: テクノロジー, 写真)"
                                  className={`w-full pl-7 pr-8 py-1.5 bg-slate-900 border ${
                                    isByteOver || hasForbidden
                                      ? 'border-amber-500/80 focus:border-amber-400 focus:ring-amber-400/30'
                                      : 'border-purple-900/50 focus:border-purple-400 focus:ring-purple-400/30'
                                  } rounded-lg text-xs text-slate-100 placeholder-slate-500 transition outline-none`}
                                  maxLength={50}
                                />
                                {threadsTopic && (
                                  <button
                                    type="button"
                                    onClick={() => onChangeThreadsTopic('')}
                                    className="absolute right-2 text-slate-400 hover:text-rose-400 p-1 rounded-md transition cursor-pointer text-xs"
                                    title="トピック入力をクリア"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>

                              {threadsTopic.trim() && !savedTopics.some((t) => t.toLowerCase() === threadsTopic.trim().replace(/^#+/, '').toLowerCase()) && (
                                <button
                                  type="button"
                                  onClick={() => handleAddTopicToSaved()}
                                  className="px-2.5 py-1.5 bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-700/60 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 shrink-0 shadow-sm"
                                  title="現在のトピックを候補リストに保存"
                                >
                                  <Plus className="w-3 h-3 text-purple-300" />
                                  <span>保存</span>
                                </button>
                              )}
                            </div>

                            {/* Meta Threads API 仕様のバイト数・文字数インジケーター & 警告 */}
                            {rawCleanTopic && (
                              <div className="flex items-center justify-between text-[10px] px-1">
                                <span className={isByteOver ? 'text-amber-400 font-semibold' : 'text-slate-400'}>
                                  Threads制限: {topicBytes}/50バイト ({rawCleanTopic.length}文字)
                                  {isByteOver && ' ※50B超過（全角約16文字まで）'}
                                  {hasForbidden && ' ※「.」「&」は禁止記号'}
                                </span>
                                {(isByteOver || hasForbidden) && (
                                  <button
                                    type="button"
                                    onClick={handleAutoFixTopic}
                                    className="text-amber-300 hover:text-amber-200 font-medium underline cursor-pointer text-[10px]"
                                    title="Meta APIの規定（50バイト以内・禁止記号除去）に自動調整"
                                  >
                                    50B以内に自動短縮
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* 保存済み候補トピック一覧 */}
                      {savedTopics.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 max-h-28 overflow-y-auto pr-1">
                          {savedTopics.map((topic) => {
                            const isSelected = threadsTopic.trim().replace(/^#+/, '').toLowerCase() === topic.toLowerCase();
                            return (
                              <div
                                key={topic}
                                className={`group inline-flex items-center rounded-lg text-[11px] font-medium transition border ${
                                  isSelected
                                    ? 'bg-purple-600 text-white border-purple-500 shadow-sm font-bold'
                                    : 'bg-slate-900/90 hover:bg-purple-950/60 text-slate-300 hover:text-purple-200 border-slate-800 hover:border-purple-900/80'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isSelected) {
                                      onChangeThreadsTopic('');
                                    } else {
                                      handleAddTopicToSaved(topic);
                                    }
                                  }}
                                  className="pl-2 pr-1 py-1 cursor-pointer flex items-center gap-1"
                                >
                                  <span className="text-[10px] opacity-70">#</span>
                                  <span>{topic}</span>
                                  {isSelected && <span className="text-[10px] text-purple-200">✓</span>}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveTopicFromSaved(topic);
                                  }}
                                  className="px-1.5 py-1 text-slate-400 hover:text-rose-400 transition cursor-pointer rounded-r-lg border-l border-slate-800"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {bottomDockTab === 'reply' && replySettings && onUpdateReplySettings && onSetResolvedReplyTarget && onClearReplyTarget && (
                <ReplySettingsSection
                  replySettings={replySettings}
                  postToBluesky={postToBluesky}
                  postToThreads={postToThreads}
                  credentials={credentials}
                  isDemoMode={Boolean(isDemo)}
                  onUpdateSettings={onUpdateReplySettings}
                  onSetResolvedTarget={onSetResolvedReplyTarget}
                  onClearTarget={onClearReplyTarget}
                />
              )}

              {bottomDockTab === 'ogp' && (
                <OgpPreviewSection
                  text={currentActiveText}
                  onReplaceUrl={handleReplaceUrl}
                  onInsertUrl={(url) => {
                    handleActiveTextChange(currentActiveText.trim() ? `${currentActiveText.trim()}\n${url}` : url);
                  }}
                  onNotify={onNotify}
                />
              )}

              {bottomDockTab === 'settings' && (
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-300 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-accent-light" />
                      スレッド自動分割設定
                    </span>
                  </div>

                  <div className="space-y-2 pt-1">
                    <label className="flex items-center justify-between cursor-pointer group">
                      <div className="flex items-center gap-1.5 text-slate-300 text-[11px]">
                        <Layers className="w-3 h-3 text-slate-400 group-hover:text-slate-200" />
                        <span>文字数上限を超えたら自動分割</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={autoSplit}
                        onChange={(e) => onToggleAutoSplit(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between cursor-pointer group">
                      <div className="flex items-center gap-1.5 text-slate-300 text-[11px]">
                        <Hash className="w-3 h-3 text-slate-400 group-hover:text-slate-200" />
                        <span>各ツリーに (1/3) などのナンバリングを付与</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={includeNumbering}
                        onChange={(e) => onToggleIncludeNumbering(e.target.checked)}
                        disabled={!autoSplit}
                        className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0 focus:ring-offset-0 cursor-pointer disabled:opacity-40"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 投稿モード切り替え & 投稿実行エリア */}
          <div className="space-y-2 pt-1">
            {/* モード切替タブ: 同時投稿 vs 予約投稿 (デモ・実用共通) */}
            <div className="flex items-center justify-between pb-0.5 flex-wrap gap-2">
              <div className="inline-flex items-center p-0.5 bg-slate-950/90 border border-slate-800 rounded-lg">
                <button
                  id="mode-instant-tab"
                  type="button"
                  onClick={() => setPostMode('instant')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    postMode === 'instant'
                      ? isDemo
                        ? 'bg-sky-500/20 text-sky-200 border border-sky-400/40 shadow-sm'
                        : 'bg-slate-800 text-slate-100 border border-slate-700 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={isDemo ? 'デモ同時投稿モードに切り替え' : '同時投稿モードに切り替え'}
                >
                  <Send className={`w-3.5 h-3.5 ${isDemo && postMode === 'instant' ? 'text-sky-300/80' : ''}`} />
                  <span>{isDemo ? '⚡ 同時投稿 (デモ)' : '⚡ 同時投稿'}</span>
                </button>
                <button
                  id="mode-scheduled-tab"
                  type="button"
                  onClick={() => setPostMode('scheduled')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    postMode === 'scheduled'
                      ? 'btn-accent text-white border border-accent shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={isDemo ? 'デモ予約投稿モードに切り替え' : '予約投稿モードに切り替え'}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{isDemo ? '⏰ 予約投稿 (デモ)' : '⏰ 予約投稿 (JST)'}</span>
                  {scheduledPostsCount > 0 && (
                    <span className="ml-1 bg-slate-950/80 text-accent-light border border-accent text-[9px] px-1.5 py-0.2 rounded-full">
                      {scheduledPostsCount}
                    </span>
                  )}
                </button>
              </div>

              {/* 予約カレンダーモーダルボタン */}
              {onOpenScheduledPosts && (
                <button
                  type="button"
                  onClick={onOpenScheduledPosts}
                  className="text-accent-light hover:underline text-[11px] font-semibold cursor-pointer flex items-center gap-1 bg-slate-900/60 hover:bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 transition"
                  title="カレンダー形式で予約済みの投稿を表示・編集"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>🗓️ 予約カレンダー ({scheduledPostsCount}件)</span>
                </button>
              )}
            </div>

            {/* 認証警告 (実用モードで未接続時のみ表示) */}
            {!isDemo && !isConfigured && (
              <div className="flex items-start gap-1.5 p-2 rounded-lg bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1 text-[11px]">
                  <span>選択したSNSの認証情報が未完了です。</span>
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="ml-1.5 font-bold underline hover:text-white cursor-pointer"
                  >
                    設定画面を開く
                  </button>
                </div>
              </div>
            )}

            {(!postToBluesky && !postToThreads) && (
              <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-200 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="text-[11px]">投稿先（Bluesky / Threads）を選択してください。</span>
              </div>
            )}

            {/* 動画添付時の事前案内 */}
            {hasVideo && (
              <div
                id="video-attachment-notice"
                className="p-2.5 rounded-xl bg-sky-950/40 border border-sky-800/50 text-xs text-sky-200 flex items-start gap-2 shadow-xs"
              >
                <Film className="w-4 h-4 text-sky-400 shrink-0 mt-0.5 animate-pulse" />
                <div className="space-y-0.5 text-[11px] leading-relaxed">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>📹 動画が添付されています</span>
                    <span className="px-1.5 py-0.2 rounded bg-sky-900 text-[10px] text-sky-300 font-normal">
                      公式エンコード対応
                    </span>
                  </div>
                  <p className="text-slate-300">
                    投稿時は各SNSサーバー（Bluesky / Threads）での最適化・エンコード処理（10〜30秒）が行われます。投稿ボタンを押すとプログレス画面でリアルタイムに進捗が表示されます。
                  </p>
                </div>
              </div>
            )}

            {/* リプライ投稿ステータス表示 & バリデーション警告 */}
            {isReplyActive && (
              <div className="space-y-1.5 animate-in fade-in duration-150">
                {isThreadsReplyInvalid ? (
                  <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200 text-xs flex items-start gap-2 shadow-sm">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5 min-w-0">
                      <span className="font-bold text-rose-300">Threadsのリプライ先要確認:</span>
                      <p className="text-[11px] text-rose-300/90 leading-tight">
                        {!replySettings?.threadsResolved
                          ? 'Threads返信先の照合が完了していません。'
                          : '他者の投稿には返信できません（本人投稿のみ許可）。'}
                      </p>
                    </div>
                  </div>
                ) : isBlueskyReplyInvalid ? (
                  <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-200 text-xs flex items-start gap-2 shadow-sm">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5 min-w-0">
                      <span className="font-bold text-rose-300">Blueskyのリプライ先要確認:</span>
                      <p className="text-[11px] text-rose-300/90 leading-tight">
                        Bluesky返信先の照合が完了していません。
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 rounded-xl bg-indigo-950/30 border border-indigo-800/50 text-indigo-200 text-xs flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageSquare className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="text-[11px] font-medium truncate">
                        リプライ（返信）モードが有効です
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {replySettings?.blueskyResolved && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-sky-950 border border-sky-800 text-sky-300">
                          {isDemoMode ? 'BskyデモシミュレートOK' : 'Bsky返信先設定済'}
                        </span>
                      )}
                      {replySettings?.threadsResolved && (
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] border ${
                            replySettings.threadsResolved.isDemoSkipped || isDemoMode
                              ? 'bg-amber-950/60 border-amber-800 text-amber-300'
                              : replySettings.threadsResolved.verifiedCanReply
                              ? 'bg-emerald-950 border-emerald-800 text-emerald-300'
                              : 'bg-violet-950 border-violet-800 text-violet-300'
                          }`}
                        >
                          {replySettings.threadsResolved.isDemoSkipped || isDemoMode
                            ? 'ThreadsデモシミュレートOK'
                            : replySettings.threadsResolved.verifiedCanReply
                            ? 'Threads事前検証済'
                            : 'Threads本人照合済'}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 静的投稿アクションエリア（可視状態をフローティングバーと連動） */}
            <div ref={submitButtonContainerRef} id="main-submission-actions-block" className="space-y-3">
              {/* モード1: 同時投稿 (即時実行) */}
              {postMode === 'instant' && (
              <div className="space-y-1.5 animate-in fade-in duration-150">
                {isAdminMode && (
                  <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/50 text-amber-200 text-xs flex items-center justify-center gap-2 font-bold shadow-xs">
                    <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                    <span>🔒 管理者モード起動中のため投稿処理はできません</span>
                  </div>
                )}
                {isDemo ? (
                  <>
                    <button
                      id="submit-crosspost-button"
                      type="button"
                      onClick={handleSafeSubmitPost}
                      disabled={isAdminMode || !hasContent || (!postToBluesky && !postToThreads)}
                      className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 active:bg-sky-500/35 border border-sky-400/40 hover:border-sky-400/60 disabled:opacity-40 disabled:cursor-not-allowed text-sky-100 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
                    >
                      <Sparkles className="w-4 h-4 text-sky-300/80" />
                      <span>{isAdminMode ? '🔒 管理者モード（投稿制限中）' : getPostButtonLabel()}</span>
                    </button>
                    <p className="text-[10px] text-sky-300/80 text-center font-medium">
                      ※DEMOモードのため実際のSNSには投稿されず、安全に投稿シミュレーション・履歴作成をお試しいただけます。
                    </p>
                  </>
                ) : (
                  <button
                    id="submit-crosspost-button"
                    type="button"
                    onClick={handleSafeSubmitPost}
                    disabled={isAdminMode || !hasContent || (!postToBluesky && !postToThreads)}
                    className="w-full py-2.5 sm:py-3 px-4 rounded-xl btn-accent disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer animate-in fade-in duration-150"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isAdminMode ? '🔒 管理者モード（投稿制限中）' : getPostButtonLabel()}</span>
                  </button>
                )}
              </div>
            )}

            {/* モード2: 予約投稿設定パネル */}
            {postMode === 'scheduled' && (
              <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-slate-200">
                    <Calendar className="w-3.5 h-3.5 text-accent-light" />
                    <span>{isDemo ? 'デモ予約日時の指定 (JST: UTC+9)' : '予約日時の指定 (JST: UTC+9)'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPostMode('instant')}
                      className="text-slate-400 hover:text-slate-200 text-[10px] cursor-pointer hover:underline"
                    >
                      同時投稿へ戻る
                    </button>
                    {isDemo && (
                      <span className="text-[10px] text-amber-300/80 font-medium">
                        ※LIVE（本番）モード切替時に自動消去
                      </span>
                    )}
                  </div>
                </div>

                {/* 日時ピッカー & プレビュー */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      id="schedule-datetime-input"
                      type="datetime-local"
                      value={scheduledDatetimeLocal}
                      onChange={(e) => setScheduledDatetimeLocal(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus-ring-accent min-w-0"
                    />
                    <button
                      id="set-now-datetime-button"
                      type="button"
                      onClick={() => setScheduledDatetimeLocal(getJstDatetimeLocalValue(Date.now()))}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                      title="予約日時を現在の日本時間（JST）に変更します"
                    >
                      <Clock className="w-3.5 h-3.5 text-accent-light" />
                      <span>現在日時に変更</span>
                    </button>
                  </div>

                  {/* 相対時間 & JSTフォーマットプレビュー */}
                  <div className="flex items-center justify-between text-[10px] px-0.5">
                    <span className="text-slate-400 font-mono">
                      JST: <strong className="text-slate-200">{formatToJstString(scheduledTargetTimestamp)}</strong>
                    </span>
                    <span
                      className={`font-semibold ${
                        relativeJst.isPast
                          ? 'text-rose-400'
                          : relativeJst.isSoon
                          ? 'text-amber-300'
                          : 'text-accent-light'
                      }`}
                    >
                      {relativeJst.text}
                    </span>
                  </div>
                </div>

                {/* クイックプリセット */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-semibold text-slate-300">クイック選択プリセット (JST):</span>
                    <button
                      type="button"
                      onClick={() => setIsPresetModalOpen(true)}
                      className="text-accent-light hover:underline text-[10px] flex items-center gap-1 cursor-pointer font-medium hover:text-white transition"
                    >
                      <Settings className="w-3 h-3" />
                      <span>プリセット変更・追加</span>
                    </button>
                  </div>
                  <div
                    className={`grid gap-1.5 ${
                      quickPresets.length <= 4
                        ? 'grid-cols-4'
                        : quickPresets.length <= 6
                        ? 'grid-cols-3 sm:grid-cols-6'
                        : 'grid-cols-4'
                    }`}
                  >
                    {quickPresets.map((p) => (
                      <button
                        key={p.id || p.label}
                        type="button"
                        onClick={() => setScheduledDatetimeLocal(getJstDatetimeLocalValue(p.timestamp))}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-accent-subtle text-slate-300 hover:text-accent-light border border-slate-800 hover:border-accent text-[11px] font-semibold transition cursor-pointer flex flex-col items-center justify-center gap-0.5 group shadow-sm"
                        title={`日本時間【${p.jstDisplay}】に設定`}
                      >
                        <span className="font-bold tracking-tight text-slate-200 group-hover:text-accent-light truncate max-w-full">
                          {p.label}
                        </span>
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded font-normal leading-none ${
                            p.isTomorrow
                              ? 'bg-amber-950/70 text-amber-300 border border-amber-800/40'
                              : 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/40'
                          }`}
                        >
                          {p.dateLabel}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 予約実行ボタン */}
                <button
                  id="submit-schedule-button"
                  type="button"
                  onClick={handleScheduleSubmit}
                  disabled={isAdminMode || !hasContent || (!postToBluesky && !postToThreads) || relativeJst.isPast}
                  className="w-full py-2.5 px-3 rounded-lg btn-accent disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {isAdminMode
                      ? '🔒 管理者モード起動中のため予約追加不可'
                      : relativeJst.isPast
                      ? '未来の日本時間を指定してください'
                      : isDemo
                      ? `【${PLATFORM_CATEGORY_CONFIG[currentPlatformCategory].shortName}】日本時間 ${formatToJstString(scheduledTargetTimestamp)} にデモ予約を追加`
                      : `【${PLATFORM_CATEGORY_CONFIG[currentPlatformCategory].shortName}】日本時間 ${formatToJstString(scheduledTargetTimestamp)} に予約追加`}
                  </span>
                </button>
              </div>
            )}
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* 右側：リアルタイムプレビュー & 設定スライドイン領域 */}
      <div id="realtime-preview-area" className="lg:col-span-5 xl:col-span-5 2xl:col-span-6 min-w-0 w-full relative flex flex-col h-full">
        <div className="relative overflow-hidden rounded-2xl min-h-[720px] xl:min-h-[800px] flex-1 flex flex-col h-full">
          {/* リアルタイム投稿プレビュー本体 */}
          <div className={`w-full flex-1 flex flex-col transition-opacity duration-300 ${isSettingsOpen ? 'opacity-25 pointer-events-none filter blur-[0.5px]' : 'opacity-100'}`}>
            <ThreadPreview
              blueskySplits={blueskySplits}
              threadsSplits={threadsSplits}
              threadsTopic={threadsTopic}
              images={images}
              postToBluesky={postToBluesky}
              postToThreads={postToThreads}
              credentials={credentials}
              replySettings={replySettings}
              activeSplitIndex={activeThreadIndex}
              onSelectSplitIndex={handleJumpToThread}
            />
          </div>

          {/* リアルタイム投稿プレビューの領域に右端から左へスライドインする設定画面 */}
          {onSaveCredentials && (
            <SettingsModal
              isOpen={Boolean(isSettingsOpen)}
              onClose={onCloseSettings || onToggleSettings || (() => {})}
              credentials={credentials}
              onSaveCredentials={onSaveCredentials}
              isDemoMode={isDemoMode}
              currentTheme={currentTheme}
              onSelectTheme={onSelectTheme}
              onLogout={onLogout}
              onDeleteSavedAccount={onDeleteSavedAccount}
              onOpenUserGuide={onOpenUserGuide}
              onOpenCommErrors={onOpenCommErrors}
              onOpenServerVault={onOpenServerVault}
              onOpenAdminModal={onOpenAdminModal}
            />
          )}

          {/* サーバー登録情報画面（設定メニューと同じ挙動でリアルタイムプレビュー領域にスライドイン） */}
          <ServerVaultViewerModal
            isOpen={Boolean(isServerVaultOpen)}
            onClose={onCloseServerVault || onToggleServerVault || (() => {})}
            onOpenSettings={() => {
              if (onCloseServerVault) onCloseServerVault();
              if (onOpenSettings) onOpenSettings();
            }}
            isBlueskyLoggedIn={Boolean(
              credentials.blueskyConnected ||
              (credentials.blueskyIdentifier && credentials.blueskyAppPassword)
            )}
            isThreadsLoggedIn={Boolean(
              credentials.threadsConnected || credentials.threadsAccessToken
            )}
            isDemoMode={isDemoMode}
          />
        </div>
      </div>

      {/* クイック選択プリセット編集モーダル */}
      <QuickPresetSettingsModal
        isOpen={isPresetModalOpen}
        onClose={() => setIsPresetModalOpen(false)}
        currentPresets={customPresets}
        onPresetsUpdated={(updated) => setCustomPresets(updated)}
      />

      {/* 例文・サンプル文章挿入モーダル（デスクトップ・モバイル共通コンポーネント） */}
      <SampleTextsModal
        isOpen={showSamples}
        onClose={() => setShowSamples(false)}
        onSelectSample={(sampleText) => handleActiveTextChange(sampleText)}
        onNotify={onNotify}
      />

      {/* 定型文・スニペット管理モーダル */}
      <SnippetModal
        isOpen={isSnippetModalOpen}
        onClose={() => setIsSnippetModalOpen(false)}
        onInsertSnippet={handleInsertSnippet}
        currentText={currentActiveText}
      />

      {/* 特殊フォント ＆ 飾り罫線パレットモーダル */}
      <UnicodeDecoratorModal
        isOpen={isUnicodeModalOpen}
        onClose={() => setIsUnicodeModalOpen(false)}
        selectedText={selectedEditorText}
        onInsertText={handleInsertDecoratedText}
      />

      {/* AIアシスト・投稿リライトモーダル */}
      <AiAssistModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        currentText={currentActiveText}
        initialTab={aiModalInitialTab}
        onApplySplitText={(formatted) => handleActiveTextChange(formatted)}
        onApplyBlueskyText={(newText) => {
          if (onToggleCustomPlatformText) onToggleCustomPlatformText(true);
          if (onChangeBlueskyText) onChangeBlueskyText(newText);
          setActiveEditorTab('bluesky');
        }}
        onApplyThreadsText={(newText) => {
          if (onToggleCustomPlatformText) onToggleCustomPlatformText(true);
          if (onChangeThreadsText) onChangeThreadsText(newText);
          setActiveEditorTab('threads');
        }}
        onApplyBothCustomText={(bsText, thText) => {
          if (onToggleCustomPlatformText) onToggleCustomPlatformText(true);
          if (onChangeBlueskyText) onChangeBlueskyText(bsText);
          if (onChangeThreadsText) onChangeThreadsText(thText);
        }}
        onApplyCommonText={(cText) => {
          onChangeText(cText);
          setActiveEditorTab('common');
        }}
        onNotify={onNotify}
      />

      {/* 🚀 モバイル・縦長時 フローティング固定投稿アクションバー */}
      {!isStaticButtonVisible && (
        <div
          id="floating-crosspost-bar"
          className="fixed bottom-0 left-0 right-0 z-40 bg-[#0b1220]/95 backdrop-blur-md border-t border-slate-700/80 px-3.5 py-2.5 sm:px-6 shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-4"
        >
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
            {/* 左側: 投稿対象プラットフォーム & コンテンツサマリー */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center gap-1.5 text-xs shrink-0">
                {postToBluesky && (
                  <span className="px-2 py-0.5 rounded-md bg-[#0085ff]/20 text-[#38bdf8] border border-[#0085ff]/40 text-[10px] font-bold flex items-center gap-1">
                    <span>🦋</span>
                    <span className="hidden sm:inline">Bluesky</span>
                  </span>
                )}
                {postToThreads && (
                  <span className="px-2 py-0.5 rounded-md bg-purple-950/70 text-purple-300 border border-purple-600/50 text-[10px] font-bold flex items-center gap-1">
                    <span>🌀</span>
                    <span className="hidden sm:inline">Threads</span>
                  </span>
                )}
                {!postToBluesky && !postToThreads && (
                  <span className="text-[11px] text-rose-400 font-medium">投稿先未選択</span>
                )}
              </div>

              {/* 添付 & 通数ステータスサマリー */}
              <div className="flex items-center gap-2 text-[11px] text-slate-300 truncate">
                <span className="font-mono font-bold text-sky-400 bg-sky-950/80 px-1.5 py-0.2 rounded border border-sky-800/60">
                  {totalThreadCount}通
                </span>
                {images.length > 0 && (
                  <span className="text-slate-300 font-medium flex items-center gap-0.5">
                    <ImageIcon className="w-3 h-3 text-sky-400" />
                    <span>{images.length}枚</span>
                  </span>
                )}
                {hashtagCount > 0 && (
                  <span className="text-purple-300 font-medium hidden sm:flex items-center gap-0.5">
                    <Tag className="w-3 h-3 text-purple-400" />
                    <span>#{hashtagCount}</span>
                  </span>
                )}
              </div>
            </div>

            {/* 右側: 投稿アクションボタン */}
            <div className="flex items-center gap-2 shrink-0">
              {postMode === 'scheduled' ? (
                <button
                  type="button"
                  onClick={handleScheduleSubmit}
                  disabled={isAdminMode || !hasContent || (!postToBluesky && !postToThreads) || relativeJst.isPast}
                  className="py-2 px-3.5 sm:px-4 rounded-xl btn-accent disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center gap-1.5 shadow-lg transition cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>予約投稿を実行</span>
                </button>
              ) : isDemo ? (
                <button
                  id="floating-submit-crosspost-button"
                  type="button"
                  onClick={handleSafeSubmitPost}
                  disabled={isAdminMode || !hasContent || (!postToBluesky && !postToThreads)}
                  className="py-2 px-3.5 sm:px-5 rounded-xl bg-sky-500/25 hover:bg-sky-500/35 active:bg-sky-500/40 border border-sky-400/60 disabled:opacity-40 disabled:cursor-not-allowed text-sky-100 font-bold text-xs sm:text-sm flex items-center gap-1.5 transition cursor-pointer shadow-lg"
                >
                  <Sparkles className="w-3.5 h-3.5 text-sky-300" />
                  <span>{isAdminMode ? '🔒 管理者制限中' : 'デモ同時投稿'}</span>
                </button>
              ) : (
                <button
                  id="floating-submit-crosspost-button"
                  type="button"
                  onClick={handleSafeSubmitPost}
                  disabled={isAdminMode || !hasContent || (!postToBluesky && !postToThreads)}
                  className="py-2 px-3.5 sm:px-5 rounded-xl btn-accent disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 transition cursor-pointer shadow-lg"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isAdminMode ? '🔒 管理者制限中' : '今すぐ同時投稿'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
