import React, { useState } from 'react';
import { SplitThreadItem, AttachedImage, ApiCredentials, ReplyTarget } from '../types';
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
} from 'lucide-react';

interface ThreadPreviewProps {
  blueskySplits: SplitThreadItem[];
  threadsSplits: SplitThreadItem[];
  threadsTopic?: string;
  images: AttachedImage[];
  postToBluesky: boolean;
  postToThreads: boolean;
  credentials?: ApiCredentials;
  replyTarget?: ReplyTarget;
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
  replyTarget,
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

  // プレビュー内の動画同時デコード負荷・フリーズ防止のためのアクティブ動画ID
  const [activePlayingVideoId, setActivePlayingVideoId] = useState<string | null>(null);

  const rawHandle = credentials?.blueskyHandle || credentials?.blueskyIdentifier || 'creator.bsky.social';
  const blueskyHandle = rawHandle.replace(/^@/, '');
  const blueskyDisplayName = blueskyHandle.split('.')[0] || 'Creator';
  const threadsUsername = credentials?.threadsUsername?.replace(/^@/, '') || 'creator';
  const cleanedThreadsTopic = threadsTopic?.trim().replace(/^#+/, '') || '';

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
            <div className="p-3 sm:p-4 divide-y divide-[#1e2a38]/60 min-w-0">
              {/* Bluesky リプライ親投稿プレビュー */}
              {replyTarget?.platform?.toLowerCase() === 'bluesky' && (
                <div className="relative pb-3 mb-2 border-b border-sky-900/40">
                  <div className="absolute left-[19px] top-10 bottom-0 w-[2px] bg-[#0085ff]/30 z-0" />
                  <div className="relative z-10 flex items-start gap-2.5 sm:gap-3">
                    {replyTarget.authorAvatar ? (
                      <img
                        src={replyTarget.authorAvatar}
                        alt=""
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover shrink-0 ring-2 ring-sky-500/30"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-sky-950 border border-sky-800 flex items-center justify-center font-bold text-xs text-sky-400 shrink-0">
                        {replyTarget.authorDisplayName?.slice(0, 1) || 'B'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-slate-300 truncate">
                          {replyTarget.authorDisplayName || replyTarget.authorHandle || 'リプライ対象'}
                        </span>
                        {replyTarget.authorHandle && (
                          <span className="text-[11px] text-slate-500 truncate">
                            {replyTarget.authorHandle}
                          </span>
                        )}
                        <span className="ml-auto text-[10px] text-sky-400 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800/60 font-medium">
                          💬 返信先
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400 line-clamp-3 leading-relaxed">
                        {replyTarget.postSnippet || replyTarget.url}
                      </p>
                    </div>
                  </div>
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

                  return (
                    <div key={idx} className="relative group pt-3 first:pt-0 min-w-0">
                      {/* スレッド接続ライン (Blueskyブルーの滑らかな垂直線) */}
                      {!isLast && (
                        <div
                          className="absolute left-[19px] top-12 bottom-0 w-[2px] bg-gradient-to-b from-[#0085ff]/50 via-sky-800/40 to-[#0085ff]/20 z-0"
                          style={{ minHeight: '36px' }}
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

            <div className="space-y-0 relative bg-slate-950/70 rounded-xl border border-slate-800/80 p-2.5 sm:p-3 overflow-hidden">
              {blueskySplits.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  テキストを入力するとプレビューが表示されます
                </div>
              ) : (
                blueskySplits.map((split, idx) => (
                  <div key={idx} className="relative flex items-start gap-2.5 py-2 border-b border-slate-800/40 last:border-b-0">
                    <div className="w-7 h-7 rounded-full bg-[#0085ff] flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {blueskyDisplayName[0]?.toUpperCase() || 'B'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 text-xs min-w-0">
                        <span className="font-bold text-slate-100 truncate">{blueskyDisplayName}</span>
                        <span className="text-slate-500 text-[10px] truncate">@{blueskyHandle}</span>
                      </div>
                      <p className={`mt-0.5 ${FONT_SIZE_CONFIG[fontSize].textClass} text-slate-100 whitespace-pre-wrap break-words [overflow-wrap:anywhere]`}>
                        {renderRichText(split.text, true)}
                      </p>
                      {split.images && renderBlueskyImageGrid(split.images)}
                    </div>
                  </div>
                ))
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
            <div className="p-3 sm:p-4 divide-y divide-neutral-800/60 min-w-0">
              {/* Threads リプライ親投稿プレビュー */}
              {replyTarget?.platform?.toLowerCase() === 'threads' && (
                <div className="relative pb-3 mb-2 border-b border-neutral-800">
                  <div className="absolute left-[19px] top-10 bottom-0 w-[1.5px] bg-neutral-700 z-0" />
                  <div className="relative z-10 flex items-start gap-2.5 sm:gap-3">
                    {replyTarget.authorAvatar ? (
                      <img
                        src={replyTarget.authorAvatar}
                        alt=""
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover shrink-0 ring-2 ring-purple-500/30"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center font-bold text-xs text-purple-400 shrink-0">
                        {replyTarget.authorDisplayName?.slice(0, 1) || 'T'}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-neutral-300 truncate">
                          {replyTarget.authorDisplayName || replyTarget.authorHandle || 'リプライ対象'}
                        </span>
                        {replyTarget.authorHandle && (
                          <span className="text-[11px] text-neutral-500 truncate">
                            {replyTarget.authorHandle}
                          </span>
                        )}
                        <span className="ml-auto text-[10px] text-purple-400 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/60 font-medium">
                          💬 返信先
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-neutral-400 line-clamp-3 leading-relaxed">
                        {replyTarget.postSnippet || replyTarget.url}
                      </p>
                    </div>
                  </div>
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

                  return (
                    <div key={idx} className="relative group pt-3 first:pt-0 min-w-0">
                      {/* Threads特有の垂直コネクター線 (ダークグレーの洗練された細線) */}
                      {!isLast && (
                        <div
                          className="absolute left-[19px] top-12 bottom-0 w-[1.5px] bg-neutral-700 z-0"
                          style={{ minHeight: '36px' }}
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

            <div className="space-y-0 relative bg-slate-950/70 rounded-xl border border-slate-800/80 p-2.5 sm:p-3 overflow-hidden">
              {threadsSplits.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">
                  テキストを入力するとプレビューが表示されます
                </div>
              ) : (
                threadsSplits.map((split, idx) => (
                  <div key={idx} className="relative flex items-start gap-2.5 py-2 border-b border-slate-800/40 last:border-b-0">
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
                              スレッド #{split.index}
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
                ))
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
            {postToBluesky && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-[#0085ff]/15 text-[#0085ff] border border-[#0085ff]/30 font-bold flex items-center gap-1 shrink-0">
                <BlueskyButterflyLogo className="w-2.5 h-2.5" />
                <span>Bluesky ({blueskySplits.length})</span>
              </span>
            )}
            {postToThreads && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-purple-950/80 text-purple-300 border border-purple-800/50 font-bold flex items-center gap-1 shrink-0">
                <ThreadsSpiralLogo className="w-2.5 h-2.5" />
                <span>Threads ({threadsSplits.length})</span>
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

      {/* プレビュー本体グリッド: 両方選択時は左右2列表示、片方選択時は全幅表示 */}
      {!postToBluesky && !postToThreads ? (
        <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-xl p-8 text-center">
          <p className="text-xs text-slate-400">
            👈 左画面の「投稿先」（🦋 Bluesky または 🌀 Threads）を選択すると、ここにリアルタイムプレビューが表示されます。
          </p>
        </div>
      ) : (
        <div
          className={`grid grid-cols-1 ${
            postToBluesky && postToThreads ? 'md:grid-cols-2' : 'grid-cols-1'
          } gap-3 sm:gap-4 items-stretch w-full min-w-0 flex-1`}
        >
          {postToBluesky && (
            <div className="w-full min-w-0 flex flex-col h-full animate-in fade-in duration-150">
              {renderBlueskyPreview()}
            </div>
          )}

          {postToThreads && (
            <div className="w-full min-w-0 flex flex-col h-full animate-in fade-in duration-150">
              {renderThreadsPreview()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
