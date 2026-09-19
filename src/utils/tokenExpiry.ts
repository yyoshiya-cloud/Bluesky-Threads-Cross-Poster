/**
 * Threads Long-Lived Token 有効期限管理ユーティリティ
 */

export interface TokenExpiryInfo {
  expiresAt: number;
  remainingMs: number;
  remainingDays: number;
  remainingHours: number;
  status: 'valid' | 'warning' | 'expired' | 'unknown';
  formattedDate: string;
  formattedRelative: string;
  badgeColor: {
    bg: string;
    text: string;
    border: string;
    dot: string;
  };
}

/**
 * タイムスタンプから有効期限の詳細情報を算出
 * Long-Lived Token は通常 Meta 側で 60日間（5,184,000秒）有効
 */
export function calculateTokenExpiryInfo(expiresAt?: number): TokenExpiryInfo {
  if (!expiresAt || typeof expiresAt !== 'number' || isNaN(expiresAt)) {
    return {
      expiresAt: 0,
      remainingMs: 0,
      remainingDays: 0,
      remainingHours: 0,
      status: 'unknown',
      formattedDate: '未設定（接続時に自動設定）',
      formattedRelative: '期限不明',
      badgeColor: {
        bg: 'bg-slate-800/80',
        text: 'text-slate-400',
        border: 'border-slate-700',
        dot: 'bg-slate-500',
      },
    };
  }

  const now = Date.now();
  const remainingMs = expiresAt - now;
  const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
  const remainingDays = Math.floor(remainingMs / (1000 * 60 * 60 * 24));

  const dateObj = new Date(expiresAt);
  const formattedDate = dateObj.toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (remainingMs <= 0) {
    return {
      expiresAt,
      remainingMs,
      remainingDays: 0,
      remainingHours: 0,
      status: 'expired',
      formattedDate,
      formattedRelative: '⚠️ 有効期限切れ（自動更新不可・再ログインが必要）',
      badgeColor: {
        bg: 'bg-rose-950/60',
        text: 'text-rose-400',
        border: 'border-rose-800/60',
        dot: 'bg-rose-500 animate-pulse',
      },
    };
  }

  // 残り14日以下は警告イエロー/オレンジ
  if (remainingDays <= 14) {
    const timeLabel =
      remainingDays > 0
        ? `残り ${remainingDays} 日`
        : `残り ${remainingHours} 時間`;

    return {
      expiresAt,
      remainingMs,
      remainingDays,
      remainingHours,
      status: 'warning',
      formattedDate,
      formattedRelative: `⚠️ まもなく期限切れ (${timeLabel})`,
      badgeColor: {
        bg: 'bg-amber-950/60',
        text: 'text-amber-400',
        border: 'border-amber-800/60',
        dot: 'bg-amber-500 animate-pulse',
      },
    };
  }

  // 15日以上は安全グリーン
  return {
    expiresAt,
    remainingMs,
    remainingDays,
    remainingHours,
    status: 'valid',
    formattedDate,
    formattedRelative: `残り ${remainingDays} 日間有効`,
    badgeColor: {
      bg: 'bg-emerald-950/60',
      text: 'text-emerald-400',
      border: 'border-emerald-800/60',
      dot: 'bg-emerald-400',
    },
  };
}

/**
 * 最終更新日時のフォーマット
 */
export function formatRefreshedDate(refreshedAt?: number): string {
  if (!refreshedAt) return '未更新（初回取得）';
  return new Date(refreshedAt).toLocaleString('ja-JP', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
