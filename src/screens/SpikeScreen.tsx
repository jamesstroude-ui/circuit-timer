// Stage 1 spike screen (SPEC §10). One Start button. A 30 s countdown that loops for 10 minutes.
// It also shows a check panel so Jim can see what the iPhone allows.

import { useCallback, useEffect, useRef, useState } from 'react';
import { cuesBetween, formatMs, loopState, type LoopState } from '../engine/spikeLoop';
import { audioContextState, beep, setBeepLog, setPlaybackSession, tripleBeep, unlockBeeps, type BeepMethod } from '../audio/beeps';
import { cancelSpeech, setSpeechLog, speak, speechSupported, voiceCount, voiceName } from '../audio/speech';
import { startWakeLock, stopWakeLock, wakeLockSupported } from '../audio/wakeLock';
import './spike.css';

const CFG = { cycleMs: 30_000, totalMs: 10 * 60_000 };

type Mode = 'idle' | 'running' | 'done';

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-GB');
}

export function SpikeScreen() {
  const [mode, setMode] = useState<Mode>('idle');
  const [view, setView] = useState<LoopState>(() => loopState(0, 0, CFG));
  const [method, setMethod] = useState<BeepMethod>('webaudio');
  const [wakeStatus, setWakeStatus] = useState(wakeLockSupported() ? 'off' : 'not supported');
  const [sessionStatus, setSessionStatus] = useState('not set yet');
  const [online, setOnline] = useState(navigator.onLine);
  const [swStatus, setSwStatus] = useState('checking');
  const [log, setLog] = useState<string[]>([]);
  const [tick, setTick] = useState(0); // refreshes the check panel

  const startedAt = useRef(0);
  const prev = useRef<{ s: LoopState; at: number } | null>(null);
  const raf = useRef(0);
  const methodRef = useRef(method);
  methodRef.current = method;

  const addLog = useCallback((msg: string) => {
    setLog((l) => [`${clock(Date.now())}  ${msg}`, ...l].slice(0, 30));
  }, []);

  // Speech and beeps report problems to the log.
  useEffect(() => {
    setSpeechLog(addLog);
    setBeepLog(addLog);
  }, [addLog]);

  // Online / offline and service worker status.
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => setSwStatus(navigator.serviceWorker.controller ? 'active (works offline)' : 'installed (reopen app once)'));
    } else {
      setSwStatus('not supported');
    }
    const id = window.setInterval(() => setTick((t) => t + 1), 2000);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      window.clearInterval(id);
    };
  }, []);

  // Log when the page is hidden. If this stays empty for 10 minutes, the screen stayed on.
  useEffect(() => {
    const onVis = () => {
      if (mode === 'running') addLog(document.visibilityState === 'hidden' ? 'App hidden (screen locked or app left)' : 'App visible again');
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [mode, addLog]);

  const frame = useCallback(() => {
    const now = Date.now();
    const s = loopState(startedAt.current, now, CFG);
    const p = prev.current;
    if (p) {
      for (const cue of cuesBetween(p.s, p.at, s, now)) {
        const m = methodRef.current;
        if (cue === 'countdown') beep(m, 'short');
        if (cue === 'cycleStart') { speak('Go'); beep(m, 'long'); }
        if (cue === 'done') { speak('Done. Well done.'); tripleBeep(m); }
      }
    }
    prev.current = { s, at: now };
    setView(s);
    if (s.done) {
      setMode('done');
      stopWakeLock();
      addLog('Finished 10 minutes');
      return;
    }
    raf.current = requestAnimationFrame(frame);
  }, [addLog]);

  // Everything audio-related happens inside this tap. iPhone requires it.
  const onStart = () => {
    setSessionStatus(setPlaybackSession());
    unlockBeeps();
    speak('Go', false); // the first real words, inside the tap, unlock speech
    beep(method, 'long');
    startWakeLock((st) => { setWakeStatus(st); addLog(`Wake lock: ${st}`); });

    startedAt.current = Date.now();
    prev.current = null;
    setLog([]);
    addLog(`Started (beeps: ${method === 'webaudio' ? 'Web Audio' : 'Audio element'})`);
    setMode('running');
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(frame);
  };

  const onStop = () => {
    cancelAnimationFrame(raf.current);
    cancelSpeech();
    stopWakeLock();
    addLog('Stopped');
    setMode('idle');
    setView(loopState(0, 0, CFG));
  };

  const onTestBeep = () => { setSessionStatus(setPlaybackSession()); unlockBeeps(); beep(method, 'long'); };
  const onTestVoice = () => { setSessionStatus(setPlaybackSession()); speak('Testing. One, two, three.'); };

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const phase = mode === 'running' ? 'work' : mode === 'done' ? 'done' : 'ready';
  const word = mode === 'running' ? 'GO' : mode === 'done' ? 'DONE' : 'READY';
  void tick;

  return (
    <div className={`spike phase-${phase}`}>
      <header className="spike-top">
        <span>STAGE 1 · iPhone check</span>
        {mode === 'running' && <span>{formatMs(view.totalRemainingMs)} left</span>}
      </header>

      <main className="spike-main">
        <div className="phase-word">{word}</div>
        <div className="countdown">{formatMs(mode === 'idle' ? CFG.cycleMs : view.remainingMs)}</div>
        <div className="sub">
          {mode === 'running' ? `Loop ${view.cycleIndex + 1} of ${view.cyclesTotal}` : '30 s countdown, loops for 10 min'}
        </div>
      </main>

      <div className="controls">
        {mode === 'running'
          ? <button className="btn primary" onClick={onStop}>STOP</button>
          : <button className="btn primary" onClick={onStart}>START</button>}
      </div>

      <section className="checks" aria-label="Checks">
        <div className="method" role="group" aria-label="Beep method">
          <button className={`btn small ${method === 'webaudio' ? 'on' : ''}`} disabled={mode === 'running'} onClick={() => setMethod('webaudio')}>Beeps: Web Audio</button>
          <button className={`btn small ${method === 'element' ? 'on' : ''}`} disabled={mode === 'running'} onClick={() => setMethod('element')}>Beeps: Audio element</button>
        </div>
        <div className="method">
          <button className="btn small" onClick={onTestBeep}>Test beep</button>
          <button className="btn small" onClick={onTestVoice}>Test voice</button>
        </div>
        <dl>
          <dt>Opened from home screen</dt><dd>{isStandalone() ? 'yes' : 'no (open from the home screen icon)'}</dd>
          <dt>Network</dt><dd>{online ? 'online' : 'offline'}</dd>
          <dt>Offline support</dt><dd>{swStatus}</dd>
          <dt>Screen wake lock</dt><dd>{wakeStatus}</dd>
          <dt>Audio session</dt><dd>{sessionStatus}</dd>
          <dt>Web Audio</dt><dd>{audioContextState()}</dd>
          <dt>Speech</dt><dd>{speechSupported() ? `yes (${voiceCount()} voices)` : 'not supported'}</dd>
          <dt>Voice used</dt><dd>{voiceName()}</dd>
        </dl>
        <h2>Log</h2>
        <ol className="log">{log.length ? log.map((l, i) => <li key={i}>{l}</li>) : <li>No events yet.</li>}</ol>
      </section>
    </div>
  );
}
