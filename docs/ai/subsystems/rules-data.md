# Rules Data

## Purpose
The data layer for VTM V5 content: clans, skills, disciplines (and their powers),
merits, flaws, and predator types. It is **data, not logic** — no UI or behavior
belongs here (see the `DECISIONS.md` entry).

## Main files
- `public/vampires/rules.json` — Russian rules data (~34k lines). The primary source.
- `public/vampires/rules_eng.json` — English rules data (~8.8k lines).

Both are static files loaded directly by the legacy sheet and by
`src/games/vampires/core/vtm5/rules/disciplines/rules-loader/index.ts`.

## Language issues
- RU and EN files must stay **structurally parallel**; an entry present in one
  should exist in the other.
- **Identity is by stable IDs, not display names.** Never key logic on a
  translated label — Russian and English names differ and will mismatch. Use the
  stable identifiers and `src/games/vampires/lib/i18n/ruleNames.ts` for display mapping.
- Adding content means adding it to *both* files with matching IDs.

## Consumers
- Legacy sheet: `public/vampires/main.js` reads rules for rendering and mechanics.
- `src/games/vampires/core/vtm5/rules/disciplines/rules-loader/index.ts` →
  `schema/index.ts` / `engine/index.ts` for the
  discipline engine.
- `src/games/vampires/lib/i18n/ruleNames.ts` for display-name ↔ id mapping.
- Audit/validate scripts (`audit:disciplines`, `validate:disciplines`).

## Safe edit protocol
1. Edit narrowly — these are huge files; keep JSON valid.
2. Mirror every change across `rules.json` and `rules_eng.json` with matching IDs.
3. Do not introduce UI/behavior fields; keep it declarative data.
4. Run `npm run audit:disciplines` (and `validate:disciplines` if disciplines
   changed).
5. If the *shape/contract* of the data changes, update `subsystems/rules-data.md`
   and consider a `DECISIONS.md` entry.

## Validation
- `npm run audit:disciplines` — checks discipline rules data consistency.
- `npm run validate:disciplines` — validates mechanics derived from the data.
- `npm run audit:structure` — structural/duplication checks.

## Related docs
`vtm-mechanics.md`, `i18n.md`, `legacy-character-sheet.md`.
