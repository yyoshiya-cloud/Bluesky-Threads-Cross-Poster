import React, { useEffect, useState, useRef } from 'react';
import { Copy, Scissors, Clipboard, CheckSquare, Trash2, RotateCw, Settings as SettingsIcon } from 'lucide-react';

interface ContextMenuPosition {
  x: number;
  y: number;
}

interface TargetInfo {
  isEditable: boolean;
  hasSelection: boolean;
  selectedText: string;
  element: HTMLElement | null;
}

/**
 * Pythonデスクトップアプリ（Windows / pywebview）環境専用の右クリックコンテキストメニュー
 * ※ 通常のWebブラウザ環境では完全に無効化され、ブラウザ本来の右クリックメニューを邪魔しません。
 */
export const DesktopContextMenu: React.FC<{
  onOpenSettings?: () => void;
}> = ({ onOpenSettings }) => {
  const [isDesktopMode, setIsDesktopMode] = useState<boolean>(() => {
    return Boolean(
      (window as any).__IS_PYTHON_DESKTOP__ ||
      (window as any).pywebview ||
      navigator.userAgent.includes('pywebview')
    );
  });

  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<ContextMenuPosition>({ x: 0, y: 0 });
  const [targetInfo, setTargetInfo] = useState<TargetInfo>({
    isEditable: false,
    hasSelection: false,
    selectedText: '',
    element: null,
  });

  const menuRef = useRef<HTMLDivElement>(null);

  // デスクトップ環境の判定（pywebview または PythonローカルAPI）
  useEffect(() => {
    if (isDesktopMode) return;

    // ヘルスチェックAPIでPythonデスクトップサーバー環境かどうかを確認
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.mode === 'python_desktop') {
          setIsDesktopMode(true);
        }
      })
      .catch(() => {
        // Web環境では何もしない
      });
  }, [isDesktopMode]);

  // デスクトップ環境のみコンテキストメニューのリスナーを登録
  useEffect(() => {
    if (!isDesktopMode) {
      return; // Webブラウザでは一切動作させない
    }

    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const isInput =
        target.tagName === 'INPUT' &&
        (target as HTMLInputElement).type !== 'button' &&
        (target as HTMLInputElement).type !== 'submit';
      const isTextarea = target.tagName === 'TEXTAREA';
      const isContentEditable = target.isContentEditable;
      const isEditable = isInput || isTextarea || isContentEditable;

      let selectedText = '';
      if (isInput || isTextarea) {
        const inputElem = target as HTMLInputElement | HTMLTextAreaElement;
        const start = inputElem.selectionStart || 0;
        const end = inputElem.selectionEnd || 0;
        if (end > start) {
          selectedText = inputElem.value.substring(start, end);
        }
      } else {
        selectedText = window.getSelection()?.toString() || '';
      }

      const hasSelection = selectedText.length > 0;

      // 画面端からはみ出さないように座標を計算
      const menuWidth = 220;
      const menuHeight = isEditable ? 260 : 160;
      const posX = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
      const posY = Math.min(e.clientY, window.innerHeight - menuHeight - 10);

      setTargetInfo({
        isEditable,
        hasSelection,
        selectedText,
        element: target,
      });

      setPosition({ x: Math.max(10, posX), y: Math.max(10, posY) });
      setIsOpen(true);
      e.preventDefault(); // デスクトップアプリ時のみデフォルトを抑制してカスタムメニューを表示
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDesktopMode]);

  // Web環境またはメニューが閉じている場合はレンダリングしない
  if (!isDesktopMode || !isOpen) return null;

  const handleCut = async () => {
    setIsOpen(false);
    const elem = targetInfo.element as HTMLInputElement | HTMLTextAreaElement | null;
    if (elem && (elem.tagName === 'INPUT' || elem.tagName === 'TEXTAREA')) {
      const start = elem.selectionStart || 0;
      const end = elem.selectionEnd || 0;
      if (end > start) {
        const cutText = elem.value.substring(start, end);
        try {
          await navigator.clipboard.writeText(cutText);
        } catch {
          try {
            await fetch('/api/clipboard/write', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: cutText }),
            });
          } catch {
            document.execCommand('copy');
          }
        }
        elem.value = elem.value.substring(0, start) + elem.value.substring(end);
        elem.selectionStart = elem.selectionEnd = start;
        elem.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else {
      document.execCommand('cut');
    }
  };

  const handleCopy = async () => {
    setIsOpen(false);
    if (targetInfo.selectedText) {
      try {
        await navigator.clipboard.writeText(targetInfo.selectedText);
      } catch {
        try {
          await fetch('/api/clipboard/write', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: targetInfo.selectedText }),
          });
        } catch {
          document.execCommand('copy');
        }
      }
    } else {
      document.execCommand('copy');
    }
  };

  const handlePaste = async () => {
    setIsOpen(false);
    let pasteText = '';
    try {
      pasteText = await navigator.clipboard.readText();
    } catch {
      // Python デスクトップ用クリップボードAPIフォールバック
      try {
        const res = await fetch('/api/clipboard/read');
        const data = await res.json();
        pasteText = data.text || '';
      } catch {
        // ignore
      }
    }

    if (!pasteText) {
      document.execCommand('paste');
      return;
    }

    const elem = targetInfo.element as HTMLInputElement | HTMLTextAreaElement | null;
    if (elem && (elem.tagName === 'INPUT' || elem.tagName === 'TEXTAREA')) {
      elem.focus();
      const start = elem.selectionStart || 0;
      const end = elem.selectionEnd || 0;
      const val = elem.value;
      elem.value = val.substring(0, start) + pasteText + val.substring(end);
      elem.selectionStart = elem.selectionEnd = start + pasteText.length;
      elem.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      document.execCommand('insertText', false, pasteText);
    }
  };

  const handleSelectAll = () => {
    setIsOpen(false);
    const elem = targetInfo.element as HTMLInputElement | HTMLTextAreaElement | null;
    if (elem && (elem.tagName === 'INPUT' || elem.tagName === 'TEXTAREA')) {
      elem.focus();
      elem.select();
    } else {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(document.body);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  };

  const handleDelete = () => {
    setIsOpen(false);
    const elem = targetInfo.element as HTMLInputElement | HTMLTextAreaElement | null;
    if (elem && (elem.tagName === 'INPUT' || elem.tagName === 'TEXTAREA')) {
      const start = elem.selectionStart || 0;
      const end = elem.selectionEnd || 0;
      if (end > start) {
        elem.value = elem.value.substring(0, start) + elem.value.substring(end);
        elem.selectionStart = elem.selectionEnd = start;
        elem.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  };

  const handleReload = () => {
    setIsOpen(false);
    window.location.reload();
  };

  return (
    <div
      ref={menuRef}
      style={{
        top: `${position.y}px`,
        left: `${position.x}px`,
      }}
      className="fixed z-9999 min-w-[200px] bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl shadow-black/80 py-1.5 text-xs text-slate-200 select-none animate-in fade-in zoom-in-95 duration-100"
    >
      {targetInfo.isEditable ? (
        <>
          <button
            type="button"
            onClick={handleCut}
            disabled={!targetInfo.hasSelection}
            className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-sky-600/30 hover:text-white disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-slate-200 transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <Scissors className="w-3.5 h-3.5 text-sky-400" />
              <span>切り取り</span>
            </div>
            <span className="text-[10px] text-slate-400">Ctrl+X</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            disabled={!targetInfo.hasSelection}
            className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-sky-600/30 hover:text-white disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-slate-200 transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <Copy className="w-3.5 h-3.5 text-sky-400" />
              <span>コピー</span>
            </div>
            <span className="text-[10px] text-slate-400">Ctrl+C</span>
          </button>

          <button
            type="button"
            onClick={handlePaste}
            className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-sky-600/30 hover:text-white transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <Clipboard className="w-3.5 h-3.5 text-sky-400" />
              <span>貼り付け</span>
            </div>
            <span className="text-[10px] text-slate-400">Ctrl+V</span>
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={!targetInfo.hasSelection}
            className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-sky-600/30 hover:text-white disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-slate-200 transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>削除</span>
            </div>
            <span className="text-[10px] text-slate-400">Del</span>
          </button>

          <div className="h-px bg-slate-800 my-1" />

          <button
            type="button"
            onClick={handleSelectAll}
            className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-sky-600/30 hover:text-white transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
              <span>すべて選択</span>
            </div>
            <span className="text-[10px] text-slate-400">Ctrl+A</span>
          </button>
        </>
      ) : targetInfo.hasSelection ? (
        <>
          <button
            type="button"
            onClick={handleCopy}
            className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-sky-600/30 hover:text-white transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <Copy className="w-3.5 h-3.5 text-sky-400" />
              <span>コピー</span>
            </div>
            <span className="text-[10px] text-slate-400">Ctrl+C</span>
          </button>

          <button
            type="button"
            onClick={handleSelectAll}
            className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-sky-600/30 hover:text-white transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
              <span>すべて選択</span>
            </div>
            <span className="text-[10px] text-slate-400">Ctrl+A</span>
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={handleSelectAll}
            className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-sky-600/30 hover:text-white transition cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
              <span>すべて選択</span>
            </div>
            <span className="text-[10px] text-slate-400">Ctrl+A</span>
          </button>
        </>
      )}

      <div className="h-px bg-slate-800 my-1" />

      <button
        type="button"
        onClick={handleReload}
        className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-sky-600/30 hover:text-white transition cursor-pointer text-left"
      >
        <div className="flex items-center gap-2">
          <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
          <span>最新の状態に更新</span>
        </div>
        <span className="text-[10px] text-slate-400">F5</span>
      </button>

      {onOpenSettings && (
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            onOpenSettings();
          }}
          className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-sky-600/30 hover:text-white transition cursor-pointer text-left"
        >
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-3.5 h-3.5 text-slate-400" />
            <span>設定を開く</span>
          </div>
        </button>
      )}
    </div>
  );
};
