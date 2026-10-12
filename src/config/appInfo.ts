import packageJson from '../../package.json';

declare const __APP_VERSION__: string | undefined;
declare const __APP_BUILD_DATE__: string | undefined;

/**
 * -------------------------------------------------------------
 * アプリケーション基本情報・バージョン＆最終更新日（デプロイ日）定義
 * -------------------------------------------------------------
 * アプリ情報画面に表示されるバージョン情報と最終更新日（デプロイ日）のデータを
 * アプリ内に一元保持します。
 */

export interface AppVersionDetail {
  version: string;
  major: number;
  minor: number;
  patch: number;
  releaseDate: string;
  deployedDate: string;
  buildNumber: string;
  channel: 'stable' | 'beta' | 'preview';
  name: string;
  description: string;
}

/**
 * 現在の日本時間 (JST) の日付を YYYY-MM-DD 形式で取得
 */
export function getCurrentJstDateString(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    return '2026-10-12';
  }
}

const rawVersion =
  (typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__) ||
  packageJson.version ||
  '1.1.0';

// デプロイ日（ビルド時に注入された日付、またはデプロイ当日 2026-10-12）
const rawDeployDate =
  (typeof __APP_BUILD_DATE__ !== 'undefined' && __APP_BUILD_DATE__) ||
  '2026-10-12';

const [majorStr = '1', minorStr = '1', patchStr = '0'] = rawVersion.split('.');
const major = parseInt(majorStr, 10) || 1;
const minor = parseInt(minorStr, 10) || 0;
const patch = parseInt(patchStr, 10) || 0;

/**
 * アプリ内に保持するバージョン情報・最終更新日（デプロイ日）マスターデータ
 */
export const APP_VERSION_INFO: AppVersionDetail = {
  version: rawVersion,
  major,
  minor,
  patch,
  releaseDate: rawDeployDate,
  deployedDate: rawDeployDate,
  buildNumber: `${rawDeployDate.replace(/-/g, '')}.${patch}`,
  channel: 'stable',
  name: 'CrossPost Web Studio',
  description: 'Bluesky & Threads 同時・分割配信マルチプラットフォームスタジオ',
};

// アプリ内に保持されたバージョン定数
export const APP_VERSION: string = APP_VERSION_INFO.version;

// アプリ内に保持された最終更新日（デプロイ日）定数
export const APP_BUILD_DATE: string = APP_VERSION_INFO.deployedDate;

// アプリケーション名称
export const APP_NAME: string = APP_VERSION_INFO.name;

/**
 * 日本語フォーマットの最終更新日（デプロイ日）を生成
 * 例: "2026年10月12日"
 */
export function formatAppBuildDate(dateString?: string): string {
  try {
    const target = (dateString || APP_BUILD_DATE || '2026-10-12').trim();

    // YYYY-MM-DD 形式の場合はタイムゾーンずれを防ぐため直接パース
    const ymdMatch = target.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10);
      const day = parseInt(ymdMatch[3], 10);
      return `${year}年${month}月${day}日`;
    }

    const d = new Date(target);
    if (isNaN(d.getTime())) {
      return '2026年10月12日';
    }

    // 日本時間 (Asia/Tokyo) で年月日を算出
    const parts = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(d);

    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;

    if (year && month && day) {
      return `${year}年${month}月${day}日`;
    }

    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  } catch {
    return '2026年10月12日';
  }
}
