import { APP_VERSION as DEFAULT_APP_VERSION } from '../config/appInfo';
import { deleteFromVault } from './accountVault';

const ADMIN_PASSWORD_KEY = 'crosspost_admin_password';
const CUSTOM_APP_VERSION_KEY = 'crosspost_app_version';
const DEFAULT_ADMIN_PASSWORD = 'admin';

/**
 * 現在設定されている管理者パスワードを取得（初期値: "admin"）
 */
export function getAdminPassword(): string {
  try {
    const saved = localStorage.getItem(ADMIN_PASSWORD_KEY);
    return saved || DEFAULT_ADMIN_PASSWORD;
  } catch {
    return DEFAULT_ADMIN_PASSWORD;
  }
}

/**
 * 管理者パスワードを変更・保存
 */
export function setAdminPassword(newPassword: string): boolean {
  try {
    if (!newPassword || newPassword.trim().length === 0) return false;
    localStorage.setItem(ADMIN_PASSWORD_KEY, newPassword.trim());
    return true;
  } catch {
    return false;
  }
}

/**
 * 入力された管理者パスワードを検証
 */
export function verifyAdminPassword(input: string): boolean {
  const current = getAdminPassword();
  return input.trim() === current;
}

/**
 * アプリの表示バージョンを取得（管理者による変更値があれば優先）
 */
export function getAppVersion(): string {
  try {
    const customVersion = localStorage.getItem(CUSTOM_APP_VERSION_KEY);
    if (customVersion && customVersion.trim()) {
      return customVersion.trim();
    }
  } catch {
    // fallback
  }
  return DEFAULT_APP_VERSION || '1.0.4';
}

/**
 * アプリの表示バージョンを変更・保存
 */
export function setAppVersion(newVersion: string): boolean {
  try {
    if (!newVersion || newVersion.trim().length === 0) return false;
    localStorage.setItem(CUSTOM_APP_VERSION_KEY, newVersion.trim());
    return true;
  } catch {
    return false;
  }
}

/**
 * LIVEモードで記憶しているアカウント接続情報（Bluesky, Threads）の初期化処理
 * ※ DEMOモードの接続情報は変更・初期化されません。
 */
export function resetAccountConnections(): void {
  try {
    // 1. Vault（ローカル永続ストレージおよびサーバー保管庫）からLIVEモードの本番アカウント情報を消去
    deleteFromVault('all');

    // 2. LIVEモード用の認証情報およびアクティブセッションキーを消去
    const keysToRemove = [
      'crosspost_bluesky_session',
      'crosspost_threads_token',
      'bsky_session',
      'threads_session',
    ];
    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    // 3. crosspost_credentials がデモ情報でない本番接続情報を含む場合はクリア
    const rawCreds = localStorage.getItem('crosspost_credentials');
    if (rawCreds) {
      try {
        const parsed = JSON.parse(rawCreds);
        const isDemo =
          parsed?.isDemoMode ||
          Boolean(
            (parsed?.blueskyIdentifier && parsed.blueskyIdentifier.toLowerCase().includes('demo')) ||
            (parsed?.threadsAccessToken && parsed.threadsAccessToken.toUpperCase().includes('DEMO'))
          );
        if (!isDemo) {
          localStorage.removeItem('crosspost_credentials');
        }
      } catch {
        localStorage.removeItem('crosspost_credentials');
      }
    }
  } catch (err) {
    console.error('Failed to reset account connections:', err);
  }
}
