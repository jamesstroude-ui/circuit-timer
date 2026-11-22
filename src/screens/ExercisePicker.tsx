// Exercise picker (SPEC 8.2 #4): search, filter by category, "+ New exercise".
// Hidden exercises are not offered. Stage 5 adds "recent first".

import { useMemo, useState } from 'react';
import type { Exercise, ID } from '../data/schema';
import { useAppData } from '../data/appStore';
import { CATEGORIES, byName, matches } from '../data/labels';
import { Chips, TopBar } from '../components/ui';
import { ExerciseEditor } from './ExerciseEditor';

type Filter = 'all' | Exercise['category'];
const FILTERS: readonly { value: Filter; label: string }[] = [{ value: 'all', label: 'All' }, ...CATEGORIES];

export function ExercisePicker({ title, onPick, onCancel }: {
  title: string;
  onPick: (id: ID) => void;
  onCancel: () => void;
}) {
  const data = useAppData();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [making, setMaking] = useState(false);

  const list = useMemo(
    () =>
      data.exercises
        .filter((e) => !e.hidden && (filter === 'all' || e.category === filter) && matches(e, query))
        .sort(byName),
    [data.exercises, filter, query],
  );

  if (making) {
    return (
      <ExerciseEditor
        id={null}
        backLabel="Pick"
        onDone={(id) => (id ? onPick(id) : setMaking(false))}
      />
    );
  }

  return (
    <div className="screen">
      <TopBar title={title} onBack={onCancel} backLabel="Cancel" />
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
        <ul className="list">
          {list.map((e) => (
            <li key={e.id}>
              <button className="row" onClick={() => onPick(e.id)}>
                <span className="row-main">
                  <span className="row-title">{e.name}</span>
                  <span className="row-sub">{e.cue}</span>
                </span>
                <span className="row-add" aria-hidden="true">+</span>
              </button>
            </li>
          ))}
        </ul>
        {list.length === 0 && <p className="muted">No exercises match.</p>}
      </div>
    </div>
  );
}
