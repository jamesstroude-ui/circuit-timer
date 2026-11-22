// Test data: the starter workouts and routines from SPEC 9.2–9.4.
// Used by the engine tests only. (Stage 4 builds the real starter content.)

import type { Block, Routine, Station, Workout } from '../data/schema';

let n = 0;
const id = (prefix: string) => `${prefix}-${++n}`;

export function station(exerciseId: string, workSec: number, restSec: number): Station {
  return { id: id('st'), exerciseId, workSec, restSec };
}

export function block(name: string, rounds: number, restBetweenRoundsSec: number, stations: Station[]): Block {
  return { id: id('bl'), name, rounds, restBetweenRoundsSec, stations };
}

export function workout(w: Partial<Workout> & Pick<Workout, 'blocks'>): Workout {
  return {
    id: id('wo'),
    name: 'Test',
    prepareSec: 10,
    warmupId: null,
    restBetweenBlocksSec: 0,
    cooldownId: null,
    ...w,
  };
}

function routine(rid: string, kind: Routine['kind'], items: [string, number][]): Routine {
  return { id: rid, kind, name: rid, transitionSec: 5, items: items.map(([exerciseId, workSec]) => ({ exerciseId, workSec })) };
}

export const routines: Routine[] = [
  routine('general-warmup', 'warmup', [
    ['jumping-jacks', 45], ['arm-circles', 30], ['leg-swings', 40], ['bodyweight-squat', 40],
    ['inchworm', 45], ['worlds-greatest-stretch', 60], ['high-knees', 30],
  ]),
  routine('quick-warmup', 'warmup', [
    ['jumping-jacks', 40], ['arm-circles', 30], ['bodyweight-squat', 40], ['inchworm', 40], ['high-knees', 30],
  ]),
  routine('full-stretch', 'cooldown', [
    ['childs-pose', 45], ['cat-cow', 45], ['hamstring-stretch', 60], ['quad-stretch', 60],
    ['hip-flexor-stretch', 60], ['cross-body-shoulder-stretch', 40],
  ]),
  routine('quick-stretch', 'cooldown', [
    ['hamstring-stretch', 50], ['quad-stretch', 50], ['childs-pose', 40], ['chest-stretch', 40],
  ]),
];

const fullBodyExercises = [
  'goblet-squat', 'push-up', 'kettlebell-swing', 'bent-over-row',
  'reverse-lunge', 'plank', 'mountain-climbers', 'glute-bridge',
];

export const fullBodyStarter = (): Workout =>
  workout({
    name: 'Full Body Starter',
    warmupId: 'general-warmup',
    cooldownId: 'full-stretch',
    blocks: [block('Block A', 3, 60, fullBodyExercises.map((e) => station(e, 40, 20)))],
  });

export const tabataX4 = (): Workout =>
  workout({
    name: 'Tabata x4',
    warmupId: 'quick-warmup',
    cooldownId: 'quick-stretch',
    restBetweenBlocksSec: 60,
    // One station per block, so the station rest is never used (it is always the last station).
    blocks: ['burpee', 'kettlebell-swing', 'mountain-climbers', 'squat-jump'].map((e, i) =>
      block(`Block ${'ABCD'[i]}`, 8, 10, [station(e, 20, 10)]),
    ),
  });

export const strengthPairs = (): Workout =>
  workout({
    name: 'Strength Pairs',
    warmupId: 'general-warmup',
    cooldownId: 'full-stretch',
    restBetweenBlocksSec: 90,
    blocks: [
      block('Block A', 3, 60, ['goblet-squat', 'bent-over-row', 'push-up'].map((e) => station(e, 45, 15))),
      block('Block B', 3, 60, ['romanian-deadlift', 'overhead-press', 'dead-bug'].map((e) => station(e, 45, 15))),
    ],
  });
