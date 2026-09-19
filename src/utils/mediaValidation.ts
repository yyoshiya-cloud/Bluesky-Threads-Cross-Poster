import { AttachedImage } from '../types';

/**
 * Bluesky 及び Threads の公式メディア仕様定義
 */
export const MEDIA_SPECS = {
  bluesky: {
    name: 'Bluesky',
    video: {
      maxDurationSec: 60, // 最大60秒
      maxSizeBytes: 50 * 1024 * 1024, // 最大50MB
      maxSizeMB: 50,
      supportedFormats: ['mp4', 'mov', 'webm', 'm4v'],
      supportedMimes: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'],
      maxVideosPerPost: 1, // 1投稿につき動画1本
      allowMixingImageAndVideo: false, // 画像と動画の混在不可
      aspectRatios: '16:9, 9:16, 1:1, 4:5 推奨 (最大1080p)',
    },
    image: {
      maxImagesPerPost: 4, // 1投稿につき最大4枚
      maxSizeBytes: 10 * 1024 * 1024, // 1枚あたり最大10MB (自動圧縮)
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    },
  },
  threads: {
    name: 'Threads (Meta)',
    video: {
      minDurationSec: 1, // 最短1秒
      maxDurationSec: 300, // 最長5分 (300秒)
      maxSizeBytes: 100 * 1024 * 1024, // 100MB (アプリ間転送制限 / Threads APIは最大1GB)
      maxSizeMB: 100,
      supportedFormats: ['mp4', 'mov'], // WebMはMeta非対応
      supportedMimes: ['video/mp4', 'video/quicktime'],
      maxVideosPerPost: 10, // カルーセル時最大10件
      allowMixingImageAndVideo: true, // カルーセルで画像と混在可
      minAspectRatio: 0.5625, // 9:16 縦長 (0.5625)
      maxAspectRatio: 1.91, // 1.91:1 横長
      aspectRatios: '1.91:1 (横長) 〜 9:16 (縦長リール) または 4:5 / 1:1',
      minWidth: 500,
    },
    image: {
      maxImagesPerPost: 10, // カルーセル時最大10枚
      maxSizeBytes: 20 * 1024 * 1024, // 20MB
      supportedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
    },
  },
};

export interface VideoValidationDetail {
  isValid: boolean;
  canPostBluesky: boolean;
  canPostThreads: boolean;
  blueskyErrors: string[];
  threadsErrors: string[];
  warnings: string[];
  metadata: {
    format: string;
    mimeType: string;
    sizeBytes: number;
    sizeMB: number;
    durationSec: number;
    width: number;
    height: number;
    aspectRatio: number;
  };
}

/**
 * 単一動画ファイルの仕様検証
 */
export function validateVideoMetadata(
  file: { name?: string; size: number; type?: string },
  meta: { duration?: number; width?: number; height?: number; mimeType?: string }
): VideoValidationDetail {
  const fileName = file.name || 'video.mp4';
  const ext = fileName.split('.').pop()?.toLowerCase() || 'mp4';
  const mimeType = meta.mimeType || file.type || (ext === 'mov' ? 'video/quicktime' : 'video/mp4');
  const sizeBytes = file.size;
  const sizeMB = Math.round((sizeBytes / (1024 * 1024)) * 10) / 10;
  const durationSec = Math.round((meta.duration || 0) * 10) / 10;
  const width = meta.width || 0;
  const height = meta.height || 0;
  const aspectRatio = width > 0 && height > 0 ? Math.round((width / height) * 100) / 100 : 0;

  const blueskyErrors: string[] = [];
  const threadsErrors: string[] = [];
  const warnings: string[] = [];

  // ==========================================
  // 1. フォーマット検証
  // ==========================================
  const isBlueskyFormat = MEDIA_SPECS.bluesky.video.supportedFormats.includes(ext) ||
    MEDIA_SPECS.bluesky.video.supportedMimes.some((m) => mimeType.includes(m.split('/')[1]));
  
  if (!isBlueskyFormat) {
    blueskyErrors.push(`非対応の動画形式です (.${ext})。Blueskyは MP4, MOV, WebM に対応しています。`);
  }

  const isThreadsFormat = MEDIA_SPECS.threads.video.supportedFormats.includes(ext) ||
    ['video/mp4', 'video/quicktime'].some((m) => mimeType.includes(m.split('/')[1]));

  if (!isThreadsFormat) {
    if (ext === 'webm' || mimeType.includes('webm')) {
      threadsErrors.push('WebM形式はMeta Threads APIで非対応です。MP4またはMOV形式をご使用ください。');
    } else {
      threadsErrors.push(`非対応の動画形式です (.${ext})。Threadsは MP4, MOV に対応しています。`);
    }
  }

  // ==========================================
  // 2. 容量（ファイルサイズ）検証
  // ==========================================
  if (sizeBytes > MEDIA_SPECS.bluesky.video.maxSizeBytes) {
    blueskyErrors.push(
      `容量超過: ${sizeMB}MB (Bluesky公式上限は 50MB です)。50MB以下に圧縮するかThreads単体へ投稿してください。`
    );
  }

  if (sizeBytes > MEDIA_SPECS.threads.video.maxSizeBytes) {
    threadsErrors.push(
      `容量超過: ${sizeMB}MB (Threads高速連携上限は 100MB です)。100MB以下に圧縮してください。`
    );
  }

  // ==========================================
  // 3. 再生時間（Duration）検証
  // ==========================================
  if (durationSec > 0) {
    if (durationSec > MEDIA_SPECS.bluesky.video.maxDurationSec) {
      blueskyErrors.push(
        `再生時間超過: ${durationSec}秒 (Bluesky公式上限は 60秒/1分 です)。Threads(最大5分)のみ投稿可能か、60秒以内にトリミングしてください。`
      );
    }

    if (durationSec < MEDIA_SPECS.threads.video.minDurationSec) {
      threadsErrors.push(
        `再生時間が短すぎます: ${durationSec}秒 (Threads公式仕様は 1秒以上 必要です)。`
      );
    }

    if (durationSec > MEDIA_SPECS.threads.video.maxDurationSec) {
      threadsErrors.push(
        `再生時間超過: ${durationSec}秒 (Threads公式上限は 5分/300秒 です)。5分以内に編集してください。`
      );
    }
  }

  // ==========================================
  // 4. アスペクト比 & 解像度検証 (Threads)
  // ==========================================
  if (width > 0 && height > 0) {
    if (aspectRatio > MEDIA_SPECS.threads.video.maxAspectRatio + 0.05) {
      warnings.push(
        `アスペクト比が横長です (${aspectRatio}:1)。Threadsの公式推奨範囲 (1.91:1 〜 9:16) を超えており、Meta側で自動クロップまたは拒否される恐れがあります。`
      );
    } else if (aspectRatio < MEDIA_SPECS.threads.video.minAspectRatio - 0.05) {
      warnings.push(
        `アスペクト比が縦長すぎます (${aspectRatio}:1)。Threadsの公式推奨範囲 (1.91:1 〜 9:16) より細長いため、表示が切れる恐れがあります。`
      );
    }

    if (width < 500 && height < 500) {
      warnings.push(`解像度が低すぎます (${width}x${height})。高画質プレビューのため 720p 以上の動画を推奨します。`);
    }
  }

  const canPostBluesky = blueskyErrors.length === 0;
  const canPostThreads = threadsErrors.length === 0;
  const isValid = canPostBluesky || canPostThreads;

  return {
    isValid,
    canPostBluesky,
    canPostThreads,
    blueskyErrors,
    threadsErrors,
    warnings,
    metadata: {
      format: ext,
      mimeType,
      sizeBytes,
      sizeMB,
      durationSec,
      width,
      height,
      aspectRatio,
    },
  };
}

/**
 * 投稿実行前の全体メディア構成バリデーション
 */
export function validateMediaForPosting(
  platforms: { bluesky: boolean; threads: boolean },
  images: AttachedImage[]
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!images || images.length === 0) {
    return { isValid: true, errors: [], warnings: [] };
  }

  const videoItems = images.filter((img) => img.mediaType === 'video' || img.mimeType?.startsWith('video/'));
  const imageItems = images.filter((img) => img.mediaType !== 'video' && !img.mimeType?.startsWith('video/'));

  // ==========================================
  // Blueskyのメディア制限検証
  // ==========================================
  if (platforms.bluesky) {
    // 1. 動画と画像の混在制限（エラーにせず、自動スレッド分割の案内として処理）
    if (videoItems.length > 0 && imageItems.length > 0) {
      warnings.push(
        '【Bluesky自動スレッド分割】Blueskyは1つの投稿に動画と画像を混在できないため、2つ目以降のコンテンツ（画像または動画）は次のポスト（リプライ）へ自動分割して投稿されます。'
      );
    }

    // 2. 複数動画制限（エラーにせず、1投稿1本ずつのスレッド分割案内として処理）
    if (videoItems.length > 1) {
      warnings.push(
        `【Bluesky自動スレッド分割】Blueskyは1投稿につき動画1本のため、${videoItems.length}本の動画は1本ずつリプライへ自動分割して投稿されます。`
      );
    }

    // 3. 各動画の詳細仕様
    videoItems.forEach((v, idx) => {
      const detail = validateVideoMetadata(
        { name: v.name, size: v.size, type: v.mimeType },
        { duration: v.duration, width: v.width, height: v.height, mimeType: v.mimeType }
      );
      if (!detail.canPostBluesky) {
        detail.blueskyErrors.forEach((err) => {
          errors.push(`【Bluesky動画仕様エラー (動画 #${idx + 1})】${err}`);
        });
      }
    });
  }

  // ==========================================
  // Threadsのメディア制限検証
  // ==========================================
  if (platforms.threads) {
    // 1. 合計添付数制限 (カルーセル上限10件)
    if (images.length > 10) {
      warnings.push(
        `【Threadsカルーセル注意】Threadsの1投稿あたりの上限は10件です。11件目以降はスレッド（返信）へ自動分割されます。`
      );
    }

    // 2. 各動画の詳細仕様
    videoItems.forEach((v, idx) => {
      const detail = validateVideoMetadata(
        { name: v.name, size: v.size, type: v.mimeType },
        { duration: v.duration, width: v.width, height: v.height, mimeType: v.mimeType }
      );
      if (!detail.canPostThreads) {
        detail.threadsErrors.forEach((err) => {
          errors.push(`【Threads動画仕様エラー (動画 #${idx + 1})】${err}`);
        });
      }
      detail.warnings.forEach((warn) => {
        warnings.push(`【Threads動画注意 (動画 #${idx + 1})】${warn}`);
      });
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export interface VideoAttachmentCheckResult {
  canAttach: boolean;
  errors: string[];
  warnings: string[];
  details: VideoValidationDetail;
}

/**
 * 動画添付時に公式仕様（Bluesky / Threads）の制限を即時検証
 * - Threads: 動画と画像の同時混在添付（最大10件）を許可
 * - Bluesky単体: 動画と画像の同時混在添付は禁止、動画は1本のみ
 */
export function checkVideoAttachmentEligibility(
  file: { name?: string; size: number; type?: string },
  meta: { duration?: number; width?: number; height?: number; mimeType?: string },
  targetPlatforms: { postToBluesky?: boolean; postToThreads?: boolean },
  currentImages: AttachedImage[]
): VideoAttachmentCheckResult {
  const detail = validateVideoMetadata(file, meta);
  const errors: string[] = [];
  const warnings: string[] = [...detail.warnings];

  const targetBluesky = Boolean(targetPlatforms.postToBluesky);
  const targetThreads = Boolean(targetPlatforms.postToThreads);

  // 1. 各プラットフォームの動画フォーマット・容量・再生時間チェック
  if (targetBluesky && !targetThreads && !detail.canPostBluesky) {
    detail.blueskyErrors.forEach((err) => {
      errors.push(`【Bluesky公式仕様制限】${err}`);
    });
  } else if (targetThreads && !targetBluesky && !detail.canPostThreads) {
    detail.threadsErrors.forEach((err) => {
      errors.push(`【Threads公式仕様制限】${err}`);
    });
  } else if (!detail.canPostBluesky && !detail.canPostThreads) {
    // どちらの仕様も満たさない場合
    const allErrors = Array.from(new Set([...detail.blueskyErrors, ...detail.threadsErrors]));
    allErrors.forEach((err) => {
      errors.push(`【動画仕様制限】${err}`);
    });
  }

  // 2. 既存メディアとの混在・動画本数チェック
  const existingVideos = currentImages.filter(
    (img) => img.mediaType === 'video' || img.mimeType?.startsWith('video/')
  );
  const existingImages = currentImages.filter(
    (img) => img.mediaType !== 'video' && !img.mimeType?.startsWith('video/')
  );

  // Threadsが有効な場合: カルーセル投稿（画像・動画の混在可能、合計最大10件）を認める
  if (targetThreads) {
    const maxItems = MEDIA_SPECS.threads.image.maxImagesPerPost;
    const totalCount = currentImages.length + 1;
    if (totalCount > maxItems) {
      errors.push(
        `【Threads公式仕様制限】Threadsのカルーセル投稿は画像・動画合わせて最大${maxItems}件までです。`
      );
    }
    // Blueskyも同時に選択されている場合は警告（ブロックはしない）
    if (targetBluesky && existingImages.length > 0) {
      warnings.push(
        '💡 Blueskyへ同時投稿する場合、動画と画像はそれぞれ別のスレッド（返信）ポストへ自動分割して投稿されます。'
      );
    }
  } else if (targetBluesky && !targetThreads) {
    // Bluesky単体投稿時: 混在時や複数動画時は次のポスト（リプライ）へ自動分割
    if (existingVideos.length >= 1) {
      warnings.push(
        '💡 Blueskyは1投稿につき動画1本のため、2本目以降の動画は次のポスト（リプライ）へ自動分割して投稿されます。'
      );
    }
    if (existingImages.length > 0) {
      warnings.push(
        '💡 Blueskyは1つの投稿に動画と画像を混在できないため、2つ目のコンテンツは次のポスト（リプライ）へ自動分割して投稿されます。'
      );
    }
  }

  return {
    canAttach: errors.length === 0,
    errors,
    warnings,
    details: detail,
  };
}

export interface PostMediaCounts {
  imageCount: number;
  videoCount: number;
  totalCount: number;
}

/**
 * 投稿または履歴アイテムから、画像枚数と動画本数を正確に分離して算出
 */
export function getPostMediaCounts(item?: {
  images?: any[];
  attachedImages?: AttachedImage[];
  imageCount?: number;
  videoCount?: number;
}): PostMediaCounts {
  if (!item) {
    return { imageCount: 0, videoCount: 0, totalCount: 0 };
  }

  // 明示的な集計値が定義されている場合
  if (typeof item.imageCount === 'number' && typeof item.videoCount === 'number') {
    return {
      imageCount: Math.max(0, item.imageCount),
      videoCount: Math.max(0, item.videoCount),
      totalCount: Math.max(0, item.imageCount + item.videoCount),
    };
  }

  let imageCount = 0;
  let videoCount = 0;

  // 1. attachedImages の詳細メタデータから判定
  if (item.attachedImages && Array.isArray(item.attachedImages) && item.attachedImages.length > 0) {
    for (const media of item.attachedImages) {
      const isVideo =
        media.mediaType === 'video' ||
        (typeof media.mimeType === 'string' && media.mimeType.startsWith('video/')) ||
        (typeof media.name === 'string' && /\.(mp4|mov|webm|m4v|mkv|avi|3gp)$/i.test(media.name)) ||
        (typeof media.dataUrl === 'string' && media.dataUrl.startsWith('data:video/')) ||
        Boolean(media.thumbnailUrl && typeof media.duration === 'number');

      if (isVideo) {
        videoCount++;
      } else {
        imageCount++;
      }
    }
  } else if (item.images && Array.isArray(item.images) && item.images.length > 0) {
    // 2. images 配列からのフォールバック判定
    for (const media of item.images) {
      if (typeof media === 'object' && media !== null) {
        const isVideo =
          media.mediaType === 'video' ||
          (typeof media.mimeType === 'string' && media.mimeType.startsWith('video/')) ||
          (typeof media.name === 'string' && /\.(mp4|mov|webm|m4v|mkv|avi|3gp)$/i.test(media.name)) ||
          (typeof media.dataUrl === 'string' && media.dataUrl.startsWith('data:video/'));

        if (isVideo) {
          videoCount++;
        } else {
          imageCount++;
        }
      } else if (typeof media === 'string') {
        const str = media.trim();
        const isVideo =
          str.startsWith('data:video/') ||
          str.startsWith('video_') ||
          /\.(mp4|mov|webm|m4v|mkv|avi|3gp)$/i.test(str);

        if (isVideo) {
          videoCount++;
        } else {
          imageCount++;
        }
      }
    }
  }

  return {
    imageCount,
    videoCount,
    totalCount: imageCount + videoCount,
  };
}

