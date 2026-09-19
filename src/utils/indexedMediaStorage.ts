/**
 * IndexedDB を用いた添付メディア（動画・高解像度画像Blob/File）のクライアント永続化ユーティリティ
 * - 予約投稿や下書きの保存時に、ブラウザの再読み込みや長時間の待機後でも動画・画像ファイル本体を安全に保持・復元します。
 */

const DB_NAME = 'crosspost_media_db';
const DB_VERSION = 1;
const STORE_NAME = 'media_blobs';

interface StoredMediaRecord {
  id: string; // AttachedImage.id または mediaId
  blob: Blob;
  name: string;
  mimeType: string;
  size: number;
  updatedAt: number;
}

function openMediaDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported'));
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * メディアBlob/FileをIndexedDBに永続保存
 */
export async function saveMediaBlob(id: string, fileOrBlob: Blob | File, name?: string, mimeType?: string): Promise<boolean> {
  try {
    const db = await openMediaDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record: StoredMediaRecord = {
        id,
        blob: fileOrBlob,
        name: name || (fileOrBlob instanceof File ? fileOrBlob.name : 'media'),
        mimeType: mimeType || fileOrBlob.type || 'application/octet-stream',
        size: fileOrBlob.size,
        updatedAt: Date.now(),
      };
      const req = store.put(record);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[saveMediaBlob] Failed to store in IndexedDB:', err);
    return false;
  }
}

/**
 * 保存済みメディアBlobを取得
 */
export async function getMediaBlob(id: string): Promise<File | null> {
  try {
    const db = await openMediaDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        const res = req.result as StoredMediaRecord | undefined;
        if (res && res.blob) {
          const file = new File([res.blob], res.name, {
            type: res.mimeType || res.blob.type,
            lastModified: res.updatedAt,
          });
          resolve(file);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[getMediaBlob] Failed to load from IndexedDB:', err);
    return null;
  }
}

/**
 * 期限切れや不要なメディアの削除
 */
export async function removeMediaBlob(id: string): Promise<void> {
  try {
    const db = await openMediaDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
  } catch (e) {
    console.warn('[removeMediaBlob] Failed to delete:', e);
  }
}

/**
 * 古いメディアの一括クリーンアップ (3日以上前のレコード)
 */
export async function cleanupOldMediaBlobs(): Promise<void> {
  try {
    const db = await openMediaDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.openCursor();
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    req.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        if (cursor.value.updatedAt < threeDaysAgo) {
          cursor.delete();
        }
        cursor.continue();
      }
    };
  } catch (e) {
    console.warn('[cleanupOldMediaBlobs] Error:', e);
  }
}
