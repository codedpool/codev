// Tiny external store for high-frequency values (cursor position, selection)
// so only the components that care re-render.
import { useSyncExternalStore } from 'react';

export function createStore(initial) {
  let state = initial;
  const subs = new Set();
  const get = () => state;
  const set = (patch) => {
    const next = typeof patch === 'function' ? patch(state) : { ...state, ...patch };
    if (next === state) return;
    state = next;
    subs.forEach((fn) => fn());
  };
  const subscribe = (fn) => {
    subs.add(fn);
    return () => subs.delete(fn);
  };
  const use = (selector = (s) => s) =>
    useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
  return { get, set, subscribe, use };
}
