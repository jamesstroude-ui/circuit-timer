// Holds the app data in memory for the screens, and saves every change at once.
// Screens read it with useAppData() and change it with updateData(fn).

import { useSyncExternalStore } from 'react';
import type { AppData } from './schema';
import { loadData, saveData, type KeyValue } from './store';

let kv: KeyValue | null = null;
let current: AppData | null = null;
let loadNotice: string | undefined;
let saveFailed = false;
const listeners = new Set<() => void>();

function storage(): KeyValue {
  if (!kv) {
    try {
      kv = window.localStorage;
    } catch {
      // Storage blocked: keep data in memory only.
      const m = new Map<string, string>();
      kv = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
    }
  }
  return kv;
}

export function getData(): AppData {
  if (!current) {
    const r = loadData(storage());
    current = r.data;
    loadNotice = r.notice;
    askForPersistentStorage();
  }
  return current;
}

/** Change the data. `fn` must return a new object (do not change the old one). */
export function updateData(fn: (d: AppData) => AppData): void {
  const next = fn(getData());
  if (next === current) return;
  current = next;
  const ok = saveData(storage(), next);
  if (!ok && !saveFailed) {
    saveFailed = true;
    window.alert('The phone could not save your changes (storage full or blocked).');
  }
  if (ok) saveFailed = false;
  listeners.forEach((l) => l());
}

/** A message from loading (for example: saved data could not be read). */
export function startNotice(): string | undefined {
  getData();
  return loadNotice;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAppData(): AppData {
  return useSyncExternalStore(subscribe, getData);
}

/** Ask the browser not to clear our data when space is low. Harmless if not supported. */
function askForPersistentStorage() {
  try {
    void navigator.storage?.persist?.();
  } catch {
    // ignore
  }
}
