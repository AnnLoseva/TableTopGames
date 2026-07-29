# Pathfinder 2 Character Sheet

## Scope

The first Pathfinder 2 domain is an intentionally unlisted character-creation
draft at `/pathfinder2/sheet`. It does not appear on the VTM home screen and
does not share the VTM character, room, bridge or Supabase contracts.

## Runtime flow

```text
src/app/pathfinder2/sheet/page.tsx
 → src/games/pathfinder2/sheet/Pathfinder2SheetRoute.tsx
 → rules-data.ts
 → src/games/pathfinder2/Rules/{ancestries,backgrounds,classes,feats}.json
 → components/Pathfinder2SheetPage.tsx
   → character-sheet/CharacterSheetView.tsx
   → builder/CharacterBuilderView.tsx
     → builder/{AttributeRulesEditor,SkillRulesEditor,ReviewAudit}.tsx
   → choices/Pathfinder2ChoiceGallery.tsx
 → data.ts / types.ts / data/* / hooks/* / rules/*
 → localStorage `pathfinder2-character-draft-v3`
```

## Current creation model

- Ten steps: concept, ancestry, heritage, background, class, attributes, skills,
  feats, equipment and review.
- The route defaults to the working character sheet. The top switch moves
  between that sheet and the ten-step builder without changing the URL or
  creating a second character object.
- `Rules/*.json` is the authoritative local catalog for ancestries, ancestry and
  versatile heritages, backgrounds, classes and general/skill/mythic feats.
- `rules-data.ts` is a server-only adapter: it normalizes the owner-provided JSON
  documents into the serializable catalog used by the client component. Do not
  import the raw JSON into the client component.
- One native-dialog gallery handles ancestries, normal/versatile heritages,
  backgrounds, classes and feats. Search/filter state and preview selection are
  transient; only explicit confirmation writes the selected ID to the draft.
- The schema-v3 draft stores source decisions, not editable final values:
  ancestry mode/free boosts, background boosts, class key boost, final free
  boosts, separate class/Intelligence/replacement skill choices and
  level-stamped skill increases.
- `rules/{attributes,skills,creation,progression}/*` is a pure TypeScript engine.
  It calculates attribute breakdowns, automatic and selected skills,
  proficiency ranks/modifiers, replacement choices and a structured validation
  audit without React.
- `rules/creation/structured-rules.ts` converts the 27 checked-in classes into
  explicit skill grants, restricted choices, base free-skill counts,
  Intelligence behavior and class-specific increase schedules. Display strings
  in `classes.json` are not parsed by the client rules engine.
- Normal and versatile heritages are mutually exclusive. Confirming one clears
  the other; changing ancestry clears only an incompatible normal heritage.
- Character creation is strict at level 1. The engine validates rank adjacency,
  master/legendary minimum levels, class schedules and partial attribute boosts,
  but the level 2–20 choice UI is intentionally not exposed yet. A character
  above level 1 cannot be marked ready.
- The summary calculates draft HP, unarmored AC, perception and class DC using
  calculated attributes and selected rules records; perception and class DC
  respect the class rank in `classes.json`.
- Draft persistence is local to the browser under the versioned storage key.
  Text changes are debounced, choice confirmations save immediately, and the
  schema-v3 draft stores catalog and skill selections by stable IDs. The restore
  path reads the old `pathfinder2-character-draft-v1` key, preserves legacy
  attributes/skills as a snapshot and suggestions, sets `needsRulesRebuild`,
  and never invents source choices to match old totals.

## Rules source policy

`pf2.ru` is the requested Russian source. The checked-in `Rules/*.json` files
are the owner-provided data source and retain their source/version metadata.
The public pages explicitly ask automated clients not to parse the site and to
request data directly. Therefore:

- do not scrape or mirror complete `pf2.ru` text;
- keep only concise, original summaries in `rules-source.ts`;
- load structured catalog data only from the checked-in `Rules/*.json` files;
- link each summary and catalog attribution to the contextual `pf2.ru` page;
- if the site owner supplies an authorized JSON/CSV export, add a versioned
  importer or extend `rules-data.ts` rather than expanding UI literals;
- preserve source attribution and any license metadata shipped with that export.

## Safe edit protocol

1. Keep all Pathfinder code inside `src/games/pathfinder2/`.
2. Do not import VTM `public/rules*.json` or VTM mechanics.
3. Do not add a home-screen link unless the user explicitly requests discovery.
4. Version the localStorage key if the saved draft shape becomes incompatible;
   retain a read migration from the previous key.
5. Keep raw rule schemas behind `rules-data.ts`; validate all four JSON files.
6. Run `npm run test:pathfinder2-builder`, `npm run lint`, `npm run build`, and
   smoke `/pathfinder2/sheet`.
