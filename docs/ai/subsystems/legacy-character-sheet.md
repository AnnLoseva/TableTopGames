# Legacy Character Sheet

## Purpose
The full VTM V5 character sheet users actually fill in. It is a standalone,
vanilla HTML/CSS/JS app in `public/vampires/`, served as a static page and embedded in the
React app via an iframe (see `character-sheet-bridge.md`). No build step, no
bundler — files load directly in the browser.

## Main files
- `public/vampires/old-sheet.html` (~5k lines) — markup, layout, inline styles, DOM hooks.
- `public/vampires/main.js` (~11k lines) — the sheet logic: state, rendering, save/load,
  section handling, mechanics glue, event wiring.
- `public/vampires/supabase.js` — legacy Supabase client + character CRUD against the
  `characters` table (create/update/load/list, with a `charactersListCache`).
- `public/vampires/creation-wizard.js` (~1.4k lines) — guided character creation.
- `public/vampires/vtm-health.js` — legacy health/damage tracker (duplicate of
  `src/games/vampires/core/vtm5/rules/health/index.ts`).
- `public/vampires/vtm-humanity.js` — legacy humanity/stains/remorse (duplicate of
  `src/games/vampires/core/vtm5/rules/humanity/index.ts`).
- `public/vampires/i18n-runtime.js` — legacy translation runtime.
- `public/vampires/i18n-dictionary.js` — legacy translation strings.
- Reads `public/vampires/rules.json` / `public/vampires/rules_eng.json` for rules data.

## Data flow
```text
URL params (room, role, characterId, new)
  → main.js reads params + localStorage
  → loads rules.json / rules_eng.json
  → loads character via supabase.js (characters table) OR starts creation wizard
  → renders sheet into old-sheet.html DOM
  → user edits → mechanics via vtm-health.js / vtm-humanity.js
  → save via supabase.js
  → notifies React shell: postMessage { type:'vtm-character-saved', characterId }
```

## Known globals & signals
Legacy code communicates through globals and window events rather than modules.
Observed signals include: `vtm-sheet-ready`, `vtm-character-loaded`,
`vtm-char-type`, `vtm-mortal-template`, `vtm-sheet-section`, `vtm-table-rolls`,
`vtm-table-last-roll`, `vtm-chat-user` / `vtm-sheet-user`, and the
`charactersListCache` cache in `supabase.js`. **Before renaming or repurposing a
global, grep the whole `public/vampires/` folder for it** — usages are not
import-tracked.

## Dangerous areas
- Global variable/state names (no module scope to protect you).
- The save/load path in `supabase.js` (the `characters` table contract).
- Character creation in `creation-wizard.js` (drafts in localStorage).
  Wizard validates specialties, thin-blood generations (14–16), Caitiff discipline
  picks, and exposes clickable step navigation + inline merits/flaws removal.
- The i18n runtime (RU/EN switching, name lookups).
- Anything that emits/consumes the `vtm-*` window events or the postMessage.

## How to edit safely
1. Read `workflows/legacy-edit-protocol.md`.
2. Grep `public/vampires/` for every use of any global you touch.
3. Make the smallest localized change; do not restructure the file.
4. Do not change URL params, save/load shape, creation flow, or i18n keys as a
   side effect.
5. Verify the full iframe flow: open `/vampires/character-sheet`, create/load, edit, save,
   confirm `characterId` appears in the URL (postMessage worked), reload.

## What should eventually move to TypeScript
- Health and humanity mechanics → already mirrored in `src/games/vampires/core/vtm5/rules/*`; converge there.
- Discipline cost/effect parsing → `src/games/vampires/core/vtm5/rules/disciplines/*`.
- Character data typing and Supabase access → shared with `lib/*`.
These moves require **explicit tasks** and `DECISIONS.md` entries — not drive-by
refactors.

## Related docs
`character-sheet-bridge.md`, `vtm-mechanics.md`, `rules-data.md`,
`supabase-persistence.md`, `i18n.md`, `../workflows/legacy-edit-protocol.md`.
