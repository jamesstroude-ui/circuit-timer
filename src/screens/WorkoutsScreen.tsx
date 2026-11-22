// Workouts list. Stage 4: pick one of the saved workouts and go to its start screen.
// Stage 5 turns this into the full home screen (start last workout, + New workout, quick timer).

import type { ID } from '../data/schema';
import { useAppData } from '../data/appStore';
import { buildTimeline, totalSec } from '../engine/timeline';
import { TopBar } from '../components/ui';
import { clock } from './format';

export function WorkoutsScreen({ onOpen, notice }: { onOpen: (id: ID) => void; notice?: string }) {
  const data = useAppData();
  return (
    <div className="screen">
      <TopBar title="Workouts" />
      <div className="screen-body">
        {notice && <p className="st-notice">{notice}</p>}
        <ul className="list">
          {data.workouts.map((w) => {
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
      </div>
    </div>
  );
}
