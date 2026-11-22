// What to say and beep, and when (SPEC 7). Pure TypeScript: the player asks
// "which cues now?" and the audio code plays them.
//
// Two kinds of cue:
//  - entryCue: when a phase starts ("Go. Push-up." + long beep).
//  - tickCues: when time left crosses a mark in the same phase
//    (3-2-1 beeps, "Ten seconds.", "Halfway.", "Switch sides.").

import type { ID } from '../data/schema';
import { REST_KINDS, type Phase } from './timeline';

export type CueBeep = 'short' | 'long' | 'double' | 'triple';

export interface Cue {
  say?: string;
  beep?: CueBeep;
}

export interface CueContext {
  exerciseName: (id: ID | undefined) => string;
  switchSides: (id: ID | undefined) => boolean;
  blockName: (blockIndex: number) => string;
  countdownBeepsSec: number; // 3
  tenSecondWarning: boolean; // true
  halfwayCall: boolean; // false
}

const EXERCISE_KINDS = ['warmup', 'work', 'cooldown'];

/** The cue for the start of phase `index`, or null for none. */
export function entryCue(timeline: Phase[], index: number, ctx: CueContext): Cue | null {
  const p = timeline[index];
  const name = ctx.exerciseName(p.exerciseId);
  const nextName = ctx.exerciseName(p.next?.exerciseId);
  const prev = index > 0 ? timeline[index - 1] : undefined;

  switch (p.kind) {
    case 'prepare':
      return { say: `Get ready. First: ${nextName}.` };
    case 'transition':
      // Into the circuit, or into the cool-down: say so. Between warm-up or cool-down
      // items: stay quiet (the screen shows "Next"; the item says its own name).
      if (p.section === 'circuit') return { say: `Get ready. First: ${nextName}.` };
      if (p.section === 'cooldown' && prev?.section !== 'cooldown') return { say: `Cool-down. First: ${nextName}.` };
      return null;
    case 'warmup': {
      const first = !timeline.slice(0, index).some((q) => q.kind === 'warmup');
      return { say: first ? `Warm-up. ${name}.` : `${name}.` };
    }
    case 'cooldown':
      return { say: `${name}.` };
    case 'work':
      return { beep: 'long', say: `Go. ${name}.` };
    case 'rest':
      return { beep: 'long', say: `Rest. Next: ${nextName}.` };
    case 'roundRest':
      return { beep: 'long', say: `Round ${p.round} done. Rest.` };
    case 'blockRest':
      return { beep: 'long', say: `Block done. Next: ${ctx.blockName((p.blockIndex ?? 0) + 1)}.` };
    case 'done':
      return { beep: 'triple', say: 'Workout complete. Well done.' };
  }
}

/**
 * Cues for marks crossed while time left went from prevMs to nowMs, in one phase.
 * A mark t is crossed when prevMs > t >= nowMs.
 */
export function tickCues(timeline: Phase[], index: number, prevMs: number, nowMs: number, ctx: CueContext): Cue[] {
  const p = timeline[index];
  if (p.kind === 'done' || nowMs >= prevMs) return [];
  const crossed = (t: number) => prevMs > t && nowMs <= t;
  const cues: { at: number; cue: Cue }[] = [];

  // Halfway (exercise phases).
  const half = (p.durationSec * 1000) / 2;
  if (EXERCISE_KINDS.includes(p.kind) && half > ctx.countdownBeepsSec * 1000 && crossed(half)) {
    if (ctx.switchSides(p.exerciseId)) cues.push({ at: half, cue: { say: 'Switch sides.', beep: 'double' } });
    else if (p.kind === 'work' && ctx.halfwayCall) cues.push({ at: half, cue: { say: 'Halfway.' } });
  }

  // "Ten seconds." in rests that are longer than 10 s.
  if (REST_KINDS.includes(p.kind) && ctx.tenSecondWarning && p.durationSec > 10 && crossed(10_000)) {
    cues.push({ at: 10_000, cue: { say: 'Ten seconds.' } });
  }

  // Short beep at 3, 2 and 1 s left.
  for (let k = ctx.countdownBeepsSec; k >= 1; k--) {
    if (crossed(k * 1000)) cues.push({ at: k * 1000, cue: { beep: 'short' } });
  }

  return cues.sort((a, b) => b.at - a.at).map((c) => c.cue);
}
