// Starter content from SPEC Section 9. Built-in items use fixed, readable IDs
// (for example "goblet-squat") so saved sessions and logs keep pointing at them.
// The storage module copies this into the saved data on first run (src/data/store.ts).

import type { AppData, Block, Exercise, Profile, Routine, Settings, Workout } from './schema';

type Row = [name: string, cue: string, equipment: Exercise['equipment'], flags?: string];

const slug = (name: string) =>
  name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function rows(category: Exercise['category'], list: Row[]): Exercise[] {
  return list.map(([name, cue, equipment, flags = '']) => ({
    id: slug(name),
    name,
    cue,
    category,
    equipment,
    switchSides: flags.includes('S'),
    tracksLoad: flags.includes('L'),
    builtIn: true,
    hidden: false,
  }));
}

export const starterExercises: Exercise[] = [
  ...rows('strength', [
    ['Goblet squat', 'Chest up, knees out', 'dumbbell', 'L'],
    ['Bodyweight squat', 'Sit back, heels down', 'none'],
    ['Reverse lunge', 'Step back, front knee over ankle', 'none'],
    ['Walking lunge', 'Long step, torso tall', 'dumbbell', 'L'],
    ['Glute bridge', 'Squeeze at the top, ribs down', 'none'],
    ['Kettlebell swing', 'Hinge, snap hips, arms loose', 'kettlebell', 'L'],
    ['Romanian deadlift', 'Soft knees, flat back, hips back', 'dumbbell', 'L'],
    ['Step-up', 'Drive through the top foot', 'dumbbell', 'L S'],
    ['Wall sit', 'Thighs level, back flat', 'none'],
    ['Push-up', 'Body straight, chest low', 'none'],
    ['Incline push-up', 'Hands on bench, body straight', 'none'],
    ['Dumbbell floor press', 'Elbows at 45°, press up', 'dumbbell', 'L'],
    ['Bent-over row', 'Flat back, elbow to hip', 'dumbbell', 'L'],
    ['Overhead press', 'Ribs down, press straight up', 'dumbbell', 'L'],
    ['Renegade row', 'Hips square, slow pull', 'dumbbell', 'L'],
    ['Biceps curl', 'Elbows still', 'dumbbell', 'L'],
    ['Bench dip', 'Shoulders down, elbows back', 'none'],
    ["Farmer's carry", 'Stand tall, walk steady', 'dumbbell', 'L'],
  ]),
  ...rows('cardio', [
    ['Burpee', 'Chest down, jump at the top', 'none'],
    ['Jumping jacks', 'Light feet, full arm reach', 'none'],
    ['Mountain climbers', 'Hips level, drive knees', 'none'],
    ['High knees', 'Knees to hip height, quick feet', 'none'],
    ['Skaters', 'Land soft, reach across', 'none'],
    ['Squat jump', 'Land soft, sit back', 'none'],
    ['Rowing machine', 'Legs, body, arms', 'machine'],
    ['Bike sprint', 'Fast legs, steady upper body', 'machine'],
    ['Skipping', 'Small jumps, wrists turn', 'other'],
  ]),
  ...rows('core', [
    ['Plank', 'Straight line, squeeze glutes', 'none'],
    ['Side plank', 'Hips high, body straight', 'none', 'S'],
    ['Dead bug', 'Lower back on the floor', 'none'],
    ['Russian twist', 'Chest up, turn from the ribs', 'none'],
    ['Hollow hold', 'Lower back down, arms long', 'none'],
    ['Bicycle crunch', 'Slow, elbow to opposite knee', 'none'],
    ['Superman', 'Lift chest and legs, look down', 'none'],
  ]),
  ...rows('mobility', [
    ['Arm circles', 'Big, slow circles', 'none'],
    ['Leg swings', 'Hold support, swing loose', 'none', 'S'],
    ["World's greatest stretch", 'Lunge, elbow down, rotate up', 'none', 'S'],
    ['Inchworm', 'Walk hands out, walk back', 'none'],
    ['Cat-cow', 'Round up, then arch', 'none'],
    ['Hamstring stretch', 'Hinge, flat back', 'none', 'S'],
    ['Quad stretch', 'Knees together, hips forward', 'none', 'S'],
    ['Hip flexor stretch', 'Tuck pelvis, lean forward', 'none', 'S'],
    ['Figure-four glute stretch', 'Ankle on knee, sit back', 'none', 'S'],
    ['Cross-body shoulder stretch', 'Arm across, shoulder down', 'none', 'S'],
    ["Child's pose", 'Hips to heels, breathe', 'none'],
    ['Chest stretch', 'Arm on wall, turn away', 'none', 'S'],
  ]),
];

function routine(id: string, kind: Routine['kind'], name: string, items: [string, number][]): Routine {
  return { id, kind, name, transitionSec: 5, items: items.map(([ex, workSec]) => ({ exerciseId: slug(ex), workSec })) };
}

export const starterRoutines: Routine[] = [
  routine('general-warmup', 'warmup', 'General warm-up', [
    ['Jumping jacks', 45], ['Arm circles', 30], ['Leg swings', 40], ['Bodyweight squat', 40],
    ['Inchworm', 45], ["World's greatest stretch", 60], ['High knees', 30],
  ]),
  routine('quick-warmup', 'warmup', 'Quick warm-up', [
    ['Jumping jacks', 40], ['Arm circles', 30], ['Bodyweight squat', 40], ['Inchworm', 40], ['High knees', 30],
  ]),
  routine('full-stretch', 'cooldown', 'Full stretch', [
    ["Child's pose", 45], ['Cat-cow', 45], ['Hamstring stretch', 60], ['Quad stretch', 60],
    ['Hip flexor stretch', 60], ['Cross-body shoulder stretch', 40],
  ]),
  routine('quick-stretch', 'cooldown', 'Quick stretch', [
    ['Hamstring stretch', 50], ['Quad stretch', 50], ["Child's pose", 40], ['Chest stretch', 40],
  ]),
];

function block(
  workoutId: string, letter: string, rounds: number, roundRest: number,
  names: string[], workSec: number, restSec: number,
): Block {
  const id = `${workoutId}-${letter.toLowerCase()}`;
  return {
    id,
    name: `Block ${letter}`,
    rounds,
    restBetweenRoundsSec: roundRest,
    stations: names.map((ex, i) => ({ id: `${id}-${i + 1}`, exerciseId: slug(ex), workSec, restSec })),
  };
}

/** SPEC 9.4. */
export const fullBodyStarter: Workout = {
  id: 'full-body-starter',
  name: 'Full Body Starter',
  prepareSec: 10,
  warmupId: 'general-warmup',
  restBetweenBlocksSec: 60,
  cooldownId: 'full-stretch',
  blocks: [
    block('full-body-starter', 'A', 3, 60, [
      'Goblet squat', 'Push-up', 'Kettlebell swing', 'Bent-over row',
      'Reverse lunge', 'Plank', 'Mountain climbers', 'Glute bridge',
    ], 40, 20),
  ],
};

export const tabataX4: Workout = {
  id: 'tabata-x4',
  name: 'Tabata x4',
  prepareSec: 10,
  warmupId: 'quick-warmup',
  restBetweenBlocksSec: 60,
  cooldownId: 'quick-stretch',
  // One station per block: the station rest is never used (the round rest is).
  blocks: ['Burpee', 'Kettlebell swing', 'Mountain climbers', 'Squat jump'].map((ex, i) =>
    block('tabata-x4', 'ABCD'[i], 8, 10, [ex], 20, 10),
  ),
};

export const strengthPairs: Workout = {
  id: 'strength-pairs',
  name: 'Strength Pairs',
  prepareSec: 10,
  warmupId: 'general-warmup',
  restBetweenBlocksSec: 90,
  cooldownId: 'full-stretch',
  blocks: [
    block('strength-pairs', 'A', 3, 60, ['Goblet squat', 'Bent-over row', 'Push-up'], 45, 15),
    block('strength-pairs', 'B', 3, 60, ['Romanian deadlift', 'Overhead press', 'Dead bug'], 45, 15),
  ],
};

export const starterWorkouts: Workout[] = [fullBodyStarter, tabataX4, strengthPairs];

export const starterProfiles: Profile[] = [
  { id: 'profile-1', name: 'Jim', colour: '#FFB300' },
  { id: 'profile-2', name: 'Son', colour: '#14B8A6' },
];

/** SPEC 5 defaults. Stage 7 makes these editable. */
export const defaultSettings: Settings = {
  defaultWorkSec: 40,
  defaultRestSec: 20,
  defaultPrepareSec: 10,
  voiceOn: true,
  voiceRate: 1,
  beepsOn: true,
  countdownBeepsSec: 3,
  tenSecondWarning: true,
  halfwayCall: false,
  keepScreenOn: true,
};

/** A fresh copy of all starter content: what a new install saves on first run. */
export function makeStarterData(): AppData {
  const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
  return {
    schemaVersion: 1,
    exercises: copy(starterExercises),
    routines: copy(starterRoutines),
    workouts: copy(starterWorkouts),
    profiles: copy(starterProfiles),
    logs: [],
    settings: copy(defaultSettings),
  };
}
