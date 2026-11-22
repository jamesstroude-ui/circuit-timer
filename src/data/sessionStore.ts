// Saves the running workout so it can resume after a reload (SPEC 6.2).
//
// Stage 3 only: it uses its own key. Stage 4 builds the real storage module
// (one AppData object in "circuit-app-data") and must move this into
// AppData.activeSession, then remove this key.

import type { ActiveSession } from './schema';

const KEY = 'circuit-active-session';

export function loadSession(): ActiveSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as ActiveSession;
    return typeof s.timelineIndex === 'number' ? s : null;
  } catch {
    return null;
  }
}

export function saveSession(s: ActiveSession): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage full or blocked: the workout still runs, it just cannot resume.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
