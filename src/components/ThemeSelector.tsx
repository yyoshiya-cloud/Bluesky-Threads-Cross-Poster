import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Palette, Check, Sparkles, X as CloseIcon } from 'lucide-react';
import { ThemeAccentId } from '../types';
import { THEME_ACCENTS, getThemeAccentConfig } from '../utils/themeManager';

interface ThemeSelectorProps {
  currentTheme: ThemeAccentId;
  onSelectTheme: (themeId: ThemeAccentId) => void;
  variant?: 'header-dropdown' | 'settings-grid';
  disabled?: boolean;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  currentTheme,
  onSelectTheme,
  variant = 'header-dropdown',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const currentConfig = getThemeAccentConfig(currentTheme);

  // モーダルが開いている時に Escape キーまたは disabled 遷移で閉じる
  useEffect(() => {
    if (disabled && isOpen) {
      setIsOpen(false);
      return;
    }
    if (!isOpen || variant !== 'header-dropdown') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, variant, disabled]);

  // 設定画面向けのグリッド表示
  if (variant === 'settings-grid') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Palette className="w-4 h-4 text-accent-light" />
            <span>ダークテーマ・アクセントカラー</span>
          </label>
          <span className="text-[11px] font-medium text-accent-light px-2 py-0.5 rounded-md badge-accent">
            現在: {currentConfig.nameJa}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {THEME_ACCENTS.map((theme) => {
            const isSelected = theme.id === currentTheme;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => onSelectTheme(theme.id)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition relative cursor-pointer group overflow-hidden ${
                  isSelected
                    ? 'bg-slate-900/90 border-slate-600 shadow-md shadow-black/40 ring-2'
                    : 'bg-slate-950/60 hover:bg-slate-900/50 border-slate-800/80 hover:border-slate-700'
                }`}
                style={{
                  borderColor: isSelected ? theme.lightColor : undefined,
                  boxShadow: isSelected ? `0 0 0 2px ${theme.primaryColor}` : undefined,
                }}
              >
                {/* カラードット＆プレビュー */}
                <div
                  className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center shadow-inner border border-white/20 transition-transform group-hover:scale-105"
                  style={{
                    background: theme.gradient,
                    boxShadow: `0 2px 10px ${theme.glowColor}`,
                  }}
                >
                  {isSelected && <Check className="w-4 h-4 text-white drop-shadow" />}
                </div>

                <div className="flex-1 min-w-0 leading-tight">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-200 whitespace-nowrap">{theme.name}</p>
                    <span className="text-[10px] text-slate-500 shrink-0 font-medium whitespace-nowrap">{theme.category}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 whitespace-nowrap mt-0.5">{theme.nameJa}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ヘッダー用ボタン & 他のヘッダーボタン押下時と同様のモーダルウィンドウ表示
  return (
    <>
      <button
        id="header-theme-selector-button"
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(true)}
        className={`bg-slate-900 text-slate-300 px-2.5 py-1.5 rounded-lg border border-slate-800 flex items-center gap-1.5 transition text-xs font-medium select-none shadow-xs group whitespace-nowrap shrink-0 ${
          disabled
            ? 'opacity-40 cursor-not-allowed grayscale'
            : 'hover:bg-slate-800 hover:text-white hover:border-slate-700 cursor-pointer'
        }`}
        title={disabled ? '操作不可' : 'アクセントカラーの切り替え'}
      >
        <div
          className="w-4 h-4 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 shrink-0"
          style={{
            background: currentConfig.gradient,
            boxShadow: `0 0 8px ${currentConfig.glowColor}`,
          }}
        >
          <Palette className="w-2.5 h-2.5 text-white/90" />
        </div>
        <span className="hidden sm:inline">
          カラー
        </span>
      </button>

      {/* アクセントカラー選択画面（他のヘッダーボタン押下時と同様のモーダルウィンドウ表示） */}
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            id="theme-selector-modal-overlay"
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setIsOpen(false)}
          >
            <div
              id="theme-selector-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="theme-selector-modal-title"
              className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl shadow-black/80 overflow-hidden animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* ウインドウヘッダー（右上に閉じる ✕ ボタン） */}
              <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-800 bg-slate-950/80 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-white/20 shadow-sm flex items-center justify-center shrink-0"
                    style={{
                      background: currentConfig.gradient,
                      boxShadow: `0 2px 12px ${currentConfig.glowColor}`,
                    }}
                  >
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 id="theme-selector-modal-title" className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
                        アクセントカラー選択
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        ダークモード
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      現在のカラー: <strong className="text-slate-200">{currentConfig.name} ({currentConfig.nameJa})</strong>
                    </p>
                  </div>
                </div>

                <button
                  id="close-theme-selector-modal-button"
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 border border-transparent hover:border-slate-700/80 transition cursor-pointer flex items-center justify-center shrink-0"
                  title="閉じる (Esc)"
                  aria-label="閉じる"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>

              {/* カラー一覧ボディ */}
              <div className="p-4 sm:p-5 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {THEME_ACCENTS.map((theme) => {
                  const isSelected = theme.id === currentTheme;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => {
                        onSelectTheme(theme.id);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition cursor-pointer group ${
                        isSelected
                          ? 'bg-slate-800/90 border-slate-500 shadow-md shadow-black/40'
                          : 'bg-slate-950/60 hover:bg-slate-800/60 border-slate-800/80 hover:border-slate-700'
                      }`}
                      style={{
                        borderColor: isSelected ? theme.lightColor : undefined,
                        boxShadow: isSelected ? `0 0 0 1px ${theme.primaryColor}` : undefined,
                      }}
                    >
                      <div
                        className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center border border-white/20 transition-transform group-hover:scale-110 shadow-sm"
                        style={{
                          background: theme.gradient,
                          boxShadow: `0 2px 8px ${theme.glowColor}`,
                        }}
                      >
                        {isSelected && <Check className="w-4 h-4 text-white drop-shadow" />}
                      </div>

                      <div className="flex-1 min-w-0 leading-tight">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-slate-200 whitespace-nowrap">{theme.name}</span>
                          <span className="text-[10px] text-slate-400 shrink-0 font-medium">{theme.category}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 whitespace-nowrap mt-0.5">{theme.nameJa}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* フッター（折り返し無し whitespace-nowrap・閉じるボタン削除済み） */}
              <div className="px-4 sm:px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-center shrink-0">
                <span className="text-[11px] text-slate-400 whitespace-nowrap">
                  選択したアクセントカラーはブラウザに自動保存されます
                </span>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
