import { describe, expect, it } from 'vitest';
import { buildTimeline, circuitSec, routineSec, totalSec } from './timeline';
import { block, fullBodyStarter, routines, station, strengthPairs, tabataX4, workout } from './testFixtures';

const data = { routines };
const kinds = (w: Parameters<typeof buildTimeline>[0]) => buildTimeline(w, data).map((p) => p.kind);

describe('SPEC 6.4 fixtures: circuit time', () => {
  it('Full Body Starter = 1500 s (25:00)', () => {
    expect(circuitSec(buildTimeline(fullBodyStarter(), data))).toBe(1500);
  });
  it('Tabata x4 = 1100 s (18:20)', () => {
    expect(circuitSec(buildTimeline(tabataX4(), data))).toBe(1100);
  });
  it('Strength Pairs = 1320 s (22:00)', () => {
    expect(circuitSec(buildTimeline(strengthPairs(), data))).toBe(1320);
  });
});

describe('buildTimeline order', () => {
  const tl = buildTimeline(fullBodyStarter(), data);

  it('prepare → warm-up items with transitions between → transition → circuit', () => {
    expect(tl.slice(0, 4).map((p) => p.kind)).toEqual(['prepare', 'warmup', 'transition', 'warmup']);
    const warmups = tl.filter((p) => p.kind === 'warmup');
    expect(warmups.map((p) => p.exerciseId)).toEqual([
      'jumping-jacks', 'arm-circles', 'leg-swings', 'bodyweight-squat', 'inchworm', 'worlds-greatest-stretch', 'high-knees',
    ]);
    const firstWork = tl.findIndex((p) => p.kind === 'work');
    expect(tl[firstWork - 1]).toMatchObject({ kind: 'transition', section: 'circuit', durationSec: 10 });
  });

  it('cool-down: transition before each item, then done', () => {
    const lastWork = tl.map((p) => p.kind).lastIndexOf('work');
    expect(tl.slice(lastWork + 1).map((p) => p.kind)).toEqual([
      'transition', 'cooldown', 'transition', 'cooldown', 'transition', 'cooldown',
      'transition', 'cooldown', 'transition', 'cooldown', 'transition', 'cooldown', 'done',
    ]);
  });

  it('total time adds up (prepare + warm-up + circuit + cool-down + transitions)', () => {
    // 10 prepare + 290 warm-up + 6×5 + 10 into circuit + 1500 + 6×5 + 310 cool-down
    expect(totalSec(tl)).toBe(2180);
  });

  it('24 work phases, with rest, round rest and numbering', () => {
    const work = tl.filter((p) => p.kind === 'work');
    expect(work).toHaveLength(24);
    expect(work[0]).toMatchObject({ round: 1, roundsTotal: 3, station: 1, stationsTotal: 8, blockIndex: 0, blocksTotal: 1 });
    expect(work[23]).toMatchObject({ round: 3, station: 8 });
    expect(tl.filter((p) => p.kind === 'rest')).toHaveLength(21);
    expect(tl.filter((p) => p.kind === 'roundRest')).toHaveLength(2);
    expect(tl.filter((p) => p.kind === 'blockRest')).toHaveLength(0);
  });

  it('labels', () => {
    expect(tl[0].label).toBe('GET READY');
    expect(tl.find((p) => p.kind === 'work')!.label).toBe('WORK');
    expect(tl.find((p) => p.kind === 'roundRest')!.label).toBe('ROUND REST');
    expect(tl[tl.length - 1].label).toBe('DONE');
  });

  it('block rest only between blocks', () => {
    const t = buildTimeline(strengthPairs(), data);
    const br = t.filter((p) => p.kind === 'blockRest');
    expect(br).toHaveLength(1);
    expect(br[0]).toMatchObject({ durationSec: 90, blockIndex: 0 });
  });
});

describe('edge cases', () => {
  it('no rest after the final station', () => {
    const w = workout({ blocks: [block('A', 2, 30, [station('a', 20, 10), station('b', 20, 10)])] });
    expect(kinds(w)).toEqual(['prepare', 'work', 'rest', 'work', 'roundRest', 'work', 'rest', 'work', 'done']);
  });

  it('skips zero-duration phases', () => {
    const w = workout({
      prepareSec: 0,
      blocks: [block('A', 2, 0, [station('a', 20, 0), station('b', 20, 15)])],
    });
    expect(kinds(w)).toEqual(['work', 'work', 'work', 'work', 'done']);
    expect(buildTimeline(w, data).filter((p) => p.kind !== 'done').every((p) => p.durationSec > 0)).toBe(true);
  });

  it('no transition into the circuit without a warm-up', () => {
    expect(kinds(workout({ blocks: [block('A', 1, 0, [station('a', 20, 0)])] }))).toEqual(['prepare', 'work', 'done']);
  });

  it('a missing routine id means no warm-up / cool-down', () => {
    const w = workout({ warmupId: 'gone', cooldownId: 'gone', blocks: [block('A', 1, 0, [station('a', 20, 0)])] });
    expect(kinds(w)).toEqual(['prepare', 'work', 'done']);
  });
});

describe('next preview', () => {
  const tl = buildTimeline(fullBodyStarter(), data);

  it('rest shows the next station', () => {
    const i = tl.findIndex((p) => p.kind === 'rest');
    expect(tl[i - 1].exerciseId).toBe('goblet-squat');
    expect(tl[i].next).toEqual({ exerciseId: 'push-up', label: 'WORK', durationSec: 40 });
  });

  it('work shows the next exercise, not the rest', () => {
    const w = tl.find((p) => p.kind === 'work')!;
    expect(w.next?.exerciseId).toBe('push-up');
  });

  it('prepare shows the first warm-up item', () => {
    expect(tl[0].next).toEqual({ exerciseId: 'jumping-jacks', label: 'WARM-UP', durationSec: 45 });
  });

  it('last exercise shows DONE; done has no next', () => {
    const t = buildTimeline(workout({ blocks: [block('A', 1, 0, [station('a', 20, 0)])] }), data);
    expect(t[1].next).toEqual({ exerciseId: undefined, label: 'DONE', durationSec: 0 });
    expect(t[2].next).toBeUndefined();
  });

  it('Tabata round rest shows the same exercise again', () => {
    const t = buildTimeline(tabataX4(), data);
    const rr = t.find((p) => p.kind === 'roundRest')!;
    expect(rr.next?.exerciseId).toBe('burpee');
  });
});

describe('routineSec', () => {
  it('matches the warm-up and cool-down time in the built timeline', () => {
    for (const r of routines) {
      const w = workout({
        prepareSec: 0,
        warmupId: r.kind === 'warmup' ? r.id : null,
        cooldownId: r.kind === 'cooldown' ? r.id : null,
        blocks: [block('A', 1, 0, [station('x', 30, 0)])],
      });
      const t = buildTimeline(w, { routines });
      const section = t.filter((p) => p.section === r.kind && p.kind !== 'done');
      expect(routineSec(r)).toBe(section.reduce((s, p) => s + p.durationSec, 0));
    }
  });

  it('is 0 for an empty routine', () => {
    expect(routineSec({ id: 'e', kind: 'warmup', name: 'e', items: [], transitionSec: 5 })).toBe(0);
    expect(routineSec({ id: 'e', kind: 'cooldown', name: 'e', items: [], transitionSec: 5 })).toBe(0);
  });
});
