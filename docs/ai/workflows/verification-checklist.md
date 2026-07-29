# Verification Checklist

Use after any change, scaled to what you touched. See `../DEV-COMMANDS.md` for
what each command does.

> Environment note: if this session has no local Node toolchain, you may be unable
> to run these. Say so honestly and list what you *would* have run — do not claim
> a pass you didn't observe.

## Always consider
- **TypeScript check:** `npm run lint` (`tsc --noEmit`).
- **Build:** `npm run build` for non-trivial changes.
- **Relevant audit scripts:**
  - `npm run audit:structure` — after moving/extracting files.
  - `npm run audit:disciplines` — after discipline/rules-data edits.
  - `npm run validate:disciplines` — after discipline mechanics edits.
  - `npm run test:disciplines` — after discipline engine edits.
- **Manual route check** for anything user-facing.

## Routes to smoke test
- `/`
- `/vampires/character-sheet`
- `/vampires/character-sheet?new=1`
- `/vampires/character-sheet?room=campaign-666&role=player`
- `/vampires/table?room=campaign-666&role=master`
- `/vampires/table?room=campaign-666&role=player`

## Feature smoke tests
- create / load a character
- save a character (URL gains `characterId` → postMessage worked)
- go from sheet to table (room/role preserved)
- table room/role persistence
- dice roll (appears for master and player)
- health / willpower damage
- scene / layer visibility on scene switch
- music panel (local + YouTube; autoplay gated on gesture)

## Match the check to the area
| Changed area | Minimum checks |
|---|---|
| `src/games/vampires/core/vtm5/rules/*` / disciplines | lint + discipline scripts + affected mechanic |
| `src/games/vampires/modules/table/*` | lint (+ build) + table smoke tests |
| Legacy `public/*` | iframe flow smoke tests |
| Supabase schema | build + master/player room flow + character save/load |
| Rules JSON | `audit:disciplines` (+ `validate:disciplines`) |
