# Pathfinder 2

Isolated Pathfinder 2 game domain for TableTopGames.

## Runtime

- Route: `/pathfinder2/sheet`
- Entry: `sheet/Pathfinder2SheetRoute.tsx`
- Persistence: browser `localStorage` under
  `pathfinder2-character-draft-v1`
- Rules source: short original summaries in `sheet/rules-source.ts` link to
  `pf2.ru` searches. Full site content is not scraped or vendored.

The sheet is intentionally independent from the existing VTM Supabase and
legacy iframe contracts.
