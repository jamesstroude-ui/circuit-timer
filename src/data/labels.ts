// Words for the data choices, shown on screen.

import type { Exercise } from './schema';

export const CATEGORIES: readonly { value: Exercise['category']; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'core', label: 'Core' },
  { value: 'mobility', label: 'Mobility' },
];

export const EQUIPMENT: readonly { value: Exercise['equipment']; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'dumbbell', label: 'Dumbbell' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'barbell', label: 'Barbell' },
  { value: 'machine', label: 'Machine' },
  { value: 'band', label: 'Band' },
  { value: 'other', label: 'Other' },
];

export const categoryLabel = (c: Exercise['category']) => CATEGORIES.find((x) => x.value === c)?.label ?? c;
export const equipmentLabel = (e: Exercise['equipment']) => EQUIPMENT.find((x) => x.value === e)?.label ?? e;

/** Sort by name, ignoring case. */
export const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/** Search match: every word typed appears in the name or cue. */
export function matches(ex: Exercise, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const text = `${ex.name} ${ex.cue}`.toLowerCase();
  return words.every((w) => text.includes(w));
}
