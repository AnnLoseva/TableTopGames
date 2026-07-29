# Character Sheet Bridge

## Purpose
Connects the modern Next/React app to the legacy character sheet. The React shell
owns navigation, room/role, and character identity; the legacy sheet runs inside
an iframe and reports back when a character is saved. This contract is small but
load-bearing — breaking it loses characters or role state.

## Route
- `/vampires/character-sheet` → `src/games/vampires/modules/character-sheet/CharacterSheetRoute.tsx` →
  `src/games/vampires/modules/character-sheet/components/CharacterSheetScreen.tsx`.
- Bridge helpers: `src/games/vampires/modules/character-sheet/legacy/{params,events,bridge}.ts`.
- The shell renders `<iframe src="/vampires/old-sheet.html?...">`.
  `/old-sheet.html` remains a compatibility rewrite for old saved links.
- `/vampires/old` (`src/app/(vampires)/vampires/old/page.tsx`) is a legacy redirect to `/vampires/character-sheet`,
  preserving `room`.

## Query params (shell ⇄ iframe)
Read by the shell from `window.location.search`, then forwarded to the iframe:

| Param | Meaning | Default |
|---|---|---|
| `room` | Campaign room id | `vtm-table-room` in localStorage, else `campaign-666` |
| `role` | `master` \| `player` | param → `vtm-table-role` in localStorage → `player` |
| `characterId` | Character to load | empty (none) |
| `new` | `1` = start a brand-new character | absent |

The shell composes the iframe URL as
`/vampires/old-sheet.html?room=&role=[&characterId=][&new=1]`. When starting a new
character it clears the creation draft
(`localStorage['vtm-character-creation-draft-v2']`), sets `new=1`, and remounts
the iframe via a `key` change.

## localStorage keys
- `vtm-table-room` — last room (written on load and when navigating to `/vampires/table`).
- `vtm-table-role` — last role.
- `vtm-character-creation-draft-v2` — in-progress creation draft (cleared on "new
  character").

## iframe communication
- **iframe → shell:** `window.postMessage({ type: 'vtm-character-saved',
  characterId })`. The shell validates `event.origin === window.location.origin`,
  then stores the id, drops `new`, sets `characterId`, and
  `history.replaceState`s the URL. **Always keep the origin check.**
- **shell → iframe:** via the iframe `src` (params) and by remounting (the
  `key`). There is no other outbound channel today.

## Known risks
- Dropping/renaming a param breaks load, role, or "new character".
- Removing the `origin` check on the message handler is a security regression.
- Changing the `vtm-character-saved` message shape desyncs URL/state.
- localStorage key renames silently break room/role persistence and drafts.
- Remount `key` logic (`${characterId||'new'}-${session}`) controls fresh loads —
  changing it can prevent the sheet from reloading.

## Safe edit protocol
1. Read `../workflows/legacy-edit-protocol.md`.
2. Treat params, localStorage keys, and the postMessage shape as a **contract**:
   change them only with a matching change in `public/vampires/main.js` and a
   `DECISIONS.md` entry.
3. Keep the origin check.
4. Verify: `/vampires/character-sheet?new=1` (create → save → URL gains `characterId`),
   `/vampires/character-sheet?room=campaign-666&role=player` (loads with correct
   room/role), and navigation sheet → `/vampires/table` preserves room/role.

## Related docs
`legacy-character-sheet.md`, `supabase-persistence.md`, `game-table.md`,
`../workflows/legacy-edit-protocol.md`.
