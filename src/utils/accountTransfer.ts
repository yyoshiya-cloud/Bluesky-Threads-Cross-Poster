/**
 * 他のPCやブラウザ間でアカウント情報を安全に移行（ダウンロード・アップロード）するための
 * ポータブル AES-256-GCM 暗号化・復元モジュール
 *
 * 【仕様】
 * - 平文（非暗号化）:
 *     - Bluesky ハンドル / ID (identifier, handle, did, serviceUrl)
 *     - Threads アカウント名 (username)
 *     - Threads USER ID (userId)
 *     - Threads AccessToken 有効期限 (tokenExpiresAt, tokenRefreshedAt, expiresIn)
 * - AES-256 暗号化:
 *     - Bluesky アプリパスワード (appPassword)
 *     - Threads AccessToken (accessToken)
 */

import { SavedAccountVault, ApiCredentials, SavedBlueskyAccount, SavedThreadsAccount } from '../types';
import { getSavedAccountVault, saveCredentialsToVault, syncVaultToServer, restoreFromVaultAsync } from './accountVault';
import { isEncryptedString, decryptSecret } from './cryptoStorage';

// ポータブル暗号化の共通マスターソルト & シード
const PORTABLE_MASTER_SALT = 'crosspost_cross_device_transfer_master_salt_v1';
const PORTABLE_MASTER_PASSPHRASE = 'crosspost_standard_portable_aes256_key_secure_transfer';
const PORTABLE_ENCRYPTED_PREFIX = 'enc:aes-256-gcm:portable:v1:';

// ArrayBuffer -> Base64
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Base64 -> Uint8Array
function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 任意のパスフレーズ（または標準ポータブルシード）から 256-bit AES-GCM CryptoKey を派生
 */
async function derivePortableCryptoKey(passphrase?: string, customSalt?: Uint8Array): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  const enc = new TextEncoder();
  const secretPass = passphrase && passphrase.trim() ? passphrase.trim() : PORTABLE_MASTER_PASSPHRASE;
  
  let salt = customSalt;
  if (!salt) {
    salt = new Uint8Array(16);
    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(salt);
    } else {
      const fixed = enc.encode(PORTABLE_MASTER_SALT);
      for (let i = 0; i < 16; i++) salt[i] = fixed[i % fixed.length];
    }
  }

  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(secretPass),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return { key, salt };
}

/**
 * 文字列をポータブル AES-256-GCM で暗号化
 * 出力形式: enc:aes-256-gcm:portable:v1:<salt_b64>:<iv_b64>:<ciphertext_b64>
 */
export async function encryptPortableSecret(plainText: string, passphrase?: string): Promise<string> {
  if (!plainText) return '';
  try {
    if (typeof window === 'undefined' || !window.crypto?.subtle) {
      throw new Error('WebCrypto API is not supported in this environment');
    }

    const { key, salt } = await derivePortableCryptoKey(passphrase);
    const iv = new Uint8Array(12);
    window.crypto.getRandomValues(iv);

    const enc = new TextEncoder();
    const encodedData = enc.encode(plainText);

    const cipherBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      encodedData
    );

    const saltB64 = bufferToBase64(salt.buffer);
    const ivB64 = bufferToBase64(iv.buffer);
    const cipherB64 = bufferToBase64(cipherBuffer);

    return `${PORTABLE_ENCRYPTED_PREFIX}${saltB64}:${ivB64}:${cipherB64}`;
  } catch (e: any) {
    console.error('[AccountTransfer] Failed to encrypt portable secret:', e);
    throw new Error(`AES-256 暗号化に失敗しました: ${e.message}`);
  }
}

/**
 * ポータブル AES-256-GCM 暗号化文字列を復号化
 */
export async function decryptPortableSecret(cipherText: string, passphrase?: string): Promise<string> {
  if (!cipherText) return '';
  
  // 平文の場合はそのまま返却
  if (!cipherText.startsWith('enc:')) {
    return cipherText;
  }

  // ポータブル AES-256 形式
  if (cipherText.startsWith(PORTABLE_ENCRYPTED_PREFIX)) {
    try {
      const raw = cipherText.replace(PORTABLE_ENCRYPTED_PREFIX, '');
      const parts = raw.split(':');
      if (parts.length !== 3) {
        throw new Error('暗号化トークンのフォーマットが不正です');
      }

      const [saltB64, ivB64, cipherB64] = parts;
      const salt = base64ToBuffer(saltB64);
      const iv = base64ToBuffer(ivB64);
      const cipherData = base64ToBuffer(cipherB64);

      const { key } = await derivePortableCryptoKey(passphrase, salt);

      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv,
        },
        key,
        cipherData
      );

      return new TextDecoder().decode(decryptedBuffer);
    } catch (e: any) {
      console.error('[AccountTransfer] Failed to decrypt portable secret:', e);
      throw new Error(`AES-256 復号化に失敗しました。パスワードが異なるか、データが破損しています。(${e.message})`);
    }
  }

  // 端末ローカル暗号化 (enc:aes-gcm:v1:) だった場合の復号フォールバック
  if (cipherText.startsWith('enc:aes-gcm:v1:') || cipherText.startsWith('enc:xor:v1:')) {
    const localDecrypted = await decryptSecret(cipherText);
    if (localDecrypted) return localDecrypted;
  }

  return cipherText;
}

/**
 * エクスポートされるアカウントバックアップデータの構造
 */
export interface AccountExportData {
  format: 'crosspost_account_vault_aes256';
  version: 1;
  exportedAt: number;
  exportedAtFormatted: string;
  meta: {
    title: string;
    description: string;
    encryptionAlgorithm: 'AES-256-GCM';
    hasCustomPassword: boolean;
  };
  bluesky?: {
    identifier: string; // 平文
    handle: string; // 平文
    serviceUrl?: string; // 平文
    did?: string; // 平文
    savedAt?: number; // 平文
    appPassword: string; // AES-256 暗号化
  };
  threads?: {
    username: string; // 平文
    userId: string; // 平文
    tokenExpiresAt?: number; // 平文 (AccessToken有効期限)
    tokenExpiresAtFormatted?: string; // 平文
    tokenRefreshedAt?: number; // 平文
    expiresIn?: number; // 平文
    savedAt?: number; // 平文
    accessToken: string; // AES-256 暗号化
  };
}

/**
 * インポート・復号後のアカウント結果
 */
export interface DecryptedAccountResult {
  hasBluesky: boolean;
  hasThreads: boolean;
  bluesky?: {
    identifier: string;
    handle: string;
    appPassword: string; // 復号化された平文パスワード
    serviceUrl: string;
    did?: string;
  };
  threads?: {
    username: string;
    userId: string;
    accessToken: string; // 復号化された平文トークン
    tokenExpiresAt?: number;
    tokenRefreshedAt?: number;
    expiresIn?: number;
  };
  exportedAt?: number;
  encryptionVerified: boolean;
}

/**
 * アカウント情報を AES-256 で暗号化し、エクスポート用JSONオブジェクトを構築
 */
export async function buildEncryptedAccountExportData(
  customPassphrase?: string
): Promise<AccountExportData> {
  // 最新のVaultおよび認証情報を取得
  const vault = getSavedAccountVault();

  // 平文のパスワード・トークンを確実に取得
  let plainBlueskyPassword = vault.bluesky?.appPassword || '';
  if (plainBlueskyPassword && isEncryptedString(plainBlueskyPassword)) {
    plainBlueskyPassword = await decryptSecret(plainBlueskyPassword);
  }

  let plainThreadsToken = vault.threads?.accessToken || '';
  if (plainThreadsToken && isEncryptedString(plainThreadsToken)) {
    plainThreadsToken = await decryptSecret(plainThreadsToken);
  }

  const now = Date.now();
  const exportPayload: AccountExportData = {
    format: 'crosspost_account_vault_aes256',
    version: 1,
    exportedAt: now,
    exportedAtFormatted: new Date(now).toISOString(),
    meta: {
      title: 'CrossPost Studio Account Credentials Vault',
      description: '他のPCやブラウザへの安全なアカウント移行用バックアップファイル。パスワードとアクセストークンはAES-256-GCMで暗号化されています。',
      encryptionAlgorithm: 'AES-256-GCM',
      hasCustomPassword: Boolean(customPassphrase && customPassphrase.trim()),
    },
  };

  // 1. Bluesky (ハンドルは平文、パスワードはAES-256暗号化)
  if (vault.bluesky?.identifier && plainBlueskyPassword) {
    const encryptedPass = await encryptPortableSecret(plainBlueskyPassword, customPassphrase);
    exportPayload.bluesky = {
      identifier: vault.bluesky.identifier,
      handle: vault.bluesky.handle || vault.bluesky.identifier,
      serviceUrl: vault.bluesky.serviceUrl || 'https://bsky.social',
      did: vault.bluesky.did,
      savedAt: vault.bluesky.savedAt || now,
      appPassword: encryptedPass, // AES-256
    };
  }

  // 2. Threads (アカウント名、User ID、有効期限は平文、AccessTokenはAES-256暗号化)
  if (plainThreadsToken) {
    const encryptedToken = await encryptPortableSecret(plainThreadsToken, customPassphrase);
    const expiresAt = vault.threads?.tokenExpiresAt || (now + 60 * 24 * 60 * 60 * 1000);
    exportPayload.threads = {
      username: vault.threads?.username || '@Threads_User',
      userId: vault.threads?.userId || 'me',
      tokenExpiresAt: expiresAt,
      tokenExpiresAtFormatted: new Date(expiresAt).toLocaleString('ja-JP'),
      tokenRefreshedAt: vault.threads?.tokenRefreshedAt || now,
      expiresIn: vault.threads?.expiresIn || Math.floor((expiresAt - now) / 1000),
      savedAt: vault.threads?.savedAt || now,
      accessToken: encryptedToken, // AES-256
    };
  }

  return exportPayload;
}

/**
 * アカウント情報をファイル（crosspost_accounts_backup.json）としてダウンロード
 */
export async function downloadAccountCredentialsBackup(customPassphrase?: string): Promise<{ filename: string; exportData: AccountExportData }> {
  const exportData = await buildEncryptedAccountExportData(customPassphrase);
  
  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `crosspost_accounts_backup_aes256_${dateStr}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { filename, exportData };
}

/**
 * アップロードされたJSONファイルまたは文字列をパースし、AES-256復号化を実行してアカウント情報を抽出
 */
export async function parseAndDecryptAccountBackup(
  fileOrJson: File | string,
  passphrase?: string
): Promise<DecryptedAccountResult> {
  let content = '';
  if (typeof fileOrJson === 'string') {
    content = fileOrJson;
  } else {
    content = await fileOrJson.text();
  }

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error('ファイルの形式が正しくありません。有効なJSONファイルを選択してください。');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('アカウント設定ファイルの内容が空です。');
  }

  const result: DecryptedAccountResult = {
    hasBluesky: false,
    hasThreads: false,
    exportedAt: parsed.exportedAt,
    encryptionVerified: false,
  };

  // 1. Bluesky の復号・抽出
  if (parsed.bluesky && (parsed.bluesky.identifier || parsed.bluesky.handle)) {
    const rawPass = parsed.bluesky.appPassword || '';
    if (!rawPass) {
      throw new Error('Blueskyのパスワード情報が見つかりません。');
    }

    const decryptedPass = await decryptPortableSecret(rawPass, passphrase);
    if (!decryptedPass) {
      throw new Error('BlueskyパスワードのAES-256復号化に失敗しました。');
    }

    result.hasBluesky = true;
    result.bluesky = {
      identifier: parsed.bluesky.identifier || parsed.bluesky.handle,
      handle: (parsed.bluesky.handle || parsed.bluesky.identifier || '').replace(/^@/, '').trim(),
      appPassword: decryptedPass,
      serviceUrl: parsed.bluesky.serviceUrl || 'https://bsky.social',
      did: parsed.bluesky.did,
    };
  }

  // 2. Threads の復号・抽出
  if (parsed.threads && (parsed.threads.accessToken || parsed.threads.userId || parsed.threads.username)) {
    const rawToken = parsed.threads.accessToken || '';
    if (!rawToken) {
      throw new Error('Threadsのアクセストークン情報が見つかりません。');
    }

    const decryptedToken = await decryptPortableSecret(rawToken, passphrase);
    if (!decryptedToken) {
      throw new Error('ThreadsアクセストークンのAES-256復号化に失敗しました。');
    }

    result.hasThreads = true;
    result.threads = {
      username: parsed.threads.username || '@Threads_User',
      userId: parsed.threads.userId || 'me',
      accessToken: decryptedToken,
      tokenExpiresAt: parsed.threads.tokenExpiresAt,
      tokenRefreshedAt: parsed.threads.tokenRefreshedAt,
      expiresIn: parsed.threads.expiresIn,
    };
  }

  if (!result.hasBluesky && !result.hasThreads) {
    throw new Error('ファイル内に有効なBlueskyまたはThreadsのアカウント情報が見つかりませんでした。');
  }

  result.encryptionVerified = true;
  return result;
}

/**
 * 復号・抽出されたアカウント情報を保管庫・サーバー・セッションに適用して自動ログイン
 */
export async function applyImportedAccountToSession(
  decrypted: DecryptedAccountResult,
  currentCreds?: ApiCredentials
): Promise<{ success: boolean; newCredentials: ApiCredentials; message: string }> {
  const now = Date.now();
  const nextCreds: ApiCredentials = currentCreds ? { ...currentCreds } : {
    blueskyIdentifier: '',
    blueskyAppPassword: '',
    blueskyConnected: false,
    blueskyHandle: '',
    threadsUserId: '',
    threadsAccessToken: '',
    threadsConnected: false,
    threadsUsername: '',
  };

  const updatedVault: SavedAccountVault = getSavedAccountVault();

  // 1. Bluesky の適用
  if (decrypted.hasBluesky && decrypted.bluesky) {
    nextCreds.blueskyIdentifier = decrypted.bluesky.identifier;
    nextCreds.blueskyAppPassword = decrypted.bluesky.appPassword;
    nextCreds.blueskyHandle = decrypted.bluesky.handle;
    nextCreds.blueskyServiceUrl = decrypted.bluesky.serviceUrl;
    nextCreds.blueskyDid = decrypted.bluesky.did;
    nextCreds.blueskyConnected = true;

    updatedVault.bluesky = {
      identifier: decrypted.bluesky.identifier,
      appPassword: decrypted.bluesky.appPassword,
      handle: decrypted.bluesky.handle,
      serviceUrl: decrypted.bluesky.serviceUrl,
      did: decrypted.bluesky.did,
      savedAt: now,
      isEncrypted: true,
    };
  }

  // 2. Threads の適用
  if (decrypted.hasThreads && decrypted.threads) {
    nextCreds.threadsUserId = decrypted.threads.userId;
    nextCreds.threadsAccessToken = decrypted.threads.accessToken;
    nextCreds.threadsUsername = decrypted.threads.username;
    nextCreds.threadsTokenExpiresAt = decrypted.threads.tokenExpiresAt;
    nextCreds.threadsTokenRefreshedAt = decrypted.threads.tokenRefreshedAt;
    nextCreds.threadsTokenExpiresIn = decrypted.threads.expiresIn;
    nextCreds.threadsConnected = true;

    updatedVault.threads = {
      userId: decrypted.threads.userId,
      accessToken: decrypted.threads.accessToken,
      username: decrypted.threads.username,
      tokenExpiresAt: decrypted.threads.tokenExpiresAt,
      tokenRefreshedAt: decrypted.threads.tokenRefreshedAt,
      expiresIn: decrypted.threads.expiresIn,
      savedAt: now,
      isEncrypted: true,
    };
  }

  nextCreds.isDemoMode = false;

  // Vault に保存 & サーバーへ同期
  saveCredentialsToVault(nextCreds);
  localStorage.setItem('cross_poster_creds', JSON.stringify(nextCreds));
  await syncVaultToServer(updatedVault);

  // グローバルイベント発火（MediatorやUIが即座に同期・ログイン状態に遷移）
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('crosspost_credentials_imported', { detail: nextCreds }));
  }

  const parts: string[] = [];
  if (decrypted.hasBluesky && decrypted.bluesky) {
    parts.push(`Bluesky (@${decrypted.bluesky.handle})`);
  }
  if (decrypted.hasThreads && decrypted.threads) {
    parts.push(`Threads (${decrypted.threads.username})`);
  }

  return {
    success: true,
    newCredentials: nextCreds,
    message: `🎉 ${parts.join(' & ')} のアカウント情報を読み込み、ログインとサーバー登録を完了しました！`,
  };
}
