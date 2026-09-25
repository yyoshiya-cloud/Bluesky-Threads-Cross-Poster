import React, { useEffect } from 'react';
import { X, ExternalLink, Sparkles, Send, MessageSquareQuote, Image as ImageIcon, CalendarClock, Eye, BarChart2 } from 'lucide-react';
import { APP_VERSION, APP_NAME, formatAppBuildDate } from '../config/appInfo';

interface AboutAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutAppModal: React.FC<AboutAppModalProps> = ({
  isOpen,
  onClose,
}) => {
  // Escapeキーで閉じる
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      id="about-app-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="about-app-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-modal-title"
        className="relative w-full max-w-2xl bg-[#0D121F] border border-slate-700/80 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden animate-in zoom-in-95 duration-150 text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 上部グラデーションデコレーション */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#0085ff] via-purple-500 to-pink-500 opacity-90" />

        {/* ヘッダーエリア (アプリアイコン・タイトル・バージョン・最終更新日) */}
        <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between gap-3 bg-slate-950/60">
          <div className="flex items-center gap-3 min-w-0">
            {/* 画面左上と同一のアイコン */}
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-700/80 bg-slate-900 flex items-center justify-center shrink-0 shadow-md">
              <img
                src="/favicon.svg"
                alt="CrossPost Icon"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="about-modal-title" className="text-base font-bold text-white tracking-tight">
                  {APP_NAME}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                  Version {APP_VERSION}
                </span>
                <span
                  className="text-[11px] text-slate-400 flex items-center gap-1.5 bg-slate-800/60 px-2 py-0.5 rounded-full border border-slate-700/60"
                  title="Publish/デプロイまたはGitコミットにより自動更新されます"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  最終更新日: {formatAppBuildDate()}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                Bluesky & Threads 同時・分割配信マルチプラットフォームスタジオ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer shrink-0"
            title="閉じる (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 主な実装機能 (スクロール不要のコンパクト2列グリッド) */}
        <div className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-300">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>主な実装機能</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {/* 機能 1 */}
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-sky-500/10 text-sky-400 shrink-0 mt-0.5">
                <Send className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-semibold text-slate-100 block text-[11px]">同時・個別投稿＆自動スレッド分割</span>
                <p className="text-[10px] text-slate-400 leading-snug mt-0.5">
                  Bluesky(300字)・Threads(500字)の一括/個別作成、超過時のナンバリング付き自動分割。
                </p>
              </div>
            </div>

            {/* 機能 2 */}
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-purple-500/10 text-purple-400 shrink-0 mt-0.5">
                <MessageSquareQuote className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-semibold text-slate-100 block text-[11px]">スマート・リプライ自動解決</span>
                <p className="text-[10px] text-slate-400 leading-snug mt-0.5">
                  投稿URLやIDから対象ポストを自動判定し、親ポストに対するツリー直接返信を構成。
                </p>
              </div>
            </div>

            {/* 機能 3 */}
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
                <ImageIcon className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-semibold text-slate-100 block text-[11px]">画像・動画メディア＆Alt編集</span>
                <p className="text-[10px] text-slate-400 leading-snug mt-0.5">
                  最大4枚の画像・動画添付、ドラッグ＆ドロップ並び替え、アクセシビリティAlt対応。
                </p>
              </div>
            </div>

            {/* 機能 4 */}
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
                <CalendarClock className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-semibold text-slate-100 block text-[11px]">日時指定 予約投稿マネージャー</span>
                <p className="text-[10px] text-slate-400 leading-snug mt-0.5">
                  日時指定の自動送信、予約キュー一覧の管理、エディタへのワンクリック再読込。
                </p>
              </div>
            </div>

            {/* 機能 5 */}
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-indigo-500/10 text-indigo-400 shrink-0 mt-0.5">
                <Eye className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-semibold text-slate-100 block text-[11px]">リアルタイム・デュアルプレビュー</span>
                <p className="text-[10px] text-slate-400 leading-snug mt-0.5">
                  Bluesky・Threads各公式UIを忠実に再現したリアルタイムシミュレーション。
                </p>
              </div>
            </div>

            {/* 機能 6 */}
            <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-start gap-2.5">
              <div className="p-1 rounded-md bg-rose-500/10 text-rose-400 shrink-0 mt-0.5">
                <BarChart2 className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-semibold text-slate-100 block text-[11px]">エンゲージメント分析＆履歴・暗号化</span>
                <p className="text-[10px] text-slate-400 leading-snug mt-0.5">
                  反応比較グラフ、CSV出力、ブラウザ内AES-256暗号化保管＆DEMO/LIVE切替。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* フッターエリア (制作者リンク & 閉じるボタン) */}
        <div className="px-4 sm:px-5 py-3 border-t border-slate-800/80 bg-slate-950/70 flex flex-wrap items-center justify-between gap-2.5">
          {/* 制作者・公式アカウントリンク */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-slate-400 font-medium">制作者:</span>
            <a
              href="https://bsky.app/profile/yoshiya.bsky.social"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-950/30 hover:bg-sky-900/40 border border-sky-800/40 hover:border-sky-600/60 text-[11px] text-sky-300 transition group cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#0085ff]" />
              <span>Bluesky</span>
              <span className="text-slate-400 text-[10px] group-hover:text-sky-200">@yoshiya.bsky.social</span>
              <ExternalLink className="w-3 h-3 text-sky-400/70 group-hover:text-sky-300" />
            </a>

            <a
              href="https://www.threads.com/@yutakayoshiya"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-950/30 hover:bg-purple-900/40 border border-purple-800/40 hover:border-purple-600/60 text-[11px] text-purple-300 transition group cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
              <span>Threads</span>
              <span className="text-slate-400 text-[10px] group-hover:text-purple-200">@yutakayoshiya</span>
              <ExternalLink className="w-3 h-3 text-purple-400/70 group-hover:text-purple-300" />
            </a>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
