// A silent sound that loops while the timer runs.
//
// Why: on the iPhone, the voice (speechSynthesis) is muted by the silent switch
// unless the page is already playing sound. Beeps alone are not enough, because
// they are short. This loop keeps the page "playing" so the voice comes through.
// It must start inside a tap (iPhone rule).

let el: HTMLAudioElement | null = null;

function silentWavUrl(): string {
  const rate = 8_000;
  const n = rate; // 1 second of silence
  const buf = new ArrayBuffer(44 + n * 2); // samples stay 0 = silence
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

/** Call inside a tap. Safe to call again while it already plays. */
export function startKeepAlive(log: (msg: string) => void): void {
  if (!el) {
    el = new Audio(silentWavUrl());
    el.loop = true;
  }
  if (!el.paused) return;
  el.play()
    .then(() => log('Keep-alive sound: playing'))
    .catch((e: Error) => log(`Keep-alive sound error: ${e.name}`));
}

export function stopKeepAlive(): void {
  el?.pause();
}

export function keepAliveState(): string {
  if (!el) return 'off';
  return el.paused ? 'off' : 'playing';
}
