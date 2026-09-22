import { ReplyTarget, ApiCredentials } from '../types';

/**
 * Threads / Instagram の Base64 短縮コード（Shortcode）から 64bit 整数 ID を復元する
 * アルファベット順: A-Z, a-z, 0-9, -, _
 */
export function shortcodeToThreadsId(shortcode: string): string {
  const clean = shortcode.trim().replace(/^\/+|\/+$/g, '');
  // すでに数値のみで構成されている場合はそのままIDとして使用
  if (/^\d{10,25}$/.test(clean)) {
    return clean;
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  try {
    let id = BigInt(0);
    for (let i = 0; i < clean.length; i++) {
      const char = clean[i];
      const val = alphabet.indexOf(char);
      if (val === -1) {
        return clean; // 非対応文字がある場合はフォールバック
      }
      id = id * BigInt(64) + BigInt(val);
    }
    return id.toString();
  } catch {
    return clean;
  }
}

export interface ParsedReplyUrl {
  platform: 'Bluesky' | 'Threads' | null;
  rawInput: string;
  postId?: string; // 抽出されたID / rkey
  shortcode?: string; // Threads 短縮コード
  authorHandle?: string;
  isAtUri?: boolean;
}

/**
 * 貼り付けられた文字列からプラットフォームと投稿識別子を判定・抽出
 */
export function parseReplyUrl(input: string): ParsedReplyUrl {
  const trimmed = input.trim();
  if (!trimmed) {
    return { platform: null, rawInput: '' };
  }

  // 1. Bluesky AT-URI (例: at://did:plc:xxx/app.bsky.feed.post/3ldxxx)
  const atUriMatch = trimmed.match(/^at:\/\/([^/]+)\/app\.bsky\.feed\.post\/([^/?#]+)/i);
  if (atUriMatch) {
    return {
      platform: 'Bluesky',
      rawInput: trimmed,
      authorHandle: atUriMatch[1],
      postId: atUriMatch[2],
      isAtUri: true,
    };
  }

  // 2. Bluesky Web URL (例: https://bsky.app/profile/alice.bsky.social/post/3ldxxx)
  const bskyUrlMatch = trimmed.match(/bsky\.app\/profile\/([^/?#]+)\/post\/([^/?#]+)/i);
  if (bskyUrlMatch) {
    return {
      platform: 'Bluesky',
      rawInput: trimmed,
      authorHandle: decodeURIComponent(bskyUrlMatch[1]),
      postId: bskyUrlMatch[2],
    };
  }

  // 3. Threads Web URL (例: https://www.threads.net/@user/post/C-abc or https://www.threads.com/@user/post/C-abc)
  const threadsUserMatch = trimmed.match(/threads\.(?:net|com)\/@[^/?#]+\/post\/([^/?#]+)/i);
  if (threadsUserMatch) {
    const rawShortcode = threadsUserMatch[1].replace(/\/+$/, '');
    const authorMatch = trimmed.match(/threads\.(?:net|com)\/@([^/?#]+)/i);
    return {
      platform: 'Threads',
      rawInput: trimmed,
      authorHandle: authorMatch ? `@${authorMatch[1]}` : undefined,
      shortcode: rawShortcode,
    };
  }

  // 4. Threads 短縮 URL (例: https://www.threads.net/t/C-abc or https://www.threads.com/t/C-abc)
  const threadsShortMatch = trimmed.match(/threads\.(?:net|com)\/t\/([^/?#]+)/i);
  if (threadsShortMatch) {
    const rawShortcode = threadsShortMatch[1].replace(/\/+$/, '');
    return {
      platform: 'Threads',
      rawInput: trimmed,
      shortcode: rawShortcode,
    };
  }

  // 5. Threads シェア URL (例: https://www.threads.com/share/F0Dp4eXK0 or https://www.threads.net/share/post/F0Dp4eXK0)
  const threadsShareMatch = trimmed.match(/threads\.(?:net|com)\/share\/(?:post\/)?([^/?#]+)/i);
  if (threadsShareMatch) {
    const rawShareCode = threadsShareMatch[1].replace(/\/+$/, '');
    return {
      platform: 'Threads',
      rawInput: trimmed,
      shortcode: rawShareCode,
    };
  }

  // 6. Threads 数字Post ID (例: 17985834872123456)
  if (/^\d{15,25}$/.test(trimmed)) {
    return {
      platform: 'Threads',
      rawInput: trimmed,
      postId: trimmed,
    };
  }

  // 7. 一般的なドメインパターンでのフォールバック判定
  if (/bsky\.app|bsky\.social|^at:\/\//i.test(trimmed)) {
    return {
      platform: 'Bluesky',
      rawInput: trimmed,
    };
  }

  if (/threads\.net|threads\.com/i.test(trimmed)) {
    return {
      platform: 'Threads',
      rawInput: trimmed,
    };
  }

  // 8. Bluesky rkey (例: 3lxxxxxxxxx)
  if (/^[a-z0-9]{13}$/.test(trimmed)) {
    return {
      platform: 'Bluesky',
      rawInput: trimmed,
      postId: trimmed,
    };
  }

  return {
    platform: null,
    rawInput: trimmed,
  };
}

export interface ReplyPreviewResult {
  success: boolean;
  platform: 'Bluesky' | 'Threads';
  url: string;
  postId?: string;
  shortcode?: string;
  authorHandle?: string;
  authorDisplayName?: string;
  authorAvatar?: string;
  postSnippet?: string;
  uri?: string;
  cid?: string;
  rootUri?: string;
  rootCid?: string;
  warning?: string;
  isOwnPost?: boolean;
  error?: string;
}

/**
 * リプライ先のプレビューおよび必要な識別子（AT-URI, CID, Root情報, Threads ID）をサーバーまたは公開API経由で取得
 */
export async function fetchReplyTargetPreview(
  input: string,
  platformHint?: 'Bluesky' | 'Threads',
  credentials?: ApiCredentials,
  signal?: AbortSignal
): Promise<ReplyPreviewResult> {
  const parsed = parseReplyUrl(input);
  const platform = parsed.platform || platformHint || 'Bluesky';

  // 1. まずバックエンドAPI（/api/reply-preview）を試行 (Threadsの場合はMeta APIから正規のthreads_media IDを照合)
  try {
    const res = await fetch('/api/reply-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: input,
        platform,
        credentials,
      }),
      signal,
    });

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.success) {
        return {
          ...data,
          platform,
        };
      }
      if (data && data.error) {
        return {
          success: false,
          platform,
          url: input,
          error: data.error,
          warning: data.warning,
        };
      }
    }
  } catch (err: any) {
    if (signal?.aborted) throw err;
    console.warn('[fetchReplyTargetPreview] /api/reply-preview fallback:', err.message);
  }

  // 2. クライアント側フォールバック解決
  if (platform === 'Bluesky') {
    return await resolveBlueskyClientFallback(parsed, input, credentials, signal);
  } else {
    // Threads クライアント側フォールバック
    const resolvedId = parsed.postId;
    return {
      success: Boolean(resolvedId || parsed.shortcode),
      platform: 'Threads',
      url: input,
      postId: resolvedId,
      shortcode: parsed.shortcode,
      authorHandle: parsed.authorHandle,
      postSnippet: resolvedId
        ? `Threads 投稿 (ID: ${resolvedId})`
        : parsed.shortcode
        ? `Threads 投稿 (短縮コード: ${parsed.shortcode})`
        : undefined,
      warning: !resolvedId && parsed.shortcode
        ? '⚠️ Threads APIの仕様上、返信先にはご自身のアカウントで投稿したスレッドのURLのみ指定可能です（他者の投稿への返信はMeta社の追加権限が必要なためエラーとなります）。'
        : undefined,
    };
  }
}

/**
 * Bluesky クライアント側直接解決 (AT Protocol 公開エンドポイントを利用)
 */
async function resolveBlueskyClientFallback(
  parsed: ParsedReplyUrl,
  rawUrl: string,
  credentials?: ApiCredentials,
  signal?: AbortSignal
): Promise<ReplyPreviewResult> {
  try {
    let handleOrDid = parsed.authorHandle;
    const rkey = parsed.postId;

    if (!rkey) {
      return {
        success: false,
        platform: 'Bluesky',
        url: rawUrl,
        error: 'Blueskyの投稿ID（rkey）を特定できませんでした。URLをご確認ください。',
      };
    }

    let did = handleOrDid?.startsWith('did:') ? handleOrDid : '';

    // ハンドルから DID を解決
    if (!did && handleOrDid) {
      const cleanHandle = handleOrDid.replace(/^@/, '');
      const resolveRes = await fetch(
        `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(cleanHandle)}`,
        { signal }
      );
      if (resolveRes.ok) {
        const resolveData = await resolveRes.json().catch(() => ({}));
        if (resolveData.did) {
          did = resolveData.did;
        }
      }
    }

    if (!did) {
      // credentials に DID があり、自身の投稿の場合
      if (credentials?.blueskyDid && (!handleOrDid || handleOrDid === credentials.blueskyHandle)) {
        did = credentials.blueskyDid;
      }
    }

    if (!did) {
      return {
        success: false,
        platform: 'Bluesky',
        url: rawUrl,
        postId: rkey,
        authorHandle: handleOrDid,
        error: '投稿者のDIDを解決できませんでした。URLが正しいか確認してください。',
      };
    }

    const targetUri = `at://${did}/app.bsky.feed.post/${rkey}`;

    // スレッド取得
    const threadRes = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(targetUri)}&depth=0&parentHeight=1`,
      { signal }
    );

    if (!threadRes.ok) {
      return {
        success: true, // URIとDIDは判明しているため投稿自体は可能
        platform: 'Bluesky',
        url: rawUrl,
        postId: rkey,
        authorHandle: handleOrDid,
        uri: targetUri,
      };
    }

    const threadData = await threadRes.json().catch(() => ({}));
    const post = threadData?.thread?.post;
    if (!post) {
      return {
        success: true,
        platform: 'Bluesky',
        url: rawUrl,
        postId: rkey,
        authorHandle: handleOrDid,
        uri: targetUri,
      };
    }

    const author = post.author || {};
    const record = post.record || {};
    const replyMeta = record.reply;

    return {
      success: true,
      platform: 'Bluesky',
      url: rawUrl,
      postId: rkey,
      uri: post.uri,
      cid: post.cid,
      rootUri: replyMeta?.root?.uri || post.uri,
      rootCid: replyMeta?.root?.cid || post.cid,
      authorHandle: author.handle ? `@${author.handle}` : handleOrDid,
      authorDisplayName: author.displayName,
      authorAvatar: author.avatar,
      postSnippet: typeof record.text === 'string' ? record.text.slice(0, 140) : undefined,
    };
  } catch (err: any) {
    if (signal?.aborted) throw err;
    return {
      success: false,
      platform: 'Bluesky',
      url: rawUrl,
      error: `リプライ先情報の取得に失敗しました: ${err.message || '通信エラー'}`,
    };
  }
}
