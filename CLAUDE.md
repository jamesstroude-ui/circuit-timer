# CLAUDE.md — Circuit Timer

## Project

A phone web app (PWA) that runs timed gym circuits for two people on one shared iPhone.
Full spec: `SPEC.md`. Read it before any work.

## Stack

React + TypeScript + Vite. `vite-plugin-pwa`. Vitest. `localStorage` behind one storage module.
No backend. No accounts. No external CDNs at runtime.

## Working rules

1. Build **one stage** from `SPEC.md` Section 10 at a time. Stop at the end of the stage.
2. At the end of each stage:
   - Run the tests and the build.
   - Commit to git with a clear message.
   - Tell Jim exactly how to test the stage on his iPhone, in numbered steps.
3. Ask before you add a new dependency.
4. Ask before you change the data model in `SPEC.md` Section 5. If you change it, bump `schemaVersion` and write a migration.
5. Keep the timer engine pure TypeScript (`src/engine/`). No React or DOM in it. Every engine change needs a test.
6. Use timestamps for timing, never tick counting.
7. Mobile first. Player tap targets at least 64 px. Text at least 17 px.
8. Anything not in v1 scope goes in `LATER.md`, not in the code.
9. Jim is learning. Explain what you changed and why in plain, short sentences.

## Folder layout (target)

```
src/
  engine/      timeline + runner (pure TS, tested)
  audio/       speech + beeps + wake lock
  data/        storage module, schema, migrations, starter content
  screens/     one file per screen
  components/  shared UI
  styles/      tokens (colours, type, spacing)
```

## Commands

- `npm run dev` — local dev server
- `npm test` — unit tests
- `npm run build` — production build
