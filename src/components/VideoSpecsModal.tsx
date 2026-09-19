import React from 'react';
import { Film, CheckCircle2, AlertTriangle, XCircle, Info, X, ShieldAlert } from 'lucide-react';
import { AttachedImage } from '../types';
import { validateVideoMetadata } from '../utils/mediaValidation';

interface VideoSpecsModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoItem?: AttachedImage | null;
}

export const VideoSpecsModal: React.FC<VideoSpecsModalProps> = ({
  isOpen,
  onClose,
  videoItem,
}) => {
  if (!isOpen) return null;

  const detail = videoItem
    ? validateVideoMetadata(
        { name: videoItem.name, size: videoItem.size, type: videoItem.mimeType },
        {
          duration: videoItem.duration,
          width: videoItem.width,
          height: videoItem.height,
          mimeType: videoItem.mimeType,
        }
      )
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 border border-purple-500/30">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                動画アップロード仕様 & 適合状況チェック
              </h3>
              <p className="text-[11px] text-slate-400">
                Bluesky / Threads の公式動画制限および添付ファイルの判定結果
              </p>
            </div>
          </div>
          <button
            id="close-video-specs-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* モーダル本文 */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-300">
          {/* 選択中動画の診断結果 (存在する場合) */}
          {detail && videoItem && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-200 truncate max-w-[280px]">
                    📹 {videoItem.name}
                  </span>
                  <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                    {detail.metadata.format.toUpperCase()}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  {detail.metadata.sizeMB} MB / {detail.metadata.durationSec} 秒
                </div>
              </div>

              {/* 適合状況ステータスバッジ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Bluesky 適合度 */}
                <div
                  className={`p-3 rounded-lg border flex flex-col justify-between gap-1.5 ${
                    detail.canPostBluesky
                      ? 'bg-sky-950/30 border-sky-800/60 text-sky-200'
                      : 'bg-rose-950/30 border-rose-800/60 text-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5 text-sky-400">
                      <span className="w-2 h-2 rounded-full bg-sky-400" />
                      Bluesky 投稿適合度
                    </span>
                    {detail.canPostBluesky ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        公式仕様クリア
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        制限超過
                      </span>
                    )}
                  </div>
                  {detail.blueskyErrors.length > 0 ? (
                    <ul className="text-[11px] space-y-1 text-rose-300/90 list-disc list-inside">
                      {detail.blueskyErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-sky-300/80">
                      MP4/MOV/WebM対応、60秒以内、50MB以内の公式要件を満たしています。
                    </p>
                  )}
                </div>

                {/* Threads 適合度 */}
                <div
                  className={`p-3 rounded-lg border flex flex-col justify-between gap-1.5 ${
                    detail.canPostThreads
                      ? 'bg-purple-950/30 border-purple-800/60 text-purple-200'
                      : 'bg-rose-950/30 border-rose-800/60 text-rose-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5 text-purple-400">
                      <span className="w-2 h-2 rounded-full bg-purple-400" />
                      Threads 投稿適合度
                    </span>
                    {detail.canPostThreads ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        公式仕様クリア
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        制限超過
                      </span>
                    )}
                  </div>
                  {detail.threadsErrors.length > 0 ? (
                    <ul className="text-[11px] space-y-1 text-rose-300/90 list-disc list-inside">
                      {detail.threadsErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-purple-300/80">
                      MP4/MOV対応、5分以内、100MB以内の公式要件を満たしています。
                    </p>
                  )}
                </div>
              </div>

              {/* 警告事項 */}
              {detail.warnings.length > 0 && (
                <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/50 text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <div className="space-y-0.5 text-[11px]">
                    <p className="font-bold">推奨仕様に関する注意点:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-amber-300/90">
                      {detail.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 公式仕様の比較対照テーブル */}
          <div className="space-y-2">
            <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-sky-400" />
              プラットフォーム別 動画公式仕様一覧
            </h4>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-[11px] divide-y divide-slate-800">
                <thead className="bg-slate-950/80 text-slate-400 font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">項目</th>
                    <th className="py-2.5 px-3 text-sky-400">Bluesky</th>
                    <th className="py-2.5 px-3 text-purple-400">Threads (Meta API)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 font-mono">
                  <tr>
                    <td className="py-2 px-3 font-sans text-slate-300">対応形式</td>
                    <td className="py-2 px-3 text-slate-200">MP4, MOV, WebM, M4V</td>
                    <td className="py-2 px-3 text-slate-200 font-bold text-purple-300">
                      MP4, MOV (※WebM非対応)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-sans text-slate-300">最大容量</td>
                    <td className="py-2 px-3 text-slate-200">最大 50 MB</td>
                    <td className="py-2 px-3 text-slate-200">最大 100 MB (API上限1GB)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-sans text-slate-300">再生時間</td>
                    <td className="py-2 px-3 text-amber-300 font-bold">最短1秒 〜 最長60秒 (1分)</td>
                    <td className="py-2 px-3 text-emerald-300 font-bold">最短1秒 〜 最長5分 (300秒)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-sans text-slate-300">1投稿の添付数</td>
                    <td className="py-2 px-3 text-slate-200">動画1本のみ (※画像や2本目はスレッドへ自動分割)</td>
                    <td className="py-2 px-3 text-slate-200">単一動画 または カルーセル(最大10件)</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3 font-sans text-slate-300">推奨アスペクト比</td>
                    <td className="py-2 px-3 text-slate-200">16:9, 9:16, 1:1, 4:5</td>
                    <td className="py-2 px-3 text-slate-200">1.91:1 〜 4:5 または 9:16 (リール)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 解決手順ガイド */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
            <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
              動画アップロードが失敗する場合のチェックリスト
            </h4>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400 leading-relaxed">
              <li>
                <strong className="text-slate-300">Threadsで処理エラーになる場合:</strong> 動画の長さが1秒以上5分以内であること、アスペクト比が極端に細長すぎないこと（1.91:1〜9:16推奨）をご確認ください。
              </li>
              <li>
                <strong className="text-slate-300">Blueskyで送信エラーになる場合:</strong> 動画サイズが50MB以下、再生時間が60秒以内であることをご確認ください。（※画像と動画が同時に添付されている場合は、本アプリが自動で次のポストへ分割してスレッド投稿します）。
              </li>
              <li>
                <strong className="text-slate-300">動画ファイル形式:</strong> Threadsに投稿する際は、一般的なH.264 / AACコーデックの MP4 または MOV ファイルをご使用ください。
              </li>
            </ul>
          </div>
        </div>

        {/* モーダルフッター */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
