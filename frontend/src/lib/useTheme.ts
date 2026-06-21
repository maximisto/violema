import { useSyncExternalStore } from 'react';
import {
  getServerSnapshot,
  getThemeSnapshot,
  setTheme,
  subscribeTheme,
  themeScopeClass,
  toggleTheme,
  type ThemeMode,
} from './theme';

export interface UseThemeResult {
  theme: ThemeMode;
  isLight: boolean;
  /** Class for the marketing wrapper (`theme-light` or ``). */
  scopeClass: string;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

export function useTheme(): UseThemeResult {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerSnapshot);
  return {
    theme,
    isLight: theme === 'light',
    scopeClass: themeScopeClass(theme),
    setTheme,
    toggleTheme,
  };
}
