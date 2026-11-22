# Circuit Timer — Build Spec (v1)

Owner: Jim. Users: Jim and his son.
Build tool: Claude Code.
Status: Ready to build. Build one stage at a time (see Section 10).

---

## 1. Purpose

A phone web app that runs timed gym circuits for two people on one phone.
It tells you **what** to do, not only **how long**.
It runs warm-up, circuit and cool-down as one flow.
It records what each person lifted.

### What the current timer app does (reference screenshots)

- 4 tabs: Tabata, Rounds, Stopwatch, More.
- One strong colour per phase. Huge countdown numbers.
- Shows rounds left and cycles left.

### Gaps this app must fill

- Exercise name and a short form cue on screen.
- Warm-up and cool-down in the same flow.
- Saved workouts.
- A log per person.

---

## 2. Decisions from the interview

| Topic | Decision |
|---|---|
| Platform | Phone web app (PWA). Add to iPhone home screen. Works offline. |
| Gym setup | One phone, shared. Phone on a bench or stand. |
| Start point | New build. Do not reuse old code. |
| Pairing | Both people do the same exercise at the same time. |
| Measure | Time only. No rep-based stations in v1. |
| Exercise info | Name + short cue text. No images in v1. |
| Cues | Voice call-outs, beeps, next-exercise preview, screen stays on. |
| Warm-up / cool-down | Editable templates. Attach any template to any workout. |
| History | Workout log + load and note per person. |
| Music | Not on the same phone. No audio mixing work needed. |
| Editing | Jim only. No accounts, no permissions. |
| Design | Bold. Dark base, huge numbers, one colour per phase. Own palette. |
| Content | Ships with a starter library (Section 9). |

---

## 3. Scope

### Version 1 (build now)

1. Workout player: warm-up → circuit blocks → cool-down, in one run.
2. Voice call-outs and beeps.
3. Next-exercise preview during rest.
4. Screen stays on during a workout.
5. Pause, resume, skip forward, skip back, +10 s rest, end workout.
6. Resume a workout after the app reloads.
7. Workout builder (blocks, stations, rounds, times).
8. Exercise library: starter content + add / edit / hide.
9. Warm-up and cool-down template editor.
10. Two profiles (Jim and son). Names editable.
11. Finish screen: load (kg) and note per person per exercise. Prefill from last time.
12. History list and session detail. "Last time" values on the workout start screen.
13. Quick timer: work / rest / rounds, no saved workout needed (replaces the Tabata and Rounds tabs).
14. Settings: defaults, audio, profiles, backup export / import.
15. Offline. Installable to the home screen.

### Later (not v1)

- Progress charts per exercise per person.
- Personal bests and streaks.
- Drag-and-drop reorder (v1 uses up / down buttons).
- Rep-based stations. (Keep the data model open for a `mode` field.)
- Different exercise per person at the same station.
- Share a workout by link or QR code.
- Sync between two phones. This needs a server. It is a separate project.
- Exercise images or animations.

### Not possible or not planned

- Apple Health. A web app cannot write to Apple Health.
- Vibration. iPhone Safari does not support web vibration.
- Music control or ducking. Not needed: music is on another device.

---

## 4. Tech stack

| Part | Choice | Reason |
|---|---|---|
| Framework | React + TypeScript + Vite | Many screens and shared state. Claude Code knows it well. |
| PWA | `vite-plugin-pwa` | Service worker and manifest with little setup. |
| Storage | `localStorage`, behind one storage module | Data is small. One JSON object with a schema version. Easy to swap to IndexedDB later. |
| Tests | Vitest | The timer engine must have unit tests. |
| Speech | Web Speech API (`speechSynthesis`) | Built into Safari. |
| Beeps | Web Audio API (oscillator) | No audio files to load. |
| Screen on | Screen Wake Lock API | Re-request on `visibilitychange`. |
| Font | iPhone system condensed bold (`HelveticaNeue-CondensedBold`). Jim decided (2026-11-22): no Bebas Neue, the system font is fine. | Built into iOS: works offline, no download, no new dependency. |
| Hosting | GitHub Pages or Netlify (free) | HTTPS is required for the service worker and wake lock. |

Rules:

- No runtime calls to external CDNs. Everything is bundled.
- No backend. No accounts.
- Mobile first. Test on the real iPhone at every stage.

---

## 5. Data model

All app data is one JSON object in `localStorage` key `circuit-app-data`.

```ts
type ID = string; // nanoid or crypto.randomUUID()

interface AppData {
  schemaVersion: 1;
  exercises: Exercise[];
  routines: Routine[];      // warm-up and cool-down templates
  workouts: Workout[];
  profiles: Profile[];      // exactly 2 in v1
  logs: SessionLog[];
  settings: Settings;
  activeSession?: ActiveSession; // for resume after reload
}

interface Exercise {
  id: ID;
  name: string;              // "Goblet squat"
  cue: string;               // "Chest up, knees out" (max ~40 chars)
  category: 'strength' | 'cardio' | 'core' | 'mobility';
  equipment: 'none' | 'dumbbell' | 'kettlebell' | 'barbell' | 'machine' | 'band' | 'other';
  switchSides: boolean;      // voice says "Switch sides" at halfway
  tracksLoad: boolean;       // show kg fields on the finish screen
  builtIn: boolean;          // starter content
  hidden: boolean;           // built-ins are hidden, not deleted
}

interface Routine {
  id: ID;
  kind: 'warmup' | 'cooldown';
  name: string;
  items: { exerciseId: ID; workSec: number }[];
  transitionSec: number;     // gap between items, shows "Next: ..."
}

interface Workout {
  id: ID;
  name: string;
  notes?: string;
  prepareSec: number;        // "Get ready" before the first phase
  warmupId: ID | null;
  blocks: Block[];           // 1 or more
  restBetweenBlocksSec: number;
  cooldownId: ID | null;
  lastUsedAt?: string;       // ISO date
}

interface Block {
  id: ID;
  name: string;              // "Block A"
  rounds: number;            // times through the stations
  restBetweenRoundsSec: number;
  stations: Station[];
}

interface Station {
  id: ID;
  exerciseId: ID;
  workSec: number;
  restSec: number;           // rest after this station
}

interface Profile {
  id: ID;
  name: string;              // "Jim", "Son"
  colour: string;            // used on the finish screen and history
}

interface SessionLog {
  id: ID;
  startedAt: string;
  endedAt: string;
  workoutId: ID | null;      // null for quick timer
  workoutName: string;       // snapshot, in case the workout is deleted
  plannedSec: number;
  actualSec: number;
  completed: boolean;        // false if ended early
  entries: {
    exerciseId: ID;
    exerciseName: string;    // snapshot
    perProfile: Record<ID, { loadKg?: number; note?: string }>;
  }[];
  note?: string;
}

interface Settings {
  defaultWorkSec: number;          // 40
  defaultRestSec: number;          // 20
  defaultPrepareSec: number;       // 10
  voiceOn: boolean;                // true
  voiceName?: string;              // chosen system voice; if unset, best en-AU voice, then en-GB
  voiceRate: number;               // 1.0
  beepsOn: boolean;                // true
  countdownBeepsSec: number;       // 3
  tenSecondWarning: boolean;       // true ("Ten seconds" in rest)
  halfwayCall: boolean;            // false
  keepScreenOn: boolean;           // true
}

interface ActiveSession {
  workoutId: ID | null;
  timelineIndex: number;
  phaseEndsAt: number | null;      // epoch ms; null when paused
  remainingMsWhenPaused: number | null;
  startedAt: string;
}
```

Migration rule: on load, if `schemaVersion` is lower than the app version, run a migration function. Never drop user data.

---

## 6. Timer engine

The engine is pure TypeScript. No React. No DOM. It must have unit tests.

### 6.1 Expand a workout into a timeline

`buildTimeline(workout, data): Phase[]`

```ts
interface Phase {
  kind: 'prepare' | 'warmup' | 'transition' | 'work' | 'rest'
      | 'roundRest' | 'blockRest' | 'cooldown' | 'done';
  durationSec: number;
  exerciseId?: ID;
  label: string;            // big word on screen: "WORK", "REST", "GET READY"
  section: 'warmup' | 'circuit' | 'cooldown';
  blockIndex?: number; blocksTotal?: number;   // blockIndex is 0-based
  round?: number; roundsTotal?: number;        // 1-based
  station?: number; stationsTotal?: number;    // 1-based
  next?: { exerciseId?: ID; label: string; durationSec: number }; // next EXERCISE phase (or done)
}
```

Order:

1. `prepare` (if `prepareSec` > 0).
2. Warm-up items. Each item is a `warmup` phase. A `transition` phase goes between items.
3. A `transition` phase into the circuit (use `prepareSec`). Only if there is a warm-up; without one, `prepare` already does this job.
4. For each block, for each round, for each station: a `work` phase, then a rest:
   - Not the last station of the round → `rest` (`station.restSec`).
   - Last station, not the last round → `roundRest` (`restBetweenRoundsSec`).
   - Last station, last round, not the last block → `blockRest` (`restBetweenBlocksSec`).
   - Last station, last round, last block → no rest.
5. A `transition` into the cool-down (the cool-down's `transitionSec`), then cool-down items as `cooldown` phases with `transition` phases between.
6. `done`.

Skip any phase with duration 0.
Every phase carries `next` so the screen can show the preview. `next` skips rests and transitions: during work it names the next exercise.
Code: `src/engine/timeline.ts` (build) and `src/engine/runner.ts` (run state, controls, resume after reload). `+10 s` time is not saved in `ActiveSession`; after a reload, skip back counts from the original rest length.

### 6.2 Run the timeline

- Use timestamps, not tick counting. Store `phaseEndsAt = Date.now() + remainingMs`.
- A `requestAnimationFrame` loop (or 100 ms interval) reads the clock and redraws.
- On `visibilitychange` to visible: recompute from timestamps. If phases ended while the app was hidden, advance to the correct phase. Do not play missed cues.
- Save `ActiveSession` to storage at every phase change and on pause.

### 6.3 Controls

| Control | Behaviour |
|---|---|
| Pause / Resume | Stops the clock. Stores remaining ms. |
| Skip forward | Go to the next phase. |
| Skip back | Less than 2 s into a phase → previous phase. Else restart this phase. |
| +10 s | Only on rest phases. Adds 10 s. |
| End | Press and hold 1.5 s. Goes to the finish screen with `completed = false`. |

### 6.4 Test fixtures (must pass)

| Workout | Expected circuit time (excluding prepare, warm-up, cool-down) |
|---|---|
| Full Body Starter: 1 block, 8 stations, 40 s work / 20 s rest, 3 rounds, 60 s round rest | 1500 s (25:00) |
| Tabata x4: 4 blocks, 1 station each, 20 s work, 8 rounds, 10 s round rest, 60 s block rest | 1100 s (18:20) |
| Strength Pairs: 2 blocks, 3 stations, 45 s / 15 s, 3 rounds, 60 s round rest, 90 s block rest | 1320 s (22:00) |

Also test: zero-duration phases are skipped; no rest after the final station; skip back at 1 s vs 5 s; pause and resume keep the same remaining time; resume after a simulated reload.

---

## 7. Audio cues

Unlock audio and speech inside the **Start** tap handler. iPhone blocks audio that does not start from a tap.

| Moment | Voice | Beep |
|---|---|---|
| Workout start | "Get ready. First: {exercise}." | — |
| Last 3 s of any phase | — | Short beep each second |
| Work starts | "Go. {exercise}." | Long beep |
| Rest starts | "Rest. Next: {exercise}." | Long beep |
| Round rest starts | "Round {n} done. Rest." | Long beep |
| Block rest starts | "Block done. Next: {block name}." | Long beep |
| 10 s left in any rest | "Ten seconds." | — |
| Halfway through work (if on) | "Halfway." | — |
| Halfway, `switchSides` exercise | "Switch sides." | Double beep |
| Warm-up / cool-down start | "Warm-up." / "Cool-down." | — |
| Done | "Workout complete. Well done." | Triple beep |

Mute buttons for voice and beeps are on the player screen.
Cancel queued speech when the user skips or pauses.

Gaps filled in Stage 3 (code: `src/engine/cues.ts`):
- First warm-up item: "Warm-up. {exercise}." Later warm-up and all cool-down items: "{exercise}."
- Transition into the circuit: "Get ready. First: {exercise}." First transition into the cool-down: "Cool-down. First: {exercise}." Other transitions: silent (the screen shows "Up next").
- "Switch sides." also works in warm-up and cool-down items. "Ten seconds." only in rests longer than 10 s.
- After a skip, the new phase's cue plays. After the app was away (hidden, reload), missed cues do not play.
- After a reload the player shows "Tap to continue": the clock keeps running, but the phone needs one tap before sound and screen-on work again.

---

## 8. Screens and design

### 8.1 Navigation

Bottom tab bar with 4 tabs: **Workouts**, **Library**, **History**, **Settings**.
The player hides the tab bar and fills the screen.

### 8.2 Screen list

| # | Screen | Main content |
|---|---|---|
| 1 | Workouts (home) | Big "Start {last workout}" button. List of workouts with total time. "Quick timer" button. "+ New workout". |
| 2 | Workout start | Name, total time, warm-up, blocks, cool-down. "Last time" loads for each person. Start button. Edit button. |
| 3 | Workout editor | Name, prepare time, warm-up picker, blocks (stations with work / rest steppers, up / down / delete), rounds, rests, cool-down picker. Live total time. Duplicate workout. |
| 4 | Exercise picker | Search. Filter by category. Recent first. "+ New exercise". |
| 5 | Exercise editor | Name, cue, category, equipment, switch sides, track load. |
| 6 | Library | Tabs: Exercises / Warm-ups / Cool-downs. |
| 7 | Routine editor | Same pattern as the workout editor, one list, no rounds. |
| 8 | Quick timer | Work, rest, rounds, sets, rest between sets. Start. Optional: save as workout. |
| 9 | Player | See 8.3. |
| 10 | Finish | Summary (time, rounds done). Per exercise with `tracksLoad`: kg field and note for each person, prefilled from last time. Overall note. Save / Skip. |
| 11 | History | List by date. Tap for detail. Delete with confirm. |
| 12 | Settings | Profiles (names, colours), audio, defaults, keep screen on, backup export / import, reset starter content. |

### 8.3 Player layout (portrait)

```
┌──────────────────────────────┐
│ CIRCUIT · Block A    18:42 ⏱ │  section + total time left
│ Round 2/3 · Station 4/8      │
├──────────────────────────────┤
│                              │
│            WORK              │  phase word (always shown)
│                              │
│           00:27              │  countdown, ~40% of height
│                              │
│        GOBLET SQUAT          │  exercise name, large
│     Chest up, knees out      │  cue line
├──────────────────────────────┤
│ NEXT  Push-up · 40 s         │  preview band
├──────────────────────────────┤
│  ⏮      ( ❚❚ PAUSE )     ⏭   │  big pause, skip back / fwd
│  🔊 voice   🔔 beeps   END⏵  │  END = press and hold
└──────────────────────────────┘
```

- Whole background takes the phase colour.
- During rest, the "NEXT" exercise becomes the main name, with "UP NEXT" above it.
- Landscape: countdown on the left, name and next on the right. The phone may lie flat or sideways on a bench.

### 8.4 Design rules

- Dark base `#111111`. Light text `#FFFFFF`.
- Phase colours (own palette, not a copy of the reference app):

| Phase | Background | Text |
|---|---|---|
| Get ready / transition | Amber `#FFB300` | Black |
| Work | Green `#2BD96B` | Black |
| Rest / round rest / block rest | Blue `#2F7BFF` | White |
| Warm-up | Orange `#FF7A1A` | Black |
| Cool-down | Teal `#14B8A6` | Black |
| Done | `#111111` | White |

- Colour is never the only signal. The phase word is always on screen.
- Countdown font: condensed bold, tabular numbers (`font-variant-numeric: tabular-nums`) so digits do not jump.
- Tap targets in the player: at least 64 px. Elsewhere: at least 48 px.
- Body text at least 17 px.
- Respect `prefers-reduced-motion`. No flashing.
- One clear primary button per screen.
- Confirm before delete. Undo where cheap.

---

## 9. Starter content

### 9.1 Exercises

`L` = tracks load. `S` = switch sides.

**Strength**

| Name | Cue | Equip | Flags |
|---|---|---|---|
| Goblet squat | Chest up, knees out | dumbbell | L |
| Bodyweight squat | Sit back, heels down | none | |
| Reverse lunge | Step back, front knee over ankle | none | |
| Walking lunge | Long step, torso tall | dumbbell | L |
| Glute bridge | Squeeze at the top, ribs down | none | |
| Kettlebell swing | Hinge, snap hips, arms loose | kettlebell | L |
| Romanian deadlift | Soft knees, flat back, hips back | dumbbell | L |
| Step-up | Drive through the top foot | dumbbell | L S |
| Wall sit | Thighs level, back flat | none | |
| Push-up | Body straight, chest low | none | |
| Incline push-up | Hands on bench, body straight | none | |
| Dumbbell floor press | Elbows at 45°, press up | dumbbell | L |
| Bent-over row | Flat back, elbow to hip | dumbbell | L |
| Overhead press | Ribs down, press straight up | dumbbell | L |
| Renegade row | Hips square, slow pull | dumbbell | L |
| Biceps curl | Elbows still | dumbbell | L |
| Bench dip | Shoulders down, elbows back | none | |
| Farmer's carry | Stand tall, walk steady | dumbbell | L |

**Cardio**

| Name | Cue | Equip | Flags |
|---|---|---|---|
| Burpee | Chest down, jump at the top | none | |
| Jumping jacks | Light feet, full arm reach | none | |
| Mountain climbers | Hips level, drive knees | none | |
| High knees | Knees to hip height, quick feet | none | |
| Skaters | Land soft, reach across | none | |
| Squat jump | Land soft, sit back | none | |
| Rowing machine | Legs, body, arms | machine | |
| Bike sprint | Fast legs, steady upper body | machine | |
| Skipping | Small jumps, wrists turn | other | |

**Core**

| Name | Cue | Equip | Flags |
|---|---|---|---|
| Plank | Straight line, squeeze glutes | none | |
| Side plank | Hips high, body straight | none | S |
| Dead bug | Lower back on the floor | none | |
| Russian twist | Chest up, turn from the ribs | none | |
| Hollow hold | Lower back down, arms long | none | |
| Bicycle crunch | Slow, elbow to opposite knee | none | |
| Superman | Lift chest and legs, look down | none | |

**Mobility**

| Name | Cue | Equip | Flags |
|---|---|---|---|
| Arm circles | Big, slow circles | none | |
| Leg swings | Hold support, swing loose | none | S |
| World's greatest stretch | Lunge, elbow down, rotate up | none | S |
| Inchworm | Walk hands out, walk back | none | |
| Cat-cow | Round up, then arch | none | |
| Hamstring stretch | Hinge, flat back | none | S |
| Quad stretch | Knees together, hips forward | none | S |
| Hip flexor stretch | Tuck pelvis, lean forward | none | S |
| Figure-four glute stretch | Ankle on knee, sit back | none | S |
| Cross-body shoulder stretch | Arm across, shoulder down | none | S |
| Child's pose | Hips to heels, breathe | none | |
| Chest stretch | Arm on wall, turn away | none | S |

### 9.2 Warm-ups (transition 5 s)

- **General warm-up:** Jumping jacks 45 · Arm circles 30 · Leg swings 40 · Bodyweight squat 40 · Inchworm 45 · World's greatest stretch 60 · High knees 30.
- **Quick warm-up:** Jumping jacks 40 · Arm circles 30 · Bodyweight squat 40 · Inchworm 40 · High knees 30.

### 9.3 Cool-downs (transition 5 s)

- **Full stretch:** Child's pose 45 · Cat-cow 45 · Hamstring stretch 60 · Quad stretch 60 · Hip flexor stretch 60 · Cross-body shoulder stretch 40.
- **Quick stretch:** Hamstring stretch 50 · Quad stretch 50 · Child's pose 40 · Chest stretch 40.

### 9.4 Workouts

- **Full Body Starter** — General warm-up. 1 block, 3 rounds, 60 s round rest. 40 s work / 20 s rest. Goblet squat, Push-up, Kettlebell swing, Bent-over row, Reverse lunge, Plank, Mountain climbers, Glute bridge. Full stretch.
- **Tabata x4** — Quick warm-up. 4 blocks (Burpee, Kettlebell swing, Mountain climbers, Squat jump). Each block: 1 station, 20 s work, 8 rounds, 10 s round rest. 60 s between blocks. Quick stretch.
- **Strength Pairs** — General warm-up. Block A: Goblet squat, Bent-over row, Push-up. Block B: Romanian deadlift, Overhead press, Dead bug. 45 s / 15 s, 3 rounds, 60 s round rest, 90 s between blocks. Full stretch.

Profiles: "Jim" and "Son" (editable).

---

## 10. Build stages

Build one stage. Stop. Jim tests on his iPhone. Then go on.
Commit to git at the end of each stage.

### Stage 1 — iPhone spike (risk check)

- Vite + React + TS project. PWA manifest and service worker. Deploy to GitHub Pages (or Netlify).
- One screen. "Start" button runs a 30 s countdown that loops for 10 minutes.
- On Start: speak "Go", play a beep, request wake lock.
- **Done when**, on Jim's iPhone, added to the home screen:
  - Voice plays. Beeps play. Test with the ring / silent switch in both positions.
  - The screen stays on for 10 minutes.
  - The app opens with flight mode on.
- If any check fails, fix it here before Stage 2. See Section 11.

### Stage 2 — Timer engine

- `buildTimeline` and the run logic from Section 6. Pure TS.
- Unit tests for all fixtures in 6.4.
- **Done when** all tests pass.

### Stage 3 — Player screen

- Player from 8.3 with a hard-coded Full Body Starter workout.
- All cues from Section 7. All controls from 6.3. Landscape layout.
- Resume after reload.
- **Done when** Jim runs a full workout in the gym with no issues.

### Stage 4 — Data and library

- Storage module, schema version, starter content from Section 9.
- Library screens (exercises, warm-ups, cool-downs). Exercise editor. Routine editor.
- **Done when** edits survive closing and reopening the app.

### Stage 5 — Workout builder

- Workouts home, workout start screen, workout editor, exercise picker.
- Live total time in the editor (uses `buildTimeline`).
- **Done when** Jim builds a new workout from scratch in under 3 minutes and runs it.

### Stage 6 — Profiles, finish screen, history

- Two profiles. Finish screen with prefill. History list and detail. "Last time" on the start screen.
- **Done when** a second workout prefills the loads from the first.

### Stage 7 — Quick timer, settings, polish

- Quick timer. Settings screen. Backup export (download JSON) and import (with confirm).
- App icon, splash colour, empty states, confirm dialogs.
- **Done when** an export file restores all data on a clean install.

---

## 11. Facts, assumptions and risks

### Facts (decided or known)

- Two users, one phone, same exercise at the same time, time-based only.
- Data stays on this one phone. No sync.
- A web app cannot write to Apple Health or vibrate an iPhone.

### Stage 1 iPhone results (2026-11-22, Jim's iPhone, home-screen app)

All four "done when" checks passed. Code: `src/audio/`.

- **Screen on:** Screen Wake Lock kept the screen on for a full 10-minute run (Auto-Lock not on Never). No "App hidden" events.
- **Offline:** the app opens and runs with flight mode on and Wi-Fi off.
- **Voice:** works. Default voice is Karen (en-AU, basic). Rules: speak the real first words inside the Start tap; never a blank " " utterance; set an explicit voice; wait ~100 ms after `cancel()` before `speak()`.
- **Voice mutes the rest:** each spoken line makes iOS stop the page's other audio (Web Audio goes "interrupted", media elements pause). The app must, after every utterance ends: replay the silent keep-alive `<audio>` loop, and `suspend()` then `resume()` the AudioContext. Beep before speaking when both fall on the same moment. Without this, beeps stop after the first voice line.
- **Silent switch:** Web Audio beeps play on silent. The voice does not. Jim keeps the switch on ring when training.
- **Beep method:** Web Audio (the `<audio>` element method also works; keep it as the fallback).

### Assumptions (verify in Stage 1)

| Assumption | Check | Fallback |
|---|---|---|
| Screen Wake Lock works in a home-screen web app on Jim's iOS version. | Stage 1: confirmed, 10-minute test passed (2026-11-22). | Ask Jim to set Auto-Lock to "Never" during workouts, or use a muted looping video (NoSleep pattern). |
| Beeps play with the silent switch on. | Stage 1: confirmed (Web Audio beeps + `audioSession.type = 'playback'`). The voice did NOT play on silent. | Jim decided (2026-11-22): keep the switch on ring when training. The app keeps a silent keep-alive loop that may let the voice through; not required, not tested. |
| Speech plays after the first tap. | Stage 1: confirmed on Jim's iPhone (2026-11-22). | Speak the real first words inside the Start tap. Do NOT speak a blank " " utterance first: on the iPhone it blocked all speech. Set an explicit voice. |
| Home-screen web app data is not cleared by Safari's storage limits. | Check current WebKit policy. | Backup export. Remind Jim to export monthly (Settings shows "last backup" date). |
| Starter exercise cues and times suit Jim and his son. | Jim reviews Section 9. | Edit in the library. |

### Risks

- If the app goes to the background, cues stop until it returns. The timer catches up from timestamps. Accept for v1.
- Typing loads on one phone after the workout takes time. The prefill keeps it short. Do not ask for input during sets.
- Scope creep. Anything not in Section 3 v1 goes to "Later" first.
