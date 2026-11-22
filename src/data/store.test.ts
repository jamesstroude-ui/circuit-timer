import { describe, expect, it } from 'vitest';
import { BACKUP_PREFIX, DATA_KEY, OLD_SESSION_KEY, loadData, memoryKeyValue, saveData } from './store';
import { MigrationError, migrate } from './migrations';
import { setExerciseHidden } from './ops';

const NOW = new Date('2026-11-22T10:00:00.000Z');
const backupKey = BACKUP_PREFIX + NOW.toISOString();

describe('loadData', () => {
  it('first run: saves the starter content', () => {
    const kv = memoryKeyValue();
    const { data, notice } = loadData(kv, NOW);
    expect(notice).toBeUndefined();
    expect(data.schemaVersion).toBe(1);
    expect(data.exercises).toHaveLength(46);
    expect(data.routines).toHaveLength(4);
    expect(data.workouts.map((w) => w.name)).toEqual(['Full Body Starter', 'Tabata x4', 'Strength Pairs']);
    expect(data.profiles.map((p) => p.name)).toEqual(['Jim', 'Son']);
    expect(JSON.parse(kv.dump()[DATA_KEY])).toEqual(data);
  });

  it('edits survive a reload (the Stage 4 "done when" check)', () => {
    const kv = memoryKeyValue();
    const first = loadData(kv, NOW).data;
    const edited = setExerciseHidden(first, 'burpee', true);
    edited.exercises[0] = { ...edited.exercises[0], cue: 'My own cue' };
    expect(saveData(kv, edited)).toBe(true);

    const again = loadData(kv, NOW).data;
    expect(again.exercises.find((e) => e.id === 'burpee')!.hidden).toBe(true);
    expect(again.exercises[0].cue).toBe('My own cue');
  });

  it('unreadable data: keeps a backup, starts from starter content, tells Jim', () => {
    const kv = memoryKeyValue({ [DATA_KEY]: '{not json' });
    const { data, notice } = loadData(kv, NOW);
    expect(kv.dump()[backupKey]).toBe('{not json');
    expect(data.exercises).toHaveLength(46);
    expect(notice).toMatch(/could not be read/);
  });

  it('data from a newer app version is backed up, not lost', () => {
    const newer = JSON.stringify({ schemaVersion: 99, exercises: [] });
    const kv = memoryKeyValue({ [DATA_KEY]: newer });
    loadData(kv, NOW);
    expect(kv.dump()[backupKey]).toBe(newer);
  });

  it('fills in missing settings with the defaults', () => {
    const kv = memoryKeyValue();
    const d = loadData(kv, NOW).data;
    const partial = { ...d, settings: { voiceOn: false } };
    kv.setItem(DATA_KEY, JSON.stringify(partial));
    const again = loadData(kv, NOW).data;
    expect(again.settings.voiceOn).toBe(false);
    expect(again.settings.defaultWorkSec).toBe(40);
  });

  it('moves the Stage 3 running-workout key into activeSession', () => {
    const session = {
      workoutId: 'full-body-starter', timelineIndex: 5, phaseEndsAt: 123, remainingMsWhenPaused: null,
      startedAt: '2026-11-22T09:00:00.000Z',
    };
    const kv = memoryKeyValue({ [OLD_SESSION_KEY]: JSON.stringify(session) });
    const { data } = loadData(kv, NOW);
    expect(data.activeSession).toEqual(session);
    expect(kv.dump()[OLD_SESSION_KEY]).toBeUndefined();
    expect(JSON.parse(kv.dump()[DATA_KEY]).activeSession).toEqual(session);
  });
});

describe('migrate', () => {
  it('runs each step from the saved version up to the current one', () => {
    const steps = {
      0: (d: Record<string, unknown>) => ({ ...d, a: 1 }),
      1: (d: Record<string, unknown>) => ({ ...d, b: 2 }),
    };
    const { data, fromVersion } = migrate({ schemaVersion: 0 }, steps, 2);
    expect(fromVersion).toBe(0);
    expect(data).toMatchObject({ schemaVersion: 2, a: 1, b: 2 });
  });

  it('refuses data it cannot read', () => {
    expect(() => migrate(null)).toThrow(MigrationError);
    expect(() => migrate([])).toThrow(MigrationError);
    expect(() => migrate({})).toThrow(MigrationError);
    expect(() => migrate({ schemaVersion: 2 })).toThrow(/newer/);
    expect(() => migrate({ schemaVersion: 0 }, {}, 1)).toThrow(/No migration/);
  });

  it('an older version keeps a backup before it is migrated', () => {
    // Version 0 has no real migration, so the load falls back to starter content,
    // but the original must still be kept.
    const old = JSON.stringify({ schemaVersion: 0, exercises: [] });
    const kv = memoryKeyValue({ [DATA_KEY]: old });
    loadData(kv, NOW);
    expect(kv.dump()[backupKey]).toBe(old);
  });
});
