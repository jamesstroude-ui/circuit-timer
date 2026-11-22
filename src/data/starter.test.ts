import { describe, expect, it } from 'vitest';
import { fullBodyStarter, starterExercises, starterRoutines } from './starter';
import { buildTimeline, circuitSec } from '../engine/timeline';

describe('starter content (SPEC 9)', () => {
  const ids = new Set(starterExercises.map((e) => e.id));

  it('has 46 exercises with unique IDs', () => {
    expect(starterExercises).toHaveLength(46);
    expect(ids.size).toBe(starterExercises.length);
  });

  it('every routine and workout item points at a real exercise', () => {
    for (const r of starterRoutines) for (const item of r.items) expect(ids).toContain(item.exerciseId);
    for (const b of fullBodyStarter.blocks) for (const s of b.stations) expect(ids).toContain(s.exerciseId);
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
