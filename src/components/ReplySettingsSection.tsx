import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  X,
  ExternalLink,
  UserCheck,
  UserX,
  Loader2,
  RefreshCw,
  ListPlus,
  HelpCircle,
  CornerDownRight,
  Info,
  Link as LinkIcon,
  Sparkles,
} from 'lucide-react';
import { ApiCredentials, ReplySettings, ReplyTargetInfo } from '../types';
import {
  resolveReplyTarget,
  fetchMyRecentThreadsPosts,
  detectReplyPlatform,
  RecentThreadsPostItem,
} from '../utils/postApi';

interface ReplySettingsSectionProps {
  replySettings: ReplySettings;
  postToBluesky: boolean;
  postToThreads: boolean;
  credentials: ApiCredentials;
  isDemoMode: boolean;
  onUpdateSettings: (settings: Partial<ReplySettings>) => void;
  onSetResolvedTarget: (platform: 'Bluesky' | 'Threads', target: ReplyTargetInfo) => void;
  onClearTarget: (platform?: 'Bluesky' | 'Threads') => void;
}

export const ReplySettingsSection: React.FC<ReplySettingsSectionProps> = ({
  replySettings,
  postToBluesky,
  postToThreads,
  credentials,
  isDemoMode,
  onUpdateSettings,
  onSetResolvedTarget,
  onClearTarget,
}) => {
  // 統合URL入力フィールドの状態
  const initialUrl = replySettings.blueskyTargetUrl || replySettings.threadsTargetUrl || '';
  const [inputUrl, setInputUrl] = useState<string>(initialUrl);

  // 外部からの更新（クリアなど）を反映
  useEffect(() => {
    if (!replySettings.blueskyTargetUrl && !replySettings.threadsTargetUrl) {
      setInputUrl('');
    } else if (replySettings.blueskyTargetUrl && !inputUrl) {
      setInputUrl(replySettings.blueskyTargetUrl);
    } else if (replySettings.threadsTargetUrl && !inputUrl) {
      setInputUrl(replySettings.threadsTargetUrl);
    }
  }, [replySettings.blueskyTargetUrl, replySettings.threadsTargetUrl]);

  const [isLoading, setIsLoading] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Threads「自分の投稿から選択」モーダル用
  const [showRecentThreadsPicker, setShowRecentThreadsPicker] = useState(false);
  const [recentThreadsLoading, setRecentThreadsLoading] = useState(false);
  const [recentThreadsPosts, setRecentThreadsPosts] = useState<RecentThreadsPostItem[]>([]);
  const [recentThreadsError, setRecentThreadsError] = useState<string | null>(null);

  // 入力されたURLのリアルタイム判定
  const detectedPlatform = detectReplyPlatform(inputUrl);

  // Bluesky 解決ハンドラ
  const handleResolveBluesky = useCallback(
    async (urlOrId: string) => {
      const trimmed = urlOrId.trim();
      if (!trimmed) {
        onClearTarget();
        setResolveError(null);
        return;
      }

      setIsLoading(true);
      setResolveError(null);

      try {
        const result = await resolveReplyTarget('Bluesky', trimmed, credentials);
        if (result.success && result.target) {
          onUpdateSettings({
            enabled: true,
            blueskyTargetUrl: trimmed,
            threadsTargetUrl: '',
            threadsResolved: null,
          });
          onSetResolvedTarget('Bluesky', result.target);
          setResolveError(null);
        } else {
          setResolveError(result.error || 'Bluesky投稿の取得に失敗しました');
          if (result.target) {
            onSetResolvedTarget('Bluesky', result.target);
          }
        }
      } catch (err: any) {
        setResolveError(err.message || '通信エラーが発生しました');
      } finally {
        setIsLoading(false);
      }
    },
    [credentials, onClearTarget, onSetResolvedTarget, onUpdateSettings]
  );

  // Threads 解決ハンドラ
  const handleResolveThreads = useCallback(
    async (urlOrId: string) => {
      const trimmed = urlOrId.trim();
      if (!trimmed) {
        onClearTarget();
        setResolveError(null);
        return;
      }

      setIsLoading(true);
      setResolveError(null);

      try {
        const result = await resolveReplyTarget('Threads', trimmed, credentials);
        if (result.success && result.target) {
          onUpdateSettings({
            enabled: true,
            threadsTargetUrl: trimmed,
            blueskyTargetUrl: '',
            blueskyResolved: null,
          });
          onSetResolvedTarget('Threads', result.target);
          setResolveError(null);
        } else {
          const errMsg = result.error || 'Threads投稿の確認に失敗しました';
          setResolveError(errMsg);
          if (result.target) {
            onSetResolvedTarget('Threads', result.target);
          }
        }
      } catch (err: any) {
        setResolveError(err.message || '通信エラーが発生しました');
      } finally {
        setIsLoading(false);
      }
    },
    [credentials, onClearTarget, onSetResolvedTarget, onUpdateSettings]
  );

  // 統合解決ハンドラ（URLから自動判定して実行）
  const handleUnifiedResolve = useCallback(
    async (targetUrl?: string, forcePlatform?: 'Bluesky' | 'Threads') => {
      const val = (targetUrl !== undefined ? targetUrl : inputUrl).trim();
      if (!val) {
        setResolveError('返信先の投稿URLを入力してください。');
        return;
      }

      const platform = forcePlatform || detectReplyPlatform(val);

      if (platform === 'Bluesky') {
        await handleResolveBluesky(val);
      } else if (platform === 'Threads') {
        await handleResolveThreads(val);
      } else {
        // 自動判定できなかった場合、サーバーの auto 判定に問い合わせ
        setIsLoading(true);
        setResolveError(null);
        try {
          const result = await resolveReplyTarget('auto', val, credentials);
          if (result.success && result.target) {
            if (result.target.platform === 'Bluesky') {
              onUpdateSettings({
                enabled: true,
                blueskyTargetUrl: val,
                threadsTargetUrl: '',
                threadsResolved: null,
              });
              onSetResolvedTarget('Bluesky', result.target);
            } else if (result.target.platform === 'Threads') {
              onUpdateSettings({
                enabled: true,
                threadsTargetUrl: val,
                blueskyTargetUrl: '',
                blueskyResolved: null,
              });
              onSetResolvedTarget('Threads', result.target);
            }
          } else {
            setResolveError(
              result.error ||
                'URLからBlueskyまたはThreadsの投稿を自動判定できませんでした。https://bsky.app/... または https://www.threads.com/... の形式で入力してください。'
            );
          }
        } catch (err: any) {
          setResolveError(err.message || '通信エラーが発生しました');
        } finally {
          setIsLoading(false);
        }
      }
    },
    [inputUrl, handleResolveBluesky, handleResolveThreads, credentials, onUpdateSettings, onSetResolvedTarget]
  );

  // Threads 自分の最近の投稿一覧を取得
  const handleLoadRecentThreads = useCallback(async () => {
    setRecentThreadsLoading(true);
    setRecentThreadsError(null);
    try {
      const result = await fetchMyRecentThreadsPosts(credentials);
      if (result.success && result.posts) {
        setRecentThreadsPosts(result.posts);
      } else {
        setRecentThreadsError(result.error || '最近の投稿一覧を取得できませんでした');
      }
    } catch (err: any) {
      setRecentThreadsError(err.message || '通信エラーが発生しました');
    } finally {
      setRecentThreadsLoading(false);
    }
  }, [credentials]);

  const handleSelectRecentThreadsPost = (post: RecentThreadsPostItem) => {
    const permalink = post.permalink || `https://www.threads.net/post/${post.id}`;
    setInputUrl(permalink);
    setShowRecentThreadsPicker(false);
    handleResolveThreads(permalink);
  };

  const handleCancelAllReplies = () => {
    setInputUrl('');
    onClearTarget();
    onUpdateSettings({
      enabled: false,
      blueskyTargetUrl: '',
      threadsTargetUrl: '',
      blueskyResolved: null,
      threadsResolved: null,
    });
    setResolveError(null);
  };

  const bskyTarget = replySettings.blueskyResolved;
  const thTarget = replySettings.threadsResolved;
  const hasAnyTarget = Boolean(bskyTarget || thTarget);

  return (
    <div className="bg-[#121826]/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm transition-all duration-200">
      {/* ヘッダーバー（トリガースイッチなし） */}
      <div className="p-3 sm:p-3.5 flex items-center justify-between gap-3 bg-[#151c2e]/50 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`p-1.5 rounded-lg transition-colors ${
              hasAnyTarget ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-400'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-200">リプライ（返信）投稿</span>
              {hasAnyTarget ? (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 animate-in fade-in flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
                  {thTarget ? 'Threads返信先設定中' : 'Bluesky返信先設定中'}
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-800 text-slate-400 border border-slate-700/60">
                  通常投稿（リプライ未設定）
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              返信先の投稿URLを入力すると、該当SNSへの返信ツリーとして投稿されます
            </p>
          </div>
        </div>

        {hasAnyTarget && (
          <button
            type="button"
            onClick={handleCancelAllReplies}
            className="px-2.5 py-1 text-xs font-medium text-rose-300 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 rounded-lg transition shrink-0 flex items-center gap-1 cursor-pointer"
            title="リプライ設定を解除して通常投稿に戻す"
          >
            <X className="w-3.5 h-3.5" />
            <span>リプライ解除</span>
          </button>
        )}
      </div>

      {/* メインパネル */}
      <div className="p-3.5 sm:p-4 space-y-4">
        {/* Threads API制限のガイダンス */}
        <div className="p-2.5 rounded-lg bg-sky-950/30 border border-sky-800/40 text-sky-200/90 text-[11px] leading-relaxed flex items-start gap-2">
          <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-sky-300">リプライ投稿のURL仕様について:</span> Metaの公式制限により、Threads本番投稿では<span className="text-amber-300 font-semibold underline underline-offset-2">ご自身のアカウントで投稿した元ポストにのみ</span>リプライ可能です。本番環境では照合時にThreads公式APIで<span className="text-emerald-300 font-semibold">実際にリプライできるか</span>を実検証します。<span className="text-sky-200 font-medium">※デモ版では「https://bsky.app/...」または「https://www.threads.com/...」のURL形式であれば投稿シミュレートが可能です。</span>
          </div>
        </div>

        {/* 統合された投稿URL入力セクション */}
        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200">返信先投稿URL</span>
              {/* リアルタイム判定バッジ */}
              {detectedPlatform === 'Bluesky' ? (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1 animate-in fade-in">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                  Bluesky 投稿を検出
                </span>
              ) : detectedPlatform === 'Threads' ? (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-1 animate-in fade-in">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
                  Threads 投稿を検出
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700/60 flex items-center gap-1">
                  <LinkIcon className="w-3 h-3" />
                  URLから自動判定
                </span>
              )}
            </div>

            {/* Threadsの投稿から選ぶボタン */}
            {postToThreads && (
              <button
                type="button"
                onClick={() => {
                  setShowRecentThreadsPicker(true);
                  if (recentThreadsPosts.length === 0) {
                    handleLoadRecentThreads();
                  }
                }}
                className="text-[11px] font-medium text-violet-400 hover:text-violet-300 flex items-center gap-1 transition px-2 py-1 rounded bg-violet-950/40 hover:bg-violet-900/50 border border-violet-800/40"
              >
                <ListPlus className="w-3.5 h-3.5" />
                自分のThreads投稿から選択
              </button>
            )}
          </div>

          {/* 統合入力バー */}
          <div className="relative">
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => {
                const val = e.target.value;
                setInputUrl(val);
                setResolveError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleUnifiedResolve();
                }
              }}
              placeholder="https://bsky.app/... または https://www.threads.com/... を入力"
              className="w-full bg-[#0a0f1d] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 pr-24 shadow-inner"
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {inputUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setInputUrl('');
                    onClearTarget();
                    setResolveError(null);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-200 rounded transition cursor-pointer"
                  title="クリア"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => handleUnifiedResolve()}
                disabled={isLoading || !inputUrl.trim()}
                className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg transition flex items-center gap-1 shadow shrink-0 cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : detectedPlatform === 'Threads' ? (
                  '照合・事前チェック'
                ) : (
                  '照合'
                )}
              </button>
            </div>
          </div>

          {/* エラー表示と手動選択フォールバック */}
          {resolveError && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <div className="min-w-0 leading-relaxed">{resolveError}</div>
              </div>
              {/* 判定不能時の手動選択ボタン */}
              {inputUrl.trim() && !detectedPlatform && (
                <div className="flex items-center gap-2 pt-1 border-t border-rose-900/40">
                  <span className="text-[11px] text-rose-200 font-medium">手動で選択して照合:</span>
                  <button
                    type="button"
                    onClick={() => handleUnifiedResolve(inputUrl, 'Bluesky')}
                    className="px-2 py-1 bg-sky-900/60 hover:bg-sky-800 text-sky-200 rounded text-[11px] font-medium transition cursor-pointer"
                  >
                    Blueskyとして照合
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUnifiedResolve(inputUrl, 'Threads')}
                    className="px-2 py-1 bg-violet-900/60 hover:bg-violet-800 text-violet-200 rounded text-[11px] font-medium transition cursor-pointer"
                  >
                    Threadsとして照合
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 解決済みの返信先情報カード */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">設定された返信先</span>
            {hasAnyTarget && (
              <button
                type="button"
                onClick={handleCancelAllReplies}
                className="text-[11px] text-slate-400 hover:text-rose-400 transition cursor-pointer"
              >
                すべて解除
              </button>
            )}
          </div>

          {!hasAnyTarget ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-800 text-center text-slate-400 text-xs">
              <p className="font-medium text-slate-300">返信先が設定されていません</p>
              <p className="text-[11px] text-slate-500 mt-1">
                上の入力欄にBlueskyまたはThreadsの投稿URLを貼り付けて「照合」を押してください
              </p>
            </div>
          ) : (
            <div className="w-full flex flex-col gap-3">
              {/* 1. Bluesky返信先カード */}
              {bskyTarget && (
                <div className="p-3.5 sm:p-4 rounded-xl bg-sky-950/20 border border-sky-800/40 text-xs space-y-2.5 relative w-full">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
                      <span className="font-bold text-sky-300 text-sm">Bluesky 返信先</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {bskyTarget.permalink && (
                        <a
                          href={bskyTarget.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 bg-sky-950/60 hover:bg-sky-900/60 px-2 py-0.5 rounded border border-sky-800/50 transition"
                        >
                          開く <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={handleCancelAllReplies}
                        className="text-slate-400 hover:text-rose-300 p-1 rounded hover:bg-slate-800 transition cursor-pointer"
                        title="Bluesky返信先を解除"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <span className="text-slate-400">投稿者:</span>
                    <span className="font-semibold text-slate-200">
                      {bskyTarget.authorHandle ? `@${bskyTarget.authorHandle}` : bskyTarget.authorName || '不明'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ml-auto ${
                        isDemoMode
                          ? 'bg-amber-900/60 text-amber-300 border border-amber-700/50'
                          : 'bg-sky-900/60 text-sky-300 border border-sky-700/50'
                      }`}
                    >
                      {isDemoMode ? 'デモシミュレートOK' : '確認済'}
                    </span>
                  </div>

                  {bskyTarget.textSnippet && (
                    <div className="bg-black/40 p-3 rounded-lg border border-slate-800/90 shadow-inner">
                      <p className="text-xs text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                        {bskyTarget.textSnippet}
                      </p>
                    </div>
                  )}

                  {isDemoMode && (
                    <div className="text-xs text-amber-300/95 font-medium bg-amber-950/50 p-2.5 rounded-lg border border-amber-800/50">
                      <span>※デモ版：URL形式（https://bsky.app/...）を確認しました。シミュレート投稿が可能です。</span>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Threads返信先カード */}
              {thTarget && (
                <div
                  className={`p-3.5 sm:p-4 rounded-xl border text-xs space-y-2.5 relative w-full ${
                    isDemoMode || thTarget.isDemoSkipped
                      ? 'bg-amber-950/20 border-amber-800/40 text-amber-200'
                      : thTarget.verifiedCanReply || thTarget.isOwnerMatch
                      ? 'bg-purple-950/20 border-purple-800/40 text-purple-200'
                      : 'bg-rose-950/20 border-rose-800/40 text-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-violet-400"></span>
                      <span className="font-bold text-violet-300 text-sm">Threads 返信先</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {thTarget.permalink && (
                        <a
                          href={thTarget.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 bg-violet-950/60 hover:bg-violet-900/60 px-2 py-0.5 rounded border border-violet-800/50 transition"
                        >
                          開く <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={handleCancelAllReplies}
                        className="text-slate-400 hover:text-rose-300 p-1 rounded hover:bg-slate-800 transition cursor-pointer"
                        title="Threads返信先を解除"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-slate-400 shrink-0">投稿者:</span>
                      <span className="font-semibold text-slate-200 truncate">
                        {thTarget.authorName ? `@${thTarget.authorName}` : 'あなたのアカウント'}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        isDemoMode || thTarget.isDemoSkipped
                          ? 'bg-amber-900/60 text-amber-300 border border-amber-700/50'
                          : thTarget.verifiedCanReply
                          ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50'
                          : thTarget.isOwnerMatch
                          ? 'bg-violet-900/60 text-violet-300 border border-violet-700/50'
                          : 'bg-rose-900/60 text-rose-300 border border-rose-700/50'
                      }`}
                    >
                      {isDemoMode || thTarget.isDemoSkipped
                        ? 'デモシミュレートOK'
                        : thTarget.verifiedCanReply
                        ? '✅ API事前検証済'
                        : thTarget.isOwnerMatch
                        ? '本人確認済'
                        : '他者投稿（返信不可）'}
                    </span>
                  </div>

                  {thTarget.textSnippet && (
                    <div className="bg-black/40 p-3 rounded-lg border border-slate-800/90 shadow-inner">
                      <p className="text-xs text-slate-200 whitespace-pre-wrap break-words leading-relaxed">
                        {thTarget.textSnippet}
                      </p>
                    </div>
                  )}

                  {/* ステータス注記 */}
                  {isDemoMode || thTarget.isDemoSkipped ? (
                    <div className="text-xs text-amber-300/95 font-medium bg-amber-950/50 p-2.5 rounded-lg border border-amber-800/50 flex items-center justify-between">
                      <span>※デモ版：URL形式（https://www.threads.com/...）を確認しました。シミュレート投稿が可能です。</span>
                    </div>
                  ) : thTarget.verifiedCanReply ? (
                    <div className="text-xs text-emerald-300/95 font-medium bg-emerald-950/50 p-2.5 rounded-lg border border-emerald-800/50 flex items-center justify-between">
                      <span>Threads公式APIで実際にリプライ可能であることを事前確認済みです。</span>
                    </div>
                  ) : !thTarget.isOwnerMatch || thTarget.canReply === false ? (
                    <div className="text-xs text-rose-300 font-medium bg-rose-900/40 p-2.5 rounded-lg border border-rose-800/50 space-y-1">
                      <div>※Threads APIの制限により他者の投稿には返信できません。ご自身の投稿を選択してください。</div>
                      {thTarget.error && (
                        <div className="text-[11px] text-rose-400">{thTarget.error}</div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Threads 自分の投稿から選択 モーダル */}
      {showRecentThreadsPicker && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-[#0f1422] border border-slate-800 rounded-2xl max-w-lg w-full max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-violet-500/20 text-violet-400">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">あなたの最近のThreads投稿</h3>
                  <p className="text-[11px] text-slate-400">返信先にする投稿を1つ選択してください</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRecentThreadsPicker(false)}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-2.5">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs text-slate-400">
                  {recentThreadsPosts.length > 0 ? `${recentThreadsPosts.length}件の投稿` : ''}
                </span>
                <button
                  type="button"
                  onClick={handleLoadRecentThreads}
                  disabled={recentThreadsLoading}
                  className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 font-medium transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${recentThreadsLoading ? 'animate-spin' : ''}`} />
                  再読み込み
                </button>
              </div>

              {recentThreadsLoading && recentThreadsPosts.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-violet-400" />
                  <p className="text-xs">Threadsの投稿一覧を取得中...</p>
                </div>
              ) : recentThreadsError ? (
                <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs text-center space-y-2">
                  <AlertTriangle className="w-6 h-6 mx-auto text-rose-400" />
                  <p>{recentThreadsError}</p>
                  <button
                    type="button"
                    onClick={handleLoadRecentThreads}
                    className="px-3 py-1 bg-rose-800/50 hover:bg-rose-800 text-rose-100 rounded-md text-[11px] transition"
                  >
                    リトライ
                  </button>
                </div>
              ) : recentThreadsPosts.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs space-y-1">
                  <p>投稿が見つかりませんでした。</p>
                  <p className="text-[11px] text-slate-500">Threadsでまだ投稿していないか、アカウント連携を確認してください。</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentThreadsPosts.map((post) => (
                    <div
                      key={post.id}
                      onClick={() => handleSelectRecentThreadsPost(post)}
                      className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-violet-500/50 cursor-pointer transition text-left group"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                        <span>{new Date(post.timestamp).toLocaleString('ja-JP')}</span>
                        <span className="text-violet-400 group-hover:underline flex items-center gap-0.5 text-[10px]">
                          選択して返信 <CornerDownRight className="w-3 h-3" />
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 line-clamp-3 leading-relaxed">
                        {post.text || '（メディア投稿）'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 border-t border-slate-800 bg-slate-900/30 text-right">
              <button
                type="button"
                onClick={() => setShowRecentThreadsPicker(false)}
                className="px-4 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
