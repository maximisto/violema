import { useSyncExternalStore } from 'react';
import {
  DEFAULT_THEME,
  LIGHT_THEME_ENABLED,
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
  const stored = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerSnapshot);
  // While the light theme is disabled, force dark everywhere regardless of any
  // stored preference, so no one is stranded on the unfinished light site.
  const theme = LIGHT_THEME_ENABLED ? stored : DEFAULT_THEME;
  return {
    theme,
    isLight: theme === 'light',
    scopeClass: themeScopeClass(theme),
    setTheme,
    toggleTheme,
  };
}
