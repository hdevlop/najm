import { useState } from 'react';

export function useLocalStorageState<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) return JSON.parse(raw) as T;
    } catch {
      // ignore JSON parse errors
    }
    return initialValue;
  });

  const setValueAndPersist: React.Dispatch<React.SetStateAction<T>> = (next) => {
    setValue((prev) => {
      const nextValue = next instanceof Function ? next(prev) : next;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(nextValue));
      }
      return nextValue;
    });
  };

  return [value, setValueAndPersist];
}