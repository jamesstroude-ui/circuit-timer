import { describe, expect, it } from 'vitest';
import { buildTimeline, totalSec } from './timeline';
import {
  addRest, advance, canAddRest, elapsedMs, fromActiveSession, isDone, isPaused, pause,
  remainingMs, resume, skipBack, skipForward, start, toActiveSession,
} from './runner';
import { block, fullBodyStarter, routines, station, workout } from './testFixtures';

// prepare 10 s → work A 20 s → rest 10 s → work B 20 s → done
const simple = buildTimeline(workout({ blocks: [block('A', 1, 0, [station('a', 20, 10), station('b', 20, 0)])] }), { routines });
const T0 = 1_000_000;
const s = 1000;

describe('start and advance (timestamps)', () => {
  it('starts on phase 0 with its full time', () => {
    const st = start(simple, T0);
    expect(st.index).toBe(0);
    expect(remainingMs(st, T0)).toBe(10 * s);
    expect(remainingMs(st, T0 + 4 * s)).toBe(6 * s);
  });

  it('nothing changes before the phase ends', () => {
    const r = advance(simple, start(simple, T0), T0 + 9999);
    expect(r.entered).toEqual([]);
    expect(r.state.index).toBe(0);
  });

  it('the next phase starts at the old end time, not at "now" (no drift)', () => {
    // The frame arrives 300 ms late. Work must still end 20 s after prepare ended.
    const r = advance(simple, start(simple, T0), T0 + 10 * s + 300);
    expect(r.entered).toEqual([1]);
    expect(r.state.phaseEndsAt).toBe(T0 + 30 * s);
    expect(remainingMs(r.state, T0 + 10 * s + 300)).toBe(19_700);
  });

  it('catches up over many phases after a long gap (app was hidden)', () => {
    const r = advance(simple, start(simple, T0), T0 + 45 * s); // 10 + 20 + 10 = 40 s gone → in work B
    expect(r.entered).toEqual([1, 2, 3]);
    expect(r.state.index).toBe(3);
    expect(remainingMs(r.state, T0 + 45 * s)).toBe(15 * s);
  });

  it('reaches done after the total time, and stays there', () => {
    const tl = buildTimeline(fullBodyStarter(), { routines });
    const end = T0 + totalSec(tl) * s;
    expect(isDone(tl, advance(tl, start(tl, T0), end - 1).state)).toBe(false);
    const r = advance(tl, start(tl, T0), end);
    expect(isDone(tl, r.state)).toBe(true);
    expect(remainingMs(r.state, end)).toBe(0);
    expect(advance(tl, r.state, end + 60 * s).entered).toEqual([]);
  });
});

describe('pause and resume', () => {
  it('keep the same remaining time', () => {
    const p = pause(simple, start(simple, T0), T0 + 3 * s);
    expect(isPaused(p)).toBe(true);
    expect(remainingMs(p, T0 + 3 * s)).toBe(7 * s);
    // Paused for 5 minutes: nothing moves.
    expect(advance(simple, p, T0 + 300 * s).entered).toEqual([]);
    expect(remainingMs(p, T0 + 300 * s)).toBe(7 * s);
    const r = resume(p, T0 + 300 * s);
    expect(isPaused(r)).toBe(false);
    expect(remainingMs(r, T0 + 300 * s)).toBe(7 * s);
    expect(r.phaseEndsAt).toBe(T0 + 307 * s);
  });

  it('pause after a phase ended pauses the correct phase', () => {
    const p = pause(simple, start(simple, T0), T0 + 12 * s);
    expect(p.index).toBe(1);
    expect(remainingMs(p, 0)).toBe(18 * s);
  });

  it('resume does nothing on a running state', () => {
    const st = start(simple, T0);
    expect(resume(st, T0 + s)).toBe(st);
  });
});

describe('skip back', () => {
  const inWorkA = (at: number) => advance(simple, start(simple, T0), at).state; // work A starts at T0 + 10 s

  it('1 s into a phase → previous phase, full time', () => {
    const b = skipBack(simple, inWorkA(T0 + 11 * s), T0 + 11 * s);
    expect(b.index).toBe(0);
    expect(remainingMs(b, T0 + 11 * s)).toBe(10 * s);
  });

  it('5 s into a phase → restart this phase', () => {
    const b = skipBack(simple, inWorkA(T0 + 15 * s), T0 + 15 * s);
    expect(b.index).toBe(1);
    expect(remainingMs(b, T0 + 15 * s)).toBe(20 * s);
  });

  it('on the first phase → restart it', () => {
    const b = skipBack(simple, start(simple, T0), T0 + 1 * s);
    expect(b.index).toBe(0);
    expect(remainingMs(b, T0 + s)).toBe(10 * s);
  });

  it('a paused run stays paused', () => {
    const p = pause(simple, inWorkA(T0 + 15 * s), T0 + 15 * s);
    const b = skipBack(simple, p, T0 + 20 * s);
    expect(isPaused(b)).toBe(true);
    expect(b.index).toBe(1);
    expect(remainingMs(b, T0 + 99 * s)).toBe(20 * s);
  });

  it('from done → the last phase, running', () => {
    const done = advance(simple, start(simple, T0), T0 + 60 * s).state;
    const b = skipBack(simple, done, T0 + 60 * s);
    expect(b.index).toBe(3);
    expect(remainingMs(b, T0 + 60 * s)).toBe(20 * s);
  });
});

describe('skip forward', () => {
  it('goes to the next phase with its full time', () => {
    const f = skipForward(simple, start(simple, T0), T0 + 2 * s);
    expect(f.index).toBe(1);
    expect(remainingMs(f, T0 + 2 * s)).toBe(20 * s);
  });

  it('a paused run stays paused', () => {
    const f = skipForward(simple, pause(simple, start(simple, T0), T0 + 2 * s), T0 + 5 * s);
    expect(isPaused(f)).toBe(true);
    expect(f.index).toBe(1);
  });

  it('from the last phase → done; done stays done', () => {
    let st = start(simple, T0);
    for (let i = 0; i < 4; i++) st = skipForward(simple, st, T0);
    expect(isDone(simple, st)).toBe(true);
    expect(skipForward(simple, st, T0).index).toBe(st.index);
  });
});

describe('+10 s', () => {
  const inRest = advance(simple, start(simple, T0), T0 + 31 * s).state; // rest: T0+30 → T0+40

  it('only on rest phases', () => {
    const work = advance(simple, start(simple, T0), T0 + 11 * s).state;
    expect(canAddRest(simple, work)).toBe(false);
    expect(addRest(simple, work, T0 + 11 * s)).toEqual(work);
    expect(canAddRest(simple, inRest)).toBe(true);
  });

  it('adds 10 s to the rest', () => {
    const r = addRest(simple, inRest, T0 + 31 * s);
    expect(remainingMs(r, T0 + 31 * s)).toBe(19 * s);
  });

  it('adds 10 s while paused too', () => {
    const p = pause(simple, inRest, T0 + 31 * s);
    expect(remainingMs(addRest(simple, p, T0 + 50 * s), 0)).toBe(19 * s);
  });

  it('skip back still counts real time spent after +10 s', () => {
    // 5 s into the rest, then +10 s: 5 s spent, so skip back restarts the rest.
    const r = addRest(simple, advance(simple, start(simple, T0), T0 + 35 * s).state, T0 + 35 * s);
    expect(elapsedMs(simple, r, T0 + 35 * s)).toBe(5 * s);
    const b = skipBack(simple, r, T0 + 35 * s);
    expect(b.index).toBe(2);
    expect(remainingMs(b, T0 + 35 * s)).toBe(10 * s);
  });
});

describe('resume after reload', () => {
  const reload = (saved: unknown) => JSON.parse(JSON.stringify(saved));

  it('a running session catches up to the right phase and time', () => {
    const before = advance(simple, start(simple, T0), T0 + 12 * s).state; // work A, 18 s left
    const saved = reload(toActiveSession(before, 'wo-1', '2026-11-22T10:00:00.000Z'));
    expect(saved).toEqual({
      workoutId: 'wo-1', timelineIndex: 1, phaseEndsAt: T0 + 30 * s,
      remainingMsWhenPaused: null, startedAt: '2026-11-22T10:00:00.000Z',
    });
    // App reloads 25 s later: work A ended at +30 s, rest runs to +40 s, so we are in the rest.
    const r = fromActiveSession(simple, saved, T0 + 37 * s)!;
    expect(r.state.index).toBe(2);
    expect(r.entered).toEqual([2]);
    expect(remainingMs(r.state, T0 + 37 * s)).toBe(3 * s);
  });

  it('a paused session comes back paused with the same remaining time', () => {
    const p = pause(simple, start(simple, T0), T0 + 4 * s);
    const r = fromActiveSession(simple, reload(toActiveSession(p, null, 'x')), T0 + 999 * s)!;
    expect(r.entered).toEqual([]);
    expect(isPaused(r.state)).toBe(true);
    expect(remainingMs(r.state, 0)).toBe(6 * s);
  });

  it('a session that does not fit the timeline is refused', () => {
    const bad = { workoutId: null, timelineIndex: 99, phaseEndsAt: T0, remainingMsWhenPaused: null, startedAt: 'x' };
    expect(fromActiveSession(simple, bad, T0)).toBeNull();
    expect(fromActiveSession(simple, { ...bad, timelineIndex: 1, phaseEndsAt: null }, T0)).toBeNull();
  });
});
