# Character Sheet Module

React shell for `/vampires/character-sheet` and the legacy iframe bridge.

## Layout
- `CharacterSheetRoute.tsx` — route entry
- `components/CharacterSheetScreen.tsx` — nav + iframe mount
- `legacy/params.ts` — URL/localStorage param contract (`room`, `role`, `characterId`, `new`)
- `legacy/events.ts` — `vtm-character-saved` message validation (origin check)
- `legacy/bridge.ts` — postMessage subscription, URL replace/push, draft clearing

## Legacy iframe (unchanged)
The actual sheet UI/logic remains in `public/vampires/old-sheet.html` + `public/vampires/main.js`.
Do not rewrite inline — follow `docs/ai/workflows/legacy-edit-protocol.md`.

## Parity
Health/humanity mechanics in `public/vampires/vtm-health.js` and `public/vampires/vtm-humanity.js`
must match `src/games/vampires/core/vtm5/rules/{health,humanity}/`. Run after edits:
```bash
npm run test:vtm-parity
```

## Creation wizard
`public/vampires/creation-wizard.js` — guided flow for `?new=1`. Summary/finish uses the same
rules as `getPlayerCreationIssues()` in `main.js` (exposed on `window`).

## Next incremental work
1. Humanity stain event form in table quick-preview (legacy sheet has full form)
2. Further wizard UX (specialties step, thin-blood hints)
3. Sync full sheet ↔ table quick-preview representations
4. Extract more pure logic from `main.js` into `core/` (one function at a time)