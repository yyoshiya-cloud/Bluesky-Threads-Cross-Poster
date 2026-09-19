/**
 * デモモード / ライブモード切替時のパスワード保護ユーティリティ
 */

const STORAGE_KEY = 'crosspost_mode_security_v3';
const DEFAULT_PASSWORD = 'yo0117';

export interface ModeSecurityConfig {
  requirePassword: boolean; // パスワード入力のオン/オフ
  passwordHash: string; // SHA-256ハッシュ値
  updatedAt: number;
}

// 文字列のSHA-256ハッシュ計算
export async function hashPassword(password: string): Promise<string> {
  const clean = password.trim();
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    try {
      const msgBuffer = new TextEncoder().encode(`crosspost_salt_${clean}`);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // fallback below
    }
  }
  // 簡易フォールバックハッシュ（WebCrypto不可環境）
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    const char = clean.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `fb_${hash}_${clean.length}`;
}

// デフォルト初期パスワード（yo0117）の既知ハッシュキャッシュ（同期チェック用）
let defaultHashCache: string = '';
hashPassword(DEFAULT_PASSWORD).then((h) => {
  defaultHashCache = h;
});

export function getModeSecurityConfig(): ModeSecurityConfig {
  if (typeof window === 'undefined') {
    return {
      requirePassword: true,
      passwordHash: '',
      updatedAt: Date.now(),
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.requirePassword === 'boolean') {
        return {
          requirePassword: parsed.requirePassword,
          passwordHash: parsed.passwordHash || defaultHashCache,
          updatedAt: parsed.updatedAt || Date.now(),
        };
      }
    }
  } catch (e) {
    console.warn('Failed to parse mode security config:', e);
  }

  // デフォルト設定: パスワード要求オン、初期パスワード yo0117
  return {
    requirePassword: true,
    passwordHash: defaultHashCache,
    updatedAt: Date.now(),
  };
}

export function saveModeSecurityConfig(config: ModeSecurityConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('modeSecurityChanged', { detail: config }));
  } catch (e) {
    console.warn('Failed to save mode security config:', e);
  }
}

/**
 * 入力されたパスワードを検証
 */
export async function verifyModePassword(inputPassword: string): Promise<boolean> {
  const config = getModeSecurityConfig();
  const inputHash = await hashPassword(inputPassword);

  // 初回起動時などハッシュがまだ空の場合はデフォルト 'yo0117' と照合
  if (!config.passwordHash) {
    const defaultHash = await hashPassword(DEFAULT_PASSWORD);
    if (inputHash === defaultHash) {
      // デフォルトハッシュを保存
      config.passwordHash = defaultHash;
      saveModeSecurityConfig(config);
      return true;
    }
    return false;
  }

  return inputHash === config.passwordHash;
}

/**
 * 新しいパスワードに変更
 */
export async function updateModePassword(newPassword: string): Promise<void> {
  const hash = await hashPassword(newPassword);
  const current = getModeSecurityConfig();
  current.passwordHash = hash;
  current.updatedAt = Date.now();
  saveModeSecurityConfig(current);
}

/**
 * パスワード要求のオン/オフを設定
 */
export function setModePasswordRequired(requirePassword: boolean): void {
  const current = getModeSecurityConfig();
  current.requirePassword = requirePassword;
  current.updatedAt = Date.now();
  saveModeSecurityConfig(current);
}

/**
 * パスワード保護をワンクリックでON（有効）に戻す
 */
export function enableModePasswordProtection(): void {
  setModePasswordRequired(true);
}
