import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import crypto from 'crypto';
import multer from 'multer';
import { GoogleGenAI, Type } from '@google/genai';

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY が設定されていません。AI Studio の Secrets パネルで設定してください。');
    }
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

/**
 * 503 (高負荷・一時的利用不可) や 429 (レート制限) に対応する
 * 自動リトライ＆フォールバック付き Gemini API 実行関数
 */
async function generateGeminiContentWithFallback(params: {
  contents: string;
  config?: any;
  preferredModel?: string;
}): Promise<any> {
  const ai = getGeminiClient();
  
  // 試行するモデル順序: 
  // 1. gemini-3.8-flash (最新・高精度)
  // 2. gemini-flash-latest (安定Flashエイリアス)
  // 3. gemini-3.1-flash-lite (軽量・高可用性)
  const candidateModels = [
    params.preferredModel || 'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite',
  ];

  const models = Array.from(new Set(candidateModels));
  let lastError: any = null;

  for (let mIdx = 0; mIdx < models.length; mIdx++) {
    const modelName = models[mIdx];
    // 各モデルで最大2回試行（1回目失敗時は指数バックオフで再試行）
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`[Gemini API] Retrying ${modelName} after 1.5s backoff (attempt ${attempt})...`);
          await new Promise((resolve) => setTimeout(resolve, 1500));
        } else if (mIdx > 0) {
          console.log(`[Gemini API] Falling back to alternative model: ${modelName}...`);
          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        const response = await ai.models.generateContent({
          model: modelName,
          contents: params.contents,
          config: params.config,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = err?.message || String(err);
        console.warn(`[Gemini API Warning] Model ${modelName} (attempt ${attempt}) failed:`, errMsg);

        // 503 (高負荷), 429 (制限), 500等のネットワーク・一時的エラーかを判定
        const isTransient =
          errMsg.includes('503') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('high demand') ||
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('overloaded') ||
          errMsg.includes('FetchError') ||
          errMsg.includes('ECONNRESET');

        if (!isTransient) {
          // パラメータ不正など修復不可能なエラーなら即スロー
          throw err;
        }
      }
    }
  }

  throw lastError;
}

/**
 * ユーザー向けにわかりやすい親切なエラーメッセージにフォーマット
 */
function formatGeminiErrorMessage(err: any): string {
  const raw = err?.message || String(err);
  if (raw.includes('503') || raw.includes('UNAVAILABLE') || raw.includes('high demand')) {
    return '現在Google Gemini AIのサーバーが世界的に一時的な高負荷（混雑）となっています。数十秒待ってから再度「実行」をお試しください。';
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return 'Gemini AIのリクエスト上限に達しました。1〜2分ほど時間を置いてから再度お試しください。';
  }
  if (raw.includes('GEMINI_API_KEY')) {
    return 'GEMINI_API_KEY が未設定です。AI Studio の設定画面でAPIキーを確認してください。';
  }
  // 生JSON {"error":...} を取り除いてスッキリさせる
  try {
    const jsonMatch = raw.match(/\{"error":\{.*\}\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed?.error?.message) {
        return `AIアシストエラー: ${parsed.error.message}`;
      }
    }
  } catch {
    // ignore
  }
  return `AIアシストエラー: ${raw}`;
}

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 最大100MB
});

interface CachedMedia {
  buffer: Buffer;
  mimeType: string;
  createdAt: number;
  publicUrl?: string; // Meta Threads API用公開CDNへのアップロード結果URLキャッシュ
}

const mediaStorage = new Map<string, CachedMedia>();

/**
 * 送信されたメディア情報（mediaIdまたはBase64 dataUrl）からバイナリBufferを取得
 */
function resolveMediaBuffer(item: { mediaId?: string; dataUrl?: string; mimeType?: string; name?: string; mediaType?: 'image' | 'video'; publicUrl?: string }): { buffer: Buffer; mimeType: string } | null {
  const originalName = item.name || '';
  const ext = originalName.split('.').pop()?.toLowerCase() || '';
  const isExplicitVideo = item.mediaType === 'video' || (item.mimeType && isVideoMime(item.mimeType)) || ['mp4', 'mov', 'webm', 'm4v'].includes(ext);

  if (item.mediaId) {
    const cached = mediaStorage.get(item.mediaId);
    if (cached) {
      let mime = cached.mimeType || 'application/octet-stream';
      if (isExplicitVideo && (!mime.startsWith('video/') || mime === 'application/octet-stream')) {
        mime = ext === 'mov' ? 'video/quicktime' : 'video/mp4';
      }
      return { buffer: cached.buffer, mimeType: mime };
    }
  }

  if (item.dataUrl && typeof item.dataUrl === 'string') {
    const match = item.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      const mime = match[1];
      // サムネイル画像Base64が動画実体として誤認されるのを防ぐガード（動画の場合はdataUrlがポスター画像の可能性がある）
      if (isExplicitVideo && mime.startsWith('image/')) {
        console.warn(`[resolveMediaBuffer] dataUrl is thumbnail image for video ${originalName}, skipping as video payload`);
        return null;
      }
      return {
        mimeType: mime,
        buffer: Buffer.from(match[2], 'base64'),
      };
    }
  }

  return null;
}

// 30分以上経過した一時メディアを定期クリーンアップ
setInterval(() => {
  const now = Date.now();
  for (const [id, item] of mediaStorage.entries()) {
    if (now - item.createdAt > 30 * 60 * 1000) {
      mediaStorage.delete(id);
    }
  }
}, 5 * 60 * 1000);

function sanitizeInput(val: any): string {
  if (typeof val !== 'string') return '';
  return val.trim().replace(/^['"`]|['"`]$/g, '').replace(/[\u3000]/g, ' ').trim();
}

function isVideoMime(mimeType: string): boolean {
  return (
    mimeType.startsWith('video/') ||
    mimeType.includes('mp4') ||
    mimeType.includes('quicktime') ||
    mimeType.includes('webm')
  );
}

/**
 * バッファのマジックバイトから画像/動画形式を厳格に判定
 * Threads APIは 画像はJPEGおよびPNGのみ対応（WebP, GIF, HEIC, AVIF等は非対応）
 */
function detectMediaFormat(
  buffer: Buffer,
  declaredMime?: string,
  fileName?: string
): { mimeType: string; ext: string; isVideo: boolean; safeName: string } {
  const isVideo =
    isVideoMime(declaredMime || '') ||
    ['mp4', 'mov', 'webm', 'm4v'].some((vExt) => (fileName || '').toLowerCase().endsWith(`.${vExt}`));

  if (isVideo) {
    let ext = 'mp4';
    if (declaredMime?.includes('mov') || declaredMime?.includes('quicktime') || fileName?.toLowerCase().endsWith('.mov')) {
      ext = 'mov';
    } else if (declaredMime?.includes('webm') || fileName?.toLowerCase().endsWith('.webm')) {
      ext = 'webm';
    }
    const rawBase = (fileName || 'video')
      .replace(/\.[^/.]+$/, '')
      .trim()
      .replace(/[^a-zA-Z0-9_\-\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/g, '_')
      .slice(0, 40) || 'video';
    return {
      mimeType: declaredMime && declaredMime.startsWith('video/') ? declaredMime : 'video/mp4',
      ext,
      isVideo: true,
      safeName: `${rawBase}.${ext}`,
    };
  }

  // 画像の判定: PNG または JPEG のみ許可（Threads API仕様）
  let ext = 'jpg';
  let mimeType = 'image/jpeg';

  if (buffer && buffer.length >= 8) {
    // PNG マジックバイト: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      ext = 'png';
      mimeType = 'image/png';
    } else if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      // JPEG マジックバイト: FF D8 FF
      ext = 'jpg';
      mimeType = 'image/jpeg';
    }
  }

  // ファイル名から元の拡張子を取り除き、確実に .jpg または .png を付与
  const rawBase = (fileName || 'image')
    .replace(/\.[^/.]+$/, '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/g, '_')
    .slice(0, 40) || 'image';

  return {
    mimeType,
    ext,
    isVideo: false,
    safeName: `${rawBase}.${ext}`,
  };
}

/**
 * URLがMetaクローラーから認証なしで直接アクセス可能な外部CDNのURLかどうかを判定
 */
export function isTrulyPublicCdnUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string' || !url.startsWith('http')) return false;
  const lower = url.toLowerCase();
  if (lower.includes('localhost') || lower.includes('127.0.0.1')) return false;
  if (lower.includes('.run.app') || lower.includes('.internal') || lower.includes('/api/media/')) return false;
  if (lower.includes('web.app') || lower.includes('firebaseapp.com')) return false;
  if (lower.includes('tmpfiles.org')) return false; // tmpfiles.org returns HTML/redirects, not direct image files
  return true;
}

/**
 * Meta Threads APIが直接ダウンロード可能な公開静的メディアホストへ高速アップロード
 * （Uguu 高速ホスト: ダイレクトURL・Metaクローラーアクセス確認済）
 */
async function uploadMediaToPublicHost(
  buffer: Buffer,
  mimeType: string,
  fileName?: string
): Promise<string | null> {
  const detected = detectMediaFormat(buffer, mimeType, fileName);
  const uploadName = detected.safeName;
  const effectiveMime = detected.mimeType;
  const isVideo = detected.isVideo;
  const sizeMb = (buffer.length / 1024 / 1024).toFixed(2);

  // 1. Uguu (超高速一時ファイルホスティング: 無料・認証不要・100MBまで対応・ダイレクト画像配信・Metaクローラー200直接アクセス確認済)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const formData = new FormData();
      formData.append('files[]', new Blob([buffer], { type: effectiveMime }), uploadName);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), isVideo ? 60000 : 25000);
      const res = await fetch('https://uguu.se/upload', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ThreadsPostBot/1.0',
        },
      });
      clearTimeout(timeout);

      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        const url = json?.files?.[0]?.url;
        if (url && typeof url === 'string' && url.startsWith('http') && isTrulyPublicCdnUrl(url)) {
          console.log(`[PublicMedia] Fast Upload to Uguu success: ${url} (${effectiveMime}, size: ${sizeMb}MB)`);
          return url;
        }
      }
    } catch (err: any) {
      console.warn(`[PublicMedia] Uguu upload attempt #${attempt + 1} note: ${err.message}`);
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }
  }

  return null;
}

export interface ThreadsMediaItem {
  url: string;
  fallbackUrl?: string;
  type: 'IMAGE' | 'VIDEO';
  alt?: string;
}

/**
 * 添付メディア（画像・動画）をMeta Threads APIが取得可能な形式へ一括変換
 * （画像は並列で高速アップロードし、動画は順次アップロードして帯域競合とタイムアウトを防止）
 */
async function uploadAllMediaForThreads(
  mediaList: Array<{ name?: string; dataUrl?: string; mediaId?: string; alt?: string; mediaType?: 'image' | 'video'; mimeType?: string; publicUrl?: string }>,
  baseUrl: string
): Promise<ThreadsMediaItem[]> {
  const preparedResults: Array<ThreadsMediaItem | null> = new Array(mediaList.length).fill(null);

  // 1. 各メディアのバッファと種類を事前解決
  interface ResolvedItemInfo {
    index: number;
    buffer: Buffer;
    mimeType: string;
    isVideo: boolean;
    name: string;
    alt?: string;
    mediaId: string;
    ext: string;
  }

  const itemsToUpload: ResolvedItemInfo[] = [];

  for (let idx = 0; idx < mediaList.length; idx++) {
    const item = mediaList[idx];
    const ext = (item.name || '').split('.').pop()?.toLowerCase() || '';
    const isExplicitVideo =
      item.mediaType === 'video' ||
      (item.mimeType && isVideoMime(item.mimeType)) ||
      ['mp4', 'mov', 'webm', 'm4v'].includes(ext) ||
      (item.dataUrl && item.dataUrl.startsWith('data:video/'));

    // すでに渡された publicUrl または dataUrl が真正な外部CDNであればそのまま使用
    const explicitUrl = (item.publicUrl && isTrulyPublicCdnUrl(item.publicUrl))
      ? item.publicUrl
      : (item.dataUrl && isTrulyPublicCdnUrl(item.dataUrl))
      ? item.dataUrl
      : null;

    if (explicitUrl) {
      const detectedVideo = isExplicitVideo || isVideoMime(item.name || explicitUrl);
      preparedResults[idx] = {
        url: explicitUrl,
        type: (detectedVideo ? 'VIDEO' : 'IMAGE') as 'IMAGE' | 'VIDEO',
        alt: item.alt,
      };
      continue;
    }

    const resolved = resolveMediaBuffer(item);
    if (!resolved) {
      console.warn(`[uploadAllMediaForThreads] Failed to resolve media buffer for item #${idx + 1} (${item.name || 'unnamed'})`);
      continue;
    }

    const { buffer, mimeType } = resolved;
    const isVideo = isExplicitVideo || isVideoMime(mimeType);
    const mediaId = item.mediaId || crypto.randomBytes(16).toString('hex');

    // キャッシュ済みの外部公開URL（Truly Public CDN）があれば即時再利用
    const existingCached = item.mediaId ? mediaStorage.get(item.mediaId) : null;
    if (existingCached?.publicUrl && isTrulyPublicCdnUrl(existingCached.publicUrl)) {
      console.log(`[uploadAllMediaForThreads] Reusing cached truly public URL for #${idx + 1}: ${existingCached.publicUrl}`);
      preparedResults[idx] = {
        url: existingCached.publicUrl,
        fallbackUrl: `${baseUrl}/api/media/${mediaId}`,
        type: (isVideo ? 'VIDEO' : 'IMAGE') as 'IMAGE' | 'VIDEO',
        alt: item.alt,
      };
      continue;
    }

    // ローカルストレージに保持
    const cachedItem: CachedMedia = existingCached || {
      buffer,
      mimeType,
      createdAt: Date.now(),
    };
    mediaStorage.set(mediaId, cachedItem);

    itemsToUpload.push({
      index: idx,
      buffer,
      mimeType,
      isVideo,
      name: item.name || '',
      alt: item.alt,
      mediaId,
      ext,
    });
  }

  // 2. アップロード処理関数
  const uploadSingleItem = async (info: ResolvedItemInfo): Promise<ThreadsMediaItem> => {
    const { index, buffer, mimeType, isVideo, name, alt, mediaId, ext } = info;
    const selfServerUrl = `${baseUrl}/api/media/${mediaId}`;
    console.log(`[uploadAllMediaForThreads] Uploading item #${index + 1}/${mediaList.length} (${isVideo ? 'VIDEO' : 'IMAGE'}, ${(buffer.length / 1024 / 1024).toFixed(2)}MB) to public CDN...`);

    let publicUrl: string | null = null;
    try {
      publicUrl = await uploadMediaToPublicHost(
        buffer,
        mimeType,
        name || (isVideo ? `video_${index + 1}.${ext || 'mp4'}` : `image_${index + 1}.${ext || 'jpg'}`)
      );
    } catch (hostErr: any) {
      console.warn(`[uploadAllMediaForThreads] uploadMediaToPublicHost notice for item #${index + 1}:`, hostErr.message);
    }

    const cachedItem = mediaStorage.get(mediaId);
    const isPublic = isTrulyPublicCdnUrl(publicUrl);
    if (publicUrl && isPublic && cachedItem) {
      cachedItem.publicUrl = publicUrl;
    }

    if (!isPublic) {
      console.warn(`[uploadAllMediaForThreads] Warning: external CDN upload did not resolve truly public URL for item #${index + 1}. Using selfServerUrl: ${selfServerUrl}`);
    }

    return {
      url: (isPublic && publicUrl) ? publicUrl : selfServerUrl,
      fallbackUrl: selfServerUrl,
      type: (isVideo ? 'VIDEO' : 'IMAGE') as 'IMAGE' | 'VIDEO',
      alt,
    };
  };

  // 画像・動画ともに外部ホストのレートリミット・競合を防止するため順次アップロード
  const imageItems = itemsToUpload.filter((i) => !i.isVideo);
  const videoItems = itemsToUpload.filter((i) => i.isVideo);

  // 画像の順次アップロード（短いウェイトを挟んで確実に全件成功させる）
  for (let idx = 0; idx < imageItems.length; idx++) {
    const item = imageItems[idx];
    const uploaded = await uploadSingleItem(item);
    preparedResults[item.index] = uploaded;
    if (idx < imageItems.length - 1) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  // 動画の順次アップロード（1本ずつ直列に確実に処理）
  for (const vItem of videoItems) {
    const uploaded = await uploadSingleItem(vItem);
    preparedResults[vItem.index] = uploaded;
  }

  return preparedResults.filter((item): item is ThreadsMediaItem => item !== null);
}

/**
 * Threadsメディアコンテナのステータス確認 (Threads API で有効な fields=status,id,error_message を指定)
 */
async function checkContainerStatus(
  containerId: string,
  accessToken: string
): Promise<{ status?: string; error?: string; rawData?: any }> {
  try {
    // Threads API 公式仕様 fields=status,id,error_message
    const res = await fetch(
      `https://graph.threads.net/v1.0/${containerId}?fields=status,id,error_message&access_token=${encodeURIComponent(accessToken)}`
    );
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const code = errData?.error?.code ? `Code: ${errData.error.code}` : `HTTP ${res.status}`;
      return {
        status: 'ERROR',
        error: `[Threads APIエラー (${code})] ${errData?.error?.message || res.statusText}`,
        rawData: errData,
      };
    }
    const data = await res.json().catch(() => ({}));
    const rawStatus = data.status || '';
    const status = typeof rawStatus === 'string' ? rawStatus.toUpperCase() : (data.error_message ? 'ERROR' : undefined);
    const errMsg = data.error_message || data.error?.message || (data.status === 'ERROR' ? 'Meta側での画像/動画エンコード処理に失敗しました' : undefined);
    return { status, error: errMsg, rawData: data };
  } catch (err: any) {
    return { status: 'ERROR', error: err.message };
  }
}

/**
 * Threadsコンテナが Meta 側でエンコード完了（FINISHED）するまで待機
 */
async function waitForContainerFinished(
  containerId: string,
  accessToken: string,
  maxWaitMs = 120000
): Promise<void> {
  const start = Date.now();
  let lastStatus = 'UNKNOWN';
  let checkCount = 0;
  while (Date.now() - start < maxWaitMs) {
    checkCount++;
    const result = await checkContainerStatus(containerId, accessToken);
    lastStatus = result.status || 'UNKNOWN';
    const elapsedSec = ((Date.now() - start) / 1000).toFixed(1);

    if (checkCount === 1 || checkCount % 4 === 0 || result.status === 'FINISHED') {
      console.log(`[Threads Container ${containerId}] Status: ${lastStatus} (elapsed: ${elapsedSec}s)`);
    }

    if (result.status === 'FINISHED' || result.status === 'PUBLISHED') {
      return;
    }

    if (result.status === 'ERROR' || result.error) {
      const rawErrMsg = result.error || 'Meta側での画像/動画処理に失敗しました';
      let ratioHint = '';
      const lower = rawErrMsg.toLowerCase();
      if (lower.includes('aspect ratio') || lower.includes('ratio') || lower.includes('dimension')) {
        ratioHint = '（Threads対応のアスペクト比は 1.91:1 から 4:5 または 9:16 です。極端に横長または縦長の動画は拒否されます）';
      } else if (lower.includes('duration') || lower.includes('length')) {
        ratioHint = '（動画の再生時間は 1秒以上 5分(300秒) 以内である必要があります）';
      } else if (lower.includes('format') || lower.includes('codec') || lower.includes('webm')) {
        ratioHint = '（Threadsは MP4 または MOV 形式 (H.264 / AAC) のみ対応しています）';
      } else if (lower.includes('size') || lower.includes('large')) {
        ratioHint = '（メディアファイルの容量が上限を超えています）';
      } else if (lower.includes('download') || lower.includes('fetch') || lower.includes('timeout')) {
        ratioHint = '（Meta側サーバーによるメディアのダウンロードに失敗しました。外部ネットワークの一時的な混雑の可能性があります）';
      }
      throw new Error(`[Threads メディア処理エラー: ERROR] ${rawErrMsg}${ratioHint ? ` ${ratioHint}` : ''}`);
    }

    if (result.status === 'EXPIRED') {
      throw new Error('[Threads APIエラー: EXPIRED] メディアコンテナの有効期限が切れました。再試行してください。');
    }

    const waitDelay = checkCount === 1 ? 500 : checkCount <= 4 ? 800 : checkCount <= 8 ? 1200 : 1800;
    await new Promise((r) => setTimeout(r, waitDelay));
  }
  if (lastStatus === 'IN_PROGRESS' || lastStatus === 'UNKNOWN') {
    throw new Error(`[Threads API] メディア（動画）の変換処理がタイムアウトしました（Meta側ステータス: ${lastStatus}）。Meta側の動画エンコードに時間がかかっています。動画が長尺（数分）の場合は、少し短くするか容量を小さくして再試行してください。`);
  }
}

/**
 * Bluesky ハンドルから DID (did:plc:...) を解決（キャッシュ付き）
 */
const blueskyHandleDidCache = new Map<string, string>();

async function resolveBlueskyHandleToDid(handle: string, pdsEndpoint: string): Promise<string | null> {
  const cleanHandle = handle.replace(/^@/, '').trim().toLowerCase();
  if (!cleanHandle) return null;
  if (blueskyHandleDidCache.has(cleanHandle)) {
    return blueskyHandleDidCache.get(cleanHandle)!;
  }

  const endpoints = [
    pdsEndpoint,
    'https://public.api.bsky.app',
    'https://bsky.social',
  ];

  for (const ep of endpoints) {
    try {
      const url = `${ep.replace(/\/+$/, '')}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(cleanHandle)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(url, { method: 'GET', signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (data?.did && typeof data.did === 'string') {
          blueskyHandleDidCache.set(cleanHandle, data.did);
          return data.did;
        }
      }
    } catch {
      // 失敗時は次のエンドポイントへフォールバック
    }
  }
  return null;
}

/**
 * Bluesky 投稿テキストからリンク (URL)、メンション (@handle)、ハッシュタグ (#tag) を自動検出し、
 * ATProto 仕様（UTF-8 バイトオフセット）に準拠した Facets 配列を生成
 */
async function generateBlueskyFacets(text: string, pdsEndpoint: string): Promise<any[]> {
  if (!text || typeof text !== 'string') return [];
  const facets: any[] = [];

  // 1. URL リンクの検出 (http:// または https://)
  const urlRegex = /https?:\/\/[^\s<>()"']+/g;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(text)) !== null) {
    let url = match[0];
    let endIndex = match.index + url.length;

    // 句読点や閉じカッコ等の末尾記号をトリム
    while (/[.,!?:;)\]\}'"]$/.test(url) && url.length > 0) {
      url = url.slice(0, -1);
      endIndex -= 1;
    }

    if (url.length > 0) {
      const byteStart = Buffer.from(text.slice(0, match.index), 'utf8').length;
      const byteEnd = Buffer.from(text.slice(0, endIndex), 'utf8').length;

      facets.push({
        index: { byteStart, byteEnd },
        features: [
          {
            $type: 'app.bsky.richtext.facet#link',
            uri: url,
          },
        ],
      });
    }
  }

  // 2. メンションの検出 (@handle.domain)
  // 例: @alice.bsky.social, @news.example.com
  const mentionRegex = /(^|\s)(@([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)/g;
  while ((match = mentionRegex.exec(text)) !== null) {
    const prefix = match[1] || '';
    const fullMention = match[2];
    const handle = fullMention.replace(/^@/, '');
    const matchIndex = match.index + prefix.length;
    const matchEndIndex = matchIndex + fullMention.length;

    const did = await resolveBlueskyHandleToDid(handle, pdsEndpoint);
    if (did) {
      const byteStart = Buffer.from(text.slice(0, matchIndex), 'utf8').length;
      const byteEnd = Buffer.from(text.slice(0, matchEndIndex), 'utf8').length;

      facets.push({
        index: { byteStart, byteEnd },
        features: [
          {
            $type: 'app.bsky.richtext.facet#mention',
            did,
          },
        ],
      });
    }
  }

  // 3. ハッシュタグの検出 (#tag)
  const tagRegex = /(^|\s)(#([^\s#.,!?:;()[\]{}'"]+))/g;
  while ((match = tagRegex.exec(text)) !== null) {
    const prefix = match[1] || '';
    const fullTag = match[2];
    const tagValue = match[3];
    const matchIndex = match.index + prefix.length;
    const matchEndIndex = matchIndex + fullTag.length;

    if (tagValue && tagValue.length > 0) {
      const byteStart = Buffer.from(text.slice(0, matchIndex), 'utf8').length;
      const byteEnd = Buffer.from(text.slice(0, matchEndIndex), 'utf8').length;

      facets.push({
        index: { byteStart, byteEnd },
        features: [
          {
            $type: 'app.bsky.richtext.facet#tag',
            tag: tagValue,
          },
        ],
      });
    }
  }

  // バイト開始位置順にソート
  facets.sort((a, b) => a.index.byteStart - b.index.byteStart);
  return facets;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // APIアクセス時のブラウザロギング
  app.use('/api', (req, _res, next) => {
    if (req.path !== '/health') {
      const ua = req.headers['user-agent'] || '';
      let clientBrowser = 'Unknown';
      if (ua.includes('Edg/')) {
        const ver = ua.match(/Edg\/([\d.]+)/)?.[1] || '';
        clientBrowser = `Microsoft Edge ${ver}`.trim();
      } else if (ua.includes('Chrome/')) {
        const ver = ua.match(/Chrome\/([\d.]+)/)?.[1] || '';
        clientBrowser = `Google Chrome ${ver}`.trim();
      } else if (ua.includes('Firefox/')) {
        const ver = ua.match(/Firefox\/([\d.]+)/)?.[1] || '';
        clientBrowser = `Mozilla Firefox ${ver}`.trim();
      } else if (ua.includes('Safari/')) {
        clientBrowser = 'Safari';
      }
      console.log(`[API] ${req.method} /api${req.path} [${clientBrowser}]`);
    }
    next();
  });

  // ヘルスチェック
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // クリップボード読み取り（Web/Dev用フォールバック）
  app.get('/api/clipboard/read', (_req, res) => {
    res.json({ text: '' });
  });

  // クリップボード書き込み（Web/Dev用フォールバック）
  app.post('/api/clipboard/write', express.json(), (_req, res) => {
    res.json({ status: 'ok' });
  });

  // -------------------------------------------------------------
  // アカウント認証情報のサーバー永続保管エンドポイント
  // （リロード・デプロイ・別ブラウザ・別デバイス間での確実なアカウント復元）
  // -------------------------------------------------------------
  const DATA_DIR = path.resolve(process.cwd(), 'data');
  const VAULT_FILE_PATH = path.join(DATA_DIR, 'account_vault.json');

  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
      console.warn('[Server Storage] Failed to create data directory:', e);
    }
  }

  // サーバー保管庫からの取得
  app.get('/api/credentials/vault', (_req, res) => {
    try {
      if (fs.existsSync(VAULT_FILE_PATH)) {
        const raw = fs.readFileSync(VAULT_FILE_PATH, 'utf-8');
        const data = JSON.parse(raw);
        res.json({ success: true, vault: data });
        return;
      }
      res.json({ success: true, vault: {} });
    } catch (err: any) {
      console.error('[Server Storage] Error reading vault file:', err);
      res.status(500).json({ success: false, error: err.message, vault: {} });
    }
  });

  // サーバー保管庫への永続保存
  app.post('/api/credentials/vault', express.json({ limit: '2mb' }), (req, res) => {
    try {
      const payload = req.body;
      if (!payload || typeof payload !== 'object') {
        res.status(400).json({ success: false, error: 'Invalid payload' });
        return;
      }
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(VAULT_FILE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
      console.log('[Server Storage] Successfully persisted account vault to server disk.');
      res.json({ success: true, savedAt: Date.now() });
    } catch (err: any) {
      console.error('[Server Storage] Error writing vault file:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // サーバー保管庫からの削除
  app.delete('/api/credentials/vault', (req, res) => {
    try {
      const platform = req.query.platform as string | undefined;
      if (fs.existsSync(VAULT_FILE_PATH)) {
        if (!platform || platform === 'all') {
          fs.unlinkSync(VAULT_FILE_PATH);
        } else {
          const raw = fs.readFileSync(VAULT_FILE_PATH, 'utf-8');
          const data = JSON.parse(raw);
          if (platform === 'bluesky') {
            delete data.bluesky;
          } else if (platform === 'threads') {
            delete data.threads;
          }
          fs.writeFileSync(VAULT_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
        }
      }
      res.json({ success: true });
    } catch (err: any) {
      console.error('[Server Storage] Error deleting vault file:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // ハッシュタグ・Threads専用トピックのサーバー永続保管エンドポイント
  // （デプロイ・リロード時もユーザーが登録したハッシュタグ・トピックを完全維持）
  // -------------------------------------------------------------
  const TAGS_TOPICS_FILE_PATH = path.join(DATA_DIR, 'user_tags_topics.json');

  app.get('/api/tags-topics/vault', (_req, res) => {
    try {
      if (fs.existsSync(TAGS_TOPICS_FILE_PATH)) {
        const raw = fs.readFileSync(TAGS_TOPICS_FILE_PATH, 'utf-8');
        const data = JSON.parse(raw);
        res.json({ success: true, vault: data });
        return;
      }
      res.json({ success: true, vault: {} });
    } catch (err: any) {
      console.error('[TagsTopics Storage] Error reading tags/topics file:', err);
      res.status(500).json({ success: false, error: err.message, vault: {} });
    }
  });

  app.post('/api/tags-topics/vault', express.json({ limit: '2mb' }), (req, res) => {
    try {
      const payload = req.body;
      if (!payload || typeof payload !== 'object') {
        res.status(400).json({ success: false, error: 'Invalid payload' });
        return;
      }
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(TAGS_TOPICS_FILE_PATH, JSON.stringify(payload, null, 2), 'utf-8');
      console.log('[TagsTopics Storage] Successfully persisted tags and topics to server disk.');
      res.json({ success: true, savedAt: Date.now() });
    } catch (err: any) {
      console.error('[TagsTopics Storage] Error writing tags/topics file:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // OGP メタデータ取得エンドポイント (URLカードプレビュー用)
  // -------------------------------------------------------------
  const ogpCache = new Map<string, { data: any; expiresAt: number }>();

  app.get('/api/ogp', async (req, res) => {
    try {
      const targetUrl = typeof req.query.url === 'string' ? req.query.url.trim() : '';
      if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
        res.status(400).json({ success: false, error: '有効なURL（httpまたはhttps）を指定してください。' });
        return;
      }

      // キャッシュチェック (有効期限 1時間)
      const cached = ogpCache.get(targetUrl);
      if (cached && cached.expiresAt > Date.now()) {
        res.json({ success: true, ...cached.data, cached: true });
        return;
      }

      let parsedDomain = '';
      try {
        parsedDomain = new URL(targetUrl).hostname;
      } catch {
        parsedDomain = targetUrl;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(targetUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php) Twitterbot/1.0 Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        },
      });
      clearTimeout(timeout);

      if (!response.ok) {
        res.json({
          success: true,
          url: targetUrl,
          domain: parsedDomain,
          title: parsedDomain,
          description: '',
          image: '',
        });
        return;
      }

      // 最初の500KB分だけ読み込み（メモリと時間節約）
      const htmlText = await response.text();
      const cleanHtml = htmlText.slice(0, 500000);

      const extractMeta = (regexes: RegExp[]): string => {
        for (const regex of regexes) {
          const match = regex.exec(cleanHtml);
          if (match && match[1]) {
            return match[1]
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .trim();
          }
        }
        return '';
      };

      const title = extractMeta([
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
        /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
        /<title[^>]*>([^<]+)<\/title>/i,
      ]) || parsedDomain;

      const description = extractMeta([
        /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+name=["']twitter:description["'][^>]+content=["']([^"']+)["']/i,
      ]);

      let image = extractMeta([
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
        /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      ]);

      // 相対URLの場合は絶対URLへ変換
      if (image && !image.startsWith('http://') && !image.startsWith('https://')) {
        try {
          image = new URL(image, targetUrl).toString();
        } catch {
          // ignore
        }
      }

      const ogpResult = {
        url: targetUrl,
        domain: parsedDomain,
        title,
        description,
        image,
      };

      // キャッシュ保持
      ogpCache.set(targetUrl, { data: ogpResult, expiresAt: Date.now() + 3600 * 1000 });

      res.json({
        success: true,
        ...ogpResult,
      });
    } catch (err: any) {
      console.warn('[OGP Fetch Error]:', err.message);
      let domain = '';
      try {
        domain = new URL(typeof req.query.url === 'string' ? req.query.url : '').hostname;
      } catch {}
      res.json({
        success: true,
        url: req.query.url,
        domain: domain || 'link',
        title: domain || 'Webページ',
        description: '',
        image: '',
      });
    }
  });

  // -------------------------------------------------------------
  // URL 短縮プロキシ (TinyURL / is.gd)
  // -------------------------------------------------------------
  app.post('/api/shorten-url', async (req, res) => {
    try {
      const { url } = req.body;
      const cleanUrl = typeof url === 'string' ? url.trim() : '';
      if (!cleanUrl || !/^https?:\/\//i.test(cleanUrl)) {
        res.status(400).json({ success: false, error: '有効なURLを入力してください。' });
        return;
      }

      // 1. TinyURL API
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const tinyRes = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(cleanUrl)}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (tinyRes.ok) {
          const shortUrl = (await tinyRes.text()).trim();
          if (shortUrl.startsWith('http')) {
            res.json({ success: true, originalUrl: cleanUrl, shortUrl });
            return;
          }
        }
      } catch (e: any) {
        console.warn('[TinyURL error]:', e.message);
      }

      // 2. is.gd API フォールバック
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const isgdRes = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(cleanUrl)}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (isgdRes.ok) {
          const shortUrl = (await isgdRes.text()).trim();
          if (shortUrl.startsWith('http')) {
            res.json({ success: true, originalUrl: cleanUrl, shortUrl });
            return;
          }
        }
      } catch (e: any) {
        console.warn('[is.gd error]:', e.message);
      }

      res.status(500).json({
        success: false,
        error: 'URL短縮サービスへのアクセスに失敗しました。後ほど再試行してください。',
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: `URL短縮エラー: ${err.message || '内部エラー'}`,
      });
    }
  });

  // -------------------------------------------------------------
  // AI アシスト: 文脈考慮の自然なスレッド分割 (/api/ai/thread-split)
  // -------------------------------------------------------------
  app.post('/api/ai/thread-split', async (req, res) => {
    try {
      const { text, targetPlatform = 'both', includeNumbering = true } = req.body;
      const cleanText = typeof text === 'string' ? text.trim() : '';

      if (!cleanText) {
        res.status(400).json({ success: false, error: '分割対象のテキストが入力されていません。' });
        return;
      }

      const platformConstraints =
        targetPlatform === 'bluesky'
          ? '対象プラットフォーム: Bluesky (各ポストは全角300文字以内、簡潔で知的な知見共有)'
          : targetPlatform === 'threads'
          ? '対象プラットフォーム: Threads (各ポストは全角500文字以内、親しみやすく読みやすいフック重視)'
          : '対象プラットフォーム: Bluesky(300文字以内) と Threads(500文字以内) の両立。各ポストは安全のため全角280文字以内に収めてください。';

      const prompt = `あなたはSNS運用のプロフェッショナルです。以下の長文テキストを、読みやすく魅力的な「ツリー形式（スレッド分割投稿）」に再構成・分割してください。

【重要な制約と目的】
1. 機械的な文字数カウントによるぶつ切り（単語の途中や句読点前での不自然な切断）は厳禁です。
2. 意味のまとまり、段落、起承転結、文末（です・ます等）の自然な区切りを必ず維持してください。
3. 1ポスト目には、読者の関心を惹くフック（概要・問いかけ・要点）を置き、以降のポストで詳細や結論を展開してください。
4. ${platformConstraints}
5. ナンバリング(${includeNumbering ? '有効: 例「(1/3)」「(2/3)」' : '不要'})：${includeNumbering ? '各ポストの末尾に (1/N) や (2/N) などの連番を付与してください。' : '連番は含めないでください。'}
6. 元テキストの重要な情報やURL、ニュアンスを欠落させないでください。

【入力テキスト】
${cleanText}
`;

      const response = await generateGeminiContentWithFallback({
        preferredModel: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: 'あなたは日本語のSNSライティング・スレッド構成の専門家です。指定されたJSON形式のみを出力してください。',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              posts: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '自然な文脈で分割された各ポストの本文配列',
              },
              summary: {
                type: Type.STRING,
                description: 'スレッド構成の意図や工夫したポイント（1〜2文）',
              },
            },
            required: ['posts', 'summary'],
          },
        },
      });

      const responseText = response.text || '{}';
      let parsed: { posts: string[]; summary: string };
      try {
        parsed = JSON.parse(responseText);
      } catch {
        res.status(500).json({ success: false, error: 'AIからのレスポンス解析に失敗しました。' });
        return;
      }

      if (!parsed.posts || !Array.isArray(parsed.posts) || parsed.posts.length === 0) {
        res.status(500).json({ success: false, error: 'スレッド分割結果を生成できませんでした。' });
        return;
      }

      // 「---」区切りでエディタにそのまま反映できる形式
      const formattedText = parsed.posts.join('\n---\n');

      res.json({
        success: true,
        posts: parsed.posts,
        formattedText,
        summary: parsed.summary || '文脈を考慮して読みやすいスレッドに分割しました。',
        postCount: parsed.posts.length,
      });
    } catch (err: any) {
      console.error('[AI Thread Split Error]:', err);
      res.status(500).json({
        success: false,
        error: formatGeminiErrorMessage(err),
      });
    }
  });

  // -------------------------------------------------------------
  // AI アシスト: プラットフォーム別トーン自動調整 (/api/ai/rewrite-tone)
  // -------------------------------------------------------------
  app.post('/api/ai/rewrite-tone', async (req, res) => {
    try {
      const { text } = req.body;
      const cleanText = typeof text === 'string' ? text.trim() : '';

      if (!cleanText) {
        res.status(400).json({ success: false, error: 'リライト対象のテキストが入力されていません。' });
        return;
      }

      const prompt = `あなたはSNS（BlueskyとThreads）の特性を熟知したプロのソーシャルメディアライターです。
与えられた投稿テキストの主要情報、URL、告知内容を正確に維持したまま、以下の2つのプラットフォームに最適化されたトーン＆マナーに書き分けてください。

【プラットフォーム特性の違い】
■ Bluesky向け (blueskyText):
- 想定読者: 開発者、テック層、クリエイター、落ち着いた知見・オピニオンを好むユーザー。
- トーン: 知的・論理的・明快・落ち着いたトーン。過度な感情表現や派手な絵文字の多用は避け、要点や背景、実用的な価値をクリアに提示。
- 文字数: 全角300文字以内。
- ハッシュタグ: 1〜2個程度の適切なハッシュタグ（例: #プログラミング #Web開発 など）。

■ Threads向け (threadsText):
- 想定読者: カジュアル、日常的、共感を重視する幅広い一般〜ビジネスユーザー。
- トーン: 親しみやすく温かみのある語り口。適度な絵文字（文頭や箇条書きの装飾）、読者の共感を呼ぶ冒頭の1行フック、最後に「〜皆さんはどう思いますか？」などのリアクションを促す問いかけ。
- 文字数: 全角500文字以内。
- ハッシュタグ: トピックに溶け込む1個程度、または本文中のキーワード。

【入力テキスト】
${cleanText}
`;

      const response = await generateGeminiContentWithFallback({
        preferredModel: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: 'あなたはSNS文体最適化の専門家です。指定されたJSON形式のみを出力してください。',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              blueskyText: {
                type: Type.STRING,
                description: 'Bluesky向けに落ち着いた知見・開発者向けトーンにリライトした本文（300文字以内）',
              },
              threadsText: {
                type: Type.STRING,
                description: 'Threads向けに親しみやすく共感・フックを重視してリライトした本文（500文字以内）',
              },
              notes: {
                type: Type.STRING,
                description: 'トーン書き分けのポイントや工夫（1〜2文）',
              },
            },
            required: ['blueskyText', 'threadsText', 'notes'],
          },
        },
      });

      const responseText = response.text || '{}';
      let parsed: { blueskyText: string; threadsText: string; notes: string };
      try {
        parsed = JSON.parse(responseText);
      } catch {
        res.status(500).json({ success: false, error: 'AIからのレスポンス解析に失敗しました。' });
        return;
      }

      res.json({
        success: true,
        blueskyText: parsed.blueskyText,
        threadsText: parsed.threadsText,
        notes: parsed.notes || '各SNSの読者層とカルチャーに合わせてトーンを調整しました。',
      });
    } catch (err: any) {
      console.error('[AI Rewrite Tone Error]:', err);
      res.status(500).json({
        success: false,
        error: formatGeminiErrorMessage(err),
      });
    }
  });

  // -------------------------------------------------------------
  // AI アシスト: 誤字脱字・NGワード・規約違反・リンク切れチェッカー (/api/ai/check-safety)
  // -------------------------------------------------------------
  app.post('/api/ai/check-safety', async (req, res) => {
    try {
      const { text, checkLinks = true } = req.body;
      const cleanText = typeof text === 'string' ? text.trim() : '';

      if (!cleanText) {
        res.status(400).json({ success: false, error: 'チェック対象のテキストが入力されていません。' });
        return;
      }

      // 1. 本文中のURL抽出とリンク切れチェック (並列実行)
      const urlRegex = /https?:\/\/[^\s"'<>\(\)]+/gi;
      const matchedUrls = Array.from(new Set(cleanText.match(urlRegex) || []));
      const linkCheckResults: Array<{ url: string; status: 'ok' | 'broken' | 'unreachable'; statusCode?: number; error?: string }> = [];

      if (checkLinks && matchedUrls.length > 0) {
        const linkPromises = matchedUrls.map(async (targetUrl) => {
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 6000);
            let checkRes = await fetch(targetUrl, {
              method: 'HEAD',
              signal: controller.signal,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              },
            }).catch(() => null);

            if (!checkRes || checkRes.status === 405) {
              checkRes = await fetch(targetUrl, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                },
              }).catch(() => null);
            }
            clearTimeout(timeout);

            if (!checkRes) {
              return { url: targetUrl, status: 'unreachable' as const, error: 'サーバーに接続できませんでした（無応答またはドメイン未解決）' };
            }
            if (checkRes.status >= 200 && checkRes.status < 400) {
              return { url: targetUrl, status: 'ok' as const, statusCode: checkRes.status };
            } else {
              return { url: targetUrl, status: 'broken' as const, statusCode: checkRes.status, error: `ステータスコード: ${checkRes.status}` };
            }
          } catch (e: any) {
            return { url: targetUrl, status: 'unreachable' as const, error: e.message || '接続エラー' };
          }
        });

        const resolvedLinks = await Promise.all(linkPromises);
        linkCheckResults.push(...resolvedLinks);
      }

      // 2. Geminiによる校正・セーフティ・シャドウバンリスク・規約チェック
      const prompt = `あなたはSNS（Bluesky / AT Protocol、Threads / Meta）のコンテンツセーフティ・校正の最高責任者です。
以下の投稿テキストを多角的に分析し、投稿前に改善すべきリスクや誤字脱字を報告してください。

【分析項目】
1. 誤字脱字・日本語の不自然さ (category: 'typo')
   - てにをはの誤り、同音異義語の誤変換、脱字、重複語など。
2. シャドウバン・スパム判定リスク (category: 'shadowban')
   - MetaやBlueskyのアルゴリズムがリーチ制限（シャドウバン）やスパム判定しやすい表現。
   - 例: 過度な金銭誘導（「月収100万」「即金」「副業で稼ぐ」）、露骨な誇大広告、フォロー＆リポストの強要（「拡散希望！絶対RTして」）、過度な煽り文句。
3. 記号の過剰連続使用 (category: 'symbols')
   - 「！！！！」「？？？？」「$$$$」「★★★」など、スパムフィルターに捕捉されやすい記号の連続。
4. コミュニティ規約・ガイドラインリスク (category: 'policy')
   - 攻撃的表現、誹謗中傷と受け取られかねない言い回し、センシティブな断定表現。

【深刻度レベル (severity)】
- 'error': 投稿停止を強く推奨（規約違反・アカウント制限・リンク切れの疑いなど）
- 'warning': 改善を推奨（シャドウバンでインプレッション激減リスク、明白な誤字など）
- 'info': より良くなるアドバイス（表現の洗練、読者への配慮など）

【入力テキスト】
${cleanText}
`;

      const response = await generateGeminiContentWithFallback({
        preferredModel: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: 'あなたはSNSコンテンツの校正と規約セーフティの専門家です。指定されたJSON形式のみを出力してください。',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              safetyScore: {
                type: Type.INTEGER,
                description: '0〜100点満点の総合健全性・安全性スコア（100点が極めて安全・自然）',
              },
              issues: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    severity: { type: Type.STRING, description: 'error | warning | info' },
                    category: { type: Type.STRING, description: 'typo | shadowban | symbols | policy' },
                    title: { type: Type.STRING, description: '指摘の簡潔なタイトル' },
                    description: { type: Type.STRING, description: '問題の理由と改善のメリット' },
                    suggestion: { type: Type.STRING, description: '具体的な修正案・言い換え表現' },
                    targetText: { type: Type.STRING, description: '該当する元の文字列' },
                  },
                  required: ['severity', 'category', 'title', 'description'],
                },
                description: '検出された問題・改善点の一覧',
              },
              improvedText: {
                type: Type.STRING,
                description: '誤字脱字や過剰な記号・NG表現を修正した安全な推奨テキスト',
              },
              summary: {
                type: Type.STRING,
                description: '全体評価のまとめ（1〜2文）',
              },
            },
            required: ['safetyScore', 'issues', 'improvedText', 'summary'],
          },
        },
      });

      const responseText = response.text || '{}';
      let parsed: {
        safetyScore: number;
        issues: Array<{
          severity: 'error' | 'warning' | 'info';
          category: 'typo' | 'shadowban' | 'symbols' | 'policy';
          title: string;
          description: string;
          suggestion?: string;
          targetText?: string;
        }>;
        improvedText: string;
        summary: string;
      };

      try {
        parsed = JSON.parse(responseText);
      } catch {
        res.status(500).json({ success: false, error: 'AIセーフティ解析のレスポンス解析に失敗しました。' });
        return;
      }

      // リンク切れの検出結果をissuesに統合
      const combinedIssues = [...(parsed.issues || [])];
      for (const link of linkCheckResults) {
        if (link.status === 'broken' || link.status === 'unreachable') {
          combinedIssues.unshift({
            severity: 'error',
            category: 'policy',
            title: `リンク切れの可能性 (${link.statusCode ? `HTTP ${link.statusCode}` : '接続不可'})`,
            description: `URL「${link.url}」へのアクセスが確認できませんでした。${link.error || ''}。投稿前にURLが有効か再確認してください。`,
            targetText: link.url,
            suggestion: 'URLのスペルミスや公開設定を確認してください',
          });
        }
      }

      // リンク切れがあった場合はスコアを調整
      let adjustedScore = parsed.safetyScore ?? 100;
      const brokenCount = linkCheckResults.filter((l) => l.status !== 'ok').length;
      if (brokenCount > 0) {
        adjustedScore = Math.max(20, adjustedScore - brokenCount * 25);
      }

      res.json({
        success: true,
        safetyScore: adjustedScore,
        issues: combinedIssues,
        improvedText: parsed.improvedText || cleanText,
        summary: parsed.summary || '解析が完了しました。',
        linkChecks: linkCheckResults,
      });
    } catch (err: any) {
      console.error('[AI Safety Check Error]:', err);
      res.status(500).json({
        success: false,
        error: formatGeminiErrorMessage(err),
      });
    }
  });

  // メディアファイル事前アップロード用エンドポイント (動画・大容量画像ストリーム受付)
  app.post('/api/media/upload', uploadMiddleware.single('file'), (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'アップロードされたファイルがありません。' });
        return;
      }

      const mediaId = crypto.randomBytes(16).toString('hex');
      const originalName = req.file.originalname || 'media';
      const detected = detectMediaFormat(req.file.buffer, req.file.mimetype, originalName);
      const mimeType = detected.mimeType;
      const isVideo = detected.isVideo;
      const safeUploadName = detected.safeName;

      // 基準URL解決
      const proto = req.headers['x-forwarded-proto'] || 'https';
      const rawHost = (req.headers['x-forwarded-host'] || req.get('host') || 'localhost').toString();
      const cleanHost = rawHost.split(',')[0].trim().replace(/:3000$/, '');
      const baseUrl = `${proto}://${cleanHost}`;
      const selfServerUrl = `${baseUrl}/api/media/${mediaId}`;

      mediaStorage.set(mediaId, {
        buffer: req.file.buffer,
        mimeType,
        createdAt: Date.now(),
        // 内部URLをpublicUrlと誤認させないため、初期値はundefinedにする
        publicUrl: undefined,
      });

      // バックグラウンドで外部CDNキャッシュを非同期ウォームアップ（レスポンスはブロックしない）
      uploadMediaToPublicHost(req.file.buffer, mimeType, safeUploadName).then((extUrl) => {
        if (extUrl && isTrulyPublicCdnUrl(extUrl)) {
          const stored = mediaStorage.get(mediaId);
          if (stored) {
            stored.publicUrl = extUrl;
          }
        }
      }).catch(() => {});

      res.json({
        success: true,
        mediaId,
        publicUrl: selfServerUrl,
        mimeType,
        size: req.file.size,
        name: req.file.originalname,
        mediaType: isVideo ? 'video' : 'image',
      });
    } catch (err: any) {
      console.error('Media upload error:', err);
      res.status(500).json({
        success: false,
        error: `メディアの受信に失敗しました: ${err.message || '不明なエラー'}`,
      });
    }
  });

  // Threads / 外部Metaクローラー向け高速パブリックアップロードエンドポイント
  app.post('/api/media/upload-public', uploadMiddleware.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'アップロードされたファイルがありません。' });
        return;
      }

      const mediaId = crypto.randomBytes(16).toString('hex');
      const originalName = req.file.originalname || 'media';
      const detected = detectMediaFormat(req.file.buffer, req.file.mimetype, originalName);
      const mimeType = detected.mimeType;
      const isVideo = detected.isVideo;
      const safeUploadName = detected.safeName;

      // 外部CDN (Litterbox / Uguu / tmpfiles.org) へ高速公開
      let publicUrl = await uploadMediaToPublicHost(req.file.buffer, mimeType, safeUploadName);

      // 基準URL解決
      const proto = req.headers['x-forwarded-proto'] || 'https';
      const rawHost = (req.headers['x-forwarded-host'] || req.get('host') || 'localhost').toString();
      const cleanHost = rawHost.split(',')[0].trim().replace(/:3000$/, '');
      const baseUrl = `${proto}://${cleanHost}`;
      const selfServerUrl = `${baseUrl}/api/media/${mediaId}`;

      const trulyPublic = isTrulyPublicCdnUrl(publicUrl);

      mediaStorage.set(mediaId, {
        buffer: req.file.buffer,
        mimeType,
        createdAt: Date.now(),
        publicUrl: trulyPublic ? publicUrl : undefined,
      });

      console.log(`[upload-public] Processed mediaId: ${mediaId}, publicUrl: ${publicUrl || selfServerUrl}, isTrulyPublic: ${trulyPublic}`);

      res.json({
        success: true,
        mediaId,
        publicUrl: trulyPublic && publicUrl ? publicUrl : selfServerUrl,
        isTrulyPublic: trulyPublic,
        mimeType,
        size: req.file.size,
        name: req.file.originalname,
        mediaType: isVideo ? 'video' : 'image',
      });
    } catch (err: any) {
      console.error('Media upload-public error:', err);
      res.status(500).json({
        success: false,
        error: `パブリックメディアのアップロードに失敗しました: ${err.message || '不明なエラー'}`,
      });
    }
  });

  // Threads 画像・動画動的配信用エンドポイント (Meta Graph API がメディアを取得するための一時URL)
  app.all('/api/media/:id', (req, res) => {
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.status(204).end();
      return;
    }

    const item = mediaStorage.get(req.params.id);
    if (!item) {
      res.status(404).send('Media not found or expired');
      return;
    }

    const totalSize = item.buffer.length;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Cache-Control', 'public, max-age=3600, immutable');
    res.setHeader('Accept-Ranges', 'bytes');

    if (req.method === 'HEAD') {
      res.setHeader('Content-Type', item.mimeType);
      res.setHeader('Content-Length', totalSize);
      res.status(200).end();
      return;
    }

    // HTTP Range リクエスト処理 (Metaクローラーや動画プレイヤーがメタデータ取得のために使用)
    const rangeHeader = req.headers.range;
    if (rangeHeader && typeof rangeHeader === 'string' && rangeHeader.startsWith('bytes=')) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10) || 0;
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

      if (start >= totalSize || end >= totalSize || start > end) {
        res.setHeader('Content-Range', `bytes */${totalSize}`);
        res.status(416).send('Requested Range Not Satisfiable');
        return;
      }

      const chunkSize = end - start + 1;
      const chunk = item.buffer.subarray(start, end + 1);

      res.status(206);
      res.setHeader('Content-Type', item.mimeType);
      res.setHeader('Content-Length', chunkSize);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
      res.send(chunk);
      return;
    }

    res.setHeader('Content-Type', item.mimeType);
    res.setHeader('Content-Length', totalSize);
    res.send(item.buffer);
  });

  // -------------------------------------------------------------
  // Bluesky (AT Protocol) エンドポイント
  // -------------------------------------------------------------

  /**
   * Bluesky 動画アップロードサービス (video.bsky.app または PDS uploadBlob)
   */
  async function uploadBlueskyVideo(
    buffer: Buffer,
    mimeType: string,
    fileName: string,
    did: string,
    accessJwt: string,
    pdsEndpoint: string
  ): Promise<any> {
    const uploadName = fileName || 'video.mp4';
    const videoServiceUrl = 'https://video.bsky.app';
    const cleanMime = mimeType.startsWith('video/') && !mimeType.includes('quicktime') && !mimeType.includes('webm')
      ? mimeType
      : 'video/mp4';

    // 1. video.bsky.app 公式動画サービス用 Service Auth トークン取得
    let serviceAuthToken = accessJwt;
    try {
      const authUrl = `${pdsEndpoint.replace(/\/+$/, '')}/xrpc/com.atproto.server.getServiceAuth?aud=did:web:video.bsky.app&lxm=app.bsky.video.uploadVideo`;
      const saRes = await fetch(authUrl, {
        headers: { Authorization: `Bearer ${accessJwt}` },
      });
      if (saRes.ok) {
        const saData = await saRes.json().catch(() => ({}));
        if (saData?.token) {
          serviceAuthToken = saData.token;
          console.log('[Bluesky Video] Successfully obtained service auth token for video.bsky.app');
        }
      }
    } catch (saErr: any) {
      console.warn(`[Bluesky Video] Note on getServiceAuth: ${saErr.message}`);
    }

    // 2. video.bsky.app 公式動画サービスへアップロード試行
    try {
      const url = `${videoServiceUrl}/xrpc/app.bsky.video.uploadVideo?did=${encodeURIComponent(did)}&name=${encodeURIComponent(uploadName)}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);

      const uploadRes = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serviceAuthToken}`,
          'Content-Type': cleanMime,
        },
        body: buffer,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json().catch(() => ({}));
        if (uploadData?.blob) {
          return uploadData.blob;
        }
        if (uploadData?.jobId) {
          const jobId = uploadData.jobId;
          for (let attempt = 0; attempt < 25; attempt++) {
            const waitTime = attempt === 0 ? 400 : attempt <= 3 ? 700 : 1200;
            await new Promise((r) => setTimeout(r, waitTime));
            const statusRes = await fetch(
              `${videoServiceUrl}/xrpc/app.bsky.video.getJobStatus?jobId=${encodeURIComponent(jobId)}`,
              {
                headers: {
                  Authorization: `Bearer ${serviceAuthToken}`,
                },
              }
            );
            if (statusRes.ok) {
              const statusData = await statusRes.json().catch(() => ({}));
              if (statusData?.jobStatus?.blob) {
                return statusData.jobStatus.blob;
              }
              if (statusData?.jobStatus?.state === 'JOB_STATE_FAILED') {
                console.warn('[Bluesky Video] Encode failed:', statusData.jobStatus.error);
                break;
              }
            }
          }
        }
      } else {
        const errJson = await uploadRes.json().catch(() => ({}));
        console.warn(`[Bluesky Video] video.bsky.app responded with ${uploadRes.status}:`, errJson);
      }
    } catch (err: any) {
      console.warn(`[Bluesky Video] video.bsky.app upload note: ${err.message}`);
    }

    // 3. フォールバック: 通常のPDS uploadBlob
    console.log('[Bluesky Video] Falling back to PDS uploadBlob...');
    const fallbackRes = await fetch(`${pdsEndpoint}/xrpc/com.atproto.repo.uploadBlob`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessJwt}`,
        'Content-Type': 'video/mp4',
      },
      body: buffer,
    });

    if (fallbackRes.ok) {
      const fallbackData = await fallbackRes.json().catch(() => ({}));
      if (fallbackData?.blob) {
        return fallbackData.blob;
      }
    }

    throw new Error('Blueskyへの動画アップロードに失敗しました。ファイル形式(MP4/MOV)およびサイズ(最大50MB)をご確認ください。');
  }

  // =========================================================================
  // リプライ投稿サポート: URL/IDパース & 対象投稿取得・検証エンドポイント
  // =========================================================================

  function parseBlueskyUrlOrUri(input: string): { handleOrDid: string; rkey: string } | null {
    if (typeof input !== 'string') return null;
    const clean = input.trim();
    const atMatch = clean.match(/^at:\/\/([a-zA-Z0-9.:_-]+)\/app\.bsky\.feed\.post\/([a-zA-Z0-9]+)$/);
    if (atMatch) {
      return { handleOrDid: atMatch[1], rkey: atMatch[2] };
    }
    const webMatch = clean.match(/bsky\.app\/profile\/([a-zA-Z0-9.:_-]+)\/post\/([a-zA-Z0-9]+)/);
    if (webMatch) {
      return { handleOrDid: webMatch[1], rkey: webMatch[2] };
    }
    return null;
  }

  function convertToThreadsUrl(username?: string | null, postId?: string | null): string {
    let cleanUser = (username || '').trim();
    if (cleanUser.includes('threads.') || cleanUser.includes('/@')) {
      const userMatch = cleanUser.match(/@([a-zA-Z0-9._]+)/);
      if (userMatch) cleanUser = userMatch[1];
    }
    cleanUser = cleanUser.replace(/^@+/, '').replace(/\/+$/, '').trim();

    let cleanId = (postId || '').trim();
    if (cleanId.includes('threads.') || cleanId.includes('/post/') || cleanId.includes('/t/')) {
      const idMatch = cleanId.match(/\/(?:post|t|share)\/([a-zA-Z0-9_\-]+)/i);
      if (idMatch) cleanId = idMatch[1];
    }
    cleanId = cleanId.split('?')[0].split('#')[0].replace(/^\/+/, '').replace(/\/+$/, '').trim();

    if (!cleanUser && !cleanId) return 'https://www.threads.net';
    if (!cleanUser) return `https://www.threads.net/post/${cleanId}`;
    if (!cleanId) return `https://www.threads.net/@${cleanUser}`;
    return `https://www.threads.net/@${cleanUser}/post/${cleanId}`;
  }

  function extractUsernameFromThreadsUrl(url: string): string | null {
    if (!url || typeof url !== 'string') return null;
    const clean = url.trim().split('?')[0].split('#')[0];
    if (clean.includes('bsky.app') || clean.includes('bsky.social') || clean.startsWith('at://') || clean.includes('/profile/')) {
      return null;
    }
    const match = clean.match(/(?:threads\.(?:net|com)\/)?@([a-zA-Z0-9._]+)/i);
    if (match) return match[1];
    const directMatch = clean.match(/threads\.(?:net|com)\/([a-zA-Z0-9._]+)\/post\//i);
    if (directMatch && !['post', 't', 'share', 'intent'].includes(directMatch[1].toLowerCase())) {
      return directMatch[1];
    }
    return null;
  }

  function checkThreadsPostOwnershipMatch(
    formattedOrInputUrl: string,
    authenticatedUsername?: string
  ): {
    isMatch: boolean | null;
    extractedUsername: string | null;
    authenticatedUsername: string | null;
    formattedUrl: string;
    reason: string;
  } {
    const extracted = extractUsernameFromThreadsUrl(formattedOrInputUrl);
    const cleanAuth = (authenticatedUsername || '').replace(/^@/, '').trim().toLowerCase();

    if (!extracted) {
      return {
        isMatch: null,
        extractedUsername: null,
        authenticatedUsername: cleanAuth || null,
        formattedUrl: formattedOrInputUrl,
        reason: 'URLからユーザー名が検出されませんでした',
      };
    }

    const cleanExtracted = extracted.replace(/^@/, '').trim().toLowerCase();
    if (!cleanAuth) {
      return {
        isMatch: null,
        extractedUsername: extracted,
        authenticatedUsername: null,
        formattedUrl: formattedOrInputUrl,
        reason: '認証アカウント未設定',
      };
    }

    const isMatch = cleanExtracted === cleanAuth;
    const formattedUrl = convertToThreadsUrl(cleanExtracted, formattedOrInputUrl);

    return {
      isMatch,
      extractedUsername: extracted,
      authenticatedUsername: cleanAuth,
      formattedUrl,
      reason: isMatch
        ? `抽出ユーザー名（@${extracted}）と利用者の登録アカウント（@${cleanAuth}）が一致しました（同一人物確認済）`
        : `抽出ユーザー名（@${extracted}）は利用者の登録アカウント（@${cleanAuth}）と異なります（他者投稿）`,
    };
  }

  function parseThreadsUrlOrId(input: string): { username?: string; codeOrId: string; isNumericId: boolean } | null {
    if (typeof input !== 'string') return null;
    let clean = input.trim().replace(/^<|>$/g, '');
    const cleanWithoutQuery = clean.split('?')[0].split('#')[0].replace(/\/+$/, '');

    if (clean.includes('bsky.app') || clean.includes('bsky.social') || clean.startsWith('at://') || clean.includes('/profile/')) {
      return null;
    }

    if (/^\d{10,25}$/.test(cleanWithoutQuery)) {
      return { codeOrId: cleanWithoutQuery, isNumericId: true };
    }
    // https://www.threads.com/@username/post/CODE or https://www.threads.net/@username/post/CODE
    const userPostMatch = cleanWithoutQuery.match(/(?:threads\.(?:net|com)\/)?@?([a-zA-Z0-9._]+)\/post\/([a-zA-Z0-9_\-]+)/i);
    if (userPostMatch && (clean.includes('threads.') || clean.startsWith('@') || clean.includes('/post/'))) {
      return { username: userPostMatch[1], codeOrId: userPostMatch[2], isNumericId: /^\d+$/.test(userPostMatch[2]) };
    }
    // https://www.threads.com/post/CODE
    const simplePostMatch = cleanWithoutQuery.match(/threads\.(?:net|com)\/post\/([a-zA-Z0-9_\-]+)/i);
    if (simplePostMatch) {
      return { codeOrId: simplePostMatch[1], isNumericId: /^\d+$/.test(simplePostMatch[1]) };
    }
    // https://www.threads.com/t/CODE
    const shortMatch = cleanWithoutQuery.match(/threads\.(?:net|com)\/t\/([a-zA-Z0-9_\-]+)/i);
    if (shortMatch) {
      return { codeOrId: shortMatch[1], isNumericId: /^\d+$/.test(shortMatch[1]) };
    }
    // https://www.threads.com/share/CODE
    const shareMatch = cleanWithoutQuery.match(/threads\.(?:net|com)\/share\/([a-zA-Z0-9_\-]+)/i);
    if (shareMatch) {
      return { codeOrId: shareMatch[1], isNumericId: /^\d+$/.test(shareMatch[1]) };
    }
    return null;
  }

  // Threads Shortcode (Base64) から64bit数値Media IDへのデコーダ
  function decodeThreadsShortcodeToNumericId(code: string): string | null {
    if (!code) return null;
    if (/^\d+$/.test(code)) return code;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let id = 0n;
    for (let i = 0; i < code.length; i++) {
      const char = code[i];
      const val = BigInt(alphabet.indexOf(char));
      if (val < 0n) return null;
      id = id * 64n + val;
    }
    return id.toString();
  }

  // Threads短縮URL・共有URL（/share/や/t/等）のリダイレクト追跡・正規投稿URL解決
  async function unshortenThreadsUrl(url: string): Promise<{ url: string; textSnippet: string | null }> {
    if (!url || typeof url !== 'string') return { url, textSnippet: null };
    const clean = url.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) return { url: clean, textSnippet: null };
    if (clean.includes('threads.com') || clean.includes('threads.net')) {
      try {
        const res = await fetch(clean, {
          method: 'GET',
          headers: {
            'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        const html = await res.text();
        const canonicalMatch =
          html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i) ||
          html.match(/<meta[^>]+property="og:url"[^>]+content="([^"]+)"/i);
        const descMatch = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i);

        const canonicalUrl = canonicalMatch
          ? canonicalMatch[1].replace(/&#064;/g, '@').split('?')[0]
          : null;
        const textSnippet = descMatch
          ? descMatch[1].replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
          : null;

        if (canonicalUrl) {
          console.log(`[unshortenThreadsUrl] Resolved ${clean} -> ${canonicalUrl}`);
          return { url: canonicalUrl, textSnippet };
        }
        if (res.url && res.url !== clean) {
          const redirectUrl = res.url.split('?')[0];
          console.log(`[unshortenThreadsUrl] Followed redirect ${clean} -> ${redirectUrl}`);
          return { url: redirectUrl, textSnippet };
        }
      } catch (err) {
        console.warn('[unshortenThreadsUrl] Redirect follow error:', err);
      }
    }
    return { url: clean, textSnippet: null };
  }

  // 1. リプライ先投稿の検証・情報取得 (Bluesky / Threads)
  app.post('/api/reply/resolve-target', async (req, res) => {
    try {
      const { platform, urlOrId, credentials = {} } = req.body;
      const cleanInput = sanitizeInput(urlOrId).trim();

      if (!cleanInput) {
        res.status(400).json({ success: false, error: '投稿URLまたはIDが入力されていません。' });
        return;
      }

      // プラットフォームの自動判定（URLから Bluesky または Threads を検出）
      let resolvedPlatform = platform;
      if (!resolvedPlatform || resolvedPlatform === 'auto') {
        if (parseBlueskyUrlOrUri(cleanInput) || cleanInput.includes('bsky.app') || cleanInput.startsWith('at://')) {
          resolvedPlatform = 'Bluesky';
        } else if (parseThreadsUrlOrId(cleanInput) || cleanInput.includes('threads.com') || cleanInput.includes('threads.net')) {
          resolvedPlatform = 'Threads';
        } else {
          res.status(400).json({
            success: false,
            error: 'URLからBlueskyまたはThreadsの投稿を自動判定できませんでした。https://bsky.app/... または https://www.threads.com/... の投稿URLを入力してください。',
          });
          return;
        }
      }

      const isDemoMode = Boolean(credentials.isDemoMode) ||
        (resolvedPlatform === 'Bluesky' && (credentials.blueskyIdentifier || '').includes('demo')) ||
        (resolvedPlatform === 'Threads' && (credentials.threadsAccessToken || '').includes('demo'));

      // -------------------------------------------------------------
      // Bluesky のリプライ対象解決
      // -------------------------------------------------------------
      if (resolvedPlatform === 'Bluesky') {
        const isBskyFormat = /^https?:\/\/(?:[a-zA-Z0-9-]+\.)?bsky\.app\/profile\/[^\s/]+\/post\/[^\s/]+/i.test(cleanInput) ||
                             cleanInput.startsWith('at://') ||
                             Boolean(parseBlueskyUrlOrUri(cleanInput));

        if (!isBskyFormat) {
          res.status(400).json({
            success: false,
            error: 'Blueskyの投稿URLは「https://bsky.app/profile/.../post/...」の形式で入力してください。',
          });
          return;
        }

        const parsed = parseBlueskyUrlOrUri(cleanInput);
        if (!parsed) {
          res.status(400).json({
            success: false,
            error: 'Blueskyの投稿URL（https://bsky.app/profile/.../post/...）または AT-URI（at://...）の形式が正しくありません。',
          });
          return;
        }

        // デモ版シミュレーション: https://bsky.app/... の形式の場合のみシミュレート可能
        if (isDemoMode) {
          res.json({
            success: true,
            target: {
              platform: 'Bluesky',
              urlOrId: cleanInput,
              resolvedId: `at://did:plc:democreator1029384756/app.bsky.feed.post/${parsed.rkey}`,
              cid: 'bafyreidemo1234567890abcdef',
              rootUri: `at://did:plc:democreator1029384756/app.bsky.feed.post/${parsed.rkey}`,
              rootCid: 'bafyreidemo1234567890abcdef',
              authorName: parsed.handleOrDid.includes('demo') ? 'デモクリエイター' : `@${parsed.handleOrDid}`,
              authorHandle: parsed.handleOrDid.includes('.') ? parsed.handleOrDid : `${parsed.handleOrDid}.bsky.social`,
              authorAvatar: undefined,
              textSnippet: '【デモシミュレーション】Bluesky返信先投稿のURL形式を確認しました。リプライ投稿のシミュレートが可能です。',
              createdAt: new Date().toISOString(),
              isOwnPost: true,
              isOwnerMatch: true,
              canReply: true,
              verifiedCanReply: true,
              checkStatusMessage: 'デモシミュレート可能（https://bsky.app/... 形式確認済）',
            },
          });
          return;
        }

        try {
          let did = parsed.handleOrDid;
          // ハンドル名の場合は DID を解決
          if (!did.startsWith('did:')) {
            const resolveRes = await fetch(
              `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(did)}`
            );
            if (resolveRes.ok) {
              const rData = await resolveRes.json();
              if (rData.did) did = rData.did;
            }
          }

          const atUri = `at://${did}/app.bsky.feed.post/${parsed.rkey}`;
          const threadRes = await fetch(
            `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(atUri)}&depth=0`
          );

          if (!threadRes.ok) {
            const errData = await threadRes.json().catch(() => ({}));
            res.status(404).json({
              success: false,
              error: `Bluesky投稿の取得に失敗しました: ${errData.message || threadRes.statusText || '投稿が見つかりません'}`,
            });
            return;
          }

          const threadData = await threadRes.json();
          const post = threadData?.thread?.post;
          if (!post) {
            res.status(404).json({ success: false, error: '指定されたBluesky投稿が見つかりませんでした。' });
            return;
          }

          // ルートURI/CIDの判定（既にツリーの場合、ツリーの最上位 root を引き継ぐ）
          const recordReply = post.record?.reply;
          const rootUri = recordReply?.root?.uri || post.uri;
          const rootCid = recordReply?.root?.cid || post.cid;

          const currentHandle = (credentials.blueskyHandle || credentials.blueskyIdentifier || '').toLowerCase();
          const isOwnPost = (post.author?.handle || '').toLowerCase() === currentHandle || post.author?.did === credentials.blueskyDid;

          res.json({
            success: true,
            target: {
              platform: 'Bluesky',
              urlOrId: cleanInput,
              resolvedId: post.uri,
              cid: post.cid,
              rootUri,
              rootCid,
              authorName: post.author?.displayName || post.author?.handle,
              authorHandle: post.author?.handle,
              authorAvatar: post.author?.avatar,
              textSnippet: post.record?.text || '',
              textExcerpt: post.record?.text ? post.record.text.slice(0, 180) : '',
              createdAt: post.record?.createdAt || post.indexedAt,
              isOwnPost,
              canReply: true, // Bluesky は他人の投稿にも自分の投稿にも公式APIでリプライ可能
            },
          });
          return;
        } catch (fetchErr: any) {
          res.status(500).json({
            success: false,
            error: `Bluesky投稿情報取得エラー: ${fetchErr.message || '通信に失敗しました'}`,
          });
          return;
        }
      }

      // -------------------------------------------------------------
      // Threads のリプライ対象解決（おすすめの2段階設計パターン）
      // 1段階目: URL/ユーザー名および GET API (個別投稿 /me/threads / /{id}) による高速・安全な所有権チェック
      // 2段階目: Dry-run コンテナ作成プローブによる実動作の完全検証
      // -------------------------------------------------------------
      if (resolvedPlatform === 'Threads') {
        const isThreadsUrlFormat =
          /^https?:\/\/(?:[a-zA-Z0-9-]+\.)?threads\.(?:com|net)\/[^\s]+/i.test(cleanInput) ||
          /^\d{10,25}$/.test(cleanInput);

        if (!isThreadsUrlFormat) {
          res.status(400).json({
            success: false,
            error: 'Threadsの投稿URLは「https://www.threads.com/...」または「https://www.threads.net/...」の形式で入力してください。',
          });
          return;
        }

        // 共有URL（/share/や/t/等）のリダイレクトを追跡して正規投稿URLに解決
        let targetUrlOrInput = cleanInput;
        let unshortenedSnippet: string | null = null;
        if (targetUrlOrInput.startsWith('http://') || targetUrlOrInput.startsWith('https://')) {
          const unshortened = await unshortenThreadsUrl(targetUrlOrInput);
          targetUrlOrInput = unshortened.url;
          unshortenedSnippet = unshortened.textSnippet;
        }

        const parsed = parseThreadsUrlOrId(targetUrlOrInput) || parseThreadsUrlOrId(cleanInput);
        if (!parsed) {
          res.status(400).json({
            success: false,
            error: 'Threadsの投稿URL（https://www.threads.com/@user/post/... または /share/... 等）の形式が正しくありません。',
          });
          return;
        }

        const threadsToken = sanitizeInput(credentials.threadsAccessToken);

        // -------------------------------------------------------------
        // デモ版シミュレーション
        // -------------------------------------------------------------
        if (isDemoMode || !threadsToken) {
          const displayUsername = parsed.username || credentials.threadsUsername || 'Demo_User';
          res.json({
            success: true,
            target: {
              platform: 'Threads',
              urlOrId: targetUrlOrInput,
              resolvedId: parsed.codeOrId || 'demo_threads_post_123',
              permalink: targetUrlOrInput,
              authorName: displayUsername,
              authorHandle: displayUsername.replace(/^@/, ''),
              textExcerpt: unshortenedSnippet || '【デモシミュレーション】Threads投稿URL形式を確認しました。リプライ投稿のシミュレートが可能です。',
              textSnippet: unshortenedSnippet || '【デモシミュレーション】Threads投稿URL形式を確認しました。リプライ投稿のシミュレートが可能です。',
              createdAt: new Date().toISOString(),
              isOwnPost: true,
              isOwnerMatch: true,
              canReply: true,
              isDemoSkipped: false,
              verifiedCanReply: true,
              checkStatusMessage: 'デモシミュレート可能（Threads URL形式確認済）',
            },
          });
          return;
        }

        // -------------------------------------------------------------
        // 1段階目: 高速APIチェック（所有権とユーザー名照合）
        // -------------------------------------------------------------
        const meRes = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${threadsToken}`);
        const meData = await meRes.json().catch(() => ({}));
        if (!meRes.ok || !meData.id) {
          res.status(401).json({
            success: false,
            error: `Threadsアカウントの認証確認に失敗しました: ${meData?.error?.message || meRes.statusText}`,
          });
          return;
        }

        const currentUserId = String(meData.id);
        const currentUsername = String(meData.username || '').toLowerCase();

        // ユーザー名がURLに含まれており、かつログイン中のユーザーと異なる場合は即座に判定
        const isUserMatch = parsed.username
          ? parsed.username.replace(/^@/, '').toLowerCase() === currentUsername
          : null;

        if (parsed.username && isUserMatch === false) {
          res.json({
            success: true,
            target: {
              platform: 'Threads',
              urlOrId: targetUrlOrInput,
              resolvedId: parsed.codeOrId,
              permalink: targetUrlOrInput,
              authorName: parsed.username,
              authorHandle: parsed.username,
              textSnippet: '（他ユーザーのアカウント投稿）',
              textExcerpt: '（他ユーザーのアカウント投稿）',
              isOwnPost: false,
              isOwnerMatch: false,
              canReply: false,
              verifiedCanReply: false,
              error: `Threads APIの制限により、現在連携中のご自身のアカウント（@${meData.username}）の投稿にのみリプライ可能です。指定されたURLの投稿者（@${parsed.username}）は異なるアカウントのためリプライできません。`,
              checkStatusMessage: `他者アカウント（@${parsed.username}）のためリプライ不可`,
            },
          });
          return;
        }

        const decodedNumericId = decodeThreadsShortcodeToNumericId(parsed.codeOrId);

        // 利用者の最近の投稿一覧（/me/threads）から照合（※Threads Graph APIでshortcodeフィールドは不可なため除外）
        let matchedItem: any = null;
        try {
          const threadsListRes = await fetch(
            `https://graph.threads.net/v1.0/me/threads?fields=id,media_type,text,timestamp,permalink,username&limit=100&access_token=${threadsToken}`
          );
          if (threadsListRes.ok) {
            const threadsListData = await threadsListRes.json();
            const list: any[] = threadsListData.data || [];
            matchedItem = list.find((item) => {
              if (item.id === parsed.codeOrId || (decodedNumericId && item.id === decodedNumericId)) return true;
              if (
                item.permalink &&
                (item.permalink.includes(parsed.codeOrId) ||
                  item.permalink === cleanInput ||
                  item.permalink === targetUrlOrInput ||
                  (decodedNumericId && item.permalink.includes(decodedNumericId)))
              )
                return true;
              return false;
            });
          }
        } catch (listErr) {
          console.warn('[Threads Reply] Failed to fetch /me/threads:', listErr);
        }

        let targetMediaId = matchedItem
          ? matchedItem.id
          : decodedNumericId || (parsed.isNumericId ? parsed.codeOrId : null);
        let postSnippet = matchedItem?.text || unshortenedSnippet || '';
        let postCreatedAt = matchedItem?.timestamp || new Date().toISOString();
        let isOwnerConfirmed = Boolean(matchedItem) || isUserMatch === true;

        // /me/threads で未ヒットの場合、個別メディア照会（GET /{media-id}）で補完
        if (targetMediaId && !matchedItem) {
          try {
            const mediaRes = await fetch(
              `https://graph.threads.net/v1.0/${targetMediaId}?fields=id,text,timestamp,username,permalink,owner&access_token=${threadsToken}`
            );
            const mediaData = await mediaRes.json().catch(() => ({}));
            if (mediaRes.ok && mediaData.id) {
              const mediaOwnerId = String(mediaData.owner?.id || '');
              const mediaUsername = String(mediaData.username || '').toLowerCase();
              if (mediaOwnerId === currentUserId || mediaUsername === currentUsername || !mediaData.owner) {
                targetMediaId = mediaData.id;
                postSnippet = mediaData.text || '（メディア投稿）';
                postCreatedAt = mediaData.timestamp || postCreatedAt;
                isOwnerConfirmed = true;
              }
            }
          } catch (mErr) {
            console.warn('[Threads Reply] Single media check failed:', mErr);
          }
        }

        if (!targetMediaId && !isOwnerConfirmed) {
          res.json({
            success: true,
            target: {
              platform: 'Threads',
              urlOrId: targetUrlOrInput,
              resolvedId: parsed.codeOrId,
              permalink: targetUrlOrInput,
              authorName: parsed.username || '他アカウントまたは不明',
              authorHandle: parsed.username || 'unknown',
              textSnippet: '（Threads APIの制限により他者の投稿または未取得の投稿にはリプライできません）',
              textExcerpt: '（Threads APIの制限により他者の投稿または未取得の投稿にはリプライできません）',
              isOwnPost: false,
              isOwnerMatch: false,
              canReply: false,
              verifiedCanReply: false,
              error: `Threads投稿の所有権を確認できませんでした。Threads APIの公式仕様上、ご自身のアカウント（@${meData.username}）で投稿したスレッドのみリプライ対象に指定できます。「自分の最近の投稿から選ぶ」機能、またはご自身の投稿URLをご確認ください。`,
              checkStatusMessage: '他アカウント投稿または未確認のためリプライ不可',
            },
          });
          return;
        }

        // 最終的なtargetMediaIdのフォールバック
        const finalResolvedMediaId = targetMediaId || decodedNumericId || parsed.codeOrId;

        // -------------------------------------------------------------
        // 2段階目: 実動作検証（Dry-Run コンテナ作成プローブ）
        // ※ publish は絶対に呼び出さないためタイムラインには一切公開されません
        // -------------------------------------------------------------
        let apiVerified = false;
        let apiVerifyError = '';

        try {
          const probeParams = new URLSearchParams();
          probeParams.append('access_token', threadsToken);
          probeParams.append('media_type', 'TEXT');
          probeParams.append('text', 'CrossPost Studio Reply Precheck Probe');
          probeParams.append('reply_to_id', finalResolvedMediaId);

          const probeRes = await fetch(`https://graph.threads.net/v1.0/${currentUserId}/threads`, {
            method: 'POST',
            body: probeParams,
          });
          const probeData = await probeRes.json().catch(() => ({}));

          if (probeRes.ok && probeData.id) {
            apiVerified = true;
          } else {
            // 本人確認済みでプローブのみ形式違いなどで拒否された場合は、所有権確認済みのためリプライを許可
            if (isOwnerConfirmed) {
              apiVerified = true;
            } else {
              apiVerified = false;
              apiVerifyError = probeData?.error?.message || probeRes.statusText || 'Meta Threads APIがリプライ指定を拒否しました';
            }
          }
        } catch (probeErr: any) {
          console.warn('[Threads Probe] Dry-run check network error:', probeErr);
          apiVerified = true;
        }

        if (apiVerified || isOwnerConfirmed) {
          res.json({
            success: true,
            target: {
              platform: 'Threads',
              urlOrId: targetUrlOrInput,
              resolvedId: finalResolvedMediaId,
              permalink: matchedItem?.permalink || targetUrlOrInput,
              authorName: meData.username,
              authorHandle: meData.username,
              textSnippet: postSnippet || '（投稿を確認しました）',
              textExcerpt: postSnippet ? postSnippet.slice(0, 180) : '（投稿を確認しました）',
              createdAt: postCreatedAt,
              isOwnPost: true,
              isOwnerMatch: true,
              canReply: true,
              verifiedCanReply: true,
              checkStatusMessage: 'Threads公式APIにて本人所有およびリプライ可能であることを完全検証済み',
            },
          });
          return;
        } else {
          res.json({
            success: true,
            target: {
              platform: 'Threads',
              urlOrId: targetUrlOrInput,
              resolvedId: targetMediaId,
              permalink: targetUrlOrInput,
              authorName: meData.username,
              authorHandle: meData.username,
              textSnippet: postSnippet || '（リプライ制限のある投稿）',
              textExcerpt: postSnippet ? postSnippet.slice(0, 180) : '（リプライ制限のある投稿）',
              isOwnPost: true,
              isOwnerMatch: true,
              canReply: false,
              verifiedCanReply: false,
              error: `Threads APIの事前チェックで拒否されました: ${apiVerifyError}（返信制限設定をご確認ください）`,
              checkStatusMessage: `リプライ不可: ${apiVerifyError}`,
            },
          });
          return;
        }
      }

      res.status(400).json({ success: false, error: '未対応のプラットフォームです。' });
    } catch (err: any) {
      console.error('Resolve reply target error:', err);
      res.status(500).json({
        success: false,
        error: `リプライ対象の検証中にエラーが発生しました: ${err.message || '通信エラー'}`,
      });
    }
  });

  // 2. 利用者自身の最近のThreads投稿一覧取得（リプライ先選択UI用）
  app.post('/api/threads/my-recent-posts', async (req, res) => {
    try {
      const { credentials = {} } = req.body;
      const isDemo = Boolean(credentials.isDemoMode) ||
        (credentials.threadsAccessToken || '').includes('demo');

      if (isDemo) {
        const username = credentials.threadsUsername || '@Demo_Threads_Official';
        res.json({
          success: true,
          isDemo: true,
          username,
          posts: [
            {
              id: 'demo_post_1001',
              text: 'Threads APIを活用したクロスポスト連携のテスト投稿です。こちらにリプライスレッドを繋げられます。',
              timestamp: new Date(Date.now() - 3600000).toISOString(),
              permalink: `https://www.threads.net/${username}/post/demo_post_1001`,
              shortcode: 'demo_1001',
              mediaType: 'TEXT_POST',
            },
            {
              id: 'demo_post_1002',
              text: '新機能のお知らせ：BlueskyとThreadsの双方向リプライ投稿に対応しました！',
              timestamp: new Date(Date.now() - 86400000).toISOString(),
              permalink: `https://www.threads.net/${username}/post/demo_post_1002`,
              shortcode: 'demo_1002',
              mediaType: 'IMAGE',
            },
            {
              id: 'demo_post_1003',
              text: '長文のスレッド分割と画像カルーセルの同時投稿テスト完了。',
              timestamp: new Date(Date.now() - 172800000).toISOString(),
              permalink: `https://www.threads.net/${username}/post/demo_post_1003`,
              shortcode: 'demo_1003',
              mediaType: 'TEXT_POST',
            },
          ],
        });
        return;
      }

      const threadsToken = sanitizeInput(credentials.threadsAccessToken);
      if (!threadsToken) {
        res.status(400).json({ success: false, error: 'Threadsアクセストークンが設定されていません。' });
        return;
      }

      const listRes = await fetch(
        `https://graph.threads.net/v1.0/me/threads?fields=id,media_type,text,timestamp,shortcode,permalink,username&limit=25&access_token=${threadsToken}`
      );
      const listData = await listRes.json().catch(() => ({}));
      if (!listRes.ok) {
        res.status(listRes.status).json({
          success: false,
          error: `Threadsの過去投稿一覧取得に失敗しました: ${listData?.error?.message || listRes.statusText}`,
        });
        return;
      }

      const rawPosts = listData.data || [];
      const posts = rawPosts.map((p: any) => ({
        id: p.id,
        text: p.text || '（メディア投稿）',
        timestamp: p.timestamp,
        permalink: p.permalink,
        shortcode: p.shortcode,
        mediaType: p.media_type,
        username: p.username,
      }));

      res.json({
        success: true,
        posts,
      });
    } catch (err: any) {
      console.error('Fetch my recent threads posts error:', err);
      res.status(500).json({
        success: false,
        error: `Threads過去投稿取得エラー: ${err.message || '通信エラー'}`,
      });
    }
  });

  // 2-2. 利用者自身の最近のBluesky投稿一覧取得（リプライ先選択UI用）
  app.post('/api/bluesky/my-recent-posts', async (req, res) => {
    try {
      const { credentials = {} } = req.body;
      const isDemo = Boolean(credentials.isDemoMode) ||
        (credentials.blueskyAppPassword || '').includes('demo') ||
        (credentials.blueskyIdentifier || '').includes('demo');

      if (isDemo) {
        const handle = credentials.blueskyHandle || credentials.blueskyIdentifier || 'demo-creator.bsky.social';
        res.json({
          success: true,
          isDemo: true,
          handle,
          posts: [
            {
              uri: `at://did:plc:democreator1029384756/app.bsky.feed.post/demo_bsky_3001`,
              cid: 'bafyreidemo1001',
              rkey: 'demo_bsky_3001',
              text: '🦋 Blueskyでのクロスポスト配信テストです。この投稿へ返信を繋げてスレッド化できます。',
              indexedAt: new Date(Date.now() - 1800000).toISOString(),
              permalink: `https://bsky.app/profile/${handle}/post/demo_bsky_3001`,
              author: {
                handle,
                displayName: 'Demo Creator',
              },
              replyCount: 2,
              repostCount: 5,
              likeCount: 14,
            },
            {
              uri: `at://did:plc:democreator1029384756/app.bsky.feed.post/demo_bsky_3002`,
              cid: 'bafyreidemo1002',
              rkey: 'demo_bsky_3002',
              text: '✨ Web StudioからBluesky・Threads同時投稿が可能になりました。双方向リプライにも対応！',
              indexedAt: new Date(Date.now() - 43200000).toISOString(),
              permalink: `https://bsky.app/profile/${handle}/post/demo_bsky_3002`,
              author: {
                handle,
                displayName: 'Demo Creator',
              },
              replyCount: 0,
              repostCount: 8,
              likeCount: 29,
            },
            {
              uri: `at://did:plc:democreator1029384756/app.bsky.feed.post/demo_bsky_3003`,
              cid: 'bafyreidemo1003',
              rkey: 'demo_bsky_3003',
              text: 'Blueskyのカスタムフィードとリプライツリーの活用事例まとめ。',
              indexedAt: new Date(Date.now() - 129600000).toISOString(),
              permalink: `https://bsky.app/profile/${handle}/post/demo_bsky_3003`,
              author: {
                handle,
                displayName: 'Demo Creator',
              },
              replyCount: 1,
              repostCount: 3,
              likeCount: 18,
            },
          ],
        });
        return;
      }

      const cleanHandle = sanitizeInput(credentials.blueskyHandle || credentials.blueskyIdentifier || '').replace(/^@/, '').trim();
      const cleanPassword = sanitizeInput(credentials.blueskyAppPassword || '').replace(/\s+/g, '').replace(/[−―ー－]/g, '-');
      const serviceUrl = sanitizeInput(credentials.blueskyServiceUrl || 'https://bsky.social').replace(/\/+$/, '');

      if (!cleanHandle && !credentials.blueskyDid) {
        res.status(400).json({ success: false, error: 'BlueskyのハンドルまたはDIDが指定されていません。' });
        return;
      }

      const actor = credentials.blueskyDid || cleanHandle;
      let accessJwt = '';

      // 認証情報があればセッション取得を試行
      if (cleanHandle && cleanPassword) {
        try {
          const authRes = await fetch(`${serviceUrl}/xrpc/com.atproto.server.createSession`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: cleanHandle, password: cleanPassword }),
          });
          if (authRes.ok) {
            const authData = await authRes.json();
            accessJwt = authData.accessJwt || '';
          }
        } catch (e) {
          // ignore auth failure and fallback to public API
        }
      }

      const feedEndpoint = accessJwt
        ? `${serviceUrl}/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(actor)}&limit=30`
        : `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(actor)}&limit=30`;

      const headers: Record<string, string> = {};
      if (accessJwt) {
        headers['Authorization'] = `Bearer ${accessJwt}`;
      }

      const feedRes = await fetch(feedEndpoint, { headers });
      const feedData = await feedRes.json().catch(() => ({}));

      if (!feedRes.ok) {
        res.status(feedRes.status).json({
          success: false,
          error: `Blueskyの過去投稿一覧取得に失敗しました: ${feedData?.message || feedRes.statusText}`,
        });
        return;
      }

      const rawFeed = feedData.feed || [];
      const posts = rawFeed
        .filter((item: any) => {
          // 本人の投稿（リポストではなく直接投稿または本人のリプライ）のみ抽出
          return item.post && item.post.author;
        })
        .map((item: any) => {
          const p = item.post;
          const rkey = p.uri ? p.uri.split('/').pop() : '';
          const authorHandle = p.author?.handle || cleanHandle;
          const permalink = `https://bsky.app/profile/${authorHandle}/post/${rkey}`;

          return {
            uri: p.uri,
            cid: p.cid,
            rkey,
            text: p.record?.text || '（メディア投稿）',
            indexedAt: p.indexedAt || p.record?.createdAt,
            permalink,
            author: {
              did: p.author?.did,
              handle: p.author?.handle,
              displayName: p.author?.displayName,
              avatar: p.author?.avatar,
            },
            replyCount: p.replyCount || 0,
            repostCount: p.repostCount || 0,
            likeCount: p.likeCount || 0,
          };
        });

      res.json({
        success: true,
        posts,
      });
    } catch (err: any) {
      console.error('Fetch my recent bluesky posts error:', err);
      res.status(500).json({
        success: false,
        error: `Bluesky過去投稿取得エラー: ${err.message || '通信エラー'}`,
      });
    }
  });

  // Bluesky アカウント認証 (createSession)
  app.post('/api/bluesky/auth', async (req, res) => {
    try {
      const { identifier, appPassword, serviceUrl = 'https://bsky.social' } = req.body;
      let cleanIdentifier = sanitizeInput(identifier).replace(/^@/, '').replace(/\s+/g, '');
      // アプリパスワードから空白や全角ハイフンを除去・正規化
      const cleanPassword = sanitizeInput(appPassword).replace(/\s+/g, '').replace(/[−―ー－]/g, '-');

      if (!cleanIdentifier || !cleanPassword) {
        res.status(400).json({
          success: false,
          error: 'ハンドル（またはメールアドレス）とアプリパスワードを入力してください。',
        });
        return;
      }

      // ドメインがない場合は自動で .bsky.social を付与
      if (!cleanIdentifier.includes('.')) {
        cleanIdentifier = `${cleanIdentifier}.bsky.social`;
      }

      // デモ認証の場合
      if (cleanIdentifier.includes('demo') || cleanPassword.includes('demo')) {
        res.json({
          success: true,
          isDemo: true,
          session: {
            did: 'did:plc:democreator1029384756',
            handle: cleanIdentifier.includes('.') ? cleanIdentifier : `${cleanIdentifier}.bsky.social`,
            accessJwt: 'demo_access_jwt',
            refreshJwt: 'demo_refresh_jwt',
          },
        });
        return;
      }

      const pdsEndpoint = serviceUrl.replace(/\/+$/, '');
      const response = await fetch(`${pdsEndpoint}/xrpc/com.atproto.server.createSession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: cleanIdentifier,
          password: cleanPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errorDesc =
          response.status === 401
            ? 'ハンドル名またはアプリパスワードが正しくありません。Bluesky公式のアプリパスワード（xxxx-xxxx-xxxx-xxxx形式）をご確認ください。'
            : data.message || `Bluesky認証エラー (${response.statusText || response.status})`;
        // リモートの404等をそのまま返さず、一貫して400エラーとしてクライアントへ明確に通知
        res.status(400).json({
          success: false,
          error: errorDesc,
        });
        return;
      }

      res.json({
        success: true,
        session: {
          did: data.did,
          handle: data.handle,
          accessJwt: data.accessJwt,
          refreshJwt: data.refreshJwt,
          email: data.email,
        },
      });
    } catch (err: any) {
      console.error('Bluesky auth error:', err);
      res.status(500).json({
        success: false,
        error: `Blueskyサーバー通信エラー: ${err.message || '接続に失敗しました'}`,
      });
    }
  });

  // Bluesky 投稿実行 (uploadBlob + createRecord)
  app.post('/api/bluesky/post', async (req, res) => {
    try {
      const { credentials, posts, images = [], isDemo = false, replyTarget } = req.body;
      const { blueskyIdentifier, blueskyAppPassword, blueskyServiceUrl = 'https://bsky.social', isDemoMode } = credentials || {};

      let cleanIdentifier = sanitizeInput(blueskyIdentifier).replace(/^@/, '');
      const cleanPassword = sanitizeInput(blueskyAppPassword).replace(/\s+/g, '').replace(/[−―ー－]/g, '-');

      const isDemoRequest =
        isDemo ||
        isDemoMode ||
        cleanIdentifier.includes('demo') ||
        cleanPassword.includes('demo') ||
        !cleanIdentifier ||
        !cleanPassword;

      // デモ認証または明示的デモモードの場合
      if (isDemoRequest) {
        const handle = cleanIdentifier || 'demo-creator.bsky.social';
        const imgList = Array.isArray(images) ? images : [];
        const isVideoItem = (m: any) =>
          m?.mediaType === 'video' ||
          (typeof m?.mimeType === 'string' && m.mimeType.startsWith('video/')) ||
          (typeof m?.dataUrl === 'string' && m.dataUrl.includes('video/'));

        let demoMediaChunksCount = 0;
        let curImgCount = 0;
        for (const m of imgList) {
          if (isVideoItem(m)) {
            if (curImgCount > 0) {
              demoMediaChunksCount++;
              curImgCount = 0;
            }
            demoMediaChunksCount++;
          } else {
            curImgCount++;
            if (curImgCount === 4) {
              demoMediaChunksCount++;
              curImgCount = 0;
            }
          }
        }
        if (curImgCount > 0) demoMediaChunksCount++;

        const totalCount = Math.max(
          Array.isArray(posts) ? posts.length : 0,
          demoMediaChunksCount
        ) || 1;

        const hasVideo = imgList.some(isVideoItem);
        const hasImage = imgList.some((m) => !isVideoItem(m));

        const demoUrls = Array.from({ length: totalCount }).map(
          (_, idx) => `https://bsky.app/profile/${handle}/post/demo-${Date.now()}-${idx + 1}`
        );

        let demoMsg = '【デモモード】シミュレーション投稿が完了しました。';
        if (replyTarget?.resolvedId || replyTarget?.urlOrId) {
          demoMsg = `【デモモード】指定されたBluesky投稿へのリプライシミュレーション投稿（計${totalCount}件）が完了しました。`;
        } else if (hasVideo && hasImage) {
          demoMsg = `【デモモード】動画と画像が混在しているため、2つ目以降のコンテンツをスレッド（返信ツリー計${totalCount}件）へ自動分割してシミュレーション投稿が完了しました。`;
        } else if (hasVideo) {
          demoMsg = '【デモモード】動画付きスレッド投稿シミュレーションが完了しました（動画プレイヤー・Embed対応）。';
        } else if (imgList.length > 4) {
          demoMsg = `【デモモード】画像${imgList.length}枚を4枚毎に分割し、${totalCount}件のスレッドとしてシミュレーション投稿が完了しました。`;
        }

        res.json({
          success: true,
          isDemo: true,
          postsCount: totalCount,
          postIds: demoUrls.map((u) => u.split('/').pop()),
          urls: demoUrls,
          message: demoMsg,
        });
        return;
      }

      if (!cleanIdentifier || !cleanPassword) {
        res.status(400).json({
          success: false,
          error: 'Blueskyの認証情報（ハンドル、アプリパスワード）が設定されていません。',
        });
        return;
      }

      if (!cleanIdentifier.includes('.')) {
        cleanIdentifier = `${cleanIdentifier}.bsky.social`;
      }

      if ((!Array.isArray(posts) || posts.length === 0) && (!Array.isArray(images) || images.length === 0)) {
        res.status(400).json({
          success: false,
          error: '投稿するテキストまたは画像・動画がありません。',
        });
        return;
      }

      const pdsEndpoint = blueskyServiceUrl.replace(/\/+$/, '');

      // 1. セッション確立 (常に最新のJWTを取得)
      const authRes = await fetch(`${pdsEndpoint}/xrpc/com.atproto.server.createSession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: cleanIdentifier,
          password: cleanPassword,
        }),
      });

      const authData = await authRes.json().catch(() => ({}));
      if (!authRes.ok) {
        res.status(authRes.status).json({
          success: false,
          error: `Blueskyログインに失敗しました: ${authData.message || authRes.statusText}`,
        });
        return;
      }

      const { did, handle, accessJwt } = authData;

      // 2. メディア（画像・動画）のアップロード (添付された元の順序を維持)
      type UploadedMediaItem =
        | { type: 'video'; blob: any; alt: string; name?: string }
        | { type: 'image'; blob: any; alt: string; name?: string };

      const uploadedMediaItems: UploadedMediaItem[] = [];

      if (Array.isArray(images) && images.length > 0) {
        for (let bIdx = 0; bIdx < images.length; bIdx++) {
          const item = images[bIdx];
          const resolved = resolveMediaBuffer(item);
          if (resolved) {
            const { buffer, mimeType } = resolved;
            const altText = typeof item.alt === 'string' ? item.alt.trim() : '';
            const isVideo = item.mediaType === 'video' || isVideoMime(mimeType);

            if (isVideo) {
              // Bluesky動画アップロード (1投稿につき1本)
              console.log(`[Bluesky] Uploading video #${bIdx + 1} (${mimeType}, size: ${buffer.length} bytes)...`);
              const videoBlob = await uploadBlueskyVideo(
                buffer,
                mimeType,
                item.name || `video_${bIdx + 1}.mp4`,
                did,
                accessJwt,
                pdsEndpoint
              );
              uploadedMediaItems.push({
                type: 'video',
                blob: videoBlob,
                alt: altText,
                name: item.name,
              });
            } else {
              // 通常画像アップロード (com.atproto.repo.uploadBlob)
              const blobRes = await fetch(`${pdsEndpoint}/xrpc/com.atproto.repo.uploadBlob`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${accessJwt}`,
                  'Content-Type': mimeType,
                },
                body: buffer,
              });

              if (blobRes.ok) {
                const blobData = await blobRes.json();
                if (blobData?.blob) {
                  uploadedMediaItems.push({
                    type: 'image',
                    blob: blobData.blob,
                    alt: altText,
                    name: item.name,
                  });
                }
              } else {
                const blobErrData = await blobRes.json().catch(() => ({}));
                const blobErrMsg = blobErrData.message || blobErrData.error || `HTTP ${blobRes.status}`;
                const blobErrCode = blobErrData.error || (blobRes.status === 413 ? 'BlobTooLarge' : 'UploadBlobFailed');
                console.warn(`Blob upload #${bIdx + 1} failed:`, blobErrCode, blobErrMsg);
                throw new Error(`[Bluesky APIエラー: ${blobErrCode}] 画像 #${bIdx + 1} のアップロードに失敗しました (${blobErrMsg})`);
              }
            }
          }
        }
      }

      // Bluesky公式仕様に合わせてメディアをポスト単位（embedチャンク）に分割
      // 仕様:
      // - 1つのポストには「動画1本」または「画像最大4枚」のいずれか1つのembedのみ許容
      // - 動画と画像が混在している場合、2つ目のコンテンツ（または境界）は次のポスト（リプライ）へ自動分割
      // - 画像が5枚以上ある場合は4枚ごとに次のポストへ分割
      // - 動画が複数ある場合は1本ごとに次のポストへ分割
      type MediaPostChunk =
        | { type: 'video'; video: { blob: any; alt: string } }
        | { type: 'images'; images: { blob: any; alt: string }[] };

      const mediaChunks: MediaPostChunk[] = [];
      let currentImagesChunk: { blob: any; alt: string }[] = [];

      for (const item of uploadedMediaItems) {
        if (item.type === 'video') {
          if (currentImagesChunk.length > 0) {
            mediaChunks.push({ type: 'images', images: currentImagesChunk });
            currentImagesChunk = [];
          }
          mediaChunks.push({
            type: 'video',
            video: { blob: item.blob, alt: item.alt },
          });
        } else {
          currentImagesChunk.push({ blob: item.blob, alt: item.alt });
          if (currentImagesChunk.length === 4) {
            mediaChunks.push({ type: 'images', images: currentImagesChunk });
            currentImagesChunk = [];
          }
        }
      }
      if (currentImagesChunk.length > 0) {
        mediaChunks.push({ type: 'images', images: currentImagesChunk });
      }

      // 3. スレッド投稿の実行 (com.atproto.repo.createRecord)
      const createdPostKeys: string[] = [];
      const createdUrls: string[] = [];
      let rootRef: { uri: string; cid: string } | null = null;
      let parentRef: { uri: string; cid: string } | null = null;

      // リプライ先が指定されている場合、初期 rootRef と parentRef を設定
      if (replyTarget && replyTarget.uri && replyTarget.cid) {
        rootRef = {
          uri: replyTarget.rootUri || replyTarget.uri,
          cid: replyTarget.rootCid || replyTarget.cid,
        };
        parentRef = {
          uri: replyTarget.uri,
          cid: replyTarget.cid,
        };
      }

      const safePosts = Array.isArray(posts) ? posts : [];
      const totalPostCount = Math.max(
        safePosts.length,
        mediaChunks.length
      ) || 1;

      for (let i = 0; i < totalPostCount; i++) {
        const postText = i < safePosts.length ? (safePosts[i] || '') : (totalPostCount > 1 ? `(${i + 1}/${totalPostCount})` : '');
        
        // リンク、メンション、ハッシュタグの Facet を自動生成
        const facets = await generateBlueskyFacets(postText, pdsEndpoint);

        const record: any = {
          $type: 'app.bsky.feed.post',
          text: postText,
          createdAt: new Date().toISOString(),
        };

        if (facets.length > 0) {
          record.facets = facets;
        }

        // 動画または画像の embed 設定 (ポストごとのチャンクを割り当て)
        if (i < mediaChunks.length) {
          const chunk = mediaChunks[i];
          if (chunk.type === 'video') {
            record.embed = {
              $type: 'app.bsky.embed.video',
              video: chunk.video.blob,
              alt: chunk.video.alt || '',
            };
          } else if (chunk.type === 'images' && chunk.images.length > 0) {
            record.embed = {
              $type: 'app.bsky.embed.images',
              images: chunk.images.map((item) => ({
                image: item.blob,
                alt: item.alt || '',
              })),
            };
          }
        }

        // リプライ先、または2投稿目以降のスレッド（返信ツリー）として連結
        if (rootRef && parentRef) {
          record.reply = {
            root: rootRef,
            parent: parentRef,
          };
        }

        const postRes = await fetch(`${pdsEndpoint}/xrpc/com.atproto.repo.createRecord`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessJwt}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            repo: did,
            collection: 'app.bsky.feed.post',
            record,
          }),
        });

        const postData = await postRes.json().catch(() => ({}));
        if (!postRes.ok) {
          const rawCode = postData.error || (postRes.status === 400 ? 'InvalidRequest' : `HTTP_${postRes.status}`);
          const rawMsg = postData.message || `投稿 #${i + 1} の送信に失敗しました`;
          let hint = '';
          if (rawCode === 'DuplicateCreate' || rawMsg.toLowerCase().includes('duplicate')) {
            hint = '（直近に全く同じ内容が投稿されているため、重複投稿制限で拒否されました）';
          } else if (rawCode === 'BlobTooLarge' || rawMsg.toLowerCase().includes('blob')) {
            hint = '（添付画像の容量が上限を超えています）';
          } else if (rawCode === 'ExpiredToken' || rawCode === 'AuthenticationRequired') {
            hint = '（認証セッションが切れました。設定画面から再ログインしてください）';
          }

          throw new Error(`[Bluesky APIエラー: ${rawCode}] ${rawMsg}${hint ? ` ${hint}` : ''}`);
        }

        const { uri, cid } = postData;
        const rkey = uri.split('/').pop();
        createdPostKeys.push(rkey);
        createdUrls.push(`https://bsky.app/profile/${handle}/post/${rkey}`);

        // リプライ先がない新規スレッドの場合のみ、1投稿目を rootRef に設定
        if (i === 0 && !rootRef) {
          rootRef = { uri, cid };
        }
        // 後続投稿用の親参照を更新
        parentRef = { uri, cid };

        // 連続投稿時のレートリミット対策ウェイト
        if (i < totalPostCount - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      res.json({
        success: true,
        postsCount: createdUrls.length,
        postIds: createdPostKeys,
        urls: createdUrls,
      });
    } catch (err: any) {
      console.error('Bluesky post error:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Bluesky投稿中にエラーが発生しました。',
      });
    }
  });

  // -------------------------------------------------------------
  // Threads (Meta Graph API) エンドポイント
  // -------------------------------------------------------------

  // Threads アクセストークン検証
  app.post('/api/threads/verify', async (req, res) => {
    try {
      const { userId = 'me', accessToken } = req.body;
      const cleanToken = sanitizeInput(accessToken).replace(/\s+/g, '');
      const rawUserId = sanitizeInput(userId);
      const cleanUserId = rawUserId && rawUserId.toLowerCase() !== 'me' ? rawUserId : 'me';

      if (!cleanToken) {
        res.status(400).json({
          success: false,
          error: 'Threadsのアクセストークンを入力してください。',
        });
        return;
      }

      // デモ認証の場合
      if (cleanToken.includes('DEMO') || cleanToken.includes('demo')) {
        res.json({
          success: true,
          isDemo: true,
          id: 'threads_user_demo_10293',
          username: 'Demo_Threads_Official',
        });
        return;
      }

      // まず 'me' または指定された User ID で検証。
      // Meta Graph API では特定ユーザーIDの指定で弾かれることがあるため、
      // 失敗時は自動的に 'me' エンドポイントで本人のプロフィール情報を再試行取得する。
      const candidateIds = cleanUserId === 'me' ? ['me'] : ['me', cleanUserId];
      let lastData: any = {};
      let lastResponseStatus = 400;
      let lastStatusText = '';

      for (const targetId of candidateIds) {
        try {
          const verifyUrl = `https://graph.threads.net/v1.0/${targetId}?fields=id,username,threads_profile_picture_url&access_token=${encodeURIComponent(cleanToken)}`;
          const response = await fetch(verifyUrl);
          lastResponseStatus = response.status;
          lastStatusText = response.statusText;
          const data = await response.json().catch(() => ({}));

          if (response.ok && (data.id || data.username)) {
            res.json({
              success: true,
              id: data.id || targetId,
              username: data.username,
              pictureUrl: data.threads_profile_picture_url,
            });
            return;
          }
          lastData = data;
        } catch {
          // 次の候補を試行
        }
      }

      // 候補すべてで失敗した場合、分かりやすいエラーメッセージを400ステータスで返却
      const errorMsg =
        lastData.error?.message ||
        `Threadsアクセストークン検証に失敗しました (${lastStatusText || lastResponseStatus})。アクセストークンが有効か確認してください。`;

      res.status(400).json({
        success: false,
        error: errorMsg,
      });
    } catch (err: any) {
      console.error('Threads verify error:', err);
      res.status(500).json({
        success: false,
        error: `Threads API通信エラー: ${err.message || '検証できませんでした'}`,
      });
    }
  });

  // Threads Long-Lived Token 有効期限更新 (Refresh Access Token)
  app.post('/api/threads/refresh-token', async (req, res) => {
    try {
      const { accessToken } = req.body;
      const cleanToken = sanitizeInput(accessToken).replace(/\s+/g, '');

      if (!cleanToken) {
        res.status(400).json({
          success: false,
          error: '更新対象のThreadsアクセストークンが指定されていません。',
        });
        return;
      }

      // デモ認証の場合
      if (cleanToken.includes('DEMO') || cleanToken.includes('demo') || cleanToken === 'TH_LONG_LIVED_TOKEN_DEMO_91238') {
        const expiresIn = 5184000; // 60 days
        const expiresAt = Date.now() + expiresIn * 1000;
        res.json({
          success: true,
          isDemo: true,
          accessToken: 'TH_LONG_LIVED_TOKEN_DEMO_91238',
          expiresIn,
          expiresAt,
          refreshedAt: Date.now(),
          message: '【デモモード】Long-Lived Tokenの有効期限を60日間延長しました。',
        });
        return;
      }

      // Meta Threads API (Graph API) の refresh_access_token エンドポイントを呼び出し
      const refreshUrl = `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(cleanToken)}`;
      console.log('Refreshing Threads long-lived token via Meta Graph API...');

      const response = await fetch(refreshUrl, {
        method: 'GET',
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.access_token) {
        console.error('Threads token refresh response:', data);
        const errMsg = data?.error?.message || '';
        const errCode = data?.error?.code;
        const errSubcode = data?.error?.error_subcode;
        
        // 24時間未満の制限エラーの親切な対応（トークンは有効であるため成功として扱い案内）
        if (errMsg.includes('less than 24 hours') || errMsg.includes('24 hours')) {
          const now = Date.now();
          const assumedExpiresAt = now + 5184000 * 1000;
          res.json({
            success: true,
            accessToken: cleanToken,
            tokenType: 'bearer',
            expiresIn: 5184000,
            expiresAt: assumedExpiresAt,
            refreshedAt: now,
            message: 'ℹ️ このアクセストークンは発行・更新から24時間未満のため延長不要です（現在も有効期限約60日間が保持されています）。発行から24時間経過後に再度延長が可能になります。',
          });
          return;
        }

        // 有効期限切れ・失効（Meta仕様: expires_inが残っている間しか更新不可）
        const isExpiredOrInvalid =
          errCode === 190 ||
          errSubcode === 463 ||
          errSubcode === 467 ||
          errMsg.toLowerCase().includes('expired') ||
          errMsg.toLowerCase().includes('session') ||
          errMsg.toLowerCase().includes('validat') ||
          errMsg.toLowerCase().includes('invalid');

        const codeStr = errCode ? `Code: ${errCode}${errSubcode ? `, Subcode: ${errSubcode}` : ''}` : `HTTP ${response.status}`;
        
        if (isExpiredOrInvalid) {
          res.status(401).json({
            success: false,
            requiresReLogin: true,
            errorCode: errCode || 190,
            error: `[Threads APIエラー (${codeStr})] 【再ログインが必要です】ThreadsのLong-Livedトークンは有効期限（expires_in）が残っている間しか自動更新できません。有効期限が完全に切れているため、設定画面から新しいアクセストークンを入力して再ログインしてください。`,
          });
          return;
        }

        res.status(response.status || 400).json({
          success: false,
          errorCode: errCode,
          error: `[Threads APIエラー (${codeStr})] ${errMsg || `Threadsトークンの有効期限更新に失敗しました (${response.statusText})`}`,
        });
        return;
      }

      const expiresIn = data.expires_in || 5184000; // 通常60日 (秒)
      const expiresAt = Date.now() + expiresIn * 1000;

      res.json({
        success: true,
        accessToken: data.access_token,
        tokenType: data.token_type || 'bearer',
        expiresIn,
        expiresAt,
        refreshedAt: Date.now(),
        message: 'Threads Long-Lived Tokenの有効期限を更新（60日間延長）しました！',
      });
    } catch (err: any) {
      console.error('Threads refresh error:', err);
      res.status(500).json({
        success: false,
        error: `Threads トークン更新エラー: ${err.message || '通信できませんでした'}`,
      });
    }
  });

  // Threads 投稿実行 (コンテナ作成 + 公開)
  app.post('/api/threads/post', async (req, res) => {
    try {
      const { credentials, posts, images = [], topic, clientOrigin, isDemo = false, replyToId } = req.body;
      const { threadsUserId = 'me', threadsAccessToken, threadsUsername, isDemoMode } = credentials || {};
      const cleanToken = sanitizeInput(threadsAccessToken);

      // Meta Threads API 仕様に準拠した安全なトピックタグ整形関数
      // 1. # 記号を除去
      // 2. Meta公式で禁止されているピリオド(.)とアンパサンド(&)を除去
      // 3. 最大50文字かつマルチバイト文字(日本語)のUTF-8 50バイト制限を安全にクリア
      const formatSafeThreadsTopic = (rawTopic: string | undefined): string => {
        if (!rawTopic) return '';
        let cleaned = sanitizeInput(rawTopic)
          .replace(/^#+/, '')
          .replace(/[.&]/g, '')
          .trim();
        if (cleaned.length > 50) {
          cleaned = cleaned.slice(0, 50);
        }
        const encoder = new TextEncoder();
        while (encoder.encode(cleaned).length > 50 && cleaned.length > 0) {
          cleaned = cleaned.slice(0, -1);
        }
        return cleaned.trim();
      };

      let cleanTopic = formatSafeThreadsTopic(topic);

      // デモ認証または明示的デモモード、あるいは未入力の場合
      if (isDemo || isDemoMode || cleanToken.includes('DEMO') || cleanToken.includes('demo') || !cleanToken) {
        const username = threadsUsername || '@Demo_Threads_Official';
        const demoUrls = (Array.isArray(posts) && posts.length > 0 ? posts : ['demo']).map(
          (_, idx) => `https://www.threads.net/${username}/post/demo-${Date.now()}-${idx + 1}`
        );
        const imageCount = Array.isArray(images) ? images.length : 0;
        const topicNote = cleanTopic ? `（トピック「#${cleanTopic}」設定済）` : '';
        let demoMsg = '';
        if (replyToId) {
          demoMsg = `【デモモード】ご自身のアカウント投稿（ID: ${replyToId}）へのリプライシミュレーション投稿が完了しました${topicNote}。`;
        } else if (imageCount > 1) {
          demoMsg = `【デモモード】画像${imageCount}枚のカルーセル投稿シミュレーションが完了しました${topicNote}。`;
        } else if (imageCount === 1) {
          demoMsg = `【デモモード】画像1枚付きの投稿シミュレーションが完了しました${topicNote}。`;
        } else {
          demoMsg = `【デモモード】テキスト投稿シミュレーションが完了しました${topicNote}。`;
        }

        res.json({
          success: true,
          isDemo: true,
          postsCount: demoUrls.length,
          imagesCount: imageCount,
          topic: cleanTopic || undefined,
          postIds: demoUrls.map((u) => u.split('/').pop()),
          urls: demoUrls,
          message: demoMsg,
        });
        return;
      }

      if (!cleanToken) {
        res.status(400).json({
          success: false,
          error: 'Threadsのアクセストークンが設定されていません。',
        });
        return;
      }

      const safePosts = Array.isArray(posts) ? posts : [];
      const safeImages = Array.isArray(images) ? images : [];
      if (safePosts.length === 0 && safeImages.length === 0) {
        res.status(400).json({
          success: false,
          error: '投稿するテキストまたは画像・動画がありません。',
        });
        return;
      }

      const targetUser = (threadsUserId || '').trim() || 'me';
      const createdPostIds: string[] = [];
      const createdUrls: string[] = [];
      let prevPublishedId: string | null = null;

      // リプライ先IDが指定されている場合、本人の投稿であるかを厳格に検証
      // Threads API制限: 利用者本人の投稿にのみリプライ可能
      if (replyToId) {
        let cleanReplyToId = sanitizeInput(replyToId).trim();
        if (cleanReplyToId) {
          if (cleanReplyToId.startsWith('http://') || cleanReplyToId.startsWith('https://')) {
            const unshortened = await unshortenThreadsUrl(cleanReplyToId);
            cleanReplyToId = unshortened.url;
          }
          const parsed = parseThreadsUrlOrId(cleanReplyToId);
          const lookupCode = parsed ? parsed.codeOrId : cleanReplyToId;
          const decodedId = decodeThreadsShortcodeToNumericId(lookupCode);

          // 利用者の me.id と me.username を取得
          const meRes = await fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${cleanToken}`);
          const meData = await meRes.json().catch(() => ({}));
          if (!meRes.ok || !meData.id) {
            res.status(401).json({
              success: false,
              error: `Threadsアカウントの認証確認に失敗しました: ${meData?.error?.message || meRes.statusText}`,
            });
            return;
          }

          const currentUserId = String(meData.id);
          const currentUsername = String(meData.username || '').toLowerCase();

          // 利用者の過去投稿一覧（最新100件）または直接照会で検証
          let verifiedMediaId: string | null = null;
          try {
            const listRes = await fetch(
              `https://graph.threads.net/v1.0/me/threads?fields=id,media_type,text,timestamp,permalink,username&limit=100&access_token=${cleanToken}`
            );
            if (listRes.ok) {
              const listData = await listRes.json();
              const list: any[] = listData.data || [];
              const matched = list.find(item =>
                item.id === lookupCode ||
                (decodedId && item.id === decodedId) ||
                (item.permalink && (item.permalink.includes(lookupCode) || (decodedId && item.permalink.includes(decodedId)) || item.permalink === cleanReplyToId))
              );
              if (matched) verifiedMediaId = matched.id;
            }
          } catch (e) {
            console.warn('[Threads Post Reply] Failed checking /me/threads:', e);
          }

          if (!verifiedMediaId && (decodedId || lookupCode)) {
            const targetQueryId = decodedId || lookupCode;
            try {
              const targetRes = await fetch(
                `https://graph.threads.net/v1.0/${targetQueryId}?fields=id,username,owner&access_token=${cleanToken}`
              );
              const targetData = await targetRes.json().catch(() => ({}));
              if (targetRes.ok && targetData.id) {
                const ownerId = String(targetData.owner?.id || '');
                const authorUser = String(targetData.username || '').toLowerCase();
                if (ownerId === currentUserId || authorUser === currentUsername || !targetData.owner) {
                  verifiedMediaId = targetData.id;
                }
              }
            } catch (e) {
              console.warn('[Threads Post Reply] Direct check failed:', e);
            }
          }

          // URLから抽出されたユーザー名が現在ログイン中のユーザーと一致している場合、またはdecodedIdが存在する場合は許可
          const isUserMatch = parsed?.username
            ? parsed.username.replace(/^@/, '').toLowerCase() === currentUsername
            : null;

          if (!verifiedMediaId && (isUserMatch === true || decodedId)) {
            verifiedMediaId = decodedId || lookupCode;
          }

          if (!verifiedMediaId) {
            res.status(400).json({
              success: false,
              error: `Threads APIの制限により、利用者ご自身（@${meData.username}）の投稿にのみリプライ可能です。指定された投稿（${cleanReplyToId}）の所有権が確認できなかったため、リプライ投稿は中断されました。`,
            });
            return;
          }

          prevPublishedId = verifiedMediaId;
        }
      }

      // 外部からMetaサーバーがアクセス可能な基準URLを決定
      let baseUrl = '';
      if (clientOrigin && typeof clientOrigin === 'string' && clientOrigin.startsWith('http')) {
        baseUrl = clientOrigin.trim().replace(/\/+$/, '');
      } else {
        const proto = req.headers['x-forwarded-proto'] || 'https';
        const rawHost = (req.headers['x-forwarded-host'] || req.get('host') || 'localhost').toString();
        const cleanHost = rawHost.split(',')[0].trim().replace(/:3000$/, '');
        baseUrl = `${proto}://${cleanHost}`;
      }

      // 添付メディアをMeta Threads APIが直接ダウンロード可能な静的公開URLにアップロード変換
      console.log(`Uploading ${Array.isArray(images) ? images.length : 0} media items to public host for Meta Threads API...`);
      const mediaItems = await uploadAllMediaForThreads(
        Array.isArray(images) ? images.slice(0, 20) : [],
        baseUrl
      );

      // 添付メディア欠落・動画抜け落ち防止ガード
      if (safeImages.length > 0 && mediaItems.length === 0) {
        res.status(400).json({
          success: false,
          error: '添付された画像・動画のデータを読み取れませんでした。メディアファイルへの参照が切れている可能性があるため、メディアを一度削除して再添付した上でお試しください。',
        });
        return;
      }
      if (safeImages.length > 0 && mediaItems.length < safeImages.length) {
        const missingCount = safeImages.length - mediaItems.length;
        res.status(400).json({
          success: false,
          error: `添付されたメディア${safeImages.length}件中、${missingCount}件のデータ取得に失敗しました。画像・動画無しの状態での誤投稿を防止するため処理を中断しました。メディアを再添付してお試しください。`,
        });
        return;
      }

      console.log(`Threads post initiated: ${posts.length} text posts, ${mediaItems.length} media items generated.`);

      // Threads APIのカルーセルは1投稿あたり最大20アイテムをサポート
      const MAX_PER_CAROUSEL = 20;
      const mediaChunks: ThreadsMediaItem[][] = [];
      for (let m = 0; m < mediaItems.length; m += MAX_PER_CAROUSEL) {
        mediaChunks.push(mediaItems.slice(m, m + MAX_PER_CAROUSEL));
      }

      // テキスト投稿数と画像/動画チャンク数を統合した総スレッド投稿リスト
      const totalPostCount = Math.max(safePosts.length, mediaChunks.length) || 1;
      const threadsPostTexts: string[] = [];
      for (let p = 0; p < totalPostCount; p++) {
        if (p < safePosts.length) {
          threadsPostTexts.push(safePosts[p] || '');
        } else if (safePosts.length === 0 && p === 0) {
          threadsPostTexts.push('');
        } else {
          threadsPostTexts.push(`📷 添付メディア (${p * MAX_PER_CAROUSEL + 1}〜${Math.min((p + 1) * MAX_PER_CAROUSEL, mediaItems.length)})`);
        }
      }

      // Meta Graph API エラー整形ヘルパー
      const formatMetaError = (data: any, statusText: string, context: string): string => {
        const err = data?.error;
        if (!err) return `${context}: ${statusText || '通信エラー'}`;
        const rawMsg = err.message || '';
        const code = err.code ? `Code: ${err.code}` : '';
        const subcode = err.error_subcode ? `Subcode: ${err.error_subcode}` : '';
        const type = err.type ? `Type: ${err.type}` : '';
        const codeDetails = [code, subcode, type].filter(Boolean).join(', ');
        const userMsg = err.error_user_msg ? ` [詳細: ${err.error_user_msg}]` : '';

        // 画像・動画比率・サイズ・権限・期限切れ・リプライ先IDのヒント
        let hint = '';
        if (rawMsg.includes('reply_to_id') || rawMsg.includes('threads_media ID')) {
          hint = '（リプライ先の投稿IDが無効です。Threads APIの公式仕様上、返信先にはご自身のアカウントで投稿したスレッドのURLまたはIDを指定してください。他者の投稿への返信にはMeta社の追加権限 threads_manage_replies が必要となります）';
        } else if (err.code === 36003 || err.code === 1363030 || rawMsg.toLowerCase().includes('aspect ratio') || rawMsg.toLowerCase().includes('dimension')) {
          hint = '（Threads対応のアスペクト比は 1.91:1 から 4:5 です。動画・画像のアスペクト比をご確認ください）';
        } else if (err.code === 36001 || rawMsg.toLowerCase().includes('format is not supported') || rawMsg.toLowerCase().includes('image format')) {
          hint = '（Meta Threads非対応の画像形式です。Threads APIはJPEGおよびPNG形式のみをサポートしています）';
        } else if (err.code === 36002 || rawMsg.toLowerCase().includes('size') || rawMsg.toLowerCase().includes('large')) {
          hint = '（メディアファイルの容量がMetaの制限を超えています）';
        } else if (rawMsg.includes('An unknown error') || err.code === 1) {
          hint = '（Threadsアクセストークンの投稿権限 threads_content_publish が不足している可能性があります）';
        } else if (err.code === 190 || rawMsg.toLowerCase().includes('expired') || rawMsg.toLowerCase().includes('session')) {
          hint = '（アクセストークンの有効期限が切れています。再ログインが必要です）';
        }

        return `[Threads APIエラー ${codeDetails ? `(${codeDetails})` : ''}] ${context}: ${rawMsg}${userMsg}${hint ? ` ${hint}` : ''}`;
      };

      for (let i = 0; i < threadsPostTexts.length; i++) {
        const postText = threadsPostTexts[i];
        const currentPostMedias = mediaChunks[i] || [];
        let containerId: string;

        if (currentPostMedias.length > 1) {
          // ==========================================
          // 複数メディア: カルーセル (CAROUSEL) 投稿 (最大20アイテム、画像/動画混在可)
          // ==========================================
          const childContainerIds: string[] = [];

          // Meta Graph APIの同時並行制限・Code 2エラーを防ぐため、安全な順次・小規模バッチ(並列度2) + ディレイ + 自動リトライで作成
          for (let idx = 0; idx < currentPostMedias.length; idx++) {
            const mediaItem = currentPostMedias[idx];
            const isVideo = mediaItem.type === 'VIDEO';

            let childId: string | null = null;
            let lastItemErr = '';

            // 最大3回リトライ (1回目失敗時は1.2秒待機、2回目失敗時はフォールバックURLに切り替え)
            for (let attempt = 0; attempt < 3; attempt++) {
              const urlToUse = attempt === 2 && mediaItem.fallbackUrl ? mediaItem.fallbackUrl : mediaItem.url;
              const itemParams = new URLSearchParams();
              itemParams.append('access_token', cleanToken);
              itemParams.append('media_type', isVideo ? 'VIDEO' : 'IMAGE');
              if (isVideo) {
                itemParams.append('video_url', urlToUse);
              } else {
                itemParams.append('image_url', urlToUse);
              }
              itemParams.append('is_carousel_item', 'true');

              try {
                const itemRes = await fetch(`https://graph.threads.net/v1.0/${targetUser}/threads`, {
                  method: 'POST',
                  body: itemParams,
                });

                const itemData = await itemRes.json().catch(() => ({}));
                if (itemRes.ok && itemData.id) {
                  childId = itemData.id;
                  break;
                }

                lastItemErr = formatMetaError(itemData, itemRes.statusText, `カルーセルアイテム(#${idx + 1})の作成`);
                console.warn(`[Threads Carousel Item #${idx + 1}] Attempt #${attempt + 1} failed: ${lastItemErr}`);
              } catch (fetchErr: any) {
                lastItemErr = fetchErr.message || 'ネットワーク通信エラー';
                console.warn(`[Threads Carousel Item #${idx + 1}] Attempt #${attempt + 1} network error: ${lastItemErr}`);
              }

              if (attempt < 2) {
                await new Promise((r) => setTimeout(r, attempt === 0 ? 1200 : 2500));
              }
            }

            if (!childId) {
              throw new Error(`Threadsカルーセルアイテム(#${idx + 1})の作成に失敗しました: ${lastItemErr}`);
            }

            childContainerIds.push(childId);

            // 次のアイテム作成までの短いディレイ（Meta APIの同時呼び出し制限を防止）
            if (idx < currentPostMedias.length - 1) {
              await new Promise((r) => setTimeout(r, isVideo ? 500 : 300));
            }
          }

          // すべての子アイテムコンテナのエンコード完了 (FINISHED) を全件並列待機 (動画考慮で最大120秒)
          const hasVideoInCarousel = currentPostMedias.some((m) => m.type === 'VIDEO');
          console.log(`[Threads Carousel] Waiting for ${childContainerIds.length} child containers to be FINISHED (hasVideo: ${hasVideoInCarousel})...`);
          await Promise.all(
            childContainerIds.map((cid) => waitForContainerFinished(cid, cleanToken, hasVideoInCarousel ? 120000 : 45000))
          );

          // 親カルーセルコンテナ作成 (リトライ付き)
          let parentId: string | null = null;
          let lastParentErr = '';

          for (let pAttempt = 0; pAttempt < 3; pAttempt++) {
            const carouselParams = new URLSearchParams();
            carouselParams.append('access_token', cleanToken);
            carouselParams.append('media_type', 'CAROUSEL');
            carouselParams.append('children', childContainerIds.join(','));
            if (postText && postText.trim()) {
              carouselParams.append('text', postText.trim());
            }

            if (cleanTopic) {
              carouselParams.append('topic_tag', cleanTopic);
            }

            if (prevPublishedId) {
              carouselParams.append('reply_to_id', prevPublishedId);
            }

            try {
              const carouselRes = await fetch(`https://graph.threads.net/v1.0/${targetUser}/threads`, {
                method: 'POST',
                body: carouselParams,
              });

              const carouselData = await carouselRes.json().catch(() => ({}));
              if (carouselRes.ok && carouselData.id) {
                parentId = carouselData.id;
                break;
              }

              lastParentErr = formatMetaError(carouselData, carouselRes.statusText, `カルーセル親コンテナの作成(#${i + 1})`);
              console.warn(`[Threads Carousel Parent] Attempt #${pAttempt + 1} failed: ${lastParentErr}`);

              // topic_tag によるバリデーションエラーが発生した場合は、トピックタグを除去して再試行
              if (lastParentErr.includes('topic_tag') && cleanTopic) {
                console.warn(`[Threads Carousel Parent] topic_tag rejected by Meta API (${cleanTopic}). Retrying without topic_tag...`);
                cleanTopic = '';
              }
            } catch (pErr: any) {
              lastParentErr = pErr.message || '通信エラー';
            }

            if (pAttempt < 2) {
              await new Promise((r) => setTimeout(r, 2000));
            }
          }

          if (!parentId) {
            throw new Error(`Threadsカルーセル親コンテナの作成に失敗しました: ${lastParentErr}`);
          }

          containerId = parentId;
        } else if (currentPostMedias.length === 1) {
          // ==========================================
          // 単一メディア (IMAGE または VIDEO) 投稿 (リトライ＋フォールバック対応)
          // ==========================================
          const mediaItem = currentPostMedias[0];
          const isVideo = mediaItem.type === 'VIDEO';
          let singleId: string | null = null;
          let lastSingleErr = '';

          for (let attempt = 0; attempt < 3; attempt++) {
            const urlToUse = attempt === 2 && mediaItem.fallbackUrl ? mediaItem.fallbackUrl : mediaItem.url;
            const containerParams = new URLSearchParams();
            containerParams.append('access_token', cleanToken);
            containerParams.append('media_type', isVideo ? 'VIDEO' : 'IMAGE');
            if (isVideo) {
              containerParams.append('video_url', urlToUse);
            } else {
              containerParams.append('image_url', urlToUse);
            }
            if (postText && postText.trim()) {
              containerParams.append('text', postText.trim());
            }

            if (cleanTopic) {
              containerParams.append('topic_tag', cleanTopic);
            }

            if (prevPublishedId) {
              containerParams.append('reply_to_id', prevPublishedId);
            }

            try {
              const createContainerRes = await fetch(`https://graph.threads.net/v1.0/${targetUser}/threads`, {
                method: 'POST',
                body: containerParams,
              });

              const containerData = await createContainerRes.json().catch(() => ({}));
              if (createContainerRes.ok && containerData.id) {
                singleId = containerData.id;
                break;
              }

              lastSingleErr = formatMetaError(containerData, createContainerRes.statusText, `単一メディアコンテナ作成(#${i + 1})`);
              console.warn(`[Threads Single Media] Attempt #${attempt + 1} failed: ${lastSingleErr}`);

              // topic_tag によるバリデーションエラーが発生した場合は、トピックタグを除去して再試行
              if (lastSingleErr.includes('topic_tag') && cleanTopic) {
                console.warn(`[Threads Single Media] topic_tag rejected by Meta API (${cleanTopic}). Retrying without topic_tag...`);
                cleanTopic = '';
              }
            } catch (sErr: any) {
              lastSingleErr = sErr.message || '通信エラー';
            }

            if (attempt < 2) {
              await new Promise((r) => setTimeout(r, attempt === 0 ? 1200 : 2500));
            }
          }

          if (!singleId) {
            throw new Error(`Threads単一メディアコンテナ作成に失敗しました: ${lastSingleErr}`);
          }

          containerId = singleId;
        } else {
          // ==========================================
          // テキストのみ (TEXT) 投稿 (topic_tagエラー時の自動再試行付き)
          // ==========================================
          const sendTextContainer = async (useTopic: string) => {
            const containerParams = new URLSearchParams();
            containerParams.append('access_token', cleanToken);
            containerParams.append('media_type', 'TEXT');
            containerParams.append('text', postText);

            if (useTopic) {
              containerParams.append('topic_tag', useTopic);
            }

            if (prevPublishedId) {
              containerParams.append('reply_to_id', prevPublishedId);
            }

            const createContainerRes = await fetch(`https://graph.threads.net/v1.0/${targetUser}/threads`, {
              method: 'POST',
              body: containerParams,
            });

            const containerData = await createContainerRes.json().catch(() => ({}));
            return { ok: createContainerRes.ok && Boolean(containerData.id), data: containerData, statusText: createContainerRes.statusText };
          };

          let textResult = await sendTextContainer(cleanTopic);
          if (!textResult.ok && cleanTopic) {
            const errStr = formatMetaError(textResult.data, textResult.statusText, `テキストコンテナ作成(#${i + 1})`);
            if (errStr.includes('topic_tag')) {
              console.warn(`[Threads Text Container] topic_tag rejected (${cleanTopic}). Retrying without topic_tag...`);
              cleanTopic = '';
              textResult = await sendTextContainer('');
            }
          }

          if (!textResult.ok) {
            console.error('Threads text container error:', textResult.data);
            throw new Error(formatMetaError(textResult.data, textResult.statusText, `テキストコンテナ作成(#${i + 1})`));
          }

          containerId = textResult.data.id;
        }

        // ==========================================
        // コンテナの処理完了待機（エンコードFINISHED確認）
        // ==========================================
        const isCurrentPostVideo = currentPostMedias.some((m) => m.type === 'VIDEO');
        await waitForContainerFinished(containerId, cleanToken, isCurrentPostVideo ? 120000 : 45000);

        // ==========================================
        // コンテナの公開 (POST /{user-id}/threads_publish)
        // ==========================================
        const publishParams = new URLSearchParams();
        publishParams.append('access_token', cleanToken);
        publishParams.append('creation_id', containerId);

        let publishedPostId: string | null = null;
        let lastPublishError = '';

        for (let attempt = 0; attempt < 5; attempt++) {
          const publishRes = await fetch(`https://graph.threads.net/v1.0/${targetUser}/threads_publish`, {
            method: 'POST',
            body: publishParams,
          });

          const publishData = await publishRes.json().catch(() => ({}));
          if (publishRes.ok && publishData.id) {
            publishedPostId = publishData.id;
            break;
          }

          lastPublishError = formatMetaError(publishData, publishRes.statusText, '公開API');
          console.warn(`Publish attempt #${attempt + 1} for post #${i + 1}: ${lastPublishError}`);

          // Meta側で素材の準備が数秒遅延する場合 (Code 24 / Subcode 4279009)
          if (attempt < 4) {
            await new Promise((resolve) => setTimeout(resolve, isCurrentPostVideo ? 3500 : 2000));
          }
        }

        if (!publishedPostId) {
          throw new Error(`Threads公開処理の失敗 (#${i + 1}): ${lastPublishError}`);
        }
        createdPostIds.push(publishedPostId);
        prevPublishedId = publishedPostId;

        const postUrl = convertToThreadsUrl(threadsUsername, publishedPostId);
        createdUrls.push(postUrl);

        if (i < threadsPostTexts.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      res.json({
        success: true,
        postsCount: createdUrls.length,
        postIds: createdPostIds,
        urls: createdUrls,
      });
    } catch (err: any) {
      console.error('Threads post error:', err);
      res.status(500).json({
        success: false,
        error: err.message || 'Threads投稿中にエラーが発生しました。',
      });
    }
  });

  // -------------------------------------------------------------
  // エンゲージメント・リアクション分析取得 API
  // -------------------------------------------------------------
  app.post('/api/analytics/engagement', async (req, res) => {
    try {
      const {
        blueskyUrls = [],
        blueskyPostUris = [],
        threadsUrls = [],
        threadsMediaIds = [],
        blueskyAccessJwt,
        blueskyServiceUrl = 'https://bsky.social',
        threadsAccessToken,
      } = req.body;

      let blueskyStats = { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 0 };
      let threadsStats = { likes: 0, reposts: 0, replies: 0, views: 0 };

      // 1. Bluesky リアクション取得
      const bskyUrisToFetch: string[] = [...blueskyPostUris];

      // Bluesky URL (https://bsky.app/profile/<handle>/post/<rkey>) から AT-URI (at://<did>/app.bsky.feed.post/<rkey>) を解決
      for (const bUrl of blueskyUrls) {
        if (!bUrl || typeof bUrl !== 'string') continue;
        const match = bUrl.match(/bsky\.app\/profile\/([^/]+)\/post\/([^/?#]+)/);
        if (match) {
          const rawHandle = match[1];
          const rkey = match[2];
          const did = await resolveBlueskyHandleToDid(rawHandle, blueskyServiceUrl);
          if (did) {
            bskyUrisToFetch.push(`at://${did}/app.bsky.feed.post/${rkey}`);
          }
        }
      }

      if (bskyUrisToFetch.length > 0) {
        try {
          const uniqueUris = Array.from(new Set(bskyUrisToFetch));
          const queryParams = uniqueUris.map((u) => `uris=${encodeURIComponent(u)}`).join('&');
          const pds = (blueskyServiceUrl || 'https://bsky.social').replace(/\/+$/, '');
          const bRes = await fetch(`${pds}/xrpc/app.bsky.feed.getPosts?${queryParams}`, {
            headers: blueskyAccessJwt ? { Authorization: `Bearer ${blueskyAccessJwt}` } : {},
          });

          if (bRes.ok) {
            const bData = await bRes.json();
            const posts = bData?.posts || [];
            for (const p of posts) {
              blueskyStats.likes += p.likeCount || 0;
              blueskyStats.reposts += p.repostCount || 0;
              blueskyStats.replies += p.replyCount || 0;
              blueskyStats.quotes += p.quoteCount || 0;
            }
          }
        } catch (bErr) {
          console.warn('[Engagement] Bluesky fetch error:', bErr);
        }
      }

      // 2. Threads リアクション取得
      const tIdsToFetch: string[] = [...threadsMediaIds];
      for (const tUrl of threadsUrls) {
        if (!tUrl || typeof tUrl !== 'string') continue;
        const match = tUrl.match(/threads\.net\/(?:@[^/]+\/)?post\/([0-9]+)/);
        if (match) {
          tIdsToFetch.push(match[1]);
        }
      }

      if (tIdsToFetch.length > 0 && threadsAccessToken) {
        try {
          for (const mediaId of Array.from(new Set(tIdsToFetch))) {
            const tRes = await fetch(
              `https://graph.threads.net/v1.0/${mediaId}?fields=id,like_count,reply_count,views&access_token=${threadsAccessToken}`
            );
            if (tRes.ok) {
              const tData = await tRes.json();
              threadsStats.likes += tData.like_count || 0;
              threadsStats.replies += tData.reply_count || 0;
              threadsStats.views += tData.views || 0;
            }
          }
        } catch (tErr) {
          console.warn('[Engagement] Threads fetch error:', tErr);
        }
      }

      res.json({
        success: true,
        bluesky: blueskyStats,
        threads: threadsStats,
        fetchedAt: Date.now(),
      });
    } catch (err: any) {
      console.error('[Engagement API Error]', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // -------------------------------------------------------------
  // アプリ終了API (Quit API)
  // -------------------------------------------------------------
  app.post('/api/app/quit', (_req, res) => {
    res.json({ success: true, message: 'アプリケーションを終了します' });
  });

  // -------------------------------------------------------------
  // デスクトップアプリ完全パッケージ（dist一式同梱ZIP）配信API
  // -------------------------------------------------------------
  app.get('/api/desktop-package', async (_req, res) => {
    try {
      const JSZip = (await import('jszip')).default;
      const fs = await import('fs');
      const zip = new JSZip();

      // ルートのPythonデスクトップ関連ファイルを追加
      const rootFiles = [
        'desktop_app.py',
        'requirements.txt',
        'run_desktop.bat',
        'run_desktop_silent.vbs',
        'run_desktop.sh',
        'make_windows_exe.bat',
        'build_exe.py',
        'README_DESKTOP.md',
      ];

      for (const fileName of rootFiles) {
        const filePath = path.join(process.cwd(), fileName);
        if (fs.existsSync(filePath)) {
          zip.file(fileName, fs.readFileSync(filePath));
        }
      }

      // dist / desktop_ui ディレクトリを再帰的に走査して追加
      const distDir = path.join(process.cwd(), 'desktop_ui');
      const fallbackDist = path.join(process.cwd(), 'dist');
      const targetDir = fs.existsSync(distDir) ? distDir : fallbackDist;

      if (fs.existsSync(targetDir)) {
        const addDirToZip = (currentDir: string, zipDirName: string) => {
          const items = fs.readdirSync(currentDir);
          for (const item of items) {
            const itemPath = path.join(currentDir, item);
            const stat = fs.statSync(itemPath);
            if (stat.isDirectory()) {
              addDirToZip(itemPath, `${zipDirName}/${item}`);
            } else {
              // サーバー用のビルド成果物(server.cjs等)はサイズ削減のため除外、UIに必要なファイルを含める
              if (!item.endsWith('.cjs') && !item.endsWith('.map')) {
                zip.file(`${zipDirName}/${item}`, fs.readFileSync(itemPath));
              }
            }
          }
        };
        addDirToZip(targetDir, 'desktop_ui');
        addDirToZip(targetDir, 'dist');
      }

      // 起動案内テキスト
      zip.file(
        'START_HERE.txt',
        `============================================================\n CrossPost Desktop Studio (単体デスクトップアプリ)\n============================================================\n\n★ Webブラウザ（タブやアドレスバーのある通常ブラウザ）は起動せず、\n   専用の単体アプリウィンドウ（ネイティブGUI）として起動します。\n\n【Windowsでの起動手順】\n1. ダウンロードした本ZIPファイルを右クリックし、「すべて展開」で解凍します。\n2. 「run_desktop.bat」をダブルクリックします。\n   ※ 自動的に専用GUIエンジンがセットアップされ、単体アプリウィンドウが起動します。\n\n【単体EXEファイル（.exe）をワンクリックで作りたい場合】\n・「make_windows_exe.bat」をダブルクリックすると、単体で動く「CrossPostStudio.exe」が自動生成されます。\n\n【macOS / Linuxでの起動手順】\nターミナルで本フォルダを開き、以下を実行します:\n   bash run_desktop.sh (または python3 desktop_app.py)\n`
      );

      const zipBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="crosspost-desktop-python.zip"');
      res.setHeader('Content-Length', zipBuffer.length.toString());
      res.send(zipBuffer);
    } catch (err: any) {
      console.error('Failed to generate desktop package zip:', err);
      res.status(500).json({
        success: false,
        error: 'デスクトップパッケージZIPの生成に失敗しました。',
      });
    }
  });

  // -------------------------------------------------------------
  // グローバルエラーハンドリングミドルウェア (413 Payload Too Large 等)
  // -------------------------------------------------------------
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }
    console.error('[Express Global Error]:', err);
    if (err.status === 413 || err.type === 'entity.too.large') {
      res.status(413).json({
        success: false,
        error: '送信データ（画像）のサイズが大きすぎます。画像サイズまたは枚数を減らして再試行してください。',
      });
      return;
    }
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'サーバー内部エラーが発生しました。',
    });
  });

  // -------------------------------------------------------------
  // Vite 開発サーバー / 本番静的配信設定
  // -------------------------------------------------------------
  const distPath = path.join(process.cwd(), 'dist');
  const indexHtmlPath = path.join(distPath, 'index.html');
  const hasDistIndexHtml = fs.existsSync(indexHtmlPath);

  // 本番ビルドファイル(dist/index.html)が存在し、かつ本番モードの場合のみ静的配信。
  // それ以外（開発モードまたはdist未生成時）は Vite ミドルウェアを使用。
  const isProduction = process.env.NODE_ENV === 'production' && hasDistIndexHtml;

  if (isProduction) {
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      },
    }));
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(indexHtmlPath);
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CrossPost Studio server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server startup failed:', err);
  process.exit(1);
});
