import { QuickTimePreset, TargetPlatformCategory } from '../types';
import { formatToJstString } from './scheduledStorage';

const STORAGE_KEY = 'crossposter_quick_time_presets_v1';

export const DEFAULT_QUICK_PRESETS: QuickTimePreset[] = [
  { id: 'preset-0900', hour: 9, minute: 0, label: '09:00', icon: '☀️' },
  { id: 'preset-1200', hour: 12, minute: 0, label: '12:00', icon: '🍱' },
  { id: 'preset-1500', hour: 15, minute: 0, label: '15:00', icon: '☕' },
  { id: 'preset-1800', hour: 18, minute: 0, label: '18:00', icon: '🌇' },
];

/**
 * ローカルストレージからクイック選択プリセットを読み込む
 */
export function loadQuickPresetsFromStorage(): QuickTimePreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_QUICK_PRESETS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // データの検証とサニタイズ
      return parsed.map((p, idx) => ({
        id: p.id || `preset-${Date.now()}-${idx}`,
        hour: typeof p.hour === 'number' ? Math.max(0, Math.min(23, p.hour)) : 12,
        minute: typeof p.minute === 'number' ? Math.max(0, Math.min(59, p.minute)) : 0,
        label: p.label || `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`,
        icon: p.icon || '⏰',
      }));
    }
  } catch (e) {
    console.error('Failed to load quick time presets from storage:', e);
  }
  return DEFAULT_QUICK_PRESETS;
}

/**
 * クイック選択プリセットをローカルストレージに保存
 */
export function saveQuickPresetsToStorage(presets: QuickTimePreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch (e) {
    console.error('Failed to save quick time presets to storage:', e);
  }
}

/**
 * プリセットをデフォルトにリセット
 */
export function resetQuickPresetsToDefault(): QuickTimePreset[] {
  saveQuickPresetsToStorage(DEFAULT_QUICK_PRESETS);
  return DEFAULT_QUICK_PRESETS;
}

/**
 * 現在のJST時刻に基づき、プリセットから今日/明日のタイムスタンプと情報を計算
 */
export function getCalculatedQuickPresets(customPresets?: QuickTimePreset[]): {
  id: string;
  preset: QuickTimePreset;
  label: string;
  timeLabel: string;
  dateLabel: string;
  timestamp: number;
  jstDisplay: string;
  isTomorrow: boolean;
}[] {
  const presets = customPresets && customPresets.length > 0
    ? customPresets
    : loadQuickPresetsFromStorage();

  const now = Date.now();

  // 現在のJST年月日を取得
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date(now));
  let y = 2026, m = 1, d = 1;
  for (const p of parts) {
    if (p.type === 'year') y = parseInt(p.value, 10);
    if (p.type === 'month') m = parseInt(p.value, 10);
    if (p.type === 'day') d = parseInt(p.value, 10);
  }

  return presets.map((preset) => {
    const timeFormatted = `${String(preset.hour).padStart(2, '0')}:${String(preset.minute).padStart(2, '0')}`;
    const displayLabel = preset.label && preset.label !== timeFormatted
      ? `${preset.icon ? preset.icon + ' ' : ''}${preset.label} (${timeFormatted})`
      : `${preset.icon ? preset.icon + ' ' : ''}${timeFormatted}`;

    // JSTの今日の日時タイムスタンプを作成 (UTC換算: hour - 9)
    const todayTarget = new Date(Date.UTC(y, m - 1, d, preset.hour - 9, preset.minute, 0)).getTime();
    const isTomorrow = todayTarget <= now;
    const finalTimestamp = isTomorrow ? todayTarget + 24 * 60 * 60 * 1000 : todayTarget;
    const dateLabel = isTomorrow ? '明日' : '今日';

    return {
      id: preset.id,
      preset,
      label: displayLabel,
      timeLabel: timeFormatted,
      dateLabel,
      timestamp: finalTimestamp,
      jstDisplay: formatToJstString(finalTimestamp),
      isTomorrow,
    };
  });
}

/**
 * 投稿フラグから投稿区分（both | bluesky | threads）を取得するヘルパー
 */
export function getPlatformCategory(postToBluesky: boolean, postToThreads: boolean): TargetPlatformCategory {
  if (postToBluesky && postToThreads) return 'both';
  if (postToBluesky) return 'bluesky';
  return 'threads';
}

/**
 * 投稿区分ごとの表示ラベル・バッジ情報
 */
export const PLATFORM_CATEGORY_CONFIG: Record<
  TargetPlatformCategory,
  {
    name: string;
    shortName: string;
    badgeClass: string;
    icon: string;
    description: string;
  }
> = {
  both: {
    name: '同時投稿 (Bluesky & Threads)',
    shortName: '同時投稿',
    badgeClass: 'bg-gradient-to-r from-[#0085ff]/20 to-purple-900/30 text-sky-200 border border-sky-500/40',
    icon: '🚀',
    description: 'BlueskyとThreadsの両方に同時配信します',
  },
  bluesky: {
    name: 'Bluesky のみ',
    shortName: 'Bluesky',
    badgeClass: 'bg-[#0085ff]/20 text-[#0085ff] border border-[#0085ff]/40',
    icon: '🦋',
    description: 'Blueskyのみに単独配信します',
  },
  threads: {
    name: 'Threads のみ',
    shortName: 'Threads',
    badgeClass: 'bg-purple-950/70 text-purple-300 border border-purple-800/60',
    icon: '🌀',
    description: 'Threadsのみに単独配信します（トピックタグ対応）',
  },
};
