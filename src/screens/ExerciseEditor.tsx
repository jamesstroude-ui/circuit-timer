// Exercise editor (SPEC 8.2 #5): name, cue, category, equipment, switch sides, track load.
// Works on a copy; nothing is saved until SAVE.

import { useState } from 'react';
import type { Exercise, ID } from '../data/schema';
import { updateData, useAppData } from '../data/appStore';
import {
  CUE_MAX, blankExercise, cannotDeleteExercise, deleteExercise, exerciseUsage, sameNameExercise, saveExercise,
} from '../data/ops';
import { CATEGORIES, EQUIPMENT } from '../data/labels';
import { Chips, Field, SwitchRow, TopBar } from '../components/ui';

interface Props {
  /** null = a new exercise. */
  id: ID | null;
  /** Called after save (with the ID), delete or cancel (no ID). */
  onDone: (savedId?: ID) => void;
  backLabel?: string;
}

export function ExerciseEditor({ id, onDone, backLabel }: Props) {
  const data = useAppData();
  const [original] = useState<Exercise>(() => data.exercises.find((e) => e.id === id) ?? blankExercise());
  const [ex, setEx] = useState<Exercise>(original);
  const [error, setError] = useState('');
  const isNew = !data.exercises.some((e) => e.id === original.id);
  const dirty = JSON.stringify(ex) !== JSON.stringify(original);
  const used = isNew ? [] : exerciseUsage(data, ex.id);

  const set = <K extends keyof Exercise>(k: K, v: Exercise[K]) => {
    setEx((e) => ({ ...e, [k]: v }));
    setError('');
  };

  const onBack = () => {
    if (dirty && !window.confirm('Discard your changes?')) return;
    onDone();
  };

  const onSave = () => {
    if (!ex.name.trim()) {
      setError('Give the exercise a name.');
      return;
    }
    const twin = sameNameExercise(data, ex);
    if (twin && !window.confirm(`There is already an exercise called "${twin.name}". Save anyway?`)) return;
    updateData((d) => saveExercise(d, ex));
    onDone(ex.id);
  };

  const onDelete = () => {
    const why = cannotDeleteExercise(data, ex.id);
    if (why) {
      window.alert(why);
      return;
    }
    if (!window.confirm(`Delete "${original.name}"? This cannot be undone.`)) return;
    updateData((d) => deleteExercise(d, ex.id));
    onDone();
  };

  return (
    <div className="screen">
      <TopBar title={isNew ? 'New exercise' : 'Edit exercise'} onBack={onBack} backLabel={backLabel} />
      <div className="screen-body">
        <Field label="Name">
          <input
            className="input"
            value={ex.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="For example: Sled push"
            maxLength={40}
            autoCapitalize="sentences"
            autoFocus={isNew}
          />
        </Field>

        <Field label="Cue" hint={`${ex.cue.length}/${CUE_MAX}. Shown under the name in the player.`}>
          <input
            className="input"
            value={ex.cue}
            onChange={(e) => set('cue', e.target.value.slice(0, CUE_MAX))}
            placeholder="For example: Low hips, fast feet"
            maxLength={CUE_MAX}
            autoCapitalize="sentences"
          />
        </Field>

        <div className="field">
          <span className="field-label">Category</span>
          <Chips label="Category" options={CATEGORIES} value={ex.category} onChange={(v) => set('category', v)} />
        </div>

        <div className="field">
          <span className="field-label">Equipment</span>
          <Chips label="Equipment" options={EQUIPMENT} value={ex.equipment} onChange={(v) => set('equipment', v)} />
        </div>

        <div className="group">
          <SwitchRow
            label="Switch sides"
            hint='Voice says "Switch sides" at halfway.'
            on={ex.switchSides}
            onChange={(v) => set('switchSides', v)}
          />
          <SwitchRow
            label="Track load (kg)"
            hint="Show kg fields on the finish screen."
            on={ex.tracksLoad}
            onChange={(v) => set('tracksLoad', v)}
          />
          <SwitchRow
            label="Hidden"
            hint="Hide from lists. Workouts that use it still work."
            on={ex.hidden}
            onChange={(v) => set('hidden', v)}
          />
        </div>

        {used.length > 0 && <p className="muted">Used in: {used.join(', ')}.</p>}
        {ex.builtIn && <p className="muted">Starter exercise. You can edit or hide it, but not delete it.</p>}

        {!isNew && !ex.builtIn && (
          <button className="btn btn-danger" onClick={onDelete}>
            Delete exercise
          </button>
        )}
      </div>

      <footer className="screen-foot">
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-primary" onClick={onSave}>
          SAVE
        </button>
      </footer>
    </div>
  );
}
