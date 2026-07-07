import { useState, useEffect } from "react";

/**
 * Drop-in replacement for useState that persists the value in sessionStorage.
 * The value survives in-session navigation (page changes) but is cleared when
 * the browser tab is closed. JSON-serialisable values only.
 */
export function usePersistedState<T>(
  key: string,
  init: T | (() => T),
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {}
    return typeof init === "function" ? (init as () => T)() : init;
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);

  return [state, setState];
}
