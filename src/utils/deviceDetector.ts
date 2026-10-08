/**
 * ユーザーエージェント判別およびデバイス判定ユーティリティ
 */

import { useState, useEffect, useCallback } from 'react';

// スマートフォン・モバイル端末を判別する正規表現パターン
export const MOBILE_UA_REGEX =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Silk|Kindle|Windows Phone|SamsungBrowser/i;
export const TABLET_UA_REGEX = /iPad|Tablet/i;

/**
 * ユーザーエージェント文字列およびブラウザAPIからスマートフォン/モバイル端末であるかを高精度に判定
 */
export function isMobileUserAgent(customUa?: string): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Client Hints API (Chromium系ブラウザの最新仕様) による高速・確実なモバイル判別
  if (!customUa && typeof navigator !== 'undefined' && (navigator as any).userAgentData) {
    const isUaDataMobile = (navigator as any).userAgentData.mobile;
    if (typeof isUaDataMobile === 'boolean') {
      return isUaDataMobile;
    }
  }

  const ua =
    customUa ||
    (typeof navigator !== 'undefined'
      ? navigator.userAgent || navigator.vendor || (window as any).opera || ''
      : '');

  // 2. iOS 13+ iPadOS (MacIntelとして偽装される場合) のタッチポイントおよび画面幅判定
  const isIpadOS =
    /Macintosh/i.test(ua) &&
    typeof navigator !== 'undefined' &&
    navigator.maxTouchPoints > 1 &&
    window.innerWidth <= 1024;

  // 3. 一般的なモバイル端末正規表現マッチング
  return MOBILE_UA_REGEX.test(ua) || isIpadOS;
}

/**
 * タッチ対応デバイスであるかを判定
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches
  );
}

export type ViewModePreference = 'auto' | 'mobile' | 'desktop';

export const VIEW_MODE_STORAGE_KEY = 'crosspost_view_mode_pref';

/**
 * 保存された表示モード設定を取得
 */
export function getSavedViewModePreference(): ViewModePreference {
  if (typeof window === 'undefined') return 'auto';
  try {
    const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (saved === 'mobile' || saved === 'desktop' || saved === 'auto') {
      return saved;
    }
  } catch (_) {}
  return 'auto';
}

/**
 * 表示モード設定を保存
 */
export function saveViewModePreference(mode: ViewModePreference): void {
  try {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  } catch (_) {}
}

/**
 * ユーザーエージェントおよび画面サイズを総合的に監視するカスタムフック
 */
export function useDeviceMode() {
  const [userAgentMobile, setUserAgentMobile] = useState<boolean>(() => isMobileUserAgent());
  const [viewModePref, setViewModePref] = useState<ViewModePreference>(() => getSavedViewModePreference());
  const [windowWidth, setWindowWidth] = useState<number>(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));

  useEffect(() => {
    const check = () => {
      const isUaMobile = isMobileUserAgent();
      setUserAgentMobile(isUaMobile);
      setWindowWidth(window.innerWidth);
    };

    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, []);

  // 総合的なモバイルUI有効フラグの決定
  // 1. 手動指定 'mobile' -> 常にモバイルUI
  // 2. 手動指定 'desktop' -> 常にデスクトップUI
  // 3. 'auto' -> ユーザーエージェントがスマホ、または画面幅が768px以下の場合にモバイルUI
  const isMobile = 
    viewModePref === 'mobile' || 
    (viewModePref === 'auto' && (userAgentMobile || windowWidth <= 768));

  const setViewMode = useCallback((mode: ViewModePreference) => {
    setViewModePref(mode);
    saveViewModePreference(mode);
  }, []);

  const toggleViewMode = useCallback(() => {
    const nextMode: ViewModePreference = isMobile ? 'desktop' : 'mobile';
    setViewMode(nextMode);
  }, [isMobile, setViewMode]);

  return {
    isMobile,
    isMobileUserAgent: userAgentMobile,
    windowWidth,
    viewModePreference: viewModePref,
    setViewMode,
    toggleViewMode,
  };
}
