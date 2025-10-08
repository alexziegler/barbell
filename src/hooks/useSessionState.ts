import { useCallback, useEffect, useRef, useState } from 'react';

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function readSessionItem<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const stored = window.sessionStorage.getItem(key);
    if (stored === null) return fallback;
    return JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
}

export function useSessionState<T>(key: string, defaultValue: T) {
  const isMountedRef = useRef(false);
  const [state, setState] = useState<T>(() => readSessionItem<T>(key, defaultValue));

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setState((prev) => {
      const next = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
      if (isBrowser()) {
        try {
          window.sessionStorage.setItem(key, JSON.stringify(next));
        } catch {
          // Ignore storage failures (e.g., quota exceeded)
        }
      }
      return next;
    });
  }, [key]);

  useEffect(() => {
    if (!isMountedRef.current || !isBrowser()) return;
    try {
      window.sessionStorage.setItem(key, JSON.stringify(state));
    } catch {
      // Ignore storage failures (e.g., quota exceeded)
    }
  }, [key, state]);

  return [state, setValue] as const;
}

export default useSessionState;
