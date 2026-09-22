import React, { useState } from 'react';
import { RootViewModel } from '../core/types';
import { useEventDispatch } from '../core/EventChainContext';
import { Header } from './Header';
import { EditorSection } from './EditorSection';
import { HistoryModal } from './HistoryModal';
import { AnalyticsModal } from './AnalyticsModal';
import { PostingProgressModal } from './PostingProgressModal';
import { UserGuideModal } from './UserGuideModal';
import { ScheduledPostsModal } from './ScheduledPostsModal';
import { QuitConfirmModal } from './QuitConfirmModal';
import { ModeSwitchPasswordModal } from './ModeSwitchPasswordModal';
import { CommErrorModal } from './CommErrorModal';
import { ToastContainer } from './ToastContainer';
import { DEMO_CREDENTIALS } from '../utils/postApi';

export interface RootProps {
  viewModel: RootViewModel;
}

/**
 * Root コンポーネント (MVP パターンにおける Passive View)
 *
 * 【アーキテクチャ特性】
 * 1. すべてのコンポーネント（ヘッダー、エディタ、モーダル群、トースト）をこの Root の配下に集約・配置。
 * 2. 自身および配下のコンポーネントは Passive View として、上位（Mediator）から受け取った
 *    描画に関わるパラメータ（RootViewModel）のみを参照してレンダリングを実行。
 * 3. ユーザー操作などのすべての動作は、直接状態を変更せず Chain of Responsibility
 *    （useEventDispatch / dispatch）を通じてイベントとしてバブリングさせ、
 *    ステートマシンとして振る舞う Mediator に裁定させる。
 */
export const Root: React.FC<RootProps> = ({ viewModel }) => {
  const dispatch = useEventDispatch();
  const [isCommErrorModalOpen, setIsCommErrorModalOpen] = useState(false);

  // アプリケーション終了状態（TERMINATED ステート）の描画
  if (viewModel.isAppTerminated) {
    return (
      <div
        id="app-root-terminated"
        className="min-h-screen bg-[#07090E] text-slate-300 flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-200"
      >
        <div className="max-w-md w-full bg-[#0D121F] border border-slate-800/90 rounded-2xl p-8 text-center shadow-2xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
            <span className="text-2xl">⏻</span>
          </div>
          <h1 className="text-xl font-bold text-slate-100">アプリケーションを終了しました</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            下書きおよび設定情報は安全に保存されています。<br />
            このウィンドウまたはブラウザタブを閉じてください。
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => dispatch({ type: 'RESTART_APP' })}
              className="text-[11px] text-sky-400 hover:text-sky-300 hover:underline transition cursor-pointer"
            >
              アプリを再開する
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id="app-root"
      className="min-h-screen bg-[#0A0A0B] text-slate-200 flex flex-col font-sans selection:bg-sky-500 selection:text-white"
    >
      {/* 1. ヘッダー (Passive View: 描画パラメータを注入しイベントをバブリング) */}
      <Header
        credentials={viewModel.credentials}
        isDemoMode={viewModel.isDemoMode}
        onToggleDemoMode={() => dispatch({ type: 'TOGGLE_DEMO_MODE' })}
        onOpenModePasswordModal={() => dispatch({ type: 'OPEN_MODAL', payload: 'modePassword' })}
        isSettingsOpen={viewModel.modals.settings}
        onToggleSettings={() => dispatch({ type: 'TOGGLE_MODAL', payload: 'settings' })}
        onOpenSettings={() => {
          dispatch({ type: 'OPEN_MODAL', payload: 'settings' });
          document.getElementById('realtime-preview-area')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }}
        onOpenHistory={() => dispatch({ type: 'OPEN_MODAL', payload: 'history' })}
        historyCount={viewModel.history.length}
        onOpenAnalytics={() => dispatch({ type: 'OPEN_MODAL', payload: 'analytics' })}
        onOpenScheduledPosts={() => dispatch({ type: 'OPEN_MODAL', payload: 'scheduled' })}
        scheduledPostsCount={viewModel.scheduledPosts.filter((p) => p.status === 'pending').length}
        onOpenUserGuide={() => dispatch({ type: 'OPEN_MODAL', payload: 'userGuide' })}
        onOpenQuitConfirm={() => dispatch({ type: 'OPEN_MODAL', payload: 'quitConfirm' })}
        currentTheme={viewModel.theme}
        onSelectTheme={(theme) => dispatch({ type: 'SELECT_THEME', payload: theme })}
        onLogout={(platform) => dispatch({ type: 'LOGOUT', payload: platform })}
        onRestoreSavedAccount={() => dispatch({ type: 'RESTORE_SAVED_ACCOUNT' })}
      />

      {/* 2. メインコンテンツ領域 (Passive View: EditorSection) */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto px-3 sm:px-5 lg:px-6 py-3 sm:py-4">
        <EditorSection
          text={viewModel.text}
          onChangeText={(val) => dispatch({ type: 'UPDATE_TEXT', payload: val })}
          blueskyText={viewModel.blueskyText}
          onChangeBlueskyText={(val) => dispatch({ type: 'UPDATE_BLUESKY_TEXT', payload: val })}
          threadsText={viewModel.threadsText}
          onChangeThreadsText={(val) => dispatch({ type: 'UPDATE_THREADS_TEXT', payload: val })}
          customPlatformText={viewModel.customPlatformText}
          onToggleCustomPlatformText={(val) => dispatch({ type: 'TOGGLE_CUSTOM_PLATFORM_TEXT', payload: val })}
          images={viewModel.images}
          onAddImages={(imgs) => dispatch({ type: 'ADD_IMAGES', payload: imgs })}
          onReorderImages={(newImages) => dispatch({ type: 'SET_IMAGES', payload: newImages })}
          onRemoveImage={(id) => dispatch({ type: 'REMOVE_IMAGE', payload: id })}
          onClearImages={() => dispatch({ type: 'CLEAR_IMAGES' })}
          onUpdateImageAlt={(id, alt) => dispatch({ type: 'UPDATE_IMAGE_ALT', payload: { id, alt } })}
          postToBluesky={viewModel.postToBluesky}
          onTogglePostToBluesky={(val) => dispatch({ type: 'TOGGLE_POST_TO_BLUESKY', payload: val })}
          postToThreads={viewModel.postToThreads}
          onTogglePostToThreads={(val) => dispatch({ type: 'TOGGLE_POST_TO_THREADS', payload: val })}
          replyTarget={viewModel.replyTarget}
          onSetReplyTarget={(target) => dispatch({ type: 'SET_REPLY_TARGET', payload: target })}
          threadsTopic={viewModel.threadsTopic}
          onChangeThreadsTopic={(val) => dispatch({ type: 'UPDATE_THREADS_TOPIC', payload: val })}
          autoSplit={viewModel.autoSplit}
          onToggleAutoSplit={(val) => dispatch({ type: 'TOGGLE_AUTO_SPLIT', payload: val })}
          includeNumbering={viewModel.includeNumbering}
          onToggleIncludeNumbering={(val) => dispatch({ type: 'TOGGLE_INCLUDE_NUMBERING', payload: val })}
          blueskySplits={viewModel.blueskySplits}
          threadsSplits={viewModel.threadsSplits}
          credentials={viewModel.credentials}
          isDemoMode={viewModel.isDemoMode}
          onSubmitPost={() => dispatch({ type: 'SUBMIT_POST_REQUEST' })}
          onSchedulePost={(scheduledAt) =>
            dispatch({ type: 'SCHEDULE_POST_REQUEST', payload: { scheduledAt } })
          }
          onOpenScheduledPosts={() => dispatch({ type: 'OPEN_MODAL', payload: 'scheduled' })}
          scheduledPostsCount={viewModel.scheduledPosts.filter((p) => p.status === 'pending').length}
          onOpenSettings={() => {
            dispatch({ type: 'OPEN_MODAL', payload: 'settings' });
            document.getElementById('realtime-preview-area')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }}
          isSettingsOpen={viewModel.modals.settings}
          onToggleSettings={() => dispatch({ type: 'TOGGLE_MODAL', payload: 'settings' })}
          onCloseSettings={() => dispatch({ type: 'CLOSE_MODAL', payload: 'settings' })}
          onSaveCredentials={(creds) => dispatch({ type: 'SAVE_CREDENTIALS', payload: creds })}
          currentTheme={viewModel.theme}
          onSelectTheme={(theme) => dispatch({ type: 'SELECT_THEME', payload: theme })}
          onLogout={(platform) => dispatch({ type: 'LOGOUT', payload: platform })}
          onDeleteSavedAccount={(platform) => dispatch({ type: 'DELETE_SAVED_ACCOUNT', payload: platform })}
          onOpenUserGuide={() => dispatch({ type: 'OPEN_MODAL', payload: 'userGuide' })}
          onOpenCommErrors={() => setIsCommErrorModalOpen(true)}
          onNotify={(toast) => dispatch({ type: 'NOTIFY', payload: toast })}
          lastSavedAt={viewModel.lastSavedAt}
          draftStatus={viewModel.draftStatus}
          draftError={viewModel.draftError}
          onClearDraft={() => dispatch({ type: 'CLEAR_DRAFT' })}
        />
      </main>

      {/* 3. フッター */}
      <footer className="border-t border-slate-800/60 bg-[#0F0F11]/40 py-2.5 px-4 sm:px-6 text-center text-xs text-slate-500 max-w-7xl w-full mx-auto flex items-center justify-center shrink-0">
        <p>CrossPost Web Studio • Bluesky & Threads Multi-Platform Publisher</p>
      </footer>

      {/* 4. モーダル群 (Root配下のPassive View) */}
      <QuitConfirmModal
        isOpen={viewModel.modals.quitConfirm}
        onClose={() => dispatch({ type: 'CLOSE_MODAL', payload: 'quitConfirm' })}
        onConfirmQuit={() => dispatch({ type: 'CONFIRM_QUIT' })}
        appName="CrossPost Web / Desktop Studio"
      />

      <UserGuideModal
        isOpen={viewModel.modals.userGuide}
        onClose={() => dispatch({ type: 'CLOSE_MODAL', payload: 'userGuide' })}
        onOpenSettings={() => {
          dispatch({ type: 'OPEN_MODAL', payload: 'settings' });
          document.getElementById('realtime-preview-area')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }}
      />

      <ScheduledPostsModal
        isOpen={viewModel.modals.scheduled}
        onClose={() => dispatch({ type: 'CLOSE_MODAL', payload: 'scheduled' })}
        scheduledPosts={viewModel.scheduledPosts}
        onRefreshScheduledPosts={() => dispatch({ type: 'REFRESH_SCHEDULED_POSTS' })}
        credentials={viewModel.credentials}
        isDemoMode={viewModel.isDemoMode}
        onLoadIntoEditor={(item) => dispatch({ type: 'LOAD_SCHEDULED_INTO_EDITOR', payload: item })}
        onNotify={(toast) => dispatch({ type: 'NOTIFY', payload: toast })}
      />

      <HistoryModal
        isOpen={viewModel.modals.history}
        onClose={() => dispatch({ type: 'CLOSE_MODAL', payload: 'history' })}
        history={viewModel.history}
        onClearHistory={() => dispatch({ type: 'CLEAR_HISTORY' })}
        onDeleteItem={(id) => dispatch({ type: 'DELETE_HISTORY_ITEM', payload: id })}
        onReuseText={(reusedText) => dispatch({ type: 'REUSE_TEXT', payload: reusedText })}
        onOpenAnalytics={() => dispatch({ type: 'OPEN_MODAL', payload: 'analytics' })}
        onOpenCommErrors={() => setIsCommErrorModalOpen(true)}
        onRetryPost={(item, targetPlatform) =>
          dispatch({ type: 'RETRY_HISTORY_POST', payload: { item, targetPlatform } })
        }
      />

      <CommErrorModal
        isOpen={isCommErrorModalOpen}
        onClose={() => setIsCommErrorModalOpen(false)}
        history={viewModel.history}
      />

      <AnalyticsModal
        isOpen={viewModel.modals.analytics}
        onClose={() => dispatch({ type: 'CLOSE_MODAL', payload: 'analytics' })}
        history={viewModel.history}
        scheduledPosts={viewModel.scheduledPosts}
        credentials={viewModel.credentials}
        onUpdateHistory={(updated) => dispatch({ type: 'UPDATE_HISTORY', payload: updated })}
        onImportBackup={(history, scheduled, snippets) =>
          dispatch({ type: 'IMPORT_BACKUP', payload: { history, scheduled, snippets } })
        }
        onClearHistory={() => dispatch({ type: 'CLEAR_HISTORY' })}
        onReuseText={(reusedText) => dispatch({ type: 'REUSE_TEXT', payload: reusedText })}
        onNotify={(toast) => dispatch({ type: 'NOTIFY', payload: toast })}
      />

      <PostingProgressModal
        isOpen={viewModel.modals.posting}
        onClose={() => dispatch({ type: 'CLOSE_MODAL', payload: 'posting' })}
        credentials={viewModel.credentials}
        postToBluesky={viewModel.postToBluesky}
        postToThreads={viewModel.postToThreads}
        replyTarget={viewModel.replyTarget}
        blueskyPosts={viewModel.blueskySplits.map((s) => s.text)}
        threadsPosts={viewModel.threadsSplits.map((s) => s.text)}
        threadsTopic={viewModel.threadsTopic}
        images={viewModel.images}
        onComplete={(item) => dispatch({ type: 'POSTING_COMPLETE', payload: item })}
        onApiError={(err) => dispatch({ type: 'API_ERROR', payload: err })}
        onOpenSettings={() => {
          dispatch({ type: 'CLOSE_MODAL', payload: 'posting' });
          dispatch({ type: 'OPEN_MODAL', payload: 'settings' });
        }}
        onUseDemoCredentials={() => {
          dispatch({
            type: 'SAVE_CREDENTIALS',
            payload: {
              ...DEMO_CREDENTIALS,
              isDemoMode: true,
            },
          });
        }}
      />

      <ModeSwitchPasswordModal
        isOpen={Boolean(viewModel.modals.modePassword)}
        onClose={() => dispatch({ type: 'CLOSE_MODAL', payload: 'modePassword' })}
        onConfirmSwitch={() => dispatch({ type: 'TOGGLE_DEMO_MODE' })}
        targetModeIsLive={viewModel.isDemoMode}
      />

      {/* 5. グローバルトースト通知コンテナ */}
      <ToastContainer
        toasts={viewModel.toasts}
        onDismiss={(id) => dispatch({ type: 'DISMISS_TOAST', payload: id })}
        onOpenSettings={() => dispatch({ type: 'OPEN_MODAL', payload: 'settings' })}
      />
    </div>
  );
};
