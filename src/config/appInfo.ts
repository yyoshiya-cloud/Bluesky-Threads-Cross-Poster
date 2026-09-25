import pkg from '../../package.json';

// ビルド時に Vite (vite.config.ts) の define によって自動注入されるグローバル変数
declare const __APP_VERSION__: string | undefined;
declare const __APP_BUILD_DATE__: string | undefined;

/**
 * -------------------------------------------------------------
 * アプリケーション基本情報・バージョン管理
 * -------------------------------------------------------------
 * 
 * 【バージョンの変更方法】
 * 1. package.json の "version": "1.0.0" を変更するだけで、
 *    ヘッダー、アプリ情報モーダル、システム全体に自動反映されます。
 *    （例: "1.1.0" や "2.0.0"）
 * 2. または、ターミナルで `npm version minor` や `npm version patch` を
 *    実行することでも安全にバージョンを更新できます。
 * 
 * 【最終更新日時の自動更新】
 * - GitHubへPushした際（Gitコミット日時）または
 * - アプリをPublish/デプロイ（Viteビルド）した際の日時が自動的に埋め込まれます。
 */

// アプリの現在のバージョン
export const APP_VERSION: string =
  typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__
    ? __APP_VERSION__
    : pkg.version || '1.0.0';

// ビルド/コミット日時 (ISO 8601 文字列)
export const APP_BUILD_DATE: string =
  typeof __APP_BUILD_DATE__ !== 'undefined' && __APP_BUILD_DATE__
    ? __APP_BUILD_DATE__
    : new Date().toISOString();

// アプリ名
export const APP_NAME = 'CrossPost Web Studio';

/**
 * 日本語フォーマットの最終更新日時を生成
 * 例: "2026年9月25日"
 */
export function formatAppBuildDate(dateString?: string): string {
  try {
    const target = dateString || APP_BUILD_DATE;
    const d = new Date(target);
    if (isNaN(d.getTime())) {
      return '2026年9月25日';
    }
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${year}年${month}月${day}日`;
  } catch {
    return '2026年9月25日';
  }
}
