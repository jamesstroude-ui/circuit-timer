// App shell: bottom tabs (Workouts, Library), the editors, the start screen and the player.
// All data comes from the storage module (src/data/appStore.ts).
// The Stage 1 check screen stays at  …/circuit-timer/#spike  for sound tests.

import { useMemo, useState } from 'react';
import type { AppData, ID, Routine } from './data/schema';
import { getData, startNotice, updateData, useAppData } from './data/appStore';
import { clearSession, loadSession } from './data/sessionStore';
import { buildTimeline } from './engine/timeline';
import { entryCue } from './engine/cues';
import { fromActiveSession, isDone, start, toActiveSession, type RunState } from './engine/runner';
import { playCue, unlockAudio } from './audio/cuePlayer';
import { startWakeLock } from './audio/wakeLock';
import { PlayerScreen } from './screens/PlayerScreen';
import { StartScreen } from './screens/StartScreen';
import { SpikeScreen } from './screens/SpikeScreen';
import { WorkoutsScreen } from './screens/WorkoutsScreen';
import { LibraryScreen, type LibTab } from './screens/LibraryScreen';
import { ExerciseEditor } from './screens/ExerciseEditor';
import { RoutineEditor } from './screens/RoutineEditor';
import { clock } from './screens/format';

type Tab = 'workouts' | 'library';

type View =
  | { name: 'tabs' }
  | { name: 'start'; workoutId: ID; notice?: string }
  | { name: 'player'; workoutId: ID; run: RunState; startedAt: string; needsTap: boolean }
  | { name: 'exercise'; id: ID | null }
  | { name: 'routine'; id: ID | null; kind: Routine['kind'] };

function timelineFor(data: AppData, workoutId: ID) {
  const workout = data.workouts.find((w) => w.id === workoutId);
  return workout ? { workout, timeline: buildTimeline(workout, { routines: data.routines }) } : null;
}

/** On load: if a workout was running (or paused), go straight back to it. */
function firstView(): View {
  const saved = loadSession();
  if (saved?.workoutId) {
    const found = timelineFor(getData(), saved.workoutId);
    const r = found && fromActiveSession(found.timeline, saved, Date.now());
    if (r && !isDone(found.timeline, r.state)) {
      return { name: 'player', workoutId: saved.workoutId, run: r.state, startedAt: saved.startedAt, needsTap: true };
    }
  }
  if (saved) clearSession();
  return { name: 'tabs' };
}

export function App() {
  const isSpike = useMemo(() => window.location.hash === '#spike', []);
  if (isSpike) return <SpikeScreen />;
  return <MainApp />;
}

function MainApp() {
  const data = useAppData();
  const [view, setView] = useState<View>(firstView);
  const [tab, setTab] = useState<Tab>('workouts');
  const [libTab, setLibTab] = useState<LibTab>('exercises');
  const [notice, setNotice] = useState<string | undefined>(startNotice);

  const exercises = useMemo(() => new Map(data.exercises.map((e) => [e.id, e])), [data.exercises]);
  const workoutId = view.name === 'start' || view.name === 'player' ? view.workoutId : null;
  const workout = workoutId ? data.workouts.find((w) => w.id === workoutId) : undefined;
  const timeline = useMemo(
    () => (workout ? buildTimeline(workout, { routines: data.routines }) : []),
    [workout, data.routines],
  );

  const home = () => setView({ name: 'tabs' });

  if (view.name === 'player' && workout) {
    return (
      <PlayerScreen
        workout={workout}
        timeline={timeline}
        exercises={exercises}
        settings={data.settings}
        initial={view.run}
        startedAt={view.startedAt}
        needsTap={view.needsTap}
        onExit={({ completed, actualSec }) =>
          setView({
            name: 'start',
            workoutId: workout.id,
            notice: completed ? `Last workout: complete, ${clock(actualSec)}.` : `Workout ended early after ${clock(actualSec)}.`,
          })
        }
      />
    );
  }

  if (view.name === 'start' && workout) {
    const onStart = () => {
      // All of this runs inside the tap (iPhone rule).
      unlockAudio();
      startWakeLock(() => undefined);
      const now = Date.now();
      const run = start(timeline, now);
      const startedAt = new Date(now).toISOString();
      updateData((d) => ({
        ...d,
        activeSession: toActiveSession(run, workout.id, startedAt),
        workouts: d.workouts.map((w) => (w.id === workout.id ? { ...w, lastUsedAt: startedAt } : w)),
      }));
      const cue = entryCue(timeline, 0, {
        exerciseName: (id) => (id ? exercises.get(id)?.name ?? '' : ''),
        switchSides: () => false,
        blockName: (i) => workout.blocks[i]?.name ?? '',
        countdownBeepsSec: data.settings.countdownBeepsSec,
        tenSecondWarning: data.settings.tenSecondWarning,
        halfwayCall: data.settings.halfwayCall,
      });
      if (cue) playCue(cue, { voice: data.settings.voiceOn, beeps: data.settings.beepsOn });
      setView({ name: 'player', workoutId: workout.id, run, startedAt, needsTap: false });
    };
    return (
      <StartScreen
        workout={workout}
        timeline={timeline}
        routines={data.routines}
        exercises={exercises}
        notice={view.notice}
        onStart={onStart}
        onBack={home}
      />
    );
  }

  if (view.name === 'exercise') {
    return <ExerciseEditor key={view.id ?? 'new'} id={view.id} onDone={home} backLabel="Library" />;
  }

  if (view.name === 'routine') {
    return (
      <RoutineEditor
        key={view.id ?? 'new'}
        id={view.id}
        kind={view.kind}
        onDone={home}
        onOpen={(id) => setView({ name: 'routine', id, kind: view.kind })}
      />
    );
  }

  // Tabs (also the fallback if a workout was not found).
  return (
    <div className="app">
      <div className="app-main">
        {tab === 'workouts' ? (
          <WorkoutsScreen
            notice={notice}
            onOpen={(id) => {
              setNotice(undefined);
              setView({ name: 'start', workoutId: id });
            }}
          />
        ) : (
          <LibraryScreen
            tab={libTab}
            onTab={setLibTab}
            onEditExercise={(id) => setView({ name: 'exercise', id })}
            onEditRoutine={(id, kind) => setView({ name: 'routine', id, kind })}
          />
        )}
      </div>
      <nav className="tabbar" aria-label="Main">
        <button className={tab === 'workouts' ? 'on' : ''} aria-current={tab === 'workouts'} onClick={() => setTab('workouts')}>
          Workouts
        </button>
        <button className={tab === 'library' ? 'on' : ''} aria-current={tab === 'library'} onClick={() => setTab('library')}>
          Library
        </button>
      </nav>
    </div>
  );
}
