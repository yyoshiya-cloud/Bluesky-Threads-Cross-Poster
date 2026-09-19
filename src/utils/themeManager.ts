import { ThemeAccentId, ThemeAccentConfig } from '../types';

export const THEME_ACCENTS: ThemeAccentConfig[] = [
  {
    id: 'sky',
    name: 'Ocean Sky',
    nameJa: 'オーシャン・スカイ（青系）',
    category: '青系',
    primaryColor: '#0284c7', // sky-600
    hoverColor: '#0369a1', // sky-700
    lightColor: '#38bdf8', // sky-400
    subtleBg: 'rgba(2, 132, 199, 0.12)',
    subtleBorder: 'rgba(56, 189, 248, 0.3)',
    glowColor: 'rgba(2, 132, 199, 0.4)',
    gradient: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
    badgeBg: 'rgba(2, 132, 199, 0.15)',
    badgeText: '#38bdf8',
    sampleBg: '#0284c7',
  },
  {
    id: 'indigo',
    name: 'Neon Indigo',
    nameJa: 'ネオン・インディゴ（藍・青紫系）',
    category: '青紫系',
    primaryColor: '#6366f1', // indigo-500
    hoverColor: '#4f46e5', // indigo-600
    lightColor: '#818cf8', // indigo-400
    subtleBg: 'rgba(99, 102, 241, 0.12)',
    subtleBorder: 'rgba(129, 140, 248, 0.3)',
    glowColor: 'rgba(99, 102, 241, 0.4)',
    gradient: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
    badgeBg: 'rgba(99, 102, 241, 0.15)',
    badgeText: '#a5b4fc',
    sampleBg: '#6366f1',
  },
  {
    id: 'violet',
    name: 'Cosmic Violet',
    nameJa: 'コズミック・バイオレット（紫系）',
    category: '紫系',
    primaryColor: '#9333ea', // purple-600
    hoverColor: '#7e22ce', // purple-700
    lightColor: '#c084fc', // purple-400
    subtleBg: 'rgba(147, 51, 234, 0.12)',
    subtleBorder: 'rgba(192, 132, 252, 0.3)',
    glowColor: 'rgba(147, 51, 234, 0.4)',
    gradient: 'linear-gradient(135deg, #9333ea 0%, #6b21a8 100%)',
    badgeBg: 'rgba(147, 51, 234, 0.15)',
    badgeText: '#d8b4fe',
    sampleBg: '#a855f7',
  },
  {
    id: 'emerald',
    name: 'Emerald Aurora',
    nameJa: 'エメラルド・オーロラ（緑系）',
    category: '緑系',
    primaryColor: '#059669', // emerald-600
    hoverColor: '#047857', // emerald-700
    lightColor: '#34d399', // emerald-400
    subtleBg: 'rgba(5, 150, 105, 0.12)',
    subtleBorder: 'rgba(52, 211, 153, 0.3)',
    glowColor: 'rgba(5, 150, 105, 0.4)',
    gradient: 'linear-gradient(135deg, #059669 0%, #065f46 100%)',
    badgeBg: 'rgba(5, 150, 105, 0.15)',
    badgeText: '#6ee7b7',
    sampleBg: '#10b981',
  },
  {
    id: 'amber',
    name: 'Sunset Amber',
    nameJa: 'サンセット・アンバー（琥珀・ゴールド系）',
    category: '琥珀系',
    primaryColor: '#d97706', // amber-600
    hoverColor: '#b45309', // amber-700
    lightColor: '#fbbf24', // amber-400
    subtleBg: 'rgba(217, 119, 6, 0.12)',
    subtleBorder: 'rgba(251, 191, 36, 0.3)',
    glowColor: 'rgba(217, 119, 6, 0.4)',
    gradient: 'linear-gradient(135deg, #d97706 0%, #92400e 100%)',
    badgeBg: 'rgba(217, 119, 6, 0.15)',
    badgeText: '#fcd34d',
    sampleBg: '#f59e0b',
  },
  {
    id: 'rose',
    name: 'Rose Ruby',
    nameJa: 'ローズ・ルビー（紅・ピンク系）',
    category: '紅系',
    primaryColor: '#e11d48', // rose-600
    hoverColor: '#be123c', // rose-700
    lightColor: '#fb7185', // rose-400
    subtleBg: 'rgba(225, 29, 72, 0.12)',
    subtleBorder: 'rgba(251, 113, 133, 0.3)',
    glowColor: 'rgba(225, 29, 72, 0.4)',
    gradient: 'linear-gradient(135deg, #e11d48 0%, #9f1239 100%)',
    badgeBg: 'rgba(225, 29, 72, 0.15)',
    badgeText: '#fda4af',
    sampleBg: '#f43f5e',
  },
  {
    id: 'cyan',
    name: 'Cyber Cyan',
    nameJa: 'サイバー・シアン（水色・ターコイズ系）',
    category: '水色系',
    primaryColor: '#0891b2', // cyan-600
    hoverColor: '#0e7490', // cyan-700
    lightColor: '#22d3ee', // cyan-400
    subtleBg: 'rgba(8, 145, 178, 0.12)',
    subtleBorder: 'rgba(34, 211, 238, 0.3)',
    glowColor: 'rgba(8, 145, 178, 0.4)',
    gradient: 'linear-gradient(135deg, #0891b2 0%, #155e75 100%)',
    badgeBg: 'rgba(8, 145, 178, 0.15)',
    badgeText: '#67e8f9',
    sampleBg: '#06b6d4',
  },
];

const THEME_STORAGE_KEY = 'crosspost_theme_accent';

/**
 * 保存されたテーマアクセントを取得（デフォルトは 'sky'）
 */
export function getSavedThemeAccent(): ThemeAccentId {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeAccentId;
    if (saved && THEME_ACCENTS.some((t) => t.id === saved)) {
      return saved;
    }
  } catch (e) {
    console.warn('Failed to read theme from localStorage', e);
  }
  return 'sky';
}

/**
 * テーマアクセント設定を取得
 */
export function getThemeAccentConfig(id: ThemeAccentId): ThemeAccentConfig {
  const found = THEME_ACCENTS.find((t) => t.id === id);
  return found || THEME_ACCENTS[0];
}

/**
 * DOM（html/body）にテーマCSS変数を適用し、localStorageに保存
 */
export function applyThemeAccent(id: ThemeAccentId): void {
  try {
    const config = getThemeAccentConfig(id);
    const root = document.documentElement;

    root.setAttribute('data-theme', id);

    // CSSカスタムプロパティを直接設定
    root.style.setProperty('--accent-primary', config.primaryColor);
    root.style.setProperty('--accent-hover', config.hoverColor);
    root.style.setProperty('--accent-light', config.lightColor);
    root.style.setProperty('--accent-subtle-bg', config.subtleBg);
    root.style.setProperty('--accent-subtle-border', config.subtleBorder);
    root.style.setProperty('--accent-glow', config.glowColor);
    root.style.setProperty('--accent-gradient', config.gradient);
    root.style.setProperty('--accent-badge-bg', config.badgeBg);
    root.style.setProperty('--accent-badge-text', config.badgeText);

    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch (e) {
    console.warn('Failed to apply theme to DOM', e);
  }
}
