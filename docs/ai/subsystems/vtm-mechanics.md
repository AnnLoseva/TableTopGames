# VTM Mechanics

## Purpose
Pure, framework-independent VTM V5 rules logic. These modules take data and
return data — no React, no DOM, no Supabase. They are the intended single source
of truth as logic migrates out of the legacy sheet.

## Modules (`games/vampires/core/vtm5/rules/*`)
- `health/index.ts` — health/damage tracker (superficial/aggravated, max,
  impaired, physical state for vampire/mortal/ghoul/thinblood/custom).
- `humanity/index.ts` — humanity, stains, remorse.
- `damage/index.ts` — damage helpers/utilities.
- `derived-stats/index.ts` — derived statistics from attributes/skills.
- `disciplines/` — the discipline engine and supporting data:
  - `engine/index.ts` — evaluates disciplines/powers.
  - `schema/index.ts` — discipline data schema.
  - `rules-loader/index.ts` — loads disciplines from `rules.json` /
    `rules_eng.json`.
  - `costs/index.ts`, `durations/index.ts`, `effects/index.ts` — mechanics of
    powers.
  - `character-disciplines/index.ts` — a character's disciplines.
  - `active-effects/index.ts` — currently active effects.
- `legacy-cost-parser/index.ts` — parses legacy cost strings.

## Actor adapter

`games/vampires/core/vtm5/adapters/actors.ts` normalizes display vitals and simple
trait-based roll pools for linked and compact actors. It remains pure and does
not know about React, Supabase or master-console UI.

## Health
`health/index.ts` exposes typed trackers (`HealthTracker`, `NormalizedHealth`) and
damage application. Damage has severity (superficial/aggravated), a target
(health/willpower), and options (source, weapon tags, armor, halving, margin…).
Physical states include healthy/impaired/torpor/dead. **Legacy duplicate:**
`public/vampires/vtm-health.js` — keep behavior aligned.

## Willpower
Willpower damage is modeled via the same damage/target machinery (`target:
'willpower'`) rather than a separate module. Check `health/index.ts` and
`damage/index.ts` before adding a parallel implementation.

## Humanity / stains / remorse
`humanity/index.ts` handles the humanity track, stains, and remorse resolution
(`applyRemorseCheckResult` — dice rolling stays in UI). Table quick-preview uses
`games/vampires/modules/rolls/utils/remorse-roll.ts` on top of the same core function.
**Legacy duplicate:** `public/vampires/vtm-humanity.js` (includes `applyRemorseCheckResult`).
Guarded by `npm run test:vtm-parity`.

## Derived stats
`derived-stats/index.ts` computes values derived from core traits (e.g.
health/willpower maxima, other derived numbers). Changing derivation affects the
sheet and the table — verify both.

## Disciplines
The discipline layer loads rules from the JSON data, validates them against
`schema/index.ts`, and evaluates costs/durations/effects through
`engine/index.ts`. This is the most test-covered area — use the scripts below.

## Legacy duplication
- `games/vampires/core/vtm5/rules/health/index.ts` ↔ `public/vampires/vtm-health.js`
- `games/vampires/core/vtm5/rules/humanity/index.ts` ↔ `public/vampires/vtm-humanity.js`
- discipline cost/effect parsing ↔ legacy parsing in `public/vampires/main.js`
  (`legacy-cost-parser.ts` exists to bridge old cost strings)

When you change one side, decide whether the other must change too, and record
divergence in `DECISIONS.md`.

## Tests and validation
- `npm run audit:disciplines` — audits discipline rules data.
- `npm run validate:disciplines` — validates discipline mechanics.
- `npm run test:disciplines` — tests the discipline engine.
- `npm run test:vtm-parity` — legacy `vtm-health.js` / `vtm-humanity.js` ↔ `core/` parity.
- `npm run lint` — type check.

## Safe edit protocol
1. Read `../workflows/vtm-mechanics-edit-protocol.md`.
2. Keep the module pure; no React/DOM/Supabase imports.
3. Check disciplines and derived stats for knock-on effects.
4. If a legacy duplicate exists, note it and sync if needed.
5. Run the discipline scripts + `npm run lint`.

## Related docs
`rules-data.md`, `dice-and-rolls.md`, `legacy-character-sheet.md`,
`../workflows/vtm-mechanics-edit-protocol.md`.
