// Turns a workout into a flat list of phases (SPEC 6.1).
// Pure TypeScript: no React, no DOM, no clock.

import type { ID, Routine, Workout } from '../data/schema';

export type PhaseKind =
  | 'prepare'
  | 'warmup'
  | 'transition'
  | 'work'
  | 'rest'
  | 'roundRest'
  | 'blockRest'
  | 'cooldown'
  | 'done';

export interface NextPreview {
  exerciseId?: ID;
  label: string;
  durationSec: number;
}

export interface Phase {
  kind: PhaseKind;
  durationSec: number;
  exerciseId?: ID;
  label: string; // big word on screen: "WORK", "REST", "GET READY"
  section: 'warmup' | 'circuit' | 'cooldown';
  blockIndex?: number; // 0-based (use it to find the block name)
  blocksTotal?: number;
  round?: number; // 1-based
  roundsTotal?: number;
  station?: number; // 1-based
  stationsTotal?: number;
  /** The next exercise (what the "NEXT" band shows). On the last exercise: the done phase. */
  next?: NextPreview;
}

export const LABELS: Record<PhaseKind, string> = {
  prepare: 'GET READY',
  warmup: 'WARM-UP',
  transition: 'GET READY',
  work: 'WORK',
  rest: 'REST',
  roundRest: 'ROUND REST',
  blockRest: 'BLOCK REST',
  cooldown: 'COOL-DOWN',
  done: 'DONE',
};

/** Rest phases: the only phases where "+10 s" works. */
export const REST_KINDS: readonly PhaseKind[] = ['rest', 'roundRest', 'blockRest'];

/** Phases that name an exercise. */
const EXERCISE_KINDS: readonly PhaseKind[] = ['warmup', 'work', 'cooldown'];

type Draft = Omit<Phase, 'label' | 'next'>;

function findRoutine(routines: Routine[], id: ID | null, kind: Routine['kind']): Routine | null {
  if (!id) return null;
  return routines.find((r) => r.id === id && r.kind === kind) ?? null;
}

export function buildTimeline(workout: Workout, data: { routines: Routine[] }): Phase[] {
  const out: Draft[] = [];
  const warmup = findRoutine(data.routines, workout.warmupId, 'warmup');
  const cooldown = findRoutine(data.routines, workout.cooldownId, 'cooldown');
  const warmItems = warmup?.items ?? [];
  const coolItems = cooldown?.items ?? [];

  // 1. Get ready.
  out.push({ kind: 'prepare', durationSec: workout.prepareSec, section: warmItems.length ? 'warmup' : 'circuit' });

  // 2. Warm-up items, with transitions between them.
  warmItems.forEach((item, i) => {
    if (i > 0) out.push({ kind: 'transition', durationSec: warmup!.transitionSec, section: 'warmup' });
    out.push({ kind: 'warmup', durationSec: item.workSec, exerciseId: item.exerciseId, section: 'warmup' });
  });

  // 3. Transition into the circuit. Only after a warm-up: without one, the prepare
  //    phase already does this job, and two "GET READY" phases in a row would be odd.
  if (warmItems.length) out.push({ kind: 'transition', durationSec: workout.prepareSec, section: 'circuit' });

  // 4. Blocks → rounds → stations.
  const blocks = workout.blocks;
  blocks.forEach((block, b) => {
    const lastBlock = b === blocks.length - 1;
    for (let r = 1; r <= block.rounds; r++) {
      const lastRound = r === block.rounds;
      block.stations.forEach((st, s) => {
        const lastStation = s === block.stations.length - 1;
        const where = {
          section: 'circuit' as const,
          blockIndex: b,
          blocksTotal: blocks.length,
          round: r,
          roundsTotal: block.rounds,
          station: s + 1,
          stationsTotal: block.stations.length,
        };
        out.push({ kind: 'work', durationSec: st.workSec, exerciseId: st.exerciseId, ...where });
        if (!lastStation) out.push({ kind: 'rest', durationSec: st.restSec, ...where });
        else if (!lastRound) out.push({ kind: 'roundRest', durationSec: block.restBetweenRoundsSec, ...where });
        else if (!lastBlock) out.push({ kind: 'blockRest', durationSec: workout.restBetweenBlocksSec, ...where });
        // Last station, last round, last block: no rest.
      });
    }
  });

  // 5. Cool-down: a transition into it, then items with transitions between.
  for (const item of coolItems) {
    out.push({ kind: 'transition', durationSec: cooldown!.transitionSec, section: 'cooldown' });
    out.push({ kind: 'cooldown', durationSec: item.workSec, exerciseId: item.exerciseId, section: 'cooldown' });
  }

  // Skip any phase with duration 0. (Done is added after this, and is always 0.)
  const kept = out.filter((p) => p.durationSec > 0);

  // 6. Done.
  const last = kept[kept.length - 1];
  kept.push({ kind: 'done', durationSec: 0, section: last ? last.section : 'circuit' });

  // Labels, and "next" = the next phase that names an exercise (or done).
  const phases: Phase[] = kept.map((p) => ({ ...p, label: LABELS[p.kind] }));
  let upcoming: NextPreview | undefined;
  for (let i = phases.length - 1; i >= 0; i--) {
    const p = phases[i];
    if (p.kind !== 'done') p.next = upcoming;
    if (p.kind === 'done' || EXERCISE_KINDS.includes(p.kind)) {
      upcoming = { exerciseId: p.exerciseId, label: p.label, durationSec: p.durationSec };
    }
  }
  return phases;
}

/** Total time of all phases, in seconds. */
export function totalSec(timeline: Phase[]): number {
  return timeline.reduce((sum, p) => sum + p.durationSec, 0);
}

/** Circuit time only: work and rests. No prepare, warm-up, cool-down or transitions (SPEC 6.4). */
export function circuitSec(timeline: Phase[]): number {
  return timeline
    .filter((p) => p.kind === 'work' || REST_KINDS.includes(p.kind))
    .reduce((sum, p) => sum + p.durationSec, 0);
}

/**
 * Time a warm-up or cool-down adds to a workout, as buildTimeline lays it out:
 * a warm-up has gaps between items; a cool-down also has one gap before its first item.
 */
export function routineSec(routine: Routine): number {
  const n = routine.items.length;
  const items = routine.items.reduce((sum, it) => sum + it.workSec, 0);
  const gaps = routine.kind === 'warmup' ? Math.max(0, n - 1) : n;
  return items + gaps * routine.transitionSec;
}
