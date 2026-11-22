// Changes to the app data, as pure functions: each takes AppData and returns new AppData.
// The library screens call these through updateData(). Tested in ops.test.ts.

import type { AppData, Block, Exercise, ID, Routine, Settings, Station, Workout } from './schema';

export function newId(): ID {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch {
    // fall through
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------- Exercises ----------

export const CUE_MAX = 40;

export function blankExercise(): Exercise {
  return {
    id: newId(),
    name: '',
    cue: '',
    category: 'strength',
    equipment: 'none',
    switchSides: false,
    tracksLoad: false,
    builtIn: false,
    hidden: false,
  };
}

/** Add a new exercise, or replace the one with the same ID. */
export function saveExercise(d: AppData, ex: Exercise): AppData {
  const clean: Exercise = { ...ex, name: ex.name.trim(), cue: ex.cue.trim() };
  const exists = d.exercises.some((e) => e.id === ex.id);
  return {
    ...d,
    exercises: exists ? d.exercises.map((e) => (e.id === ex.id ? clean : e)) : [...d.exercises, clean],
  };
}

export function setExerciseHidden(d: AppData, id: ID, hidden: boolean): AppData {
  return { ...d, exercises: d.exercises.map((e) => (e.id === id ? { ...e, hidden } : e)) };
}

/** Names of the warm-ups, cool-downs and workouts that use this exercise. */
export function exerciseUsage(d: AppData, id: ID): string[] {
  const names: string[] = [];
  for (const r of d.routines) if (r.items.some((it) => it.exerciseId === id)) names.push(r.name);
  for (const w of d.workouts) {
    if (w.blocks.some((b) => b.stations.some((s) => s.exerciseId === id))) names.push(w.name);
  }
  return names;
}

/** Why an exercise cannot be deleted, or null if it can. */
export function cannotDeleteExercise(d: AppData, id: ID): string | null {
  const ex = d.exercises.find((e) => e.id === id);
  if (!ex) return 'Not found.';
  if (ex.builtIn) return 'Starter exercises cannot be deleted. You can hide them.';
  const used = exerciseUsage(d, id);
  if (used.length) return `Used in: ${used.join(', ')}. Remove it there first, or hide it.`;
  return null;
}

export function deleteExercise(d: AppData, id: ID): AppData {
  const why = cannotDeleteExercise(d, id);
  if (why) throw new Error(why);
  return { ...d, exercises: d.exercises.filter((e) => e.id !== id) };
}

/** Another exercise with the same name (case and spaces ignored), if any. */
export function sameNameExercise(d: AppData, ex: Exercise): Exercise | undefined {
  const key = ex.name.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!key) return undefined;
  return d.exercises.find((e) => e.id !== ex.id && e.name.trim().toLowerCase().replace(/\s+/g, ' ') === key);
}

// ---------- Warm-ups and cool-downs ----------

export const ROUTINE_ITEM_MIN = 5;
export const ROUTINE_ITEM_MAX = 600;
export const TRANSITION_MAX = 60;

export function blankRoutine(kind: Routine['kind']): Routine {
  return { id: newId(), kind, name: '', items: [], transitionSec: 5 };
}

export function saveRoutine(d: AppData, r: Routine): AppData {
  const clean: Routine = { ...r, name: r.name.trim(), items: r.items.map((it) => ({ ...it })) };
  const exists = d.routines.some((x) => x.id === r.id);
  return {
    ...d,
    routines: exists ? d.routines.map((x) => (x.id === r.id ? clean : x)) : [...d.routines, clean],
  };
}

/** Names of the workouts that use this warm-up or cool-down. */
export function routineUsage(d: AppData, id: ID): string[] {
  return d.workouts.filter((w) => w.warmupId === id || w.cooldownId === id).map((w) => w.name);
}

export function cannotDeleteRoutine(d: AppData, id: ID): string | null {
  if (!d.routines.some((r) => r.id === id)) return 'Not found.';
  const used = routineUsage(d, id);
  if (used.length) return `Used by: ${used.join(', ')}. Pick another one in those workouts first.`;
  return null;
}

export function deleteRoutine(d: AppData, id: ID): AppData {
  const why = cannotDeleteRoutine(d, id);
  if (why) throw new Error(why);
  return { ...d, routines: d.routines.filter((r) => r.id !== id) };
}

/** A copy with a new ID and "(copy)" after the name. Returns the new data and the copy's ID. */
export function duplicateRoutine(d: AppData, id: ID): { data: AppData; id: ID } {
  const src = d.routines.find((r) => r.id === id);
  if (!src) throw new Error('Not found.');
  const copy: Routine = { ...src, id: newId(), name: `${src.name} (copy)`, items: src.items.map((it) => ({ ...it })) };
  return { data: { ...d, routines: [...d.routines, copy] }, id: copy.id };
}

/** Problems that stop a routine being saved. Empty list = OK. */
export function routineProblems(r: Routine): string[] {
  const out: string[] = [];
  if (!r.name.trim()) out.push('Give it a name.');
  if (r.items.length === 0) out.push('Add at least one exercise.');
  return out;
}

// ---------- Lists ----------

/** Move item `i` up (-1) or down (+1). Returns a new array; out of range = same order. */
export function moveItem<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (i < 0 || i >= list.length || j < 0 || j >= list.length) return list;
  const out = list.slice();
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

export function clampSec(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, Math.round(v)));
}

// ---------- Workouts (Stage 5) ----------

export const ROUNDS_MAX = 20;
export const WORK_MIN = 5;
export const WORK_MAX = 600;
export const REST_MAX = 300;
export const PREPARE_MAX = 60;

/** "Block A", "Block B", … for the block at this position. */
export function blockName(i: number): string {
  return `Block ${i < 26 ? String.fromCharCode(65 + i) : i + 1}`;
}

export function blankBlock(i: number): Block {
  return { id: newId(), name: blockName(i), rounds: 3, restBetweenRoundsSec: 60, stations: [] };
}

export function blankWorkout(settings: Settings): Workout {
  return {
    id: newId(),
    name: '',
    prepareSec: settings.defaultPrepareSec,
    warmupId: null,
    blocks: [blankBlock(0)],
    restBetweenBlocksSec: 60,
    cooldownId: null,
  };
}

/**
 * New stations for these exercises. They copy the times of the block's last station,
 * so Jim sets the times once; an empty block uses the default work and rest.
 */
export function newStations(block: Block, exerciseIds: ID[], settings: Settings): Station[] {
  const last = block.stations[block.stations.length - 1];
  const workSec = last?.workSec ?? settings.defaultWorkSec;
  const restSec = last?.restSec ?? settings.defaultRestSec;
  return exerciseIds.map((exerciseId) => ({ id: newId(), exerciseId, workSec, restSec }));
}

/** Set the work and/or rest time of every station in a block. */
export function setAllStations(block: Block, times: { workSec?: number; restSec?: number }): Block {
  return { ...block, stations: block.stations.map((s) => ({ ...s, ...times })) };
}

/** The shared value of a station field, or null when the stations differ (or there are none). */
export function sharedValue(block: Block, key: 'workSec' | 'restSec'): number | null {
  const values = new Set(block.stations.map((s) => s[key]));
  return values.size === 1 ? [...values][0] : null;
}

export function saveWorkout(d: AppData, w: Workout): AppData {
  const clean: Workout = { ...w, name: w.name.trim() };
  const exists = d.workouts.some((x) => x.id === w.id);
  return { ...d, workouts: exists ? d.workouts.map((x) => (x.id === w.id ? clean : x)) : [...d.workouts, clean] };
}

export function deleteWorkout(d: AppData, id: ID): AppData {
  if (d.activeSession?.workoutId === id) throw new Error('This workout is running.');
  return { ...d, workouts: d.workouts.filter((w) => w.id !== id) };
}

/** A full copy with new IDs everywhere and "(copy)" after the name. */
export function duplicateWorkout(d: AppData, id: ID): { data: AppData; id: ID } {
  const src = d.workouts.find((w) => w.id === id);
  if (!src) throw new Error('Not found.');
  const copy: Workout = {
    ...src,
    id: newId(),
    name: `${src.name} (copy)`,
    blocks: src.blocks.map((b) => ({ ...b, id: newId(), stations: b.stations.map((s) => ({ ...s, id: newId() })) })),
  };
  delete copy.lastUsedAt;
  return { data: { ...d, workouts: [...d.workouts, copy] }, id: copy.id };
}

export function workoutProblems(w: Workout): string[] {
  const out: string[] = [];
  if (!w.name.trim()) out.push('Give the workout a name.');
  if (w.blocks.length === 0) out.push('Add at least one block.');
  w.blocks.forEach((b) => {
    if (b.stations.length === 0) out.push(`${b.name || 'A block'} has no exercises.`);
  });
  return out;
}

/** Workouts, most recently used first; never-used ones after, in the order they were made. */
export function workoutsByRecent(d: AppData): Workout[] {
  return d.workouts
    .map((w, i) => ({ w, i }))
    .sort((a, b) => {
      const ta = a.w.lastUsedAt ?? '';
      const tb = b.w.lastUsedAt ?? '';
      if (ta !== tb) return ta < tb ? 1 : -1;
      return a.i - b.i;
    })
    .map((x) => x.w);
}

/** The workout used most recently, if any has been used. */
export function lastUsedWorkout(d: AppData): Workout | undefined {
  const w = workoutsByRecent(d)[0];
  return w?.lastUsedAt ? w : undefined;
}

/**
 * Exercises for the "Recent" list in the picker: from the most recently used workouts
 * first, then the newest own exercises. Hidden ones are left out.
 */
export function recentExerciseIds(d: AppData, limit = 8): ID[] {
  const hidden = new Set(d.exercises.filter((e) => e.hidden).map((e) => e.id));
  const known = new Set(d.exercises.map((e) => e.id));
  const out: ID[] = [];
  const add = (id: ID) => {
    if (out.length < limit && known.has(id) && !hidden.has(id) && !out.includes(id)) out.push(id);
  };
  for (const w of workoutsByRecent(d).filter((x) => x.lastUsedAt)) {
    for (const b of w.blocks) for (const s of b.stations) add(s.exerciseId);
  }
  for (const e of [...d.exercises].reverse()) if (!e.builtIn) add(e.id);
  return out;
}

/** After blocks move or are removed: blocks that still have a default name get the name for their new place. */
export function renameDefaultBlocks(blocks: Block[]): Block[] {
  return blocks.map((b, i) => (/^Block ([A-Z]|\d+)$/.test(b.name) ? { ...b, name: blockName(i) } : b));
}
