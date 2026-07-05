import { useEffect } from 'react';
import { usePersistentState } from './usePersistentState';

export type Theme = 'dark' | 'light';

function systemTheme(): Theme {
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

// Theme with persistence. First visit follows the OS preference; after the
// user toggles, their choice sticks.
export function useTheme() {
  const [theme, setTheme] = usePersistentState<Theme>('ui.theme', systemTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    // keep the browser chrome (mobile address bar) matching
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'light' ? '#efede6' : '#0c1014');
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  return { theme, toggle };
}
