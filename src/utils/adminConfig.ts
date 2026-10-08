import { APP_VERSION as DEFAULT_APP_VERSION } from '../config/appInfo';
import { deleteFromVault } from './accountVault';
import { getAuthHeaders, setAuthToken } from './modeSecurity';

const CUSTOM_APP_VERSION_KEY = 'crosspost_app_version';
const MODE_SWITCH_CLICK_COUNT_KEY = 'crosspost_mode_switch_click_count';
const DEFAULT_MODE_SWITCH_CLICK_COUNT = 3;

// 古い平文パスワードがlocalStorageに残っている場合はセキュリティのため自動消去
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('crosspost_admin_password');
  } catch {
    // ignore
  }
}

/**
 * DEMO/LIVEモード切替に必要な左クリック回数を取得（初期値: 3回）
 */
export function getModeSwitchClickCount(): number {
  try {
    const saved = localStorage.getItem(MODE_SWITCH_CLICK_COUNT_KEY);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 20) {
        return parsed;
      }
    }
    return DEFAULT_MODE_SWITCH_CLICK_COUNT;
  } catch {
    return DEFAULT_MODE_SWITCH_CLICK_COUNT;
  }
}

/**
 * DEMO/LIVEモード切替に必要な左クリック回数を設定・保存（サーバー側にも同期）
 */
export function setModeSwitchClickCount(count: number): boolean {
  try {
    const validCount = Math.max(1, Math.min(20, Math.floor(count)));
    localStorage.setItem(MODE_SWITCH_CLICK_COUNT_KEY, validCount.toString());
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crosspost_mode_click_count_changed', { detail: { count: validCount } }));
      fetch('/api/auth/update-click-count', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ clickCount: validCount }),
      }).catch((err) => {
        console.warn('[Admin] Failed to sync clickCount to server:', err);
      });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 管理者パスワードをサーバー側で変更・保存
 */
export async function setAdminPassword(newPassword: string, currentPassword?: string): Promise<boolean> {
  try {
    if (!newPassword || newPassword.trim().length === 0) return false;
    const res = await fetch('/api/auth/update-admin-password', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        currentPassword: currentPassword?.trim() || '',
        newPassword: newPassword.trim(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success) {
      if (data.token) {
        setAuthToken(data.token, 'admin');
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 入力された管理者パスワードをサーバー側で検証し、署名付き管理者トークンを取得
 */
export async function verifyAdminPassword(input: string): Promise<boolean> {
  const clean = input.trim();
  if (!clean) return false;

  try {
    const res = await fetch('/api/auth/verify-admin', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ password: clean }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success && data?.token) {
      setAuthToken(data.token, 'admin');
      return true;
    }
    return false;
  } catch (err) {
    console.error('[Admin] Failed to verify admin password on server:', err);
    return false;
  }
}

let currentRuntimeVersion: string | null = null;

/**
 * サーバーの package.json から最新バージョンを取得してメモリ/キャッシュを同期
 */
export async function syncVersionWithServer(): Promise<string> {
  try {
    const res = await fetch('/api/admin/version', {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (data.success && data.version) {
      currentRuntimeVersion = data.version;
      try {
        localStorage.setItem(CUSTOM_APP_VERSION_KEY, data.version);
      } catch {}
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('crosspost_version_changed', { detail: { version: data.version } }));
      }
      return data.version;
    }
  } catch (e) {
    console.error('[Admin] Failed to sync version with server:', e);
  }
  return currentRuntimeVersion || DEFAULT_APP_VERSION;
}

/**
 * アプリの表示バージョンを取得（package.json から同期されたリアルタイムバージョン）
 */
export function getAppVersion(): string {
  if (currentRuntimeVersion) {
    return currentRuntimeVersion;
  }
  try {
    const saved = localStorage.getItem(CUSTOM_APP_VERSION_KEY);
    if (saved && saved.trim()) {
      return saved.trim();
    }
  } catch {}
  return DEFAULT_APP_VERSION;
}

/**
 * アプリの表示バージョンを変更・保存（package.jsonの書き換え：管理者トークン必須）
 */
export async function updatePackageJsonVersion(newVersion: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!newVersion || !newVersion.trim()) {
      return { success: false, error: '有効なバージョン番号を入力してください。' };
    }
    const cleanVersion = newVersion.trim();
    const res = await fetch('/api/admin/update-version', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ version: cleanVersion }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      currentRuntimeVersion = cleanVersion;
      try {
        localStorage.setItem(CUSTOM_APP_VERSION_KEY, cleanVersion);
      } catch {}
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('crosspost_version_changed', { detail: { version: cleanVersion } }));
      }
      return { success: true };
    }
    return { success: false, error: data.error || 'package.jsonの更新に失敗しました。' };
  } catch (err: any) {
    return { success: false, error: err.message || '通信エラーにより更新に失敗しました。' };
  }
}

export function setAppVersion(newVersion: string): boolean {
  try {
    if (!newVersion || !newVersion.trim()) return false;
    currentRuntimeVersion = newVersion.trim();
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
