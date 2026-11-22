// Beeps, with two methods so the Stage 1 spike can compare them on the iPhone.
//  - 'webaudio': an oscillator (Web Audio API). No files.
//  - 'element':  a WAV made in memory, played by <audio> elements. Fallback from SPEC §11.
// Both must be unlocked inside a tap handler (iPhone rule).

export type BeepMethod = 'webaudio' | 'element';
export type BeepKind = 'short' | 'long';

const FREQ = 880;
const LEN_MS: Record<BeepKind, number> = { short: 120, long: 450 };

let ctx: AudioContext | null = null;
const elements: Partial<Record<BeepKind, HTMLAudioElement>> = {};

/** iOS 17+: ask for "playback" audio so the ring/silent switch does not mute us. */
export function setPlaybackSession(): string {
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  if (!nav.audioSession) return 'not supported';
  try {
    nav.audioSession.type = 'playback';
    return `set: ${nav.audioSession.type}`;
  } catch (e) {
    return `error: ${(e as Error).message}`;
  }
}

function makeWavUrl(ms: number): string {
  const rate = 44_100;
  const n = Math.floor((rate * ms) / 1000);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  const fade = Math.floor(rate * 0.01);
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / fade, (n - i) / fade);
    v.setInt16(44 + i * 2, Math.sin((2 * Math.PI * FREQ * i) / rate) * 0.6 * env * 32767, true);
  }
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

/** Call inside the Start tap. Prepares both methods so either can play later. */
export function unlockBeeps(): void {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (AC) {
    ctx ??= new AC();
    void ctx.resume();
    const silent = ctx.createBuffer(1, 1, 22_050);
    const src = ctx.createBufferSource();
    src.buffer = silent;
    src.connect(ctx.destination);
    src.start(0);
  }
  for (const kind of ['short', 'long'] as BeepKind[]) {
    if (!elements[kind]) {
      const el = new Audio(makeWavUrl(LEN_MS[kind]));
      el.preload = 'auto';
      elements[kind] = el;
    }
    const el = elements[kind]!;
    el.muted = true;
    el.play().then(() => { el.pause(); el.currentTime = 0; el.muted = false; }).catch(() => { el.muted = false; });
  }
}

function webAudioBeep(kind: BeepKind, delayMs: number): void {
  if (!ctx) return;
  if (ctx.state !== 'running') void ctx.resume();
  const t = ctx.currentTime + delayMs / 1000;
  const len = LEN_MS[kind] / 1000;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = FREQ;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.6, t + 0.01);
  gain.gain.setValueAtTime(0.6, t + len - 0.02);
  gain.gain.linearRampToValueAtTime(0, t + len);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + len + 0.02);
}

function elementBeep(kind: BeepKind, delayMs: number): void {
  const play = () => {
    const el = elements[kind];
    if (!el) return;
    el.currentTime = 0;
    void el.play().catch(() => undefined);
  };
  if (delayMs > 0) window.setTimeout(play, delayMs);
  else play();
}

export function beep(method: BeepMethod, kind: BeepKind, delayMs = 0): void {
  if (method === 'webaudio') webAudioBeep(kind, delayMs);
  else elementBeep(kind, delayMs);
}

export function tripleBeep(method: BeepMethod): void {
  beep(method, 'short', 0);
  beep(method, 'short', 250);
  beep(method, 'short', 500);
}

export function audioContextState(): string {
  return ctx ? ctx.state : 'not created';
}
