import { describe, expect, it } from 'vitest';
import { cuesBetween, formatMs, loopState, type LoopConfig } from './spikeLoop';

const cfg: LoopConfig = { cycleMs: 30_000, totalMs: 600_000 };
const T0 = 1_000_000;

describe('loopState', () => {
  it('starts on cycle 1 of 20 with 30 s left', () => {
    const s = loopState(T0, T0, cfg);
    expect(s).toMatchObject({ done: false, cycleIndex: 0, cyclesTotal: 20, remainingMs: 30_000, secondsLeft: 30 });
  });

  it('rounds seconds up so 29.1 s shows as 30', () => {
    expect(loopState(T0, T0 + 900, cfg).secondsLeft).toBe(30);
    expect(loopState(T0, T0 + 1000, cfg).secondsLeft).toBe(29);
  });

  it('moves to the next cycle at exactly 30 s', () => {
    const s = loopState(T0, T0 + 30_000, cfg);
    expect(s.cycleIndex).toBe(1);
    expect(s.remainingMs).toBe(30_000);
  });

  it('uses timestamps: a long jump lands on the correct cycle', () => {
    const s = loopState(T0, T0 + 5 * 60_000 + 12_000, cfg);
    expect(s.cycleIndex).toBe(10);
    expect(s.secondsLeft).toBe(18);
    expect(s.totalRemainingMs).toBe(600_000 - 312_000);
  });

  it('is done after 10 minutes', () => {
    expect(loopState(T0, T0 + 600_000, cfg).done).toBe(true);
    expect(loopState(T0, T0 + 999_999, cfg).totalRemainingMs).toBe(0);
  });

  it('cuts the last cycle short when total is not a multiple of the cycle', () => {
    const odd = { cycleMs: 30_000, totalMs: 45_000 };
    const s = loopState(T0, T0 + 30_000, odd);
    expect(s.cyclesTotal).toBe(2);
    expect(s.remainingMs).toBe(15_000);
  });
});

describe('cuesBetween', () => {
  const at = (ms: number) => loopState(T0, T0 + ms, cfg);

  it('beeps once as the display reaches 3, 2 and 1', () => {
    expect(cuesBetween(at(26_950), T0 + 26_950, at(27_050), T0 + 27_050)).toEqual(['countdown']);
    expect(cuesBetween(at(27_050), T0 + 27_050, at(27_150), T0 + 27_150)).toEqual([]);
    expect(cuesBetween(at(28_950), T0 + 28_950, at(29_050), T0 + 29_050)).toEqual(['countdown']);
  });

  it('does not beep at 4 s', () => {
    expect(cuesBetween(at(25_950), T0 + 25_950, at(26_050), T0 + 26_050)).toEqual([]);
  });

  it('says Go when a new cycle starts', () => {
    expect(cuesBetween(at(29_950), T0 + 29_950, at(30_050), T0 + 30_050)).toEqual(['cycleStart']);
  });

  it('signals done once at the end', () => {
    expect(cuesBetween(at(599_950), T0 + 599_950, at(600_050), T0 + 600_050)).toEqual(['done']);
    expect(cuesBetween(at(600_050), T0 + 600_050, at(600_150), T0 + 600_150)).toEqual([]);
  });

  it('plays no missed cues after the app was hidden', () => {
    expect(cuesBetween(at(10_000), T0 + 10_000, at(95_000), T0 + 95_000)).toEqual([]);
  });
});

describe('formatMs', () => {
  it('formats as mm:ss and rounds up', () => {
    expect(formatMs(30_000)).toBe('00:30');
    expect(formatMs(29_001)).toBe('00:30');
    expect(formatMs(600_000)).toBe('10:00');
    expect(formatMs(-5)).toBe('00:00');
  });
});
