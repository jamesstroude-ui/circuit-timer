// Library (SPEC 8.2 #6): tabs Exercises / Warm-ups / Cool-downs. Tap a row to edit it.

import { useMemo, useState } from 'react';
import type { Exercise, ID, Routine } from '../data/schema';
import { useAppData } from '../data/appStore';
import { CATEGORIES, byName, matches } from '../data/labels';
import { routineSec } from '../engine/timeline';
import { Chips, TopBar } from '../components/ui';
import { clock } from './format';

export type LibTab = 'exercises' | 'warmup' | 'cooldown';

const TABS: readonly { value: LibTab; label: string }[] = [
  { value: 'exercises', label: 'Exercises' },
  { value: 'warmup', label: 'Warm-ups' },
  { value: 'cooldown', label: 'Cool-downs' },
];

type Filter = 'all' | Exercise['category'];
const FILTERS: readonly { value: Filter; label: string }[] = [{ value: 'all', label: 'All' }, ...CATEGORIES];

interface Props {
  tab: LibTab;
  onTab: (t: LibTab) => void;
  onEditExercise: (id: ID | null) => void;
  onEditRoutine: (id: ID | null, kind: Routine['kind']) => void;
}

export function LibraryScreen({ tab, onTab, onEditExercise, onEditRoutine }: Props) {
  return (
    <div className="screen">
      <TopBar title="Library" />
      <div className="screen-body">
        <div className="segmented" role="tablist" aria-label="Library">
          {TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={tab === t.value}
              className={tab === t.value ? 'on' : ''}
              onClick={() => onTab(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'exercises' ? (
          <ExerciseList onEdit={onEditExercise} />
        ) : (
          <RoutineList kind={tab} onEdit={(id) => onEditRoutine(id, tab)} />
        )}
      </div>
    </div>
  );
}

function ExerciseList({ onEdit }: { onEdit: (id: ID | null) => void }) {
  const data = useAppData();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [showHidden, setShowHidden] = useState(false);

  const shown = useMemo(
    () => data.exercises.filter((e) => (filter === 'all' || e.category === filter) && matches(e, query)).sort(byName),
    [data.exercises, filter, query],
  );
  const visible = shown.filter((e) => !e.hidden);
  const hidden = shown.filter((e) => e.hidden);
  const groups = CATEGORIES.map((c) => ({ ...c, items: visible.filter((e) => e.category === c.value) })).filter(
    (g) => g.items.length,
  );

  return (
    <>
      <button className="btn btn-primary" onClick={() => onEdit(null)}>
        + New exercise
      </button>
      <input
        className="input"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search exercises"
        aria-label="Search exercises"
      />
      <Chips label="Category" options={FILTERS} value={filter} onChange={setFilter} />

      {groups.map((g) => (
        <section key={g.value}>
          <h2 className="list-head">
            {g.label} <span className="muted">({g.items.length})</span>
          </h2>
          <ExerciseRows list={g.items} onEdit={onEdit} />
        </section>
      ))}
      {visible.length === 0 && <p className="muted">No exercises match.</p>}

      {hidden.length > 0 && (
        <section>
          <button className="btn" onClick={() => setShowHidden((v) => !v)} aria-expanded={showHidden}>
            {showHidden ? 'Hide' : 'Show'} hidden exercises ({hidden.length})
          </button>
          {showHidden && <ExerciseRows list={hidden} onEdit={onEdit} />}
        </section>
      )}
    </>
  );
}

function ExerciseRows({ list, onEdit }: { list: Exercise[]; onEdit: (id: ID) => void }) {
  return (
    <ul className="list">
      {list.map((e) => (
        <li key={e.id}>
          <button className={`row ${e.hidden ? 'row-hidden' : ''}`} onClick={() => onEdit(e.id)}>
            <span className="row-main">
              <span className="row-title">{e.name}</span>
              <span className="row-sub">{e.cue || ' '}</span>
            </span>
            <span className="row-tags">
              {e.hidden && <span className="tag">Hidden</span>}
              {e.switchSides && <span className="tag">Sides</span>}
              {e.tracksLoad && <span className="tag">kg</span>}
              {!e.builtIn && <span className="tag tag-own">Mine</span>}
            </span>
            <span className="row-chev" aria-hidden="true">›</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function RoutineList({ kind, onEdit }: { kind: Routine['kind']; onEdit: (id: ID | null) => void }) {
  const data = useAppData();
  const list = data.routines.filter((r) => r.kind === kind).sort(byName);
  const word = kind === 'warmup' ? 'warm-up' : 'cool-down';
  const nameOf = (id: ID) => data.exercises.find((e) => e.id === id)?.name ?? '?';

  return (
    <>
      <button className="btn btn-primary" onClick={() => onEdit(null)}>
        + New {word}
      </button>
      <ul className="list">
        {list.map((r) => (
          <li key={r.id}>
            <button className="row" onClick={() => onEdit(r.id)}>
              <span className="row-main">
                <span className="row-title">{r.name}</span>
                <span className="row-sub">
                  {r.items.length} exercises · {r.items.map((it) => nameOf(it.exerciseId)).join(', ')}
                </span>
              </span>
              <span className="row-time">{clock(routineSec(r))}</span>
              <span className="row-chev" aria-hidden="true">›</span>
            </button>
          </li>
        ))}
      </ul>
      {list.length === 0 && <p className="muted">No {word}s yet.</p>}
    </>
  );
}
