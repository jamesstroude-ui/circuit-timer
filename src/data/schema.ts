// App data types. This is SPEC.md Section 5, word for word.
// Change only with Jim's OK, then bump schemaVersion and write a migration.

export type ID = string; // crypto.randomUUID()

export interface AppData {
  schemaVersion: 1;
  exercises: Exercise[];
  routines: Routine[]; // warm-up and cool-down templates
  workouts: Workout[];
  profiles: Profile[]; // exactly 2 in v1
  logs: SessionLog[];
  settings: Settings;
  activeSession?: ActiveSession; // for resume after reload
}

export interface Exercise {
  id: ID;
  name: string; // "Goblet squat"
  cue: string; // "Chest up, knees out" (max ~40 chars)
  category: 'strength' | 'cardio' | 'core' | 'mobility';
  equipment: 'none' | 'dumbbell' | 'kettlebell' | 'barbell' | 'machine' | 'band' | 'other';
  switchSides: boolean; // voice says "Switch sides" at halfway
  tracksLoad: boolean; // show kg fields on the finish screen
  builtIn: boolean; // starter content
  hidden: boolean; // built-ins are hidden, not deleted
}

export interface Routine {
  id: ID;
  kind: 'warmup' | 'cooldown';
  name: string;
  items: { exerciseId: ID; workSec: number }[];
  transitionSec: number; // gap between items, shows "Next: ..."
}

export interface Workout {
  id: ID;
  name: string;
  notes?: string;
  prepareSec: number; // "Get ready" before the first phase
  warmupId: ID | null;
  blocks: Block[]; // 1 or more
  restBetweenBlocksSec: number;
  cooldownId: ID | null;
  lastUsedAt?: string; // ISO date
}

export interface Block {
  id: ID;
  name: string; // "Block A"
  rounds: number; // times through the stations
  restBetweenRoundsSec: number;
  stations: Station[];
}

export interface Station {
  id: ID;
  exerciseId: ID;
  workSec: number;
  restSec: number; // rest after this station
}

export interface Profile {
  id: ID;
  name: string; // "Jim", "Son"
  colour: string; // used on the finish screen and history
}

export interface SessionLog {
  id: ID;
  startedAt: string;
  endedAt: string;
  workoutId: ID | null; // null for quick timer
  workoutName: string; // snapshot, in case the workout is deleted
  plannedSec: number;
  actualSec: number;
  completed: boolean; // false if ended early
  entries: {
    exerciseId: ID;
    exerciseName: string; // snapshot
    perProfile: Record<ID, { loadKg?: number; note?: string }>;
  }[];
  note?: string;
}

export interface Settings {
  defaultWorkSec: number; // 40
  defaultRestSec: number; // 20
  defaultPrepareSec: number; // 10
  voiceOn: boolean; // true
  voiceName?: string; // chosen system voice; if unset, best en-AU voice, then en-GB
  voiceRate: number; // 1.0
  beepsOn: boolean; // true
  countdownBeepsSec: number; // 3
  tenSecondWarning: boolean; // true ("Ten seconds" in rest)
  halfwayCall: boolean; // false
  keepScreenOn: boolean; // true
}

export interface ActiveSession {
  workoutId: ID | null;
  timelineIndex: number;
  phaseEndsAt: number | null; // epoch ms; null when paused
  remainingMsWhenPaused: number | null;
  startedAt: string;
}
