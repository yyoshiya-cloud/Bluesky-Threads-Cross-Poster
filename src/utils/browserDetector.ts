/**
 * ブラウザの名称およびバージョン、OS環境の高精度検出ユーティリティ
 * 通信ログおよび診断レポートに利用ブラウザの正確なバージョンを出力します。
 */

export interface BrowserDetails {
  name: string; // 例: "Google Chrome", "Microsoft Edge", "Mozilla Firefox"
  version: string; // 例: "128.0.6613.120"
  majorVersion: string; // 例: "128"
  os: string; // 例: "Windows 10/11", "macOS", "Linux", "iOS", "Android"
  osArch: string; // 例: "64-bit", "32-bit", "ARM"
  isMobile: boolean;
  userAgent: string;
  summary: string; // 例: "Google Chrome 128.0.6613.120 (Windows 64-bit)"
}

/**
 * 現在実行中のブラウザ環境の名称・バージョン・OSを検出
 */
export function getBrowserDetails(): BrowserDetails {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      name: 'Server / Node.js',
      version: typeof process !== 'undefined' ? process.version : 'unknown',
      majorVersion: 'unknown',
      os: 'Server',
      osArch: 'unknown',
      isMobile: false,
      userAgent: 'Server-side execution',
      summary: 'Server / Node.js Environment',
    };
  }

  const ua = navigator.userAgent || '';
  const appVersion = navigator.appVersion || '';
  const platform = navigator.platform || '';

  // -------------------------------------------------------------
  // 1. OS および アーキテクチャの検出
  // -------------------------------------------------------------
  let os = 'Unknown OS';
  let osArch = '';

  if (/Win(dows )?NT 10\.0/i.test(ua)) {
    os = 'Windows 10/11';
  } else if (/Win(dows )?NT 6\.3/i.test(ua)) {
    os = 'Windows 8.1';
  } else if (/Win(dows )?NT 6\.2/i.test(ua)) {
    os = 'Windows 8';
  } else if (/Win(dows )?NT 6\.1/i.test(ua)) {
    os = 'Windows 7';
  } else if (/Windows/i.test(ua)) {
    os = 'Windows';
  } else if (/iPhone/i.test(ua)) {
    os = 'iOS (iPhone)';
  } else if (/iPad/i.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    os = 'iPadOS';
  } else if (/Mac(intosh| OS X)/i.test(ua)) {
    const match = ua.match(/Mac OS X ([0-9_]+)/);
    os = match ? `macOS ${match[1].replace(/_/g, '.')}` : 'macOS';
  } else if (/Android/i.test(ua)) {
    const match = ua.match(/Android ([0-9.]+)/);
    os = match ? `Android ${match[1]}` : 'Android';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  } else if (/CrOS/i.test(ua)) {
    os = 'ChromeOS';
  }

  if (/x64|x86_64|Win64|WOW64|amd64/i.test(ua) || /x86_64/i.test(platform)) {
    osArch = '64-bit';
  } else if (/arm64|aarch64/i.test(ua)) {
    osArch = 'ARM64';
  } else if (/i[36]86|x86|Win32/i.test(ua) || /Win32/i.test(platform)) {
    osArch = '32-bit';
  }

  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);

  // -------------------------------------------------------------
  // 2. ブラウザ名称およびバージョンの検出
  // 注意: Chromium系ブラウザは Chrome の文字列を含むため、判定順序が極めて重要です。
  // -------------------------------------------------------------
  let name = 'Unknown Browser';
  let version = 'unknown';

  // (1) Microsoft Edge (Chromium / Legacy)
  const edgeMatch = ua.match(/Edg(?:e|A|iOS)?\/([0-9.]+)/i);
  // (2) Opera
  const operaMatch = ua.match(/(?:OPR|Opera)\/([0-9.]+)/i);
  // (3) Vivaldi
  const vivaldiMatch = ua.match(/Vivaldi\/([0-9.]+)/i);
  // (4) Brave
  const isBrave =
    typeof (navigator as unknown as { brave?: { isBrave?: () => boolean } }).brave?.isBrave ===
    'function';
  // (5) Samsung Internet
  const samsungMatch = ua.match(/SamsungBrowser\/([0-9.]+)/i);
  // (6) Firefox
  const firefoxMatch = ua.match(/(?:Firefox|FxiOS)\/([0-9.]+)/i);
  // (7) Chrome / Chromium
  const chromeMatch = ua.match(/(?:Chrome|CriOS)\/([0-9.]+)/i);
  // (8) Safari
  const safariMatch = ua.match(/Version\/([0-9.]+).*Safari/i);
  // (9) pywebview / Desktop embedded WebView
  const isPyWebView = /pywebview/i.test(ua);

  if (isPyWebView) {
    name = 'CrossPost Desktop (WebView)';
    const m = ua.match(/pywebview\/([0-9.]+)/i) || chromeMatch || edgeMatch;
    if (m) version = m[1];
  } else if (edgeMatch) {
    name = 'Microsoft Edge';
    version = edgeMatch[1];
  } else if (operaMatch) {
    name = 'Opera';
    version = operaMatch[1];
  } else if (vivaldiMatch) {
    name = 'Vivaldi';
    version = vivaldiMatch[1];
  } else if (isBrave && chromeMatch) {
    name = 'Brave';
    version = chromeMatch[1];
  } else if (samsungMatch) {
    name = 'Samsung Internet';
    version = samsungMatch[1];
  } else if (chromeMatch) {
    name = 'Google Chrome';
    version = chromeMatch[1];
  } else if (firefoxMatch) {
    name = 'Mozilla Firefox';
    version = firefoxMatch[1];
  } else if (safariMatch) {
    name = 'Apple Safari';
    version = safariMatch[1];
  } else {
    // 汎用マッチ
    const genericMatch = ua.match(/(?:Version|rv:?)\s*([0-9.]+)/i);
    if (genericMatch) {
      name = navigator.appName || 'Web Browser';
      version = genericMatch[1];
    }
  }

  const majorVersion = version.split('.')[0] || 'unknown';

  // サマリー文字列作成
  const osPart = [os, osArch].filter(Boolean).join(' ');
  const summary = `${name} ${version} (${osPart})`;

  return {
    name,
    version,
    majorVersion,
    os,
    osArch,
    isMobile,
    userAgent: ua,
    summary,
  };
}

/**
 * 通信ログ出力用のブラウザサマリー文字列を一行で取得
 * 例: "Google Chrome 128.0.6613.120 (Windows 10/11 64-bit)"
 */
export function getBrowserSummaryString(): string {
  return getBrowserDetails().summary;
}
