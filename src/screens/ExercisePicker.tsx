// Exercise picker (SPEC 8.2 #4): search, filter by category, recent first, "+ New exercise".
// Tap several exercises, then ADD: they are added in the order tapped. Tap again to unselect.
// Hidden exercises are not offered.

import { useMemo, useState } from 'react';
import type { Exercise, ID } from '../data/schema';
import { useAppData } from '../data/appStore';
import { recentExerciseIds } from '../data/ops';
import { CATEGORIES, byName, matches } from '../data/labels';
import { Chips, TopBar } from '../components/ui';
import { ExerciseEditor } from './ExerciseEditor';

type Filter = 'all' | Exercise['category'];
const FILTERS: readonly { value: Filter; label: string }[] = [{ value: 'all', label: 'All' }, ...CATEGORIES];

export function ExercisePicker({ title, onPick, onCancel }: {
  title: string;
  onPick: (ids: ID[]) => void;
  onCancel: () => void;
}) {
  const data = useAppData();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [making, setMaking] = useState(false);
  const [picked, setPicked] = useState<ID[]>([]);

  const list = useMemo(
    () =>
      data.exercises
        .filter((e) => !e.hidden && (filter === 'all' || e.category === filter) && matches(e, query))
        .sort(byName),
    [data.exercises, filter, query],
  );
  const recent = useMemo(() => {
    if (query || filter !== 'all') return [];
    const byId = new Map(data.exercises.map((e) => [e.id, e]));
    return recentExerciseIds(data).map((id) => byId.get(id)!);
  }, [data, query, filter]);

  if (making) {
    return (
      <ExerciseEditor
        id={null}
        backLabel="Pick"
        onDone={(id) => {
          if (id) setPicked((p) => [...p, id]);
          setMaking(false);
        }}
      />
    );
  }

  const toggle = (id: ID) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const onBack = () => {
    if (picked.length && !window.confirm('Leave without adding the exercises you picked?')) return;
    onCancel();
  };

  const rows = (items: Exercise[]) => (
    <ul className="list">
      {items.map((e) => {
        const n = picked.indexOf(e.id) + 1;
        return (
          <li key={e.id}>
            <button className={`row ${n ? 'row-picked' : ''}`} onClick={() => toggle(e.id)} aria-pressed={n > 0}>
              <span className="row-main">
                <span className="row-title">{e.name}</span>
                <span className="row-sub">{e.cue}</span>
              </span>
              <span className={`pick-mark ${n ? 'on' : ''}`} aria-hidden="true">{n || '+'}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="screen">
      <TopBar title={title} onBack={onBack} backLabel="Cancel" />
      <div className="screen-body">
        <input
          className="input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises"
          aria-label="Search exercises"
        />
        <Chips label="Category" options={FILTERS} value={filter} onChange={setFilter} />
        <button className="btn" onClick={() => setMaking(true)}>
          + New exercise
        </button>
        {recent.length > 0 && (
          <section>
            <h2 className="list-head">Recent</h2>
            {rows(recent)}
          </section>
        )}
        <section>
          {recent.length > 0 && <h2 className="list-head">All exercises</h2>}
          {rows(list)}
        </section>
        {list.length === 0 && <p className="muted">No exercises match.</p>}
      </div>
      <footer className="screen-foot">
        <button className="btn btn-primary" onClick={() => onPick(picked)} disabled={picked.length === 0}>
          {picked.length === 0 ? 'TAP EXERCISES TO ADD' : `ADD ${picked.length} ${picked.length === 1 ? 'EXERCISE' : 'EXERCISES'}`}
        </button>
      </footer>
    </div>
  );
}
