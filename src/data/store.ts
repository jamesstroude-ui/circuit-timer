// The one storage module (SPEC 4 and 5). All app data is one JSON object in
// localStorage key "circuit-app-data". Nothing else in the app touches localStorage.
//
// Load rules:
// - Nothing saved yet: save the starter content.
// - Saved data from an older version: keep a backup copy, then migrate.
// - Saved data that cannot be read: keep it under a backup key (never delete it),
//   then start again from the starter content and tell Jim.

import { CURRENT_VERSION, migrate } from './migrations';
import type { ActiveSession, AppData } from './schema';
import { defaultSettings, makeStarterData, starterProfiles } from './starter';

export const DATA_KEY = 'circuit-app-data';
export const BACKUP_PREFIX = 'circuit-app-data-backup-';
/** Stage 3 kept the running workout under its own key. Moved into AppData.activeSession. */
export const OLD_SESSION_KEY = 'circuit-active-session';

/** The part of localStorage this module uses (tests pass a fake). */
export interface KeyValue {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LoadResult {
  data: AppData;
  /** A message for Jim when something unusual happened. */
  notice?: string;
}

const arr = <T>(x: unknown, fallback: T[]): T[] => (Array.isArray(x) ? (x as T[]) : fallback);

/** Fill in anything missing, so old or hand-edited data does not crash the app. */
function normalise(d: AppData): AppData {
  return {
    ...d,
    schemaVersion: CURRENT_VERSION as 1,
    exercises: arr(d.exercises, []),
    routines: arr(d.routines, []),
    workouts: arr(d.workouts, []),
    profiles: arr(d.profiles, []).length ? d.profiles : starterProfiles.map((p) => ({ ...p })),
    logs: arr(d.logs, []),
    settings: { ...defaultSettings, ...(d.settings ?? {}) },
  };
}

function readOldSession(kv: KeyValue): ActiveSession | undefined {
  try {
    const raw = kv.getItem(OLD_SESSION_KEY);
    if (!raw) return undefined;
    const s = JSON.parse(raw) as ActiveSession;
    return typeof s?.timelineIndex === 'number' ? s : undefined;
  } catch {
    return undefined;
  }
}

export function saveData(kv: KeyValue, data: AppData): boolean {
  try {
    kv.setItem(DATA_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false; // storage full or blocked
  }
}

export function loadData(kv: KeyValue, now: Date = new Date()): LoadResult {
  let raw: string | null = null;
  try {
    raw = kv.getItem(DATA_KEY);
  } catch {
    raw = null;
  }

  let data: AppData;
  let notice: string | undefined;
  let changed = false;
  const backup = (text: string) => {
    try {
      kv.setItem(BACKUP_PREFIX + now.toISOString(), text);
    } catch {
      // No room for a backup. Still do not overwrite the original below without one:
      throw new Error('backup failed');
    }
  };

  if (raw === null) {
    data = makeStarterData();
    changed = true;
  } else {
    try {
      const { data: migrated, fromVersion } = migrate(JSON.parse(raw));
      if (fromVersion < CURRENT_VERSION) {
        backup(raw);
        changed = true;
      }
      data = normalise(migrated);
    } catch {
      try {
        backup(raw);
        data = makeStarterData();
        changed = true;
        notice = 'Your saved data could not be read. A copy is kept on this phone. The app started again with the starter content.';
      } catch {
        // Could not even back it up: run on starter content, but do not save over the original.
        return {
          data: makeStarterData(),
          notice: 'Your saved data could not be read, and the phone is out of space. Changes will not be saved.',
        };
      }
    }
  }

  // One-time move of the Stage 3 session key.
  const old = readOldSession(kv);
  if (old && !data.activeSession) {
    data = { ...data, activeSession: old };
    changed = true;
  }

  if (changed) saveData(kv, data);
  try {
    if (old !== undefined || kv.getItem(OLD_SESSION_KEY) !== null) kv.removeItem(OLD_SESSION_KEY);
  } catch {
    // ignore
  }
  return { data, notice };
}

/** An in-memory KeyValue, for tests. */
export function memoryKeyValue(initial: Record<string, string> = {}): KeyValue & { dump(): Record<string, string> } {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}
