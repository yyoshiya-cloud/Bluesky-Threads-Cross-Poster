/**
 * Web Crypto API (AES-GCM 256-bit) を使用したセキュアなクライアント側トークン暗号化モジュール
 * ブラウザのローカルストレージに保管される Long-Lived Token や認証情報を暗号化保護します
 */

const KEY_STORAGE_NAME = 'crosspost_vault_key_entropy_v1';
const PREFIX_ENCRYPTED = 'enc:aes-gcm:v1:';

// ブラウザ環境特有のソルト・キーエントロピーを取得または生成
function getOrCreateDeviceKeyEntropy(): string {
  if (typeof window === 'undefined') return 'crosspost_device_salt_fallback_key';
  try {
    let stored = localStorage.getItem(KEY_STORAGE_NAME);
    if (!stored) {
      const arr = new Uint8Array(32);
      if (window.crypto?.getRandomValues) {
        window.crypto.getRandomValues(arr);
      } else {
        for (let i = 0; i < 32; i++) arr[i] = Math.floor(Math.random() * 256);
      }
      stored = Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(KEY_STORAGE_NAME, stored);
    }
    return stored;
  } catch {
    return 'crosspost_device_salt_fallback_key';
  }
}

// AES-GCM 用 CryptoKey を派生
async function getCryptoKey(): Promise<CryptoKey | null> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    return null;
  }
  try {
    const entropy = getOrCreateDeviceKeyEntropy();
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(entropy),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    const salt = enc.encode('crosspost_threads_token_security_salt');
    return await window.crypto.subtle.deriveKey(
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
  } catch (e) {
    console.warn('WebCrypto deriveKey fallback:', e);
    return null;
  }
}

// ArrayBuffer -> Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Base64 -> Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// フォールバック用の軽量XOR難読化エンコーダ（WebCrypto未対応環境用）
function fallbackXorCipher(text: string, key: string): string {
  const enc = new TextEncoder();
  const textBytes = enc.encode(text);
  const keyBytes = enc.encode(key);
  const out = new Uint8Array(textBytes.length);
  for (let i = 0; i < textBytes.length; i++) {
    out[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return 'enc:xor:v1:' + arrayBufferToBase64(out.buffer);
}

function fallbackXorDecipher(cipherText: string, key: string): string {
  if (!cipherText.startsWith('enc:xor:v1:')) return cipherText;
  const rawBase64 = cipherText.replace('enc:xor:v1:', '');
  const bytes = base64ToUint8Array(rawBase64);
  const keyBytes = new TextEncoder().encode(key);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return new TextDecoder().decode(out);
}

/**
 * 文字列をAES-GCMで暗号化
 */
export async function encryptSecret(plainText: string): Promise<string> {
  if (!plainText) return '';
  try {
    const key = await getCryptoKey();
    if (!key || !window.crypto?.subtle) {
      return fallbackXorCipher(plainText, getOrCreateDeviceKeyEntropy());
    }

    const iv = new Uint8Array(12);
    window.crypto.getRandomValues(iv);

    const enc = new TextEncoder();
    const encodedData = enc.encode(plainText);

    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      encodedData
    );

    const ivBase64 = arrayBufferToBase64(iv.buffer);
    const cipherBase64 = arrayBufferToBase64(encryptedBuffer);

    return `${PREFIX_ENCRYPTED}${ivBase64}:${cipherBase64}`;
  } catch (err) {
    console.error('Failed to encrypt secret:', err);
    return fallbackXorCipher(plainText, getOrCreateDeviceKeyEntropy());
  }
}

/**
 * 暗号化文字列を復号化（平文の場合はそのまま返却）
 */
export async function decryptSecret(cipherText: string): Promise<string> {
  if (!cipherText) return '';
  if (!cipherText.startsWith('enc:')) {
    // 既存の平文データはそのまま互換性を維持
    return cipherText;
  }

  if (cipherText.startsWith('enc:xor:v1:')) {
    return fallbackXorDecipher(cipherText, getOrCreateDeviceKeyEntropy());
  }

  if (cipherText.startsWith(PREFIX_ENCRYPTED)) {
    try {
      const parts = cipherText.replace(PREFIX_ENCRYPTED, '').split(':');
      if (parts.length !== 2) return '';
      const [ivBase64, dataBase64] = parts;

      const iv = base64ToUint8Array(ivBase64);
      const data = base64ToUint8Array(dataBase64);

      const key = await getCryptoKey();
      if (!key || !window.crypto?.subtle) {
        return '';
      }

      const decryptedBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv,
        },
        key,
        data
      );

      return new TextDecoder().decode(decryptedBuffer);
    } catch (err) {
      console.error('Failed to decrypt secret:', err);
      return '';
    }
  }

  return cipherText;
}

/**
 * 暗号化状態の判定
 */
export function isEncryptedString(str: string): boolean {
  return typeof str === 'string' && str.startsWith('enc:');
}
