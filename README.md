# Circuit Timer

Phone web app (PWA) for timed gym circuits. Two people, one iPhone.
Spec: `SPEC.md`. Working rules: `CLAUDE.md`.

## Status

Stage 1 (iPhone spike) — one screen, 30 s countdown that loops for 10 minutes,
voice, beeps, screen wake lock, offline support.

## Commands

- `npm run dev` — local dev server
- `npm test` — unit tests
- `npm run build` — production build (output in `dist/`)
- `npm run icons` — redraw the app icons

Pushing to `main` runs the tests, builds, and deploys to GitHub Pages.
