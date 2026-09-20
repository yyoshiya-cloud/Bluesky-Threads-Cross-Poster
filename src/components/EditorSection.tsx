import React, { useState, useRef, useEffect } from 'react';
import { AttachedImage, SplitThreadItem, ApiCredentials, ThemeAccentId } from '../types';
import { compressImageFileWithThumbnail, processVideoFile } from '../utils/draftStorage';
import { saveMediaBlob } from '../utils/indexedMediaStorage';
import { uploadMediaItem } from '../utils/postApi';
import { CharCounter } from './CharCounter';
import { ImageAttachment } from './ImageAttachment';
import { HashtagSuggester } from './HashtagSuggester';
import { ThreadPreview } from './ThreadPreview';
import { SettingsModal } from './SettingsModal';
import { QuickPresetSettingsModal } from './QuickPresetSettingsModal';
import { SnippetModal } from './SnippetModal';
import { OgpPreviewSection } from './OgpPreviewSection';
import { AiAssistModal, AiAssistTab } from './AiAssistModal';
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
  onNotify?: (msg: { type: 'success' | 'error' | 'info'; title: string; message: string }) => void;
  lastSavedAt: number | null;
  draftStatus: 'saved' | 'saving' | 'error' | 'idle';
  draftError?: string;
  onClearDraft: () => void;
}

const SAMPLE_TEXTS = [
  {
    label: '🌟 アプリ紹介・機能紹介（CrossPost Web Studio とは？）',
    text: `☆自動投稿アプリのテスト投稿です。\n\n【CrossPost Web Studio とは？】\nBluesky（AT Protocol）と Threads（Meta Graph API）への同時投稿・個別予約を直感的に行えるオールインワンWebエディタです。\n\n長文の自動スレッド分割や任意位置での区切り（---）、日本時間（JST）での予約投稿、投稿区分指定（同時 / Bluesky / Threads）、カスタム時間プリセット、週間横スクロールタイムライン・月間カレンダー管理、Threadsトピックタグ、画像・動画の添付とドラッグ並び替え、AIアシスト（スレッド分割・トーン自動調整・セーフティ点検）など、快適なSNS発信に必要な機能がすべて揃っています。\n\n#個人開発 #Bluesky #Threads #バイブコーディング #GoogleAIStudio`,
  },
  {
    label: '✂️ 任意区切りテスト（--- で好きな位置で2つの投稿に分割）',
    text: `☆自動投稿アプリのテスト投稿です。\n\n【お知らせ 1/2】\nBlueskyとThreadsの同時投稿アプリに「任意位置でのスレッド分割」機能が追加されました！✨\n文章中の区切りたい場所に「---」を入力するだけで、思い通りの位置で投稿を分割できます。\n\n---\n\n【お知らせ 2/2】\n各パートが文字数制限（Bluesky 300字 / Threads 500字）を超えている場合でも、自動スレッド分割がスムーズに連動します。\nぜひ快適なクロス投稿をご体験ください！🙌🚀\n#Bluesky #Threads #クロス投稿`,
  },
  {
    label: '✨ 絵文字たっぷり開発ログ（約400字・Bluesky分割 / Threads1投稿）',
    text: `☆自動投稿アプリのテスト投稿です。\n\n✨【休日の個人開発カフェログ☕️＆最新アップデート速報🚀】\n\n今週末は気分転換にお気に入りのカフェでプログラミング作業中👨‍💻🌿\n美味しいドリップコーヒー☕️とシナモンロール🥐をお供に、Bluesky🦋とThreads🌀の同時投稿ツールの開発を進めました💡\n\n🎉 今回のアップデート内容:\n1️⃣ 絵文字や特殊記号の正確なGrapheme Cluster文字数カウントに対応🎨\n2️⃣ リンク・メンション（@bsky.app）の自動Facetリンク化🔗\n3️⃣ 失敗したツリーだけを再送信できる履歴リトライ機能🔄\n4️⃣ 画像のALTテキスト（代替テキスト）入力サポート🖼️\n\nBlueskyでは300文字を超えるため自動で2件のスレッド🧵に分割され、Threadsでは500文字以内に綺麗に1投稿で収まるテスト文章です🌈✨\n皆さんも快適なSNSライフをお過ごしください！🙌🎉 #個人開発 #Bluesky #Threads`,
  },
  {
    label: '🔗 リンク & @メンション自動Facet化テスト',
    text: `☆自動投稿アプリのテスト投稿です。\n\nBlueskyとThreadsへのクロス投稿テスト中！\n公式アカウント @bsky.app や @threads.net をぜひチェックしてみてください。\n\n公式サイト:\n・Bluesky: https://bsky.social\n・Threads: https://threads.net\n\n#Bluesky #Threads #ATProto`,
  },
  {
    label: '🧵 長文コラム（約700字・自動スレッド分割テスト）',
    text: `☆自動投稿アプリのテスト投稿です。\n\n【分散型SNS時代のクロスプラットフォーム運用戦略と情報発信の未来】\n\n現代のソーシャルメディア運用において、特定のプラットフォームに過度に依存するリスクが強く認識されるようになりました。それに伴い、Blueskyに代表されるAT Protocolを活用したオープンな分散型ネットワークと、Instagramの強力なソーシャルグラフを基盤とするThreadsのような大規模プラットフォームを戦略的に併用するクリエイターや企業が急速に増加しています。\n\nそれぞれのプラットフォームには明確なカルチャーと強みがあります。Blueskyは技術者やクリエイターが集い、ユーザー自身がアルゴリズムを選択できるカスタムフィードや、ポータブルな分散型ID（DID）による自由度の高いオープンウェブの精神が息づいています。一方のThreadsは、親しみやすい日常の会話やトレンドの拡散力に優れ、多様で幅広いオーディエンスへ迅速にリーチできる即効性を誇ります。\n\nしかし、同時に運用者を悩ませるのが「文字数制限の差異」と「スレッド分割の手間」です。Blueskyの1投稿あたり300文字、Threadsの500文字という異なる仕様に対し、手動で改行や区切りを調整して投稿し直す作業は大きな負担となります。\n\n本アプリケーションは、入力された文章の文脈や句読点、段落のまとまりを自動解析し、読者にとって最も自然で読みやすい位置で(1/N)などの連番を付与しながらスレッド化を行います。これにより、本格的な長文コラムや考察記事、プロダクトのアップデート告知なども、各SNSの読書体験を損なうことなく最適な形で届けることが可能になります。長文コンテンツでも安心してクロス投稿を行っていただけます。`,
  },
  {
    label: '🦋 ニュース・発表（中長文・約350字）',
    text: `☆自動投稿アプリのテスト投稿です。\n\n【Bluesky & Threads 同時投稿機能のお知らせ】\n本日、分散型SNS「Bluesky」と「Threads」にスムーズに同時投稿できるWebエディタを公開しました！\n\n■ 主な特長\n1. Bluesky (300文字) と Threads (500文字) の文字数制限をリアルタイム判定\n2. 制限を超える長文は自然な文末でツリー（スレッド）投稿へ自動分割\n3. リンクや @メンション の自動Facetリンク化、画像Altテキスト入力に対応\n4. 自動下書き保存機能により、ブラウザリロードや誤操作時も入力内容が消失する心配がありません\n\n複数プラットフォームへの情報発信をよりシームレスに実現します。ぜひお試しください！`,
  },
  {
    label: '💻 技術Tips・短文（1投稿に収まる文字数）',
    text: `☆自動投稿アプリのテスト投稿です。\n\nBlueskyのAT Protocolは、分散型ID（did:plc）とXRPCエンドポイントによるオープンなデータ管理が特徴です。\nアプリパスワードを発行することで、メインのパスワードを安全に保護しながら外部ツールから安全に投稿（createRecord）を行うことができます。`,
  },
];

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
}) => {
  const [showSamples, setShowSamples] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // エディタタブ状態: 'common' (共通ベース) | 'bluesky' (Bluesky個別) | 'threads' (Threads個別)
  const [activeEditorTab, setActiveEditorTab] = useState<'common' | 'bluesky' | 'threads'>('common');
  // スニペット（定型文・テンプレート）モーダル表示状態
  const [isSnippetModalOpen, setIsSnippetModalOpen] = useState(false);
  // AIアシストモーダル表示状態
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiModalInitialTab, setAiModalInitialTab] = useState<AiAssistTab>('split');

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
    if (window.confirm('Bluesky専用の個別編集を解除し、共通本文と同期しますか？（個別の編集内容はリセットされます）')) {
      if (onChangeBlueskyText) onChangeBlueskyText('');
      if (!isThreadsCustomized && onToggleCustomPlatformText) {
        onToggleCustomPlatformText(false);
      }
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
    if (window.confirm('Threads専用の個別編集を解除し、共通本文と同期しますか？（個別の編集内容はリセットされます）')) {
      if (onChangeThreadsText) onChangeThreadsText('');
      if (!isBlueskyCustomized && onToggleCustomPlatformText) {
        onToggleCustomPlatformText(false);
      }
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

  // 下部パネルドックタブ: 'media' (画像・動画) | 'tags' (ハッシュタグ・トピック) | 'ogp' (リンクプレビュー) | 'settings' (分割設定)
  const [bottomDockTab, setBottomDockTab] = useState<'media' | 'tags' | 'ogp' | 'settings'>(() =>
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

  const handleScheduleSubmit = () => {
    if (!onSchedulePost) return;
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

  const hasContent = Boolean(text.trim().length > 0 || (images && images.length > 0));
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
    <div id="editor-section-container" className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start lg:items-stretch">
      {/* 左側：エディタ & 設定 */}
      <div className="lg:col-span-6 xl:col-span-5 space-y-3 min-w-0 w-full flex flex-col">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 sm:p-4 space-y-3 shadow-xl">
          {/* 上部バー：投稿先トグル & サンプル挿入 */}
          {/* 一体化上部バー：投稿先トグル & エディタ分岐タブ & 例文・クリア */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
            {/* 投稿先セレクター */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xs font-bold text-slate-300">投稿先:</span>
              <label
                id="toggle-post-bluesky-label"
                className={`flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-lg border text-xs font-bold cursor-pointer transition select-none ${
                  postToBluesky
                    ? 'bg-[#0085ff]/15 text-[#0085ff] border-[#0085ff]/50 ring-1 ring-[#0085ff]/30'
                    : 'bg-slate-950 text-slate-500 border-slate-800 opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={postToBluesky}
                  onChange={(e) => onTogglePostToBluesky(e.target.checked)}
                  className="hidden"
                />
                <span>🦋 Bluesky</span>
                {postToBluesky && <span className="w-1.5 h-1.5 rounded-full bg-[#0085ff]" />}
              </label>

              <label
                id="toggle-post-threads-label"
                className={`flex items-center gap-1 px-2 py-0.5 sm:py-1 rounded-lg border text-xs font-bold cursor-pointer transition select-none ${
                  postToThreads
                    ? 'bg-slate-950 text-purple-300 border-purple-500/60 ring-1 ring-purple-500/30'
                    : 'bg-slate-950 text-slate-500 border-slate-800 opacity-60'
                }`}
              >
                <input
                  type="checkbox"
                  checked={postToThreads}
                  onChange={(e) => onTogglePostToThreads(e.target.checked)}
                  className="hidden"
                />
                <span>🌀 Threads</span>
                {postToThreads && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
              </label>
            </div>

            {/* プラットフォーム別テキスト分岐タブ (インラインコンパクト) */}
            <div className="inline-flex items-center p-0.5 bg-slate-950/90 border border-slate-800 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setActiveEditorTab('common')}
                className={`px-2 py-1 rounded-md font-bold flex items-center gap-1 transition cursor-pointer ${
                  activeEditorTab === 'common'
                    ? 'bg-slate-800 text-slate-100 shadow-sm border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="共通ベース文章の編集"
              >
                <Globe className="w-3 h-3 text-sky-400" />
                <span>共通</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveEditorTab('bluesky')}
                className={`px-2 py-1 rounded-md font-bold flex items-center gap-1 transition cursor-pointer ${
                  activeEditorTab === 'bluesky'
                    ? 'bg-[#0085ff]/20 text-[#38bdf8] shadow-sm border border-[#0085ff]/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Bluesky個別文章の編集"
              >
                <span>🦋 Bluesky</span>
                {isBlueskyCustomized && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0085ff]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveEditorTab('threads')}
                className={`px-2 py-1 rounded-md font-bold flex items-center gap-1 transition cursor-pointer ${
                  activeEditorTab === 'threads'
                    ? 'bg-purple-500/20 text-purple-300 shadow-sm border border-purple-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Threads個別文章の編集"
              >
                <span>🌀 Threads</span>
                {isThreadsCustomized && (
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                )}
              </button>
            </div>

            {/* 例文挿入 & 下書きクリアボタン */}
            <div className="flex items-center gap-1.5">
              {hasContent && (
                <button
                  type="button"
                  onClick={onClearDraft}
                  className="text-slate-400 hover:text-rose-400 hover:bg-slate-800 text-xs px-2 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                  title="投稿内容をクリア"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">クリア</span>
                </button>
              )}

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSamples(!showSamples)}
                  className="text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs px-2 py-1 rounded-lg border border-slate-800 transition cursor-pointer flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>例文</span>
                </button>

                {showSamples && (
                  <div className="absolute right-0 mt-1.5 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-20 space-y-1">
                    <div className="text-[11px] font-bold text-slate-400 px-2 py-1 border-b border-slate-800">
                      サンプル文章を挿入
                    </div>
                    {SAMPLE_TEXTS.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          handleActiveTextChange(s.text);
                          setShowSamples(false);
                        }}
                        className="w-full text-left text-xs text-slate-200 hover:bg-slate-800 p-2 rounded-lg transition truncate cursor-pointer"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

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
                        if (window.confirm('共通本文の内容をBluesky専用テキストへ上書きコピーしますか？')) {
                          if (onChangeBlueskyText) onChangeBlueskyText(text);
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
                        if (window.confirm('共通本文の内容をThreads専用テキストへ上書きコピーしますか？')) {
                          if (onChangeThreadsText) onChangeThreadsText(text);
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
          )}

          {/* エディタツールバー：AIアシスト & スニペット挿入 & 任意区切り & 文字サイズ */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 px-0.5 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* ✨ AIアシストボタン群 */}
              <div className="inline-flex items-center bg-slate-950/80 p-0.5 rounded-lg border border-slate-800">
                <button
                  id="open-ai-assist-modal-button"
                  type="button"
                  onClick={() => {
                    setAiModalInitialTab('split');
                    setIsAiModalOpen(true);
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 hover:text-white transition text-xs font-bold cursor-pointer"
                  title="AIによる自然なスレッド分割・校正"
                >
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  <span>AIアシスト</span>
                </button>

                <button
                  id="quick-ai-tone-button"
                  type="button"
                  onClick={() => {
                    setAiModalInitialTab('tone');
                    setIsAiModalOpen(true);
                  }}
                  className="px-1.5 py-1 rounded-md hover:bg-purple-500/20 text-purple-300 transition text-[11px] font-medium cursor-pointer"
                  title="Bluesky/Threads向けトーン自動調整"
                >
                  <Wand2 className="w-3 h-3 text-purple-400" />
                </button>

                <button
                  id="quick-ai-safety-button"
                  type="button"
                  onClick={() => {
                    setAiModalInitialTab('safety');
                    setIsAiModalOpen(true);
                  }}
                  className="px-1.5 py-1 rounded-md hover:bg-emerald-500/20 text-emerald-300 transition text-[11px] font-medium cursor-pointer"
                  title="セーフティ点検・事前校正"
                >
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                </button>
              </div>

              {/* 定型文・スニペット */}
              <button
                id="open-snippets-button"
                type="button"
                onClick={() => setIsSnippetModalOpen(true)}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition text-xs font-medium cursor-pointer shadow-xs"
                title="定型文・スニペット挿入"
              >
                <FileText className="w-3 h-3 text-amber-400" />
                <span>定型文</span>
              </button>

              {/* 区切り線挿入 */}
              <button
                id="insert-manual-separator-button"
                type="button"
                onClick={handleInsertSeparator}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800/90 hover:bg-accent-subtle text-accent-light border border-slate-700/80 transition text-xs font-medium cursor-pointer shadow-xs"
                title="カーソル位置に区切り線 (---) を挿入してスレッド分割"
              >
                <Scissors className="w-3 h-3 text-accent-light" />
                <span>区切る (---)</span>
              </button>
            </div>

            {/* 文字サイズ切り替え */}
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs font-semibold">
              {(['sm', 'md', 'lg'] as EditorFontSize[]).map((size) => (
                <button
                  key={size}
                  id={`editor-font-size-${size}-btn`}
                  type="button"
                  onClick={() => handleEditorFontSizeChange(size)}
                  className={`px-1.5 py-0.5 rounded text-[11px] transition cursor-pointer ${
                    editorFontSize === size
                      ? 'bg-slate-800 text-sky-200 border border-slate-700 shadow-xs font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title={`文字サイズ: ${EDITOR_FONT_SIZE_CONFIG[size].label}`}
                >
                  {EDITOR_FONT_SIZE_CONFIG[size].label}
                </button>
              ))}
            </div>
          </div>

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
                  : 'ここに投稿内容を入力してください...（---でスレッド分割）'
              }
              rows={4}
              className={`w-full bg-slate-950/80 border ${
                activeEditorTab === 'bluesky' && isBlueskyCustomized
                  ? 'border-sky-500/50 focus:border-sky-400'
                  : activeEditorTab === 'threads' && isThreadsCustomized
                  ? 'border-purple-500/50 focus:border-purple-400'
                  : 'border-slate-800'
              } rounded-t-xl rounded-b-none border-b-0 p-3 text-slate-100 placeholder-slate-600 ${EDITOR_FONT_SIZE_CONFIG[editorFontSize].textClass} focus-ring-accent transition resize-y font-sans min-h-[96px]`}
            />

            {/* テキストエリア直下の一体型スマートステータスバー */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-slate-950/90 border border-slate-800 rounded-b-xl -mt-[1px]">
              {/* 左側: コンパクトインライン文字数カウンター */}
              <CharCounter
                text={currentActiveText}
                postToBluesky={postToBluesky}
                postToThreads={postToThreads}
                blueskySplitsCount={blueskySplits.length}
                threadsSplitsCount={threadsSplits.length}
                autoSplit={autoSplit}
                isCompact={true}
              />

              {/* 右側: 保存ステータス & 個別編集バッジ */}
              <div className="flex items-center gap-2 text-[11px] text-slate-400 ml-auto">
                {customPlatformText && (isBlueskyCustomized || isThreadsCustomized) && (
                  <span className="text-[10px] text-sky-400 font-mono bg-sky-950/90 border border-sky-800/60 px-1.5 py-0.2 rounded">
                    {activeEditorTab === 'bluesky' ? '🦋 Bluesky個別' : activeEditorTab === 'threads' ? '🌀 Threads個別' : '個別設定あり'}
                  </span>
                )}

                {draftStatus === 'saving' && (
                  <span className="flex items-center gap-1 text-sky-400 text-[10px]">
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
                  <span className="text-[10px] text-slate-500">自動保存ON</span>
                )}
              </div>
            </div>
          </div>

          {/* ドック型サブパネルナビゲーションタブ */}
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-1">
              <div className="flex items-center gap-1 overflow-x-auto text-xs">
                <button
                  type="button"
                  onClick={() => setBottomDockTab('media')}
                  className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer text-xs ${
                    bottomDockTab === 'media'
                      ? 'bg-slate-800 text-slate-100 border border-slate-700 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                  <span>メディア</span>
                  {images.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-500 text-white font-mono">
                      {images.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setBottomDockTab('tags')}
                  className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer text-xs ${
                    bottomDockTab === 'tags'
                      ? 'bg-slate-800 text-slate-100 border border-slate-700 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                >
                  <Tag className="w-3.5 h-3.5 text-purple-400" />
                  <span>タグ & トピック</span>
                  {threadsTopic && (
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setBottomDockTab('ogp')}
                  className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer text-xs ${
                    bottomDockTab === 'ogp'
                      ? 'bg-slate-800 text-slate-100 border border-slate-700 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>リンク OGP</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBottomDockTab('settings')}
                  className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5 transition cursor-pointer text-xs ${
                    bottomDockTab === 'settings'
                      ? 'bg-slate-800 text-slate-100 border border-slate-700 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
                  <span>分割設定</span>
                </button>
              </div>

              <span className="text-[10px] text-slate-500 hidden sm:inline">
                パネル切替
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

                  {/* Threads専用トピック入力エリア */}
                  {postToThreads && onChangeThreadsTopic && (
                    <div className="p-3 bg-slate-950/80 rounded-xl border border-purple-900/50 hover:border-purple-800/70 transition-colors space-y-2">
                      <div className="flex items-center justify-between">
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
                    </div>
                  )}
                </div>
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

            {/* モード1: 同時投稿 (即時実行) */}
            {postMode === 'instant' && (
              <div className="space-y-1.5 animate-in fade-in duration-150">
                {isDemo ? (
                  <>
                    <button
                      id="submit-crosspost-button"
                      type="button"
                      onClick={onSubmitPost}
                      disabled={!hasContent || (!postToBluesky && !postToThreads)}
                      className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 active:bg-sky-500/35 border border-sky-400/40 hover:border-sky-400/60 disabled:opacity-40 disabled:cursor-not-allowed text-sky-100 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
                    >
                      <Sparkles className="w-4 h-4 text-sky-300/80" />
                      <span>{getPostButtonLabel()}</span>
                    </button>
                    <p className="text-[10px] text-sky-300/80 text-center font-medium">
                      ※DEMOモードのため実際のSNSには投稿されず、安全に投稿シミュレーション・履歴作成をお試しいただけます。
                    </p>
                  </>
                ) : (
                  <button
                    id="submit-crosspost-button"
                    type="button"
                    onClick={onSubmitPost}
                    disabled={!hasContent || (!postToBluesky && !postToThreads)}
                    className="w-full py-2.5 sm:py-3 px-4 rounded-xl btn-accent disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer animate-in fade-in duration-150"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{getPostButtonLabel()}</span>
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

                {/* 🎯 予約投稿区分（同時投稿 / Blueskyのみ / Threadsのみ） */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-semibold text-slate-300">🎯 投稿する区分:</span>
                    <span className="text-[9px] text-slate-500">
                      {PLATFORM_CATEGORY_CONFIG[currentPlatformCategory].description}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleSelectPlatformCategory('both')}
                      className={`px-2 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        currentPlatformCategory === 'both'
                          ? 'btn-accent text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                      title="BlueskyとThreadsの両方に予約投稿します"
                    >
                      <span>🚀</span>
                      <span>同時投稿</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectPlatformCategory('bluesky')}
                      className={`px-2 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        currentPlatformCategory === 'bluesky'
                          ? 'bg-[#0085ff] text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                      title="Blueskyのみに予約投稿します"
                    >
                      <span>🦋</span>
                      <span>Bluesky</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectPlatformCategory('threads')}
                      className={`px-2 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                        currentPlatformCategory === 'threads'
                          ? 'bg-purple-700 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                      title="Threadsのみに予約投稿します"
                    >
                      <span>🌀</span>
                      <span>Threads</span>
                    </button>
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
                  disabled={!hasContent || (!postToBluesky && !postToThreads) || relativeJst.isPast}
                  className="w-full py-2.5 px-3 rounded-lg btn-accent disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    {relativeJst.isPast
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

      {/* 右側：リアルタイムプレビュー & 設定スライドイン領域 */}
      <div id="realtime-preview-area" className="lg:col-span-6 xl:col-span-7 min-w-0 w-full relative flex flex-col h-full">
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
            />
          )}
        </div>
      </div>

      {/* クイック選択プリセット編集モーダル */}
      <QuickPresetSettingsModal
        isOpen={isPresetModalOpen}
        onClose={() => setIsPresetModalOpen(false)}
        currentPresets={customPresets}
        onPresetsUpdated={(updated) => setCustomPresets(updated)}
      />

      {/* 定型文・スニペット管理モーダル */}
      <SnippetModal
        isOpen={isSnippetModalOpen}
        onClose={() => setIsSnippetModalOpen(false)}
        onInsertSnippet={handleInsertSnippet}
        currentText={currentActiveText}
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
    </div>
  );
};
