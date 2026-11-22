import { describe, expect, it } from 'vitest';
import { fullBodyStarter, starterExercises, starterRoutines, starterWorkouts, strengthPairs, tabataX4 } from './starter';
import { buildTimeline, circuitSec } from '../engine/timeline';

describe('starter content (SPEC 9)', () => {
  const ids = new Set(starterExercises.map((e) => e.id));

  it('has 46 exercises with unique IDs', () => {
    expect(starterExercises).toHaveLength(46);
    expect(ids.size).toBe(starterExercises.length);
  });

  it('every routine and workout item points at a real exercise', () => {
    for (const r of starterRoutines) for (const item of r.items) expect(ids).toContain(item.exerciseId);
    for (const w of starterWorkouts) for (const b of w.blocks) for (const s of b.stations) expect(ids).toContain(s.exerciseId);
  });

  it('flags: goblet squat tracks load; step-up and leg swings switch sides', () => {
    const by = (id: string) => starterExercises.find((e) => e.id === id)!;
    expect(by('goblet-squat').tracksLoad).toBe(true);
    expect(by('step-up')).toMatchObject({ tracksLoad: true, switchSides: true });
    expect(by('leg-swings').switchSides).toBe(true);
    expect(by('worlds-greatest-stretch').switchSides).toBe(true);
    expect(by('childs-pose').switchSides).toBe(false);
  });

  it('Full Body Starter circuit is 25:00', () => {
    expect(circuitSec(buildTimeline(fullBodyStarter, { routines: starterRoutines }))).toBe(1500);
  });
});

describe('starter workouts match the SPEC 6.4 fixtures', () => {
  const t = (w: typeof fullBodyStarter) => circuitSec(buildTimeline(w, { routines: starterRoutines }));
  it('Tabata x4 circuit is 18:20', () => expect(t(tabataX4)).toBe(1100));
  it('Strength Pairs circuit is 22:00', () => expect(t(strengthPairs)).toBe(1320));
  it('all IDs are unique', () => {
    const ids = starterWorkouts.flatMap((w) => [w.id, ...w.blocks.flatMap((b) => [b.id, ...b.stations.map((s) => s.id)])]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
