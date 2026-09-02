import { useCallback, useEffect, useState } from 'react';
import { loadJSON, saveJSON } from '../lib/storage';

export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => loadJSON(key, initial));
  useEffect(() => { saveJSON(key, value); }, [key, value]);
  const update = useCallback((patch) => setValue((v) => (typeof patch === 'function' ? patch(v) : patch)), []);
  return [value, update];
}
