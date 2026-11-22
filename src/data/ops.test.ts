import { describe, expect, it } from 'vitest';
import { makeStarterData } from './starter';
import {
  blankExercise, blankRoutine, cannotDeleteExercise, cannotDeleteRoutine, clampSec, deleteExercise,
  deleteRoutine, duplicateRoutine, exerciseUsage, moveItem, routineProblems, sameNameExercise,
  saveExercise, saveRoutine, setExerciseHidden,
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
