'use client';

import { useSyncExternalStore } from 'react';

const readLocalStorageString = (key: string): string => {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
};

const subscribeToStorage = (key: string, onStoreChange: () => void): (() => void) => {
  const listener = (event: StorageEvent) => {
    if (event.key === key || event.key === null) {
      onStoreChange();
    }
  };

  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener('storage', listener);
  };
};

export function useLocalStorageString(key: string, serverValue: string): string {
  return useSyncExternalStore(
    (onStoreChange) => subscribeToStorage(key, onStoreChange),
    () => readLocalStorageString(key),
    () => serverValue
  );
}
