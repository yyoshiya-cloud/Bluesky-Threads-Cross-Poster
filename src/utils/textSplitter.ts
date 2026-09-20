import GraphemeSplitter from 'grapheme-splitter';
import { SplitThreadItem, AttachedImage } from '../types';

const splitter = new GraphemeSplitter();

/**
 * Unicode Grapheme Cluster (書記素クラスタ) 準拠の文字数計算
 * 絵文字（合成絵文字、肌色バリエーション、国旗、ZWJ連結 👨‍👩‍👧‍👦 等）やサロゲートペア、結合文字を正確に1文字として計算
 */
export function countGraphemes(text: string): number {
  if (!text) return 0;
  return splitter.countGraphemes(text);
}

/**
 * 文字列を書記素クラスタの配列に分解
 */
export function splitIntoGraphemes(text: string): string[] {
  if (!text) return [];
  return splitter.splitGraphemes(text);
}

/**
 * Bluesky の文字数計算
 * Bluesky (AT Protocol) の公式仕様に準拠し 300 Graphemes を上限として計算
 */
export function calculateBlueskyCharCount(text: string): number {
  return countGraphemes(text);
}

/**
 * Threads の文字数計算
 * Meta Threads の公式仕様に準拠し 500 Graphemes を上限として計算
 */
export function calculateThreadsCharCount(text: string): number {
  return countGraphemes(text);
}

/**
 * 明示的な区切り線 (--- または ===) によるセクション分割
 */
export function splitByExplicitSeparators(rawText: string): string[] {
  if (!rawText || !rawText.trim()) return [];
  const lines = rawText.split(/\r?\n/);
  const sections: string[] = [];
  let currentLines: string[] = [];

  for (const line of lines) {
    if (/^\s*(?:-{3,}|={3,})\s*$/.test(line)) {
      const joined = currentLines.join('\n').trim();
      if (joined) {
        sections.push(joined);
      }
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  const lastJoined = currentLines.join('\n').trim();
  if (lastJoined) {
    sections.push(lastJoined);
  }
  return sections;
}

/**
 * 1つのテキストセクションを文字数上限に合わせて自然に分割するヘルパー
 */
function splitSectionToFit(
  sectionText: string,
  maxLen: number,
  allowTextSplit: boolean,
  charCounter: (t: string) => number
): string[] {
  if (!sectionText.trim()) return [];
  const rawCount = charCounter(sectionText);
  if (!allowTextSplit || rawCount <= maxLen) {
    return [sectionText.trim()];
  }

  const paragraphs = sectionText.split('\n');
  const chunks: string[] = [];
  let current = '';

  for (const p of paragraphs) {
    const candidate = current ? `${current}\n${p}` : p;
    if (charCounter(candidate) <= maxLen) {
      current = candidate;
    } else {
      // 1段落が大きい場合は文区切り（。、！？、改行）
      const sentences = p.split(/(?<=[。．.!\?\n])/);
      for (const s of sentences) {
        if (!s) continue;
        const candS = current ? `${current}${s}` : s;
        if (charCounter(candS) <= maxLen) {
          current = candS;
        } else {
          if (current.trim()) {
            chunks.push(current.trim());
            current = '';
          }
          if (charCounter(s) > maxLen) {
            let temp = '';
            for (const ch of splitIntoGraphemes(s)) {
              if (charCounter(temp + ch) > maxLen) {
                if (temp.trim()) chunks.push(temp.trim());
                temp = ch;
              } else {
                temp += ch;
              }
            }
            current = temp;
          } else {
            current = s;
          }
        }
      }
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }
  return chunks;
}

/**
 * Blueskyの仕様に合わせてメディアをポスト単位にチャンク分割する
 * 仕様:
 * 1. 1つのポストには動画（最大1本）または画像（最大4枚）のいずれか1つのembedのみ許容
 * 2. 動画と画像が混在している場合、2つ目のコンテンツ（または動画と画像の境界）は次のポスト（リプライ）へ自動分割
 * 3. 画像が5枚以上ある場合、4枚ごとに次のポスト（リプライ）へ自動分割
 * 4. 動画が複数本ある場合、1ポスト1本ずつ次のポスト（リプライ）へ自動分割
 */
export function chunkMediaForBluesky<T extends { mediaType?: string; mimeType?: string; dataUrl?: string }>(
  items: T[] = []
): T[][] {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const isVideoItem = (item: T) => {
    return (
      item.mediaType === 'video' ||
      item.mimeType?.startsWith('video/') ||
      (typeof item.dataUrl === 'string' && item.dataUrl.startsWith('data:video/'))
    );
  };

  const chunks: T[][] = [];
  let currentChunk: T[] = [];

  for (const item of items) {
    const isVideo = isVideoItem(item);

    if (currentChunk.length === 0) {
      currentChunk.push(item);
      continue;
    }

    const chunkHasVideo = isVideoItem(currentChunk[0]);

    if (chunkHasVideo) {
      // 現在のポストに既に動画が入っている場合:
      // 動画は1ポストにつき1本のみ、かつ画像との混在は不可のため、次のポストへ分割
      chunks.push(currentChunk);
      currentChunk = [item];
    } else {
      // 現在のポストが画像群の場合:
      if (isVideo) {
        // 次のコンテンツが動画の場合、画像と混在不可のため次のポストへ分割
        chunks.push(currentChunk);
        currentChunk = [item];
      } else {
        // 次のコンテンツも画像の場合: 4枚上限
        if (currentChunk.length < 4) {
          currentChunk.push(item);
        } else {
          chunks.push(currentChunk);
          currentChunk = [item];
        }
      }
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Bluesky用のスレッド分割
 * 最大 300 Graphemes
 * 任意の区切り記号 (---) に対応し、さらに300字超の場合は自動で文末分割
 * ナンバリング "(1/3) " などのバッファ(約8〜10文字)を考慮
 * 画像・動画の仕様（画像最大4枚、動画1本、混在不可）に合わせて自動で次のポスト（リプライ）へ分割
 */
export function splitForBluesky(
  text: string,
  includeNumbering = true,
  images: AttachedImage[] = [],
  allowTextSplit = true
): SplitThreadItem[] {
  // 1. メディア（動画・画像）をBluesky仕様に合わせてポスト単位にチャンク分割
  const mediaChunks = chunkMediaForBluesky(images);

  // テキストもメディアもない場合は空配列
  if (!text.trim() && mediaChunks.length === 0) {
    return [];
  }

  // 2. テキストの分割（手動区切り記号 --- / === + 文字数自動分割のハイブリッド）
  let textChunks: string[] = [];
  if (text.trim()) {
    const rawSections = splitByExplicitSeparators(text);
    const maxLen = 300 - (includeNumbering ? 10 : 0);

    for (const sec of rawSections) {
      const subChunks = splitSectionToFit(sec, maxLen, allowTextSplit, calculateBlueskyCharCount);
      textChunks.push(...subChunks);
    }
  }

  // 3. 全体の投稿数決定（テキスト分割数とメディアチャンク数の大きい方）
  const total = Math.max(textChunks.length, mediaChunks.length);
  if (total === 0) return [];

  return Array.from({ length: total }).map((_, idx) => {
    let postText = '';
    if (idx < textChunks.length) {
      const rawChunk = textChunks[idx];
      postText = includeNumbering && total > 1 ? `(${idx + 1}/${total}) ${rawChunk}` : rawChunk;
    } else {
      // 2つ目以降のメディア専用リプライ（ナンバリング有効時は (2/3) のように付与、無効時は空文字）
      postText = includeNumbering && total > 1 ? `(${idx + 1}/${total})` : '';
    }

    const assignedImages = idx < mediaChunks.length ? mediaChunks[idx] : [];
    const finalCount = calculateBlueskyCharCount(postText);

    return {
      index: idx + 1,
      total,
      text: postText,
      charCount: finalCount,
      weight: finalCount,
      hasImages: assignedImages.length > 0,
      images: assignedImages,
    };
  });
}

/**
 * Threads用のスレッド分割
 * 最大 500 Graphemes
 * 任意の区切り記号 (---) に対応し、さらに500字超の場合は自動で文末分割
 * Threadsはカルーセルで最大20枚まで1投稿に添付可能
 */
export function splitForThreads(
  text: string,
  includeNumbering = true,
  images: AttachedImage[] = [],
  allowTextSplit = true
): SplitThreadItem[] {
  if (!text.trim() && (!images || images.length === 0)) return [];

  let chunks: string[] = [];
  if (text.trim()) {
    const rawSections = splitByExplicitSeparators(text);
    const maxLen = 500 - (includeNumbering ? 12 : 0);

    for (const sec of rawSections) {
      const subChunks = splitSectionToFit(sec, maxLen, allowTextSplit, calculateThreadsCharCount);
      chunks.push(...subChunks);
    }
  } else {
    // テキストなし、画像のみの場合
    chunks = [''];
  }

  const total = chunks.length;
  return chunks.map((chunk, idx) => {
    const formattedText = includeNumbering && total > 1 && chunk ? `(${idx + 1}/${total}) ${chunk}` : chunk;
    const assignedImages = idx === 0 ? images : [];
    const finalCount = calculateThreadsCharCount(formattedText);
    return {
      index: idx + 1,
      total,
      text: formattedText,
      charCount: finalCount,
      weight: finalCount,
      hasImages: assignedImages.length > 0,
      images: assignedImages,
    };
  });
}

// 互換性維持のためのエイリアス
export const calculateXWeight = calculateBlueskyCharCount;
export const splitForX = splitForBluesky;
