import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeStorage(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** useState that mirrors its value into localStorage. */
export function usePersistentState<T>(
  key: string,
  fallback: T,
  validate?: (value: unknown) => value is T,
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    const stored = readStorage<unknown>(key, fallback);
    if (validate && !validate(stored)) return fallback;
    if (fallback !== null && typeof fallback === 'object' && !Array.isArray(fallback) && stored && typeof stored === 'object') {
      return { ...fallback, ...(stored as object) } as T;
    }
    return stored as T;
  });
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    writeStorage(key, state);
  }, [key, state]);
  return [state, setState];
}
