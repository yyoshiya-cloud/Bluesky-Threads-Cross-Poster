import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  RotateCcw,
  Clock,
  Save,
} from 'lucide-react';
import { QuickTimePreset } from '../types';
import {
  saveQuickPresetsToStorage,
  resetQuickPresetsToDefault,
  getCalculatedQuickPresets,
} from '../utils/presetStorage';

interface QuickPresetSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPresets: QuickTimePreset[];
  onPresetsUpdated: (newPresets: QuickTimePreset[]) => void;
  onNotify?: (toast: { type: 'success' | 'error' | 'info'; title: string; message: string }) => void;
}

const COMMON_ICONS = ['☀️', '🍱', '☕', '🌇', '🌙', '⏰', '🚀', '✨', '📝', '🎯', '🔥', '💡'];

export const QuickPresetSettingsModal: React.FC<QuickPresetSettingsModalProps> = ({
  isOpen,
  onClose,
  currentPresets,
  onPresetsUpdated,
  onNotify,
}) => {
  const [presets, setPresets] = useState<QuickTimePreset[]>(() => [...currentPresets]);
  const [newHour, setNewHour] = useState<number>(12);
  const [newMinute, setNewMinute] = useState<number>(0);
  const [newLabel, setNewLabel] = useState<string>('');
  const [newIcon, setNewIcon] = useState<string>('⏰');

  // モーダルが開くたびに同期
  React.useEffect(() => {
    if (isOpen) {
      setPresets([...currentPresets]);
    }
  }, [isOpen, currentPresets]);

  if (!isOpen) return null;

  // プリセット追加
  const handleAddPreset = () => {
    if (presets.length >= 8) {
      if (onNotify) {
        onNotify({
          type: 'error',
          title: '登録上限',
          message: 'クイックプリセットは最大8個まで登録できます。',
        });
      }
      return;
    }

    const timeFormatted = `${String(newHour).padStart(2, '0')}:${String(newMinute).padStart(2, '0')}`;
    const newPreset: QuickTimePreset = {
      id: `preset-${Date.now()}`,
      hour: newHour,
      minute: newMinute,
      label: newLabel.trim() || timeFormatted,
      icon: newIcon,
    };

    const updated = [...presets, newPreset].sort((a, b) => {
      const timeA = a.hour * 60 + a.minute;
      const timeB = b.hour * 60 + b.minute;
      return timeA - timeB;
    });

    setPresets(updated);
    setNewLabel('');
    if (onNotify) {
      onNotify({
        type: 'success',
        title: 'プリセットを追加しました',
        message: `「${newPreset.icon} ${newPreset.label}」を追加しました。`,
      });
    }
  };

  // プリセット削除
  const handleDeletePreset = (id: string) => {
    if (presets.length <= 1) {
      if (onNotify) {
        onNotify({
          type: 'error',
          title: '削除不可',
          message: '少なくとも1つのプリセットが必要です。',
        });
      }
      return;
    }
    setPresets((prev) => prev.filter((p) => p.id !== id));
  };

  // 個別プリセットの更新
  const handleUpdateItem = (
    id: string,
    field: 'hour' | 'minute' | 'label' | 'icon',
    value: any
  ) => {
    setPresets((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          [field]: value,
        };
      })
    );
  };

  // 初期値にリセット
  const handleResetToDefault = () => {
    const defaultList = resetQuickPresetsToDefault();
    setPresets([...defaultList]);
    onPresetsUpdated(defaultList);
    if (onNotify) {
      onNotify({
        type: 'info',
        title: '初期設定にリセットしました',
        message: 'クイック選択プリセットを標準（09:00, 12:00, 15:00, 18:00）に戻しました。',
      });
    }
  };

  // 保存して閉じる
  const handleSaveAndClose = () => {
    if (presets.length === 0) {
      handleResetToDefault();
      onClose();
      return;
    }
    // 時刻順にソートして保存
    const sorted = [...presets].sort((a, b) => {
      const timeA = a.hour * 60 + a.minute;
      const timeB = b.hour * 60 + b.minute;
      return timeA - timeB;
    });

    saveQuickPresetsToStorage(sorted);
    onPresetsUpdated(sorted);
    if (onNotify) {
      onNotify({
        type: 'success',
        title: 'プリセットを保存しました',
        message: '予約投稿のクイック選択ボタンに反映されました。',
      });
    }
    onClose();
  };

  // プレビュー計算
  const calculatedPreview = getCalculatedQuickPresets(presets);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* モーダルヘッダー */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-accent-subtle text-accent-light border border-accent/30">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>予約投稿クイックプリセット設定</span>
              </h2>
              <p className="text-xs text-slate-400">
                よく使う投稿時刻のボタンを自由に変更・追加・削除できます
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* モーダル本体 */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* 現在のプリセット一覧 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">
                設定中のプリセット一覧 ({presets.length}/8件)
              </span>
              <button
                type="button"
                onClick={handleResetToDefault}
                className="text-xs text-slate-400 hover:text-accent-light flex items-center gap-1 transition cursor-pointer hover:underline"
              >
                <RotateCcw className="w-3 h-3" />
                <span>標準に戻す (9, 12, 15, 18時)</span>
              </button>
            </div>

            <div className="space-y-2">
              {presets.map((item) => {
                const timeString = `${String(item.hour).padStart(2, '0')}:${String(item.minute).padStart(2, '0')}`;
                return (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition"
                  >
                    {/* アイコン選択 */}
                    <div className="flex items-center gap-1">
                      <select
                        value={item.icon || '⏰'}
                        onChange={(e) => handleUpdateItem(item.id, 'icon', e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-100 cursor-pointer text-center"
                        title="アイコン"
                      >
                        {COMMON_ICONS.map((ico) => (
                          <option key={ico} value={ico}>
                            {ico}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 時刻指定（時・分） */}
                    <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-700">
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={item.hour}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) {
                            handleUpdateItem(item.id, 'hour', Math.max(0, Math.min(23, val)));
                          }
                        }}
                        className="w-8 bg-transparent text-center text-xs font-mono font-bold text-slate-100 focus:outline-none"
                      />
                      <span className="text-slate-500 font-bold font-mono">:</span>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        step="5"
                        value={item.minute}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) {
                            handleUpdateItem(item.id, 'minute', Math.max(0, Math.min(59, val)));
                          }
                        }}
                        className="w-8 bg-transparent text-center text-xs font-mono font-bold text-slate-100 focus:outline-none"
                      />
                    </div>

                    {/* 表示ラベル */}
                    <div className="flex-1 min-w-[120px]">
                      <input
                        type="text"
                        value={item.label || ''}
                        placeholder={timeString}
                        onChange={(e) => handleUpdateItem(item.id, 'label', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 placeholder-slate-500 focus-ring-accent"
                      />
                    </div>

                    {/* 削除ボタン */}
                    <button
                      type="button"
                      onClick={() => handleDeletePreset(item.id)}
                      disabled={presets.length <= 1}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/40 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      title="削除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 新規プリセット追加フォーム */}
          {presets.length < 8 && (
            <div className="p-3.5 rounded-xl bg-slate-950/50 border border-dashed border-slate-800 space-y-2.5">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-accent-light" />
                <span>新しいクイック時刻を追加</span>
              </span>

              <div className="flex flex-wrap items-center gap-2">
                {/* 絵文字 */}
                <select
                  value={newIcon}
                  onChange={(e) => setNewIcon(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 cursor-pointer"
                >
                  {COMMON_ICONS.map((ico) => (
                    <option key={ico} value={ico}>
                      {ico}
                    </option>
                  ))}
                </select>

                {/* 時刻 */}
                <div className="flex items-center gap-1 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-700">
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={newHour}
                    onChange={(e) => setNewHour(Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0)))}
                    className="w-8 bg-transparent text-center text-xs font-mono font-bold text-slate-100 focus:outline-none"
                  />
                  <span className="text-slate-500 font-bold font-mono">:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    step="5"
                    value={newMinute}
                    onChange={(e) => setNewMinute(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                    className="w-8 bg-transparent text-center text-xs font-mono font-bold text-slate-100 focus:outline-none"
                  />
                </div>

                {/* 表示ラベル */}
                <input
                  type="text"
                  value={newLabel}
                  placeholder="ラベル (例: 夜のまとめ投稿)"
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="flex-1 min-w-[140px] bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus-ring-accent"
                />

                {/* 追加ボタン */}
                <button
                  type="button"
                  onClick={handleAddPreset}
                  className="btn-accent px-3 py-1.5 rounded-lg text-xs font-bold text-white transition flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>追加</span>
                </button>
              </div>
            </div>
          )}

          {/* 実際のボタンプレビュー */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300">エディタ表示プレビュー（現在時刻と連動）:</span>
              <span className="text-slate-500 text-[10px]">※過去時刻は自動で「明日」と判定</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {calculatedPreview.map((p) => (
                <div
                  key={p.id}
                  className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-center flex flex-col items-center justify-center gap-0.5"
                >
                  <span className="text-xs font-bold text-slate-200">{p.label}</span>
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded font-normal leading-none ${
                      p.isTomorrow
                        ? 'bg-amber-950/70 text-amber-300 border border-amber-800/40'
                        : 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/40'
                    }`}
                  >
                    {p.dateLabel} ({p.timeLabel})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* モーダルフッター */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            ※設定内容はブラウザに自動保存されます
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSaveAndClose}
              className="btn-accent px-5 py-2 rounded-xl text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Save className="w-3.5 h-3.5" />
              <span>設定を保存する</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
