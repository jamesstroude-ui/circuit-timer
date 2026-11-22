// Workouts home (SPEC 8.2 #1): big "Start {last workout}" button, the list of workouts
// with total time (most recently used first), "+ New workout".
// The quick timer comes in Stage 7.

import type { ID } from '../data/schema';
import { useAppData } from '../data/appStore';
import { lastUsedWorkout, workoutsByRecent } from '../data/ops';
import { buildTimeline, totalSec } from '../engine/timeline';
import { TopBar } from '../components/ui';
import { clock } from './format';

interface Props {
  onOpen: (id: ID) => void;
  onNew: () => void;
  /** Starts at once (this runs inside the tap, so sound can start). */
  onStart: (id: ID) => void;
  notice?: string;
}

export function WorkoutsScreen({ onOpen, onNew, onStart, notice }: Props) {
  const data = useAppData();
  const last = lastUsedWorkout(data);
  const list = workoutsByRecent(data);

  return (
    <div className="screen">
      <TopBar title="Workouts" />
      <div className="screen-body">
        {notice && <p className="st-notice">{notice}</p>}

        {last && (
          <button className="btn btn-primary btn-start-last" onClick={() => onStart(last.id)}>
            <span>START</span>
            <small>{last.name}</small>
          </button>
        )}

        <ul className="list">
          {list.map((w) => {
            const t = totalSec(buildTimeline(w, { routines: data.routines }));
            const stations = w.blocks.reduce((n, b) => n + b.stations.length, 0);
            return (
              <li key={w.id}>
                <button className="row row-big" onClick={() => onOpen(w.id)}>
                  <span className="row-main">
                    <span className="row-title">{w.name}</span>
                    <span className="row-sub">
                      {w.blocks.length > 1 ? `${w.blocks.length} blocks · ` : ''}
                      {stations} {stations === 1 ? 'exercise' : 'exercises'}
                    </span>
                  </span>
                  <span className="row-time">{clock(t)}</span>
                  <span className="row-chev" aria-hidden="true">›</span>
                </button>
              </li>
            );
          })}
        </ul>
        {list.length === 0 && <p className="muted">No workouts yet.</p>}

        <button className="btn" onClick={onNew}>
          + New workout
        </button>
      </div>
    </div>
  );
}
