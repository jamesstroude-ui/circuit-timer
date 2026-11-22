// The workout player (SPEC 8.3). The clock and the rules live in src/engine/;
// this screen only draws the state, runs the frame loop and handles taps.

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Exercise, ID, Settings, Workout } from '../data/schema';
import type { Phase } from '../engine/timeline';
import { REST_KINDS } from '../engine/timeline';
import { entryCue, tickCues, type Cue, type CueContext } from '../engine/cues';
import {
  addRest, advance, canAddRest, isDone, isPaused, pause, remainingMs, resume,
  skipBack, skipForward, toActiveSession, type RunState,
} from '../engine/runner';
import { clearSession, saveSession } from '../data/sessionStore';
import { hushVoice, playCue, releaseAudio, unlockAudio } from '../audio/cuePlayer';
import { startWakeLock, stopWakeLock } from '../audio/wakeLock';
import { clock } from './format';
import { IconBack, IconForward } from '../components/icons';
import { HoldButton } from '../components/HoldButton';
import './player.css';

export interface PlayerProps {
  workout: Workout;
  timeline: Phase[];
  exercises: Map<ID, Exercise>;
  settings: Settings;
  initial: RunState;
  startedAt: string; // ISO
  /** After a reload the phone needs one tap before it may play sound or keep the screen on. */
  needsTap: boolean;
  onExit: (result: { completed: boolean; actualSec: number }) => void;
}

/** If two frames are further apart than this, the app was away: catch up without cues. */
const LIVE_GAP_MS = 1500;

function colourClass(p: Phase): string {
  if (p.kind === 'work') return 'ph-work';
  if (REST_KINDS.includes(p.kind)) return 'ph-rest';
  if (p.kind === 'warmup') return 'ph-warmup';
  if (p.kind === 'cooldown') return 'ph-cool';
  if (p.kind === 'done') return 'ph-done';
  return 'ph-ready'; // prepare, transition
}

export function PlayerScreen({ workout, timeline, exercises, settings, initial, startedAt, needsTap, onExit }: PlayerProps) {
  const run = useRef<RunState>(initial);
  const lastFrameAt = useRef(Date.now());
  const shownKey = useRef('');
  const [, redraw] = useReducer((x: number) => x + 1, 0);

  const [voiceOn, setVoiceOn] = useState(settings.voiceOn);
  const [beepsOn, setBeepsOn] = useState(settings.beepsOn);
  const [needTap, setNeedTap] = useState(needsTap);
  const sound = useRef({ allowed: !needsTap, voice: voiceOn, beeps: beepsOn });
  sound.current.voice = voiceOn;
  sound.current.beeps = beepsOn;

  const ctx: CueContext = useMemo(
    () => ({
      exerciseName: (id) => (id ? exercises.get(id)?.name ?? '' : ''),
      switchSides: (id) => (id ? exercises.get(id)?.switchSides ?? false : false),
      blockName: (i) => workout.blocks[i]?.name ?? `Block ${i + 1}`,
      countdownBeepsSec: settings.countdownBeepsSec,
      tenSecondWarning: settings.tenSecondWarning,
      halfwayCall: settings.halfwayCall,
    }),
    [exercises, workout, settings],
  );

  const play = useCallback((cue: Cue | null) => {
    if (cue && sound.current.allowed) playCue(cue, sound.current);
  }, []);

  const finished = useRef(false);
  const persist = useCallback(
    (s: RunState) => {
      if (isDone(timeline, s)) {
        clearSession();
        if (!finished.current) {
          finished.current = true;
          stopWakeLock();
          releaseAudio(6000); // let "Workout complete. Well done." finish
        }
      } else {
        saveSession(toActiveSession(s, workout.id, startedAt));
      }
    },
    [timeline, workout.id, startedAt],
  );

  // Frame loop: read the clock, move on when phases end, play cues, redraw when the shown second changes.
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const now = Date.now();
      const prev = run.current;
      const live = now - lastFrameAt.current < LIVE_GAP_MS;
      const prevRem = remainingMs(prev, lastFrameAt.current);
      const { state, entered } = advance(timeline, prev, now);
      if (entered.length) {
        run.current = state;
        persist(state);
        // One phase change in a normal frame: play its cue. More, or a gap: the app was away; skip missed cues.
        if (live && entered.length === 1) play(entryCue(timeline, state.index, ctx));
      } else if (live && !isPaused(state)) {
        for (const cue of tickCues(timeline, state.index, prevRem, remainingMs(state, now), ctx)) play(cue);
      }
      lastFrameAt.current = now;
      const key = `${state.index}:${Math.ceil(remainingMs(state, now) / 1000)}:${isPaused(state)}`;
      if (key !== shownKey.current) {
        shownKey.current = key;
        redraw();
      }
      if (!isDone(timeline, state)) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [timeline, ctx, play, persist]);

  // Keep the screen on while the player is open (when the phone allows it).
  useEffect(() => {
    if (!needsTap) startWakeLock(() => undefined);
    return () => stopWakeLock();
  }, [needsTap]);

  /** Apply a control. Returns the new state. */
  const act = (fn: (s: RunState, now: number) => RunState): RunState => {
    const now = Date.now();
    const next = fn(run.current, now);
    run.current = next;
    lastFrameAt.current = now;
    persist(next);
    shownKey.current = '';
    redraw();
    return next;
  };

  const onPauseResume = () => {
    if (isPaused(run.current)) {
      unlockAudio(); // a tap: a good moment to make sure sound is on
      act((s, now) => resume(s, now));
    } else {
      hushVoice();
      act((s, now) => pause(timeline, s, now));
    }
  };

  const onSkip = (dir: 'back' | 'forward') => {
    hushVoice();
    const next = act((s, now) => (dir === 'back' ? skipBack(timeline, s, now) : skipForward(timeline, s, now)));
    if (!isPaused(next)) play(entryCue(timeline, next.index, ctx));
  };

  const onAddRest = () => act((s, now) => addRest(timeline, s, now));

  const onEnd = () => {
    hushVoice();
    clearSession();
    stopWakeLock();
    releaseAudio();
    onExit({ completed: false, actualSec: Math.round((Date.now() - Date.parse(startedAt)) / 1000) });
  };

  const onTapToContinue = () => {
    unlockAudio();
    startWakeLock(() => undefined);
    sound.current.allowed = true;
    setNeedTap(false);
  };

  // ---- Draw ----
  const now = Date.now();
  const s = run.current;
  const phase = timeline[s.index];
  const rem = remainingMs(s, now);
  const secs = Math.ceil(rem / 1000);
  const paused = isPaused(s);
  const done = isDone(timeline, s);
  const leftSec = secs + timeline.slice(s.index + 1).reduce((t, p) => t + p.durationSec, 0);

  const nameOf = (id?: ID) => (id ? exercises.get(id)?.name ?? '' : '');
  const cueOf = (id?: ID) => (id ? exercises.get(id)?.cue ?? '' : '');
  const isExercise = phase.kind === 'work' || phase.kind === 'warmup' || phase.kind === 'cooldown';
  // During rests and "get ready", the next exercise is the main name, with "UP NEXT" above it.
  const mainId = isExercise ? phase.exerciseId : phase.next?.exerciseId;

  let section = 'COOL-DOWN';
  if (phase.section === 'warmup') section = 'WARM-UP';
  if (phase.section === 'circuit') {
    const b = workout.blocks[phase.blockIndex ?? 0];
    section = b && workout.blocks.length > 1 ? `CIRCUIT · ${b.name}` : 'CIRCUIT';
  }
  let where = '';
  if (phase.round) where = `Round ${phase.round}/${phase.roundsTotal} · Station ${phase.station}/${phase.stationsTotal}`;
  else if (phase.kind === 'warmup' || phase.kind === 'cooldown') {
    const same = timeline.filter((p) => p.kind === phase.kind);
    where = `${same.indexOf(phase) + 1} of ${same.length}`;
  }

  if (done) {
    return (
      <div className="player ph-done">
        <div className="pl-done">
          <div className="pl-word">DONE</div>
          <p className="pl-done-line">Workout complete. Well done.</p>
          <p className="pl-done-sub">{workout.name}</p>
          <button className="pl-primary" onClick={() => onExit({ completed: true, actualSec: Math.round((Date.now() - Date.parse(startedAt)) / 1000) })}>
            FINISH
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`player ${colourClass(phase)}`}>
      <header className="pl-top">
        <div>
          <div className="pl-section">{section}</div>
          <div className="pl-where">{where}</div>
        </div>
        <div className="pl-left" aria-label="Total time left">{clock(leftSec)}</div>
      </header>

      <main className="pl-main">
        <div className="pl-clockside">
          <div className="pl-word">{paused ? 'PAUSED' : phase.label}</div>
          <div className="pl-count" aria-live="off">{clock(secs)}</div>
        </div>
        <div className="pl-info">
          {!isExercise && <div className="pl-upnext">UP NEXT</div>}
          <div className="pl-name">{mainId ? nameOf(mainId) : 'Finish'}</div>
          <div className="pl-cue">{cueOf(mainId)}</div>
          {isExercise && phase.next && (
            <div className="pl-next">
              <span className="pl-next-tag">NEXT</span>
              {phase.next.exerciseId ? `${nameOf(phase.next.exerciseId)} · ${phase.next.durationSec} s` : 'Finish'}
            </div>
          )}
        </div>
      </main>

      <footer className="pl-controls">
        <div className="pl-row">
          <button className="pl-btn" onClick={() => onSkip('back')} aria-label="Skip back"><IconBack /></button>
          <button className="pl-btn pl-pause" onClick={onPauseResume}>{paused ? 'RESUME' : 'PAUSE'}</button>
          <button className="pl-btn" onClick={() => onSkip('forward')} aria-label="Skip forward"><IconForward /></button>
        </div>
        <div className="pl-row pl-row2">
          <button className={`pl-btn pl-small ${voiceOn ? '' : 'off'}`} onClick={() => setVoiceOn((v) => !v)} aria-pressed={voiceOn}>
            {voiceOn ? 'VOICE ON' : 'VOICE OFF'}
          </button>
          <button className={`pl-btn pl-small ${beepsOn ? '' : 'off'}`} onClick={() => setBeepsOn((v) => !v)} aria-pressed={beepsOn}>
            {beepsOn ? 'BEEPS ON' : 'BEEPS OFF'}
          </button>
          {canAddRest(timeline, s) && (
            <button className="pl-btn pl-small" onClick={onAddRest}>+10 s</button>
          )}
          <HoldButton className="pl-btn pl-small pl-end" holdMs={1500} onHold={onEnd} label="END" hint="Hold" />
        </div>
      </footer>

      {needTap && (
        <button className="pl-overlay" onClick={onTapToContinue}>
          <span className="pl-overlay-big">TAP TO CONTINUE</span>
          <span className="pl-overlay-small">The workout is still running. One tap turns sound and screen-on back on.</span>
        </button>
      )}
    </div>
  );
}
