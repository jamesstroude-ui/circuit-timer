// Workout start screen. Start unlocks sound and
// screen-on inside the tap, and says the first cue (iPhone rule, SPEC 7 and 11).

import type { Block, Exercise, ID, Routine, Workout } from '../data/schema';
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
  onEdit?: () => void;
}

function sumSec(timeline: Phase[], section: Phase['section']): number {
  // Not the "Get ready" at the start: it belongs to the whole workout, not the warm-up.
  return timeline.filter((p) => p.section === section && p.kind !== 'prepare').reduce((t, p) => t + p.durationSec, 0);
}

/** True when the stations in a block do not all have the same work and rest times. */
function mixed(b: Block): boolean {
  const rests = b.stations.slice(0, -1).map((s) => s.restSec); // the last station's rest is not used
  return new Set(b.stations.map((s) => s.workSec)).size > 1 || new Set(rests).size > 1;
}

function blockSummary(b: Block): string {
  const n = b.stations.length;
  const rounds = `${b.rounds} ${b.rounds === 1 ? 'round' : 'rounds'} × ${n} ${n === 1 ? 'exercise' : 'exercises'}`;
  if (!n || mixed(b)) return rounds;
  const rest = n > 1 ? ` / ${b.stations[0].restSec} s rest` : '';
  return `${rounds} · ${b.stations[0].workSec} s work${rest}`;
}

export function StartScreen({ workout, timeline, routines, exercises, notice, onStart, onBack, onEdit }: Props) {
  const total = timeline.reduce((t, p) => t + p.durationSec, 0);
  const warm = routines.find((r) => r.id === workout.warmupId);
  const cool = routines.find((r) => r.id === workout.cooldownId);

  return (
    <div className="start">
      <div className="st-nav">
        {onBack && (
          <button className="link-btn" onClick={onBack}>
            ‹ Workouts
          </button>
        )}
        {onEdit && (
          <button className="link-btn" onClick={onEdit}>
            Edit
          </button>
        )}
      </div>
      <header className="st-head">
        <h1>{workout.name}</h1>
        <div className="st-total">{clock(total)}</div>
      </header>

      {notice && <p className="st-notice">{notice}</p>}

      <ul className="st-parts">
        {warm && <li><b>Warm-up</b> {warm.name} · {clock(sumSec(timeline, 'warmup'))}</li>}
        {workout.blocks.map((b) => (
          <li key={b.id}>
            <b>{workout.blocks.length > 1 ? b.name : 'Circuit'}</b> {blockSummary(b)}
            <ol>
              {b.stations.map((s, i) => (
                <li key={s.id}>
                  {exercises.get(s.exerciseId)?.name}
                  {mixed(b) && <span className="st-times"> · {s.workSec} s{i < b.stations.length - 1 ? ` / ${s.restSec} s rest` : ''}</span>}
                </li>
              ))}
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
