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
 → data.ts / types.ts / rules-source.ts
 → localStorage `pathfinder2-character-draft-v1`
```

## Current creation model

- Six steps: concept, origin, class, attributes, skills, equipment.
- Starter lists cover six common ancestries, backgrounds and classes.
- The user enters final ability modifiers manually; automatic boost legality is
  a follow-up.
- The summary calculates draft HP, unarmored AC, perception and class DC using
  the selected starter data and the trained rank assumption.
- Draft persistence is local to the browser and versioned by storage-key suffix.

## Rules source policy

`pf2.ru` is the requested Russian source. Its public pages explicitly ask
automated clients not to parse the site and to request data directly. Therefore:

- do not scrape or mirror complete `pf2.ru` text;
- keep only concise, original summaries in `rules-source.ts`;
- link each summary to a contextual `pf2.ru/search?q=...` page;
- if the site owner supplies an authorized JSON/CSV export, add a versioned
  importer/data layer rather than expanding UI literals;
- preserve source attribution and any license metadata shipped with that export.

## Safe edit protocol

1. Keep all Pathfinder code inside `src/games/pathfinder2/`.
2. Do not import VTM `public/rules*.json` or VTM mechanics.
3. Do not add a home-screen link unless the user explicitly requests discovery.
4. Version the localStorage key if the saved draft shape becomes incompatible.
5. Run `npm run lint`, `npm run build`, and smoke `/pathfinder2/sheet`.
