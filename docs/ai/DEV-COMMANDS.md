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
- **Usual culprits:** `app/*/page.tsx`, `games/vampires/modules/*/*Route`,
  `games/vampires/modules/table/GameTable.tsx`, client/server component boundaries.

## `npm run build`
- **What:** full production build (`next build`) — the strongest local gate.
- **When:** before considering a non-trivial change done.
- **Failure means:** type error, invalid import, or a route that fails to compile.
- **Usual culprits:** `lib/*`, `games/vampires/modules/table/*`, type mismatches from
  `games/vampires/modules/table/types.ts` or `games/vampires/core/vtm5/rules/*`.

## `npm run lint`
- **What:** `tsc --noEmit --incremental false` — a full TypeScript type check
  (this is the "lint" here; it is a type check, not ESLint).
- **When:** after almost any TS/TSX edit.
- **Failure means:** a type error somewhere in the graph.
- **Usual culprits:** changed shapes in `games/vampires/modules/table/types.ts`, `games/vampires/core/vtm5/rules/*`,
  `games/vampires/lib/i18n/ruleNames.ts`, or component props.

## `npm run audit:structure`
- **What:** `scripts/audit-project-structure.ts` — audits project structure /
  duplication.
- **When:** after moving/extracting files, or before a structural change.
- **Failure means:** structure drifted from expectations or new duplication.
- **Usual culprits:** duplicated logic between legacy JS and `lib/*`, misplaced
  modules.

## `npm run audit:disciplines`
- **What:** `games/vampires/scripts/audit-discipline-rules.ts` — audits discipline rules data.
- **When:** after editing disciplines in `rules.json` / `rules_eng.json` or
  `games/vampires/core/vtm5/rules/disciplines/*`.
- **Failure means:** discipline rules data is inconsistent or incomplete.
- **Usual culprits:** `public/vampires/rules.json`, `public/vampires/rules_eng.json`,
  `games/vampires/core/vtm5/rules/disciplines/rules-loader/index.ts`,
  `games/vampires/core/vtm5/rules/disciplines/schema/index.ts`.

## `npm run validate:disciplines`
- **What:** `games/vampires/scripts/validate-discipline-mechanics.ts` — validates discipline
  mechanics.
- **When:** after changing discipline costs/durations/effects logic.
- **Failure means:** a mechanic doesn't validate against the schema/expectations.
- **Usual culprits:** `games/vampires/core/vtm5/rules/disciplines/{costs,durations,effects,engine}/index.ts`.

## `npm run test:disciplines`
- **What:** `games/vampires/scripts/test-discipline-engine.ts` — tests the discipline engine.
- **When:** after any change to the discipline engine.
- **Failure means:** engine behavior regressed.
- **Usual culprits:** `games/vampires/core/vtm5/rules/disciplines/engine/index.ts` and its inputs.

## Recommended order after a change
1. `npm run lint` (fast type check)
2. area audit/validate/test scripts (if VTM/disciplines touched)
3. `npm run build` (final gate)
4. manual smoke of affected routes (`workflows/verification-checklist.md`)
