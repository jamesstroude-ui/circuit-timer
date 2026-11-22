import { describe, expect, it } from 'vitest';
import { entryCue, tickCues, type CueContext } from './cues';
import { buildTimeline } from './timeline';
import { block, fullBodyStarter, routines, station, strengthPairs, workout } from './testFixtures';

const ctx: CueContext = {
  exerciseName: (id) => (id ? id.replace(/-/g, ' ') : ''),
  switchSides: (id) => id === 'leg-swings' || id === 'step-up',
  blockName: (i) => `Block ${'ABCD'[i]}`,
  countdownBeepsSec: 3,
  tenSecondWarning: true,
  halfwayCall: false,
};
const data = { routines };
const fb = buildTimeline(fullBodyStarter(), data);
const at = (kind: string, nth = 0) => fb.map((p, i) => (p.kind === kind ? i : -1)).filter((i) => i >= 0)[nth];

describe('entryCue (SPEC 7)', () => {
  it('workout start: "Get ready. First: …"', () => {
    expect(entryCue(fb, 0, ctx)).toEqual({ say: 'Get ready. First: jumping jacks.' });
  });

  it('first warm-up item says "Warm-up."; later items say their name', () => {
    expect(entryCue(fb, at('warmup', 0), ctx)).toEqual({ say: 'Warm-up. jumping jacks.' });
    expect(entryCue(fb, at('warmup', 1), ctx)).toEqual({ say: 'arm circles.' });
  });

  it('transitions between warm-up items are quiet', () => {
    expect(entryCue(fb, at('transition', 0), ctx)).toBeNull();
  });

  it('transition into the circuit names the first exercise', () => {
    const i = at('work') - 1;
    expect(entryCue(fb, i, ctx)).toEqual({ say: 'Get ready. First: goblet squat.' });
  });

  it('work: long beep + "Go. {exercise}."', () => {
    expect(entryCue(fb, at('work'), ctx)).toEqual({ beep: 'long', say: 'Go. goblet squat.' });
  });

  it('rest: long beep + "Rest. Next: {exercise}."', () => {
    expect(entryCue(fb, at('rest'), ctx)).toEqual({ beep: 'long', say: 'Rest. Next: push up.' });
  });

  it('round rest: "Round {n} done. Rest."', () => {
    expect(entryCue(fb, at('roundRest'), ctx)).toEqual({ beep: 'long', say: 'Round 1 done. Rest.' });
  });

  it('block rest: "Block done. Next: {block name}."', () => {
    const sp = buildTimeline(strengthPairs(), data);
    const i = sp.findIndex((p) => p.kind === 'blockRest');
    expect(entryCue(sp, i, ctx)).toEqual({ beep: 'long', say: 'Block done. Next: Block B.' });
  });

  it('cool-down: the first transition says "Cool-down."; items say their name', () => {
    const lastWork = fb.map((p) => p.kind).lastIndexOf('work');
    expect(entryCue(fb, lastWork + 1, ctx)).toEqual({ say: 'Cool-down. First: childs pose.' });
    expect(entryCue(fb, lastWork + 2, ctx)).toEqual({ say: 'childs pose.' });
    expect(entryCue(fb, lastWork + 3, ctx)).toBeNull();
  });

  it('done: triple beep + "Workout complete. Well done."', () => {
    expect(entryCue(fb, fb.length - 1, ctx)).toEqual({ beep: 'triple', say: 'Workout complete. Well done.' });
  });
});

describe('tickCues', () => {
  const work = at('work'); // 40 s
  const rest = at('rest'); // 20 s

  it('short beep at 3, 2, 1 s left — one each', () => {
    expect(tickCues(fb, work, 3100, 2950, ctx)).toEqual([{ beep: 'short' }]);
    expect(tickCues(fb, work, 2100, 1950, ctx)).toEqual([{ beep: 'short' }]);
    expect(tickCues(fb, work, 1100, 950, ctx)).toEqual([{ beep: 'short' }]);
    expect(tickCues(fb, work, 950, 0, ctx)).toEqual([]);
    expect(tickCues(fb, work, 5000, 4000, ctx)).toEqual([]);
  });

  it('exactly on the mark counts once', () => {
    expect(tickCues(fb, work, 3016, 3000, ctx)).toEqual([{ beep: 'short' }]);
    expect(tickCues(fb, work, 3000, 2984, ctx)).toEqual([]);
  });

  it('"Ten seconds." in rest only, when on', () => {
    expect(tickCues(fb, rest, 10_050, 9_990, ctx)).toEqual([{ say: 'Ten seconds.' }]);
    expect(tickCues(fb, work, 10_050, 9_990, ctx)).toEqual([]);
    expect(tickCues(fb, rest, 10_050, 9_990, { ...ctx, tenSecondWarning: false })).toEqual([]);
  });

  it('no "Ten seconds." in a rest of 10 s or less', () => {
    const t = buildTimeline(workout({ blocks: [block('A', 1, 0, [station('a', 20, 10), station('b', 20, 0)])] }), data);
    expect(tickCues(t, 2, 10_000, 9_990, ctx)).toEqual([]);
  });

  it('"Halfway." in work only when the setting is on', () => {
    expect(tickCues(fb, work, 20_010, 19_990, ctx)).toEqual([]);
    expect(tickCues(fb, work, 20_010, 19_990, { ...ctx, halfwayCall: true })).toEqual([{ say: 'Halfway.' }]);
  });

  it('"Switch sides." + double beep at halfway for a switch-sides exercise (also in warm-up)', () => {
    const legSwings = fb.findIndex((p) => p.exerciseId === 'leg-swings'); // 40 s
    expect(tickCues(fb, legSwings, 20_010, 19_990, ctx)).toEqual([{ say: 'Switch sides.', beep: 'double' }]);
  });

  it('nothing when time went up (+10 s) or on done', () => {
    expect(tickCues(fb, rest, 2000, 12_000, ctx)).toEqual([]);
    expect(tickCues(fb, fb.length - 1, 3000, 0, ctx)).toEqual([]);
  });

  it('a big jump returns every mark in time order', () => {
    expect(tickCues(fb, rest, 10_500, 900, ctx)).toEqual([
      { say: 'Ten seconds.' }, { beep: 'short' }, { beep: 'short' }, { beep: 'short' },
    ]);
  });
});
