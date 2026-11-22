// Workout start screen. Start unlocks sound and
// screen-on inside the tap, and says the first cue (iPhone rule, SPEC 7 and 11).

import type { Exercise, ID, Routine, Workout } from '../data/schema';
import type { Phase } from '../engine/timeline';
import { clock } from './format';
import './start.css';

interface Props {
  workout: Workout;
  timeline: Phase[];
  routines: Routine[];
  exercises: Map<ID, Exercise>;
  notice?: string;
  onStart: () => void;
  onBack?: () => void;
}

function sumSec(timeline: Phase[], section: Phase['section']): number {
  // Not the "Get ready" at the start: it belongs to the whole workout, not the warm-up.
  return timeline.filter((p) => p.section === section && p.kind !== 'prepare').reduce((t, p) => t + p.durationSec, 0);
}

export function StartScreen({ workout, timeline, routines, exercises, notice, onStart, onBack }: Props) {
  const total = timeline.reduce((t, p) => t + p.durationSec, 0);
  const warm = routines.find((r) => r.id === workout.warmupId);
  const cool = routines.find((r) => r.id === workout.cooldownId);

  return (
    <div className="start">
      {onBack && (
        <button className="link-btn st-back" onClick={onBack}>
          ‹ Workouts
        </button>
      )}
      <header className="st-head">
        <h1>{workout.name}</h1>
        <div className="st-total">{clock(total)}</div>
      </header>

      {notice && <p className="st-notice">{notice}</p>}

      <ul className="st-parts">
        {warm && <li><b>Warm-up</b> {warm.name} · {clock(sumSec(timeline, 'warmup'))}</li>}
        {workout.blocks.map((b) => (
          <li key={b.id}>
            <b>{workout.blocks.length > 1 ? b.name : 'Circuit'}</b> {b.rounds} rounds × {b.stations.length} stations ·{' '}
            {b.stations[0]?.workSec} s work / {b.stations[0]?.restSec} s rest
            <ol>
              {b.stations.map((s) => <li key={s.id}>{exercises.get(s.exerciseId)?.name}</li>)}
            </ol>
          </li>
        ))}
        {cool && <li><b>Cool-down</b> {cool.name} · {clock(sumSec(timeline, 'cooldown'))}</li>}
      </ul>

      <p className="st-tip">Ring/silent switch on <b>ring</b>, volume up.</p>

      <div className="st-foot">
        <button className="st-go" onClick={onStart}>START</button>
      </div>
    </div>
  );
}
