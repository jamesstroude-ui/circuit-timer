// App shell. Stage 3: start screen → player, with one hard-coded workout.
// The Stage 1 check screen stays at  …/circuit-timer/#spike  for sound tests.

import { useMemo, useState } from 'react';
import { fullBodyStarter, starterExercises, starterRoutines } from './data/starter';
import { buildTimeline } from './engine/timeline';
import { entryCue } from './engine/cues';
import { fromActiveSession, isDone, start, toActiveSession, type RunState } from './engine/runner';
import { clearSession, loadSession, saveSession } from './data/sessionStore';
import { playCue, unlockAudio } from './audio/cuePlayer';
import { startWakeLock } from './audio/wakeLock';
import { defaultSettings } from './data/starter';
import { PlayerScreen } from './screens/PlayerScreen';
import { StartScreen } from './screens/StartScreen';
import { SpikeScreen } from './screens/SpikeScreen';
import { clock } from './screens/format';

const workout = fullBodyStarter;
const exercises = new Map(starterExercises.map((e) => [e.id, e]));
const timeline = buildTimeline(workout, { routines: starterRoutines });

type View =
  | { name: 'start'; notice?: string }
  | { name: 'player'; run: RunState; startedAt: string; needsTap: boolean };

/** On load: if a workout was running (or paused), go straight back to it. */
function firstView(): View {
  const saved = loadSession();
  if (saved && saved.workoutId === workout.id) {
    const r = fromActiveSession(timeline, saved, Date.now());
    if (r && !isDone(timeline, r.state)) {
      return { name: 'player', run: r.state, startedAt: saved.startedAt, needsTap: true };
    }
  }
  if (saved) clearSession();
  return { name: 'start' };
}

export function App() {
  const isSpike = useMemo(() => window.location.hash === '#spike', []);
  const [view, setView] = useState<View>(firstView);

  if (isSpike) return <SpikeScreen />;

  if (view.name === 'player') {
    return (
      <PlayerScreen
        workout={workout}
        timeline={timeline}
        exercises={exercises}
        initial={view.run}
        startedAt={view.startedAt}
        needsTap={view.needsTap}
        onExit={({ completed, actualSec }) =>
          setView({
            name: 'start',
            notice: completed ? `Last workout: complete, ${clock(actualSec)}.` : `Workout ended early after ${clock(actualSec)}.`,
          })
        }
      />
    );
  }

  const onStart = () => {
    // All of this runs inside the tap (iPhone rule).
    unlockAudio();
    startWakeLock(() => undefined);
    const now = Date.now();
    const run = start(timeline, now);
    const startedAt = new Date(now).toISOString();
    saveSession(toActiveSession(run, workout.id, startedAt));
    const cue = entryCue(timeline, 0, {
      exerciseName: (id) => (id ? exercises.get(id)?.name ?? '' : ''),
      switchSides: () => false,
      blockName: (i) => workout.blocks[i]?.name ?? '',
      countdownBeepsSec: defaultSettings.countdownBeepsSec,
      tenSecondWarning: defaultSettings.tenSecondWarning,
      halfwayCall: defaultSettings.halfwayCall,
    });
    if (cue) playCue(cue, { voice: defaultSettings.voiceOn, beeps: defaultSettings.beepsOn });
    setView({ name: 'player', run, startedAt, needsTap: false });
  };

  return (
    <StartScreen
      workout={workout}
      timeline={timeline}
      routines={starterRoutines}
      exercises={exercises}
      notice={view.notice}
      onStart={onStart}
    />
  );
}
