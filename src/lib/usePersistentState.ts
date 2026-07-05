import { useEffect, useState } from 'react';
import { loadJSON, saveJSON } from './storage';

// Drop-in replacement for useState that survives page reloads. The value must
// be JSON-serializable (use arrays instead of Sets/Maps at the boundary).
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => loadJSON(key, initial));

  useEffect(() => {
    saveJSON(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}
