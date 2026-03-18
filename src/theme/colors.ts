// Static color exports — these always point to the DARK theme.
// They are used in StyleSheet.create calls at module scope.
// For theme-reactive colors, use useTheme() from ThemeContext.
import { darkColors, lightColors } from './ThemeContext';
export { darkColors, lightColors };

// Default static export (dark mode) for backward compatibility with StyleSheet.create
export const colors = darkColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const borderRadius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const typography = {
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
  },
  h2: {
    fontSize: 22,
    fontWeight: '600' as const,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 14,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: '400' as const,
  },
  small: {
    fontSize: 11,
    fontWeight: '500' as const,
  },
};
