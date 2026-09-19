import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  Globe,
  Scissors,
  RefreshCw,
  Image as ImageIcon,
  Check,
  Link2,
  Plus,
  Sparkles,
  Info,
} from 'lucide-react';
import { OgpCardData } from '../types';

interface OgpPreviewSectionProps {
  text: string;
  onReplaceUrl: (oldUrl: string, newUrl: string) => void;
  onInsertUrl?: (url: string) => void;
  onNotify?: (msg: { type: 'success' | 'error' | 'info'; title: string; message: string }) => void;
}

// URL抽出ヘルパー
function extractUrls(str: string): string[] {
  if (!str) return [];
  const regex = /https?:\/\/[^\s<>()"']+/g;
  const matches = str.match(regex) || [];
  const cleaned = matches.map((u) => u.replace(/[.,!?:;)\]\}'"]+$/, ''));
  return Array.from(new Set(cleaned));
}

// サンプルURLプリセット
const SAMPLE_URLS = [
  { label: '🦋 Bluesky', url: 'https://bsky.app' },
  { label: '🐙 GitHub', url: 'https://github.com' },
  { label: '📰 Yahoo!ニュース', url: 'https://news.yahoo.co.jp' },
  { label: '✍️ note', url: 'https://note.com' },
];

export const OgpPreviewSection: React.FC<OgpPreviewSectionProps> = ({
  text,
  onReplaceUrl,
  onInsertUrl,
  onNotify,
}) => {
  const [ogpCards, setOgpCards] = useState<Record<string, OgpCardData>>({});
  const [loadingUrls, setLoadingUrls] = useState<Record<string, boolean>>({});
  const [shorteningUrls, setShorteningUrls] = useState<Record<string, boolean>>({});
  const [shortenedUrls, setShortenedUrls] = useState<Record<string, string>>({});
  const [previewStyle, setPreviewStyle] = useState<'bluesky' | 'threads'>('bluesky');

  // 手動入力URL用
  const [manualUrl, setManualUrl] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [manualCard, setManualCard] = useState<OgpCardData | null>(null);

  const detectedUrls = extractUrls(text);

  // 本文中のURL変化を検知してOGPを取得
  useEffect(() => {
    if (detectedUrls.length === 0) return;

    detectedUrls.forEach((url) => {
      if (ogpCards[url] || loadingUrls[url]) return;

      setLoadingUrls((prev) => ({ ...prev, [url]: true }));

      fetch(`/api/ogp?url=${encodeURIComponent(url)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setOgpCards((prev) => ({
              ...prev,
              [url]: {
                url,
                domain: data.domain || new URL(url).hostname,
                title: data.title || data.domain || url,
                description: data.description || '',
                image: data.image || '',
              },
            }));
          } else {
            setOgpCards((prev) => ({
              ...prev,
              [url]: {
                url,
                domain: new URL(url).hostname,
                title: new URL(url).hostname,
                description: '',
                image: '',
                error: data.error,
              },
            }));
          }
        })
        .catch((err) => {
          console.warn('Failed to fetch OGP:', err);
          let domain = 'link';
          try {
            domain = new URL(url).hostname;
          } catch {}
          setOgpCards((prev) => ({
            ...prev,
            [url]: {
              url,
              domain,
              title: domain,
              description: '',
              image: '',
            },
          }));
        })
        .finally(() => {
          setLoadingUrls((prev) => ({ ...prev, [url]: false }));
        });
    });
  }, [detectedUrls.join(',')]);

  // 手動URLのOGP取得
  const handleFetchManualOgp = async (targetUrl?: string) => {
    const urlToFetch = (targetUrl || manualUrl).trim();
    if (!urlToFetch) return;

    // プロトコル補完
    let formattedUrl = urlToFetch;
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = `https://${formattedUrl}`;
      setManualUrl(formattedUrl);
    }

    setManualLoading(true);
    setManualCard(null);

    try {
      const res = await fetch(`/api/ogp?url=${encodeURIComponent(formattedUrl)}`);
      const data = await res.json();
      if (data.success) {
        setManualCard({
          url: formattedUrl,
          domain: data.domain || new URL(formattedUrl).hostname,
          title: data.title || data.domain || formattedUrl,
          description: data.description || '',
          image: data.image || '',
        });
      } else {
        setManualCard({
          url: formattedUrl,
          domain: new URL(formattedUrl).hostname,
          title: new URL(formattedUrl).hostname,
          description: 'リンク情報の取得に失敗したか、メタデータが存在しません。',
          image: '',
          error: data.error,
        });
      }
    } catch (err: any) {
      let domain = 'link';
      try {
        domain = new URL(formattedUrl).hostname;
      } catch {}
      setManualCard({
        url: formattedUrl,
        domain,
        title: domain,
        description: '接続に失敗しました。',
        image: '',
      });
    } finally {
      setManualLoading(false);
    }
  };

  // 本文へURLを挿入
  const handleInsertIntoText = (urlToInsert: string) => {
    if (onInsertUrl) {
      onInsertUrl(urlToInsert);
      if (onNotify) {
        onNotify({
          type: 'success',
          title: 'URLを挿入しました',
          message: `本文に ${urlToInsert} を追加しました。`,
        });
      }
    }
  };

  // URL短縮ハンドラ
  const handleShorten = async (targetUrl: string) => {
    if (shorteningUrls[targetUrl]) return;
    setShorteningUrls((prev) => ({ ...prev, [targetUrl]: true }));

    try {
      const res = await fetch('/api/shorten-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });
      const data = await res.json();

      if (data.success && data.shortUrl) {
        setShortenedUrls((prev) => ({ ...prev, [targetUrl]: data.shortUrl }));
        onReplaceUrl(targetUrl, data.shortUrl);
        if (onNotify) {
          onNotify({
            type: 'success',
            title: '✂️ URLを短縮しました！',
            message: `本文中のURLを ${data.shortUrl} に置換しました（文字数を節約できます）。`,
          });
        }
      } else {
        if (onNotify) {
          onNotify({
            type: 'error',
            title: 'URL短縮に失敗しました',
            message: data.error || '短縮サービスへ接続できませんでした。',
          });
        }
      }
    } catch (err: any) {
      if (onNotify) {
        onNotify({
          type: 'error',
          title: 'URL短縮エラー',
          message: err.message || '通信エラーが発生しました。',
        });
      }
    } finally {
      setShorteningUrls((prev) => ({ ...prev, [targetUrl]: false }));
    }
  };

  return (
    <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 space-y-3 shadow-sm text-xs">
      {/* 上部ヘッダーバー */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="flex items-center gap-1.5 font-bold text-slate-200">
            <span>リンクカード (OGP) 設定 & プレビュー</span>
            {detectedUrls.length > 0 ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                {detectedUrls.length}件検出中
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-normal">
                URL未入力
              </span>
            )}
          </div>
        </div>

        {/* プレビュー表示スタイル切り替え */}
        <div className="flex items-center bg-slate-900 rounded-lg p-0.5 border border-slate-800 text-[11px]">
          <button
            type="button"
            onClick={() => setPreviewStyle('bluesky')}
            className={`px-2 py-0.5 rounded-md transition cursor-pointer font-medium ${
              previewStyle === 'bluesky'
                ? 'bg-[#0085ff]/20 text-[#38bdf8] border border-[#0085ff]/40 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Bluesky公式カード表示のシミュレート"
          >
            🦋 Bluesky風
          </button>
          <button
            type="button"
            onClick={() => setPreviewStyle('threads')}
            className={`px-2 py-0.5 rounded-md transition cursor-pointer font-medium ${
              previewStyle === 'threads'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Threads公式カード表示のシミュレート"
          >
            🌀 Threads風
          </button>
        </div>
      </div>

      {/* URL直接入力・テスト・追加フォーム */}
      <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-300 font-medium">
          <span className="flex items-center gap-1 text-slate-300">
            <Link2 className="w-3.5 h-3.5 text-sky-400" />
            URLをテストまたは本文に追加
          </span>
          <span className="text-[10px] text-slate-500">
            ※本文に直接 https://... と書いても自動検出されます
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <input
            id="ogp-url-manual-input"
            type="url"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleFetchManualOgp();
              }
            }}
            placeholder="https://example.com/article"
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-slate-100 placeholder-slate-600 outline-none text-xs transition"
          />

          <button
            type="button"
            onClick={() => handleFetchManualOgp()}
            disabled={manualLoading || !manualUrl.trim()}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-medium transition cursor-pointer flex items-center gap-1 text-xs shrink-0 shadow-xs"
          >
            {manualLoading ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>取得中...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3" />
                <span>OGP取得</span>
              </>
            )}
          </button>

          {onInsertUrl && (
            <button
              type="button"
              onClick={() => handleInsertIntoText(manualUrl.trim())}
              disabled={!manualUrl.trim()}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 font-medium transition cursor-pointer flex items-center gap-1 text-xs shrink-0"
              title="このURLを本文の末尾に挿入"
            >
              <Plus className="w-3 h-3 text-sky-400" />
              <span>本文に挿入</span>
            </button>
          )}
        </div>

        {/* サンプルURLチップ */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className="text-[10px] text-slate-400">サンプルでお試し:</span>
          {SAMPLE_URLS.map((sample) => (
            <button
              key={sample.url}
              type="button"
              onClick={() => {
                setManualUrl(sample.url);
                handleFetchManualOgp(sample.url);
              }}
              className="text-[10px] px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-100 transition cursor-pointer"
            >
              {sample.label}
            </button>
          ))}
        </div>

        {/* 手動入力テストカードのプレビュー表示 */}
        {manualCard && (
          <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-emerald-400 flex items-center gap-1">
                <Check className="w-3 h-3" /> 取得結果プレビュー
              </span>
              {onInsertUrl && !detectedUrls.includes(manualCard.url) && (
                <button
                  type="button"
                  onClick={() => handleInsertIntoText(manualCard.url)}
                  className="text-sky-400 hover:text-sky-300 font-medium flex items-center gap-0.5 cursor-pointer underline text-[11px]"
                >
                  <Plus className="w-3 h-3" /> 本文に追加する
                </button>
              )}
            </div>

            <div
              className={`overflow-hidden border transition ${
                previewStyle === 'bluesky'
                  ? 'rounded-xl border-slate-800 bg-slate-900 shadow-md'
                  : 'rounded-2xl border-slate-800/90 bg-[#16181f] shadow-sm'
              }`}
            >
              {manualCard.image ? (
                <div className="relative w-full h-32 bg-slate-950 overflow-hidden">
                  <img
                    src={manualCard.image}
                    alt={manualCard.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                <div className="w-full h-14 bg-slate-950/60 flex items-center justify-center text-slate-500 border-b border-slate-800/50">
                  <ImageIcon className="w-4 h-4 opacity-40 mr-1.5" />
                  <span className="text-[10px]">画像メタタグなし</span>
                </div>
              )}
              <div className="p-2.5 space-y-1">
                <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                  <Globe className="w-2.5 h-2.5 text-slate-500" />
                  <span className="uppercase tracking-wider truncate">{manualCard.domain}</span>
                </div>
                <h4 className="text-xs font-bold text-slate-100 line-clamp-1 leading-snug">
                  {manualCard.title}
                </h4>
                {manualCard.description && (
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {manualCard.description}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 本文から検出されたURL一覧とOGPカード */}
      {detectedUrls.length > 0 ? (
        <div className="space-y-2.5">
          <div className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
            <span>本文で検出されたリンクカード ({detectedUrls.length}件):</span>
          </div>

          <div className="space-y-2.5">
            {detectedUrls.map((url) => {
              const card = ogpCards[url];
              const isLoading = loadingUrls[url];
              const isShortening = shorteningUrls[url];
              const isShortened = Boolean(shortenedUrls[url]);

              return (
                <div
                  key={url}
                  className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 flex flex-col gap-2"
                >
                  {/* URLバー & 短縮アクション */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 min-w-0 max-w-[70%]">
                      <Link2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span className="text-[11px] text-slate-200 font-mono truncate" title={url}>
                        {url}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleShorten(url)}
                        disabled={isShortening || isShortened}
                        className={`px-2 py-1 text-[10px] font-bold rounded-md flex items-center gap-1 transition cursor-pointer ${
                          isShortened
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-default'
                            : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30'
                        }`}
                        title="URLを短縮して文字数を節約"
                      >
                        {isShortening ? (
                          <>
                            <RefreshCw className="w-2.5 h-2.5 animate-spin text-amber-400" />
                            <span>短縮中...</span>
                          </>
                        ) : isShortened ? (
                          <>
                            <Check className="w-2.5 h-2.5 text-emerald-400" />
                            <span>短縮済</span>
                          </>
                        ) : (
                          <>
                            <Scissors className="w-2.5 h-2.5 text-amber-400" />
                            <span>URL短縮</span>
                          </>
                        )}
                      </button>

                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                        title="リンク先を新しいタブで確認"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  {/* カードプレビュー */}
                  {isLoading ? (
                    <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-center gap-2 text-xs text-slate-400">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>リンク先からOGP情報を取得中...</span>
                    </div>
                  ) : card ? (
                    <div
                      className={`overflow-hidden border transition ${
                        previewStyle === 'bluesky'
                          ? 'rounded-xl border-slate-800 bg-slate-950/80 shadow-md'
                          : 'rounded-2xl border-slate-800/90 bg-[#16181f] shadow-sm'
                      }`}
                    >
                      {card.image ? (
                        <div className="relative w-full h-32 bg-slate-950 overflow-hidden">
                          <img
                            src={card.image}
                            alt={card.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-full h-12 bg-slate-950/60 flex items-center justify-center text-slate-500 border-b border-slate-800/50">
                          <ImageIcon className="w-4 h-4 opacity-40 mr-1.5" />
                          <span className="text-[10px]">画像メタタグなし</span>
                        </div>
                      )}
                      <div className="p-2.5 space-y-1">
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                          <Globe className="w-2.5 h-2.5 text-slate-500" />
                          <span className="uppercase tracking-wider truncate">{card.domain}</span>
                        </div>
                        <h4 className="text-xs font-bold text-slate-100 line-clamp-1 leading-snug">
                          {card.title}
                        </h4>
                        {card.description && (
                          <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                            {card.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* URLが本文にない場合の仕様ガイド */
        <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-800/70 space-y-1.5 text-slate-400 text-[11px]">
          <div className="flex items-center gap-1.5 text-slate-300 font-semibold text-xs">
            <Info className="w-3.5 h-3.5 text-sky-400" />
            <span>OGPカード表示の仕様とメリット</span>
          </div>
          <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] leading-relaxed">
            <li>
              <strong className="text-slate-200">Bluesky:</strong> 投稿にURLを含めると、自動的にリッチなサムネイルカードとして展開されます。
            </li>
            <li>
              <strong className="text-slate-200">Threads:</strong> リンクカードとして展開され、タップで外部ブラウザに遷移します。
            </li>
            <li>
              <strong className="text-slate-200">URL短縮:</strong> 長いリンクは「URL短縮」ボタンで短縮URL（is.gd等）にワンクリック置換でき、文字数制限（300/500文字）を大幅に節約できます。
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};
