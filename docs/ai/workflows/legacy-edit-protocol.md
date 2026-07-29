# Legacy Edit Protocol

Applies to: `public/vampires/main.js`, `public/vampires/old-sheet.html`, `public/vampires/supabase.js`,
`public/vampires/creation-wizard.js`, `public/vampires/vtm-health.js`, `public/vampires/vtm-humanity.js`,
`public/vampires/i18n-runtime.js`, `public/vampires/i18n-dictionary.js`, and the bridge shell
`src/games/vampires/modules/character-sheet/components/CharacterSheetScreen.tsx`.

Read `../subsystems/legacy-character-sheet.md` and
`../subsystems/character-sheet-bridge.md` first.

## Rules
1. **No large refactor without a dedicated task.** These files are big and
   un-bundled; "cleaning up" is out of scope for a feature/bug task.
2. **Grep before touching globals.** No module scope protects you — search all of
   `public/vampires/` for every variable/function/event name you change (e.g. the `vtm-*`
   window signals, `charactersListCache`).
3. **Do not break URL params.** `room`, `role`, `characterId`, `new` are a
   contract with the React shell.
4. **Do not break save/load.** The `characters` table shape and the
   `vtm-character-saved` postMessage (including the origin check on the shell
   side) must stay intact.
5. **Do not break character creation.** The wizard and its localStorage draft
   (`vtm-character-creation-draft-v2`) must keep working.
6. **Do not break i18n.** Keep RU/EN keys and the id-based lookups consistent (see
   `../subsystems/i18n.md`).
7. **Keep it valid without a build step.** No TS-only syntax, no ES module imports
   that the plain `<script>` loading won't support.

## After the change — verify the iframe flow
1. `/vampires/character-sheet?new=1` → create a character → save → confirm the URL gains
   `characterId` (postMessage worked).
2. `/vampires/character-sheet?room=campaign-666&role=player` → loads with the right
   room/role and character.
3. Edit health/willpower/humanity → mechanics still correct.
4. Switch language → labels and rules still resolve.
5. Navigate sheet → `/vampires/table` → room/role preserved.

If you edited `vtm-health.js` / `vtm-humanity.js`, also check whether
`src/games/vampires/core/vtm5/rules/health/index.ts` /
`src/games/vampires/core/vtm5/rules/humanity/index.ts` need the same change (see
`vtm-mechanics-edit-protocol.md`).

## Update docs?
Only per `../UPDATE-RULES.md` — e.g. a changed bridge contract or character data
format needs a subsystem update + a `../DECISIONS.md` entry.
