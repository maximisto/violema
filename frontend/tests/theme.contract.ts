// Stub a minimal window + localStorage before loading the store (it reads
// window.localStorage lazily inside functions). Use dynamic import so the stub
// is in place first.
const store = new Map<string, string>();
const localStorageStub = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
};
(globalThis as unknown as { window: unknown }).window = {
  localStorage: localStorageStub,
  addEventListener() {},
  removeEventListener() {},
};

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const theme = await import('../src/lib/theme');

// Pure helpers
assert(theme.DEFAULT_THEME === 'dark', 'default theme is dark');
assert(theme.normalizeThemeValue('light') === 'light', 'normalizes light');
assert(theme.normalizeThemeValue('dark') === 'dark', 'normalizes dark');
assert(theme.normalizeThemeValue(null) === 'dark', 'null → dark');
assert(theme.normalizeThemeValue('nonsense') === 'dark', 'unknown → dark');
assert(theme.themeScopeClass('light') === 'theme-light', 'light → theme-light class');
assert(theme.themeScopeClass('dark') === '', 'dark → no class');
assert(theme.nextTheme('dark') === 'light', 'dark toggles to light');
assert(theme.nextTheme('light') === 'dark', 'light toggles to dark');

// Store: default when nothing stored
store.clear();
theme.__resetThemeCacheForTests();
assert(theme.getThemeSnapshot() === 'dark', 'empty store snapshots dark');

// set + persist
theme.setTheme('light');
assert(theme.getThemeSnapshot() === 'light', 'setTheme updates snapshot');
assert(store.get('violema_theme') === 'light', 'setTheme persists to storage');

// toggle round-trips
theme.toggleTheme();
assert(theme.getThemeSnapshot() === 'dark', 'toggle returns to dark');
assert(store.get('violema_theme') === 'dark', 'toggle persists dark');

// reads persisted value on a cold cache
store.set('violema_theme', 'light');
theme.__resetThemeCacheForTests();
assert(theme.getThemeSnapshot() === 'light', 'cold read honors stored preference');

// subscriber fires on change
let notified = 0;
const unsub = theme.subscribeTheme(() => { notified += 1; });
theme.setTheme('dark');
assert(notified === 1, 'subscriber notified on change');
unsub();
theme.setTheme('light');
assert(notified === 1, 'unsubscribed listener no longer notified');

console.log('theme.contract: all assertions passed');
