import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = 'drillforge_theme_mode';

export type ThemeMode = 'dark' | 'light';

export type Colors = typeof darkColors;

export const darkColors = {
  // Core backgrounds
  background: '#151823',
  card: '#1e2433',
  cardHover: '#252a3a',

  // Text
  foreground: '#e8eaed',
  mutedForeground: '#8b919e',

  // Primary (green)
  primary: '#4a9d6e',
  primaryForeground: '#ffffff',
  primaryLight: 'rgba(74, 157, 110, 0.1)',

  // Accent
  accent: '#d4a641',
  accentForeground: '#151823',

  // Border
  border: '#2a3142',

  // Destructive
  destructive: '#dc2626',

  // Category colors
  categoryColors: {
    passing: { bg: 'rgba(74, 157, 110, 0.15)', text: '#4a9d6e' },
    shooting: { bg: 'rgba(74, 157, 110, 0.15)', text: '#4a9d6e' },
    dribbling: { bg: 'rgba(74, 157, 110, 0.15)', text: '#4a9d6e' },
    defending: { bg: 'rgba(74, 157, 110, 0.15)', text: '#4a9d6e' },
    possession: { bg: 'rgba(74, 157, 110, 0.15)', text: '#4a9d6e' },
    fitness: { bg: 'rgba(74, 157, 110, 0.15)', text: '#4a9d6e' },
    warmup: { bg: 'rgba(74, 157, 110, 0.15)', text: '#4a9d6e' },
    default: { bg: 'rgba(74, 157, 110, 0.15)', text: '#4a9d6e' },
  },

  // Difficulty colors
  difficultyColors: {
    easy: { bg: 'rgba(74, 157, 110, 0.15)', text: '#4a9d6e' },
    medium: { bg: 'rgba(212, 166, 65, 0.15)', text: '#d4a641' },
    hard: { bg: 'rgba(220, 38, 38, 0.15)', text: '#dc2626' },
    default: { bg: 'rgba(139, 145, 158, 0.15)', text: '#8b919e' },
  },

  // Field colors
  fieldLight: '#6fbf4a',
  fieldDark: '#63b043',
};

export const lightColors: Colors = {
  // Core backgrounds
  background: '#f5f7fa',
  card: '#ffffff',
  cardHover: '#f0f2f5',

  // Text
  foreground: '#1a1d23',
  mutedForeground: '#6b7280',

  // Primary (green)
  primary: '#3d8b5e',
  primaryForeground: '#ffffff',
  primaryLight: 'rgba(61, 139, 94, 0.1)',

  // Accent
  accent: '#c49530',
  accentForeground: '#ffffff',

  // Border
  border: '#e2e5ea',

  // Destructive
  destructive: '#dc2626',

  // Category colors
  categoryColors: {
    passing: { bg: 'rgba(61, 139, 94, 0.12)', text: '#3d8b5e' },
    shooting: { bg: 'rgba(61, 139, 94, 0.12)', text: '#3d8b5e' },
    dribbling: { bg: 'rgba(61, 139, 94, 0.12)', text: '#3d8b5e' },
    defending: { bg: 'rgba(61, 139, 94, 0.12)', text: '#3d8b5e' },
    possession: { bg: 'rgba(61, 139, 94, 0.12)', text: '#3d8b5e' },
    fitness: { bg: 'rgba(61, 139, 94, 0.12)', text: '#3d8b5e' },
    warmup: { bg: 'rgba(61, 139, 94, 0.12)', text: '#3d8b5e' },
    default: { bg: 'rgba(61, 139, 94, 0.12)', text: '#3d8b5e' },
  },

  // Difficulty colors
  difficultyColors: {
    easy: { bg: 'rgba(61, 139, 94, 0.12)', text: '#3d8b5e' },
    medium: { bg: 'rgba(196, 149, 48, 0.12)', text: '#c49530' },
    hard: { bg: 'rgba(220, 38, 38, 0.12)', text: '#dc2626' },
    default: { bg: 'rgba(107, 114, 128, 0.12)', text: '#6b7280' },
  },

  // Field colors
  fieldLight: '#6fbf4a',
  fieldDark: '#63b043',
};

interface ThemeContextType {
  mode: ThemeMode;
  colors: Colors;
  isDark: boolean;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  colors: darkColors,
  isDark: true,
  toggleTheme: () => {},
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(stored => {
      if (stored === 'light' || stored === 'dark') setModeState(stored);
      setLoaded(true);
    });
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(THEME_KEY, newMode);
  }, []);

  const toggleTheme = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const themeColors = mode === 'dark' ? darkColors : lightColors;

  // Don't render until we've loaded the preference to avoid flash
  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ mode, colors: themeColors, isDark: mode === 'dark', toggleTheme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
