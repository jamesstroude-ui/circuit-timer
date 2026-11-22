// Plays engine cues on the iPhone, with the rules found in Stage 1 (SPEC 11):
//  - unlock everything inside a tap;
//  - beep first, then speak (speech interrupts the beep sound);
//  - after each spoken line, restart the silent keep-alive loop and the beep sound.

import type { Cue } from '../engine/cues';
import { beep, doubleBeep, resumeAudio, setPlaybackSession, tripleBeep, unlockBeeps } from './beeps';
import { restartKeepAlive, startKeepAlive, stopKeepAlive } from './keepAlive';
import { cancelSpeech, setSpeechEndHook, speak } from './speech';

const METHOD = 'webaudio' as const; // Stage 1: Web Audio works, also on silent.
let hooked = false;

/** Call inside a tap (Start, Resume, "Tap to continue"). Safe to call again. */
export function unlockAudio(): void {
  setPlaybackSession();
  startKeepAlive(() => undefined);
  unlockBeeps();
  if (!hooked) {
    hooked = true;
    setSpeechEndHook(() => {
      restartKeepAlive();
      resumeAudio();
    });
  }
}

export function playCue(cue: Cue, opts: { voice: boolean; beeps: boolean }): void {
  if (opts.beeps && cue.beep) {
    if (cue.beep === 'double') doubleBeep(METHOD);
    else if (cue.beep === 'triple') tripleBeep(METHOD);
    else beep(METHOD, cue.beep);
  }
  if (opts.voice && cue.say) speak(cue.say);
}

/** Stop anything still being said (skip, pause, end). */
export function hushVoice(): void {
  cancelSpeech();
}

/** After the workout: stop the silent loop. Waits so the last words can finish. */
export function releaseAudio(delayMs = 0): void {
  if (delayMs > 0) window.setTimeout(stopKeepAlive, delayMs);
  else stopKeepAlive();
}
