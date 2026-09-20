import { ApiCredentials, AttachedImage } from '../types';
import { recordCommError, recordCommSuccess, recordCommInfo } from './commErrorLogger';

export interface PostResult {
  success: boolean;
  isDemo?: boolean;
  postIds?: string[];
  urls?: string[];
  errorCode?: string | number;
  error?: string;
  message?: string;
}

export interface BlueskyAuthResult {
  success: boolean;
  isDemo?: boolean;
  session?: {
    did: string;
    handle: string;
    accessJwt: string;
    refreshJwt?: string;
    email?: string;
  };
  errorCode?: string | number;
  error?: string;
}

export interface ThreadsVerifyResult {
  success: boolean;
  isDemo?: boolean;
  id?: string;
  username?: string;
  errorCode?: string | number;
  error?: string;
}

export interface ThreadsRefreshResult {
  success: boolean;
  isDemo?: boolean;
  accessToken?: string;
  expiresIn?: number;
  expiresAt?: number;
  refreshedAt?: number;
  requiresReLogin?: boolean;
  errorCode?: string | number;
  message?: string;
  error?: string;
}

export const DEMO_CREDENTIALS: ApiCredentials = {
  blueskyIdentifier: 'demo-creator.bsky.social',
  blueskyAppPassword: 'demo-pass-xxxx-xxxx-xxxx',
  blueskyServiceUrl: 'https://bsky.social',
  blueskyConnected: true,
  blueskyHandle: 'demo-creator.bsky.social',
  blueskyDid: 'did:plc:democreator1029384756',
  threadsUserId: 'threads_user_demo_10293',
  threadsAccessToken: 'TH_LONG_LIVED_TOKEN_DEMO_91238',
  threadsConnected: true,
  threadsUsername: '@Demo_Threads_Official',
  isDemoMode: true,
};

/**
 * 認証情報がデモ・サンプル値かどうかを判定
 */
export function checkIsDemoCredentials(credentials: ApiCredentials) {
  if (credentials.isDemoMode) {
    return { blueskyIsDemo: true, threadsIsDemo: true };
  }

  const bId = (credentials.blueskyIdentifier || '').toLowerCase();
  const bPass = (credentials.blueskyAppPassword || '').toLowerCase();
  const blueskyIsDemo = Boolean(
    bId && (bId.includes('demo') || bPass.includes('demo') || bPass === 'demo-pass-xxxx-xxxx-xxxx')
  );

  const tId = (credentials.threadsUserId || '').toLowerCase();
  const tToken = (credentials.threadsAccessToken || '').toLowerCase();
  const threadsIsDemo = Boolean(
    tToken && (tId.includes('demo') || tToken.includes('demo') || tToken === 'th_long_lived_token_demo_91238')
  );

  return { blueskyIsDemo, threadsIsDemo };
}

/**
 * 添付メディア（動画・画像）の内訳を計算し、「添付メディア: 9件 (動画: 3件, 画像: 6件)」のように出力するフォーマッタ
 */
export function formatMediaSummary(images?: AttachedImage[]): string {
  if (!images || images.length === 0) {
    return '添付メディア: なし (動画: 0件, 画像: 0件)';
  }
  let videoCount = 0;
  let imageCount = 0;
  for (const item of images) {
    const ext = (item.name || '').split('.').pop()?.toLowerCase() || '';
    const isVideo =
      item.mediaType === 'video' ||
      Boolean(item.mimeType?.startsWith('video/')) ||
      ['mp4', 'mov', 'webm', 'm4v'].includes(ext) ||
      (typeof item.dataUrl === 'string' && item.dataUrl.startsWith('data:video/'));
    if (isVideo) {
      videoCount++;
    } else {
      imageCount++;
    }
  }

  const total = images.length;
  return `添付メディア: ${total}件 (動画: ${videoCount}件, 画像: ${imageCount}件)`;
}

/**
 * 中断シグナル（AbortSignal）対応の非同期待機関数
 */
export function abortableWait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new DOMException('ユーザー操作により投稿処理が中止されました', 'AbortError'));
    }
    const timer = setTimeout(() => {
      resolve();
    }, ms);
    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timer);
          reject(new DOMException('ユーザー操作により投稿処理が中止されました', 'AbortError'));
        },
        { once: true }
      );
    }
  });
}

/**
 * Bluesky アプリパスワード認証
 */
export async function authenticateBluesky(
  identifier: string,
  appPassword: string,
  serviceUrl = 'https://bsky.social'
): Promise<BlueskyAuthResult> {
  const isDemo =
    identifier.toLowerCase().includes('demo') ||
    appPassword.toLowerCase().includes('demo') ||
    appPassword === 'demo-pass-xxxx-xxxx-xxxx';

  const cleanIdentifier = identifier.trim().replace(/^@/, '').replace(/\s+/g, '');
  const cleanPassword = appPassword.trim().replace(/\s+/g, '').replace(/[−―ー－]/g, '-');
  const finalIdentifier = cleanIdentifier.includes('.') ? cleanIdentifier : `${cleanIdentifier}.bsky.social`;

  if (!isDemo) {
    recordCommInfo({
      platform: 'Bluesky',
      action: 'Bluesky接続試行開始',
      endpoint: '/api/bluesky/auth',
      requestSummary: `識別子: ${finalIdentifier} / サービスURL: ${serviceUrl}`,
      message: `Blueskyへの接続・認証を開始しました (アカウント: ${finalIdentifier})`,
      isDemo: false,
    });
  }

  // 1. バックエンド API 経由での認証試行
  try {
    const res = await fetch('/api/bluesky/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: finalIdentifier,
        appPassword: cleanPassword,
        serviceUrl,
      }),
    });

    const data = await res.json().catch(() => ({}));
    const resultIsDemo = Boolean(data.isDemo || isDemo);

    if (res.ok && data.success) {
      const sessionHandle = data.session?.handle || finalIdentifier;
      if (!resultIsDemo) {
        recordCommSuccess({
          platform: 'Bluesky',
          action: 'Bluesky接続成功',
          endpoint: '/api/bluesky/auth',
          requestSummary: `ハンドル: @${sessionHandle} / DID: ${data.session?.did || 'did:plc:***'}`,
          message: `Blueskyへの接続・認証に成功しました (@${sessionHandle})`,
          isDemo: false,
        });
      }

      return {
        success: true,
        isDemo: resultIsDemo,
        session: data.session,
      };
    }

    // 404 (バックエンド未起動やプロキシ404) または 500 番台等の場合は直接 XRPC へフォールバック
    if (res.status === 404 || res.status >= 500) {
      console.warn(`[Bluesky Auth] Backend returned status ${res.status}. Falling back to direct XRPC call...`);
    } else {
      const errMsg = data.error || `認証エラー (${res.status})`;
      if (!resultIsDemo) {
        recordCommError({
          platform: 'Bluesky',
          action: 'Bluesky接続認証失敗',
          endpoint: '/api/bluesky/auth',
          httpStatus: res.status,
          errorMessage: errMsg,
          requestSummary: `アカウント: ${finalIdentifier}`,
          suggestedAction: 'ハンドル名が正しいか、公式のアプリパスワード（xxxx-xxxx-xxxx-xxxx）を使用しているか確認してください。',
          isDemo: false,
        });
      }
      return {
        success: false,
        error: errMsg,
      };
    }
  } catch (backendErr: any) {
    console.warn('[Bluesky Auth] Backend fetch failed, falling back to direct XRPC call:', backendErr);
  }

  // 2. クライアント直接通信フォールバック (Direct XRPC createSession)
  // AT Protocol公式のエンドポイントは CORS (access-control-allow-origin: *) に完全対応
  try {
    const pdsUrl = (serviceUrl || 'https://bsky.social').replace(/\/+$/, '');
    const directRes = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: finalIdentifier,
        password: cleanPassword,
      }),
    });

    const directData = await directRes.json().catch(() => ({}));

    if (directRes.ok && directData.accessJwt) {
      const session = {
        did: directData.did,
        handle: directData.handle || finalIdentifier,
        accessJwt: directData.accessJwt,
        refreshJwt: directData.refreshJwt,
        email: directData.email,
      };

      if (!isDemo) {
        recordCommSuccess({
          platform: 'Bluesky',
          action: 'Bluesky直接接続成功',
          endpoint: `${pdsUrl}/xrpc/com.atproto.server.createSession`,
          requestSummary: `ハンドル: @${session.handle} / DID: ${session.did}`,
          message: `Blueskyへの直接接続・認証に成功しました (@${session.handle})`,
          isDemo: false,
        });
      }

      return {
        success: true,
        isDemo,
        session,
      };
    }

    const fallbackErrMsg =
      directRes.status === 401
        ? 'ハンドル名またはアプリパスワードが正しくありません。Bluesky公式のアプリパスワード（xxxx-xxxx-xxxx-xxxx形式）をご確認ください。'
        : directData.message || `認証エラー (${directRes.statusText || directRes.status})`;

    if (!isDemo) {
      recordCommError({
        platform: 'Bluesky',
        action: 'Bluesky接続認証失敗',
        endpoint: `${pdsUrl}/xrpc/com.atproto.server.createSession`,
        httpStatus: directRes.status,
        errorMessage: fallbackErrMsg,
        requestSummary: `アカウント: ${finalIdentifier}`,
        suggestedAction: 'ハンドル名が正しいか、公式のアプリパスワード（xxxx-xxxx-xxxx-xxxx形式）を使用しているか確認してください。',
        isDemo: false,
      });
    }

    return {
      success: false,
      error: fallbackErrMsg,
    };
  } catch (directErr: any) {
    const errMsg = `Bluesky接続エラー: ${directErr.message || '通信に失敗しました。ネットワーク状態をご確認ください。'}`;
    if (!isDemo) {
      recordCommError({
        platform: 'Bluesky',
        action: 'Bluesky接続認証失敗',
        endpoint: '/api/bluesky/auth',
        errorMessage: errMsg,
        requestSummary: `アカウント: ${finalIdentifier}`,
        suggestedAction: 'インターネット接続状態を確認し、再度お試しください。',
        isDemo: false,
      });
    }
    return {
      success: false,
      error: errMsg,
    };
  }
}

/**
 * Threads アクセストークン検証
 */
export async function verifyThreadsToken(
  userId: string,
  accessToken: string
): Promise<ThreadsVerifyResult> {
  const isDemo =
    userId.toLowerCase().includes('demo') ||
    accessToken.toLowerCase().includes('demo') ||
    accessToken === 'TH_LONG_LIVED_TOKEN_DEMO_91238';

  const cleanToken = accessToken.trim().replace(/\s+/g, '');
  const cleanUserId = userId.trim() || 'me';

  if (!isDemo) {
    recordCommInfo({
      platform: 'Threads',
      action: 'Threads接続試行開始',
      endpoint: '/api/threads/verify',
      requestSummary: `User ID: ${cleanUserId} / トークン長: ${cleanToken.length}文字`,
      message: `Threads (Meta Graph API) への接続・トークン検証を開始しました (User ID: ${cleanUserId})`,
      isDemo: false,
    });
  }

  // 1. バックエンド API 経由での検証試行
  try {
    const res = await fetch('/api/threads/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: cleanUserId,
        accessToken: cleanToken,
      }),
    });

    const data = await res.json().catch(() => ({}));
    const resultIsDemo = Boolean(data.isDemo || isDemo);

    if (res.ok && data.success) {
      const username = data.username ? `@${data.username}` : 'Threads User';
      if (!resultIsDemo) {
        recordCommSuccess({
          platform: 'Threads',
          action: 'Threads接続成功',
          endpoint: '/api/threads/verify',
          requestSummary: `アカウント: ${username} / User ID: ${data.id || cleanUserId}`,
          message: `Threadsへの接続・トークン検証に成功しました (${username})`,
          isDemo: false,
        });
      }

      return {
        success: true,
        isDemo: resultIsDemo,
        id: data.id,
        username: data.username,
      };
    }

    // 404 (エンドポイント見つからない等) や 500 番台の場合は直接 Graph API にフォールバック
    if (res.status === 404 || res.status >= 500) {
      console.warn(`[Threads Verify] Backend returned ${res.status}. Falling back to direct Meta Graph API call...`);
    } else {
      const errMsg = data.error || `検証エラー (${res.status})`;
      if (!resultIsDemo) {
        recordCommError({
          platform: 'Threads',
          action: 'Threads接続検証失敗',
          endpoint: '/api/threads/verify',
          httpStatus: res.status,
          errorMessage: errMsg,
          requestSummary: `User ID: ${cleanUserId}`,
          suggestedAction: 'Meta開発者ポータルで発行したアクセストークンが有効か確認してください。',
          isDemo: false,
        });
      }
      return {
        success: false,
        error: errMsg,
      };
    }
  } catch (backendErr: any) {
    console.warn('[Threads Verify] Backend fetch failed, falling back to direct Graph API call:', backendErr);
  }

  // 2. クライアント直接通信フォールバック (Direct Meta Graph API /me)
  // Meta Graph API も CORS (access-control-allow-origin: *) に対応
  try {
    // まず 'me' でトークン所有者の情報を取得
    let directRes = await fetch(
      `https://graph.threads.net/v1.0/me?fields=id,username,threads_profile_picture_url&access_token=${encodeURIComponent(cleanToken)}`
    );
    let directData = await directRes.json().catch(() => ({}));

    // もし me で取得できず、かつ cleanUserId が指定されていた場合はその ID でも試行
    if (!directRes.ok && cleanUserId && cleanUserId !== 'me') {
      directRes = await fetch(
        `https://graph.threads.net/v1.0/${cleanUserId}?fields=id,username,threads_profile_picture_url&access_token=${encodeURIComponent(cleanToken)}`
      );
      directData = await directRes.json().catch(() => ({}));
    }

    if (directRes.ok && (directData.id || directData.username)) {
      const username = directData.username ? `@${directData.username}` : 'Threads User';
      if (!isDemo) {
        recordCommSuccess({
          platform: 'Threads',
          action: 'Threads直接接続成功',
          endpoint: 'https://graph.threads.net/v1.0/me',
          requestSummary: `アカウント: ${username} / User ID: ${directData.id || cleanUserId}`,
          message: `Threadsへの直接接続・トークン検証に成功しました (${username})`,
          isDemo: false,
        });
      }

      return {
        success: true,
        isDemo,
        id: directData.id,
        username: directData.username,
      };
    }

    const fallbackErrMsg =
      directData.error?.message ||
      `アクセストークン検証に失敗しました (${directRes.statusText || directRes.status})。Meta開発者ポータルのトークン有効性を確認してください。`;

    if (!isDemo) {
      recordCommError({
        platform: 'Threads',
        action: 'Threads接続検証失敗',
        endpoint: 'https://graph.threads.net/v1.0/me',
        httpStatus: directRes.status,
        errorMessage: fallbackErrMsg,
        requestSummary: `User ID: ${cleanUserId}`,
        suggestedAction: 'Meta開発者ポータルでアクセストークンを再発行するか、有効期限をご確認ください。',
        isDemo: false,
      });
    }

    return {
      success: false,
      error: fallbackErrMsg,
    };
  } catch (directErr: any) {
    const errMsg = `Threads API通信エラー: ${directErr.message || '検証できませんでした。通信状態をご確認ください。'}`;
    if (!isDemo) {
      recordCommError({
        platform: 'Threads',
        action: 'Threads接続検証失敗',
        endpoint: '/api/threads/verify',
        errorMessage: errMsg,
        requestSummary: `User ID: ${cleanUserId}`,
        suggestedAction: 'ネットワーク接続状態を確認してください。',
        isDemo: false,
      });
    }
    return {
      success: false,
      error: errMsg,
    };
  }
}

/**
 * Threads Long-Lived Token の有効期限更新 (Meta Graph API)
 */
export async function refreshThreadsToken(
  accessToken: string
): Promise<ThreadsRefreshResult> {
  const isDemo =
    accessToken.toLowerCase().includes('demo') ||
    accessToken === 'TH_LONG_LIVED_TOKEN_DEMO_91238';

  const cleanToken = accessToken.trim().replace(/\s+/g, '');

  if (!isDemo) {
    recordCommInfo({
      platform: 'Threads',
      action: 'Threads有効期限更新試行',
      endpoint: '/api/threads/refresh-token',
      message: 'Threads Long-Lived Token の有効期限延長リクエストを送信しました',
      isDemo: false,
    });
  }

  if (isDemo) {
    const expiresIn = 5184000;
    const expiresAt = Date.now() + expiresIn * 1000;
    return {
      success: true,
      isDemo: true,
      accessToken: 'TH_LONG_LIVED_TOKEN_DEMO_91238',
      expiresIn,
      expiresAt,
      refreshedAt: Date.now(),
      message: '【デモモード】Long-Lived Tokenの有効期限を60日間延長しました。',
    };
  }

  // 1. バックエンド API 経由での更新試行
  try {
    const res = await fetch('/api/threads/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accessToken: cleanToken,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.success) {
      recordCommSuccess({
        platform: 'Threads',
        action: 'Threads有効期限更新成功',
        endpoint: '/api/threads/refresh-token',
        message: 'Threadsアクセストークンの有効期限を更新しました（次回更新まで約60日間有効）',
        isDemo: false,
      });

      return {
        success: true,
        isDemo: false,
        accessToken: data.accessToken,
        expiresIn: data.expiresIn,
        expiresAt: data.expiresAt,
        refreshedAt: data.refreshedAt,
        message: data.message,
      };
    }

    // 404 (エンドポイント不達) や 500 番台の場合は直接 Meta Graph API へフォールバック
    if (res.status === 404 || res.status >= 500) {
      console.warn(`[Threads Refresh] Backend returned ${res.status}. Falling back to direct Meta Graph API call...`);
    } else {
      const errMsg = data.error || `トークン更新エラー (${res.status})`;
      recordCommError({
        platform: 'Threads',
        action: 'Threads有効期限更新失敗',
        endpoint: '/api/threads/refresh-token',
        httpStatus: res.status,
        errorCode: data.errorCode,
        errorMessage: errMsg,
        suggestedAction: data.requiresReLogin
          ? 'トークンが完全に失効しています。再度アクセストークンを発行して接続し直してください。'
          : 'アクセストークンが現在有効か、Meta開発者ポータルで失効していないか確認してください。',
        isDemo: false,
      });

      return {
        success: false,
        requiresReLogin: !!data.requiresReLogin,
        errorCode: data.errorCode,
        error: errMsg,
      };
    }
  } catch (backendErr: any) {
    console.warn('[Threads Refresh] Backend fetch failed, falling back to direct Meta Graph API call:', backendErr);
  }

  // 2. クライアント直接通信フォールバック (Direct Meta Graph API refresh_access_token)
  try {
    const directUrl = `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(cleanToken)}`;
    const directRes = await fetch(directUrl, { method: 'GET' });
    const directData = await directRes.json().catch(() => ({}));

    if (directRes.ok && directData.access_token) {
      const expiresIn = directData.expires_in || 5184000;
      const expiresAt = Date.now() + expiresIn * 1000;
      const refreshedAt = Date.now();

      recordCommSuccess({
        platform: 'Threads',
        action: 'Threads直接有効期限更新成功',
        endpoint: 'https://graph.threads.net/refresh_access_token',
        message: 'Threadsアクセストークンの有効期限を直接更新しました（約60日間有効）',
        isDemo: false,
      });

      return {
        success: true,
        isDemo: false,
        accessToken: directData.access_token,
        expiresIn,
        expiresAt,
        refreshedAt,
        message: 'Threads Long-Lived Token の有効期限を更新（60日間延長）しました！',
      };
    }

    // Meta API 仕様: 発行または前回更新から24時間未満の場合は更新不可（トークン自体は現在も有効）
    const metaErrMsg = directData?.error?.message || '';
    if (metaErrMsg.includes('less than 24 hours') || metaErrMsg.includes('24 hours')) {
      const now = Date.now();
      const assumedExpiresAt = now + (60 * 24 * 60 * 60 * 1000);

      recordCommInfo({
        platform: 'Threads',
        action: 'Threads有効期限確認',
        endpoint: 'https://graph.threads.net/refresh_access_token',
        message: 'このトークンは発行・更新から24時間未満のため延長処理はスキップされました（現在も約60日間有効です）。',
        isDemo: false,
      });

      return {
        success: true,
        isDemo: false,
        accessToken: cleanToken,
        expiresIn: 5184000,
        expiresAt: assumedExpiresAt,
        refreshedAt: now,
        message: 'ℹ️ このアクセストークンは発行・更新から24時間未満のため延長不要です（現在も有効期限約60日間が保持されています）。発行から24時間経過後に再度延長が可能になります。',
      };
    }

    const fallbackErrMsg =
      directData.error?.message ||
      `トークン更新エラー (${directRes.statusText || directRes.status})。Meta開発者ポータルのトークン有効性を確認してください。`;

    recordCommError({
      platform: 'Threads',
      action: 'Threads有効期限更新失敗',
      endpoint: 'https://graph.threads.net/refresh_access_token',
      httpStatus: directRes.status,
      errorMessage: fallbackErrMsg,
      isDemo: false,
    });

    return {
      success: false,
      error: fallbackErrMsg,
    };
  } catch (directErr: any) {
    const errMsg = `Threads API通信エラー: ${directErr.message || '更新できませんでした'}`;
    recordCommError({
      platform: 'Threads',
      action: 'Threads有効期限更新失敗',
      endpoint: 'https://graph.threads.net/refresh_access_token',
      errorMessage: errMsg,
      isDemo: false,
    });
    return {
      success: false,
      error: errMsg,
    };
  }
}

import { getMediaBlob, saveMediaBlob } from './indexedMediaStorage';

/**
 * Data URL (Base64) を安全に Blob へ変換するヘルパー関数
 */
export function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    if (!dataUrl || typeof dataUrl !== 'string') return null;
    const parts = dataUrl.split(',');
    if (parts.length < 2) return null;
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (e) {
    console.warn('dataUrlToBlob conversion failed:', e);
    return null;
  }
}

/**
 * メディアファイル（動画・画像）を事前にストリームアップロードして軽量なmediaIdを取得
 */
export async function uploadMediaItem(
  img: AttachedImage,
  signal?: AbortSignal
): Promise<{ mediaId?: string; dataUrl: string; publicUrl?: string }> {
  if (signal?.aborted) {
    throw new DOMException('ユーザー操作により投稿処理が中止されました', 'AbortError');
  }

  // すでに有効なmediaIdおよびpublicUrlが取得済みの場合は即座にキャッシュを再利用
  if (img.mediaId && img.publicUrl) {
    return { mediaId: img.mediaId, dataUrl: img.dataUrl, publicUrl: img.publicUrl };
  }

  // 1. 生ファイルが存在しない場合、IndexedDBからキャッシュされたBlobの復元を試みる
  let fileToUpload: File | Blob | undefined = img.file;
  if (!fileToUpload && img.id) {
    try {
      const recovered = await getMediaBlob(img.id);
      if (recovered) {
        fileToUpload = recovered;
        img.file = recovered;
      }
    } catch (e) {
      console.warn('IndexedDB recovery note:', e);
    }
  }

  // 2. mediaId で既にアップロード済みの場合はIndexedDBから復元確認
  if (!fileToUpload && img.mediaId) {
    try {
      const recovered = await getMediaBlob(img.mediaId);
      if (recovered) {
        fileToUpload = recovered;
        img.file = recovered;
      }
    } catch (e) {
      console.warn('IndexedDB recovery by mediaId note:', e);
    }
  }

  // 3. fileToUpload がまだない場合、img.dataUrl から Blob を復元
  if (!fileToUpload && img.dataUrl && img.dataUrl.startsWith('data:')) {
    const convertedBlob = dataUrlToBlob(img.dataUrl);
    if (convertedBlob) {
      fileToUpload = convertedBlob;
    }
  }

  // 4. すでに有効なmediaIdがあり、fileToUploadの再アップロードが不要な場合
  if (img.mediaId && !fileToUpload) {
    return { mediaId: img.mediaId, dataUrl: img.dataUrl, publicUrl: img.publicUrl };
  }

  // 5. 生ファイルオブジェクトが存在する場合、まずはパブリック外部公開エンドポイント /api/media/upload-public へ送信
  if (fileToUpload) {
    try {
      const isVideo = img.mediaType === 'video' || (img.dataUrl && img.dataUrl.startsWith('data:video/'));
      let safeUploadName = img.name || (isVideo ? 'video.mp4' : 'image.jpg');

      // 画像の場合: JPEG / PNG 以外の形式や無拡張子を確実に .jpg に標準化
      if (!isVideo) {
        const lowerName = safeUploadName.toLowerCase();
        if (!lowerName.endsWith('.jpg') && !lowerName.endsWith('.jpeg') && !lowerName.endsWith('.png')) {
          safeUploadName = `${safeUploadName.replace(/\.[^/.]+$/, '').trim() || 'image'}.jpg`;
        }
        // dataUrl からの JPEG Blob 復元を優先（Canvasで既に白背景・sRGB・適正サイズに圧縮済み）
        if (img.dataUrl && img.dataUrl.startsWith('data:image/')) {
          const convertedJpeg = dataUrlToBlob(img.dataUrl);
          if (convertedJpeg) {
            fileToUpload = convertedJpeg;
          }
        }
      }

      const formData = new FormData();
      formData.append('file', fileToUpload, safeUploadName);

      // 高速外部公開APIを優先
      const uploadRes = await fetch('/api/media/upload-public', {
        method: 'POST',
        body: formData,
        signal,
      }).catch((err) => {
        if (signal?.aborted) throw err;
        return null;
      });

      if (signal?.aborted) {
        throw new DOMException('ユーザー操作により投稿処理が中止されました', 'AbortError');
      }

      if (uploadRes && uploadRes.ok) {
        const uploadData = await uploadRes.json().catch(() => ({}));
        if (uploadData.success && uploadData.mediaId) {
          img.mediaId = uploadData.mediaId;
          img.publicUrl = uploadData.publicUrl;
          if (img.id) {
            saveMediaBlob(img.id, fileToUpload, img.name, img.mimeType).catch(() => {});
          }
          saveMediaBlob(uploadData.mediaId, fileToUpload, img.name, img.mimeType).catch(() => {});
          return {
            mediaId: uploadData.mediaId,
            dataUrl: img.dataUrl,
            publicUrl: uploadData.publicUrl,
          };
        }
      }

      // フォールバック: 通常の /api/media/upload
      const fallbackRes = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
        signal,
      }).catch((err) => {
        if (signal?.aborted) throw err;
        return null;
      });

      if (signal?.aborted) {
        throw new DOMException('ユーザー操作により投稿処理が中止されました', 'AbortError');
      }

      if (fallbackRes && fallbackRes.ok) {
        const fallbackData = await fallbackRes.json().catch(() => ({}));
        if (fallbackData.success && fallbackData.mediaId) {
          img.mediaId = fallbackData.mediaId;
          return {
            mediaId: fallbackData.mediaId,
            dataUrl: img.dataUrl,
            publicUrl: img.publicUrl,
          };
        }
      }
    } catch (uploadErr) {
      console.warn('Failed to upload media item via FormData:', uploadErr);
    }
  }

  return { dataUrl: img.dataUrl, mediaId: img.mediaId, publicUrl: img.publicUrl };
}

/**
 * Bluesky への直接 XRPC 投稿フォールバック
 */
async function directPostToBluesky(
  credentials: ApiCredentials,
  posts: string[],
  images: AttachedImage[] = [],
  signal?: AbortSignal
): Promise<PostResult> {
  if (signal?.aborted) {
    throw new DOMException('ユーザー操作により投稿処理が中止されました', 'AbortError');
  }

  const serviceUrl = (credentials.blueskyServiceUrl || 'https://bsky.social').replace(/\/+$/, '');
  let accessJwt = credentials.blueskyAccessJwt;
  let did = credentials.blueskyDid;
  const cleanHandle = (credentials.blueskyHandle || credentials.blueskyIdentifier || 'user').replace(/^@/, '');

  // 1. JWT がないか有効性確認のため、必要に応じてセッションを作成
  if (!accessJwt || !did) {
    const cleanId = (credentials.blueskyIdentifier || '').trim().replace(/^@/, '');
    const cleanPass = (credentials.blueskyAppPassword || '').trim().replace(/\s+/g, '').replace(/[−―ー－]/g, '-');
    const finalId = cleanId.includes('.') ? cleanId : `${cleanId}.bsky.social`;

    const sessionRes = await fetch(`${serviceUrl}/xrpc/com.atproto.server.createSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: finalId, password: cleanPass }),
      signal,
    });
    const sessionData = await sessionRes.json().catch(() => ({}));
    if (!sessionRes.ok || !sessionData.accessJwt) {
      throw new Error(sessionData.message || 'Blueskyセッションの作成に失敗しました。アプリパスワードを確認してください。');
    }
    accessJwt = sessionData.accessJwt;
    did = sessionData.did;
  }

  if (signal?.aborted) {
    throw new DOMException('ユーザー操作により投稿処理が中止されました', 'AbortError');
  }

  // 2. メディア（画像・動画）のBlobアップロード (com.atproto.repo.uploadBlob)
  type DirectMediaItem =
    | { type: 'video'; blob: any; alt: string }
    | { type: 'image'; blob: any; alt: string };
  const uploadedMediaItems: DirectMediaItem[] = [];

  if (images.length > 0) {
    for (const img of images) {
      if (signal?.aborted) {
        throw new DOMException('ユーザー操作により投稿処理が中止されました', 'AbortError');
      }
      let blobToUpload: Blob | null = null;
      if (img.file) {
        blobToUpload = img.file;
      } else if (img.dataUrl) {
        blobToUpload = dataUrlToBlob(img.dataUrl);
      }
      if (blobToUpload) {
        try {
          const isVideo = img.mediaType === 'video' || blobToUpload.type.startsWith('video/');
          const uploadRes = await fetch(`${serviceUrl}/xrpc/com.atproto.repo.uploadBlob`, {
            method: 'POST',
            headers: {
              'Content-Type': blobToUpload.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
              'Authorization': `Bearer ${accessJwt}`,
            },
            body: blobToUpload,
            signal,
          });
          const uploadData = await uploadRes.json().catch(() => ({}));
          if (uploadRes.ok && uploadData.blob) {
            uploadedMediaItems.push({
              type: isVideo ? 'video' : 'image',
              blob: uploadData.blob,
              alt: img.alt || '',
            });
          } else {
            console.warn('UploadBlob failed in direct post:', uploadData);
          }
        } catch (e) {
          if (signal?.aborted) throw e;
          console.warn('Failed to upload media blob directly to Bluesky:', e);
        }
      }
    }
  }

  if (signal?.aborted) {
    throw new DOMException('ユーザー操作により投稿処理が中止されました', 'AbortError');
  }

  // Bluesky公式仕様に合わせてメディアをポスト単位（チャンク）に分割
  // 仕様: 1投稿につき「動画1本」または「画像最大4枚」のいずれか1つのみ許容 (4枚超過エラー防止)
  type DirectMediaChunk =
    | { type: 'video'; video: { blob: any; alt: string } }
    | { type: 'images'; images: { blob: any; alt: string }[] };

  const mediaChunks: DirectMediaChunk[] = [];
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

  // 3. スレッド投稿の逐次実行 (投稿テキスト数とメディアチャンク数の大きい方に合わせてスレッドを延伸)
  const postIds: string[] = [];
  const urls: string[] = [];
  let rootRef: { uri: string; cid: string } | null = null;
  let parentRef: { uri: string; cid: string } | null = null;

  const totalPostCount = Math.max(posts.length, mediaChunks.length) || 1;

  for (let i = 0; i < totalPostCount; i++) {
    if (signal?.aborted) {
      throw new DOMException('ユーザー操作により投稿処理が中止されました', 'AbortError');
    }
    const postText = i < posts.length ? (posts[i] || '') : (totalPostCount > 1 ? `(${i + 1}/${totalPostCount})` : '');
    const isFirst = i === 0;

    const recordPayload: any = {
      $type: 'app.bsky.feed.post',
      text: postText,
      createdAt: new Date().toISOString(),
    };

    if (!isFirst && rootRef && parentRef) {
      recordPayload.reply = {
        root: rootRef,
        parent: parentRef,
      };
    }

    // 各ポストにメディアチャンク（動画1本 または 画像最大4枚）を割り当て
    if (i < mediaChunks.length) {
      const chunk = mediaChunks[i];
      if (chunk.type === 'video') {
        recordPayload.embed = {
          $type: 'app.bsky.embed.video',
          video: chunk.video.blob,
          alt: chunk.video.alt || '',
        };
      } else if (chunk.type === 'images' && chunk.images.length > 0) {
        recordPayload.embed = {
          $type: 'app.bsky.embed.images',
          images: chunk.images.map((it) => ({
            image: it.blob,
            alt: it.alt || '',
          })),
        };
      }
    }

    const postRes = await fetch(`${serviceUrl}/xrpc/com.atproto.repo.createRecord`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessJwt}`,
      },
      body: JSON.stringify({
        repo: did,
        collection: 'app.bsky.feed.post',
        record: recordPayload,
      }),
      signal,
    });

    const postData = await postRes.json().catch(() => ({}));
    if (!postRes.ok || !postData.uri) {
      throw new Error(postData.message || `Bluesky投稿(${i + 1}件目)の作成に失敗しました (${postRes.status})`);
    }

    const uri = postData.uri;
    const cid = postData.cid;
    const rkey = uri.split('/').pop() || '';
    const postUrl = `https://bsky.app/profile/${cleanHandle}/post/${rkey}`;

    postIds.push(rkey);
    urls.push(postUrl);

    if (isFirst) {
      rootRef = { uri, cid };
    }
    parentRef = { uri, cid };
  }

  recordCommSuccess({
    platform: 'Bluesky',
    action: 'Bluesky直接投稿成功',
    endpoint: `${serviceUrl}/xrpc/com.atproto.repo.createRecord`,
    requestSummary: `スレッド数: ${totalPostCount}件, ${formatMediaSummary(images)}`,
    message: 'Blueskyに直接接続してスレッド投稿を完了しました！',
    isDemo: false,
  });

  return {
    success: true,
    isDemo: false,
    postIds,
    urls,
    message: 'Blueskyへのスレッド投稿が完了しました！',
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
  if (lower.includes('tmpfiles.org')) return false; // tmpfiles.org returns HTML/redirects, not direct images
  return true;
}

/**
 * クライアント直接アップロード（ブラウザから直接 Uguu 一時CDNへ送信）
 */
async function uploadToDirectPublicHost(blob: Blob, name: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const isVideo = blob.type.startsWith('video/') || ['mp4', 'mov', 'webm'].some(ext => name.toLowerCase().endsWith(`.${ext}`));
    let safeName = name || (isVideo ? 'video.mp4' : 'image.jpg');
    if (!isVideo && !safeName.toLowerCase().endsWith('.jpg') && !safeName.toLowerCase().endsWith('.jpeg') && !safeName.toLowerCase().endsWith('.png')) {
      safeName = `${safeName.replace(/\.[^/.]+$/, '').trim() || 'image'}.jpg`;
    }
    const formData = new FormData();
    formData.append('files[]', blob, safeName);
    const res = await fetch('https://uguu.se/upload', {
      method: 'POST',
      body: formData,
      signal,
    });
    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      const url = json?.files?.[0]?.url;
      if (url && typeof url === 'string' && url.startsWith('http') && isTrulyPublicCdnUrl(url)) {
        console.log(`[DirectPublicUpload] Uploaded directly to Uguu: ${url}`);
        return url;
      }
    }
  } catch (err) {
    if (signal?.aborted) throw err;
    console.warn('[DirectPublicUpload] Uguu note:', err);
  }
  return null;
}

/**
 * Threads への直接 Meta Graph API 投稿フォールバック（画像・カルーセル・動画完全対応）
 */
async function directPostToThreads(
  credentials: ApiCredentials,
  posts: string[],
  images: AttachedImage[] = [],
  topic?: string,
  signal?: AbortSignal
): Promise<PostResult> {
  if (signal?.aborted) {
    throw new DOMException('ユーザー操作により投稿処理が中止されました', 'AbortError');
  }

  const token = (credentials.threadsAccessToken || '').trim().replace(/\s+/g, '');
  const cleanUsername = (credentials.threadsUsername || '').replace(/^@/, '') || 'Threads_User';

  if (!token) {
    throw new Error('Threadsのアクセストークンが設定されていません。');
  }

  // 1. 添付メディア（画像・動画）の外部公開URLを解決
  interface DirectMediaUrlItem {
    url: string;
    isVideo: boolean;
    alt?: string;
  }

  const resolvedMedias: DirectMediaUrlItem[] = [];

  if (images && images.length > 0) {
    for (let idx = 0; idx < images.length; idx++) {
      const img = images[idx];
      const ext = (img.name || '').split('.').pop()?.toLowerCase() || '';
      const isVideo =
        img.mediaType === 'video' ||
        Boolean(img.mimeType?.startsWith('video/')) ||
        ['mp4', 'mov', 'webm', 'm4v'].includes(ext) ||
        (typeof img.dataUrl === 'string' && img.dataUrl.startsWith('data:video/'));

      // 1-1. すでに有効な外部公開URL（Truly Public）が存在する場合
      if (img.publicUrl && isTrulyPublicCdnUrl(img.publicUrl)) {
        resolvedMedias.push({ url: img.publicUrl, isVideo, alt: img.alt });
        continue;
      }

      // 1-2. uploadMediaItem（/api/media/upload-public 経由）の呼び出し
      try {
        const upRes = await uploadMediaItem(img, signal);
        if (upRes.mediaId) {
          img.mediaId = upRes.mediaId;
        }
        if (upRes.publicUrl && isTrulyPublicCdnUrl(upRes.publicUrl)) {
          img.publicUrl = upRes.publicUrl;
          resolvedMedias.push({ url: upRes.publicUrl, isVideo, alt: img.alt });
          continue;
        }
      } catch (upErr) {
        if (signal?.aborted) throw upErr;
        console.warn(`[directPostToThreads] Pre-upload notice for #${idx + 1}:`, upErr);
      }

      // 1-3. クライアント直接アップロード（tmpfiles.org）を試行
      let blobToUpload: Blob | null = img.file || null;
      if (!blobToUpload && img.id) {
        try {
          const recovered = await getMediaBlob(img.id);
          if (recovered) blobToUpload = recovered;
        } catch {}
      }
      if (!blobToUpload && img.mediaId) {
        try {
          const recovered = await getMediaBlob(img.mediaId);
          if (recovered) blobToUpload = recovered;
        } catch {}
      }
      if (!blobToUpload && img.dataUrl) {
        blobToUpload = dataUrlToBlob(img.dataUrl);
      }
      if (blobToUpload) {
        try {
          const directUrl = await uploadToDirectPublicHost(blobToUpload, img.name || `media_${idx + 1}.${ext || 'jpg'}`, signal);
          if (directUrl) {
            img.publicUrl = directUrl;
            resolvedMedias.push({ url: directUrl, isVideo, alt: img.alt });
            continue;
          }
        } catch (directErr) {
          if (signal?.aborted) throw directErr;
          console.warn(`[directPostToThreads] uploadToDirectPublicHost note for #${idx + 1}:`, directErr);
        }
      }

      // 1-4. サーバー配信用URL（/api/media/:mediaId）
      if (img.mediaId) {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const fallbackUrl = `${origin}/api/media/${img.mediaId}`;
        resolvedMedias.push({ url: fallbackUrl, isVideo, alt: img.alt });
        continue;
      }
    }

    // 誤投稿防止ガード: 画像が指定されていたのに1件も公開URLが取得できなかった場合は、本文だけを勝手に投稿しない！
    if (resolvedMedias.length === 0) {
      throw new Error(
        'Threadsへの添付画像・動画の外部公開ホスティングに失敗しました。画像・動画無しの状態での誤投稿を防止するため処理を中断しました。'
      );
    }
  }

  const postIds: string[] = [];
  const urls: string[] = [];
  let previousPostId: string | null = null;

  // スレッド投稿数
  const totalPosts = Math.max(posts.length, 1);

  for (let i = 0; i < totalPosts; i++) {
    const postText = i < posts.length ? posts[i] : '';
    const isFirst = i === 0;
    // 添付メディアは1投稿目に割り当て（スレッド対応）
    const postMedias = isFirst ? resolvedMedias : [];

    let creationId = '';

    if (postMedias.length > 1) {
      // ----------------------------------------------------
      // カルーセル (CAROUSEL) 投稿: 最大20枚
      // ----------------------------------------------------
      const childContainerIds: string[] = [];

      for (let mIdx = 0; mIdx < postMedias.length; mIdx++) {
        const item = postMedias[mIdx];
        const childParams = new URLSearchParams();
        childParams.append('access_token', token);
        childParams.append('is_carousel_item', 'true');
        childParams.append('media_type', item.isVideo ? 'VIDEO' : 'IMAGE');
        if (item.isVideo) {
          childParams.append('video_url', item.url);
        } else {
          childParams.append('image_url', item.url);
        }

        const childRes = await fetch('https://graph.threads.net/v1.0/me/threads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: childParams.toString(),
        });

        const childData = await childRes.json().catch(() => ({}));
        if (!childRes.ok || !childData.id) {
          const errMsg = childData?.error?.message || `Threadsカルーセルアイテム(#${mIdx + 1})作成に失敗しました (${childRes.status})`;
          throw new Error(errMsg);
        }
        childContainerIds.push(childData.id);
        await new Promise((r) => setTimeout(r, 400));
      }

      // 親カルーセルコンテナ作成
      await new Promise((r) => setTimeout(r, 1200));
      const parentParams = new URLSearchParams();
      parentParams.append('access_token', token);
      parentParams.append('media_type', 'CAROUSEL');
      parentParams.append('children', childContainerIds.join(','));
      if (postText && postText.trim()) {
        parentParams.append('text', postText.trim());
      }
      if (isFirst && topic && topic.trim()) {
        parentParams.append('topic_tag', topic.trim().replace(/^#/, ''));
      }
      if (!isFirst && previousPostId) {
        parentParams.append('reply_to_id', previousPostId);
      }

      const parentRes = await fetch('https://graph.threads.net/v1.0/me/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: parentParams.toString(),
      });

      const parentData = await parentRes.json().catch(() => ({}));
      if (!parentRes.ok || !parentData.id) {
        const errMsg = parentData?.error?.message || `Threadsカルーセル親コンテナ作成に失敗しました (${parentRes.status})`;
        throw new Error(errMsg);
      }
      creationId = parentData.id;

    } else if (postMedias.length === 1) {
      // ----------------------------------------------------
      // 単一メディア (IMAGE / VIDEO) 投稿
      // ----------------------------------------------------
      const single = postMedias[0];
      const singleParams = new URLSearchParams();
      singleParams.append('access_token', token);
      singleParams.append('media_type', single.isVideo ? 'VIDEO' : 'IMAGE');
      if (single.isVideo) {
        singleParams.append('video_url', single.url);
      } else {
        singleParams.append('image_url', single.url);
      }
      if (postText && postText.trim()) {
        singleParams.append('text', postText.trim());
      }
      if (isFirst && topic && topic.trim()) {
        singleParams.append('topic_tag', topic.trim().replace(/^#/, ''));
      }
      if (!isFirst && previousPostId) {
        singleParams.append('reply_to_id', previousPostId);
      }

      const singleRes = await fetch('https://graph.threads.net/v1.0/me/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: singleParams.toString(),
      });

      const singleData = await singleRes.json().catch(() => ({}));
      if (!singleRes.ok || !singleData.id) {
        const errMsg = singleData?.error?.message || `Threadsメディアコンテナ作成に失敗しました (${singleRes.status})`;
        throw new Error(errMsg);
      }
      creationId = singleData.id;

    } else {
      // ----------------------------------------------------
      // テキストのみ (TEXT) 投稿
      // ----------------------------------------------------
      const containerParams = new URLSearchParams();
      containerParams.append('media_type', 'TEXT');
      containerParams.append('text', postText);
      containerParams.append('access_token', token);

      if (isFirst && topic && topic.trim()) {
        containerParams.append('topic_tag', topic.trim().replace(/^#/, ''));
      }
      if (!isFirst && previousPostId) {
        containerParams.append('reply_to_id', previousPostId);
      }

      const containerRes = await fetch('https://graph.threads.net/v1.0/me/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: containerParams.toString(),
      });

      const containerData = await containerRes.json().catch(() => ({}));
      if (!containerRes.ok || !containerData.id) {
        const errMsg = containerData?.error?.message || `Threadsコンテナ作成に失敗しました (${containerRes.status})`;
        throw new Error(errMsg);
      }
      creationId = containerData.id;
    }

    // 2. コンテナ作成後の公開待機 (Threads API推奨)
    await abortableWait(1500, signal);

    // 3. コンテナ公開 (threads_publish)
    const publishParams = new URLSearchParams();
    publishParams.append('creation_id', creationId);
    publishParams.append('access_token', token);

    const publishRes = await fetch('https://graph.threads.net/v1.0/me/threads_publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: publishParams.toString(),
      signal,
    });

    const publishData = await publishRes.json().catch(() => ({}));
    if (!publishRes.ok || !publishData.id) {
      const errMsg = publishData?.error?.message || `Threads投稿公開に失敗しました (${publishRes.status})`;
      throw new Error(errMsg);
    }

    const publishedId = publishData.id;
    previousPostId = publishedId;
    postIds.push(publishedId);
    urls.push(`https://www.threads.net/post/${publishedId}`);

    if (i < totalPosts - 1) {
      await abortableWait(1000, signal);
    }
  }

  recordCommSuccess({
    platform: 'Threads',
    action: 'Threads直接投稿成功',
    endpoint: 'https://graph.threads.net/v1.0/me/threads',
    requestSummary: `スレッド数: ${posts.length}件, ${formatMediaSummary(images)}${resolvedMedias.length > 1 ? ' (カルーセル)' : ''}, トピック: ${topic ? `#${topic}` : 'なし'}`,
    message: 'Threadsに直接接続してスレッド投稿を完了しました！',
    isDemo: false,
  });

  return {
    success: true,
    isDemo: false,
    postIds,
    urls,
    message: resolvedMedias.length > 0
      ? `Threadsへのメディア（${resolvedMedias.length}件）付き投稿が完了しました！`
      : 'Threadsへのスレッド投稿が完了しました！',
  };
}

/**
 * Bluesky への実際のスレッド投稿
 */
export async function sendBlueskyPost(
  credentials: ApiCredentials,
  posts: string[],
  images: AttachedImage[],
  signal?: AbortSignal
): Promise<PostResult> {
  if (signal?.aborted) {
    throw new DOMException('ユーザー操作により投稿処理が中止されました', 'AbortError');
  }

  const isDemo =
    Boolean(credentials.isDemoMode) ||
    checkIsDemoCredentials(credentials).blueskyIsDemo;

  if (isDemo) {
    const count = posts.length || 1;
    const urls = Array.from({ length: count }).map(
      (_, idx) => `https://bsky.app/profile/demo-creator.bsky.social/post/demo-${Date.now()}-${idx + 1}`
    );
    return {
      success: true,
      isDemo: true,
      postIds: urls.map((u) => u.split('/').pop()),
      urls,
      message: '【DEMOモード】シミュレーション投稿が完了しました。',
    };
  }

  try {
    // 動画・生ファイルを事前にサーバーへ軽量ストリームアップロード
    const preparedImages = await Promise.all(
      images.map(async (img) => {
        if (signal?.aborted) {
          throw new DOMException('ユーザー操作により投稿処理が中止されました', 'AbortError');
        }
        const isVideo = img.mediaType === 'video' || (img.dataUrl?.startsWith('data:video'));
        const uploadResult = await uploadMediaItem(img, signal);
        if (isVideo && !uploadResult.mediaId && !img.file) {
          throw new Error(`動画「${img.name || '添付動画'}」の本体ファイルが見つかりません。ページの再読み込み等で動画ファイルへの参照が切れているため、動画を一度削除して再添付してください。`);
        }
        const hasMediaId = Boolean(uploadResult.mediaId);
        return {
          name: img.name,
          mediaId: uploadResult.mediaId,
          // mediaId がある場合は巨大なBase64 dataUrlを省略してHTTPリクエストペイロードを軽量化 (Failed to fetch/Timeout防止)
          dataUrl: hasMediaId ? undefined : img.dataUrl,
          thumbnailUrl: img.thumbnailUrl,
          mediaType: img.mediaType || (img.dataUrl?.startsWith('data:video') ? 'video' : 'image'),
          mimeType: img.mimeType,
          duration: img.duration,
          alt: img.alt || '',
        };
      })
    );

    if (signal?.aborted) {
      throw new DOMException('ユーザー操作により投稿処理が中止されました', 'AbortError');
    }

    const res = await fetch('/api/bluesky/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credentials,
        posts,
        isDemo: false,
        images: preparedImages,
      }),
      signal,
    });

    const contentType = res.headers.get('content-type') || '';
    let data: any = {};
    if (contentType.includes('application/json')) {
      data = await res.json().catch(() => ({}));
    } else {
      console.warn('Non-JSON response from /api/bluesky/post:', res.status, 'Falling back to direct XRPC...');
      return await directPostToBluesky(credentials, posts, images, signal);
    }

    if (!res.ok || !data.success) {
      if (res.status === 404 || res.status >= 500) {
        console.warn(`[Bluesky Post] Backend error ${res.status}. Falling back to direct XRPC call...`);
        return await directPostToBluesky(credentials, posts, images, signal);
      }
      const errMsg = data.error || `Bluesky投稿に失敗しました (${res.status})`;
      recordCommError({
        platform: 'Bluesky',
        action: 'Blueskyスレッド投稿',
        endpoint: '/api/bluesky/post',
        httpStatus: res.status,
        errorMessage: errMsg,
        requestSummary: `スレッド数: ${posts.length}件, ${formatMediaSummary(images)}`,
      });
      return {
        success: false,
        error: errMsg,
      };
    }

    recordCommSuccess({
      platform: 'Bluesky',
      action: 'Bluesky投稿完了',
      endpoint: '/api/bluesky/post',
      requestSummary: `スレッド数: ${posts.length}件, ${formatMediaSummary(images)}`,
      message: 'Blueskyへのスレッド投稿が完了しました！',
      isDemo: false,
    });

    return {
      success: true,
      isDemo: data.isDemo,
      postIds: data.postIds,
      urls: data.urls,
      message: data.message,
    };
  } catch (err: any) {
    if (signal?.aborted) {
      throw err;
    }
    console.warn('[Bluesky Post] Backend fetch exception. Falling back to direct XRPC call:', err);
    try {
      return await directPostToBluesky(credentials, posts, images, signal);
    } catch (directErr: any) {
      if (signal?.aborted) throw directErr;
      const errMsg = `Bluesky通信エラー: ${directErr.message || err.message || '送信できませんでした'}`;
      recordCommError({
        platform: 'Bluesky',
        action: 'Blueskyスレッド投稿',
        endpoint: '/api/bluesky/post',
        errorMessage: errMsg,
        requestSummary: `スレッド数: ${posts.length}件, ${formatMediaSummary(images)}`,
      });
      return {
        success: false,
        error: errMsg,
      };
    }
  }
}

/**
 * Threads への実際のスレッド投稿
 */
export async function sendThreadsPost(
  credentials: ApiCredentials,
  posts: string[],
  images: AttachedImage[],
  topic?: string,
  signal?: AbortSignal
): Promise<PostResult> {
  if (signal?.aborted) {
    throw new DOMException('ユーザー操作により投稿処理が中止されました', 'AbortError');
  }

  const isDemo =
    Boolean(credentials.isDemoMode) ||
    checkIsDemoCredentials(credentials).threadsIsDemo;

  if (isDemo) {
    const count = posts.length || 1;
    const urls = Array.from({ length: count }).map(
      (_, idx) => `https://www.threads.net/@Demo_Threads_Official/post/demo-${Date.now()}-${idx + 1}`
    );
    return {
      success: true,
      isDemo: true,
      postIds: urls.map((u) => u.split('/').pop()),
      urls,
      message: '【DEMOモード】シミュレーション投稿が完了しました。',
    };
  }

  try {
    // 動画・生ファイルを事前にサーバーへ軽量ストリームアップロード
    const preparedImages = await Promise.all(
      images.map(async (img) => {
        if (signal?.aborted) {
          throw new DOMException('ユーザー操作により投稿処理が中止されました', 'AbortError');
        }
        const isVideo = img.mediaType === 'video' || (img.dataUrl?.startsWith('data:video'));
        const uploadResult = await uploadMediaItem(img, signal);
        if (isVideo && !uploadResult.mediaId && !img.file) {
          throw new Error(`動画「${img.name || '添付動画'}」の本体ファイルが見つかりません。ページの再読み込み等で動画ファイルへの参照が切れているため、動画を一度削除して再添付してください。`);
        }
        const hasMediaId = Boolean(uploadResult.mediaId);
        return {
          name: img.name,
          mediaId: uploadResult.mediaId,
          dataUrl: img.dataUrl || undefined,
          publicUrl: (uploadResult.publicUrl && isTrulyPublicCdnUrl(uploadResult.publicUrl)) ? uploadResult.publicUrl : undefined,
          thumbnailUrl: img.thumbnailUrl,
          mediaType: img.mediaType || (img.dataUrl?.startsWith('data:video') ? 'video' : 'image'),
          mimeType: img.mimeType,
          duration: img.duration,
          alt: img.alt || '',
        };
      })
    );

    if (signal?.aborted) {
      throw new DOMException('ユーザー操作により投稿処理が中止されました', 'AbortError');
    }

    const clientOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const res = await fetch('/api/threads/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credentials,
        posts,
        topic: topic ? topic.trim() : undefined,
        clientOrigin,
        isDemo: false,
        images: preparedImages,
      }),
      signal,
    });

    const contentType = res.headers.get('content-type') || '';
    let data: any = {};
    if (contentType.includes('application/json')) {
      data = await res.json().catch(() => ({}));
    } else {
      console.warn('Non-JSON response from /api/threads/post. Falling back to direct Meta Graph API (with media)...');
      return await directPostToThreads(credentials, posts, images, topic, signal);
    }

    if (!res.ok || !data.success) {
      // サーバーが具体的なエラーメッセージ（Meta APIエラーなど）を返している場合は、その正確なエラーを報告
      const errMsg = data.error || `Threads投稿に失敗しました (${res.status})`;
      
      // 404 (エンドポイント自体が見つからない) の場合のみブラウザ直接通信へフォールバック
      if (res.status === 404) {
        console.warn(`[Threads Post] Backend endpoint 404. Falling back to direct Meta Graph API...`);
        try {
          return await directPostToThreads(credentials, posts, images, topic, signal);
        } catch (directErr: any) {
          if (signal?.aborted) throw directErr;
          const directMsg = directErr.message || errMsg;
          recordCommError({
            platform: 'Threads',
            action: 'Threadsスレッド投稿',
            endpoint: '/api/threads/post',
            httpStatus: res.status,
            errorMessage: directMsg,
            requestSummary: `スレッド数: ${posts.length}件, ${formatMediaSummary(images)}, トピック: ${topic ? `#${topic}` : 'なし'}`,
          });
          return {
            success: false,
            error: directMsg,
          };
        }
      }

      recordCommError({
        platform: 'Threads',
        action: 'Threadsスレッド投稿',
        endpoint: '/api/threads/post',
        httpStatus: res.status,
        errorMessage: errMsg,
        requestSummary: `スレッド数: ${posts.length}件, ${formatMediaSummary(images)}, トピック: ${topic ? `#${topic}` : 'なし'}`,
      });
      return {
        success: false,
        error: errMsg,
      };
    }

    recordCommSuccess({
      platform: 'Threads',
      action: 'Threads投稿完了',
      endpoint: '/api/threads/post',
      requestSummary: `スレッド数: ${posts.length}件, ${formatMediaSummary(images)}, トピック: ${topic ? `#${topic}` : 'なし'}`,
      message: 'Threadsへのスレッド投稿が完了しました！',
      isDemo: false,
    });

    return {
      success: true,
      isDemo: data.isDemo,
      postIds: data.postIds,
      urls: data.urls,
      message: data.message,
    };
  } catch (err: any) {
    if (signal?.aborted) {
      throw err;
    }
    console.warn('[Threads Post] Backend fetch exception. Falling back to direct Meta Graph API (with media):', err);
    try {
      return await directPostToThreads(credentials, posts, images, topic, signal);
    } catch (directErr: any) {
      if (signal?.aborted) throw directErr;
      const errMsg = `Threads通信エラー: ${directErr.message || err.message || '送信できませんでした'}`;
      recordCommError({
        platform: 'Threads',
        action: 'Threadsスレッド投稿',
        endpoint: '/api/threads/post',
        errorMessage: errMsg,
        requestSummary: `スレッド数: ${posts.length}件, ${formatMediaSummary(images)}, トピック: ${topic ? `#${topic}` : 'なし'}`,
      });
      return {
        success: false,
        error: errMsg,
      };
    }
  }
}
