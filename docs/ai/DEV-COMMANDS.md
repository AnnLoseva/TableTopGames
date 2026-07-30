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

## `npm run generate:rules-catalogs`
- **What:** deterministically generates content-addressed Pathfinder and VTM
  runtime chunks plus local manifests under ignored `public/rules/`.
- **When:** automatically before `dev`/`build`, or manually before publishing.
- **Failure means:** a source catalog is malformed or a runtime key was omitted.

## `npm run publish:rules-catalogs`
- **What:** uploads generated immutable files to separate Supabase Storage
  buckets, verifies public SHA-256 checksums, then publishes each manifest.
- **When:** after an intentional rule-data release. Requires
  `SUPABASE_RULES_PUBLISH_KEY` or `SUPABASE_SERVICE_ROLE_KEY`.
- **Failure means:** stop; do not remove the previous release or manually point
  its manifest at an incomplete upload.

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
  `sheet/rules-data-source.ts` or `sheet/data/catalog-*`.
- **Failure means:** catalog IDs/counts drifted, duplicate IDs appeared, or a
  missing/not-connected catalog was accidentally reported as ready.

## `npm run test:pathfinder2-equipment`
- **What:** integer currency, purchase/refund, Bulk/carrying, armor and weapon
  calculation scenarios against typed fixtures.
- **When:** after changing `rules/{equipment,combat}/*` or item contracts.

## `npm run test:pathfinder2-spells`
- **What:** tradition normalization, class slot schedules, casting modes,
  selection limits and spell attack/DC.
- **When:** after changing the spell catalog adapter or `rules/spells/*`.

## `npm run test:pathfinder2-progression`
- **What:** sequential one-level advancement, XP, class features, skill/attribute
  choices and full history replay through level 20.
- **When:** after changing progression, class features or level-stamped state.

## `npm run test:pathfinder2-builder:e2e`
- **What:** starts a local Next.js server (unless `PATHFINDER2_E2E_BASE_URL` is
  set) and uses Playwright with local Chrome/Chromium to verify hydration, all
  eleven steps, v4 persistence, v3 migration, catalog blockers, dialog focus,
  clean browser console and a 1024×768 layout without horizontal overflow.
- **When:** after changing the Pathfinder builder, persistence, catalog gates or
  responsive layout.
- **Local browser:** set `PATHFINDER2_E2E_CHROME_EXECUTABLE` if neither the
  Chrome channel nor Playwright's bundled Chromium is available.

## `npx tsx src/games/pathfinder2/scripts/normalize-rules.ts`
- **What:** deterministic normalizer: reads raw `Rules/*.json` and produces
  canonical `Rules/catalogs/*.json` documents with schemaVersion 1.
- **When:** after owner-provided raw JSON files are updated.
- **Failure means:** structural issue in raw JSON, unexpected parsing failure,
  or unresolvable duplicate IDs.

## Recommended order after a change
1. `npm run lint` (fast type check)
2. area audit/validate/test scripts (all relevant `test:pathfinder2-*` scripts)
3. `npm run build` (final gate)
4. manual smoke of affected routes (`workflows/verification-checklist.md`)
