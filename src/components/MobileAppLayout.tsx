import React, { useState, useRef } from 'react';
import { RootViewModel } from '../core/types';
import { useEventDispatch } from '../core/EventChainContext';
import {
  Send,
  Sparkles,
  Palette,
  FileText,
  Clock,
  Settings,
  History,
  Eye,
  Edit3,
  Trash2,
  Tag,
  Copy,
  Monitor,
  Smartphone,
  Menu,
  X,
  HelpCircle,
  BarChart3,
  Info,
  ShieldAlert,
  FolderLock,
  ArrowRight,
} from 'lucide-react';
import { CharCounter } from './CharCounter';
import { ImageAttachment } from './ImageAttachment';
import { HashtagSuggester } from './HashtagSuggester';
import { ThreadPreview } from './ThreadPreview';
import { SnippetModal } from './SnippetModal';
import { SampleTextsModal } from './SampleTextsModal';
import { AiAssistModal, AiAssistTab } from './AiAssistModal';
import { UnicodeDecoratorModal } from './UnicodeDecoratorModal';
import { ReplySettingsSection } from './ReplySettingsSection';
import { OgpPreviewSection } from './OgpPreviewSection';
import {
  loadQuickDecorationsFromStorage,
  QuickDecorationItem,
} from '../utils/unicodeFontConverter';
import {
  formatToJstString,
  getJstQuickPresets,
  getJstDatetimeLocalValue,
  parseJstDatetimeLocal,
  getRelativeTimeJst,
  deleteScheduledPost,
} from '../utils/scheduledStorage';
import { ThemeSelector } from './ThemeSelector';
import { AttachedImage, ReplyTargetInfo } from '../types';

export type MobileTab = 'editor' | 'preview' | 'schedule_history' | 'settings';

interface MobileAppLayoutProps {
  viewModel: RootViewModel;
  isAdminMode: boolean;
  onOpenAdminModal: () => void;
  onDeactivateAdminMode: () => void;
  onOpenModePasswordModal: () => void;
  isMobileUserAgent: boolean;
  onToggleViewMode: () => void;
}

export const MobileAppLayout: React.FC<MobileAppLayoutProps> = ({
  viewModel,
  isAdminMode,
  onOpenAdminModal,
  onDeactivateAdminMode,
  onOpenModePasswordModal,
  isMobileUserAgent,
  onToggleViewMode,
}) => {
  const dispatch = useEventDispatch();

  // モバイル用アクティブタブ
  const [activeTab, setActiveTab] = useState<MobileTab>('editor');

  // エディタ専用タブ (共通 / Bluesky / Threads)
  const [editorPlatformTab, setEditorPlatformTab] = useState<'common' | 'bluesky' | 'threads'>('common');

  // プレビュー専用タブ (Bluesky / Threads)
  const [previewPlatformTab, setPreviewPlatformTab] = useState<'bluesky' | 'threads'>('bluesky');

  // 予約・履歴サブタブ
  const [subTabHistory, setSubTabHistory] = useState<'scheduled' | 'history'>('scheduled');

  // モーダル・ドロワー状態
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiModalInitialTab, setAiModalInitialTab] = useState<AiAssistTab>('split');
  const [isSnippetModalOpen, setIsSnippetModalOpen] = useState(false);
  const [isSampleModalOpen, setIsSampleModalOpen] = useState(false);
  const [isDecorModalOpen, setIsDecorModalOpen] = useState(false);
  const [isScheduleSheetOpen, setIsScheduleSheetOpen] = useState(false);
  const [scheduleDatetime, setScheduleDatetime] = useState<string>('');

  // クイック装飾
  const [quickDecors] = useState<QuickDecorationItem[]>(() =>
    loadQuickDecorationsFromStorage()
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ログイン状態
  const isBlueskyLoggedIn = Boolean(
    viewModel.credentials.blueskyConnected ||
      (viewModel.credentials.blueskyIdentifier && viewModel.credentials.blueskyAppPassword)
  );
  const isThreadsLoggedIn = Boolean(
    viewModel.credentials.threadsConnected || viewModel.credentials.threadsAccessToken
  );

  const isNeitherSelected = !viewModel.postToBluesky && !viewModel.postToThreads;

  // 現在のテキスト取得
  const currentText =
    editorPlatformTab === 'bluesky' && viewModel.customPlatformText
      ? viewModel.blueskyText || ''
      : editorPlatformTab === 'threads' && viewModel.customPlatformText
      ? viewModel.threadsText || ''
      : viewModel.text;

  const handleTextChange = (val: string) => {
    if (editorPlatformTab === 'bluesky' && viewModel.customPlatformText) {
      dispatch({ type: 'UPDATE_BLUESKY_TEXT', payload: val });
    } else if (editorPlatformTab === 'threads' && viewModel.customPlatformText) {
      dispatch({ type: 'UPDATE_THREADS_TEXT', payload: val });
    } else {
      dispatch({ type: 'UPDATE_TEXT', payload: val });
    }
  };

  // テキスト挿入ユーティリティ
  const handleInsertText = (insertStr: string) => {
    const el = textareaRef.current;
    if (!el) {
      handleTextChange(currentText + insertStr);
      return;
    }
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const newText = currentText.slice(0, start) + insertStr + currentText.slice(end);
    handleTextChange(newText);
    setTimeout(() => {
      el.focus();
      const newPos = start + insertStr.length;
      el.setSelectionRange(newPos, newPos);
    }, 50);
  };

  // URL置換ユーティリティ
  const handleReplaceUrl = (oldUrl: string, newUrl: string) => {
    const updated = currentText.replace(oldUrl, newUrl);
    handleTextChange(updated);
  };

  // 予約投稿実行
  const handleExecuteSchedule = (timestamp: number) => {
    if (isNeitherSelected) {
      dispatch({
        type: 'NOTIFY',
        payload: {
          type: 'warning',
          title: '投稿先が未選択です',
          message: 'Bluesky または Threads のいずれかを有効にしてください。',
        },
      });
      return;
    }
    if (!currentText.trim() && viewModel.images.length === 0) {
      dispatch({
        type: 'NOTIFY',
        payload: {
          type: 'warning',
          title: '本文が空です',
          message: '投稿するテキストまたは画像を添付してください。',
        },
      });
      return;
    }

    dispatch({
      type: 'SCHEDULE_POST_REQUEST',
      payload: { scheduledAt: timestamp },
    });
    setIsScheduleSheetOpen(false);
  };

  // 予約投稿キャンセル
  const handleDeleteScheduled = (id: string) => {
    deleteScheduledPost(id);
    dispatch({ type: 'REFRESH_SCHEDULED_POSTS' });
    dispatch({
      type: 'NOTIFY',
      payload: {
        type: 'info',
        title: '予約投稿をキャンセルしました',
        message: '指定された予約投稿を削除しました。',
      },
    });
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#07090E] text-slate-100 selection:bg-sky-500 selection:text-white pb-24">
      {/* 1. ADMIN MODE 警告バー */}
      {isAdminMode && (
        <div className="w-full bg-amber-950/95 border-b border-amber-500/50 px-3 py-1.5 flex items-center justify-between text-[11px] text-amber-200 sticky top-0 z-50">
          <div className="flex items-center gap-1.5 font-bold truncate">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
            <span className="truncate">🔒 ADMIN MODE 起動中</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onOpenAdminModal}
              className="px-2 py-0.5 rounded bg-amber-500/30 text-amber-100 text-[10px] font-bold"
            >
              設定
            </button>
            <button
              type="button"
              onClick={onDeactivateAdminMode}
              className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-[10px] font-bold"
            >
              終了
            </button>
          </div>
        </div>
      )}

      {/* 2. モバイル用コンパクトヘッダー */}
      <header className="sticky top-0 z-40 bg-[#0C101A]/95 backdrop-blur-md border-b border-slate-800 px-3 py-2 flex items-center justify-between gap-2 shadow-sm">
        {/* 左: ロゴ・タイトル & モードバッジ */}
        <div className="flex items-center gap-2 select-none">
          <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-700/80 overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
            <img src="/favicon.svg" alt="CrossPost" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs tracking-tight text-white">CrossPost</span>
              <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                📱 MOBILE
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-mono">
              <span className="flex items-center gap-1">
                <span>🦋</span>
                <span className={`w-1.5 h-1.5 rounded-full ${isBlueskyLoggedIn ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              </span>
              <span className="flex items-center gap-1">
                <span>🌀</span>
                <span className={`w-1.5 h-1.5 rounded-full ${isThreadsLoggedIn ? 'bg-emerald-400' : 'bg-slate-600'}`} />
              </span>
            </div>
          </div>
        </div>

        {/* 右: モード切替(デモ/本番) & 表示モード切替 & メニュー */}
        <div className="flex items-center gap-1.5">
          {viewModel.isDemoMode ? (
            <button
              type="button"
              onClick={() => dispatch({ type: 'TOGGLE_DEMO_MODE' })}
              className="px-2 py-1 rounded-md text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-400/40 flex items-center gap-1 shadow-xs"
            >
              <Sparkles className="w-2.5 h-2.5" />
              <span>DEMO</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenModePasswordModal}
              className="px-2 py-1 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shadow-xs"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>LIVE</span>
            </button>
          )}

          {/* PC版表示への切替ボタン */}
          <button
            type="button"
            onClick={onToggleViewMode}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs transition flex items-center gap-1 shadow-xs"
            title="デスクトップ（PC）版表示に切り替えます"
          >
            <Monitor className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[10px] hidden sm:inline">PC表示</span>
          </button>

          {/* ドロワーメニュートグル */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition"
            aria-label="メニューを開く"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 3. モバイル メインセグメントナビゲーション */}
      <nav className="bg-[#0B0F19]/95 backdrop-blur-md border-b border-slate-800/80 px-2 py-1.5 sticky top-[45px] z-30 flex items-center justify-between gap-1 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('editor')}
          className={`flex-1 min-h-[40px] py-1.5 px-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeTab === 'editor'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-900/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
          }`}
        >
          <Edit3 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">エディタ</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className={`flex-1 min-h-[40px] py-1.5 px-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition relative cursor-pointer ${
            activeTab === 'preview'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-900/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
          }`}
        >
          <Eye className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">プレビュー</span>
          {viewModel.autoSplit && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 absolute top-1.5 right-2" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('schedule_history')}
          className={`flex-1 min-h-[40px] py-1.5 px-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition relative cursor-pointer ${
            activeTab === 'schedule_history'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-900/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
          }`}
        >
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">予約・履歴</span>
          {viewModel.scheduledPosts.filter((p) => p.status === 'pending').length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[9px] font-bold tabular-nums">
              {viewModel.scheduledPosts.filter((p) => p.status === 'pending').length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex-1 min-h-[40px] py-1.5 px-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-900/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80'
          }`}
        >
          <Settings className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">設定</span>
        </button>
      </nav>

      {/* 4. メインコンテンツ領域 */}
      <main className="flex-1 p-3 max-w-lg w-full mx-auto space-y-3">
        {/* ==================== TAB 1: エディタ ==================== */}
        {activeTab === 'editor' && (
          <div className="space-y-3 animate-in fade-in duration-150">
            {/* 投稿先プラットフォーム選択バー */}
            <div className="bg-[#0E1320] border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-sm">
              <span className="text-xs font-bold text-slate-300">投稿先:</span>
              <div className="flex items-center gap-2">
                {/* 🦋 Bluesky トグル */}
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'TOGGLE_POST_TO_BLUESKY', payload: !viewModel.postToBluesky })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    viewModel.postToBluesky
                      ? 'bg-[#0085ff] text-white shadow-sm ring-1 ring-[#0085ff]/50'
                      : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}
                >
                  <span>🦋 Bluesky</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${viewModel.postToBluesky ? 'bg-white' : 'bg-slate-600'}`} />
                </button>

                {/* 🌀 Threads トグル */}
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'TOGGLE_POST_TO_THREADS', payload: !viewModel.postToThreads })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    viewModel.postToThreads
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-sm ring-1 ring-purple-500/50'
                      : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}
                >
                  <span>🌀 Threads</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${viewModel.postToThreads ? 'bg-white' : 'bg-slate-600'}`} />
                </button>
              </div>
            </div>

            {/* Threads専用トピック入力欄 (ThreadsがONの場合) */}
            {viewModel.postToThreads && (
              <div className="bg-[#0E1320] border border-purple-900/40 rounded-xl p-2.5 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-purple-200 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-purple-400" />
                    Threadsトピックタグ (任意)
                  </span>
                  <span className="text-[10px] text-slate-400">#なしで入力</span>
                </div>
                <input
                  type="text"
                  value={viewModel.threadsTopic || ''}
                  onChange={(e) => dispatch({ type: 'UPDATE_THREADS_TOPIC', payload: e.target.value })}
                  placeholder="例: Tech, AI, 開発記録, 日常"
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-600 focus:outline-hidden focus:border-purple-500"
                />
              </div>
            )}

            {/* 本文入力エディタカード */}
            <div className="bg-[#0E1320] border border-slate-800 rounded-2xl p-3 shadow-md space-y-2.5">
              {/* エディタ上部ツールバー */}
              <div className="flex items-center justify-between gap-1 overflow-x-auto scrollbar-none pb-1 text-xs">
                <div className="flex items-center gap-1 shrink-0">
                  {/* AIアシスト */}
                  <button
                    type="button"
                    onClick={() => {
                      setAiModalInitialTab('split');
                      setIsAiModalOpen(true);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-200 border border-sky-500/40 font-bold flex items-center gap-1 text-[11px]"
                  >
                    <Sparkles className="w-3 h-3 text-sky-300" />
                    <span>AIアシスト</span>
                  </button>

                  {/* 定型文 */}
                  <button
                    type="button"
                    onClick={() => setIsSnippetModalOpen(true)}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border border-amber-500/40 font-medium flex items-center gap-1 text-[11px] cursor-pointer"
                  >
                    <FileText className="w-3 h-3 text-amber-300" />
                    <span>定型文</span>
                  </button>

                  {/* 例文 */}
                  <button
                    type="button"
                    onClick={() => setIsSampleModalOpen(true)}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-500/40 font-medium flex items-center gap-1 text-[11px] cursor-pointer"
                    title="サンプル文章（例文）を選択して挿入"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-300" />
                    <span>例文</span>
                  </button>

                  {/* 特殊装飾 */}
                  <button
                    type="button"
                    onClick={() => setIsDecorModalOpen(true)}
                    className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 font-medium flex items-center gap-1 text-[11px]"
                  >
                    <Palette className="w-3 h-3 text-purple-300" />
                    <span>装飾</span>
                  </button>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* クリア */}
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'CLEAR_DRAFT' })}
                    className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 text-[11px]"
                    title="本文と下書きをクリア"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* クイック装飾バー (横スクロール可能) */}
              <div className="p-1.5 bg-slate-950/80 rounded-xl border border-slate-800/80">
                <div className="flex items-center justify-between px-1 pb-1 text-[10px] text-slate-400">
                  <span className="font-bold flex items-center gap-1 text-slate-300">
                    <span>⚡ クイック装飾</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsDecorModalOpen(true)}
                    className="text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>全24種・装飾一覧</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                  </button>
                </div>
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1">
                  {quickDecors.slice(0, 14).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleInsertText(item.insert)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-slate-200 text-xs font-mono shrink-0 transition active:scale-95 shadow-xs"
                      title={item.title || item.label}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* メインテキストエリア */}
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={currentText}
                  onChange={(e) => handleTextChange(e.target.value)}
                  placeholder="Bluesky & Threads に投稿する文章を入力してください..."
                  rows={6}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder-slate-600 focus:outline-hidden focus:border-sky-500 focus:ring-1 focus:ring-sky-500/30 transition resize-y leading-relaxed font-sans"
                />
              </div>

              {/* 文字数メーター */}
              <div className="pt-1 border-t border-slate-800/70">
                <CharCounter
                  text={currentText}
                  postToBluesky={viewModel.postToBluesky}
                  postToThreads={viewModel.postToThreads}
                  blueskySplitsCount={viewModel.blueskySplits.length}
                  threadsSplitsCount={viewModel.threadsSplits.length}
                  autoSplit={viewModel.autoSplit}
                  isCompact={true}
                />
              </div>
            </div>

            {/* 画像・動画添付エリア */}
            <div className="bg-[#0E1320] border border-slate-800 rounded-2xl p-3 space-y-2 shadow-sm">
              <ImageAttachment
                images={viewModel.images}
                onAddImages={(imgs) => dispatch({ type: 'ADD_IMAGES', payload: imgs })}
                onReorderImages={(imgs) => dispatch({ type: 'SET_IMAGES', payload: imgs })}
                onRemoveImage={(id) => dispatch({ type: 'REMOVE_IMAGE', payload: id })}
                onClearImages={() => dispatch({ type: 'CLEAR_IMAGES' })}
                onUpdateImageAlt={(id, alt) => dispatch({ type: 'UPDATE_IMAGE_ALT', payload: { id, alt } })}
                postToBluesky={viewModel.postToBluesky}
                postToThreads={viewModel.postToThreads}
              />
            </div>

            {/* ハッシュタグ・トレンド候補 */}
            <div className="bg-[#0E1320] border border-slate-800 rounded-2xl p-3 shadow-sm">
              <HashtagSuggester
                text={currentText}
                onUpdateText={(newText) => handleTextChange(newText)}
              />
            </div>

            {/* 返信先・リプライ指定 */}
            <ReplySettingsSection
              replySettings={viewModel.replySettings}
              postToBluesky={viewModel.postToBluesky}
              postToThreads={viewModel.postToThreads}
              credentials={viewModel.credentials}
              isDemoMode={viewModel.isDemoMode}
              onUpdateSettings={(settings) =>
                dispatch({ type: 'UPDATE_REPLY_SETTINGS', payload: settings })
              }
              onSetResolvedTarget={(platform: 'Bluesky' | 'Threads', target: ReplyTargetInfo) =>
                dispatch({ type: 'SET_RESOLVED_REPLY_TARGET', payload: { platform, target } })
              }
              onClearTarget={(platform?: 'Bluesky' | 'Threads') =>
                dispatch({ type: 'CLEAR_REPLY_TARGET', payload: platform || 'all' })
              }
            />

            {/* OGPリンクプレビュー */}
            <OgpPreviewSection
              text={currentText}
              onReplaceUrl={handleReplaceUrl}
            />
          </div>
        )}

        {/* ==================== TAB 2: リアルタイムプレビュー ==================== */}
        {activeTab === 'preview' && (
          <div className="space-y-3 animate-in fade-in duration-150">
            {/* プレビューヘッダーサマリー */}
            <div className="bg-[#0E1320] border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-sm text-xs">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-sky-400" />
                <span className="font-bold text-slate-200">リアルタイム投稿プレビュー</span>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
                <span>エディタで編集</span>
              </button>
            </div>

            {/* プレビューカード表示 */}
            <div className="bg-[#0E1320] border border-slate-800 rounded-2xl p-3 shadow-md">
              <ThreadPreview
                blueskySplits={viewModel.blueskySplits}
                threadsSplits={viewModel.threadsSplits}
                images={viewModel.images}
                postToBluesky={viewModel.postToBluesky}
                postToThreads={viewModel.postToThreads}
                credentials={viewModel.credentials}
                threadsTopic={viewModel.threadsTopic}
                replySettings={viewModel.replySettings}
              />
            </div>
          </div>
        )}

        {/* ==================== TAB 3: 予約 & 履歴 ==================== */}
        {activeTab === 'schedule_history' && (
          <div className="space-y-3 animate-in fade-in duration-150">
            {/* サブタブ切替 */}
            <div className="bg-[#0E1320] border border-slate-800 rounded-xl p-1 flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setSubTabHistory('scheduled')}
                className={`flex-1 min-h-[38px] py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  subTabHistory === 'scheduled'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>予約投稿 ({viewModel.scheduledPosts.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setSubTabHistory('history')}
                className={`flex-1 min-h-[38px] py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  subTabHistory === 'history'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>投稿履歴 ({viewModel.history.length})</span>
              </button>
            </div>

            {/* 予約投稿一覧 */}
            {subTabHistory === 'scheduled' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">
                    ⏰ 登録中の予約投稿
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsScheduleSheetOpen(true)}
                    className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1"
                  >
                    <span>➕ 新規予約</span>
                  </button>
                </div>

                {viewModel.scheduledPosts.length === 0 ? (
                  <div className="bg-[#0E1320] border border-slate-800/80 rounded-2xl p-6 text-center text-slate-500 text-xs space-y-1">
                    <p className="text-sm font-medium text-slate-400">予約投稿はありません</p>
                    <p className="text-[11px]">エディタで文章を入力し、下部の時計アイコンから日時を指定して予約できます。</p>
                  </div>
                ) : (
                  viewModel.scheduledPosts.map((post) => (
                    <div
                      key={post.id}
                      className="bg-[#0E1320] border border-slate-800 rounded-xl p-3 space-y-2 shadow-xs"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-sky-300">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{formatToJstString(post.scheduledAt)}</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300">
                          {getRelativeTimeJst(post.scheduledAt).text}
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 line-clamp-2 bg-slate-950/70 p-2 rounded-lg border border-slate-800 font-sans">
                        {post.text}
                      </p>
                      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400 border-t border-slate-800/60">
                        <div className="flex items-center gap-2">
                          <span>{post.postToBluesky ? '🦋 Bluesky' : ''}</span>
                          <span>{post.postToThreads ? '🌀 Threads' : ''}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteScheduled(post.id)}
                          className="text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>キャンセル</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* 投稿履歴一覧 */}
            {subTabHistory === 'history' && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-300">
                    📜 送信完了・過去の投稿履歴
                  </span>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'OPEN_MODAL', payload: 'analytics' })}
                    className="text-sky-400 hover:underline text-xs flex items-center gap-1"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>分析</span>
                  </button>
                </div>

                {viewModel.history.length === 0 ? (
                  <div className="bg-[#0E1320] border border-slate-800/80 rounded-2xl p-6 text-center text-slate-500 text-xs space-y-1">
                    <p className="text-sm font-medium text-slate-400">投稿履歴はありません</p>
                    <p className="text-[11px]">投稿を実行するとここに履歴が蓄積されます。</p>
                  </div>
                ) : (
                  viewModel.history.slice(0, 15).map((item) => (
                    <div
                      key={item.id}
                      className="bg-[#0E1320] border border-slate-800 rounded-xl p-3 space-y-2 shadow-xs"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{new Date(item.timestamp).toLocaleString('ja-JP')}</span>
                        <div className="flex items-center gap-1.5">
                          {item.blueskySuccess !== undefined && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                              item.blueskySuccess ? 'bg-sky-500/20 text-sky-300' : 'bg-rose-500/20 text-rose-300'
                            }`}>
                              🦋 {item.blueskySuccess ? '成功' : '失敗'}
                            </span>
                          )}
                          {item.threadsSuccess !== undefined && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                              item.threadsSuccess ? 'bg-purple-500/20 text-purple-300' : 'bg-rose-500/20 text-rose-300'
                            }`}>
                              🌀 {item.threadsSuccess ? '成功' : '失敗'}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-200 line-clamp-3 bg-slate-950/70 p-2 rounded-lg border border-slate-800 font-sans">
                        {item.originalText}
                      </p>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            handleTextChange(item.originalText);
                            setActiveTab('editor');
                            dispatch({
                              type: 'NOTIFY',
                              payload: {
                                type: 'success',
                                title: '本文を復元',
                                message: '過去の投稿テキストをエディタにセットしました。',
                              },
                            });
                          }}
                          className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[11px] font-medium border border-slate-800 flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>再利用する</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB 4: 設定・ツール ==================== */}
        {activeTab === 'settings' && (
          <div className="space-y-3 animate-in fade-in duration-150">
            {/* アカウント連携状態カード */}
            <div className="bg-[#0E1320] border border-slate-800 rounded-2xl p-3.5 space-y-3 shadow-md">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-sky-400" />
                <span>アカウント認証・連携設定</span>
              </h3>

              <div className="space-y-2">
                {/* 🦋 Bluesky アカウント */}
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🦋</span>
                    <div>
                      <div className="text-xs font-bold text-slate-200">
                        {isBlueskyLoggedIn ? viewModel.credentials.blueskyHandle || 'Bluesky連携中' : 'Bluesky (未連携)'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {isBlueskyLoggedIn ? '投稿可能' : '設定モーダルから接続'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'OPEN_MODAL', payload: 'settings' })}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700"
                  >
                    設定
                  </button>
                </div>

                {/* 🌀 Threads アカウント */}
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🌀</span>
                    <div>
                      <div className="text-xs font-bold text-slate-200">
                        {isThreadsLoggedIn ? viewModel.credentials.threadsUsername || 'Threads連携中' : 'Threads (未連携)'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {isThreadsLoggedIn ? '投稿可能' : '設定モーダルから接続'}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => dispatch({ type: 'OPEN_MODAL', payload: 'settings' })}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700"
                  >
                    設定
                  </button>
                </div>
              </div>
            </div>

            {/* テーマ & クイックツールカード */}
            <div className="bg-[#0E1320] border border-slate-800 rounded-2xl p-3.5 space-y-3 shadow-md">
              <h3 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-purple-400" />
                <span>テーマカラー & ツール</span>
              </h3>

              <div>
                <span className="text-[11px] text-slate-400 block mb-1.5">アクセントテーマ選択:</span>
                <ThemeSelector
                  currentTheme={viewModel.theme}
                  onSelectTheme={(t) => dispatch({ type: 'SELECT_THEME', payload: t })}
                />
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'OPEN_MODAL', payload: 'userGuide' })}
                  className="w-full p-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 border border-slate-800 text-xs font-bold text-slate-300 flex items-center justify-center gap-2 text-center"
                >
                  <HelpCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>使い方ガイド</span>
                </button>
              </div>
            </div>

            {/* 端末情報 & 表示切替 */}
            <div className="bg-[#0E1320] border border-slate-800 rounded-2xl p-3.5 space-y-2.5 text-xs text-slate-400">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-sky-400" />
                  <span>端末・表示モード設定</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-950 border border-slate-800 font-mono text-slate-300">
                  {isMobileUserAgent ? 'スマホUA検出済' : 'デスクトップUA'}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed">
                接続元のユーザーエージェントに基づき、スマートフォンに最適化されたUIを表示しています。PC向けの大画面デュアルカラム表示に切り替えることも可能です。
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={onToggleViewMode}
                  className="w-full py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Monitor className="w-4 h-4 text-sky-400" />
                  <span>デスクトップ（PC版）表示に切り替える</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 5. モバイル固定ボトム投稿アクションバー */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0C101A]/95 backdrop-blur-md border-t border-slate-800/90 px-3 py-2.5 flex items-center justify-between gap-2.5 max-w-lg mx-auto shadow-2xl safe-area-bottom">
        {/* 左: 投稿先クイックバッジ */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => dispatch({ type: 'TOGGLE_POST_TO_BLUESKY', payload: !viewModel.postToBluesky })}
            className={`p-2 rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer ${
              viewModel.postToBluesky
                ? 'bg-[#0085ff] text-white shadow-xs'
                : 'bg-slate-900 text-slate-500 border border-slate-800'
            }`}
            title="Blueskyへの投稿を切り替え"
          >
            <span className="text-sm">🦋</span>
          </button>

          <button
            type="button"
            onClick={() => dispatch({ type: 'TOGGLE_POST_TO_THREADS', payload: !viewModel.postToThreads })}
            className={`p-2 rounded-lg text-xs font-bold transition flex items-center justify-center cursor-pointer ${
              viewModel.postToThreads
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-xs'
                : 'bg-slate-900 text-slate-500 border border-slate-800'
            }`}
            title="Threadsへの投稿を切り替え"
          >
            <span className="text-sm">🌀</span>
          </button>
        </div>

        {/* 中央: 予約投稿時計ボタン */}
        <button
          type="button"
          onClick={() => setIsScheduleSheetOpen(true)}
          className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-sky-400 border border-slate-800 text-xs font-bold flex items-center gap-1 shrink-0 transition cursor-pointer"
          title="予約投稿日時を設定"
        >
          <Clock className="w-4 h-4" />
          <span className="text-[11px] hidden xs:inline">予約</span>
        </button>

        {/* 右: メイン投稿ボタン */}
        <button
          type="button"
          onClick={() => dispatch({ type: 'SUBMIT_POST_REQUEST' })}
          disabled={isNeitherSelected || (!currentText.trim() && viewModel.images.length === 0)}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md ${
            isNeitherSelected || (!currentText.trim() && viewModel.images.length === 0)
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
              : 'bg-sky-600 hover:bg-sky-500 text-white shadow-sky-900/40 cursor-pointer active:scale-98'
          }`}
        >
          <Send className="w-4 h-4" />
          <span className="text-sm font-bold">
            {viewModel.postToBluesky && viewModel.postToThreads
              ? '今すぐ同時投稿'
              : viewModel.postToBluesky
              ? 'Blueskyに投稿'
              : viewModel.postToThreads
              ? 'Threadsに投稿'
              : '投稿先を選択'}
          </span>
        </button>
      </div>

      {/* 6. 予約投稿設定ボトムシート (Drawer) */}
      {isScheduleSheetOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-end sm:items-center justify-center animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsScheduleSheetOpen(false);
          }}
        >
          <div className="bg-[#0D121F] border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-2xl w-full max-w-md p-4 space-y-3 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-sky-400" />
                <h4 className="text-sm font-bold text-white">⏰ 予約投稿日時の設定</h4>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleSheetOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* クイックプリセット */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-300">クイック日時選択:</span>
              <div className="grid grid-cols-2 gap-2">
                {getJstQuickPresets().slice(0, 4).map((preset) => (
                  <button
                    key={preset.id || preset.label}
                    type="button"
                    onClick={() => handleExecuteSchedule(preset.timestamp)}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-sky-950/60 border border-slate-800 hover:border-sky-500/60 text-left transition cursor-pointer"
                  >
                    <div className="text-xs font-bold text-sky-300">{preset.label}</div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {preset.jstDisplay || preset.timeLabel}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* カスタム日時指定 */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800">
              <span className="text-[11px] font-bold text-slate-300">日時を直接指定:</span>
              <div className="flex items-center gap-2">
                <input
                  type="datetime-local"
                  value={scheduleDatetime || getJstDatetimeLocalValue(Date.now())}
                  onChange={(e) => setScheduleDatetime(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-hidden focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    const ts = parseJstDatetimeLocal(scheduleDatetime || getJstDatetimeLocalValue(Date.now()));
                    handleExecuteSchedule(ts);
                  }}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shrink-0 shadow-sm cursor-pointer"
                >
                  予約する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. モバイル ドロワーメニュー */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex justify-end animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsMobileMenuOpen(false);
          }}
        >
          <div className="bg-[#0D121F] border-l border-slate-800 w-4/5 max-w-xs h-full p-4 flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white">メニュー</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    dispatch({ type: 'OPEN_MODAL', payload: 'userGuide' });
                  }}
                  className="w-full p-2.5 rounded-xl hover:bg-slate-900 text-slate-200 text-xs font-medium flex items-center gap-2.5 transition cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4 text-amber-400" />
                  <span>使い方ガイド</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    dispatch({ type: 'OPEN_MODAL', payload: 'analytics' });
                  }}
                  className="w-full p-2.5 rounded-xl hover:bg-slate-900 text-slate-200 text-xs font-medium flex items-center gap-2.5 transition cursor-pointer"
                >
                  <BarChart3 className="w-4 h-4 text-sky-400" />
                  <span>アナリティクス分析</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    dispatch({ type: 'OPEN_MODAL', payload: 'serverVault' });
                  }}
                  className="w-full p-2.5 rounded-xl hover:bg-slate-900 text-slate-200 text-xs font-medium flex items-center gap-2.5 transition cursor-pointer"
                >
                  <FolderLock className="w-4 h-4 text-emerald-400" />
                  <span>サーバー登録情報</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    dispatch({ type: 'OPEN_MODAL', payload: 'aboutApp' });
                  }}
                  className="w-full p-2.5 rounded-xl hover:bg-slate-900 text-slate-200 text-xs font-medium flex items-center gap-2.5 transition cursor-pointer"
                >
                  <Info className="w-4 h-4 text-indigo-400" />
                  <span>アプリについて (About)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onToggleViewMode();
                  }}
                  className="w-full p-2.5 rounded-xl hover:bg-slate-900 text-slate-200 text-xs font-medium flex items-center gap-2.5 transition cursor-pointer"
                >
                  <Monitor className="w-4 h-4 text-purple-400" />
                  <span>デスクトップ(PC)版表示に切替</span>
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  dispatch({ type: 'OPEN_MODAL', payload: 'quitConfirm' });
                }}
                className="w-full p-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-950/70 border border-rose-900/60 text-rose-300 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <span>アプリを終了する</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. サブモーダル群 */}
      <AiAssistModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        initialTab={aiModalInitialTab}
        currentText={currentText}
        onApplySplitText={(formattedText) => handleTextChange(formattedText)}
        onApplyBlueskyText={(bsText) => dispatch({ type: 'UPDATE_BLUESKY_TEXT', payload: bsText })}
        onApplyThreadsText={(thText) => dispatch({ type: 'UPDATE_THREADS_TEXT', payload: thText })}
        onApplyBothCustomText={(bsText, thText) => {
          dispatch({ type: 'UPDATE_BLUESKY_TEXT', payload: bsText });
          dispatch({ type: 'UPDATE_THREADS_TEXT', payload: thText });
        }}
        onApplyCommonText={(cText) => dispatch({ type: 'UPDATE_TEXT', payload: cText })}
        onNotify={(toast) => dispatch({ type: 'NOTIFY', payload: toast })}
      />

      <SnippetModal
        isOpen={isSnippetModalOpen}
        onClose={() => setIsSnippetModalOpen(false)}
        currentText={currentText}
        onInsertSnippet={(content, mode) => {
          if (mode === 'replace') {
            handleTextChange(content);
          } else {
            handleInsertText('\n' + content);
          }
        }}
      />

      <SampleTextsModal
        isOpen={isSampleModalOpen}
        onClose={() => setIsSampleModalOpen(false)}
        onSelectSample={(sampleText) => handleTextChange(sampleText)}
        onNotify={(toast) => dispatch({ type: 'NOTIFY', payload: toast })}
      />

      <UnicodeDecoratorModal
        isOpen={isDecorModalOpen}
        onClose={() => setIsDecorModalOpen(false)}
        selectedText={currentText}
        onInsertText={(inserted) => handleInsertText(inserted)}
        onNotify={(toast) => dispatch({ type: 'NOTIFY', payload: toast })}
        hideMaintenance={true}
      />
    </div>
  );
};
