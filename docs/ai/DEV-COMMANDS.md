# Dev Commands

From `package.json`. Run the relevant checks after edits (see
`workflows/verification-checklist.md`).

> Environment note: some sessions run without a local Node/npm toolchain. If a
> command cannot run here, state that honestly and describe what it *would*
> verify — never report a pass you did not observe.

## `npm run dev`
- **What:** starts the Next.js dev server.
- **When:** manual/interactive testing of routes and UI.
- **Failure means:** build/runtime error in an App Router route or a client
  component.
- **Usual culprits:** `src/app/*/page.tsx`, `src/games/vampires/modules/*/*Route`,
  `src/games/vampires/modules/table/GameTable.tsx`, client/server component boundaries.

## `npm run build`
- **What:** full production build (`next build`) — the strongest local gate.
- **When:** before considering a non-trivial change done.
- **Failure means:** type error, invalid import, or a route that fails to compile.
- **Usual culprits:** `lib/*`, `src/games/vampires/modules/table/*`, type mismatches from
  `src/games/vampires/modules/table/types.ts` or `src/games/vampires/core/vtm5/rules/*`.

## `npm run lint`
- **What:** `tsc --noEmit --incremental false` — a full TypeScript type check
  (this is the "lint" here; it is a type check, not ESLint).
- **When:** after almost any TS/TSX edit.
- **Failure means:** a type error somewhere in the graph.
- **Usual culprits:** changed shapes in `src/games/vampires/modules/table/types.ts`, `src/games/vampires/core/vtm5/rules/*`,
  `src/games/vampires/lib/i18n/ruleNames.ts`, or component props.

## `npm run audit:structure`
- **What:** `tooling/audit-project-structure.ts` — audits project structure /
  duplication.
- **When:** after moving/extracting files, or before a structural change.
- **Failure means:** structure drifted from expectations or new duplication.
- **Usual culprits:** duplicated logic between legacy JS and `lib/*`, misplaced
  modules.

## `npm run audit:disciplines`
- **What:** `src/games/vampires/scripts/audit-discipline-rules.ts` — audits discipline rules data.
- **When:** after editing disciplines in `rules.json` / `rules_eng.json` or
  `src/games/vampires/core/vtm5/rules/disciplines/*`.
- **Failure means:** discipline rules data is inconsistent or incomplete.
- **Usual culprits:** `public/vampires/rules.json`, `public/vampires/rules_eng.json`,
  `src/games/vampires/core/vtm5/rules/disciplines/rules-loader/index.ts`,
  `src/games/vampires/core/vtm5/rules/disciplines/schema/index.ts`.

## `npm run validate:disciplines`
- **What:** `src/games/vampires/scripts/validate-discipline-mechanics.ts` — validates discipline
  mechanics.
- **When:** after changing discipline costs/durations/effects logic.
- **Failure means:** a mechanic doesn't validate against the schema/expectations.
- **Usual culprits:** `src/games/vampires/core/vtm5/rules/disciplines/{costs,durations,effects,engine}/index.ts`.

## `npm run test:disciplines`
- **What:** `src/games/vampires/scripts/test-discipline-engine.ts` — tests the discipline engine.
- **When:** after any change to the discipline engine.
- **Failure means:** engine behavior regressed.
- **Usual culprits:** `src/games/vampires/core/vtm5/rules/disciplines/engine/index.ts` and its inputs.

## `npm run test:pathfinder2-builder`
- **What:** pure Pathfinder 2 builder scenarios for attributes, skills,
  replacement choices, rank progression, validation and legacy draft migration.
- **When:** after changing `src/games/pathfinder2/sheet/{types,data,rules}*` or
  the creation-step contracts.
- **Failure means:** a level-1 legality rule, stable-ID skill contract,
  migration guarantee or completion gate regressed.
- **Usual culprits:** `src/games/pathfinder2/sheet/rules/{attributes,skills,creation,progression}/*`
  and `src/games/pathfinder2/sheet/data/{migration,migration-v4}.ts`.

## `npm run test:pathfinder2-data`
- **What:** audits the owner-provided Pathfinder JSON counts/IDs, explicit
  connected/partial/missing catalog states and the generic catalog-document
  adapter.
- **When:** after changing `src/games/pathfinder2/Rules/*.json`,
  `sheet/rules-data.ts` or `sheet/data/catalog-*`.
- **Failure means:** catalog IDs/counts drifted, duplicate IDs appeared, or a
  missing/not-connected catalog was accidentally reported as ready.

## Recommended order after a change
1. `npm run lint` (fast type check)
2. area audit/validate/test scripts (`test:pathfinder2-builder` for the PF2 sheet)
3. `npm run build` (final gate)
4. manual smoke of affected routes (`workflows/verification-checklist.md`)
