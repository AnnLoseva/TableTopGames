# Roadmap

Working list of directions — not a fantasy plan. Keep it realistic and current.

## Now
- Keep the current site stable; no UI regressions.
- Legacy character sheet phase: small incremental work in `public/vampires/main.js` only with
  explicit tasks; bridge in `games/vampires/modules/character-sheet/`.
- Run `npm run test:vtm-parity` after health/humanity edits; discipline scripts for
  discipline work.
- Do **not** add chaos to `games/vampires/modules/table/GameTable.tsx` or `public/vampires/main.js`.

## Next
- Gradually extract logic from `public/vampires/main.js` into `games/vampires/core/vtm5/rules/*` / `games/vampires/modules/table/*`
  (small, verified steps; one explicit task each).
- Sync the full sheet and the quick/summary sheet representations.
- Improve the character creation wizard (`public/vampires/creation-wizard.js`).
- Add contested / opposed rolls to the normal roll UI.
- Implement the humanity / stains / remorse flow end-to-end.
- Improve Supabase persistence robustness (error handling, retries, conflicts).

## Later
- A full modular React version of the character sheet.
- Migrate the legacy JS off the iframe (dedicated project).
- Improve room / multiplayer logic (roles, presence, conflict handling).
- Stricter automated tests for rules and mechanics.

## Parking lot
- Ideas not scheduled: richer media pipeline, offline mode, export/print sheet,
  more languages, mobile layout pass. Pull into Now/Next only with an explicit
  task and a `DECISIONS.md` entry if it changes architecture.
