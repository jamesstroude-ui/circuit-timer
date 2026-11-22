import { describe, expect, it } from 'vitest';
import { makeStarterData } from './starter';
import {
  blankExercise, blankRoutine, cannotDeleteExercise, cannotDeleteRoutine, clampSec, deleteExercise,
  deleteRoutine, duplicateRoutine, exerciseUsage, moveItem, routineProblems, sameNameExercise,
  saveExercise, saveRoutine, setExerciseHidden, blankBlock, blankWorkout, blockName, deleteWorkout,
  duplicateWorkout, lastUsedWorkout, newStations, recentExerciseIds, saveWorkout, setAllStations, sharedValue,
  workoutProblems, workoutsByRecent, renameDefaultBlocks,
} from './ops';

describe('exercises', () => {
  it('adds a new exercise and trims the text', () => {
    const d = makeStarterData();
    const ex = { ...blankExercise(), name: '  Sled push ', cue: ' Low and fast ' };
    const out = saveExercise(d, ex);
    expect(out.exercises).toHaveLength(47);
    expect(out.exercises[46]).toMatchObject({ name: 'Sled push', cue: 'Low and fast', builtIn: false });
    expect(d.exercises).toHaveLength(46); // the old data is not changed
  });

  it('edits an exercise in place, keeping its ID', () => {
    const d = makeStarterData();
    const squat = d.exercises.find((e) => e.id === 'goblet-squat')!;
    const out = saveExercise(d, { ...squat, cue: 'Elbows inside knees' });
    expect(out.exercises.find((e) => e.id === 'goblet-squat')!.cue).toBe('Elbows inside knees');
    expect(out.exercises).toHaveLength(46);
  });

  it('hides and shows', () => {
    const d = setExerciseHidden(makeStarterData(), 'burpee', true);
    expect(d.exercises.find((e) => e.id === 'burpee')!.hidden).toBe(true);
    expect(setExerciseHidden(d, 'burpee', false).exercises.find((e) => e.id === 'burpee')!.hidden).toBe(false);
  });

  it('lists where an exercise is used', () => {
    const d = makeStarterData();
    expect(exerciseUsage(d, 'jumping-jacks')).toEqual(['General warm-up', 'Quick warm-up']);
    expect(exerciseUsage(d, 'goblet-squat')).toEqual(['Full Body Starter', 'Strength Pairs']);
    expect(exerciseUsage(d, 'wall-sit')).toEqual([]);
  });

  it('never deletes a starter exercise', () => {
    const d = makeStarterData();
    expect(cannotDeleteExercise(d, 'wall-sit')).toMatch(/hide/);
    expect(() => deleteExercise(d, 'wall-sit')).toThrow();
  });

  it('deletes an own exercise only when nothing uses it', () => {
    const ex = { ...blankExercise(), name: 'Sled push' };
    let d = saveExercise(makeStarterData(), ex);
    const warm = { ...blankRoutine('warmup'), name: 'Mine', items: [{ exerciseId: ex.id, workSec: 30 }] };
    d = saveRoutine(d, warm);
    expect(cannotDeleteExercise(d, ex.id)).toMatch(/Used in: Mine/);
    d = deleteRoutine(d, warm.id);
    expect(cannotDeleteExercise(d, ex.id)).toBeNull();
    expect(deleteExercise(d, ex.id).exercises.some((e) => e.id === ex.id)).toBe(false);
  });

  it('finds a duplicate name, ignoring case and spaces', () => {
    const d = makeStarterData();
    expect(sameNameExercise(d, { ...blankExercise(), name: ' goblet  SQUAT ' })?.id).toBe('goblet-squat');
    const squat = d.exercises.find((e) => e.id === 'goblet-squat')!;
    expect(sameNameExercise(d, squat)).toBeUndefined(); // itself does not count
  });
});

describe('warm-ups and cool-downs', () => {
  it('cannot delete one a workout uses', () => {
    const d = makeStarterData();
    expect(cannotDeleteRoutine(d, 'general-warmup')).toMatch(/Full Body Starter, Strength Pairs/);
    expect(() => deleteRoutine(d, 'general-warmup')).toThrow();
  });

  it('duplicates with a new ID and its own item list', () => {
    const d = makeStarterData();
    const { data, id } = duplicateRoutine(d, 'quick-stretch');
    const copy = data.routines.find((r) => r.id === id)!;
    expect(copy.name).toBe('Quick stretch (copy)');
    expect(copy.kind).toBe('cooldown');
    expect(cannotDeleteRoutine(data, id)).toBeNull();
    copy.items[0].workSec = 999;
    expect(data.routines.find((r) => r.id === 'quick-stretch')!.items[0].workSec).toBe(50);
  });

  it('needs a name and at least one exercise', () => {
    expect(routineProblems(blankRoutine('warmup'))).toEqual(['Give it a name.', 'Add at least one exercise.']);
    expect(routineProblems(makeStarterData().routines[0])).toEqual([]);
  });
});

describe('helpers', () => {
  it('moveItem swaps neighbours and ignores moves off the ends', () => {
    expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
    const list = ['a', 'b'];
    expect(moveItem(list, 0, -1)).toBe(list);
    expect(moveItem(list, 1, 1)).toBe(list);
  });

  it('clampSec keeps a value in range and whole', () => {
    expect(clampSec(3, 5, 600)).toBe(5);
    expect(clampSec(700, 5, 600)).toBe(600);
    expect(clampSec(42.6, 5, 600)).toBe(43);
    expect(clampSec(NaN, 5, 600)).toBe(5);
  });
});

describe('workouts', () => {
  const settings = makeStarterData().settings;

  it('a new workout has one empty block and the default prepare time', () => {
    const w = blankWorkout(settings);
    expect(w.prepareSec).toBe(10);
    expect(w.blocks).toHaveLength(1);
    expect(w.blocks[0]).toMatchObject({ name: 'Block A', rounds: 3, restBetweenRoundsSec: 60, stations: [] });
    expect(workoutProblems(w)).toEqual(['Give the workout a name.', 'Block A has no exercises.']);
  });

  it('new stations use the defaults, then copy the last station', () => {
    let b = blankBlock(0);
    b = { ...b, stations: newStations(b, ['push-up', 'plank'], settings) };
    expect(b.stations.map((s) => [s.workSec, s.restSec])).toEqual([[40, 20], [40, 20]]);
    b = setAllStations(b, { workSec: 45, restSec: 15 });
    const more = newStations(b, ['burpee'], settings);
    expect(more[0]).toMatchObject({ exerciseId: 'burpee', workSec: 45, restSec: 15 });
    expect(new Set([...b.stations, ...more].map((s) => s.id)).size).toBe(3);
  });

  it('sharedValue is null when stations differ', () => {
    let b = { ...blankBlock(0), stations: newStations(blankBlock(0), ['a', 'b'], settings) };
    expect(sharedValue(b, 'workSec')).toBe(40);
    b = { ...b, stations: [b.stations[0], { ...b.stations[1], workSec: 30 }] };
    expect(sharedValue(b, 'workSec')).toBeNull();
    expect(sharedValue(blankBlock(0), 'restSec')).toBeNull();
  });

  it('block names go A, B, C …', () => {
    expect([0, 1, 25, 26].map(blockName)).toEqual(['Block A', 'Block B', 'Block Z', 'Block 27']);
  });

  it('saves, duplicates with new IDs, and deletes', () => {
    let d = makeStarterData();
    const { data, id } = duplicateWorkout(d, 'strength-pairs');
    const copy = data.workouts.find((w) => w.id === id)!;
    const orig = data.workouts.find((w) => w.id === 'strength-pairs')!;
    expect(copy.name).toBe('Strength Pairs (copy)');
    expect(copy.blocks[0].id).not.toBe(orig.blocks[0].id);
    expect(copy.blocks[0].stations[0].id).not.toBe(orig.blocks[0].stations[0].id);
    expect(copy.blocks[0].stations[0].exerciseId).toBe('goblet-squat');
    d = saveWorkout(data, { ...copy, name: '  Mine  ' });
    expect(d.workouts.find((w) => w.id === id)!.name).toBe('Mine');
    expect(deleteWorkout(d, id).workouts.some((w) => w.id === id)).toBe(false);
  });

  it('cannot delete the running workout', () => {
    const d = { ...makeStarterData(), activeSession: {
      workoutId: 'tabata-x4', timelineIndex: 0, phaseEndsAt: 1, remainingMsWhenPaused: null, startedAt: '',
    } };
    expect(() => deleteWorkout(d, 'tabata-x4')).toThrow();
  });

  it('orders by last used, and finds recent exercises', () => {
    let d = makeStarterData();
    expect(lastUsedWorkout(d)).toBeUndefined();
    expect(workoutsByRecent(d).map((w) => w.id)).toEqual(['full-body-starter', 'tabata-x4', 'strength-pairs']);
    d = { ...d, workouts: d.workouts.map((w) => (w.id === 'tabata-x4' ? { ...w, lastUsedAt: '2026-11-22T10:00:00Z' } : w)) };
    expect(lastUsedWorkout(d)?.id).toBe('tabata-x4');
    expect(workoutsByRecent(d)[0].id).toBe('tabata-x4');
    d = setExerciseHidden(d, 'squat-jump', true);
    expect(recentExerciseIds(d)).toEqual(['burpee', 'kettlebell-swing', 'mountain-climbers']);
    const own = { ...blankExercise(), name: 'Sled push' };
    expect(recentExerciseIds(saveExercise(d, own))).toContain(own.id);
  });
});

describe('renameDefaultBlocks', () => {
  it('renames default names only', () => {
    const b = (name: string) => ({ ...blankBlock(0), name });
    const out = renameDefaultBlocks([b('Block C'), b('Legs'), b('Block A')]);
    expect(out.map((x) => x.name)).toEqual(['Block A', 'Legs', 'Block C']);
  });
});
