// Theme store for the public/marketing surface (dark default + light option).
//
// Intentionally React-free so it can be unit-tested without a DOM. The light
// theme is applied by adding the `theme-light` class to a marketing page
// wrapper (see themeScopeClass); the dashboard never receives it, so it always
// renders dark. Preference is persisted and synced across tabs.

export type ThemeMode = 'dark' | 'light';

export const DEFAULT_THEME: ThemeMode = 'dark';
export const THEME_STORAGE_KEY = 'violema_theme';

// Master switch for the light theme. While false the toggle is hidden and every
// surface renders dark (even for visitors who previously stored a light
// preference) — the light theme code stays in place, ready to re-enable.
export const LIGHT_THEME_ENABLED = false;

export function normalizeThemeValue(value: unknown): ThemeMode {
  return value === 'light' ? 'light' : 'dark';
}

/** Class to put on a marketing wrapper. Dark needs none (`:root` is dark). */
export function themeScopeClass(theme: ThemeMode): string {
  return theme === 'light' ? 'theme-light' : '';
}

export function nextTheme(theme: ThemeMode): ThemeMode {
  return theme === 'light' ? 'dark' : 'light';
}

const listeners = new Set<() => void>();
let current: ThemeMode | null = null;

function readStored(): ThemeMode {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    return normalizeThemeValue(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

export function getThemeSnapshot(): ThemeMode {
  if (current === null) current = readStored();
  return current;
}

export function getServerSnapshot(): ThemeMode {
  return DEFAULT_THEME;
}

export function setTheme(next: ThemeMode): void {
  const normalized = normalizeThemeValue(next);
  current = normalized;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, normalized);
  } catch {
    // Ignore storage failures (private mode, etc.) — in-memory value still works.
  }
  listeners.forEach((listener) => listener());
}

export function toggleTheme(): void {
  setTheme(nextTheme(getThemeSnapshot()));
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) {
      current = readStored();
      listener();
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }

  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
}

/** Test-only: reset the in-memory cache so a fresh read happens next call. */
export function __resetThemeCacheForTests(): void {
  current = null;
}
