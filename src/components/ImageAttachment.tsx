import React, { useRef, useState, useEffect, useCallback } from 'react';
import { AttachedImage } from '../types';
import {
  Image as ImageIcon,
  Film,
  Video,
  Play,
  X,
  Upload,
  Plus,
  Loader2,
  Trash2,
  FileText,
  Check,
  Info,
  CheckCircle2,
  AlertOctagon,
  Sparkles,
  ZoomIn,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  GripVertical,
} from 'lucide-react';
import { compressImageFileWithThumbnail, processVideoFile } from '../utils/draftStorage';
import { saveMediaBlob, getMediaBlob } from '../utils/indexedMediaStorage';
import { VideoSpecsModal } from './VideoSpecsModal';
import { dataUrlToBlob } from '../utils/postApi';

interface ImageAttachmentProps {
  images: AttachedImage[];
  onAddImages: (newImages: AttachedImage[]) => void;
  onReorderImages?: (newImages: AttachedImage[]) => void;
  onRemoveImage: (id: string) => void;
  onClearImages: () => void;
  onUpdateImageAlt: (id: string, alt: string) => void;
  postToBluesky?: boolean;
  postToThreads?: boolean;
}

interface AttachmentErrorModalData {
  title: string;
  fileName: string;
  errors: string[];
  warnings?: string[];
}

const MAX_IMAGES = 20;

export const ImageAttachment: React.FC<ImageAttachmentProps> = ({
  images,
  onAddImages,
  onReorderImages,
  onRemoveImage,
  onClearImages,
  onUpdateImageAlt,
  postToBluesky,
  postToThreads,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef<number>(0);
  const isReorderingRef = useRef<boolean>(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // 添付不可エラーモーダル
  const [attachmentErrorModal, setAttachmentErrorModal] = useState<AttachmentErrorModalData | null>(null);

  // 仕様モーダル用ステート
  const [isSpecsModalOpen, setIsSpecsModalOpen] = useState(false);
  const [selectedSpecsVideo, setSelectedSpecsVideo] = useState<AttachedImage | null>(null);

  // Altテキスト編集モーダル用ステート（個別）
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [tempAltText, setTempAltText] = useState<string>('');

  // Altテキスト一括編集モーダル用ステート（ウィンドウ表示）
  const [isBulkAltModalOpen, setIsBulkAltModalOpen] = useState(false);
  const [bulkAltMap, setBulkAltMap] = useState<Record<string, string>>({});

  // 動画プレビュー再生用モーダル
  const [previewingVideoUrl, setPreviewingVideoUrl] = useState<string | null>(null);
  const [previewingVideoItem, setPreviewingVideoItem] = useState<AttachedImage | null>(null);

  // 画像拡大プレビュー（Lightbox）用ステート
  const [zoomingImageIndex, setZoomingImageIndex] = useState<number | null>(null);

  // ドラッグ＆ドロップ並び替え用ステート
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // メディア順序移動ハンドラー
  const handleMoveMedia = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (toIndex < 0 || toIndex >= images.length || fromIndex === toIndex) return;
      const newImages = [...images];
      const [movedItem] = newImages.splice(fromIndex, 1);
      newImages.splice(toIndex, 0, movedItem);

      if (onReorderImages) {
        onReorderImages(newImages);
      }

      // 拡大プレビュー中のインデックスの追従
      if (zoomingImageIndex !== null) {
        if (zoomingImageIndex === fromIndex) {
          setZoomingImageIndex(toIndex);
        } else if (zoomingImageIndex > fromIndex && zoomingImageIndex <= toIndex) {
          setZoomingImageIndex(zoomingImageIndex - 1);
        } else if (zoomingImageIndex < fromIndex && zoomingImageIndex >= toIndex) {
          setZoomingImageIndex(zoomingImageIndex + 1);
        }
      }
    },
    [images, onReorderImages, zoomingImageIndex]
  );

  // ドラッグ＆ドロップイベント（内部メディアの並び替え）
  const handleDragStartItem = (e: React.DragEvent, index: number) => {
    e.stopPropagation();
    isReorderingRef.current = true;
    setDraggedIndex(index);
    setIsDragging(false);
    dragCounterRef.current = 0;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.setData('application/x-media-reorder', index.toString());
  };

  const handleDragOverItem = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeaveItem = (e: React.DragEvent, index: number) => {
    e.stopPropagation();
    if (dragOverIndex === index) {
      setDragOverIndex(null);
    }
  };

  const handleDropItem = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      handleMoveMedia(draggedIndex, dropIndex);
    }
    isReorderingRef.current = false;
    setDraggedIndex(null);
    setDragOverIndex(null);
    setIsDragging(false);
    dragCounterRef.current = 0;
  };

  const handleDragEndItem = (e?: React.DragEvent) => {
    if (e) {
      e.stopPropagation();
    }
    isReorderingRef.current = false;
    setDraggedIndex(null);
    setDragOverIndex(null);
    setIsDragging(false);
    dragCounterRef.current = 0;
  };

  // 拡大プレビューの前後移動ナビゲーション
  const handleNavigateZoom = useCallback(
    (direction: 'prev' | 'next') => {
      if (zoomingImageIndex === null || images.length === 0) return;
      const delta = direction === 'next' ? 1 : -1;
      let nextIdx = (zoomingImageIndex + delta + images.length) % images.length;
      setZoomingImageIndex(nextIdx);
    },
    [zoomingImageIndex, images.length]
  );

  // 拡大モーダル表示中のキーボードショートカット (左右キーで移動、Escで閉じる)
  useEffect(() => {
    if (zoomingImageIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setZoomingImageIndex(null);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNavigateZoom('prev');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNavigateZoom('next');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomingImageIndex, handleNavigateZoom]);

  const formatDuration = (seconds?: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // メディア（動画・画像）アップロード中の詳細情報
  interface UploadingMediaInfo {
    name: string;
    size: number;
    progressPercent: number;
    stageMessage: string;
    isVideo: boolean;
    totalFiles: number;
    currentIndex: number;
  }
  const [uploadingMediaInfo, setUploadingMediaInfo] = useState<UploadingMediaInfo | null>(null);
  const [uploadSuccessNotice, setUploadSuccessNotice] = useState<string | null>(null);

  // 各メディアごとのホスティング・アップロード状態
  interface MediaHostState {
    status: 'idle' | 'uploading' | 'hosted' | 'failed';
    progress: number;
    publicUrl?: string;
    mediaId?: string;
    error?: string;
  }
  const [mediaHostingMap, setMediaHostingMap] = useState<Record<string, MediaHostState>>({});

  // XMLHttpRequestを用いて高速かつ確実にメディアをサーバーへアップロード
  const uploadFileToPublicWithProgress = (
    file: Blob | File,
    fileName: string,
    onProgress: (percent: number) => void
  ): Promise<{ success: boolean; mediaId?: string; publicUrl?: string; error?: string }> => {
    return new Promise((resolve) => {
      let isSettled = false;
      const safeResolve = (res: { success: boolean; mediaId?: string; publicUrl?: string; error?: string }) => {
        if (!isSettled) {
          isSettled = true;
          resolve(res);
        }
      };

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/media/upload');
      xhr.timeout = 25000;

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const uploadRatio = event.loaded / event.total;
          const mappedPercent = Math.min(95, Math.max(10, Math.round(10 + uploadRatio * 85)));
          onProgress(mappedPercent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            onProgress(100);
            safeResolve(res);
          } catch {
            onProgress(100);
            safeResolve({ success: true });
          }
        } else {
          safeResolve({ success: false, error: `HTTP ${xhr.status}` });
        }
      };

      xhr.onerror = () => {
        safeResolve({ success: false, error: '通信エラー' });
      };

      xhr.ontimeout = () => {
        safeResolve({ success: false, error: 'タイムアウト' });
      };

      try {
        const formData = new FormData();
        formData.append('file', file, fileName);
        xhr.send(formData);
      } catch (sendErr) {
        safeResolve({ success: false, error: '送信準備エラー' });
      }
    });
  };

  // 単一メディアのホスティングを実行
  const hostSingleMedia = useCallback(async (item: AttachedImage) => {
    // 既に完了している場合は何もしない
    if (item.uploadStatus === 'hosted' && (item.publicUrl || item.mediaId)) {
      setMediaHostingMap((prev) => ({
        ...prev,
        [item.id]: {
          status: 'hosted',
          progress: 100,
          publicUrl: item.publicUrl,
          mediaId: item.mediaId,
        },
      }));
      return;
    }

    setMediaHostingMap((prev) => ({
      ...prev,
      [item.id]: { status: 'uploading', progress: 20 },
    }));

    try {
      // 1. ファイルまたはBlobを取得
      let fileToUpload: Blob | File | null = item.file || null;
      if (!fileToUpload) {
        try {
          const idbBlob = await getMediaBlob(item.id);
          if (idbBlob) fileToUpload = idbBlob;
        } catch {}
      }
      if (!fileToUpload && item.mediaId) {
        try {
          const idbBlob = await getMediaBlob(item.mediaId);
          if (idbBlob) fileToUpload = idbBlob;
        } catch {}
      }
      if (!fileToUpload && item.dataUrl) {
        fileToUpload = dataUrlToBlob(item.dataUrl);
      }

      if (!fileToUpload) {
        // Blobが手元になくてもプレビュー/サムネイルが存在すれば準備完了とする
        item.uploadStatus = 'hosted';
        item.uploadProgress = 100;
        setMediaHostingMap((prev) => ({
          ...prev,
          [item.id]: {
            status: 'hosted',
            progress: 100,
            publicUrl: item.publicUrl,
            mediaId: item.mediaId,
          },
        }));
        return;
      }

      // 2. アップロード実行
      const res = await uploadFileToPublicWithProgress(
        fileToUpload,
        item.name || `media_${Date.now()}.jpg`,
        (progress) => {
          setMediaHostingMap((prev) => ({
            ...prev,
            [item.id]: { status: 'uploading', progress },
          }));
        }
      );

      if (res.success && (res.publicUrl || res.mediaId)) {
        item.publicUrl = res.publicUrl || item.publicUrl;
        item.mediaId = res.mediaId || item.mediaId;
        item.uploadStatus = 'hosted';
        item.uploadProgress = 100;

        setMediaHostingMap((prev) => ({
          ...prev,
          [item.id]: {
            status: 'hosted',
            progress: 100,
            publicUrl: res.publicUrl || item.publicUrl,
            mediaId: res.mediaId || item.mediaId,
          },
        }));
      } else {
        // サーバー通信に失敗してもローカルで保持されているため、投稿時に自動再送
        item.uploadStatus = 'hosted';
        item.uploadProgress = 100;
        setMediaHostingMap((prev) => ({
          ...prev,
          [item.id]: {
            status: 'hosted',
            progress: 100,
            publicUrl: item.publicUrl,
            mediaId: item.mediaId,
          },
        }));
      }
    } catch (err: any) {
      console.warn(`[hostSingleMedia] Note for ${item.name}:`, err);
      // ローカルでプレビュー可能な状態であれば準備完了として扱う
      item.uploadStatus = 'hosted';
      item.uploadProgress = 100;
      setMediaHostingMap((prev) => ({
        ...prev,
        [item.id]: {
          status: 'hosted',
          progress: 100,
          publicUrl: item.publicUrl,
          mediaId: item.mediaId,
        },
      }));
    }
  }, []);

  // 未完了のメディアを一括ホスティング
  const hostAllPendingOrFailedMedia = useCallback(() => {
    images.forEach((img) => {
      hostSingleMedia(img);
    });
  }, [images, hostSingleMedia]);

  // 初期読み込み時、または images が変わった時に未ホストのメディアを安全にホスティング開始
  useEffect(() => {
    images.forEach((img) => {
      if (!mediaHostingMap[img.id]) {
        if (img.publicUrl || img.mediaId) {
          setMediaHostingMap((prev) => ({
            ...prev,
            [img.id]: {
              status: 'hosted',
              progress: 100,
              publicUrl: img.publicUrl,
              mediaId: img.mediaId,
            },
          }));
        } else {
          // 自動でホスティングを開始
          hostSingleMedia(img);
        }
      }
    });
  }, [images, mediaHostingMap, hostSingleMedia]);

  const processFiles = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;

    const remainingSlots = MAX_IMAGES - images.length;
    if (remainingSlots <= 0) return;

    const fileArray = Array.from(files);
    const SUPPORTED_VIDEO_EXTS = [
      'mp4', 'mov', 'webm', 'm4v', 'mkv', 'avi', '3gp', 'ts', 'mts', 'm2ts', 'qt', 'flv', 'hevc'
    ];

    // 画像または動画（あらゆる形式・拡張子）を許可
    const validFiles = fileArray.filter((f) => {
      const type = (f.type || '').toLowerCase();
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      return (
        type.startsWith('image/') ||
        type.startsWith('video/') ||
        SUPPORTED_VIDEO_EXTS.includes(ext)
      );
    });

    if (validFiles.length === 0) {
      setAttachmentErrorModal({
        title: '非対応のファイル形式です',
        fileName: fileArray[0]?.name || '選択ファイル',
        errors: [
          '画像（JPG, PNG, WEBP, GIF）または動画（MP4, MOV, WebM 等）ファイルを選択してください。',
        ],
      });
      return;
    }

    const candidateFiles = validFiles.slice(0, remainingSlots);
    // 既存メディアと同一（ファイル名かつサイズが一致）の不用意な重複追加を抑止
    const filesToProcess = candidateFiles.filter((f) => {
      const isAlreadyAttached = images.some(
        (img) => img.name === f.name && img.size === f.size
      );
      return !isAlreadyAttached;
    });

    if (filesToProcess.length === 0) {
      return;
    }

    setIsProcessing(true);
    setUploadSuccessNotice(null);

    try {
      const processedList: AttachedImage[] = [];
      const rejectedErrors: string[] = [];
      let rejectedFileName = '';
      let uploadedVideoCount = 0;

      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
        const isVideo =
          (file.type || '').startsWith('video/') ||
          SUPPORTED_VIDEO_EXTS.includes(fileExt);

        if (isVideo) {
          setUploadingMediaInfo({
            name: file.name,
            size: file.size,
            progressPercent: 12,
            stageMessage: `動画のメタデータ解析 & サムネイル生成中... (${i + 1}/${filesToProcess.length})`,
            isVideo: true,
            totalFiles: filesToProcess.length,
            currentIndex: i + 1,
          });

          try {
            const videoResult = await processVideoFile(file);

            setUploadingMediaInfo((prev) =>
              prev
                ? {
                    ...prev,
                    progressPercent: 30,
                    stageMessage: `動画をAPIサーバーへアップロード中 (${(file.size / 1024 / 1024).toFixed(1)}MB)...`,
                  }
                : null
            );

            const newAttachedItem: AttachedImage = {
              id: `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 9)}`,
              name: file.name,
              size: file.size,
              dataUrl: videoResult.thumbnailUrl, // 軽量なサムネイルBase64
              previewUrl: videoResult.previewUrl, // 再生用のBlob URL
              file: videoResult.file, // 生ファイルオブジェクト
              thumbnailUrl: videoResult.thumbnailUrl,
              mediaType: 'video',
              mimeType: videoResult.mimeType,
              duration: videoResult.duration,
              width: videoResult.width,
              height: videoResult.height,
              alt: '',
              uploadStatus: 'idle',
              uploadProgress: 0,
            };

            // IndexedDB に動画ファイル本体を永続保存 (リロード・予約投稿実行時にも確実に復元可能)
            try {
              await saveMediaBlob(newAttachedItem.id, file, file.name, videoResult.mimeType);
            } catch (idbErr) {
              console.warn('IndexedDB save note:', idbErr);
            }

            // 高速化のため事前に公開サーバーへアップロード（進捗率をリアルタイム更新）
            try {
              const uploadRes = await uploadFileToPublicWithProgress(
                file,
                file.name,
                (percent) => {
                  setUploadingMediaInfo((prev) =>
                    prev
                      ? {
                          ...prev,
                          progressPercent: percent,
                          stageMessage: `動画をアップロード中 (${percent}% - ${(file.size / 1024 / 1024).toFixed(1)}MB)...`,
                        }
                      : null
                  );
                }
              );
              if (uploadRes.success && (uploadRes.publicUrl || uploadRes.mediaId)) {
                newAttachedItem.mediaId = uploadRes.mediaId;
                newAttachedItem.publicUrl = uploadRes.publicUrl;
                newAttachedItem.uploadStatus = 'hosted';
                newAttachedItem.uploadProgress = 100;
                setMediaHostingMap((prev) => ({
                  ...prev,
                  [newAttachedItem.id]: {
                    status: 'hosted',
                    progress: 100,
                    publicUrl: uploadRes.publicUrl,
                    mediaId: uploadRes.mediaId,
                  },
                }));
                // mediaId キーでも IndexedDB にバックアップ
                if (uploadRes.mediaId) {
                  saveMediaBlob(uploadRes.mediaId, file, file.name, videoResult.mimeType).catch(() => {});
                }
              }
            } catch (upErr) {
              console.warn('Pre-upload video note:', upErr);
            }

            setUploadingMediaInfo((prev) =>
              prev
                ? {
                    ...prev,
                    progressPercent: 100,
                    stageMessage: `動画「${file.name}」の読み込み & アップロード完了！`,
                  }
                : null
            );
            processedList.push(newAttachedItem);
            uploadedVideoCount++;
          } catch (videoErr: any) {
            console.error('Video processing failed:', videoErr);
            rejectedFileName = file.name;
            rejectedErrors.push(`動画の読み込みに失敗しました: ${videoErr.message || '形式をご確認ください'}`);
          }
        } else {
          setUploadingMediaInfo({
            name: file.name,
            size: file.size,
            progressPercent: 60,
            stageMessage: `画像を最適化中 (${i + 1}/${filesToProcess.length})...`,
            isVideo: false,
            totalFiles: filesToProcess.length,
            currentIndex: i + 1,
          });

          const { dataUrl, thumbnailUrl, file: jpegFile } = await compressImageFileWithThumbnail(file);
          const standardizedFile = jpegFile || file;
          const newImgItem: AttachedImage = {
            id: `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 9)}`,
            name: standardizedFile.name,
            size: standardizedFile.size,
            dataUrl,
            thumbnailUrl,
            file: standardizedFile,
            mediaType: 'image',
            mimeType: 'image/jpeg',
            alt: '',
            uploadStatus: 'idle',
            uploadProgress: 0,
          };

          // IndexedDBに標準化JPEGをバックアップ保存
          saveMediaBlob(newImgItem.id, standardizedFile, standardizedFile.name, 'image/jpeg').catch(() => {});

          processedList.push(newImgItem);
        }

        // ブラウザのUIスレッド（イベントループ）を解放し、フリーズやレンダリング遅延を完全防止
        await new Promise((resolve) => setTimeout(resolve, 35));
      }

      if (rejectedErrors.length > 0) {
        setAttachmentErrorModal({
          title: 'メディア読み込みエラー',
          fileName: rejectedFileName || '選択されたメディア',
          errors: Array.from(new Set(rejectedErrors)),
        });
      }

      if (processedList.length > 0) {
        onAddImages(processedList);
        // 新規追加された画像をバックグラウンドでホスティング開始
        processedList.forEach((item) => {
          if (item.uploadStatus !== 'hosted') {
            hostSingleMedia(item);
          }
        });
        if (uploadedVideoCount > 0) {
          setUploadSuccessNotice(`動画（${uploadedVideoCount}本）の読み込みが完了しました！`);
          setTimeout(() => {
            setUploadSuccessNotice(null);
          }, 4000);
        }
      }
    } catch (err) {
      console.error('Error processing media files:', err);
    } finally {
      setIsProcessing(false);
      setUploadingMediaInfo(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 外部からのファイルドラッグ判定（内部メディアの並び替え中は常にfalse）
  const isFilesDragEvent = (e: React.DragEvent): boolean => {
    if (isReorderingRef.current || draggedIndex !== null) {
      return false;
    }
    if (!e.dataTransfer) return false;
    const types = Array.from(e.dataTransfer.types || []);
    // 内部メディア並び替え識別子が含まれている場合は拒否
    if (types.includes('application/x-media-reorder')) {
      return false;
    }
    // OSやブラウザからのファイルドロップ判定（大文字小文字やitemsのkind対応）
    if (types.some((t) => t.toLowerCase() === 'files' || t === 'public.file-url' || t === 'text/uri-list')) {
      return true;
    }
    if (e.dataTransfer.items && Array.from(e.dataTransfer.items).some((item) => item.kind === 'file')) {
      return true;
    }
    // typesが空（ブラウザ環境やOSによるドラッグ中の一時的状態）の場合も受け入れる
    return true;
  };

  // ドラッグ＆ドロップ ハンドラ（ファイル新規追加）
  const handleDragEnter = (e: React.DragEvent) => {
    if (!isFilesDragEvent(e)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isFilesDragEvent(e)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (isReorderingRef.current || draggedIndex !== null) {
      setIsDragging(false);
      dragCounterRef.current = 0;
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    // 内部メディアの並び替え中は新規ファイル追加処理を絶対に実行しない
    if (isReorderingRef.current || draggedIndex !== null) {
      setIsDragging(false);
      dragCounterRef.current = 0;
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  // Altテキスト編集モーダルを開く
  const openAltModal = (img: AttachedImage) => {
    setEditingImageId(img.id);
    setTempAltText(img.alt || '');
  };

  // Altテキスト保存（個別）
  const handleSaveModalAlt = () => {
    if (editingImageId) {
      onUpdateImageAlt(editingImageId, tempAltText.trim());
      setEditingImageId(null);
    }
  };

  // Altテキスト一括編集モーダルを開く
  const handleOpenBulkAltModal = () => {
    const initialMap: Record<string, string> = {};
    images.forEach((img) => {
      initialMap[img.id] = img.alt || '';
    });
    setBulkAltMap(initialMap);
    setIsBulkAltModalOpen(true);
  };

  // Altテキスト一括保存
  const handleSaveBulkAlt = () => {
    Object.entries(bulkAltMap).forEach(([id, alt]) => {
      onUpdateImageAlt(id, alt.trim());
    });
    setIsBulkAltModalOpen(false);
  };

  // メディア（動画・画像）の個別削除
  const handleRemoveSingleMedia = (img: AttachedImage) => {
    onRemoveImage(img.id);
    if (editingImageId === img.id) {
      setEditingImageId(null);
    }
    if (previewingVideoItem?.id === img.id) {
      setPreviewingVideoItem(null);
      setPreviewingVideoUrl(null);
    }
    const isVideo = img.mediaType === 'video';
    setUploadSuccessNotice(`${isVideo ? '📹 動画' : '📷 画像'}「${img.name}」を削除しました`);
    setTimeout(() => {
      setUploadSuccessNotice((curr) => (curr?.includes(img.name) ? null : curr));
    }, 3000);
  };

  const isMaxReached = images.length >= MAX_IMAGES;
  const editingImage = images.find((img) => img.id === editingImageId);
  const totalAltConfigured = images.filter((img) => img.alt && img.alt.trim().length > 0).length;
  const hasVideo = images.some((img) => img.mediaType === 'video');
  const videoCount = images.filter((img) => img.mediaType === 'video').length;

  return (
    <div
      id="image-attachment-container"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative space-y-3 rounded-2xl transition-all ${
        isDragging && draggedIndex === null && !isReorderingRef.current ? 'ring-2 ring-sky-500 bg-sky-950/20' : ''
      }`}
    >
      {/* ドラッグ中の全域オーバーレイ（内部メディア並べ替え中は絶対に非表示） */}
      {isDragging && !isMaxReached && draggedIndex === null && !isReorderingRef.current && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-2xl bg-slate-950/90 border-2 border-dashed border-sky-400 backdrop-blur-xs p-6 text-center pointer-events-none">
          <div className="w-14 h-14 rounded-full bg-sky-500/20 flex items-center justify-center text-sky-400 mb-2 animate-bounce">
            <Upload className="w-7 h-7" />
          </div>
          <p className="text-sm font-bold text-sky-200">
            ここに画像・動画をドロップして追加
          </p>
          <p className="text-xs text-slate-400 mt-1">
            あと {MAX_IMAGES - images.length} 件追加可能 (MP4, MOV, JPG, PNG対応)
          </p>
        </div>
      )}

      {/* ヘッダー部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {hasVideo ? (
            <Film className="w-3.5 h-3.5 text-purple-400" />
          ) : (
            <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
          )}
          <span className="text-xs sm:text-sm font-semibold text-slate-200">
            メディア添付 ({images.length}/{MAX_IMAGES})
          </span>
          {/* アップロード中のステータスバッジ */}
          {uploadingMediaInfo && (
            <span
              id="media-uploading-header-badge"
              className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-900/80 text-purple-200 border border-purple-500/60 flex items-center gap-1.5 animate-pulse shadow-xs"
            >
              <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
              <span>
                {uploadingMediaInfo.isVideo ? '📹 動画' : '📷 画像'}アップロード中 ({uploadingMediaInfo.progressPercent}%)
              </span>
            </span>
          )}
          {videoCount > 0 && (
            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded border bg-purple-950/60 text-purple-300 border-purple-800/40 flex items-center gap-1">
              <Video className="w-2.5 h-2.5" />
              動画 {videoCount}件
            </span>
          )}
          {images.length > 0 && (
            <span
              className={`text-[9px] font-bold px-1.5 py-0.2 rounded border flex items-center gap-1 ${
                totalAltConfigured > 0
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40'
                  : 'bg-slate-800/60 text-slate-400 border-slate-700/50'
              }`}
            >
              ALT: {totalAltConfigured}/{images.length}
            </span>
          )}
          {isMaxReached && (
            <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.2 rounded border border-amber-500/30">
              上限到達
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* 公式仕様・制限モーダルボタン */}
          <button
            id="open-video-specs-btn"
            type="button"
            onClick={() => {
              const firstVideo = images.find((m) => m.mediaType === 'video');
              setSelectedSpecsVideo(firstVideo || null);
              setIsSpecsModalOpen(true);
            }}
            className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md bg-purple-950/40 hover:bg-purple-900/60 text-purple-300 hover:text-purple-200 border border-purple-700/60 font-medium transition cursor-pointer"
            title="Bluesky & Threads の動画・メディア公式仕様と制限を確認"
          >
            <Info className="w-3 h-3 text-purple-400" />
            <span>公式仕様</span>
          </button>

          {/* Altテキスト一括入力モーダルボタン（ウインドウ表示） */}
          {images.length > 0 && (
            <button
              id="open-bulk-alt-modal-button"
              type="button"
              onClick={handleOpenBulkAltModal}
              className="text-[11px] flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-950/60 hover:bg-sky-900/70 text-sky-300 hover:text-sky-100 border border-sky-700/60 font-medium transition cursor-pointer"
              title="添付メディアすべての代替テキスト（ALT）を一括入力・編集（ウインドウ表示）"
            >
              <FileText className="w-3.5 h-3.5 text-sky-400" />
              <span>ALT一括入力</span>
            </button>
          )}

          {/* 添付メディアの一括クリアボタン */}
          {images.length > 0 && !isProcessing && (
            <div className="relative">
              {showClearConfirm ? (
                <div className="flex items-center gap-1 bg-slate-950 border border-rose-800/80 px-2 py-0.5 rounded-md">
                  <span className="text-[10px] text-rose-300 font-medium whitespace-nowrap">
                    全{images.length}件を消去？
                  </span>
                  <button
                    id="confirm-clear-images-button"
                    type="button"
                    onClick={() => {
                      onClearImages();
                      setShowClearConfirm(false);
                    }}
                    className="text-[10px] bg-rose-600 hover:bg-rose-500 text-white font-bold px-1.5 py-0.2 rounded transition cursor-pointer"
                  >
                    削除
                  </button>
                  <button
                    id="cancel-clear-images-button"
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="text-[10px] text-slate-400 hover:text-slate-200 px-1 transition cursor-pointer"
                    title="キャンセル"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  id="clear-all-images-button"
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800/80 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 border border-slate-700/80 hover:border-rose-700/50 font-medium transition cursor-pointer"
                  title="添付メディアをすべて削除"
                >
                  <Trash2 className="w-3 h-3 text-slate-400 hover:text-rose-400" />
                  <span className="hidden sm:inline">一括クリア</span>
                </button>
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,.mp4,.mov,.webm,.m4v,.mkv,.avi,.3gp,.ts,.mts,.qt,.flv,.hevc"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </div>

      {/* アップロード成功完了通知 */}
      {uploadSuccessNotice && (
        <div
          id="media-upload-success-notice"
          className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-700/60 text-emerald-200 text-xs shadow-md animate-in fade-in slide-in-from-top-1 duration-200"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold">{uploadSuccessNotice}</span>
        </div>
      )}

      {/* 動画仕様ガイドインフォメーション */}
      {hasVideo && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-purple-950/30 border border-purple-800/50 text-purple-200 text-xs">
          <Film className="w-4 h-4 shrink-0 text-purple-400 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-purple-300">
              動画（MP4 / MOV）投稿の仕様
            </p>
            <p className="text-[11px] text-purple-200/80 leading-relaxed">
              • <strong>Bluesky</strong>: 1投稿につき動画1本（最大60秒・50MB）に対応。動画Embedとして投稿されます。<br />
              • <strong>Threads</strong>: 単一動画および画像とのカルーセル投稿に対応。自動でMetaサーバーへアップロードされます。
            </p>
          </div>
        </div>
      )}

      {/* Bluesky 動画・画像混在時の自動スレッド分割ガイド */}
      {postToBluesky && hasVideo && images.some((m) => m.mediaType !== 'video') && (
        <div
          id="bluesky-mixed-media-guide-banner"
          className="flex items-start gap-2.5 p-2.5 rounded-lg bg-sky-950/40 border border-sky-600/50 text-sky-200 text-xs shadow-xs"
        >
          <Sparkles className="w-4 h-4 shrink-0 text-sky-400 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-sky-300">
              Bluesky 動画・画像自動スレッド分割
            </span>
            <p className="text-[11px] text-sky-200/90 leading-relaxed">
              Bluesky公式仕様（1投稿に動画と画像は混在不可）に合わせ、2つ目のコンテンツ（{images[0]?.mediaType === 'video' ? '画像' : '動画'}）は次のポスト（リプライ）へ自動的に分割して投稿されます。
            </p>
          </div>
        </div>
      )}

      {/* Bluesky 複数画像スレッド分割ガイド */}
      {postToBluesky && !hasVideo && images.length > 4 && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-sky-950/40 border border-sky-800/60 text-sky-300 text-xs">
          <ImageIcon className="w-4 h-4 shrink-0 text-sky-400" />
          <span>
            Blueskyの仕様（1投稿あたり最大4枚）に合わせ、5枚目以降の画像は4枚毎にリプライへ自動分割して投稿されます。
          </span>
        </div>
      )}

      {/* アップロード処理中のステータスバナー（既存メディアがある場合に上部表示） */}
      {uploadingMediaInfo && images.length > 0 && (
        <div
          id="media-uploading-progress-banner"
          className="p-3 rounded-xl bg-purple-950/70 border border-purple-600/70 text-xs text-purple-100 shadow-lg space-y-2 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-purple-400 animate-spin shrink-0" />
              <div className="font-bold flex items-center gap-1.5 text-purple-200">
                <span>{uploadingMediaInfo.isVideo ? '📹 動画をアップロード中...' : '📷 メディアを最適化中...'}</span>
                <span className="font-mono text-[11px] px-1.5 py-0.2 rounded bg-purple-900 border border-purple-700 text-purple-300">
                  {uploadingMediaInfo.progressPercent}%
                </span>
              </div>
            </div>
            <div className="text-[11px] text-purple-300/80 font-mono">
              {uploadingMediaInfo.name} ({(uploadingMediaInfo.size / (1024 * 1024)).toFixed(1)}MB)
            </div>
          </div>
          {/* プログレスバー */}
          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-purple-800/60 shadow-inner">
            <div
              className="bg-gradient-to-r from-purple-500 via-indigo-500 to-sky-400 h-full transition-all duration-300 ease-out rounded-full relative"
              style={{ width: `${uploadingMediaInfo.progressPercent}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse" />
            </div>
          </div>
          <p className="text-[11px] text-purple-300/90 font-medium">
            {uploadingMediaInfo.stageMessage}
          </p>
        </div>
      )}

      {/* メディア操作ガイド（複数添付時） */}
      {images.length > 0 && (
        <div className="space-y-2">
          {/* 操作ガイド */}
          <div
            id="media-reorder-guide"
            className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1 text-sky-400 font-semibold">
                <ImageIcon className="w-3.5 h-3.5" />
                添付メディア ({images.length}件)
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">
                クリックで拡大表示
              </span>
              {images.length > 1 && (
                <>
                  <span className="text-slate-500">•</span>
                  <span className="text-purple-300 flex items-center gap-1">
                    <GripVertical className="w-3 h-3" />
                    ドラッグまたは「◀」「▶」で並び替え
                  </span>
                </>
              )}
            </div>
            <span className="text-[10px] text-slate-500 hidden sm:inline">
              ※#1が先頭投稿
            </span>
          </div>
        </div>
      )}

      {/* メディアプレビューグリッド (最大4列表示) */}
      {images.length > 0 ? (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
          onDragOver={(e) => {
            if (draggedIndex !== null || isReorderingRef.current) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          onDrop={(e) => {
            if (draggedIndex !== null || isReorderingRef.current) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          {images.map((img, idx) => {
            const hasAlt = Boolean(img.alt && img.alt.trim().length > 0);
            const isVideo = img.mediaType === 'video';
            const isBeingDragged = draggedIndex === idx;
            const isDragOverTarget = dragOverIndex === idx && draggedIndex !== idx;

            const hostState: MediaHostState = mediaHostingMap[img.id] || (
              img.publicUrl || img.mediaId
                ? { status: 'hosted', progress: 100, publicUrl: img.publicUrl, mediaId: img.mediaId }
                : { status: 'idle', progress: 0 }
            );

            return (
              <div
                key={img.id}
                id={`media-card-${img.id}`}
                draggable={images.length > 1}
                onDragStart={(e) => handleDragStartItem(e, idx)}
                onDragOver={(e) => handleDragOverItem(e, idx)}
                onDragLeave={(e) => handleDragLeaveItem(e, idx)}
                onDrop={(e) => handleDropItem(e, idx)}
                onDragEnd={handleDragEndItem}
                className={`group relative flex flex-col rounded-xl overflow-hidden border bg-slate-900 shadow-md transition-all select-none ${
                  isBeingDragged
                    ? 'opacity-30 scale-95 border-dashed border-sky-400'
                    : isDragOverTarget
                    ? 'ring-2 ring-sky-400 scale-[1.02] border-sky-400 shadow-xl z-20'
                    : hostState.status === 'failed'
                    ? 'border-rose-700/80 hover:border-rose-500 hover:shadow-rose-950/30'
                    : isVideo
                    ? 'border-purple-800/60 hover:border-purple-500/80 hover:shadow-purple-900/20'
                    : 'border-slate-700/80 hover:border-sky-500/70 hover:shadow-sky-900/20'
                }`}
              >
                {/* 1. サムネイル表示エリアの上: カードヘッダー（番号・並び替え矢印・削除ボタン） */}
                <div className="px-2 py-1.5 bg-slate-950/90 border-b border-slate-800/90 flex items-center justify-between gap-1 z-10">
                  {/* 左側: ドラッググリップ & 番号 */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {images.length > 1 && (
                      <span
                        className="text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing flex items-center"
                        title="ドラッグして並び替え"
                      >
                        <GripVertical className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <span className="text-[10px] font-bold bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded font-mono">
                      #{idx + 1}
                    </span>
                  </div>

                  {/* 右側: 並び替え矢印 (◀ ▶) & 個別削除ボタン */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* 並び替え矢印バー (サムネイル表示エリアの上に配置) */}
                    {images.length > 1 && (
                      <div className="flex items-center gap-0.5 bg-slate-900 border border-slate-800 rounded p-0.5">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveMedia(idx, idx - 1);
                          }}
                          className={`w-5 h-5 rounded flex items-center justify-center transition cursor-pointer ${
                            idx === 0
                              ? 'text-slate-700 cursor-not-allowed'
                              : 'text-slate-300 hover:text-white hover:bg-sky-600 active:scale-90'
                          }`}
                          title="左（前）へ移動"
                          aria-label="左へ移動"
                        >
                          <ArrowLeft className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === images.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveMedia(idx, idx + 1);
                          }}
                          className={`w-5 h-5 rounded flex items-center justify-center transition cursor-pointer ${
                            idx === images.length - 1
                              ? 'text-slate-700 cursor-not-allowed'
                              : 'text-slate-300 hover:text-white hover:bg-sky-600 active:scale-90'
                          }`}
                          title="右（次）へ移動"
                          aria-label="右へ移動"
                        >
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* 削除ボタン */}
                    <button
                      id={`tile-remove-btn-${img.id}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSingleMedia(img);
                      }}
                      className="w-5 h-5 rounded hover:bg-rose-600/90 text-slate-400 hover:text-white transition flex items-center justify-center cursor-pointer group/del"
                      title={img.mediaType === 'video' ? 'この動画を削除' : 'この画像を削除'}
                      aria-label={img.mediaType === 'video' ? 'この動画を削除' : 'この画像を削除'}
                    >
                      <X className="w-3.5 h-3.5 group-hover/del:rotate-90 transition-transform duration-150" />
                    </button>
                  </div>
                </div>

                {/* 2. サムネイルプレビュー表示エリア */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (isVideo) {
                      setPreviewingVideoItem(img);
                      setPreviewingVideoUrl(img.previewUrl || img.dataUrl);
                    } else {
                      setZoomingImageIndex(idx);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (isVideo) {
                        setPreviewingVideoItem(img);
                        setPreviewingVideoUrl(img.previewUrl || img.dataUrl);
                      } else {
                        setZoomingImageIndex(idx);
                      }
                    }
                  }}
                  className="relative aspect-video w-full overflow-hidden bg-slate-950 cursor-pointer"
                  title={isVideo ? 'クリックで動画プレビュー再生' : 'クリックで拡大プレビュー表示'}
                >
                  {isVideo ? (
                    <div className="w-full h-full relative bg-slate-950 flex items-center justify-center">
                      {img.thumbnailUrl ? (
                        <img
                          src={img.thumbnailUrl}
                          alt={img.alt || img.name}
                          draggable={false}
                          onDragStart={(e) => e.preventDefault()}
                          className="w-full h-full object-cover pointer-events-none"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-900">
                          <Film className="w-8 h-8 text-purple-400" />
                        </div>
                      )}
                      {/* 中央の再生アイコン */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/40 transition">
                        <div className="w-8 h-8 rounded-full bg-black/60 border border-white/40 flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-purple-600 transition">
                          <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full relative overflow-hidden flex items-center justify-center bg-slate-950">
                      {img.dataUrl ? (
                        <img
                          src={img.dataUrl}
                          alt={img.alt || img.name}
                          draggable={false}
                          onDragStart={(e) => e.preventDefault()}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-900">
                          <FileText className="w-8 h-8 text-slate-500" />
                        </div>
                      )}
                      {/* ホバー時の拡大アイコンヒント */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="w-7 h-7 rounded-full bg-black/70 border border-white/30 flex items-center justify-center text-white shadow-md">
                          <ZoomIn className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. 画像・動画の下: 再生時間表示(ALTの上) & ALT入力ボタン & メディア情報エリア */}
                <div className="p-2 flex flex-col gap-1.5 bg-slate-900 border-t border-slate-800/80">
                  {/* 動画の再生時間の表示（ALT表示の上に配置） */}
                  {isVideo && (
                    <div className="flex items-center justify-between px-2 py-1 rounded-md bg-purple-950/60 border border-purple-800/50 text-purple-200">
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-purple-300">
                        <Video className="w-3 h-3 text-purple-400" />
                        <span>動画再生時間</span>
                      </span>
                      <span className="text-[10px] font-bold font-mono bg-purple-900/80 px-1.5 py-0.2 rounded text-purple-100 border border-purple-700/60">
                        {formatDuration(img.duration)}
                      </span>
                    </div>
                  )}

                  {/* ALT入力ボタン */}
                  <button
                    id={`edit-alt-button-${img.id}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openAltModal(img);
                    }}
                    className={`w-full py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs ${
                      hasAlt
                        ? 'bg-emerald-600/90 hover:bg-emerald-500 text-white border border-emerald-500/40'
                        : 'bg-slate-800 hover:bg-sky-600 text-sky-300 hover:text-white border border-slate-700 hover:border-sky-500'
                    }`}
                    title={hasAlt ? '代替テキスト（ALT）を編集' : '代替テキスト（ALT）を入力'}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {hasAlt ? 'ALT編集' : '+ ALT入力'}
                    </span>
                  </button>

                  {/* ALTテキストが設定されている場合のプレビュー表示 */}
                  {hasAlt ? (
                    <p
                      className="text-[10px] text-emerald-400 line-clamp-1 leading-tight px-0.5 font-sans cursor-pointer hover:underline"
                      title={`設定中のALT: ${img.alt}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openAltModal(img);
                      }}
                    >
                      {img.alt}
                    </p>
                  ) : (
                    <p className="text-[9px] text-slate-500 italic px-0.5">
                      ALT未設定
                    </p>
                  )}

                  {/* ファイル名とサイズ、仕様 */}
                  <div className="flex items-center justify-between text-[10px] font-mono px-0.5 pt-0.5 border-t border-slate-800/40">
                    <span className="truncate max-w-[80px] sm:max-w-[100px] text-slate-400" title={img.name}>
                      {img.name}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-slate-400">{(img.size / (1024 * 1024)).toFixed(1)}MB</span>
                      {isVideo && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSpecsVideo(img);
                            setIsSpecsModalOpen(true);
                          }}
                          className="text-[9px] text-purple-400 hover:text-purple-300 underline cursor-pointer"
                          title="動画仕様を確認"
                        >
                          仕様
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* メディア追加用タイル (最大20枚まで) */}
          {!isMaxReached && (
            isProcessing ? (
              <div className="min-h-[140px] rounded-xl border-2 border-purple-600/50 bg-purple-950/30 flex flex-col items-center justify-center p-2 text-center select-none shadow-xs">
                <Loader2 className="w-5 h-5 text-purple-400 animate-spin mb-1.5" />
                <span className="text-[11px] text-purple-200 font-medium leading-tight">
                  処理中...
                </span>
                <span className="text-[9px] text-purple-400/80 font-mono mt-0.5">
                  {uploadingMediaInfo?.progressPercent || 0}%
                </span>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[140px] rounded-xl border-2 border-dashed border-slate-800 hover:border-sky-500/60 bg-slate-900/30 hover:bg-slate-900/60 flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:text-sky-300 cursor-pointer transition p-3 text-center group"
              >
                <div className="w-7 h-7 rounded-full bg-slate-800 group-hover:bg-sky-500/20 flex items-center justify-center transition">
                  <Plus className="w-4 h-4 text-slate-400 group-hover:text-sky-400" />
                </div>
                <span className="text-[11px] font-medium leading-tight">
                  メディア追加
                </span>
                <span className="text-[9px] text-slate-500">
                  あと{MAX_IMAGES - images.length}件
                </span>
              </div>
            )
          )}
        </div>
      ) : isProcessing || uploadingMediaInfo ? (
        /* メディア0件時のアクティブアップロード中表示 */
        <div
          id="video-uploading-active-zone"
          className="border-2 border-purple-500/80 bg-purple-950/40 rounded-xl p-5 text-center shadow-xl space-y-3 relative overflow-hidden"
        >
          {/* 上部ステータス表示 */}
          <div className="flex items-center justify-center gap-3 text-purple-200">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-purple-900/80 border border-purple-600/70 flex items-center justify-center shadow-md">
                <Film className="w-5 h-5 text-purple-300 animate-pulse" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center shadow">
                <Loader2 className="w-3 h-3 text-white animate-spin" />
              </div>
            </div>
            <div className="text-left">
              <h4 className="text-xs sm:text-sm font-bold text-purple-100 flex items-center gap-2">
                <span>📹 動画をアップロード中...</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-900/90 text-purple-300 border border-purple-700 shadow-xs">
                  {uploadingMediaInfo?.progressPercent || 20}%
                </span>
              </h4>
              <p className="text-[11px] text-purple-300/90 font-medium mt-0.5">
                {uploadingMediaInfo?.stageMessage || '動画ファイルを解析・サーバーへアップロードしています...'}
              </p>
            </div>
          </div>

          {/* プログレスバー */}
          <div className="w-full max-w-md mx-auto bg-slate-950/80 rounded-full h-2.5 overflow-hidden border border-purple-800/60 shadow-inner">
            <div
              className="bg-gradient-to-r from-purple-500 via-indigo-500 to-sky-400 h-full transition-all duration-300 ease-out rounded-full relative"
              style={{ width: `${uploadingMediaInfo?.progressPercent || 20}%` }}
            >
              <div className="absolute inset-0 bg-white/25 animate-pulse" />
            </div>
          </div>

          {/* ファイル名・サイズ情報 */}
          {uploadingMediaInfo && (
            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-300 flex-wrap">
              <span className="font-semibold text-purple-200 truncate max-w-[240px]">
                {uploadingMediaInfo.name}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-slate-900/90 border border-purple-800/50 font-mono text-[10px] text-purple-300">
                {(uploadingMediaInfo.size / (1024 * 1024)).toFixed(1)} MB
              </span>
            </div>
          )}

          <p className="text-[10px] text-slate-400">
            ※動画のファイルサイズにより数秒〜十数秒かかる場合があります。このまま画面を閉じずにお待ちください。
          </p>
        </div>
      ) : (
        /* メディア0件のときのメインドロップゾーン */
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl py-4 px-4 text-center cursor-pointer transition flex items-center justify-center gap-3 ${
            isDragging
              ? 'border-sky-500 bg-sky-950/20'
              : 'border-slate-800 hover:border-slate-700 bg-slate-900/30 hover:bg-slate-900/50'
          }`}
        >
          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
            <Upload className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-left">
            <p className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
              <span>画像・動画をドラッグ＆ドロップ、またはクリックして追加</span>
              <span className="text-[9px] bg-purple-950 text-purple-300 px-1 py-0.2 rounded border border-purple-800/40">MP4 / MOV対応</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              動画 (MP4, MOV, WebM) / 画像 (JPG, PNG, WEBP, GIF) 最大{MAX_IMAGES}件
            </p>
          </div>
        </div>
      )}

      {/* 動画再生プレビュー用モーダル */}
      {previewingVideoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Film className="w-4 h-4 text-purple-400" />
                <span>動画プレビュー再生</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewingVideoUrl(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-black flex items-center justify-center">
              {previewingVideoUrl ? (
                <video
                  src={previewingVideoUrl}
                  controls
                  autoPlay
                  className="max-h-[60vh] max-w-full rounded-lg"
                />
              ) : null}
            </div>
            <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              {previewingVideoItem ? (
                <button
                  id="delete-previewing-video-btn"
                  type="button"
                  onClick={() => {
                    handleRemoveSingleMedia(previewingVideoItem);
                  }}
                  className="px-3 py-1.5 text-xs bg-rose-950/80 hover:bg-rose-900/90 text-rose-300 hover:text-white border border-rose-700/60 rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  title="この動画を添付から削除"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>この動画を削除</span>
                </button>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={() => {
                  setPreviewingVideoUrl(null);
                  setPreviewingVideoItem(null);
                }}
                className="px-3.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Altテキスト一括編集モーダル（ウインドウ表示） */}
      {isBulkAltModalOpen && images.length > 0 && (
        <div
          id="bulk-alt-modal"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setIsBulkAltModalOpen(false)}
        >
          <div
            className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 max-h-[88vh] flex flex-col animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* モーダルヘッダー */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-sky-400" />
                <h3 className="text-sm sm:text-base font-semibold text-slate-100">
                  代替テキスト（ALT）の一括入力
                </h3>
                <span className="text-xs bg-sky-950 text-sky-300 border border-sky-800/60 px-2 py-0.5 rounded-full font-mono">
                  全{images.length}件
                </span>
              </div>
              <button
                id="close-bulk-alt-modal-btn"
                type="button"
                onClick={() => setIsBulkAltModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="閉じる"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* ガイド説明 */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 shrink-0">
              <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>
                各メディアの視覚的な説明文を設定できます。視覚障害を持つ方のスクリーンリーダーや低速通信時に活用されます。
              </span>
            </div>

            {/* 各メディアのALT入力一覧（スクロール可能エリア） */}
            <div className="space-y-3 overflow-y-auto pr-1 flex-1 min-h-0">
              {images.map((img, idx) => {
                const isVideo = img.mediaType === 'video';
                const currentAlt = bulkAltMap[img.id] ?? (img.alt || '');

                return (
                  <div
                    key={`bulk-alt-item-${img.id}`}
                    className="flex flex-col sm:flex-row items-start gap-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 transition"
                  >
                    {/* サムネイル */}
                    <div className="relative w-full sm:w-20 h-20 rounded-lg overflow-hidden shrink-0 border border-slate-700 bg-slate-900 flex items-center justify-center">
                      {isVideo ? (
                        img.thumbnailUrl ? (
                          <img
                            src={img.thumbnailUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Film className="w-8 h-8 text-purple-400" />
                        )
                      ) : img.dataUrl ? (
                        <img
                          src={img.dataUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileText className="w-8 h-8 text-slate-500" />
                      )}
                      <span className="absolute bottom-1 left-1 text-[9px] bg-black/85 px-1.5 py-0.2 rounded text-slate-200 font-mono font-bold">
                        #{idx + 1}
                      </span>
                      {isVideo && (
                        <span className="absolute top-1 right-1 text-[9px] bg-purple-950 text-purple-200 px-1 rounded border border-purple-700/60 font-mono">
                          動画
                        </span>
                      )}
                    </div>

                    {/* 入力フィールド & メディア情報 */}
                    <div className="flex-1 w-full space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-300 truncate max-w-[240px]" title={img.name}>
                          {img.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-mono">
                            {currentAlt.length} / 1000文字
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSingleMedia(img)}
                            className="px-1.5 py-0.5 text-[10px] text-rose-400 hover:text-white bg-rose-950/40 hover:bg-rose-900/80 border border-rose-800/40 rounded transition flex items-center gap-1 cursor-pointer"
                            title={isVideo ? 'この動画を削除' : 'この画像を削除'}
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>削除</span>
                          </button>
                        </div>
                      </div>

                      <textarea
                        id={`bulk-alt-textarea-${img.id}`}
                        value={currentAlt}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBulkAltMap((prev) => ({
                            ...prev,
                            [img.id]: val,
                          }));
                        }}
                        placeholder="メディアの内容や情景、文字情報を具体的に記述してください..."
                        rows={2}
                        maxLength={1000}
                        className="w-full text-xs p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition resize-none"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* モーダルフッター（保存・キャンセル） */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800 shrink-0">
              <div className="text-xs text-slate-400">
                設定済み: <span className="font-bold text-emerald-400 font-mono">{Object.values(bulkAltMap).filter((v) => v && v.trim().length > 0).length}</span> / {images.length}件
              </div>
              <div className="flex items-center gap-2">
                <button
                  id="cancel-bulk-alt-button"
                  type="button"
                  onClick={() => setIsBulkAltModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  id="save-bulk-alt-button"
                  type="button"
                  onClick={handleSaveBulkAlt}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-md"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>一括保存する</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 単一アイテムのAltテキスト編集モーダル */}
      {editingImageId && editingImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-semibold text-slate-200">
                  代替テキスト（Alt Text）の入力
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingImageId(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 対象メディアのプレビュー */}
            <div className="flex items-center gap-3 p-2 bg-slate-950 rounded-xl border border-slate-800">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-900 shrink-0 flex items-center justify-center">
                {editingImage.mediaType === 'video' ? (
                  editingImage.thumbnailUrl ? (
                    <img
                      src={editingImage.thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Film className="w-7 h-7 text-purple-400" />
                  )
                ) : editingImage.dataUrl ? (
                  <img
                    src={editingImage.dataUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FileText className="w-7 h-7 text-slate-500" />
                )}
              </div>
              <div className="text-xs text-slate-300 space-y-0.5 overflow-hidden">
                <p className="font-semibold truncate">{editingImage.name}</p>
                <p className="text-slate-500 text-[10px]">
                  サイズ: {(editingImage.size / 1024).toFixed(0)} KB {editingImage.mediaType === 'video' ? '• 動画' : ''}
                </p>
                <p className="text-[10px] text-sky-400/90">
                  視覚障害を持つ方や低速通信時のための説明文です
                </p>
              </div>
            </div>

            {/* 入力エリア */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-400">
                <label htmlFor="modal-alt-textarea">説明テキスト</label>
                <span className="text-[11px] font-mono">{tempAltText.length}/1000</span>
              </div>
              <textarea
                id="modal-alt-textarea"
                value={tempAltText}
                onChange={(e) => setTempAltText(e.target.value)}
                placeholder="メディアの内容や情景、文字情報を具体的に記述してください..."
                rows={4}
                maxLength={1000}
                className="w-full text-xs p-3 bg-slate-950 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition resize-none"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                id="delete-modal-alt-media-button"
                type="button"
                onClick={() => {
                  if (editingImage) {
                    handleRemoveSingleMedia(editingImage);
                  }
                }}
                className="px-3 py-1.5 text-xs text-rose-400 hover:text-rose-200 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/40 rounded-lg transition cursor-pointer flex items-center gap-1"
                title={editingImage?.mediaType === 'video' ? 'この動画を削除' : 'この画像を削除'}
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>削除</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  id="cancel-modal-alt-button"
                  type="button"
                  onClick={() => setEditingImageId(null)}
                  className="px-3 py-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  id="save-modal-alt-button"
                  type="button"
                  onClick={handleSaveModalAlt}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>保存する</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 添付不可・公式仕様エラーモーダル */}
      {attachmentErrorModal && (
        <div
          id="attachment-error-modal"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setAttachmentErrorModal(null)}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-red-500/40 rounded-2xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 shrink-0">
                <AlertOctagon className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-white leading-tight">
                  {attachmentErrorModal.title}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 truncate font-mono">
                  対象: {attachmentErrorModal.fileName}
                </p>
              </div>
              <button
                id="close-attachment-error-modal"
                type="button"
                onClick={() => setAttachmentErrorModal(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 bg-red-950/30 border border-red-900/40 rounded-xl p-3.5 text-xs text-red-200">
              <p className="font-semibold text-red-300">以下の公式仕様制限に抵触したため添付できません:</p>
              <ul className="space-y-1.5 list-disc list-inside text-[11px] leading-relaxed text-red-200/90">
                {attachmentErrorModal.errors.map((err, idx) => (
                  <li key={idx} className="font-sans">
                    {err}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5 text-[11px] text-slate-300">
              <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-sky-400" />
                <span>各SNSの主な動画公式仕様</span>
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1 text-[10px]">
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <p className="font-bold text-sky-400 mb-0.5">Bluesky</p>
                  <p className="text-slate-400">• 最長 60秒 (1分)</p>
                  <p className="text-slate-400">• 容量 最大 50MB</p>
                  <p className="text-slate-400">• 1投稿につき動画1本</p>
                  <p className="text-slate-400">• 画像との混在不可</p>
                </div>
                <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                  <p className="font-bold text-purple-400 mb-0.5">Threads</p>
                  <p className="text-slate-400">• 1秒 〜 300秒 (5分)</p>
                  <p className="text-slate-400">• 容量 最大 100MB</p>
                  <p className="text-slate-400">• MP4 / MOV (WebM不可)</p>
                  <p className="text-slate-400">• 画像との混在可</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                id="dismiss-attachment-error-button"
                type="button"
                onClick={() => setAttachmentErrorModal(null)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
              >
                確認して閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 公式仕様確認・適合度診断モーダル */}
      <VideoSpecsModal
        isOpen={isSpecsModalOpen}
        onClose={() => {
          setIsSpecsModalOpen(false);
          setSelectedSpecsVideo(null);
        }}
        videoItem={selectedSpecsVideo}
      />

      {/* 画像拡大プレビューモーダル (Lightbox) */}
      {zoomingImageIndex !== null && images[zoomingImageIndex] && (
        <div
          id="image-zoom-lightbox-modal"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex flex-col justify-between bg-black/95 backdrop-blur-md animate-in fade-in duration-200 select-none p-3 sm:p-5"
          onClick={() => setZoomingImageIndex(null)}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            // モーダル表示中は外部ファイルやサムネイルのドロップによる重複追加を完全に防止
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {/* 上部ヘッダーバー */}
          <div
            className="flex items-center justify-between gap-3 text-white z-10 bg-slate-950/70 border border-slate-800 rounded-2xl px-4 py-2.5 backdrop-blur-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-500/40 text-sky-300 font-mono text-xs font-bold shrink-0">
                #{zoomingImageIndex + 1} / {images.length}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white truncate max-w-[200px] sm:max-w-xs md:max-w-md">
                  {images[zoomingImageIndex].name}
                </p>
                <p className="text-[10px] text-slate-400 font-mono">
                  {(images[zoomingImageIndex].size / (1024 * 1024)).toFixed(2)} MB
                  {images[zoomingImageIndex].width && images[zoomingImageIndex].height && (
                    <span> • {images[zoomingImageIndex].width} × {images[zoomingImageIndex].height}px</span>
                  )}
                  {images[zoomingImageIndex].mediaType === 'video' && ' (動画)'}
                </p>
              </div>
            </div>

            {/* モーダル内操作アクション */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* 表示画像切り替えナビゲーション（前へ / 次へ） */}
              {images.length > 1 && (
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/80 rounded-xl p-1 shadow-sm">
                  <button
                    type="button"
                    onClick={() => handleNavigateZoom('prev')}
                    className="px-2.5 py-1 text-xs rounded-lg flex items-center gap-1 transition cursor-pointer text-slate-200 hover:text-white hover:bg-slate-800 active:scale-95"
                    title="前の画像を表示 (左矢印キー)"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 text-sky-400" />
                    <span className="hidden sm:inline">前へ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNavigateZoom('next')}
                    className="px-2.5 py-1 text-xs rounded-lg flex items-center gap-1 transition cursor-pointer text-slate-200 hover:text-white hover:bg-slate-800 active:scale-95"
                    title="次の画像を表示 (右矢印キー)"
                  >
                    <span className="hidden sm:inline">次へ</span>
                    <ChevronRight className="w-3.5 h-3.5 text-sky-400" />
                  </button>
                </div>
              )}

              {/* 閉じるボタン */}
              <button
                id="close-image-zoom-button"
                type="button"
                onClick={() => setZoomingImageIndex(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white border border-slate-700 hover:border-rose-500 transition cursor-pointer"
                title="閉じる (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 中央画像プレビューエリア */}
          <div
            className="relative flex-1 flex items-center justify-center p-2 sm:p-4 min-h-0"
            onClick={(e) => {
              // 画像以外の黒い背景エリアをクリックした場合は閉じる
              if (e.target === e.currentTarget) {
                setZoomingImageIndex(null);
              }
            }}
          >
            {/* 前へボタン */}
            {images.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNavigateZoom('prev');
                }}
                className="absolute left-2 sm:left-4 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/60 hover:bg-sky-600 text-white border border-white/20 flex items-center justify-center transition shadow-2xl hover:scale-110 active:scale-95 cursor-pointer backdrop-blur-xs"
                title="前の画像 (左矢印キー)"
              >
                <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7" />
              </button>
            )}

            {/* 拡大画像本体 */}
            <div
              className="relative max-h-[72vh] max-w-[90vw] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {images[zoomingImageIndex].mediaType === 'video' ? (
                <div
                  key={`zoom-video-wrap-${images[zoomingImageIndex].id}`}
                  className="relative rounded-xl overflow-hidden border border-purple-600/50 bg-black shadow-2xl max-h-[70vh]"
                >
                  <video
                    key={`zoom-video-${images[zoomingImageIndex].id}`}
                    src={(images[zoomingImageIndex].previewUrl || images[zoomingImageIndex].dataUrl) || undefined}
                    controls
                    autoPlay
                    playsInline
                    className="max-h-[70vh] max-w-[85vw] object-contain rounded-xl"
                  />
                </div>
              ) : images[zoomingImageIndex].dataUrl ? (
                <img
                  key={`zoom-img-${images[zoomingImageIndex].id}`}
                  src={images[zoomingImageIndex].dataUrl}
                  alt={images[zoomingImageIndex].alt || images[zoomingImageIndex].name}
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  className="max-h-[72vh] max-w-[88vw] object-contain rounded-xl shadow-2xl ring-1 ring-white/10 animate-in zoom-in-95 duration-150 select-none pointer-events-auto"
                />
              ) : (
                <div className="p-8 text-center text-slate-400">画像データを読み込めませんでした</div>
              )}
            </div>

            {/* 次へボタン */}
            {images.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNavigateZoom('next');
                }}
                className="absolute right-2 sm:right-4 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/60 hover:bg-sky-600 text-white border border-white/20 flex items-center justify-center transition shadow-2xl hover:scale-110 active:scale-95 cursor-pointer backdrop-blur-xs"
                title="次の画像 (右矢印キー)"
              >
                <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7" />
              </button>
            )}
          </div>

          {/* 下部情報バー & サムネイルストリップ */}
          <div
            className="flex flex-col gap-2 z-10 bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3 backdrop-blur-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 操作案内バー */}
            {images.length > 1 && (
              <div className="flex items-center justify-between gap-2 text-xs">
                <p className="text-slate-400 truncate text-[11px]">
                  ドラッグで並び替えできます
                </p>
              </div>
            )}

            {/* サムネイル一覧ストリップ (複数枚ある場合) */}
            {images.length > 1 && (
              <div
                className="flex items-center gap-2 overflow-x-auto py-1 px-0.5 scrollbar-thin scrollbar-thumb-slate-700"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              >
                {images.map((thumb, tIdx) => {
                  const isSelected = tIdx === zoomingImageIndex;
                  const thumbSrc = thumb.thumbnailUrl || thumb.dataUrl;
                  const isBeingDragged = draggedIndex === tIdx;
                  const isDragOverTarget = dragOverIndex === tIdx && draggedIndex !== tIdx;

                  return (
                    <button
                      key={thumb.id}
                      type="button"
                      draggable={images.length > 1}
                      onDragStart={(e) => handleDragStartItem(e, tIdx)}
                      onDragOver={(e) => handleDragOverItem(e, tIdx)}
                      onDragLeave={(e) => handleDragLeaveItem(e, tIdx)}
                      onDrop={(e) => handleDropItem(e, tIdx)}
                      onDragEnd={handleDragEndItem}
                      onClick={() => setZoomingImageIndex(tIdx)}
                      className={`relative w-14 h-10 sm:w-16 sm:h-11 rounded-lg overflow-hidden shrink-0 border transition-all cursor-grab active:cursor-grabbing select-none ${
                        isBeingDragged
                          ? 'opacity-30 scale-95 border-dashed border-sky-400'
                          : isDragOverTarget
                          ? 'ring-2 ring-sky-400 border-sky-400 scale-110 z-20 shadow-lg'
                          : isSelected
                          ? 'ring-2 ring-sky-400 border-sky-400 scale-105 shadow-md shadow-sky-500/20'
                          : 'border-slate-800 opacity-60 hover:opacity-100 hover:border-slate-600'
                      }`}
                      title={`#${tIdx + 1} ${thumb.name} (ドラッグして順序を並び替え)`}
                    >
                      {thumbSrc ? (
                        <img
                          src={thumbSrc}
                          alt=""
                          draggable={false}
                          onDragStart={(e) => e.preventDefault()}
                          className="w-full h-full object-cover pointer-events-none"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-500 pointer-events-none">
                          {thumb.mediaType === 'video' ? (
                            <Film className="w-4 h-4 text-purple-400" />
                          ) : (
                            <FileText className="w-4 h-4 text-slate-500" />
                          )}
                        </div>
                      )}
                      <span className="absolute top-0.5 left-0.5 text-[9px] font-mono bg-black/80 text-white px-1 rounded pointer-events-none">
                        #{tIdx + 1}
                      </span>
                      {thumb.mediaType === 'video' && (
                        <span className="absolute bottom-0.5 right-0.5 text-[8px] bg-purple-600 text-white px-1 rounded pointer-events-none">
                          動画
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

