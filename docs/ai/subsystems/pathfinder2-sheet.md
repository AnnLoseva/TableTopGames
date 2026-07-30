# Pathfinder 2 Character Sheet

## Scope

The first Pathfinder 2 domain is an intentionally unlisted character-creation
draft at `/pathfinder2/sheet`. It does not appear on the VTM home screen and
does not share the VTM character, room, bridge or Supabase contracts.

## Runtime flow

```text
src/app/pathfinder2/sheet/page.tsx
 → src/games/pathfinder2/sheet/Pathfinder2SheetRoute.tsx
   → components/Pathfinder2SheetPage.tsx
   → usePathfinder2RulesCatalog
   → matching Supabase Storage `rules-pathfinder2` manifest + immutable chunks
   → generated local `/rules/pathfinder2/*` fallback
   → character-sheet/CharacterSheetView.tsx
   → builder/CharacterBuilderView.tsx
     → builder/{InitialAttributes,AttributeRules,Features,Equipment,Calculations,Details,Review}*.tsx
   → choices/Pathfinder2ChoiceGallery.tsx
 → data.ts / types.ts / data/* / hooks/* / rules/*
 → localStorage `pathfinder2-character-draft-v4`
```

## Current creation model

- Eleven steps: concept, informational initial attributes, ancestry + heritage,
  background, class, final attributes, features/proficiencies, equipment,
  calculated values, details and review.
- The route defaults to the working character sheet. The top switch moves
  between that sheet and the eleven-step builder without changing the URL or
  creating a second character object.
- `Rules/*.json` is the owner-provided local data source. Ancestries,
  ancestry/versatile heritages, backgrounds, classes and
  general/skill/mythic feats are connected. Canonical schema-v1 documents add
  ancestry/class feats, class progression, equipment, weapons, armor, shields,
  deities, languages and traits. `spells.json` is normalized into
  spell/cantrip/focus catalogs and used by the spellcasting engine.
- The structured shop uses canonical price/Bulk fields, performs integer
  purchases and refunds, and stores inventory entries by stable item ID.
  Equipped armor/weapons and a raised shield feed AC/attack calculations.
  Generated entries flagged as needing owner mechanics are still a
  data-quality limitation; the client does not invent missing rule values.
- `rules-data-source.ts` is the build-time adapter: it normalizes the
  owner-provided JSON documents into the serializable runtime catalog.
  `scripts/generate-rule-catalogs.ts` splits that catalog into deterministic,
  content-addressed chunks. The browser loads and verifies those chunks instead
  of receiving the full catalog through the server-component payload.
- The browser compares the remote Pathfinder manifest release with the local
  manifest generated for the deployed build. A matching release uses Supabase;
  a stale or unavailable remote manifest uses the verified local chunks.
- `data/catalog-audit.ts` validates canonical document metadata and reports
  actual entry counts instead of hardcoded readiness. A migrated draft that
  references an absent class is an explicit completion blocker.
- `data/catalog-document.ts` is the schema-v1 adapter/validator for future
  owner-provided catalogs. New catalogs need stable IDs, source/version/license
  metadata and entry-specific validation before rules-engine use.
- One native-dialog gallery handles ancestries, normal/versatile heritages,
  backgrounds, classes and feats. Search/filter state and preview selection are
  transient; only explicit confirmation writes the selected ID to the draft.
- Local persistence uses schema v4 and stores identity, progression,
  source-separated ancestry/background/class/attribute/skill/feat decisions,
  spellcasting, inventory, final details, vitals and migration state. The
  existing level-1 components and rules engine temporarily use the v3 runtime
  shape through the explicit adapter in `data/migration-v4.ts`; v4-only fields
  survive round trips through that adapter.
- The v3 runtime draft stores source decisions, not editable final values:
  ancestry mode/free boosts, background boosts, class key boost, final free
  boosts, separate class/Intelligence/replacement skill choices and
  level-stamped skill increases.
- `rules/creation/decision-slots.ts` owns stable source-derived choice-slot IDs
  and generic/feat slot completion. The global and class progression documents
  issue ancestry/class/skill/general feat slots; selections are filtered by
  type, level, ancestry, class and structured requirements, then persisted by
  slot ID in schema v4.
- `rules/creation/build-character-state.ts` is the read-only v4 aggregate used
  by the page. Pure modules under `rules/{attributes,skills,feats,
  proficiencies,equipment,combat,spells,languages,religion,progression}` calculate
  breakdowns, automatic grants, inventory/Bulk, attacks, spellcasting, details
  and validation without React.
- `rules/creation/structured-rules.ts` converts the 21 checked-in classes into
  explicit skill grants, restricted choices, base free-skill counts,
  Intelligence behavior and class-specific increase schedules. Display strings
  in `classes.json` are not parsed by the client rules engine.
- Normal and versatile heritages are mutually exclusive. Confirming one clears
  the other; changing ancestry clears only an incompatible normal heritage.
- The sheet exposes a one-level-at-a-time level-up panel. The engine records
  level choices, optionally subtracts 1,000 XP, applies class features,
  catalog feat slots and proficiency grants, class-specific skill increases,
  attribute packages and spell-slot schedules. The high-level scenario keeps
  level 1 as the base and a target level; it cannot skip history. Only classes
  with a canonical progression entry are exposed by the catalog.
- The summary calculates HP, armor AC, perception, saves, class DC, inventory,
  Bulk, equipped attacks and spell attack/DC from source decisions. Current HP
  is not reset on every recalculation and is clamped if a changed build lowers
  its maximum.
- Currency math uses integer copper conversion; purchase/refund and carrying
  rules work with the typed equipment contract and the builder exposes the
  canonical shop. Legacy equipment text remains a non-mechanical migration note.
- Languages/deities use stable catalog IDs. Known ancestry language names are
  mapped to automatic and bonus choices; Intelligence changes the choice limit.
  Required deity and sanctification choices are validated against the deity
  document. Legacy free text remains a migration note.
- Draft persistence is local to the browser under
  `pathfinder2-character-draft-v4`. Text changes are debounced and choice
  confirmations save immediately. Restore reads v4 first, then retains
  `pathfinder2-character-draft-v3` and v1 as read-only migration sources.
  Migration preserves the source draft as `legacySnapshot`, keeps free
  lore/language/equipment strings as unresolved legacy notes, marks the draft
  for review and never invents catalog IDs.

## Rules source policy

The Russian catalog source is the owner-selected
[`gnuraco/pf2r`](https://gitlab.com/gnuraco/pf2r) repository. The checked-in
`Rules/*.json` files are generated from its Babele translation packs and retain
the repository URL plus import version metadata. Therefore:

- import only from a pinned local checkout of `gnuraco/pf2r`;
- keep the pinned pf2r commit in the migration report or generated metadata;
- when a Babele translation omits mechanical fields, read them only from the
  exact PF2e system branch/commit declared by that pinned pf2r manifest and
  record both commits; `Rules/catalogs/attribute-filters.json` follows this
  rule for ancestry boosts/flaws and class key abilities;
- do not mix `pf2.ru` text into pf2r-derived catalogs;
- keep only concise, original summaries in `rules-source.ts`;
- generate structured runtime catalogs only from the checked-in
  `Rules/*.json` files; Supabase Storage is a delivery cache, not an editable
  source of truth;
- use `scripts/migrate-from-pf2r.py` for full imports and
  `scripts/update-rules-from-pf2r.py` for translation-name refreshes;
- keep raw pf2r schemas behind `rules-data-source.ts` rather than expanding UI
  literals;
- preserve source attribution and any license metadata shipped with that export.

## Safe edit protocol

1. Keep all Pathfinder code inside `src/games/pathfinder2/`.
2. Do not import VTM `public/rules*.json` or VTM mechanics.
3. Do not add a home-screen link unless the user explicitly requests discovery.
4. Version the localStorage key if the saved draft shape becomes incompatible;
   retain a read migration from the previous key.
5. Keep raw rule schemas behind `rules-data-source.ts`; update
   `data/catalog-audit.ts` whenever a catalog becomes connected.
6. Run `npm run test:pathfinder2-builder`, `npm run test:pathfinder2-data`,
   `npm run test:pathfinder2-equipment`, `npm run test:pathfinder2-spells`,
   `npm run test:pathfinder2-progression`,
   `npm run test:pathfinder2-builder:e2e`, `npm run lint`, `npm run build`, and
   smoke `/pathfinder2/sheet`.
