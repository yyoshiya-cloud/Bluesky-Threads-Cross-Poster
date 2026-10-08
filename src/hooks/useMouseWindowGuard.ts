import { useState } from 'react';

/**
 * ウインドウガード用フック（マウス入力イベントを不当に阻害しない安全な状態保持）
 */
export function useMouseWindowGuard() {
  const [isCursorOutside] = useState(false);
  return isCursorOutside;
}
