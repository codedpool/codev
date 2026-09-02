import { useEffect, useState } from 'react';

export function useMediaQuery(query) {
  const get = () => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

// Breakpoints used by the IDE layout
export const useIsCompact = () => useMediaQuery('(max-width: 1100px)'); // side panels overlay
export const useIsMobile = () => useMediaQuery('(max-width: 720px)');   // activity bar collapses
