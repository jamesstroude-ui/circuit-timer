// Voice call-outs with the Web Speech API (built into Safari).
//
// iPhone notes (Stage 1 spike):
//  - The first speak() must happen inside a tap. We speak the real words in the tap.
//    (An earlier version spoke a blank " " utterance first. Safari can hang its queue on that.)
//  - We pick an English voice on purpose. A "lang only" utterance can land on a voice
//    that is not installed, and then nothing plays.
//  - speak() right after cancel() can be dropped by Safari, so we wait a moment after a cancel.
//  - Every utterance reports to the log: started, error, or "did not start".

type Log = (msg: string) => void;

let log: Log = () => undefined;
// Keep a reference until the utterance ends, so Safari does not drop its events.
const live = new Set<SpeechSynthesisUtterance>();

let endHook: () => void = () => undefined;

export function setSpeechLog(fn: Log): void {
  log = fn;
}

/** Runs after each spoken line ends (used to wake the beep sound again). */
export function setSpeechEndHook(fn: () => void): void {
  endHook = fn;
}

export function speechSupported(): boolean {
  return 'speechSynthesis' in window;
}

function norm(lang: string): string {
  return lang.replace('_', '-').toLowerCase();
}

// Best sound first: Premium, then Enhanced, then the basic (compact) voice.
function quality(v: SpeechSynthesisVoice): number {
  const id = v.voiceURI.toLowerCase();
  if (id.includes('premium')) return 0;
  if (id.includes('enhanced')) return 1;
  return 2;
}

function byLang(lang: string): SpeechSynthesisVoice[] {
  return window.speechSynthesis
    .getVoices()
    .filter((v) => norm(v.lang) === lang)
    .sort((a, b) => quality(a) - quality(b));
}

/** Australian English first (Jim asked for it), then British, then any English. */
function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return (
    byLang('en-au')[0] ??
    byLang('en-gb')[0] ??
    voices.find((v) => norm(v.lang).startsWith('en')) ??
    voices.find((v) => v.default) ??
    null
  );
}

/** For the check panel: every Australian voice this phone has. */
export function aussieVoices(): string {
  if (!speechSupported()) return 'none';
  const list = byLang('en-au');
  if (!list.length) return 'none installed';
  const tag = (v: SpeechSynthesisVoice) => ['premium', 'enhanced', 'basic'][quality(v)];
  return list.map((v) => `${v.name} (${tag(v)})`).join(', ');
}

export function voiceName(): string {
  if (!speechSupported()) return 'none';
  const v = pickVoice();
  return v ? `${v.name} (${v.lang})` : 'none found';
}

function say(text: string): void {
  const synth = window.speechSynthesis;
  if (synth.paused) synth.resume();
  const u = new SpeechSynthesisUtterance(text);
  const v = pickVoice();
  if (v) {
    u.voice = v;
    u.lang = v.lang;
  } else {
    u.lang = 'en-GB';
  }
  u.rate = 1;
  u.volume = 1;
  let started = false;
  u.onstart = () => {
    started = true;
    log(`Voice started: "${text}"`);
  };
  u.onend = () => {
    live.delete(u);
    endHook();
  };
  u.onerror = (e) => {
    live.delete(u);
    endHook();
    log(`Voice error: ${e.error}`);
  };
  live.add(u);
  synth.speak(u);
  window.setTimeout(() => {
    if (!started) {
      log(`Voice did not start (speaking=${synth.speaking}, pending=${synth.pending}, paused=${synth.paused})`);
    }
  }, 2000);
}

/** interrupt = stop anything still being said first. */
export function speak(text: string, interrupt = true): void {
  if (!speechSupported()) return;
  const synth = window.speechSynthesis;
  if (interrupt && (synth.speaking || synth.pending)) {
    synth.cancel();
    window.setTimeout(() => say(text), 100);
    return;
  }
  say(text);
}

export function cancelSpeech(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}

export function voiceCount(): number {
  return speechSupported() ? window.speechSynthesis.getVoices().length : 0;
}
