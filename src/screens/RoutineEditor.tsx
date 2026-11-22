// Warm-up / cool-down editor (SPEC 8.2 #7): one list of exercises with times,
// up / down / remove, gap between exercises, live total time. Duplicate. Delete.
// Works on a copy; nothing is saved until SAVE.

import { useState } from 'react';
import type { ID, Routine } from '../data/schema';
import { updateData, useAppData } from '../data/appStore';
import {
  ROUTINE_ITEM_MAX, ROUTINE_ITEM_MIN, TRANSITION_MAX, blankRoutine, cannotDeleteRoutine, deleteRoutine,
  duplicateRoutine, moveItem, routineProblems, routineUsage, saveRoutine,
} from '../data/ops';
import { routineSec } from '../engine/timeline';
import { Field, Stepper, TopBar } from '../components/ui';
import { clock } from './format';
import { ExercisePicker } from './ExercisePicker';

interface Props {
  /** null = new. */
  id: ID | null;
  kind: Routine['kind'];
  onDone: () => void;
  /** Open another routine (after Duplicate). */
  onOpen: (id: ID) => void;
}

const DEFAULT_ITEM_SEC = 30;

export function RoutineEditor({ id, kind, onDone, onOpen }: Props) {
  const data = useAppData();
  const [original] = useState<Routine>(() => data.routines.find((r) => r.id === id) ?? blankRoutine(kind));
  const [r, setR] = useState<Routine>(original);
  const [picking, setPicking] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const isNew = !data.routines.some((x) => x.id === original.id);
  const dirty = JSON.stringify(r) !== JSON.stringify(original);
  const word = r.kind === 'warmup' ? 'warm-up' : 'cool-down';
  const used = isNew ? [] : routineUsage(data, r.id);
  const nameOf = (exId: ID) => data.exercises.find((e) => e.id === exId)?.name ?? '(deleted exercise)';

  const change = (next: Routine) => {
    setR(next);
    setProblems([]);
  };
  const setItems = (items: Routine['items']) => change({ ...r, items });

  if (picking) {
    return (
      <ExercisePicker
        title="Add exercise"
        onCancel={() => setPicking(false)}
        onPick={(exId) => {
          setItems([...r.items, { exerciseId: exId, workSec: DEFAULT_ITEM_SEC }]);
          setPicking(false);
        }}
      />
    );
  }

  const onBack = () => {
    if (dirty && !window.confirm('Discard your changes?')) return;
    onDone();
  };

  const onSave = () => {
    const p = routineProblems(r);
    if (p.length) {
      setProblems(p);
      return;
    }
    updateData((d) => saveRoutine(d, r));
    onDone();
  };

  const onDuplicate = () => {
    if (dirty) {
      window.alert('Save your changes first.');
      return;
    }
    let copyId = '';
    updateData((d) => {
      const out = duplicateRoutine(d, r.id);
      copyId = out.id;
      return out.data;
    });
    onOpen(copyId);
  };

  const onDelete = () => {
    const why = cannotDeleteRoutine(data, r.id);
    if (why) {
      window.alert(why);
      return;
    }
    if (!window.confirm(`Delete "${original.name}"? This cannot be undone.`)) return;
    updateData((d) => deleteRoutine(d, r.id));
    onDone();
  };

  return (
    <div className="screen">
      <TopBar title={isNew ? `New ${word}` : `Edit ${word}`} onBack={onBack} />
      <div className="screen-body">
        <Field label="Name">
          <input
            className="input"
            value={r.name}
            onChange={(e) => change({ ...r, name: e.target.value })}
            placeholder={r.kind === 'warmup' ? 'For example: Leg day warm-up' : 'For example: Short stretch'}
            maxLength={40}
            autoCapitalize="sentences"
          />
        </Field>

        <div className="total-line">
          <span>Total</span>
          <b>{clock(routineSec(r))}</b>
        </div>

        <div className="field">
          <span className="field-label">Gap between exercises</span>
          <div className="field-row">
            <Stepper
              label="Gap between exercises"
              value={r.transitionSec}
              min={0}
              max={TRANSITION_MAX}
              onChange={(v) => change({ ...r, transitionSec: v })}
            />
            <span className="field-hint">Shows GET READY and the next exercise.</span>
          </div>
        </div>

        <div className="field">
          <span className="field-label">Exercises ({r.items.length})</span>
          <ol className="items">
            {r.items.map((it, i) => (
              <li key={i} className="item">
                <div className="item-head">
                  <span className="item-num">{i + 1}</span>
                  <span className="item-name">{nameOf(it.exerciseId)}</span>
                </div>
                <div className="item-controls">
                  <Stepper
                    label={`${nameOf(it.exerciseId)} time`}
                    value={it.workSec}
                    min={ROUTINE_ITEM_MIN}
                    max={ROUTINE_ITEM_MAX}
                    onChange={(v) => setItems(r.items.map((x, j) => (j === i ? { ...x, workSec: v } : x)))}
                  />
                  <button className="icon-btn" onClick={() => setItems(moveItem(r.items, i, -1))} disabled={i === 0} aria-label="Move up">
                    ↑
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => setItems(moveItem(r.items, i, 1))}
                    disabled={i === r.items.length - 1}
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button className="icon-btn" onClick={() => setItems(r.items.filter((_, j) => j !== i))} aria-label="Remove">
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <button className="btn" onClick={() => setPicking(true)}>
            + Add exercise
          </button>
        </div>

        {used.length > 0 && <p className="muted">Used by: {used.join(', ')}. Changes apply to these workouts.</p>}

        {!isNew && (
          <div className="btn-row">
            <button className="btn" onClick={onDuplicate}>
              Duplicate
            </button>
            <button className="btn btn-danger" onClick={onDelete}>
              Delete
            </button>
          </div>
        )}
      </div>

      <footer className="screen-foot">
        {problems.map((p) => (
          <p key={p} className="error" role="alert">{p}</p>
        ))}
        <button className="btn btn-primary" onClick={onSave}>
          SAVE
        </button>
      </footer>
    </div>
  );
}
