// Stage 1 spike: a countdown that loops for a fixed total time.
// Pure TypeScript. No React, no DOM. Time comes in as numbers (epoch ms),
// so the clock is always read from timestamps, never from counting ticks.

export interface LoopConfig {
  cycleMs: number; // one countdown, e.g. 30 000
  totalMs: number; // whole run, e.g. 600 000 (10 minutes)
}

export interface LoopState {
  done: boolean;
  cycleIndex: number; // 0-based
  cyclesTotal: number;
  remainingMs: number; // left in the current cycle
  totalRemainingMs: number; // left in the whole run
  secondsLeft: number; // whole seconds shown on screen (rounded up)
}

export type Cue = 'cycleStart' | 'countdown' | 'done';

/** Maximum gap between two frames that still plays cues. Bigger gaps mean the app was hidden. */
export const MAX_CUE_GAP_MS = 1500;

export function loopState(startedAt: number, now: number, cfg: LoopConfig): LoopState {
  const cyclesTotal = Math.ceil(cfg.totalMs / cfg.cycleMs);
  const elapsed = Math.max(0, now - startedAt);
  if (elapsed >= cfg.totalMs) {
    return { done: true, cycleIndex: cyclesTotal - 1, cyclesTotal, remainingMs: 0, totalRemainingMs: 0, secondsLeft: 0 };
  }
  const cycleIndex = Math.floor(elapsed / cfg.cycleMs);
  const cycleEnd = Math.min((cycleIndex + 1) * cfg.cycleMs, cfg.totalMs);
  const remainingMs = cycleEnd - elapsed;
  return {
    done: false,
    cycleIndex,
    cyclesTotal,
    remainingMs,
    totalRemainingMs: cfg.totalMs - elapsed,
    secondsLeft: Math.ceil(remainingMs / 1000),
  };
}

/**
 * Which cues to play when the screen moves from one frame to the next.
 * If the gap is large (the app was hidden), return no cues: missed cues are not replayed.
 * The first "Go" is played by the Start tap itself, not here.
 */
export function cuesBetween(
  prev: LoopState,
  prevAt: number,
  next: LoopState,
  nextAt: number,
  countdownFrom = 3,
): Cue[] {
  if (nextAt - prevAt > MAX_CUE_GAP_MS) return [];
  if (next.done) return prev.done ? [] : ['done'];
  if (next.cycleIndex > prev.cycleIndex) return ['cycleStart'];
  if (next.secondsLeft !== prev.secondsLeft && next.secondsLeft >= 1 && next.secondsLeft <= countdownFrom) {
    return ['countdown'];
  }
  return [];
}

export function formatMs(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
