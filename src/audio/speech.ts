// Voice call-outs with the Web Speech API (built into Safari).

export function speechSupported(): boolean {
  return 'speechSynthesis' in window;
}

/** Call inside the Start tap. A silent utterance unlocks speech on iPhone. */
export function unlockSpeech(): void {
  if (!speechSupported()) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  window.speechSynthesis.speak(u);
}

/** interrupt = stop anything still being said first. */
export function speak(text: string, interrupt = true): void {
  if (!speechSupported()) return;
  const synth = window.speechSynthesis;
  if (interrupt) synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-GB';
  u.rate = 1;
  synth.speak(u);
}

export function cancelSpeech(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}

export function voiceCount(): number {
  return speechSupported() ? window.speechSynthesis.getVoices().length : 0;
}
