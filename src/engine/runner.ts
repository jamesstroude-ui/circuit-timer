// Runs a timeline (SPEC 6.2 and 6.3). Pure functions: every call gets `now` (epoch ms)
// and returns a new state. Nothing here reads the clock, so tests can fake time.
//
// Timing uses timestamps, never tick counting: a running phase stores when it ends.
// When a phase ends, the next one starts at that exact end time, so there is no drift.

import type { ActiveSession, ID } from '../data/schema';
import { REST_KINDS, type Phase } from './timeline';

export interface RunState {
  index: number; // which phase in the timeline
  phaseEndsAt: number | null; // epoch ms while running; null when paused or done
  remainingMsWhenPaused: number | null; // set only while paused
  /** Time added with "+10 s" in this phase. Not saved (ActiveSession has no field for it). */
  addedMs: number;
}

export const SKIP_BACK_WINDOW_MS = 2000;
export const ADD_REST_MS = 10_000;

const ms = (timeline: Phase[], i: number) => timeline[i].durationSec * 1000;

export function isDone(timeline: Phase[], s: RunState): boolean {
  return timeline[s.index].kind === 'done';
}

export function isPaused(s: RunState): boolean {
  return s.remainingMsWhenPaused !== null;
}

/** Start phase `index` at `now`. Keeps the paused / running choice. */
function enter(timeline: Phase[], index: number, now: number, paused: boolean): RunState {
  if (timeline[index].kind === 'done') {
    return { index, phaseEndsAt: null, remainingMsWhenPaused: null, addedMs: 0 };
  }
  const len = ms(timeline, index);
  return paused
    ? { index, phaseEndsAt: null, remainingMsWhenPaused: len, addedMs: 0 }
    : { index, phaseEndsAt: now + len, remainingMsWhenPaused: null, addedMs: 0 };
}

export function start(timeline: Phase[], now: number): RunState {
  return enter(timeline, 0, now, false);
}

export function remainingMs(s: RunState, now: number): number {
  if (s.remainingMsWhenPaused !== null) return s.remainingMsWhenPaused;
  if (s.phaseEndsAt === null) return 0;
  return Math.max(0, s.phaseEndsAt - now);
}

/** How long this phase has run, including any "+10 s". */
export function elapsedMs(timeline: Phase[], s: RunState, now: number): number {
  return Math.max(0, ms(timeline, s.index) + s.addedMs - remainingMs(s, now));
}

export interface Advance {
  state: RunState;
  /** Indexes of every phase entered by this call, in order. Empty if nothing changed. */
  entered: number[];
}

/**
 * Move past every phase that has ended by `now`. Call it each frame, and when the app
 * becomes visible again. If it enters more than one phase, the app was away: the caller
 * should not play the missed cues (SPEC 6.2).
 */
export function advance(timeline: Phase[], s: RunState, now: number): Advance {
  let state = s;
  const entered: number[] = [];
  while (state.phaseEndsAt !== null && now >= state.phaseEndsAt && !isDone(timeline, state)) {
    const endedAt = state.phaseEndsAt;
    const index = state.index + 1;
    state =
      timeline[index].kind === 'done'
        ? { index, phaseEndsAt: null, remainingMsWhenPaused: null, addedMs: 0 }
        : { index, phaseEndsAt: endedAt + ms(timeline, index), remainingMsWhenPaused: null, addedMs: 0 };
    entered.push(index);
  }
  return { state, entered };
}

export function pause(timeline: Phase[], s: RunState, now: number): RunState {
  const cur = advance(timeline, s, now).state;
  if (isPaused(cur) || isDone(timeline, cur)) return cur;
  return { ...cur, phaseEndsAt: null, remainingMsWhenPaused: remainingMs(cur, now) };
}

export function resume(s: RunState, now: number): RunState {
  if (s.remainingMsWhenPaused === null) return s;
  return { ...s, phaseEndsAt: now + s.remainingMsWhenPaused, remainingMsWhenPaused: null };
}

/** Go to the next phase. A paused run stays paused. */
export function skipForward(timeline: Phase[], s: RunState, now: number): RunState {
  const cur = advance(timeline, s, now).state;
  if (isDone(timeline, cur)) return cur;
  return enter(timeline, cur.index + 1, now, isPaused(cur));
}

/** Less than 2 s into a phase → previous phase. Else restart this phase. A paused run stays paused. */
export function skipBack(timeline: Phase[], s: RunState, now: number): RunState {
  const cur = advance(timeline, s, now).state;
  const paused = isPaused(cur);
  if (isDone(timeline, cur)) return enter(timeline, Math.max(0, cur.index - 1), now, false);
  if (elapsedMs(timeline, cur, now) < SKIP_BACK_WINDOW_MS && cur.index > 0) {
    return enter(timeline, cur.index - 1, now, paused);
  }
  return enter(timeline, cur.index, now, paused);
}

export function canAddRest(timeline: Phase[], s: RunState): boolean {
  return REST_KINDS.includes(timeline[s.index].kind);
}

/** +10 s. Only on rest phases; does nothing on other phases. */
export function addRest(timeline: Phase[], s: RunState, now: number): RunState {
  const cur = advance(timeline, s, now).state;
  if (!canAddRest(timeline, cur)) return cur;
  const addedMs = cur.addedMs + ADD_REST_MS;
  if (cur.remainingMsWhenPaused !== null) {
    return { ...cur, remainingMsWhenPaused: cur.remainingMsWhenPaused + ADD_REST_MS, addedMs };
  }
  return { ...cur, phaseEndsAt: cur.phaseEndsAt! + ADD_REST_MS, addedMs };
}

/** For saving to storage at every phase change and on pause (SPEC 6.2). */
export function toActiveSession(s: RunState, workoutId: ID | null, startedAt: string): ActiveSession {
  return {
    workoutId,
    timelineIndex: s.index,
    phaseEndsAt: s.phaseEndsAt,
    remainingMsWhenPaused: s.remainingMsWhenPaused,
    startedAt,
  };
}

/**
 * Resume after the app reloads. Rebuild the timeline from the same workout first.
 * Returns null if the saved session does not fit this timeline (for example, the
 * workout was edited). A running session catches up to `now`; do not play missed cues.
 */
export function fromActiveSession(timeline: Phase[], saved: ActiveSession, now: number): Advance | null {
  const i = saved.timelineIndex;
  if (!Number.isInteger(i) || i < 0 || i >= timeline.length) return null;
  const s: RunState = {
    index: i,
    phaseEndsAt: saved.phaseEndsAt,
    remainingMsWhenPaused: saved.remainingMsWhenPaused,
    addedMs: 0,
  };
  if (timeline[i].kind !== 'done' && s.phaseEndsAt === null && s.remainingMsWhenPaused === null) return null;
  return advance(timeline, s, now);
}
