import { ApiCredentials, SavedAccountVault } from '../types';
import { encryptSecret, decryptSecret, isEncryptedString } from './cryptoStorage';

const VAULT_STORAGE_KEY = 'cross_poster_saved_vault_v2';
const LEGACY_VAULT_KEY = 'cross_poster_saved_vault';

// 60日間のミリ秒 (Meta Threads Long-Lived Token 標準有効期間)
export const DEFAULT_THREADS_EXPIRY_MS = 60 * 24 * 60 * 60 * 1000;

// メモリ内キャッシュ（即時アクセス用）
let inMemoryVault: SavedAccountVault | null = null;

/**
 * ローカルストレージから保存済みの本番アカウント情報を同期取得
 */
export function getSavedAccountVault(): SavedAccountVault {
  if (typeof window === 'undefined') return {};
  if (inMemoryVault) return inMemoryVault;

  try {
    // 新バージョンまたは旧バージョンのVaultを確認
    let raw = localStorage.getItem(VAULT_STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_VAULT_KEY);
    }
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};

    // 旧バージョンからの移行または復号処理（非同期でバックグラウンド実行）
    inMemoryVault = parsed;
    hydrateVaultDecryption(parsed);

    return parsed;
  } catch (e) {
    console.error('Failed to load saved account vault:', e);
    return {};
  }
}

/**
 * バックグラウンドで暗号化文字列を復号化してメモリキャッシュを更新
 */
async function hydrateVaultDecryption(vault: SavedAccountVault) {
  let changed = false;
  const cloned: SavedAccountVault = JSON.parse(JSON.stringify(vault));

  if (cloned.bluesky?.appPassword && isEncryptedString(cloned.bluesky.appPassword)) {
    const dec = await decryptSecret(cloned.bluesky.appPassword);
    if (dec) {
      cloned.bluesky.appPassword = dec;
      changed = true;
    }
  }

  if (cloned.threads?.accessToken && isEncryptedString(cloned.threads.accessToken)) {
    const dec = await decryptSecret(cloned.threads.accessToken);
    if (dec) {
      cloned.threads.accessToken = dec;
      changed = true;
    }
  }

  if (changed) {
    inMemoryVault = cloned;
  }
}

/**
 * 有効な本番アカウント情報をVault（暗号化永続保管庫）に保存
 */
export function saveCredentialsToVault(creds: Partial<ApiCredentials>): {
  savedBluesky: boolean;
  savedThreads: boolean;
} {
  if (typeof window === 'undefined') return { savedBluesky: false, savedThreads: false };

  const currentVault = getSavedAccountVault();
  const updatedVault: SavedAccountVault = { ...currentVault, vaultVersion: 2 };
  let savedBluesky = false;
  let savedThreads = false;

  const now = Date.now();

  // 1. Bluesky のチェック & 保存
  if (creds.blueskyIdentifier && creds.blueskyAppPassword) {
    const isDemo =
      creds.blueskyIdentifier.toLowerCase().includes('demo') ||
      creds.blueskyAppPassword.toLowerCase().includes('demo-pass');

    if (!isDemo) {
      updatedVault.bluesky = {
        identifier: creds.blueskyIdentifier.trim(),
        appPassword: creds.blueskyAppPassword.trim(),
        serviceUrl: creds.blueskyServiceUrl?.trim() || 'https://bsky.social',
        handle: (creds.blueskyHandle || creds.blueskyIdentifier).replace(/^@/, '').trim(),
        did: creds.blueskyDid,
        savedAt: now,
        isEncrypted: true,
      };
      savedBluesky = true;
    }
  }

  // 2. Threads のチェック & 保存（Long-Lived Token 有効期限と暗号化保持）
  if (creds.threadsAccessToken) {
    const isDemo =
      (creds.threadsUserId || '').toLowerCase().includes('demo') ||
      creds.threadsAccessToken.toLowerCase().includes('demo') ||
      creds.threadsAccessToken.toLowerCase().includes('th_long_lived_token');

    if (!isDemo) {
      const expiresAt =
        creds.threadsTokenExpiresAt && creds.threadsTokenExpiresAt > now
          ? creds.threadsTokenExpiresAt
          : currentVault.threads?.tokenExpiresAt && currentVault.threads.tokenExpiresAt > now
          ? currentVault.threads.tokenExpiresAt
          : now + DEFAULT_THREADS_EXPIRY_MS;

      const refreshedAt = creds.threadsTokenRefreshedAt || currentVault.threads?.tokenRefreshedAt || now;
      const expiresIn = creds.threadsTokenExpiresIn || Math.floor((expiresAt - now) / 1000);

      updatedVault.threads = {
        userId: creds.threadsUserId?.trim() || 'me',
        accessToken: creds.threadsAccessToken.trim(),
        username: creds.threadsUsername?.trim() || '',
        savedAt: currentVault.threads?.savedAt || now,
        tokenExpiresAt: expiresAt,
        tokenRefreshedAt: refreshedAt,
        expiresIn: expiresIn,
        isEncrypted: true,
      };
      savedThreads = true;
    }
  }

  inMemoryVault = { ...updatedVault };

  // 暗号化して非同期で永続化
  persistEncryptedVault(updatedVault);

  return { savedBluesky, savedThreads };
}

/**
 * 暗号化してローカルストレージへ永続化
 */
async function persistEncryptedVault(vault: SavedAccountVault) {
  try {
    const payloadToStore: SavedAccountVault = JSON.parse(JSON.stringify(vault));

    if (payloadToStore.bluesky?.appPassword && !isEncryptedString(payloadToStore.bluesky.appPassword)) {
      payloadToStore.bluesky.appPassword = await encryptSecret(payloadToStore.bluesky.appPassword);
    }

    if (payloadToStore.threads?.accessToken && !isEncryptedString(payloadToStore.threads.accessToken)) {
      payloadToStore.threads.accessToken = await encryptSecret(payloadToStore.threads.accessToken);
    }

    payloadToStore.encryptedAt = Date.now();
    localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(payloadToStore));
  } catch (e) {
    console.error('Failed to persist encrypted vault:', e);
  }
}

/**
 * Threads トークン更新時の専用Vault更新関数
 */
export async function updateThreadsTokenInVault(
  newAccessToken: string,
  expiresInSeconds?: number,
  newExpiresAt?: number,
  refreshedAt?: number
): Promise<SavedAccountVault> {
  const current = getSavedAccountVault();
  const now = Date.now();
  const expiry = newExpiresAt || (expiresInSeconds ? now + expiresInSeconds * 1000 : now + DEFAULT_THREADS_EXPIRY_MS);
  const refreshed = refreshedAt || now;

  const updated: SavedAccountVault = {
    ...current,
    threads: current.threads
      ? {
          ...current.threads,
          accessToken: newAccessToken,
          tokenExpiresAt: expiry,
          tokenRefreshedAt: refreshed,
          expiresIn: expiresInSeconds || Math.floor((expiry - now) / 1000),
          isEncrypted: true,
        }
      : {
          userId: 'me',
          accessToken: newAccessToken,
          username: '',
          savedAt: now,
          tokenExpiresAt: expiry,
          tokenRefreshedAt: refreshed,
          expiresIn: expiresInSeconds || 5184000,
          isEncrypted: true,
        },
  };

  inMemoryVault = { ...updated };
  await persistEncryptedVault(updated);
  return updated;
}

/**
 * 保存済みアカウント情報が存在するか判定
 */
export function hasSavedAccount(platform?: 'bluesky' | 'threads' | 'any'): boolean {
  const vault = getSavedAccountVault();
  if (platform === 'bluesky') return Boolean(vault.bluesky?.identifier && vault.bluesky?.appPassword);
  if (platform === 'threads') return Boolean(vault.threads?.accessToken);
  return Boolean(
    (vault.bluesky?.identifier && vault.bluesky?.appPassword) || vault.threads?.accessToken
  );
}

export const hasSavedAccountInVault = hasSavedAccount;

/**
 * 保存済みアカウント情報から現在の認証情報を非同期復元（完全復号化を保証）
 */
export async function restoreFromVaultAsync(
  current: ApiCredentials,
  platform: 'all' | 'bluesky' | 'threads' = 'all'
): Promise<ApiCredentials> {
  const vault = getSavedAccountVault();
  await hydrateVaultDecryption(vault);
  return restoreFromVault(current, platform);
}

/**
 * 保存済みアカウント情報から現在の認証情報を復元（再ログイン）
 */
export function restoreFromVault(
  current: ApiCredentials,
  platform: 'all' | 'bluesky' | 'threads' = 'all'
): ApiCredentials {
  const vault = getSavedAccountVault();
  const next: ApiCredentials = { ...current };

  if (platform === 'all' || platform === 'bluesky') {
    if (vault.bluesky?.identifier && vault.bluesky?.appPassword) {
      next.blueskyIdentifier = vault.bluesky.identifier;
      next.blueskyAppPassword = vault.bluesky.appPassword;
      next.blueskyServiceUrl = vault.bluesky.serviceUrl || 'https://bsky.social';
      next.blueskyHandle = vault.bluesky.handle || vault.bluesky.identifier;
      next.blueskyDid = vault.bluesky.did;
      next.blueskyConnected = true;
    }
  }

  if (platform === 'all' || platform === 'threads') {
    if (vault.threads?.accessToken) {
      next.threadsUserId = vault.threads.userId || 'me';
      next.threadsAccessToken = vault.threads.accessToken;
      next.threadsUsername = vault.threads.username || '@Threads_User';
      next.threadsConnected = true;
      next.threadsTokenExpiresAt = vault.threads.tokenExpiresAt;
      next.threadsTokenRefreshedAt = vault.threads.tokenRefreshedAt;
      next.threadsTokenExpiresIn = vault.threads.expiresIn;
    }
  }

  return next;
}

/**
 * Vaultに保存されたアカウント情報を削除
 */
export function deleteFromVault(platform: 'all' | 'bluesky' | 'threads'): void {
  if (typeof window === 'undefined') return;
  try {
    const vault = getSavedAccountVault();
    if (platform === 'bluesky') {
      delete vault.bluesky;
    } else if (platform === 'threads') {
      delete vault.threads;
    } else {
      inMemoryVault = {};
      localStorage.removeItem(VAULT_STORAGE_KEY);
      localStorage.removeItem(LEGACY_VAULT_KEY);
      return;
    }
    inMemoryVault = { ...vault };
    persistEncryptedVault(vault);
  } catch (e) {
    console.error('Failed to delete from account vault:', e);
  }
}

/**
 * 日時の表示フォーマット
 */
export function formatSavedDate(timestamp?: number): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
