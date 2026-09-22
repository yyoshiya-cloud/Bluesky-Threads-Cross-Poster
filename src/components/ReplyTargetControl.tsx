import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  ExternalLink,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  CornerDownRight,
  Link2,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { ReplyTarget, ApiCredentials } from '../types';
import { fetchReplyTargetPreview, parseReplyUrl } from '../utils/replyResolver';

interface ReplyTargetControlProps {
  replyTarget?: ReplyTarget;
  onSetReplyTarget: (target: ReplyTarget | undefined) => void;
  onRestoreBothPlatforms?: () => void;
  credentials?: ApiCredentials;
  postToBluesky: boolean;
  postToThreads: boolean;
  onNotify?: (msg: { type: 'success' | 'error' | 'info' | 'warning'; title: string; message: string }) => void;
}

export const ReplyTargetControl: React.FC<ReplyTargetControlProps> = ({
  replyTarget,
  onSetReplyTarget,
  onRestoreBothPlatforms,
  credentials,
  postToBluesky,
  postToThreads,
  onNotify,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<'Bluesky' | 'Threads'>(
    postToBluesky && !postToThreads ? 'Bluesky' : postToThreads && !postToBluesky ? 'Threads' : 'Bluesky'
  );
  const [autoDetectedPlatform, setAutoDetectedPlatform] = useState<'Bluesky' | 'Threads' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 対象URLのアドレスを見て、Bluesky or Threadsを自動的に判断する
  const handleUrlChange = (value: string) => {
    setInputUrl(value);
    setResolveError(null);

    const trimmed = value.trim();
    if (!trimmed) {
      setAutoDetectedPlatform(null);
      return;
    }

    const parsed = parseReplyUrl(trimmed);
    if (parsed.platform) {
      setSelectedPlatform(parsed.platform);
      setAutoDetectedPlatform(parsed.platform);
    } else {
      setAutoDetectedPlatform(null);
    }
  };

  // URL入力のクリア
  const handleClearInput = () => {
    setInputUrl('');
    setAutoDetectedPlatform(null);
    setResolveError(null);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // キャンセルボタン（☓マーク）が押下された際には、リプライを解除しプレビュー画面を元に戻す（Bluesky・Threads両方表示）
  const handleCancel = () => {
    onSetReplyTarget(undefined);
    if (onRestoreBothPlatforms) {
      onRestoreBothPlatforms();
    }
    setInputUrl('');
    setAutoDetectedPlatform(null);
    setResolveError(null);
    setIsOpen(false);
  };

  // リプライ先情報の取得と適用
  const handleResolveAndSet = async () => {
    const raw = inputUrl.trim();
    if (!raw) {
      setResolveError('リプライ先投稿のURLまたは投稿IDを入力してください。');
      return;
    }

    setIsLoading(true);
    setResolveError(null);

    try {
      // 事前にURLから自動判定
      const parsed = parseReplyUrl(raw);
      const effectivePlatform = parsed.platform || selectedPlatform;

      const preview = await fetchReplyTargetPreview(raw, effectivePlatform, credentials);

      if (!preview.success) {
        const errMsg = preview.error || 'リプライ先投稿の情報を取得できませんでした。URLまたは投稿IDをご確認ください。';
        setResolveError(errMsg);
        if (onNotify) {
          onNotify({
            type: 'error',
            title: 'リプライ先の取得に失敗しました',
            message: errMsg,
          });
        }
        setIsLoading(false);
        return;
      }

      const target: ReplyTarget = {
        enabled: true,
        platform: preview.platform,
        url: preview.url || raw,
        postId: preview.postId,
        authorHandle: preview.authorHandle,
        authorDisplayName: preview.authorDisplayName,
        authorAvatar: preview.authorAvatar,
        postSnippet: preview.postSnippet,
        uri: preview.uri,
        cid: preview.cid,
        rootUri: preview.rootUri,
        rootCid: preview.rootCid,
      };

      onSetReplyTarget(target);
      setInputUrl('');
      setAutoDetectedPlatform(null);
      setIsOpen(false);
      setResolveError(null);
    } catch (e: any) {
      const errMsg = e.message || '予期せぬエラーが発生しました。';
      setResolveError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const isBluesky = replyTarget?.platform?.toLowerCase() === 'bluesky';
  const isThreads = replyTarget?.platform?.toLowerCase() === 'threads';

  // 1. リプライ先が設定されている場合の表示カード
  if (replyTarget) {
    return (
      <div
        id="reply-target-active-card"
        className={`rounded-xl border p-3 sm:p-3.5 transition-all shadow-sm ${
          isBluesky
            ? 'bg-sky-950/20 border-sky-500/40 ring-1 ring-sky-500/20'
            : 'bg-purple-950/20 border-purple-500/40 ring-1 ring-purple-500/20'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${
                isBluesky
                  ? 'bg-[#0085ff]/20 text-[#0085ff] border border-[#0085ff]/40'
                  : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
              }`}
            >
              <CornerDownRight className="w-3 h-3" />
              <span>{isBluesky ? 'Bluesky リプライ' : 'Threads リプライ'}</span>
            </span>

            <span className="text-xs font-medium text-slate-300 truncate">
              {replyTarget.authorDisplayName || replyTarget.authorHandle || '指定の投稿'} への返信
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {replyTarget.url && (
              <a
                href={replyTarget.url}
                target="_blank"
                rel="noreferrer"
                className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition cursor-pointer"
                title="元の投稿を新しいタブで開く"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            {/* キャンセル・解除ボタン（☓マーク）：押下でプレビュー画面を両方表示に戻す */}
            <button
              id="reply-target-cancel-button"
              type="button"
              onClick={handleCancel}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 rounded-lg border border-rose-500/30 transition cursor-pointer font-bold"
              title="リプライ設定をキャンセルして、プレビュー画面を両方表示（Bluesky・Threads）に戻します"
            >
              <X className="w-3.5 h-3.5" />
              <span>解除（両方表示に戻す）</span>
            </button>
          </div>
        </div>

        {/* リプライ先投稿の本文抜粋プレビュー */}
        <div className="mt-2 text-xs text-slate-400 bg-slate-900/60 rounded-lg p-2.5 border border-slate-800/80 flex items-start gap-2.5">
          {replyTarget.authorAvatar ? (
            <img
              src={replyTarget.authorAvatar}
              alt=""
              className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5"
              referrerPolicy="no-referrer"
            />
          ) : (
            <MessageSquare className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {replyTarget.authorDisplayName && (
                <span className="font-bold text-slate-200 truncate">{replyTarget.authorDisplayName}</span>
              )}
              {replyTarget.authorHandle && (
                <span className="text-slate-500 truncate text-[11px]">{replyTarget.authorHandle}</span>
              )}
            </div>
            <p className="mt-0.5 line-clamp-2 text-slate-300 text-xs leading-relaxed">
              {replyTarget.postSnippet || replyTarget.url || '投稿情報を読み込みました'}
            </p>
          </div>
        </div>

        {/* API制約等の警告表示 */}
        {replyTarget.warning && (
          <div className="mt-2 flex items-start gap-2 text-[11px] text-amber-200 bg-amber-950/30 p-2.5 rounded-lg border border-amber-500/30 leading-relaxed">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold text-amber-300">Threads APIの制限事項:</span>
              <p className="mt-0.5 text-amber-200/90">{replyTarget.warning}</p>
            </div>
          </div>
        )}

        {/* 単一プラットフォーム制約の明確な案内 */}
        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-300/90 bg-amber-950/20 px-2.5 py-1.5 rounded-lg border border-amber-500/20">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-amber-400" />
          <span>
            {isBluesky
              ? 'Bluesky専用リプライモード（Threadsプレビューは非表示）。右上の「解除」で両方表示に戻せます。'
              : 'Threads専用リプライモード（Blueskyプレビューは非表示）。右上の「解除」で両方表示に戻せます。'}
          </span>
        </div>
      </div>
    );
  }

  // 2. リプライ先が未設定の場合のトグルボタン / 入力フォーム
  return (
    <div id="reply-target-control-container" className="my-1.5">
      {!isOpen ? (
        <button
          id="btn-open-reply-target"
          type="button"
          onClick={() => {
            setIsOpen(true);
            setResolveError(null);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-sky-300 bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-sky-500/40 rounded-lg transition shadow-sm cursor-pointer"
          title="既存の投稿に対してリプライ（返信）を投稿します"
        >
          <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
          <span>💬 特定の投稿にリプライする</span>
        </button>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-950/95 p-3.5 sm:p-4 shadow-xl ring-1 ring-slate-800/80">
          <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
              <MessageSquare className="w-4 h-4 text-sky-400" />
              <span>リプライ先（返信先）の投稿を設定</span>
            </div>
            {/* キャンセルボタン（☓マーク）：押下された際にはプレビュー画面を元に戻す（Bluesky、Threads両方表示） */}
            <button
              id="reply-target-form-close-x"
              type="button"
              onClick={handleCancel}
              className="text-slate-400 hover:text-slate-200 p-1 hover:bg-slate-800 rounded-lg transition cursor-pointer flex items-center gap-1 text-xs"
              title="キャンセルしてプレビュー画面を元に戻す（Bluesky・Threads両方表示）"
              aria-label="キャンセル"
            >
              <span className="text-[11px] text-slate-400 hidden sm:inline">キャンセル</span>
              <X className="w-4 h-4 text-slate-400 hover:text-slate-200" />
            </button>
          </div>

          <div className="mt-3 space-y-2.5">
            {/* プラットフォーム選択 & アドレスからの自動判断状態 */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-400">対象SNS:</span>
                <div className="inline-flex rounded-lg border border-slate-800 p-0.5 bg-slate-900/80 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedPlatform('Bluesky')}
                    className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                      selectedPlatform === 'Bluesky'
                        ? 'bg-[#0085ff]/20 text-[#0085ff] border border-[#0085ff]/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🦋 Bluesky
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPlatform('Threads')}
                    className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                      selectedPlatform === 'Threads'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    🌀 Threads
                  </button>
                </div>
              </div>

              {/* URLアドレスからの自動判断バッジ */}
              {autoDetectedPlatform && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 animate-in fade-in duration-150">
                  <Sparkles className="w-3 h-3 text-emerald-400 shrink-0" />
                  <span>URLから{autoDetectedPlatform}を自動判定しました</span>
                </div>
              )}
            </div>

            {/* URL / ID 入力バー + クリアボタン */}
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={inputUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleResolveAndSet();
                    }
                  }}
                  placeholder={
                    selectedPlatform === 'Bluesky'
                      ? 'https://bsky.app/profile/.../post/... または at://...'
                      : 'https://www.threads.net/@user/post/... または threads.com/share/... または 投稿ID'
                  }
                  className="w-full pl-9 pr-8 py-2 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition"
                />

                {/* URL入力をクリアするボタン */}
                {inputUrl.length > 0 && (
                  <button
                    id="btn-clear-reply-url"
                    type="button"
                    onClick={handleClearInput}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-full transition cursor-pointer"
                    title="URL入力をクリア"
                    aria-label="URL入力をクリア"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* 設定実行ボタン */}
              <button
                id="btn-submit-reply-target"
                type="button"
                onClick={handleResolveAndSet}
                disabled={isLoading || !inputUrl.trim()}
                className="flex items-center gap-1 px-3.5 py-2 rounded-lg text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 transition cursor-pointer shrink-0 shadow-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>取得中...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>設定</span>
                  </>
                )}
              </button>
            </div>

            {/* エラーメッセージ */}
            {resolveError && (
              <div className="flex items-start gap-1.5 text-xs text-rose-400 bg-rose-950/20 p-2.5 rounded-lg border border-rose-500/20">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                <span className="leading-relaxed">{resolveError}</span>
              </div>
            )}

            {/* ガイド注記 */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
              <span>
                ※ URLを入力すると対象SNSが自動判別されます。キャンセル（✕）で通常の「両方表示」に戻ります。
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
