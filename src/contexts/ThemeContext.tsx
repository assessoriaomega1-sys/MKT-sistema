import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'dark' | 'light';

export interface AccentColorPreset {
  id: string;
  name: string;
  hexDark: string;
  hexLight: string;
}

export const ACCENT_COLOR_PRESETS: AccentColorPreset[] = [
  {
    id: 'mint',
    name: 'Verde Menta',
    hexDark: '#00D9A3',
    hexLight: '#0D9488'
  },
  {
    id: 'blue',
    name: 'Azul Tech',
    hexDark: '#38BDF8',
    hexLight: '#0284C7'
  },
  {
    id: 'purple',
    name: 'Roxo Royal',
    hexDark: '#A855F7',
    hexLight: '#7C3AED'
  },
  {
    id: 'amber',
    name: 'Âmbar / Ouro',
    hexDark: '#FBBF24',
    hexLight: '#D97706'
  },
  {
    id: 'coral',
    name: 'Coral Neon',
    hexDark: '#FB7185',
    hexLight: '#E11D48'
  },
  {
    id: 'cyan',
    name: 'Ciano Vibrante',
    hexDark: '#22D3EE',
    hexLight: '#0891B2'
  },
  {
    id: 'emerald',
    name: 'Esmeralda',
    hexDark: '#34D399',
    hexLight: '#059669'
  }
];

interface ThemeContextType {
  theme: ThemeMode;
  accentColorId: string;
  currentPreset: AccentColorPreset;
  presets: AccentColorPreset[];
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  setAccentColor: (presetId: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('mkt_theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return 'dark';
  });

  const [accentColorId, setAccentColorId] = useState<string>(() => {
    const saved = localStorage.getItem('mkt_accent_color');
    return saved || 'mint';
  });

  const currentPreset = ACCENT_COLOR_PRESETS.find(p => p.id === accentColorId) || ACCENT_COLOR_PRESETS[0];

  // Apply theme and color to document
  useEffect(() => {
    // 1. Toggle light class
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('mkt_theme', theme);

    // 2. Apply dynamic accent color CSS variable
    const targetHex = theme === 'light' ? currentPreset.hexLight : currentPreset.hexDark;
    document.documentElement.style.setProperty('--accent-mint', targetHex);
    localStorage.setItem('mkt_accent_color', currentPreset.id);
  }, [theme, currentPreset]);

  const toggleTheme = () => {
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
  };

  const setAccentColor = (presetId: string) => {
    const found = ACCENT_COLOR_PRESETS.find(p => p.id === presetId);
    if (found) {
      setAccentColorId(found.id);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        accentColorId,
        currentPreset,
        presets: ACCENT_COLOR_PRESETS,
        toggleTheme,
        setTheme,
        setAccentColor
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
