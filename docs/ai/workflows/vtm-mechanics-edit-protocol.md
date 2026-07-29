# VTM Mechanics Edit Protocol

Applies to: `src/games/vampires/core/vtm5/rules/*` (`health/index.ts`,
`humanity/index.ts`, `damage/index.ts`, `derived-stats/index.ts`,
`disciplines/*`) and mechanics that feed rolls.

Read `../subsystems/vtm-mechanics.md` first.

## Rules
1. **Keep it pure and testable.** No React, no DOM, no Supabase imports in
   `src/games/vampires/core/vtm5/rules/*`. Input data → output data.
2. **Don't couple mechanics to UI.** The overlay/panels call the mechanics, not
   the other way around.
3. **Check disciplines and derived stats** for knock-on effects when you change
   health/humanity/damage — they interrelate.
4. **Mind the legacy duplicates.** If you change:
   - `health/index.ts` → check `public/vampires/vtm-health.js`,
   - `humanity/index.ts` → check `public/vampires/vtm-humanity.js`,
   - discipline cost/effect parsing → check legacy parsing in `public/vampires/main.js`
     (and `disciplines/legacy-cost-parser.ts`).
   Decide whether the duplicate must change too, and note divergence in
   `../DECISIONS.md`.
5. **Do not change VTM rules content** as a side effect of a code change; rules
   data lives in `rules.json` / `rules_eng.json` (see `../subsystems/rules-data.md`).

## After the change — run the checks
```bash
npm run lint                 # types
npm run test:vtm-parity      # if health/index.ts or humanity/index.ts touched
npm run audit:disciplines    # if disciplines/rules data touched
npm run validate:disciplines # if mechanics touched
npm run test:disciplines     # if the engine touched
```
Then smoke-test the affected mechanic in the UI (sheet health/willpower/humanity;
table rolls).

## Update docs?
Per `../UPDATE-RULES.md`: a new mechanic or a changed public contract of a
`src/games/vampires/core/vtm5/rules/*` module updates `../subsystems/vtm-mechanics.md` (and likely
`../DECISIONS.md`).
