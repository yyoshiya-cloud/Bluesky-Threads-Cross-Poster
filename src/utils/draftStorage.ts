import { DraftData } from '../types';

export const DRAFT_SESSION_KEY = 'cross_poster_draft_session_v1';
export const DRAFT_LOCAL_KEY = 'cross_poster_draft_v1';

/**
 * sessionStorage (最優先) および localStorage から下書きデータを復元
 */
export const loadDraftFromStorage = (): DraftData | null => {
  try {
    // 1. まずは直近の編集中セッションを保持する sessionStorage を確認
    let raw = sessionStorage.getItem(DRAFT_SESSION_KEY);
    
    // 2. sessionStorage にない場合は永続バックアップの localStorage を確認
    if (!raw) {
      raw = localStorage.getItem(DRAFT_LOCAL_KEY);
    }

    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.text === 'string') {
      return {
        text: parsed.text ?? '',
        blueskyText: typeof parsed.blueskyText === 'string' ? parsed.blueskyText : undefined,
        threadsText: typeof parsed.threadsText === 'string' ? parsed.threadsText : undefined,
        customPlatformText: typeof parsed.customPlatformText === 'boolean' ? parsed.customPlatformText : false,
        images: Array.isArray(parsed.images) ? parsed.images : [],
        postToBluesky: typeof parsed.postToBluesky === 'boolean' ? parsed.postToBluesky : true,
        postToThreads: typeof parsed.postToThreads === 'boolean' ? parsed.postToThreads : true,
        threadsTopic: typeof parsed.threadsTopic === 'string' ? parsed.threadsTopic : '',
        autoSplit: typeof parsed.autoSplit === 'boolean' ? parsed.autoSplit : true,
        includeNumbering: typeof parsed.includeNumbering === 'boolean' ? parsed.includeNumbering : true,
        lastSavedAt: parsed.lastSavedAt || Date.now(),
      };
    }
  } catch (err) {
    console.error('Failed to load draft from storage:', err);
  }
  return null;
};

/**
 * 下書き保存用に動画・巨大メディアのBase64を軽量化するヘルパー
 * ブラウザストレージ（sessionStorage / localStorage）の5MB制限を超えないよう、
 * 画像・動画ともに軽量サムネイルのみを保存し、巨大な生Base64やFileオブジェクトを除外します。
 */
export const sanitizeDraftForStorage = (draft: DraftData): DraftData => {
  return {
    ...draft,
    images: (draft.images || []).map((img) => {
      const safeThumb = img.thumbnailUrl || (img.dataUrl && img.dataUrl.length < 50000 ? img.dataUrl : '');
      return {
        id: img.id,
        name: img.name,
        size: img.size,
        alt: img.alt || '',
        mediaType: img.mediaType,
        mimeType: img.mimeType,
        duration: img.duration,
        width: img.width,
        height: img.height,
        mediaId: img.mediaId,
        // ストレージ保存時は軽量サムネイルを割り当ててフリーズや容量上限エラーを防止
        dataUrl: safeThumb,
        thumbnailUrl: safeThumb,
        // FileオブジェクトやBlob URLはストレージに保存できないため除外
        file: undefined,
        previewUrl: undefined,
      };
    }),
  };
};

/**
 * sessionStorage および localStorage に下書き（本文・画像・設定）を安全に自動保存
 */
export const saveDraftToStorage = (draft: DraftData): { success: boolean; error?: string } => {
  let savedSession = false;
  let savedLocal = false;

  const safeDraft = sanitizeDraftForStorage(draft);
  const serialized = JSON.stringify(safeDraft);

  // 1. sessionStorage へ保存
  try {
    sessionStorage.setItem(DRAFT_SESSION_KEY, serialized);
    savedSession = true;
  } catch (err: any) {
    console.warn('SessionStorage save warning:', err);
    // 画像容量超過の場合はテキストのみで再試行
    try {
      const lightweightDraft = { ...draft, images: [] };
      sessionStorage.setItem(DRAFT_SESSION_KEY, JSON.stringify(lightweightDraft));
      savedSession = true;
    } catch (innerErr) {
      console.error('Failed to save lightweight draft to sessionStorage:', innerErr);
    }
  }

  // 2. localStorage へバックアップ保存
  try {
    localStorage.setItem(DRAFT_LOCAL_KEY, serialized);
    savedLocal = true;
  } catch (err: any) {
    console.warn('LocalStorage save warning:', err);
    try {
      const lightweightDraft = { ...draft, images: [] };
      localStorage.setItem(DRAFT_LOCAL_KEY, JSON.stringify(lightweightDraft));
      savedLocal = true;
    } catch (innerErr) {
      console.error('Failed to save lightweight draft to localStorage:', innerErr);
    }
  }

  if (savedSession || savedLocal) {
    return { success: true };
  }

  return { success: false, error: '下書きの自動保存に失敗しました' };
};

/**
 * 下書きストレージのクリア（投稿成功後やユーザーの手動クリア用）
 */
export const clearDraftFromStorage = (): void => {
  try {
    sessionStorage.removeItem(DRAFT_SESSION_KEY);
    localStorage.removeItem(DRAFT_LOCAL_KEY);
  } catch (err) {
    console.error('Failed to remove draft from storage:', err);
  }
};


/**
 * 画像ファイルをプレビュー & LocalStorage保存用に最適化（リサイズ・軽量化）し、
 * 本文用dataUrlと超軽量サムネイルthumbnailUrlの両方を生成するヘルパー
 */
export interface ProcessedImageResult {
  dataUrl: string;
  thumbnailUrl: string;
}

export const compressImageFileWithThumbnail = (
  file: File,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.82
): Promise<ProcessedImageResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const raw = (e.target?.result as string) || '';
          resolve({ dataUrl: raw, thumbnailUrl: raw });
          return;
        }

        // 白背景を描画（透明PNGの黒化を防ぐ）
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // JPEG形式で統一圧縮
        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        // 高速・超軽量サムネイル（最大160x160、約2〜3KBでLocalStorageに安全に保持）
        let thumbW = img.width;
        let thumbH = img.height;
        const maxThumb = 160;
        if (thumbW > maxThumb || thumbH > maxThumb) {
          if (thumbW > thumbH) {
            thumbH = Math.round((thumbH * maxThumb) / thumbW);
            thumbW = maxThumb;
          } else {
            thumbW = Math.round((thumbW * maxThumb) / thumbH);
            thumbH = maxThumb;
          }
        }
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = thumbW;
        thumbCanvas.height = thumbH;
        const thumbCtx = thumbCanvas.getContext('2d');
        let thumbnailUrl = dataUrl;
        if (thumbCtx) {
          thumbCtx.fillStyle = '#FFFFFF';
          thumbCtx.fillRect(0, 0, thumbW, thumbH);
          thumbCtx.drawImage(img, 0, 0, thumbW, thumbH);
          thumbnailUrl = thumbCanvas.toDataURL('image/jpeg', 0.72);
        }

        resolve({ dataUrl, thumbnailUrl });
        // Canvasメモリを明示的にクリア
        canvas.width = 0;
        canvas.height = 0;
        thumbCanvas.width = 0;
        thumbCanvas.height = 0;
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

/**
 * 動画ファイル（MP4 / MOV / WebM）を処理し、メタデータ（duration, width, height, サムネイル）を抽出するヘルパー
 */
export interface ProcessedVideoResult {
  previewUrl: string;
  thumbnailUrl: string;
  file: File;
  duration: number;
  width: number;
  height: number;
  mimeType: string;
}

export const processVideoFile = (file: File): Promise<ProcessedVideoResult> => {
  return new Promise((resolve) => {
    // 形式判定
    let mimeType = file.type;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!mimeType) {
      if (['mp4', 'm4v'].includes(ext)) mimeType = 'video/mp4';
      else if (['mov', 'qt'].includes(ext)) mimeType = 'video/quicktime';
      else if (ext === 'webm') mimeType = 'video/webm';
      else if (['mkv', 'avi', '3gp', 'ts', 'mts'].includes(ext)) mimeType = `video/${ext}`;
      else mimeType = 'video/mp4';
    }

    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    // フォールバックサムネイル生成（見やすい紫グラデーション＋再生アイコン）
    const createFallbackThumbnail = (): string => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const grad = ctx.createLinearGradient(0, 0, 640, 360);
          grad.addColorStop(0, '#1e1b4b');
          grad.addColorStop(1, '#0f172a');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 640, 360);

          // 中央の円形再生ボタン
          ctx.beginPath();
          ctx.arc(320, 150, 44, 0, Math.PI * 2);
          ctx.fillStyle = '#9333ea';
          ctx.fill();

          // 再生三角アイコン
          ctx.beginPath();
          ctx.moveTo(314, 134);
          ctx.lineTo(334, 150);
          ctx.lineTo(314, 166);
          ctx.fillStyle = '#ffffff';
          ctx.fill();

          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 22px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🎬 添付動画ファイル', 320, 220);

          ctx.fillStyle = '#94a3b8';
          ctx.font = '14px sans-serif';
          ctx.fillText(file.name.slice(0, 35), 320, 255);

          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          if (dataUrl && dataUrl.length > 30) {
            return dataUrl;
          }
        }
      } catch {}
      return 'data:image/svg+xml;charset=utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="%231e1b4b"/><circle cx="320" cy="150" r="44" fill="%239333ea"/><polygon points="314,134 334,150 314,166" fill="%23ffffff"/><text x="50%" y="225" dominant-baseline="middle" text-anchor="middle" fill="%23f8fafc" font-family="sans-serif" font-size="22" font-weight="bold">🎬 添付動画</text></svg>';
    };

    let resolved = false;

    const cleanup = () => {
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch {}
    };

    const safeResolveWithFallback = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      cleanup();
      const thumb = createFallbackThumbnail();
      resolve({
        previewUrl: objectUrl,
        thumbnailUrl: thumb,
        file,
        duration: 0,
        width: 1280,
        height: 720,
        mimeType,
      });
    };

    // タイムアウト設定 (高速フォールバック: 3.5秒)
    const timer = setTimeout(() => {
      safeResolveWithFallback();
    }, 3500);

    video.onerror = () => {
      safeResolveWithFallback();
    };

    let seekTriggered = false;
    const triggerSeek = () => {
      if (seekTriggered) return;
      seekTriggered = true;
      try {
        const dur = video.duration || 0;
        const targetTime = dur > 2 ? Math.min(1.0, dur * 0.2) : Math.min(0.5, dur / 2);
        video.currentTime = targetTime;
      } catch {
        safeResolveWithFallback();
      }
    };

    video.onloadedmetadata = triggerSeek;
    video.onloadeddata = triggerSeek;
    video.oncanplay = triggerSeek;

    video.onseeked = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);

      try {
        let w = video.videoWidth || 640;
        let h = video.videoHeight || 360;
        const maxThumb = 600;
        if (w > maxThumb || h > maxThumb) {
          if (w > h) {
            h = Math.round((h * maxThumb) / w);
            w = maxThumb;
          } else {
            w = Math.round((w * maxThumb) / h);
            h = maxThumb;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
        }
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
        const duration = Math.round((video.duration || 0) * 10) / 10;
        const videoWidth = video.videoWidth || 0;
        const videoHeight = video.videoHeight || 0;

        canvas.width = 0;
        canvas.height = 0;
        cleanup();

        resolve({
          previewUrl: objectUrl,
          thumbnailUrl: thumbnailUrl && thumbnailUrl.length > 30 ? thumbnailUrl : createFallbackThumbnail(),
          file,
          duration,
          width: videoWidth,
          height: videoHeight,
          mimeType,
        });
      } catch {
        safeResolveWithFallback();
      }
    };

    // 最後に src を代入してロード開始
    video.src = objectUrl;
  });
};
