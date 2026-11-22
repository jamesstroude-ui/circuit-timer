// Workout editor (SPEC 8.2 #3): name, get-ready time, warm-up, blocks (stations with
// work / rest, up / down / delete, rounds, rests), cool-down. Live total time. Duplicate. Delete.
// Works on a copy; nothing is saved until SAVE.

import { useMemo, useState } from 'react';
import type { Block, ID, Routine, Station, Workout } from '../data/schema';
import { updateData, useAppData } from '../data/appStore';
import {
  PREPARE_MAX, REST_MAX, ROUNDS_MAX, WORK_MAX, WORK_MIN, blankBlock, blankWorkout, deleteWorkout,
  duplicateWorkout, moveItem, newStations, renameDefaultBlocks, saveWorkout, setAllStations, sharedValue,
  workoutProblems,
} from '../data/ops';
import { buildTimeline, circuitSec, routineSec, totalSec } from '../engine/timeline';
import { Field, Stepper, TopBar } from '../components/ui';
import { clock } from './format';
import { ExercisePicker } from './ExercisePicker';

interface Props {
  /** null = new. */
  id: ID | null;
  /** After save (with the ID), delete or cancel (no ID). */
  onDone: (savedId?: ID) => void;
  /** Open another workout in the editor (after Duplicate). */
  onOpen: (id: ID) => void;
}

export function WorkoutEditor({ id, onDone, onOpen }: Props) {
  const data = useAppData();
  const [original] = useState<Workout>(() => data.workouts.find((w) => w.id === id) ?? blankWorkout(data.settings));
  const [w, setW] = useState<Workout>(original);
  const [pickFor, setPickFor] = useState<number | null>(null); // block index
  const [problems, setProblems] = useState<string[]>([]);
  const isNew = !data.workouts.some((x) => x.id === original.id);
  const dirty = JSON.stringify(w) !== JSON.stringify(original);

  const timeline = useMemo(() => buildTimeline(w, { routines: data.routines }), [w, data.routines]);
  const nameOf = (exId: ID) => data.exercises.find((e) => e.id === exId)?.name ?? '(deleted exercise)';

  const change = (next: Workout) => {
    setW(next);
    setProblems([]);
  };
  const setBlocks = (blocks: Block[]) => change({ ...w, blocks });
  const setBlock = (i: number, b: Block) => setBlocks(w.blocks.map((x, j) => (j === i ? b : x)));
  const setStation = (bi: number, si: number, s: Station) =>
    setBlock(bi, { ...w.blocks[bi], stations: w.blocks[bi].stations.map((x, j) => (j === si ? s : x)) });

  if (pickFor !== null) {
    const block = w.blocks[pickFor];
    return (
      <ExercisePicker
        title={`Add to ${block.name || 'block'}`}
        onCancel={() => setPickFor(null)}
        onPick={(ids) => {
          setBlock(pickFor, { ...block, stations: [...block.stations, ...newStations(block, ids, data.settings)] });
          setPickFor(null);
        }}
      />
    );
  }

  const onBack = () => {
    if (dirty && !window.confirm('Discard your changes?')) return;
    onDone();
  };

  const onSave = () => {
    const p = workoutProblems(w);
    if (p.length) {
      setProblems(p);
      return;
    }
    updateData((d) => saveWorkout(d, w));
    onDone(w.id);
  };

  const onDuplicate = () => {
    if (dirty) {
      window.alert('Save your changes first.');
      return;
    }
    let copyId = '';
    updateData((d) => {
      const out = duplicateWorkout(d, w.id);
      copyId = out.id;
      return out.data;
    });
    onOpen(copyId);
  };

  const onDelete = () => {
    if (!window.confirm(`Delete "${original.name}"? This cannot be undone.`)) return;
    updateData((d) => deleteWorkout(d, w.id));
    onDone();
  };

  const removeBlock = (i: number) => {
    const b = w.blocks[i];
    if (b.stations.length && !window.confirm(`Remove ${b.name || 'this block'} and its ${b.stations.length} exercises?`)) return;
    setBlocks(renameDefaultBlocks(w.blocks.filter((_, j) => j !== i)));
  };

  return (
    <div className="screen">
      <TopBar title={isNew ? 'New workout' : 'Edit workout'} onBack={onBack} />
      <div className="screen-body">
        <div className="total-line total-sticky">
          <span>
            Total <small className="muted">· circuit {clock(circuitSec(timeline))}</small>
          </span>
          <b>{clock(totalSec(timeline))}</b>
        </div>

        <Field label="Name">
          <input
            className="input"
            value={w.name}
            onChange={(e) => change({ ...w, name: e.target.value })}
            placeholder="For example: Monday legs"
            maxLength={40}
            autoCapitalize="sentences"
          />
        </Field>

        <div className="field">
          <span className="field-label">Get ready</span>
          <div className="field-row">
            <Stepper label="Get ready" value={w.prepareSec} min={0} max={PREPARE_MAX} onChange={(v) => change({ ...w, prepareSec: v })} />
            <span className="field-hint">Before the start, and after the warm-up.</span>
          </div>
        </div>

        <RoutineChoice
          label="Warm-up"
          kind="warmup"
          routines={data.routines}
          value={w.warmupId}
          onChange={(v) => change({ ...w, warmupId: v })}
        />

        {w.blocks.map((b, bi) => {
          const lastBlock = bi === w.blocks.length - 1;
          const work = sharedValue(b, 'workSec');
          const rest = sharedValue(b, 'restSec');
          return (
            <section key={b.id} className="block-card">
              <div className="block-head">
                <input
                  className="input block-name"
                  value={b.name}
                  onChange={(e) => setBlock(bi, { ...b, name: e.target.value })}
                  aria-label="Block name"
                  maxLength={30}
                />
                <button className="icon-btn" onClick={() => setBlocks(renameDefaultBlocks(moveItem(w.blocks, bi, -1)))} disabled={bi === 0} aria-label="Move block up">↑</button>
                <button className="icon-btn" onClick={() => setBlocks(renameDefaultBlocks(moveItem(w.blocks, bi, 1)))} disabled={lastBlock} aria-label="Move block down">↓</button>
                <button className="icon-btn" onClick={() => removeBlock(bi)} disabled={w.blocks.length === 1} aria-label="Remove block">✕</button>
              </div>

              <div className="pair">
                <LabelledStepper label="Rounds" unit="" step={1} min={1} max={ROUNDS_MAX} value={b.rounds} onChange={(v) => setBlock(bi, { ...b, rounds: v })} />
                <LabelledStepper
                  label="Round rest"
                  min={0}
                  max={REST_MAX}
                  value={b.restBetweenRoundsSec}
                  onChange={(v) => setBlock(bi, { ...b, restBetweenRoundsSec: v })}
                  disabled={b.rounds === 1}
                />
              </div>

              {b.stations.length > 1 && (
                <div className="all-stations">
                  <span className="field-label">All exercises</span>
                  <div className="pair">
                    <LabelledStepper
                      label={work === null ? 'Work (mixed)' : 'Work'}
                      min={WORK_MIN}
                      max={WORK_MAX}
                      value={work ?? b.stations[0].workSec}
                      onChange={(v) => setBlock(bi, setAllStations(b, { workSec: v }))}
                    />
                    <LabelledStepper
                      label={rest === null ? 'Rest (mixed)' : 'Rest'}
                      min={0}
                      max={REST_MAX}
                      value={rest ?? b.stations[0].restSec}
                      onChange={(v) => setBlock(bi, setAllStations(b, { restSec: v }))}
                    />
                  </div>
                </div>
              )}

              <ol className="items">
                {b.stations.map((s, si) => {
                  const lastStation = si === b.stations.length - 1;
                  let after = w.cooldownId ? 'Then cool-down' : 'End of workout';
                  if (b.rounds > 1) after = `Then round rest (${b.restBetweenRoundsSec} s)`;
                  else if (!lastBlock) after = `Then block rest (${w.restBetweenBlocksSec} s)`;
                  return (
                    <li key={s.id} className="item">
                      <div className="item-head">
                        <span className="item-num">{si + 1}</span>
                        <span className="item-name">{nameOf(s.exerciseId)}</span>
                        <span className="item-btns">
                          <button className="icon-btn" onClick={() => setBlock(bi, { ...b, stations: moveItem(b.stations, si, -1) })} disabled={si === 0} aria-label="Move up">↑</button>
                          <button className="icon-btn" onClick={() => setBlock(bi, { ...b, stations: moveItem(b.stations, si, 1) })} disabled={lastStation} aria-label="Move down">↓</button>
                          <button className="icon-btn" onClick={() => setBlock(bi, { ...b, stations: b.stations.filter((_, j) => j !== si) })} aria-label="Remove">✕</button>
                        </span>
                      </div>
                      <div className="pair">
                        <LabelledStepper label="Work" min={WORK_MIN} max={WORK_MAX} value={s.workSec} onChange={(v) => setStation(bi, si, { ...s, workSec: v })} />
                        {lastStation ? (
                          <span className="after-note">{after}</span>
                        ) : (
                          <LabelledStepper label="Rest" min={0} max={REST_MAX} value={s.restSec} onChange={(v) => setStation(bi, si, { ...s, restSec: v })} />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
              <button className="btn" onClick={() => setPickFor(bi)}>
                + Add exercises
              </button>
            </section>
          );
        })}

        {w.blocks.length > 1 && (
          <div className="field">
            <span className="field-label">Rest between blocks</span>
            <Stepper label="Rest between blocks" value={w.restBetweenBlocksSec} min={0} max={REST_MAX} onChange={(v) => change({ ...w, restBetweenBlocksSec: v })} />
          </div>
        )}

        <button className="btn" onClick={() => setBlocks([...w.blocks, blankBlock(w.blocks.length)])}>
          + Add block
        </button>

        <RoutineChoice
          label="Cool-down"
          kind="cooldown"
          routines={data.routines}
          value={w.cooldownId}
          onChange={(v) => change({ ...w, cooldownId: v })}
        />

        {!isNew && (
          <div className="btn-row">
            <button className="btn" onClick={onDuplicate}>Duplicate</button>
            <button className="btn btn-danger" onClick={onDelete}>Delete</button>
          </div>
        )}
      </div>

      <footer className="screen-foot">
        {problems.map((p) => (
          <p key={p} className="error" role="alert">{p}</p>
        ))}
        <button className="btn btn-primary" onClick={onSave}>SAVE</button>
      </footer>
    </div>
  );
}

function LabelledStepper(props: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
}) {
  const { label, disabled, ...rest } = props;
  return (
    <div className={`lab-step ${disabled ? 'is-off' : ''}`}>
      <span className="mini-label">{label}</span>
      {disabled ? <span className="after-note">Not used (1 round)</span> : <Stepper label={label} {...rest} compact />}
    </div>
  );
}

function RoutineChoice({ label, kind, routines, value, onChange }: {
  label: string;
  kind: Routine['kind'];
  routines: Routine[];
  value: ID | null;
  onChange: (v: ID | null) => void;
}) {
  const list = routines.filter((r) => r.kind === kind);
  const options = [{ id: null as ID | null, text: 'None' }, ...list.map((r) => ({ id: r.id as ID | null, text: `${r.name} · ${clock(routineSec(r))}` }))];
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="chips" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id ?? 'none'}
            role="radio"
            aria-checked={value === o.id}
            className={`chip ${value === o.id ? 'on' : ''}`}
            onClick={() => onChange(o.id)}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  );
}
