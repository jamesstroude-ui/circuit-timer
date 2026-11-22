// Saves the running workout so it can resume after a reload (SPEC 6.2).
// It lives in AppData.activeSession (SPEC 5), saved through the storage module.

import type { ActiveSession } from './schema';
import { getData, updateData } from './appStore';

export function loadSession(): ActiveSession | null {
  const s = getData().activeSession;
  return s && typeof s.timelineIndex === 'number' ? s : null;
}

export function saveSession(s: ActiveSession): void {
  updateData((d) => ({ ...d, activeSession: s }));
}

export function clearSession(): void {
  updateData((d) => {
    if (!d.activeSession) return d;
    const { activeSession: _gone, ...rest } = d;
    return rest;
  });
}
