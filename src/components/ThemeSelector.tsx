import React, { useState, useRef, useEffect } from 'react';
import { Palette, Sun, Moon, Check, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from '../contexts/ThemeContext';

interface ThemeSelectorProps {
  compact?: boolean;
}

export function ThemeSelector({ compact = false }: ThemeSelectorProps) {
  const { theme, accentColorId, currentPreset, presets, toggleTheme, setTheme, setAccentColor } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const activeColor = theme === 'light' ? currentPreset.hexLight : currentPreset.hexDark;

  return (
    <div className="relative" ref={containerRef}>
      {/* Topbar Trigger Button */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer ${
          isOpen
            ? 'bg-white/10 border-accent-mint text-white shadow-md shadow-accent-mint/10'
            : 'bg-white/5 hover:bg-white/10 border-white/10 text-text-secondary hover:text-white'
        }`}
        title="Mudar Tema e Cores do Sistema"
        aria-label="Mudar Tema e Cores"
      >
        <div className="relative flex items-center justify-center">
          {theme === 'dark' ? (
            <Moon size={16} className="text-accent-mint transition-transform hover:rotate-12" />
          ) : (
            <Sun size={16} className="text-amber-500 transition-transform hover:rotate-45" />
          )}
          {/* Active Accent Color Dot */}
          <span
            className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-bg-base shadow-sm ring-1 ring-white/20"
            style={{ backgroundColor: activeColor }}
          />
        </div>

        {!compact && (
          <span className="text-xs font-semibold hidden md:inline flex items-center gap-1.5">
            <span>Tema</span>
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ backgroundColor: activeColor }}
            />
          </span>
        )}
      </button>

      {/* Floating Theme & Color Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl bg-bg-elevated/95 backdrop-blur-2xl border border-white/15 shadow-2xl p-4 z-50 space-y-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white">
                <Palette size={14} className="text-accent-mint" />
                <span>Personalizar Visual</span>
              </div>
              <span className="text-[11px] font-semibold text-accent-mint px-2 py-0.5 rounded-full bg-accent-mint/10 border border-accent-mint/20">
                {currentPreset.name}
              </span>
            </div>

            {/* Mode Switcher: Dark vs Light */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                Modo de Exibição
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    theme === 'dark'
                      ? 'bg-white/15 border-accent-mint text-white shadow-sm'
                      : 'bg-white/5 border-white/10 text-text-muted hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Moon size={14} className={theme === 'dark' ? 'text-accent-mint' : ''} />
                  <span>Escuro</span>
                  {theme === 'dark' && <Check size={12} className="text-accent-mint ml-1" />}
                </button>

                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    theme === 'light'
                      ? 'bg-white/15 border-accent-mint text-white shadow-sm'
                      : 'bg-white/5 border-white/10 text-text-muted hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Sun size={14} className={theme === 'light' ? 'text-amber-500' : ''} />
                  <span>Claro</span>
                  {theme === 'light' && <Check size={12} className="text-accent-mint ml-1" />}
                </button>
              </div>
            </div>

            {/* Accent Color Palette */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                  Cor de Destaque
                </label>
                <span className="text-[10px] text-text-muted">Aplica em todo o app</span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {presets.map(preset => {
                  const isSelected = preset.id === accentColorId;
                  const color = theme === 'light' ? preset.hexLight : preset.hexDark;

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setAccentColor(preset.id)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-xs text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-white/15 border-white/30 text-white shadow-sm font-semibold'
                          : 'bg-white/5 border-white/5 text-text-secondary hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 shadow-inner"
                        style={{ backgroundColor: color }}
                      >
                        {isSelected && <Check size={10} className="text-black stroke-[3]" />}
                      </span>
                      <span className="truncate">{preset.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer tip */}
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-text-muted">
              <span className="flex items-center gap-1">
                <Sparkles size={11} className="text-accent-mint" />
                Salvo automaticamente
              </span>
              <button
                type="button"
                onClick={toggleTheme}
                className="hover:text-white transition-colors cursor-pointer underline"
              >
                Alternar Rápido ({theme === 'dark' ? 'Sol' : 'Lua'})
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
