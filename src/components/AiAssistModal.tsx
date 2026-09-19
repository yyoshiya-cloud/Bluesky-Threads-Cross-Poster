import React, { useState } from 'react';
import {
  Sparkles,
  Scissors,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Info,
  RefreshCw,
  Copy,
  Check,
  X,
  ShieldCheck,
  MessageSquare,
  Globe,
  Wand2,
} from 'lucide-react';
import {
  AiThreadSplitResult,
  AiRewriteToneResult,
  AiSafetyCheckResult,
  ToastMessage,
} from '../types';

export type AiAssistTab = 'split' | 'tone' | 'safety';

interface AiAssistModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentText: string;
  initialTab?: AiAssistTab;
  onApplySplitText: (formattedText: string) => void;
  onApplyBlueskyText: (text: string) => void;
  onApplyThreadsText: (text: string) => void;
  onApplyBothCustomText: (blueskyText: string, threadsText: string) => void;
  onApplyCommonText: (text: string) => void;
  onNotify?: (toast: Omit<ToastMessage, 'id'>) => void;
}

export const AiAssistModal: React.FC<AiAssistModalProps> = ({
  isOpen,
  onClose,
  currentText,
  initialTab = 'split',
  onApplySplitText,
  onApplyBlueskyText,
  onApplyThreadsText,
  onApplyBothCustomText,
  onApplyCommonText,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<AiAssistTab>(initialTab);
  const [inputText, setInputText] = useState<string>(currentText);

  // モーダルが開かれたときに現在のテキストを同期
  React.useEffect(() => {
    if (isOpen) {
      setInputText(currentText);
      setActiveTab(initialTab);
    }
  }, [isOpen, currentText, initialTab]);

  // 1. スレッド分割の状態
  const [splitTargetPlatform, setSplitTargetPlatform] = useState<'both' | 'bluesky' | 'threads'>('both');
  const [splitNumbering, setSplitNumbering] = useState<boolean>(true);
  const [splitLoading, setSplitLoading] = useState<boolean>(false);
  const [splitResult, setSplitResult] = useState<AiThreadSplitResult | null>(null);
  const [splitError, setSplitError] = useState<string | null>(null);

  // 2. トーン調整の状態
  const [toneLoading, setToneLoading] = useState<boolean>(false);
  const [toneResult, setToneResult] = useState<AiRewriteToneResult | null>(null);
  const [toneError, setToneError] = useState<string | null>(null);

  // 3. セーフティ・校正の状態
  const [safetyLoading, setSafetyLoading] = useState<boolean>(false);
  const [safetyResult, setSafetyResult] = useState<AiSafetyCheckResult | null>(null);
  const [safetyError, setSafetyError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (content: string, fieldKey: string) => {
    navigator.clipboard.writeText(content);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
    if (onNotify) {
      onNotify({
        type: 'success',
        title: '📋 クリップボードにコピー',
        message: 'テキストをコピーしました。',
      });
    }
  };

  // -------------------------------------------------------------
  // AIリクエストハンドラ
  // -------------------------------------------------------------

  // 1. スレッド分割実行
  const handleRunSplit = async () => {
    if (!inputText.trim()) {
      setSplitError('本文が空です。テキストを入力してください。');
      return;
    }
    setSplitLoading(true);
    setSplitError(null);
    try {
      const res = await fetch('/api/ai/thread-split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          targetPlatform: splitTargetPlatform,
          includeNumbering: splitNumbering,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'AIスレッド分割に失敗しました。');
      }
      setSplitResult({
        posts: data.posts,
        formattedText: data.formattedText,
        summary: data.summary,
        postCount: data.postCount,
      });
    } catch (err: any) {
      setSplitError(err.message || 'AIスレッド分割中にエラーが発生しました。');
    } finally {
      setSplitLoading(false);
    }
  };

  // 2. プラットフォーム別トーン自動調整実行
  const handleRunToneRewrite = async () => {
    if (!inputText.trim()) {
      setToneError('本文が空です。テキストを入力してください。');
      return;
    }
    setToneLoading(true);
    setToneError(null);
    try {
      const res = await fetch('/api/ai/rewrite-tone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'AIトーン調整に失敗しました。');
      }
      setToneResult({
        blueskyText: data.blueskyText,
        threadsText: data.threadsText,
        notes: data.notes,
      });
    } catch (err: any) {
      setToneError(err.message || 'AIトーン調整中にエラーが発生しました。');
    } finally {
      setToneLoading(false);
    }
  };

  // 3. セーフティ・校正チェック実行
  const handleRunSafetyCheck = async () => {
    if (!inputText.trim()) {
      setSafetyError('本文が空です。テキストを入力してください。');
      return;
    }
    setSafetyLoading(true);
    setSafetyError(null);
    try {
      const res = await fetch('/api/ai/check-safety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText, checkLinks: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'セーフティチェックに失敗しました。');
      }
      setSafetyResult({
        safetyScore: data.safetyScore,
        issues: data.issues || [],
        improvedText: data.improvedText || inputText,
        summary: data.summary,
        linkChecks: data.linkChecks || [],
      });
    } catch (err: any) {
      setSafetyError(err.message || 'セーフティチェック中にエラーが発生しました。');
    } finally {
      setSafetyLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="ai-assist-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* モーダルヘッダー */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-purple-500 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>AIアシスト & 投稿リライト</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold">
                  Gemini 3.8 Flash
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                文脈スレッド分割・プラットフォーム別トーン自動調整・セーフティチェック
              </p>
            </div>
          </div>

          <button
            id="close-ai-modal-button"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3大機能ナビゲーションタブ */}
        <div className="bg-slate-950/80 p-2 border-b border-slate-800 flex items-center gap-2">
          <button
            id="tab-ai-split"
            type="button"
            onClick={() => setActiveTab('split')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'split'
                ? 'bg-slate-800 text-sky-300 shadow-sm border border-slate-700'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Scissors className="w-4 h-4 text-sky-400" />
            <span>自然なスレッド分割</span>
          </button>

          <button
            id="tab-ai-tone"
            type="button"
            onClick={() => setActiveTab('tone')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'tone'
                ? 'bg-purple-950/40 text-purple-300 shadow-sm border border-purple-800/60'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <Wand2 className="w-4 h-4 text-purple-400" />
            <span>プラットフォーム別トーン調整</span>
          </button>

          <button
            id="tab-ai-safety"
            type="button"
            onClick={() => setActiveTab('safety')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === 'safety'
                ? 'bg-emerald-950/40 text-emerald-300 shadow-sm border border-emerald-800/60'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>誤字脱字・セーフティ点検</span>
          </button>
        </div>

        {/* モーダルコンテンツ本体 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 現在の解析対象テキスト入力・確認エリア */}
          <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                解析・リライト対象テキスト ({inputText.length}文字)
              </span>
              <button
                type="button"
                onClick={() => setInputText(currentText)}
                className="text-[11px] text-sky-400 hover:underline cursor-pointer"
              >
                エディタ本文から再読込
              </button>
            </div>
            <textarea
              id="ai-assist-source-textarea"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="AIに処理させたい長文や下書きを入力してください..."
              rows={3}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-600 focus-ring-accent transition resize-y"
            />
          </div>

          {/* ========================================================= */}
          {/* 1. 自然なスレッド分割タブ (Split Tab)                      */}
          {/* ========================================================= */}
          {activeTab === 'split' && (
            <div className="space-y-4">
              {/* オプション設定 */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">対象SNS:</span>
                    <select
                      id="ai-split-platform-select"
                      value={splitTargetPlatform}
                      onChange={(e: any) => setSplitTargetPlatform(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs focus-ring-accent"
                    >
                      <option value="both">Bluesky & Threads 両立 (約280文字/ポスト)</option>
                      <option value="bluesky">🦋 Bluesky基準 (300文字以内/ポスト)</option>
                      <option value="threads">🌀 Threads基準 (500文字以内/ポスト)</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer select-none">
                    <input
                      id="ai-split-numbering-checkbox"
                      type="checkbox"
                      checked={splitNumbering}
                      onChange={(e) => setSplitNumbering(e.target.checked)}
                      className="rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-sky-500/30"
                    />
                    <span>連番「(1/3)」を付与</span>
                  </label>
                </div>

                <button
                  id="run-ai-split-button"
                  type="button"
                  onClick={handleRunSplit}
                  disabled={splitLoading || !inputText.trim()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition"
                >
                  {splitLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>文脈を考慮して分割中...</span>
                    </>
                  ) : (
                    <>
                      <Scissors className="w-3.5 h-3.5" />
                      <span>AIスレッド分割を実行</span>
                    </>
                  )}
                </button>
              </div>

              {/* エラー表示 */}
              {splitError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-sm">
                  <div className="flex items-start gap-2 min-w-0">
                    <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="font-bold text-rose-200">{splitError}</div>
                      <div className="text-[11px] text-rose-300/80">
                        AIモデルが混雑している場合は代替モデルへ自動切替されます。数秒待って「再試行」をお試しください。
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunSplit}
                    disabled={splitLoading}
                    className="px-3 py-1.5 rounded-lg bg-rose-800 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer transition shadow-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>再試行</span>
                  </button>
                </div>
              )}

              {/* 分割結果表示 */}
              {splitResult && (
                <div className="space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-200">
                        分割プレビュー: 全 {splitResult.postCount} ポスト
                      </span>
                      <span className="text-[11px] text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded-full border border-sky-800/40">
                        {splitResult.summary}
                      </span>
                    </div>

                    <button
                      id="apply-split-to-editor-button"
                      type="button"
                      onClick={() => {
                        onApplySplitText(splitResult.formattedText);
                        onClose();
                        if (onNotify) {
                          onNotify({
                            type: 'success',
                            title: '✨ エディタにスレッドを反映しました',
                            message: `${splitResult.postCount}件のポストに「---」で分割して反映しました。`,
                          });
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>エディタにスレッドを反映</span>
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {splitResult.posts.map((post, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/60 pb-1">
                          <span className="font-bold text-sky-400">ポスト {idx + 1}</span>
                          <div className="flex items-center gap-2">
                            <span>{post.length} 文字</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(post, `post-${idx}`)}
                              className="text-slate-400 hover:text-slate-200 cursor-pointer"
                              title="このポストをコピー"
                            >
                              {copiedField === `post-${idx}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>
                        <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">{post}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* 2. プラットフォーム別トーン自動調整タブ (Tone Tab)        */}
          {/* ========================================================= */}
          {activeTab === 'tone' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs">
                <div>
                  <div className="font-bold text-slate-200">
                    ワンクリックで2つのSNSの文化に書き分け
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Bluesky（落ち着いた開発者・知見共有） & Threads（親しみやすい絵文字・共感フック）
                  </div>
                </div>

                <button
                  id="run-ai-tone-rewrite-button"
                  type="button"
                  onClick={handleRunToneRewrite}
                  disabled={toneLoading || !inputText.trim()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition"
                >
                  {toneLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>SNS別に文体を書き分け中...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>トーン書き分けを実行</span>
                    </>
                  )}
                </button>
              </div>

              {/* エラー表示 */}
              {toneError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-sm">
                  <div className="flex items-start gap-2 min-w-0">
                    <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="font-bold text-rose-200">{toneError}</div>
                      <div className="text-[11px] text-rose-300/80">
                        AIモデルが混雑している場合は代替モデルへ自動切替されます。数秒待って「再試行」をお試しください。
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunToneRewrite}
                    disabled={toneLoading}
                    className="px-3 py-1.5 rounded-lg bg-rose-800 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer transition shadow-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>再試行</span>
                  </button>
                </div>
              )}

              {/* トーン調整結果表示 */}
              {toneResult && (
                <div className="space-y-3 animate-fade-in">
                  <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-800/50 text-xs flex items-center justify-between">
                    <span className="text-purple-200 font-medium">💡 {toneResult.notes}</span>

                    <button
                      id="apply-both-tones-button"
                      type="button"
                      onClick={() => {
                        onApplyBothCustomText(toneResult.blueskyText, toneResult.threadsText);
                        onClose();
                        if (onNotify) {
                          onNotify({
                            type: 'success',
                            title: '✨ 各SNSの個別本文に一括適用しました',
                            message: 'BlueskyタブとThreadsタブに最適化された文面をそれぞれセットしました。',
                          });
                        }
                      }}
                      className="px-3 py-1 rounded-lg bg-gradient-to-r from-sky-600 to-purple-600 hover:from-sky-500 hover:to-purple-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer transition shrink-0 ml-2"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>両方の個別本文に一括反映</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Bluesky向けカード */}
                    <div className="bg-sky-950/30 border border-sky-800/60 rounded-xl p-3 text-xs space-y-2 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between border-b border-sky-800/40 pb-1.5 mb-2">
                          <span className="font-bold text-[#38bdf8] flex items-center gap-1.5">
                            <span>🦋 Bluesky向け</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-900 text-sky-200 font-normal">
                              開発者・知見・簡潔
                            </span>
                          </span>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span>{toneResult.blueskyText.length}/300</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(toneResult.blueskyText, 'bsky-tone')}
                              className="text-slate-400 hover:text-slate-200 cursor-pointer"
                              title="コピー"
                            >
                              {copiedField === 'bsky-tone' ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>

                        <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {toneResult.blueskyText}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-sky-800/30 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onApplyBlueskyText(toneResult.blueskyText);
                            onClose();
                            if (onNotify) {
                              onNotify({
                                type: 'success',
                                title: '🦋 Bluesky専用本文に適用',
                                message: 'Bluesky専用テキストとして反映しました。',
                              });
                            }
                          }}
                          className="px-2.5 py-1 rounded bg-[#0085ff] hover:bg-[#0077e6] text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                        >
                          <Check className="w-3 h-3" />
                          <span>Blueskyにのみ適用</span>
                        </button>
                      </div>
                    </div>

                    {/* Threads向けカード */}
                    <div className="bg-purple-950/30 border border-purple-800/60 rounded-xl p-3 text-xs space-y-2 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between border-b border-purple-800/40 pb-1.5 mb-2">
                          <span className="font-bold text-purple-300 flex items-center gap-1.5">
                            <span>🌀 Threads向け</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-900 text-purple-200 font-normal">
                              親しみやすさ・共感・フック
                            </span>
                          </span>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            <span>{toneResult.threadsText.length}/500</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(toneResult.threadsText, 'threads-tone')}
                              className="text-slate-400 hover:text-slate-200 cursor-pointer"
                              title="コピー"
                            >
                              {copiedField === 'threads-tone' ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </div>

                        <p className="text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {toneResult.threadsText}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-purple-800/30 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onApplyThreadsText(toneResult.threadsText);
                            onClose();
                            if (onNotify) {
                              onNotify({
                                type: 'success',
                                title: '🌀 Threads専用本文に適用',
                                message: 'Threads専用テキストとして反映しました。',
                              });
                            }
                          }}
                          className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition"
                        >
                          <Check className="w-3 h-3" />
                          <span>Threadsにのみ適用</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* 3. 誤字脱字・セーフティ点検タブ (Safety Tab)               */}
          {/* ========================================================= */}
          {activeTab === 'safety' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs">
                <div>
                  <div className="font-bold text-slate-200">
                    リンク切れ・誤字脱字・シャドウバン規約リスクを事前点検
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Meta/AT Protocolのアルゴリズム規制や過度な記号連続、不自然な言い回しを検知します。
                  </div>
                </div>

                <button
                  id="run-ai-safety-check-button"
                  type="button"
                  onClick={handleRunSafetyCheck}
                  disabled={safetyLoading || !inputText.trim()}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition"
                >
                  {safetyLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>リンク生存確認 & 校正診断中...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>セーフティ点検を実行</span>
                    </>
                  )}
                </button>
              </div>

              {/* エラー表示 */}
              {safetyError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-sm">
                  <div className="flex items-start gap-2 min-w-0">
                    <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="font-bold text-rose-200">{safetyError}</div>
                      <div className="text-[11px] text-rose-300/80">
                        AIモデルが混雑している場合は代替モデルへ自動切替されます。数秒待って「再試行」をお試しください。
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunSafetyCheck}
                    disabled={safetyLoading}
                    className="px-3 py-1.5 rounded-lg bg-rose-800 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 cursor-pointer transition shadow-xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>再試行</span>
                  </button>
                </div>
              )}

              {/* セーフティ診断結果 */}
              {safetyResult && (
                <div className="space-y-3 animate-fade-in">
                  {/* スコアカード & 総評 */}
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black ${
                          safetyResult.safetyScore >= 80
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : safetyResult.safetyScore >= 60
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        <span className="text-base leading-none">{safetyResult.safetyScore}</span>
                        <span className="text-[9px] font-normal">/ 100点</span>
                      </div>

                      <div>
                        <div className="font-bold text-slate-200 text-xs flex items-center gap-2">
                          <span>
                            {safetyResult.safetyScore >= 85
                              ? '🟢 健全で安全な投稿文です'
                              : safetyResult.safetyScore >= 65
                              ? '🟡 軽微な注意・改善点があります'
                              : '🔴 規約違反またはリンク切れの恐れがあります'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">{safetyResult.summary}</div>
                      </div>
                    </div>

                    {/* 改善案の即時適用ボタン */}
                    {safetyResult.improvedText && safetyResult.improvedText !== inputText && (
                      <button
                        id="apply-safety-improved-text-button"
                        type="button"
                        onClick={() => {
                          onApplyCommonText(safetyResult.improvedText);
                          setInputText(safetyResult.improvedText);
                          if (onNotify) {
                            onNotify({
                              type: 'success',
                              title: '🛡️ 改善文をエディタに適用しました',
                              message: '誤字脱字や過度な表現を修正したテキストを反映しました。',
                            });
                          }
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>改善テキストをエディタに適用</span>
                      </button>
                    )}
                  </div>

                  {/* リンク生存確認リスト */}
                  {safetyResult.linkChecks && safetyResult.linkChecks.length > 0 && (
                    <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-xs space-y-1.5">
                      <div className="font-bold text-slate-300 text-[11px] flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-sky-400" />
                        <span>URLリンク生存確認結果</span>
                      </div>
                      <div className="space-y-1">
                        {safetyResult.linkChecks.map((link, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-1.5 rounded bg-slate-900 border border-slate-800/80 text-[11px]"
                          >
                            <span className="text-slate-300 truncate max-w-[400px]">{link.url}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {link.status === 'ok' ? (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-medium">
                                  ✓ 有効 (HTTP {link.statusCode})
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold">
                                  ✕ リンク切れ・接続不可 ({link.error || 'エラー'})
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 指摘事項一覧 */}
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-slate-300">
                      検出された指摘事項 ({safetyResult.issues.length}件)
                    </div>

                    {safetyResult.issues.length === 0 ? (
                      <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-center text-xs text-emerald-300">
                        🎉 問題点は検出されませんでした。このまま安心して投稿いただけます！
                      </div>
                    ) : (
                      safetyResult.issues.map((issue, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                            issue.severity === 'error'
                              ? 'bg-rose-950/40 border-rose-800/70 text-rose-200'
                              : issue.severity === 'warning'
                              ? 'bg-amber-950/40 border-amber-800/70 text-amber-200'
                              : 'bg-sky-950/40 border-sky-800/70 text-sky-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold flex items-center gap-1">
                                {issue.severity === 'error' && (
                                  <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                                )}
                                {issue.severity === 'warning' && (
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                )}
                                {issue.severity === 'info' && (
                                  <Info className="w-3.5 h-3.5 text-sky-400" />
                                )}
                                <span>{issue.title}</span>
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900/80 text-slate-300">
                                {issue.category === 'typo'
                                  ? '誤字脱字'
                                  : issue.category === 'shadowban'
                                  ? 'シャドウバン注意'
                                  : issue.category === 'symbols'
                                  ? '過度な記号'
                                  : '規約・セーフティ'}
                              </span>
                            </div>

                            <span className="text-[10px] uppercase font-bold tracking-wider">
                              {issue.severity}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-300 leading-relaxed">
                            {issue.description}
                          </p>

                          {issue.suggestion && (
                            <div className="p-1.5 rounded bg-slate-900/90 border border-slate-800 text-[11px] text-emerald-300 flex items-center justify-between gap-2">
                              <span>💡 改善案: {issue.suggestion}</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* モーダルフッター */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span>Powered by Gemini 3.8 Flash API</span>
          <button
            id="close-ai-modal-bottom-button"
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
