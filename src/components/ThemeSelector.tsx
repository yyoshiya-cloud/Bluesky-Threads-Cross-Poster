import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check, Sparkles } from 'lucide-react';
import { ThemeAccentId } from '../types';
import { THEME_ACCENTS, getThemeAccentConfig } from '../utils/themeManager';

interface ThemeSelectorProps {
  currentTheme: ThemeAccentId;
  onSelectTheme: (themeId: ThemeAccentId) => void;
  variant?: 'header-dropdown' | 'settings-grid';
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  currentTheme,
  onSelectTheme,
  variant = 'header-dropdown',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentConfig = getThemeAccentConfig(currentTheme);

  // ドロップダウンの外側クリックで閉じる
  useEffect(() => {
    if (variant !== 'header-dropdown') return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, variant]);

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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {THEME_ACCENTS.map((theme) => {
            const isSelected = theme.id === currentTheme;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => onSelectTheme(theme.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition relative cursor-pointer group ${
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
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-bold text-slate-200 truncate">{theme.name}</p>
                    <span className="text-[10px] text-slate-500 shrink-0 font-medium">{theme.category}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">{theme.nameJa}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ヘッダー用クイックドロップダウン表示
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        id="header-theme-selector-button"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="bg-[#0A0A0B] hover:bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 flex items-center gap-2 transition text-xs select-none cursor-pointer shadow-sm group"
        title="アクセントカラーのテーマ切り替え"
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
        <span className="text-[11px] text-slate-300 font-medium hidden sm:inline">
          テーマ
        </span>
      </button>

      {/* ドロップダウンメニュー */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <Sparkles className="w-3.5 h-3.5 text-accent-light" />
              <span>アクセントカラー選択</span>
            </div>
            <span className="text-[10px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800">
              ダークモード
            </span>
          </div>

          <div className="space-y-1.5 max-h-80 overflow-y-auto pr-0.5">
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
                  className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition cursor-pointer group ${
                    isSelected
                      ? 'bg-slate-800/90 border border-slate-600'
                      : 'hover:bg-slate-800/50 border border-transparent'
                  }`}
                >
                  <div
                    className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center border border-white/20 transition-transform group-hover:scale-110 shadow-sm"
                    style={{
                      background: theme.gradient,
                      boxShadow: `0 2px 8px ${theme.glowColor}`,
                    }}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-200">{theme.name}</span>
                      <span className="text-[10px] text-slate-400">{theme.category}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">{theme.nameJa}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[10px] text-slate-500 text-center">
            選択したアクセントカラーはブラウザに自動保存されます
          </div>
        </div>
      )}
    </div>
  );
};
