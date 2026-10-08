import packageJson from '../../package.json';

/**
 * -------------------------------------------------------------
 * アプリケーション基本情報・バージョン定義（一元管理型）
 * -------------------------------------------------------------
 * package.json を単一の真実（Single Source of Truth）として自動参照します。
 */

export interface AppVersionDetail {
  version: string;
  major: number;
  minor: number;
  patch: number;
  releaseDate: string;
  buildNumber: string;
  channel: 'stable' | 'beta' | 'preview';
  name: string;
  description: string;
}

const rawVersion = packageJson.version || '1.0.0';
const [majorStr = '1', minorStr = '0', patchStr = '0'] = rawVersion.split('.');
const major = parseInt(majorStr, 10) || 1;
const minor = parseInt(minorStr, 10) || 0;
const patch = parseInt(patchStr, 10) || 0;

/**
 * プログラム内包のマスターバージョン情報（package.jsonから一元参照）
 */
export const APP_VERSION_INFO: AppVersionDetail = {
  version: rawVersion,
  major,
  minor,
  patch,
  releaseDate: '2026-09-29',
  buildNumber: `20260929.${patch}`,
  channel: 'stable',
  name: 'CrossPost Web Studio',
  description: 'Bluesky & Threads 同時・分割配信マルチプラットフォームスタジオ',
};

// プログラム内に内包されたバージョン定数
export const APP_VERSION: string = APP_VERSION_INFO.version;

// ビルド/リリース日時 (ISO 8601 文字列または日付)
export const APP_BUILD_DATE: string = APP_VERSION_INFO.releaseDate;

// アプリケーション名称
export const APP_NAME: string = APP_VERSION_INFO.name;

/**
 * 日本語フォーマットの最終更新日時を生成
 * 例: "2026年9月29日"
 */
export function formatAppBuildDate(dateString?: string): string {
  try {
    const target = dateString || APP_BUILD_DATE;
    const d = new Date(target);
    if (isNaN(d.getTime())) {
      return '2026年9月29日';
    }
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${year}年${month}月${day}日`;
  } catch {
    return '2026年9月29日';
  }
}
