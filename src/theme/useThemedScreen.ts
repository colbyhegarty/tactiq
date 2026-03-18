import { StatusBarStyle } from 'react-native';
import { useTheme } from './ThemeContext';

/**
 * Quick helper for screens that still use static StyleSheet.create.
 * Returns the themed colors + a statusBarStyle string.
 * Screens use these to override key inline styles (container bg, text colors, etc.)
 */
export function useThemedScreen() {
  const theme = useTheme();
  return {
    ...theme,
    statusBarStyle: (theme.isDark ? 'light-content' : 'dark-content') as StatusBarStyle,
  };
}
