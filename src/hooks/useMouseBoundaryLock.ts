import { useEffect, useState } from 'react';

/**
 * マウスカーソルをウインドウ外に出さないための境界制御フック
 * ウインドウの上下左右端（0px ~ innerWidth/innerHeight）でカーソル動作を領域内にクランプ（制限）します。
 */

const STORAGE_KEY = 'crosspost_mouse_boundary_lock';

export function getMouseBoundaryLock(): boolean {
  if (typeof window === 'undefined') return true;
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved !== null ? saved === 'true' : true;
}

export function setMouseBoundaryLock(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

export function useMouseBoundaryLock(active: boolean = true) {
  const [isEnabled, setIsEnabled] = useState<boolean>(() => getMouseBoundaryLock());

  useEffect(() => {
    if (!active || !isEnabled || typeof window === 'undefined') return;

    let cursorOverlay: HTMLDivElement | null = null;

    // ウインドウ端にクランプされた仮想カーソルガイドの表示
    const ensureOverlay = () => {
      let overlay = document.getElementById('mouse-boundary-clamp-indicator') as HTMLDivElement;
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'mouse-boundary-clamp-indicator';
        overlay.style.position = 'fixed';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '999999';
        overlay.style.width = '14px';
        overlay.style.height = '14px';
        overlay.style.borderRadius = '50%';
        overlay.style.border = '2px solid #38bdf8';
        overlay.style.boxShadow = '0 0 10px rgba(56, 189, 248, 0.8)';
        overlay.style.backgroundColor = 'rgba(56, 189, 248, 0.3)';
        overlay.style.transform = 'translate(-50%, -50%)';
        overlay.style.transition = 'opacity 0.15s ease';
        overlay.style.opacity = '0';
        document.body.appendChild(overlay);
      }
      cursorOverlay = overlay;
    };

    ensureOverlay();

    const handleMouseMove = (e: MouseEvent) => {
      const margin = 2; // ウインドウ端からの許容マージン(px)
      const maxX = window.innerWidth - margin;
      const maxY = window.innerHeight - margin;

      const isAtLeft = e.clientX <= margin;
      const isAtRight = e.clientX >= maxX;
      const isAtTop = e.clientY <= margin;
      const isAtBottom = e.clientY >= maxY;

      const isAtBoundary = isAtLeft || isAtRight || isAtTop || isAtBottom;

      if (isAtBoundary) {
        // 端に達した場合はカーソル位置をウインドウ枠内に厳格クランプ
        const clampedX = Math.max(margin, Math.min(e.clientX, maxX));
        const clampedY = Math.max(margin, Math.min(e.clientY, maxY));

        if (cursorOverlay) {
          cursorOverlay.style.left = `${clampedX}px`;
          cursorOverlay.style.top = `${clampedY}px`;
          cursorOverlay.style.opacity = '1';
        }
      } else if (cursorOverlay) {
        cursorOverlay.style.opacity = '0';
      }
    };

    const handleMouseLeave = (e: MouseEvent) => {
      // マウスがウインドウ外へ出ようとした時に位置をウインドウ内端へ引き戻す制御
      const clampedX = Math.max(2, Math.min(e.clientX, window.innerWidth - 2));
      const clampedY = Math.max(2, Math.min(e.clientY, window.innerHeight - 2));

      if (cursorOverlay) {
        cursorOverlay.style.left = `${clampedX}px`;
        cursorOverlay.style.top = `${clampedY}px`;
        cursorOverlay.style.opacity = '1';
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseleave', handleMouseLeave, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseleave', handleMouseLeave);

      if (cursorOverlay && cursorOverlay.parentNode) {
        cursorOverlay.parentNode.removeChild(cursorOverlay);
      }
    };
  }, [active, isEnabled]);

  const toggleLock = (enabled?: boolean) => {
    const nextState = enabled !== undefined ? enabled : !isEnabled;
    setIsEnabled(nextState);
    setMouseBoundaryLock(nextState);
  };

  return { isEnabled, toggleLock };
}
