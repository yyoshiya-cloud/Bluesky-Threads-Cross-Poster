import React, { useState } from 'react';
import { SplitThreadItem, AttachedImage, ApiCredentials, ReplySettings } from '../types';
import {
  MessageSquare,
  Repeat2,
  Heart,
  Share,
  Send,
  MoreHorizontal,
  Eye,
  BadgeCheck,
  Type,
  Smartphone,
  Bookmark,
  Plus,
  Info,
  Layers,
  Sliders,
  Play,
  Film,
  GitCommit,
  Link2,
  Unlink,
  Network,
  Sparkles,
  ArrowDownCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ThreadPreviewProps {
  blueskySplits: SplitThreadItem[];
  threadsSplits: SplitThreadItem[];
  threadsTopic?: string;
  images: AttachedImage[];
  postToBluesky: boolean;
  postToThreads: boolean;
  credentials?: ApiCredentials;
  replySettings?: ReplySettings;
}

type PreviewFontSize = 'sm' | 'md' | 'lg';
type SkinMode = 'simulated' | 'standard';

const FONT_SIZE_CONFIG: Record<PreviewFontSize, { label: string; textClass: string }> = {
  sm: { label: '小', textClass: 'text-xs leading-relaxed' },
  md: { label: '中', textClass: 'text-sm leading-relaxed' },
  lg: { label: '大', textClass: 'text-base leading-relaxed' },
};

// Bluesky 公式 Butterfly ロゴ SVG
const BlueskyButterflyLogo: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 568 500.5" className={className} fill="currentColor">
    <path d="M123.121 33.664C188.241 82.553 258.281 181.68 284 234.873c25.719-53.192 95.759-152.32 160.879-201.21C491.875-1.928 568-28.513 568 56.577c0 17.022-9.743 142.92-15.46 163.315-19.882 70.92-92.482 88.948-156.54 78.026 112.186 19.167 140.75 87.778 79.16 150.94-73.498 75.367-172.93 1.942-191.16-52.015-18.23 53.957-117.662 127.382-191.16 52.015-61.59-63.162-33.026-131.773 79.16-150.94-64.058 10.922-136.658-7.106-156.54-78.026C9.743 199.497 0 73.599 0 56.577 0-28.513 76.125-1.928 123.121 33.664Z" />
  </svg>
);

// Threads 公式 アットマークスパイラル ロゴ SVG
const ThreadsSpiralLogo: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 192 192" className={className} fill="currentColor">
    <path d="M141.537 88.9883C140.71 88.5919 139.87 88.2104 139.019 87.8451C137.537 60.5382 122.616 44.905 97.5619 44.745C97.4484 44.7443 97.3355 44.7443 97.222 44.7443C82.2364 44.7443 69.7731 51.1409 62.102 62.7807L75.881 72.2328C81.6116 63.5383 90.6052 61.6848 97.2286 61.6848C97.3051 61.6848 97.3819 61.6848 97.4576 61.6855C105.707 61.7381 111.932 64.1366 115.961 68.814C118.893 72.2193 120.854 76.925 121.825 82.8638C114.511 81.6207 106.601 81.2385 98.145 81.7233C74.3247 83.0954 59.0111 96.9879 60.0396 116.292C60.5615 126.084 65.4397 134.508 73.775 140.011C80.8224 144.663 89.899 146.938 99.3323 146.423C111.79 145.74 121.563 140.987 128.381 132.296C133.559 125.696 136.834 117.143 138.28 106.366C144.217 109.949 148.617 114.664 151.047 120.332C155.179 129.967 155.42 145.8 142.501 158.708C131.182 170.016 117.576 174.908 97.0135 175.059C74.2042 174.89 56.9538 167.575 45.7381 153.317C35.2355 139.966 29.8077 120.682 29.6052 96C29.8077 71.3178 35.2355 52.0336 45.7381 38.6827C56.9538 24.4249 74.2039 17.11 97.0132 16.9405C119.988 17.1113 137.539 24.4614 149.184 38.788C154.894 45.8136 159.199 54.6488 162.037 64.9503L178.184 60.6422C174.744 47.9622 169.331 37.0357 161.965 27.974C147.036 9.60668 125.202 0.195148 97.0695 0H96.9569C68.8816 0.19447 47.2921 9.6418 32.7883 28.0793C19.8819 44.4864 13.2244 67.3157 13.0007 95.9325L13 96L13.0007 96.0675C13.2244 124.684 19.8819 147.514 32.7883 163.921C47.2921 182.358 68.8816 191.806 96.9569 192H97.0695C122.03 191.827 139.624 185.292 154.118 170.811C173.081 151.866 172.51 128.119 166.26 113.541C161.776 103.087 153.227 94.5962 141.537 88.9883ZM98.4405 129.507C88.0005 130.095 77.1544 125.409 76.6196 115.372C76.2232 107.93 81.9158 99.626 99.0812 98.6368C101.047 98.5234 102.976 98.468 104.871 98.468C111.106 98.468 116.939 99.0737 122.242 100.233C120.264 124.935 108.662 128.946 98.4405 129.507Z" />
  </svg>
);

export const ThreadPreview: React.FC<ThreadPreviewProps> = ({
  blueskySplits,
  threadsSplits,
  threadsTopic,
  images,
  postToBluesky,
  postToThreads,
  credentials,
  replySettings,
}) => {
  const [showDiffGuide, setShowDiffGuide] = useState<boolean>(false);

  // 公式UIスキンシミュレーターモード (simulated = 公式アプリ風, standard = フラット表示)
  const [skinMode, setSkinMode] = useState<SkinMode>(() => {
    try {
      const saved = localStorage.getItem('cross_poster_preview_skin_mode');
      if (saved === 'simulated' || saved === 'standard') {
        return saved;
      }
    } catch {}
    return 'simulated'; // デフォルトでリアルな公式スキンを適用
  });

  const handleSkinModeChange = (mode: SkinMode) => {
    setSkinMode(mode);
    try {
      localStorage.setItem('cross_poster_preview_skin_mode', mode);
    } catch {}
  };

  const [fontSize, setFontSize] = useState<PreviewFontSize>(() => {
    try {
      const saved = localStorage.getItem('cross_poster_preview_font_size');
      if (saved === 'sm' || saved === 'md' || saved === 'lg') {
        return saved;
      }
    } catch {}
    return 'sm';
  });

  const handleFontSizeChange = (size: PreviewFontSize) => {
    setFontSize(size);
    try {
      localStorage.setItem('cross_poster_preview_font_size', size);
    } catch {}
  };

  // ツリー形式（分割ポスト）の連結具合を可視化するスライダー値 (0%〜100%, デフォルト65%)
  const [connectionDegree, setConnectionDegree] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('cross_poster_thread_connection_degree');
      if (saved !== null) {
        const num = Number(saved);
        if (!isNaN(num) && num >= 0 && num <= 100) {
          return num;
        }
      }
    } catch {}
    return 65;
  });

  const handleConnectionDegreeChange = (val: number) => {
    setConnectionDegree(val);
    try {
      localStorage.setItem('cross_poster_thread_connection_degree', String(val));
    } catch {}
  };

  // ツリー連結ビジュアライザーの折りたたみ状態
  const [isVisualizerCollapsed, setIsVisualizerCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('cross_poster_thread_visualizer_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleVisualizerCollapse = () => {
    setIsVisualizerCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('cross_poster_thread_visualizer_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // フォーカス中の分割ポストインデックス（タイムラインからクリックでハイライト）
  const [focusedSplitIndex, setFocusedSplitIndex] = useState<number | null>(null);

  // プレビュー内の動画同時デコード負荷・フリーズ防止のためのアクティブ動画ID
  const [activePlayingVideoId, setActivePlayingVideoId] = useState<string | null>(null);

  const rawHandle = credentials?.blueskyHandle || credentials?.blueskyIdentifier || 'creator.bsky.social';
  const blueskyHandle = rawHandle.replace(/^@/, '');
  const blueskyDisplayName = blueskyHandle.split('.')[0] || 'Creator';
  const threadsUsername = credentials?.threadsUsername?.replace(/^@/, '') || 'creator';
  const cleanedThreadsTopic = threadsTopic?.trim().replace(/^#+/, '') || '';

  // ツリー連結可視化の計算値
  const isSeparated = connectionDegree <= 25;
  const isStandard = connectionDegree > 25 && connectionDegree < 72;
  const isSeamless = connectionDegree >= 72;
  const connectorOpacity = Math.max(0.2, connectionDegree / 100);

  // リプライ対象の検出とプレビュー表示制御
  // - Threadsのリプライ投稿の場合はThreadsのみプレビューを表示（Blueskyは非表示）
  // - Blueskyのリプライ投稿の場合はBlueskyのみプレビューを表示（Threadsは非表示）
  // - リプライ投稿をキャンセルした場合は両方（選択されたプラットフォーム）表示
  const hasBlueskyReply = Boolean(
    replySettings?.blueskyResolved ||
    (replySettings?.blueskyTargetUrl && replySettings.blueskyTargetUrl.trim().length > 0)
  );
  const hasThreadsReply = Boolean(
    replySettings?.threadsResolved ||
    (replySettings?.threadsTargetUrl && replySettings.threadsTargetUrl.trim().length > 0)
  );

  let effectiveShowBluesky = postToBluesky;
  let effectiveShowThreads = postToThreads;

  if (hasThreadsReply && !hasBlueskyReply) {
    effectiveShowBluesky = false;
    effectiveShowThreads = true;
  } else if (hasBlueskyReply && !hasThreadsReply) {
    effectiveShowBluesky = true;
    effectiveShowThreads = false;
  }

  const hasSplitPosts =
    (effectiveShowBluesky && blueskySplits.length > 1) ||
    (effectiveShowThreads && threadsSplits.length > 1);

  // 本文中のリンク・メンション・ハッシュタグの強調表示
  const renderRichText = (rawText: string, isBluesky = false) => {
    if (!rawText) return null;
    const tokens = rawText.split(/(https?:\/\/[^\s<>()"']+|@[a-zA-Z0-9_.-]+|#[^\s#.,!?:;()[\]{}'"]+)/g);

    return tokens.map((tok, i) => {
      if (/^https?:\/\//.test(tok)) {
        return (
          <span
            key={i}
            className={`${isBluesky ? 'text-[#0085ff] hover:underline' : 'text-sky-400 hover:underline'} cursor-pointer break-all font-medium`}
            title={tok}
          >
            {tok}
          </span>
        );
      }
      if (/^@[a-zA-Z0-9_.-]+/.test(tok)) {
        return (
          <span
            key={i}
            className={`${isBluesky ? 'text-[#0085ff] font-medium hover:underline' : 'text-purple-400 font-medium hover:underline'} cursor-pointer`}
            title={`メンション: ${tok}`}
          >
            {tok}
          </span>
        );
      }
      if (/^#[^\s#.,!?:;()[\]{}'"]+/.test(tok)) {
        return (
          <span
            key={i}
            className={`${isBluesky ? 'text-[#0085ff] font-medium hover:underline' : 'text-purple-300 font-medium hover:underline'} cursor-pointer`}
            title={`ハッシュタグ: ${tok}`}
          >
            {tok}
          </span>
        );
      }
      return tok;
    });
  };

  // Bluesky用 メディアグリッド (公式仕様準拠: 動画は1件表示、画像は最大4枚グリッド & ALTバッジ)
  const renderBlueskyImageGrid = (imgList: AttachedImage[]) => {
    if (imgList.length === 0) return null;

    // 動画が含まれているか確認
    const firstVideo = imgList.find((m) => m.mediaType === 'video');

    // 動画がある場合：Blueskyの公式仕様（動画は1投稿につき1本Embed）に準拠して動画プレイヤーを表示
    if (firstVideo) {
      const videoSrc = firstVideo.previewUrl || firstVideo.dataUrl;
      const isPlaying = activePlayingVideoId === `bsky-${firstVideo.id}`;

      return (
        <div className="mt-2.5 rounded-xl overflow-hidden border border-[#1e2a38] max-h-80 bg-black relative shadow-sm w-full min-w-0 max-w-full group">
          {isPlaying ? (
            videoSrc ? (
              <video
                src={videoSrc}
                controls
                autoPlay
                className="w-full max-h-80 object-contain mx-auto"
              />
            ) : (
              <div className="w-full h-40 flex items-center justify-center bg-slate-900 text-slate-500">
                動画を読み込めません
              </div>
            )
          ) : (
            <button
              type="button"
              onClick={() => setActivePlayingVideoId(`bsky-${firstVideo.id}`)}
              className="relative w-full h-56 block cursor-pointer text-left overflow-hidden bg-slate-950 group/bvid"
              title="クリックして動画を再生"
            >
              {firstVideo.thumbnailUrl ? (
                <img
                  src={firstVideo.thumbnailUrl}
                  alt={firstVideo.alt || firstVideo.name}
                  className="w-full h-full object-contain group-hover/bvid:scale-102 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                  <Film className="w-10 h-10 text-purple-400" />
                </div>
              )}
              {/* 中央の再生ボタン */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover/bvid:bg-black/40 transition">
                <div className="w-12 h-12 rounded-full bg-black/70 border border-white/40 flex items-center justify-center shadow-xl group-hover/bvid:scale-110 group-hover/bvid:bg-purple-600 transition">
                  <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                </div>
              </div>
              {firstVideo.duration ? (
                <span className="absolute bottom-2.5 left-2.5 bg-black/80 text-[10px] text-neutral-200 px-1.5 py-0.5 rounded font-mono border border-white/10">
                  {Math.floor(firstVideo.duration / 60)}:{(Math.round(firstVideo.duration % 60)).toString().padStart(2, '0')}
                </span>
              ) : null}
            </button>
          )}
          <div className="absolute top-2 left-2 z-10 pointer-events-none">
            <span className="bg-purple-600/90 text-[10px] font-bold text-white px-2 py-0.5 rounded-md shadow backdrop-blur-xs flex items-center gap-1">
              動画 (MP4/MOV)
            </span>
          </div>
          {firstVideo.alt && (
            <div className="absolute bottom-2 right-2 z-10">
              <span
                className="bg-black/85 text-[10px] font-bold text-slate-100 px-2 py-0.5 rounded-md shadow border border-white/20 cursor-help"
                title={`ALT: ${firstVideo.alt}`}
              >
                ALT
              </span>
            </div>
          )}
        </div>
      );
    }

    const displayImgs = imgList.slice(0, 4);

    const renderImgItem = (img: AttachedImage, i: number, containerClass = '') => (
      <div key={i} className={`relative overflow-hidden bg-slate-900 group ${containerClass}`}>
        {img.dataUrl ? (
          <img
            src={img.dataUrl}
            alt={img.alt || `media-${i}`}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-102"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-600">
            画像なし
          </div>
        )}
        {img.alt && (
          <div className="absolute bottom-1.5 left-1.5 z-10">
            <span
              className="bg-black/85 text-[9px] font-bold text-slate-100 px-1.5 py-0.5 rounded-sm tracking-wider shadow border border-white/20 cursor-help"
              title={`ALT: ${img.alt}`}
            >
              ALT
            </span>
          </div>
        )}
      </div>
    );

    if (displayImgs.length === 1) {
      return (
        <div className="mt-2.5 rounded-xl overflow-hidden border border-[#1e2a38] max-h-72 bg-black relative flex items-center justify-center shadow-sm w-full min-w-0 max-w-full">
          {displayImgs[0].dataUrl ? (
            <img
              src={displayImgs[0].dataUrl}
              alt={displayImgs[0].alt || 'media'}
              className="w-full h-full object-cover max-h-72"
            />
          ) : (
            <div className="w-full h-40 flex items-center justify-center bg-slate-900 text-slate-500">
              画像なし
            </div>
          )}
          {displayImgs[0].alt && (
            <div className="absolute bottom-2 left-2 z-10">
              <span
                className="bg-black/85 text-[10px] font-bold text-slate-100 px-2 py-0.5 rounded-md shadow border border-white/20 cursor-help"
                title={`ALT: ${displayImgs[0].alt}`}
              >
                ALT
              </span>
            </div>
          )}
        </div>
      );
    }

    if (displayImgs.length === 2) {
      return (
        <div className="mt-2.5 grid grid-cols-2 gap-1 rounded-xl overflow-hidden border border-[#1e2a38] h-48 bg-black shadow-sm w-full min-w-0 max-w-full">
          {displayImgs.map((img, i) => renderImgItem(img, i, 'w-full h-full'))}
        </div>
      );
    }

    if (displayImgs.length === 3) {
      return (
        <div className="mt-2.5 grid grid-cols-2 gap-1 rounded-xl overflow-hidden border border-[#1e2a38] h-52 bg-black shadow-sm w-full min-w-0 max-w-full">
          {renderImgItem(displayImgs[0], 0, 'w-full h-full')}
          <div className="grid grid-rows-2 gap-1 h-full">
            {renderImgItem(displayImgs[1], 1, 'w-full h-full')}
            {renderImgItem(displayImgs[2], 2, 'w-full h-full')}
          </div>
        </div>
      );
    }

    return (
      <div className="mt-2.5 grid grid-cols-2 grid-rows-2 gap-1 rounded-xl overflow-hidden border border-[#1e2a38] h-56 bg-black shadow-sm w-full min-w-0 max-w-full">
        {displayImgs.map((img, i) => renderImgItem(img, i, 'w-full h-full'))}
      </div>
    );
  };

  // Threads用 メディアギャラリー（公式仕様準拠: 横スワイプ・カルーセル & 動画再生対応）
  const renderThreadsImageGrid = (imgList: AttachedImage[]) => {
    if (imgList.length === 0) return null;

    return (
      <div className="mt-2.5 space-y-1.5 w-full min-w-0 max-w-full overflow-hidden">
        <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent w-full min-w-0">
          {imgList.map((img, i) => (
            <div
              key={i}
              className="relative shrink-0 w-44 sm:w-60 h-44 sm:h-60 max-w-[85%] rounded-2xl overflow-hidden border border-neutral-800/80 bg-neutral-950 group shadow-md flex items-center justify-center"
            >
              {img.mediaType === 'video' ? (
                <div className="relative w-full h-full bg-black flex items-center justify-center">
                  {activePlayingVideoId === img.id ? (
                    (img.previewUrl || img.dataUrl) ? (
                      <video
                        src={(img.previewUrl || img.dataUrl) || undefined}
                        controls
                        autoPlay
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs text-neutral-500">動画エラー</span>
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActivePlayingVideoId(img.id)}
                      className="relative w-full h-full block group/vid cursor-pointer text-left overflow-hidden"
                      title="クリックして動画を再生"
                    >
                      {img.thumbnailUrl ? (
                        <img
                          src={img.thumbnailUrl}
                          alt={img.alt || img.name}
                          className="w-full h-full object-cover group-hover/vid:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-neutral-900 flex items-center justify-center">
                          <Film className="w-8 h-8 text-purple-400" />
                        </div>
                      )}
                      {/* 中央の再生ボタン */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover/vid:bg-black/45 transition">
                        <div className="w-10 h-10 rounded-full bg-black/70 border border-white/40 flex items-center justify-center shadow-lg group-hover/vid:scale-110 group-hover/vid:bg-purple-600 transition">
                          <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                        </div>
                      </div>
                      {img.duration ? (
                        <span className="absolute bottom-2 right-2 bg-black/80 text-[10px] text-neutral-200 px-1.5 py-0.5 rounded font-mono border border-white/10">
                          {Math.floor(img.duration / 60)}:{(Math.round(img.duration % 60)).toString().padStart(2, '0')}
                        </span>
                      ) : null}
                    </button>
                  )}
                  <div className="absolute top-2 left-2 bg-purple-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow pointer-events-none z-10">
                    動画
                  </div>
                </div>
              ) : img.dataUrl ? (
                <img src={img.dataUrl} alt={`threads-img-${i}`} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-neutral-900 text-neutral-600 text-xs">
                  画像なし
                </div>
              )}
              {imgList.length > 1 && (
                <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-sm text-[10px] text-neutral-200 px-2 py-0.5 rounded-full font-mono border border-white/10 shadow-sm pointer-events-none">
                  {i + 1}/{imgList.length}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* カルーセル ドット インジケーター (3枚以上時) */}
        {imgList.length > 1 && (
          <div className="flex items-center justify-center gap-1 pt-0.5">
            {imgList.slice(0, 8).map((_, dotIdx) => (
              <span
                key={dotIdx}
                className={`h-1.5 rounded-full transition-all ${
                  dotIdx === 0 ? 'w-4 bg-neutral-200' : 'w-1.5 bg-neutral-700'
                }`}
              />
            ))}
            {imgList.length > 8 && (
              <span className="text-[9px] text-neutral-500 font-mono">+{imgList.length - 8}</span>
            )}
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // Bluesky スレッドプレビュー
  // ==========================================
  const renderBlueskyPreview = () => {
    const isSimulated = skinMode === 'simulated';

    return (
      <div className="flex flex-col h-full space-y-2.5">
        {/* Bluesky 公式風 ブランドヘッダー */}
        {isSimulated ? (
          <div className="bg-[#101721] rounded-2xl border border-[#1e2a38] overflow-hidden shadow-lg shadow-blue-950/20">
            {/* 上部ステータスバー */}
            <div className="px-3.5 py-2 border-b border-[#1e2a38] flex flex-wrap items-center justify-between gap-2 bg-[#121c29]/90 backdrop-blur-sm min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-[#0085ff] flex items-center justify-center text-white shadow-sm shadow-[#0085ff]/40 shrink-0">
                  <BlueskyButterflyLogo className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-white tracking-tight">Bluesky</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-[#0085ff]/20 border border-[#0085ff]/40 text-[#0085ff] text-[9px] font-bold shrink-0">
                      公式UIスキン
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-none mt-0.5 truncate">
                    分散型ソーシャル AT Protocol
                  </p>
                </div>
              </div>

              {/* スペック指標バッジ */}
              <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-mono shrink-0">
                <span className="px-1.5 py-0.5 rounded bg-[#162333] text-sky-300 border border-sky-900/50 whitespace-nowrap">
                  上限300字
                </span>
                <span className="px-1.5 py-0.5 rounded bg-[#162333] text-sky-300 border border-sky-900/50 whitespace-nowrap">
                  画像最大4枚
                </span>
              </div>
            </div>

            {/* 公式タブ風ナビバー */}
            <div className="flex items-center border-b border-[#1e2a38] bg-[#0d141d] text-xs min-w-0">
              <div className="flex-1 text-center py-2 border-b-2 border-[#0085ff] text-white font-bold flex items-center justify-center gap-1.5 min-w-0">
                <span className="truncate">ポストプレビュー</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#0085ff] text-white font-mono shrink-0">
                  {blueskySplits.length}
                </span>
              </div>
              <div className="flex-1 text-center py-2 text-slate-500 font-medium truncate hidden sm:block">
                返信ツリーシミュレーション
              </div>
            </div>

            {/* スレッド本体エリア */}
            <div className={`p-3 sm:p-4 min-w-0 ${isSeparated && blueskySplits.length > 1 ? 'space-y-3' : 'divide-y divide-[#1e2a38]/60'}`}>
              {replySettings?.enabled && replySettings.blueskyResolved && (
                <div className="mb-3 p-2.5 rounded-xl bg-[#0085ff]/10 border border-[#0085ff]/30 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-[#0085ff] font-semibold text-[11px]">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>返信先: @{replySettings.blueskyResolved.authorHandle || replySettings.blueskyResolved.authorName || 'user'} の投稿</span>
                  </div>
                  {replySettings.blueskyResolved.textSnippet && (
                    <p className="text-[11px] text-slate-300 line-clamp-1 italic bg-black/20 p-1.5 rounded">
                      "{replySettings.blueskyResolved.textSnippet}"
                    </p>
                  )}
                </div>
              )}

              {blueskySplits.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  <BlueskyButterflyLogo className="w-8 h-8 mx-auto mb-2 text-slate-700" />
                  テキストを入力、または画像を添付するとBlueskyの投稿画面がプレビューされます
                </div>
              ) : (
                blueskySplits.map((split, idx) => {
                  const isLast = idx === blueskySplits.length - 1;
                  const attachImgs = split.images ?? (split.hasImages ? images.slice(0, 4) : []);
                  const isFocused = focusedSplitIndex === split.index;

                  {/* カード分離表示モード（スライダー 0%〜25%） */}
                  if (isSeparated && blueskySplits.length > 1) {
                    return (
                      <div
                        key={idx}
                        id={`bsky-split-card-${split.index}`}
                        onClick={() => setFocusedSplitIndex(isFocused ? null : split.index)}
                        className={`relative group p-3.5 rounded-xl bg-[#0e1624] border transition-all duration-200 cursor-pointer ${
                          isFocused
                            ? 'border-[#0085ff] ring-2 ring-[#0085ff]/50 bg-[#0e192c] shadow-md shadow-[#0085ff]/10'
                            : 'border-[#1e2a38] hover:border-[#0085ff]/50 shadow-xs'
                        }`}
                      >
                        {/* 独立ポストヘッダー */}
                        <div className="flex items-center justify-between text-[11px] pb-2 mb-2.5 border-b border-[#1e2a38]/80">
                          <div className="flex items-center gap-1.5 font-semibold text-sky-400 font-mono">
                            <GitCommit className="w-3.5 h-3.5 text-[#0085ff]" />
                            <span>ポスト #{split.index} / {split.total}</span>
                            {idx === 0 ? (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-950 text-sky-300 border border-sky-800 font-sans">
                                親ポスト
                              </span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-900 text-slate-300 border border-slate-700 font-sans">
                                返信 #{split.index}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                            <span>{split.charCount}文字 / 300字</span>
                            {attachImgs.length > 0 && (
                              <>
                                <span className="text-slate-600">·</span>
                                <span>{attachImgs.length}メディア</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#0085ff] via-sky-500 to-cyan-300 flex items-center justify-center font-bold text-xs text-white shadow-xs">
                              {blueskyDisplayName.slice(0, 1).toUpperCase()}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="font-bold text-slate-100">{blueskyDisplayName}</span>
                              <span className="text-slate-400 font-mono text-[11px]">@{blueskyHandle}</span>
                            </div>
                            {split.text ? (
                              <p className={`mt-1.5 ${FONT_SIZE_CONFIG[fontSize].textClass} text-slate-100 whitespace-pre-wrap break-words [overflow-wrap:anywhere]`}>
                                {renderRichText(split.text, true)}
                              </p>
                            ) : (
                              <p className="mt-1 text-xs text-slate-400 italic">（画像のみの返信ポスト）</p>
                            )}
                            {attachImgs.length > 0 && (
                              <div className="mt-2 w-full min-w-0">{renderBlueskyImageGrid(attachImgs)}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  {/* 標準ツリー または シームレス密着モード */}
                  return (
                    <div
                      key={idx}
                      id={`bsky-split-item-${split.index}`}
                      onClick={() => setFocusedSplitIndex(isFocused ? null : split.index)}
                      className={`relative group transition-all duration-200 min-w-0 cursor-pointer ${
                        isFocused ? 'bg-[#0085ff]/10 rounded-xl px-2.5 py-2 -mx-2.5 ring-1 ring-[#0085ff]/50' : ''
                      } ${isSeamless && blueskySplits.length > 1 ? 'pt-1.5 pb-2' : 'pt-3 pb-3'} first:pt-0`}
                    >
                      {/* スレッド接続ライン (Blueskyブルーの滑らかな垂直線) */}
                      {!isLast && (
                        <div
                          className={`absolute left-[19px] top-12 bottom-0 z-0 transition-all duration-200 ${
                            isSeamless && blueskySplits.length > 1
                              ? 'w-[3.5px] -ml-[0.75px] bg-gradient-to-b from-[#0085ff] via-cyan-400 to-[#0085ff] shadow-[0_0_10px_rgba(0,133,255,0.7)]'
                              : 'w-[2px] bg-gradient-to-b from-[#0085ff]/70 via-sky-800/40 to-[#0085ff]/30'
                          }`}
                          style={{
                            opacity: connectorOpacity,
                            minHeight: isSeamless && blueskySplits.length > 1 ? '26px' : '38px',
                          }}
                        />
                      )}

                      <div className="relative z-10 flex items-start gap-2.5 sm:gap-3 pb-3 min-w-0">
                        {/* Bluesky風 アバター */}
                        <div className="relative shrink-0">
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-[#0085ff] via-sky-500 to-cyan-300 flex items-center justify-center font-bold text-sm text-white shadow-md ring-2 ring-[#0085ff]/30">
                            {blueskyDisplayName.slice(0, 1).toUpperCase()}
                          </div>
                          {/* スレッド番号 */}
                          {blueskySplits.length > 1 && (
                            <span className="absolute -bottom-1 -right-1 bg-[#0085ff] text-white text-[9px] font-bold px-1.5 rounded-full border-2 border-[#101721] shadow-xs">
                              {split.index}
                            </span>
                          )}
                        </div>

                        {/* コンテンツ本体 */}
                        <div className="flex-1 min-w-0">
                          {/* ユーザーヘッダー */}
                          <div className="flex items-center justify-between gap-1 text-xs min-w-0">
                            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap min-w-0">
                              <span className="font-bold text-slate-100 hover:underline cursor-pointer truncate text-xs sm:text-[13px] max-w-[120px] sm:max-w-[160px]">
                                {blueskyDisplayName}
                              </span>
                              <span className="text-slate-400 hover:underline cursor-pointer truncate text-[11px] sm:text-xs font-mono max-w-[110px] sm:max-w-[140px]">
                                @{blueskyHandle}
                              </span>
                              <span className="text-slate-600 select-none">·</span>
                              <span className="text-slate-400 text-[11px] sm:text-xs shrink-0 select-none">
                                {idx === 0 ? '1分' : `返信 #${split.index}`}
                              </span>
                              {blueskySplits.length > 1 && (
                                <span className="text-[10px] text-sky-400/80 font-mono ml-1">
                                  ({split.charCount}字)
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition cursor-pointer shrink-0"
                              title="メニュー"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </div>

                          {/* 本文 */}
                          {split.text ? (
                            <p
                              className={`mt-1.5 ${FONT_SIZE_CONFIG[fontSize].textClass} text-slate-100 whitespace-pre-wrap break-words [overflow-wrap:anywhere] font-sans selection:bg-[#0085ff]/30`}
                            >
                              {renderRichText(split.text, true)}
                            </p>
                          ) : idx > 0 ? (
                            <p className="mt-1 text-xs text-slate-400 italic">
                              （画像のみの返信ポスト）
                            </p>
                          ) : null}

                          {/* 画像 */}
                          {attachImgs.length > 0 && (
                            <div className="space-y-1 mt-2 min-w-0 w-full">
                              {renderBlueskyImageGrid(attachImgs)}
                              {images.length > 4 && (
                                <div className="flex items-center gap-1 text-[10px] text-sky-400 font-mono pt-1">
                                  <Info className="w-3 h-3 shrink-0" />
                                  <span className="truncate">
                                    Bluesky仕様: 4枚目以降は自動で次のスレッドへ分割添付されます
                                  </span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Bluesky 公式風アクションバー */}
                          <div className="mt-3 flex items-center justify-between text-slate-400 text-xs max-w-sm pt-1 border-t border-[#1e2a38]/40 w-full min-w-0">
                            <button
                              type="button"
                              className="flex items-center gap-1.5 hover:text-[#0085ff] transition group cursor-pointer"
                              title="返信"
                            >
                              <div className="p-1 rounded-full group-hover:bg-[#0085ff]/10 transition">
                                <MessageSquare className="w-4 h-4" />
                              </div>
                              <span className="text-[11px] font-mono">0</span>
                            </button>
                            <button
                              type="button"
                              className="flex items-center gap-1.5 hover:text-emerald-400 transition group cursor-pointer"
                              title="リポスト"
                            >
                              <div className="p-1 rounded-full group-hover:bg-emerald-500/10 transition">
                                <Repeat2 className="w-4 h-4" />
                              </div>
                              <span className="text-[11px] font-mono">0</span>
                            </button>
                            <button
                              type="button"
                              className="flex items-center gap-1.5 hover:text-rose-400 transition group cursor-pointer"
                              title="いいね"
                            >
                              <div className="p-1 rounded-full group-hover:bg-rose-500/10 transition">
                                <Heart className="w-4 h-4" />
                              </div>
                              <span className="text-[11px] font-mono">0</span>
                            </button>
                            <button
                              type="button"
                              className="hover:text-sky-400 p-1 rounded-full hover:bg-sky-500/10 transition cursor-pointer"
                              title="共有"
                            >
                              <Share className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              className="hover:text-amber-400 p-1 rounded-full hover:bg-amber-500/10 transition cursor-pointer"
                              title="ブックマーク"
                            >
                              <Bookmark className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 連結度合い可視化: 次のポストとの結合ジャンクションノード */}
                      {connectionDegree >= 35 && blueskySplits.length > 1 && !isLast && (
                        <div className="relative pl-[36px] sm:pl-[44px] -mt-0.5 mb-2 z-10 pointer-events-none">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono border backdrop-blur-xs transition-all ${
                            isSeamless
                              ? 'bg-[#0085ff]/20 border-[#0085ff]/70 text-sky-200 shadow-sm shadow-[#0085ff]/30 ring-1 ring-[#0085ff]/40'
                              : 'bg-slate-900/95 border-slate-700/80 text-slate-300'
                          }`}>
                            <Link2 className={`w-3 h-3 text-[#0085ff] ${isSeamless ? 'animate-pulse' : ''}`} />
                            <span className="font-semibold">#{split.index} ➔ #{split.index + 1} 連結点</span>
                            <span className="text-slate-500">·</span>
                            <span className="text-slate-300 font-sans">{split.charCount}字で分割</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* 標準（コンパクト）スキン表示 */
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#0085ff]/10 rounded-lg border border-[#0085ff]/20">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-md bg-[#0085ff] flex items-center justify-center font-bold text-[10px] text-white shadow-sm">
                  🦋
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-100">Bluesky ポスト</span>
                  <span className="text-[10px] text-sky-400 ml-1 font-normal">
                    {blueskySplits.length} 件
                  </span>
                </div>
              </div>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
                300字上限
              </span>
            </div>

            <div className={`relative bg-slate-950/70 rounded-xl border border-slate-800/80 p-2.5 sm:p-3 overflow-hidden ${isSeparated && blueskySplits.length > 1 ? 'space-y-2.5' : 'space-y-0'}`}>
              {blueskySplits.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  テキストを入力するとプレビューが表示されます
                </div>
              ) : (
                blueskySplits.map((split, idx) => {
                  const isFocused = focusedSplitIndex === split.index;

                  if (isSeparated && blueskySplits.length > 1) {
                    return (
                      <div
                        key={idx}
                        onClick={() => setFocusedSplitIndex(isFocused ? null : split.index)}
                        className={`p-2.5 rounded-lg bg-slate-900 border transition cursor-pointer ${
                          isFocused ? 'border-[#0085ff] ring-1 ring-[#0085ff]' : 'border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono text-sky-400 pb-1.5 mb-1.5 border-b border-slate-800">
                          <span className="font-bold">ポスト #{split.index} / {split.total}</span>
                          <span className="text-slate-400">{split.charCount}文字</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#0085ff] flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {blueskyDisplayName[0]?.toUpperCase() || 'B'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 text-xs">
                              <span className="font-bold text-slate-100">{blueskyDisplayName}</span>
                              <span className="text-slate-500 text-[10px]">@{blueskyHandle}</span>
                            </div>
                            <p className={`mt-0.5 ${FONT_SIZE_CONFIG[fontSize].textClass} text-slate-100 whitespace-pre-wrap break-words [overflow-wrap:anywhere]`}>
                              {renderRichText(split.text, true)}
                            </p>
                            {split.images && renderBlueskyImageGrid(split.images)}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idx}
                      onClick={() => setFocusedSplitIndex(isFocused ? null : split.index)}
                      className={`relative flex items-start gap-2.5 py-2 border-b border-slate-800/40 last:border-b-0 cursor-pointer ${
                        isFocused ? 'bg-sky-500/10 rounded px-1' : ''
                      }`}
                    >
                      <div className="w-7 h-7 rounded-full bg-[#0085ff] flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {blueskyDisplayName[0]?.toUpperCase() || 'B'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 text-xs min-w-0">
                          <span className="font-bold text-slate-100 truncate">{blueskyDisplayName}</span>
                          <span className="text-slate-500 text-[10px] truncate">@{blueskyHandle}</span>
                          {blueskySplits.length > 1 && (
                            <span className="text-[10px] text-sky-400/80 font-mono ml-1">
                              (#{split.index} · {split.charCount}字)
                            </span>
                          )}
                        </div>
                        <p className={`mt-0.5 ${FONT_SIZE_CONFIG[fontSize].textClass} text-slate-100 whitespace-pre-wrap break-words [overflow-wrap:anywhere]`}>
                          {renderRichText(split.text, true)}
                        </p>
                        {split.images && renderBlueskyImageGrid(split.images)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ==========================================
  // Threads スレッドプレビュー
  // ==========================================
  const renderThreadsPreview = () => {
    const isSimulated = skinMode === 'simulated';

    return (
      <div className="flex flex-col h-full space-y-2.5">
        {/* Threads 公式風 ブランドヘッダー */}
        {isSimulated ? (
          <div className="bg-[#000000] rounded-2xl border border-neutral-800 overflow-hidden shadow-lg shadow-purple-950/10">
            {/* 上部ステータスバー */}
            <div className="px-3.5 py-2 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-2 bg-[#080808]/95 backdrop-blur-sm min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-lg bg-neutral-900 border border-neutral-700 flex items-center justify-center text-white shadow-sm shrink-0">
                  <ThreadsSpiralLogo className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-white tracking-tight">Threads</span>
                    <span className="px-1.5 py-0.2 rounded-full bg-purple-950/80 border border-purple-800/80 text-purple-300 text-[9px] font-bold shrink-0">
                      公式UIスキン
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-400 leading-none mt-0.5 truncate">
                    Instagram ソーシャルグラフ連携
                  </p>
                </div>
              </div>

              {/* スペック指標バッジ */}
              <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-mono shrink-0">
                {threadsTopic && threadsTopic.trim() && (
                  <span
                    className="px-2 py-0.5 rounded-full bg-purple-950/90 text-purple-300 border border-purple-700 font-sans font-medium flex items-center gap-1 shadow-xs max-w-[130px]"
                    title={`Threads設定中トピック: #${threadsTopic.trim().replace(/^#/, '')}`}
                  >
                    <span className="text-purple-400 font-bold shrink-0">#</span>
                    <span className="truncate">{threadsTopic.trim().replace(/^#/, '')}</span>
                  </span>
                )}
                <span className="px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-300 border border-neutral-700 whitespace-nowrap">
                  上限500字
                </span>
                <span className="px-1.5 py-0.5 rounded bg-neutral-900 text-purple-300 border border-neutral-700 whitespace-nowrap">
                  カルーセル最大20枚
                </span>
              </div>
            </div>

            {/* 公式風ナビバー */}
            <div className="flex items-center border-b border-neutral-800/80 bg-[#000000] text-xs min-w-0">
              <div className="flex-1 text-center py-2 border-b-2 border-white text-white font-bold flex items-center justify-center gap-1.5 min-w-0">
                <span className="truncate">スレッドプレビュー</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-neutral-800 text-white font-mono shrink-0">
                  {threadsSplits.length}
                </span>
                {threadsTopic && threadsTopic.trim() && (
                  <span className="text-[10px] text-purple-400 font-normal truncate max-w-[100px] hidden sm:inline">
                    (#{threadsTopic.trim().replace(/^#/, '')})
                  </span>
                )}
              </div>
              <div className="flex-1 text-center py-2 text-neutral-500 font-medium truncate hidden sm:block">
                フォロー中フィード表示
              </div>
            </div>

            {/* スレッド本体エリア */}
            <div className={`p-3 sm:p-4 min-w-0 ${isSeparated && threadsSplits.length > 1 ? 'space-y-3' : 'divide-y divide-neutral-800/60'}`}>
              {replySettings?.enabled && replySettings.threadsResolved && (
                <div className={`mb-3 p-2.5 rounded-xl border text-xs space-y-1 ${
                  replySettings.threadsResolved.isOwnerMatch
                    ? 'bg-purple-950/20 border-purple-800/40 text-purple-200'
                    : 'bg-rose-950/20 border-rose-800/40 text-rose-200'
                }`}>
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                      <span>返信先: {replySettings.threadsResolved.isOwnerMatch ? 'あなたの投稿' : `@${replySettings.threadsResolved.authorName} の投稿`}</span>
                    </div>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                      replySettings.threadsResolved.isOwnerMatch ? 'bg-emerald-900/60 text-emerald-300' : 'bg-rose-900/60 text-rose-300'
                    }`}>
                      {replySettings.threadsResolved.isOwnerMatch ? '本人確認済' : '他者投稿（返信不可）'}
                    </span>
                  </div>
                  {replySettings.threadsResolved.textSnippet && (
                    <p className="text-[11px] text-slate-300 line-clamp-1 italic bg-black/20 p-1.5 rounded">
                      "{replySettings.threadsResolved.textSnippet}"
                    </p>
                  )}
                </div>
              )}

              {threadsSplits.length === 0 ? (
                <div className="py-12 text-center text-neutral-500 text-xs">
                  <ThreadsSpiralLogo className="w-8 h-8 mx-auto mb-2 text-neutral-700" />
                  テキストを入力、または画像を添付するとThreadsの投稿画面がプレビューされます
                </div>
              ) : (
                threadsSplits.map((split, idx) => {
                  const isLast = idx === threadsSplits.length - 1;
                  const attachImgs = split.hasImages ? images : [];
                  const isFocused = focusedSplitIndex === split.index;

                  {/* カード分離表示モード（スライダー 0%〜25%） */}
                  if (isSeparated && threadsSplits.length > 1) {
                    return (
                      <div
                        key={idx}
                        id={`threads-split-card-${split.index}`}
                        onClick={() => setFocusedSplitIndex(isFocused ? null : split.index)}
                        className={`relative group p-3.5 rounded-xl bg-neutral-900/90 border transition-all duration-200 cursor-pointer ${
                          isFocused
                            ? 'border-purple-500 ring-2 ring-purple-500/50 bg-neutral-900 shadow-md shadow-purple-950/30'
                            : 'border-neutral-800 hover:border-purple-500/50 shadow-xs'
                        }`}
                      >
                        {/* 独立ポストヘッダー */}
                        <div className="flex items-center justify-between text-[11px] pb-2 mb-2.5 border-b border-neutral-800">
                          <div className="flex items-center gap-1.5 font-semibold text-purple-400 font-mono">
                            <GitCommit className="w-3.5 h-3.5 text-purple-400" />
                            <span>スレッド #{split.index} / {split.total}</span>
                            {idx === 0 ? (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-800 font-sans">
                                親ポスト
                              </span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-950 text-neutral-300 border border-neutral-700 font-sans">
                                返信 #{split.index}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-400">
                            <span>{split.charCount}文字 / 500字</span>
                            {attachImgs.length > 0 && (
                              <>
                                <span className="text-neutral-600">·</span>
                                <span>{attachImgs.length}メディア</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5 sm:gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-700 via-pink-600 to-amber-500 p-0.5 shadow-xs">
                              <div className="w-full h-full rounded-full bg-black flex items-center justify-center font-bold text-xs text-white">
                                {threadsUsername.slice(0, 1).toUpperCase()}
                              </div>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 text-xs">
                              <span className="font-bold text-white">{threadsUsername}</span>
                              <BadgeCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            </div>
                            {split.text ? (
                              <p className={`mt-1.5 ${FONT_SIZE_CONFIG[fontSize].textClass} text-neutral-100 whitespace-pre-wrap break-words [overflow-wrap:anywhere]`}>
                                {renderRichText(split.text, false)}
                              </p>
                            ) : null}
                            {attachImgs.length > 0 && renderThreadsImageGrid(attachImgs)}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  {/* 標準ツリー または シームレス密着モード */}
                  return (
                    <div
                      key={idx}
                      id={`threads-split-item-${split.index}`}
                      onClick={() => setFocusedSplitIndex(isFocused ? null : split.index)}
                      className={`relative group transition-all duration-200 min-w-0 cursor-pointer ${
                        isFocused ? 'bg-purple-950/20 rounded-xl px-2.5 py-2 -mx-2.5 ring-1 ring-purple-500/50' : ''
                      } ${isSeamless && threadsSplits.length > 1 ? 'pt-1.5 pb-2' : 'pt-3 pb-3'} first:pt-0`}
                    >
                      {/* Threads特有の垂直コネクター線 */}
                      {!isLast && (
                        <div
                          className={`absolute left-[19px] top-12 bottom-0 z-0 transition-all duration-200 ${
                            isSeamless && threadsSplits.length > 1
                              ? 'w-[3px] -ml-[0.75px] bg-gradient-to-b from-purple-500 via-pink-400 to-purple-600 shadow-[0_0_10px_rgba(168,85,247,0.7)]'
                              : 'w-[1.5px] bg-neutral-700'
                          }`}
                          style={{
                            opacity: connectorOpacity,
                            minHeight: isSeamless && threadsSplits.length > 1 ? '26px' : '38px',
                          }}
                        />
                      )}

                      <div className="relative z-10 flex items-start gap-2.5 sm:gap-3 pb-3 min-w-0">
                        {/* Threads風 アバター (+フォローボタン付き) */}
                        <div className="relative shrink-0">
                          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-purple-700 via-pink-600 to-amber-500 p-0.5 shadow-md">
                            <div className="w-full h-full rounded-full bg-black flex items-center justify-center font-bold text-sm text-white">
                              {threadsUsername.slice(0, 1).toUpperCase()}
                            </div>
                          </div>
                          {/* Threads公式風の「+」追加アイコンバッジ */}
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white text-black flex items-center justify-center font-bold shadow-sm border-2 border-black">
                            <Plus className="w-2.5 h-2.5" />
                          </div>
                        </div>

                        {/* コンテンツ本体 */}
                        <div className="flex-1 min-w-0">
                          {/* ユーザーヘッダー（アバター横・最上部） */}
                          <div className="flex items-center justify-between gap-1 text-xs min-w-0">
                            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap min-w-0">
                              <span className="font-bold text-white hover:underline cursor-pointer text-xs sm:text-[13px] tracking-tight truncate max-w-[120px] sm:max-w-[160px]">
                                {threadsUsername}
                              </span>
                              <BadgeCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                              <span className="text-neutral-600 select-none">·</span>
                              <span className="text-neutral-400 text-[11px] sm:text-xs select-none shrink-0">
                                {idx === 0 ? '2分' : `スレッド #${split.index}`}
                              </span>
                              {threadsSplits.length > 1 && (
                                <span className="text-[10px] text-purple-400/80 font-mono ml-1">
                                  ({split.charCount}字)
                                </span>
                              )}

                              {/* 投稿ヘッダー内：Threads公式トピックタグ（インラインバッジ） */}
                              {cleanedThreadsTopic && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const el = document.getElementById('threads-topic-input');
                                    if (el) {
                                      el.focus();
                                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-900/90 hover:bg-neutral-800 text-[#0095F6] hover:text-sky-300 border border-neutral-700/80 hover:border-[#0095F6]/60 text-[11px] font-semibold transition cursor-pointer shadow-xs group max-w-[160px] sm:max-w-[200px]"
                                  title={`Threads公式トピック: #${cleanedThreadsTopic}（クリックしてトピックを編集）`}
                                >
                                  <span className="text-[#0095F6] font-bold shrink-0">#</span>
                                  <span className="truncate">{cleanedThreadsTopic}</span>
                                  {idx === 0 && (
                                    <span className="text-[9px] text-neutral-400 group-hover:text-neutral-300 font-mono hidden xs:inline shrink-0">
                                      トピック
                                    </span>
                                  )}
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                className="text-neutral-400 hover:text-white p-1 rounded-full hover:bg-neutral-800 transition cursor-pointer"
                                title="メニュー"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* 本文 */}
                          {split.text ? (
                            <p
                              className={`mt-1.5 ${FONT_SIZE_CONFIG[fontSize].textClass} text-neutral-100 whitespace-pre-wrap break-words [overflow-wrap:anywhere] font-sans selection:bg-purple-900/50`}
                            >
                              {renderRichText(split.text, false)}
                            </p>
                          ) : null}

                          {/* 画像（Threadsカルーセル風） */}
                          {attachImgs.length > 0 && renderThreadsImageGrid(attachImgs)}

                          {/* Threads 公式風アクションバー */}
                          <div className="mt-3 flex items-center gap-3 sm:gap-4 text-neutral-300 text-xs pt-1 border-t border-neutral-800/40 w-full min-w-0">
                            <button
                              type="button"
                              className="hover:text-rose-500 transition p-1 rounded-full hover:bg-rose-950/20 cursor-pointer"
                              title="いいね"
                            >
                              <Heart className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              className="hover:text-purple-400 transition p-1 rounded-full hover:bg-purple-950/20 cursor-pointer"
                              title="コメント"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              className="hover:text-emerald-400 transition p-1 rounded-full hover:bg-emerald-950/20 cursor-pointer"
                              title="再投稿"
                            >
                              <Repeat2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              className="hover:text-white transition p-1 rounded-full hover:bg-neutral-800 cursor-pointer"
                              title="シェア"
                            >
                              <Send className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* 連結度合い可視化: 次のポストとの結合ジャンクションノード */}
                      {connectionDegree >= 35 && threadsSplits.length > 1 && !isLast && (
                        <div className="relative pl-[36px] sm:pl-[44px] -mt-0.5 mb-2 z-10 pointer-events-none">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono border backdrop-blur-xs transition-all ${
                            isSeamless
                              ? 'bg-purple-950/50 border-purple-500/70 text-purple-200 shadow-sm shadow-purple-950/40 ring-1 ring-purple-500/40'
                              : 'bg-neutral-900/95 border-neutral-700/80 text-neutral-300'
                          }`}>
                            <Link2 className={`w-3 h-3 text-purple-400 ${isSeamless ? 'animate-pulse' : ''}`} />
                            <span className="font-semibold">#{split.index} ➔ #{split.index + 1} 連結点</span>
                            <span className="text-neutral-500">·</span>
                            <span className="text-neutral-300 font-sans">{split.charCount}字で分割</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          /* 標準（コンパクト）スキン表示 */
          <div className="flex flex-col space-y-2">
            <div className="flex items-center justify-between px-2.5 py-1.5 bg-purple-950/20 rounded-lg border border-purple-800/30">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center font-bold text-[10px] text-white shadow-sm">
                  🌀
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-100">Threads スレッド</span>
                  <span className="text-[10px] text-purple-400 ml-1 font-normal">
                    {threadsSplits.length} 件
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {threadsTopic && threadsTopic.trim() && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-900/60 border border-purple-700/60 text-purple-300 text-[10px] font-medium shadow-xs"
                    title={`設定中のThreadsトピック: #${threadsTopic.trim().replace(/^#/, '')}`}
                  >
                    <span className="text-purple-400 font-bold">#</span>
                    <span className="truncate max-w-[100px]">{threadsTopic.trim().replace(/^#/, '')}</span>
                  </span>
                )}
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
                  500字上限
                </span>
              </div>
            </div>

            <div className={`relative bg-slate-950/70 rounded-xl border border-slate-800/80 p-2.5 sm:p-3 overflow-hidden ${isSeparated && threadsSplits.length > 1 ? 'space-y-2.5' : 'space-y-0'}`}>
              {threadsSplits.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  テキストを入力するとプレビューが表示されます
                </div>
              ) : (
                threadsSplits.map((split, idx) => {
                  const isFocused = focusedSplitIndex === split.index;

                  if (isSeparated && threadsSplits.length > 1) {
                    return (
                      <div
                        key={idx}
                        onClick={() => setFocusedSplitIndex(isFocused ? null : split.index)}
                        className={`p-2.5 rounded-lg bg-neutral-900 border transition cursor-pointer ${
                          isFocused ? 'border-purple-500 ring-1 ring-purple-500' : 'border-neutral-800'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] font-mono text-purple-400 pb-1.5 mb-1.5 border-b border-neutral-800">
                          <span className="font-bold">スレッド #{split.index} / {split.total}</span>
                          <span className="text-neutral-400">{split.charCount}文字</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <div className="w-6 h-6 rounded-full bg-purple-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {threadsUsername[0]?.toUpperCase() || 'T'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 text-xs">
                              <span className="font-bold text-slate-100">{threadsUsername}</span>
                              <BadgeCheck className="w-3 h-3 text-purple-400 shrink-0" />
                            </div>
                            <p className={`mt-0.5 ${FONT_SIZE_CONFIG[fontSize].textClass} text-slate-100 whitespace-pre-wrap break-words [overflow-wrap:anywhere]`}>
                              {renderRichText(split.text, false)}
                            </p>
                            {split.hasImages && renderThreadsImageGrid(images)}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idx}
                      onClick={() => setFocusedSplitIndex(isFocused ? null : split.index)}
                      className={`relative flex items-start gap-2.5 py-2 border-b border-slate-800/40 last:border-b-0 cursor-pointer ${
                        isFocused ? 'bg-purple-950/30 rounded px-1' : ''
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div className="w-7 h-7 rounded-full bg-purple-700 flex items-center justify-center text-white text-xs font-bold">
                          {threadsUsername[0]?.toUpperCase() || 'T'}
                        </div>
                        {threadsSplits.length > 1 && (
                          <span className="absolute -bottom-1 -right-1 bg-neutral-900 text-purple-300 text-[8px] font-mono font-bold px-1 rounded-full border border-purple-600/40">
                            #{split.index}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-xs min-w-0">
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="font-bold text-slate-100 truncate">{threadsUsername}</span>
                            <BadgeCheck className="w-3 h-3 text-purple-400 shrink-0" />
                            {threadsSplits.length > 1 && (
                              <span className="text-[10px] text-slate-500 font-mono ml-1 shrink-0">
                                (#{split.index} · {split.charCount}字)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Threads専用トピックタグ表示 (標準スキン) */}
                        {threadsTopic && threadsTopic.trim() && (
                          <div className="mt-1 mb-1 flex items-center gap-1.5 min-w-0">
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-950/80 hover:bg-purple-900/60 text-purple-300 border border-purple-800/60 text-[10px] font-semibold transition cursor-pointer shadow-xs max-w-full"
                              title={`Threadsトピックタグ: #${threadsTopic.trim().replace(/^#/, '')}`}
                            >
                              <span className="text-purple-400 font-bold shrink-0">#</span>
                              <span className="truncate">{threadsTopic.trim().replace(/^#/, '')}</span>
                              <span className="text-[8px] text-purple-400/80 ml-0.5 font-mono shrink-0">
                                トピック
                              </span>
                            </span>
                          </div>
                        )}

                        <p className={`mt-0.5 ${FONT_SIZE_CONFIG[fontSize].textClass} text-slate-100 whitespace-pre-wrap break-words [overflow-wrap:anywhere]`}>
                          {renderRichText(split.text, false)}
                        </p>
                        {split.hasImages && renderThreadsImageGrid(images)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div id="thread-preview-container" className="space-y-3 w-full min-w-0 flex-1 flex flex-col h-full">
      {/* プレビューヘッダーバー: 公式スキン切り替え・文字サイズ・仕様比較 */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pb-0.5 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Eye className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <h3 className="text-xs font-bold text-slate-200 truncate">プレビュー</h3>

          {/* 現在の投稿先表示インジケーター */}
          <div className="flex items-center gap-1">
            {effectiveShowBluesky && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-[#0085ff]/15 text-[#0085ff] border border-[#0085ff]/30 font-bold flex items-center gap-1 shrink-0">
                <BlueskyButterflyLogo className="w-2.5 h-2.5" />
                <span>Bluesky ({blueskySplits.length})</span>
                {hasBlueskyReply && (
                  <span className="text-[9px] bg-sky-500/25 px-1 py-0.2 rounded text-sky-300 border border-sky-400/30">
                    返信先設定中
                  </span>
                )}
              </span>
            )}
            {effectiveShowThreads && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-purple-950/80 text-purple-300 border border-purple-800/50 font-bold flex items-center gap-1 shrink-0">
                <ThreadsSpiralLogo className="w-2.5 h-2.5" />
                <span>Threads ({threadsSplits.length})</span>
                {hasThreadsReply && (
                  <span className="text-[9px] bg-purple-500/25 px-1 py-0.2 rounded text-purple-300 border border-purple-400/30">
                    返信先設定中
                  </span>
                )}
              </span>
            )}
          </div>

          {/* 仕様比較クイックガイド トグル */}
          <button
            type="button"
            onClick={() => setShowDiffGuide(!showDiffGuide)}
            className={`text-[10px] px-1.5 py-0.2 rounded-md border transition flex items-center gap-1 cursor-pointer shrink-0 ${
              showDiffGuide
                ? 'bg-sky-500/20 text-sky-300 border-sky-400/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
            title="BlueskyとThreadsの仕様差異ガイド"
          >
            <Info className="w-2.5 h-2.5 shrink-0" />
            <span>仕様比較</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* プレビュー画面スタイル切替: 公式UIスキン vs 標準画面 */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs font-semibold shadow-xs">
            <button
              id="preview-skin-simulated-btn"
              type="button"
              onClick={() => handleSkinModeChange('simulated')}
              className={`px-2 py-1 rounded-md transition cursor-pointer flex items-center gap-1.5 text-xs ${
                skinMode === 'simulated'
                  ? 'bg-gradient-to-r from-[#0085ff]/30 to-purple-900/40 text-sky-200 border border-sky-500/40 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="公式UIスキンプレビュー（公式アプリ風デザイン）"
            >
              <Smartphone className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>公式UIスキン</span>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${skinMode === 'simulated' ? 'bg-sky-400 animate-pulse' : 'bg-slate-600'}`} />
            </button>
            <button
              id="preview-skin-standard-btn"
              type="button"
              onClick={() => handleSkinModeChange('standard')}
              className={`px-2 py-1 rounded-md transition cursor-pointer flex items-center gap-1.5 text-xs ${
                skinMode === 'standard'
                  ? 'bg-slate-800 text-slate-100 border border-slate-700 font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="シンプルな標準プレビュー画面"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>標準画面</span>
            </button>
          </div>

          {/* 文字の大きさ切り替え (大, 中, 小) */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs font-semibold">
            <span className="text-[10px] text-slate-400 px-1 sm:px-1.5 flex items-center gap-1 select-none">
              <Type className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="hidden sm:inline">文字</span>
            </span>
            {(['sm', 'md', 'lg'] as PreviewFontSize[]).map((size) => (
              <button
                key={size}
                id={`preview-font-size-${size}-btn`}
                type="button"
                onClick={() => handleFontSizeChange(size)}
                className={`px-1.5 sm:px-2 py-0.5 rounded-md transition cursor-pointer text-xs ${
                  fontSize === size
                    ? 'bg-slate-800 text-sky-200 border border-slate-700 shadow-sm font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={`プレビュー文字サイズ: ${FONT_SIZE_CONFIG[size].label}`}
              >
                {FONT_SIZE_CONFIG[size].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* プラットフォーム仕様差異ガイド (折りたたみ表示) */}
      {showDiffGuide && (
        <div className="bg-[#0B101B] border border-sky-900/40 rounded-xl p-3 text-xs space-y-2 animate-in fade-in duration-150 w-full min-w-0">
          <div className="flex items-center justify-between text-slate-300 font-bold">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>Bluesky と Threads の視覚的・機能的差異</span>
            </span>
            <button
              type="button"
              onClick={() => setShowDiffGuide(false)}
              className="text-slate-500 hover:text-white text-xs cursor-pointer"
            >
              ✕ 閉じる
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px] pt-1">
            <div className="p-2.5 rounded-lg bg-[#101721] border border-[#1e2a38] space-y-1">
              <div className="flex items-center gap-1.5 text-[#0085ff] font-bold">
                <BlueskyButterflyLogo className="w-3.5 h-3.5" />
                <span>Blueskyの特徴</span>
              </div>
              <ul className="text-slate-300 space-y-0.5 pl-3 list-disc">
                <li>1ポスト最大 <strong className="text-white">300文字</strong>（超過分は自動ツリー化）</li>
                <li>画像は1ポスト最大 <strong className="text-white">4枚グリッド</strong>（5枚目以降は返信ツリーへ分割）</li>
                <li>画像ごとに <strong className="text-white">ALT属性（代替テキスト）</strong> を設定可能</li>
              </ul>
            </div>
            <div className="p-2.5 rounded-lg bg-[#050505] border border-neutral-800 space-y-1">
              <div className="flex items-center gap-1.5 text-purple-400 font-bold">
                <ThreadsSpiralLogo className="w-3.5 h-3.5" />
                <span>Threadsの特徴</span>
              </div>
              <ul className="text-neutral-300 space-y-0.5 pl-3 list-disc">
                <li>1投稿最大 <strong className="text-white">500文字</strong>（長文をゆったり掲載可能）</li>
                <li>画像は最大 <strong className="text-white">20枚カルーセル</strong>（横スワイプ表示）</li>
                <li>公式の <strong className="text-white">トピックタグ（#）</strong> を1投稿につき1つ設定可能</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ツリー形式（分割ポスト）の連結具合を可視化・調整するスライダーパネル（折りたたみ可能） */}
      {hasSplitPosts && (
        <div
          id="thread-connection-visualizer-bar"
          className="rounded-xl bg-gradient-to-r from-slate-900/95 via-[#0e1626]/95 to-purple-950/40 border border-slate-700/80 shadow-md shadow-black/40 overflow-hidden transition-all duration-200 animate-in fade-in"
        >
          {/* ヘッダーバー（クリックで折りたたみ／展開をトグル） */}
          <div
            onClick={handleToggleVisualizerCollapse}
            className="p-2.5 sm:p-3 flex items-center justify-between gap-2.5 cursor-pointer hover:bg-slate-800/35 transition select-none"
            title={isVisualizerCollapsed ? 'クリックしてツリー連結ビジュアライザーを展開' : 'クリックしてツリー連結ビジュアライザーを折りたたむ'}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400 shrink-0 shadow-xs">
                <Network className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-bold text-white tracking-tight">
                  ツリー連結ビジュアライザー
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border transition-colors ${
                  isSeparated
                    ? 'bg-amber-950/60 text-amber-300 border-amber-600/50'
                    : isSeamless
                    ? 'bg-sky-950/60 text-sky-300 border-sky-500/50 ring-1 ring-sky-500/30'
                    : 'bg-slate-800 text-slate-200 border-slate-700'
                }`}>
                  連結度: {connectionDegree}%
                </span>
                <span className="text-[11px] text-slate-400 hidden xs:inline">
                  {isSeparated ? '【独立カード】' : isSeamless ? '【シームレス密着】' : '【標準ツリー】'}
                </span>
                {isVisualizerCollapsed && (
                  <span className="text-[10px] text-slate-400 font-mono hidden sm:inline ml-1">
                    ({effectiveShowBluesky && blueskySplits.length > 1 ? `🦋 ${blueskySplits.length}件` : ''}
                    {effectiveShowBluesky && effectiveShowThreads && blueskySplits.length > 1 && threadsSplits.length > 1 ? ' · ' : ''}
                    {effectiveShowThreads && threadsSplits.length > 1 ? `🌀 ${threadsSplits.length}件` : ''})
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleVisualizerCollapse();
                }}
                className="px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                title={isVisualizerCollapsed ? 'ビジュアライザーを展開' : 'ビジュアライザーを折りたたむ'}
                aria-label={isVisualizerCollapsed ? 'ビジュアライザーを展開' : 'ビジュアライザーを折りたたむ'}
              >
                <span className="text-[11px] hidden sm:inline">{isVisualizerCollapsed ? '展開' : '折りたたむ'}</span>
                {isVisualizerCollapsed ? (
                  <ChevronDown className="w-3.5 h-3.5 text-sky-400" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>
            </div>
          </div>

          {/* 展開時コンテンツ（スライダー・プリセット・ナビゲーター） */}
          {!isVisualizerCollapsed && (
            <div className="px-3 pb-3 sm:px-3.5 sm:pb-3.5 border-t border-slate-800/80 pt-2.5 space-y-2.5 animate-in fade-in duration-150">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <p className="text-[11px] text-slate-400 truncate max-w-full sm:max-w-md">
                  {isSeparated
                    ? '各ポストを独立したカード枠で表示し、単体ごとの見た目や文字数を確認できます'
                    : isSeamless
                    ? 'ポスト間を密着させ、光彩連結ラインと分割ジャンクションノードで連続性を可視化します'
                    : '公式SNSアプリに準拠したバランスの良い返信ツリー形式で表示しています'}
                </p>

                {/* クイックプリセット切り替えボタン */}
                <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-xs font-semibold shrink-0">
                  <button
                    type="button"
                    onClick={() => handleConnectionDegreeChange(0)}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1.5 text-xs ${
                      isSeparated
                        ? 'bg-slate-800 text-amber-300 border border-slate-700 font-bold shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="分離モード (0%): 各ポストを独立カードとして個別確認"
                  >
                    <Unlink className="w-3.5 h-3.5 text-amber-400" />
                    <span>分離 (0%)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConnectionDegreeChange(50)}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1.5 text-xs ${
                      isStandard
                        ? 'bg-slate-800 text-sky-300 border border-slate-700 font-bold shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="標準モード (50%): 通常のSNSツリー表示"
                  >
                    <GitCommit className="w-3.5 h-3.5 text-sky-400" />
                    <span>標準 (50%)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConnectionDegreeChange(100)}
                    className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1.5 text-xs ${
                      isSeamless
                        ? 'bg-gradient-to-r from-sky-600 to-purple-600 text-white font-bold shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="密着モード (100%): 光彩連結線と分割ジャンクションを強調したシームレス表示"
                  >
                    <Link2 className="w-3.5 h-3.5 text-white" />
                    <span>密着 (100%)</span>
                  </button>
                </div>
              </div>

              {/* スライダー本体 */}
              <div className="flex items-center gap-3 pt-1">
                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono shrink-0 select-none">
                  <Unlink className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden xs:inline">分離 (0%)</span>
                </div>

                <div className="relative flex-1 flex items-center">
                  <input
                    id="thread-connection-degree-slider"
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={connectionDegree}
                    onChange={(e) => handleConnectionDegreeChange(Number(e.target.value))}
                    className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400 focus:outline-hidden focus:ring-1 focus:ring-sky-400 shadow-inner"
                    aria-label="スレッド各ポストの連結度合いスライダー"
                    style={{
                      background: `linear-gradient(to right, #0284c7 0%, #38bdf8 ${connectionDegree}%, #1e293b ${connectionDegree}%, #1e293b 100%)`,
                    }}
                  />
                </div>

                <div className="flex items-center gap-1 text-[11px] text-sky-400 font-mono shrink-0 select-none font-semibold">
                  <span className="hidden xs:inline">密着 (100%)</span>
                  <Link2 className="w-3.5 h-3.5 text-sky-400" />
                </div>
              </div>

              {/* スレッド分割ポスト ナビゲーション・インスペクター */}
              <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="text-slate-400 font-semibold select-none flex items-center gap-1 shrink-0 text-[11px]">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>分割ポスト一覧:</span>
                  </span>

                  {effectiveShowBluesky && blueskySplits.length > 1 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-sky-400 font-bold font-mono text-[11px]">🦋 Bluesky ({blueskySplits.length}):</span>
                      {blueskySplits.map((s) => (
                        <button
                          key={s.index}
                          type="button"
                          onClick={() => setFocusedSplitIndex(focusedSplitIndex === s.index ? null : s.index)}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer flex items-center gap-1 ${
                            focusedSplitIndex === s.index
                              ? 'bg-[#0085ff] text-white font-bold ring-2 ring-sky-300 shadow-xs'
                              : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700/80'
                          }`}
                          title={`クリックしてポスト #${s.index} をプレビュー内でハイライト`}
                        >
                          <span>#{s.index}</span>
                          <span className="text-[10px] text-slate-400 font-sans">({s.charCount}字)</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {effectiveShowThreads && threadsSplits.length > 1 && (
                    <div className="flex items-center gap-1 flex-wrap ml-1">
                      <span className="text-purple-400 font-bold font-mono text-[11px]">🌀 Threads ({threadsSplits.length}):</span>
                      {threadsSplits.map((s) => (
                        <button
                          key={s.index}
                          type="button"
                          onClick={() => setFocusedSplitIndex(focusedSplitIndex === s.index ? null : s.index)}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer flex items-center gap-1 ${
                            focusedSplitIndex === s.index
                              ? 'bg-purple-600 text-white font-bold ring-2 ring-purple-300 shadow-xs'
                              : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700/80'
                          }`}
                          title={`クリックしてスレッド #${s.index} をプレビュー内でハイライト`}
                        >
                          <span>#{s.index}</span>
                          <span className="text-[10px] text-slate-400 font-sans">({s.charCount}字)</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {focusedSplitIndex !== null && (
                  <button
                    type="button"
                    onClick={() => setFocusedSplitIndex(null)}
                    className="text-[11px] text-slate-400 hover:text-white underline cursor-pointer shrink-0 ml-auto"
                  >
                    ハイライト解除
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* プレビュー本体グリッド: 両方選択時は左右2列表示、片方選択時（またはリプライ先指定時）は全幅表示 */}
      {!effectiveShowBluesky && !effectiveShowThreads ? (
        <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-xl p-8 text-center">
          <p className="text-xs text-slate-400">
            👈 左画面の「投稿先」（🦋 Bluesky または 🌀 Threads）を選択すると、ここにリアルタイムプレビューが表示されます。
          </p>
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 ${
            effectiveShowBluesky && effectiveShowThreads ? 'md:grid-cols-2' : 'grid-cols-1'
          } gap-3 sm:gap-4 items-stretch w-full min-w-0 flex-1`}
        >
          {effectiveShowBluesky && (
            <div className="w-full min-w-0 flex flex-col h-full animate-in fade-in duration-150">
              {renderBlueskyPreview()}
            </div>
          )}

          {effectiveShowThreads && (
            <div className="w-full min-w-0 flex flex-col h-full animate-in fade-in duration-150">
              {renderThreadsPreview()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
