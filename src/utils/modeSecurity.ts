/**
 * デモモード / ライブモード切替時のパスワード保護 & サーバー認証トークン管理ユーティリティ
 * （初期パスワードのクライアント側ハードコードを廃止し、サーバー側環境変数・PBKDF2ハッシュ検証へ移行）
 */

const STORAGE_KEY = 'crosspost_mode_security_v4';
const AUTH_TOKEN_STORAGE_KEY = 'crosspost_session_auth_token';
const AUTH_ROLE_STORAGE_KEY = 'crosspost_session_auth_role';

export interface ModeSecurityConfig {
  requirePassword: boolean; // パスワード入力のオン/オフ
  passwordHash?: string; // 互換用フィールド（クライアント側にはハッシュ値を持たせない）
  updatedAt: number;
}

let memoryAuthToken: string | null = null;
let memoryAuthRole: 'live' | 'admin' | null = null;
let lastVerifiedPasswordCache: string | null = null;
let serverConfigSynced = false;

/**
 * サーバーから発行された署名付き認証トークンを保存
 */
export function setAuthToken(token: string, role: 'live' | 'admin' = 'live'): void {
  memoryAuthToken = token;
  memoryAuthRole = role;
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
      sessionStorage.setItem(AUTH_ROLE_STORAGE_KEY, role);
    } catch {
      // ignore storage errors
    }
  }
}

/**
 * 保持している認証トークンを取得
 */
export function getAuthToken(): string | null {
  if (memoryAuthToken) return memoryAuthToken;
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
      if (stored) {
        memoryAuthToken = stored;
        return stored;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * 保持している認証ロールを取得
 */
export function getAuthRole(): 'live' | 'admin' | null {
  if (memoryAuthRole) return memoryAuthRole;
  if (typeof window !== 'undefined') {
    try {
      const role = sessionStorage.getItem(AUTH_ROLE_STORAGE_KEY) as 'live' | 'admin' | null;
      if (role) {
        memoryAuthRole = role;
        return role;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * 認証トークンをクリア
 */
export function clearAuthToken(): void {
  memoryAuthToken = null;
  memoryAuthRole = null;
  lastVerifiedPasswordCache = null;
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      sessionStorage.removeItem(AUTH_ROLE_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

/**
 * 保護されたサーバーAPI呼び出し用の認証ヘッダーを生成
 */
export function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'X-Requested-With': 'CrossPostStudio',
    ...extraHeaders,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * サーバー側のセキュリティ設定（パスワード要求ON/OFF等）と同期
 */
export async function syncSecurityConfigFromServer(): Promise<ModeSecurityConfig> {
  if (typeof window === 'undefined') {
    return { requirePassword: true, updatedAt: Date.now() };
  }
  try {
    const res = await fetch('/api/auth/config', {
      headers: getAuthHeaders(),
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && typeof data.requirePassword === 'boolean') {
        const cfg: ModeSecurityConfig = {
          requirePassword: data.requirePassword,
          updatedAt: data.updatedAt || Date.now(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
        serverConfigSynced = true;
        if (typeof data.clickCount === 'number') {
          localStorage.setItem('crosspost_mode_switch_click_count', String(data.clickCount));
          window.dispatchEvent(
            new CustomEvent('crosspost_mode_click_count_changed', { detail: { count: data.clickCount } })
          );
        }
        return cfg;
      }
    }
  } catch (e) {
    console.warn('[modeSecurity] Failed to sync security config from server:', e);
  }
  return getModeSecurityConfig();
}

export function getModeSecurityConfig(): ModeSecurityConfig {
  if (typeof window === 'undefined') {
    return {
      requirePassword: true,
      updatedAt: Date.now(),
    };
  }

  if (!serverConfigSynced) {
    serverConfigSynced = true;
    syncSecurityConfigFromServer().catch(() => {});
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        requirePassword: typeof parsed.requirePassword === 'boolean' ? parsed.requirePassword : true,
        updatedAt: parsed.updatedAt || Date.now(),
      };
    }
  } catch (e) {
    console.warn('Failed to parse mode security config:', e);
  }

  return {
    requirePassword: true,
    updatedAt: Date.now(),
  };
}

export function saveModeSecurityConfig(config: ModeSecurityConfig): void {
  if (typeof window === 'undefined') return;
  try {
    const cleanConfig: ModeSecurityConfig = {
      requirePassword: config.requirePassword,
      updatedAt: config.updatedAt || Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanConfig));
    window.dispatchEvent(new CustomEvent('modeSecurityChanged', { detail: cleanConfig }));
  } catch (e) {
    console.warn('Failed to save mode security config:', e);
  }
}

/**
 * 入力されたLIVEモード切替パスワードをサーバー側で検証し、署名付きセッショントークンを取得
 */
export async function verifyModePassword(inputPassword: string): Promise<boolean> {
  const clean = inputPassword.trim();
  if (!clean) return false;

  try {
    const res = await fetch('/api/auth/verify-mode', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ password: clean }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success && data?.token) {
      setAuthToken(data.token, data.role === 'admin' ? 'admin' : 'live');
      lastVerifiedPasswordCache = clean;
      return true;
    }
    return false;
  } catch (err) {
    console.error('[modeSecurity] Server password verification failed:', err);
    return false;
  }
}

/**
 * 新しいLIVEモードパスワードにサーバー側で変更
 */
export async function updateModePassword(newPassword: string, currentPassword?: string): Promise<boolean> {
  const cleanNew = newPassword.trim();
  const cleanCurrent = (currentPassword || lastVerifiedPasswordCache || '').trim();
  if (!cleanNew) return false;

  try {
    const res = await fetch('/api/auth/update-mode-password', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        currentPassword: cleanCurrent,
        newPassword: cleanNew,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success) {
      if (data.token) {
        setAuthToken(data.token, 'live');
      }
      lastVerifiedPasswordCache = cleanNew;
      const current = getModeSecurityConfig();
      current.updatedAt = Date.now();
      saveModeSecurityConfig(current);
      return true;
    }
    return false;
  } catch (err) {
    console.error('[modeSecurity] Failed to update mode password on server:', err);
    return false;
  }
}

/**
 * パスワード要求のオン/オフを設定（サーバー側にも同期）
 */
export function setModePasswordRequired(requirePassword: boolean): void {
  const current = getModeSecurityConfig();
  current.requirePassword = requirePassword;
  current.updatedAt = Date.now();
  saveModeSecurityConfig(current);

  if (typeof window !== 'undefined') {
    fetch('/api/auth/update-mode-protection', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ requirePassword }),
    }).catch((err) => {
      console.warn('[modeSecurity] Failed to sync requirePassword to server:', err);
    });
  }
}

/**
 * パスワード保護をワンクリックでON（有効）に戻す
 */
export function enableModePasswordProtection(): void {
  setModePasswordRequired(true);
}
