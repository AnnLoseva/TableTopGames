# AI Context Index

This is the catalog of the project's AI context. Every agent starts here after
`AGENTS.md`. Read what your task needs — not everything.

## Documents

| File | What it contains | When to read | When to update |
|---|---|---|---|
| `PROJECT-BRIEF.md` | What the product is, goals, stack, routes | Onboarding / new agent | Product direction or stack changes |
| `CURRENT-STATE.md` | Live focus, fragile areas, active problems | **Every task, first** | Focus/fragility/active-problem changes |
| `ARCHITECTURE-MAP.md` | Runtime flow, layers, known duplication | Any structural task | Architecture or data flow changes |
| `FILE-MAP.md` | File → role → risk → edit protocol | **Before opening code** | A file's role/risk changes |
| `DEV-COMMANDS.md` | dev/build/lint/audit/validate commands | Before verifying | Scripts change |
| `ROADMAP.md` | Now / Next / Later directions | Planning work | Direction changes |
| `DECISIONS.md` | Long-term architectural decisions log | Before big/cross-cutting changes | On any real decision |
| `RISKS.md` | Risk register + mitigations | Before critical edits | New risk appears |
| `UPDATE-RULES.md` | What to update when something changes | After making a change | Rarely |
| `subsystems/*` | Deep dive per subsystem | When working in that subsystem | Subsystem contract changes |
| `workflows/*` | Step-by-step edit protocols | Before editing critical areas | Process changes |
| `agents/*` | Per-agent notes (claude/chatgpt/grok/codex) | Once, per agent | Rarely |
| `templates/*` | Task/decision/subsystem/bug templates | When authoring those | Rarely |

## "I need to… → read this"

| Task | Read (in order) |
|---|---|
| Fix a bug in the character sheet | `CURRENT-STATE` → `subsystems/legacy-character-sheet` + `character-sheet-bridge` → `workflows/legacy-edit-protocol` |
| Add / change a VTM mechanic | `subsystems/vtm-mechanics` → `workflows/vtm-mechanics-edit-protocol` → check legacy duplicate |
| Fix dice / rolls | `subsystems/dice-and-rolls` → `subsystems/vtm-mechanics` → relevant workflow |
| Add a feature to the game table | `subsystems/game-table` → `workflows/react-table-edit-protocol` |
| Add / change the Pathfinder 2 sheet | `subsystems/pathfinder2-sheet` → `workflows/before-any-change` |
| Check / change Supabase saving | `subsystems/supabase-persistence` → `workflows/supabase-edit-protocol` |
| Update rules.json / rules_eng.json | `subsystems/rules-data` → `subsystems/i18n` (RU/EN drift) |
| Clean up / reduce a monolith | `DECISIONS` → the file's subsystem → its workflow (needs an explicit task) |
| Debug why music doesn't play | `subsystems/music-and-media` → `subsystems/supabase-persistence` |
| Prepare a task for Codex | `templates/task-card-template` → `FILE-MAP` → the relevant workflow |
| Understand the whole project fast | `PROJECT-BRIEF` → `ARCHITECTURE-MAP` → `FILE-MAP` |

## Subsystems at a glance

- `subsystems/legacy-character-sheet.md` — the iframe sheet: `old-sheet.html`, `main.js`, `supabase.js`, wizard, health/humanity JS, i18n JS
- `subsystems/character-sheet-bridge.md` — Next ↔ iframe bridge (`/character-sheet`)
- `subsystems/game-table.md` — `src/games/vampires/modules/table/GameTable.tsx` and table components/hooks
- `subsystems/vtm-mechanics.md` — `src/games/vampires/core/vtm5/rules/*` (pure rules)
- `subsystems/rules-data.md` — `rules.json` / `rules_eng.json`
- `subsystems/supabase-persistence.md` — DB tables, buckets, save/load
- `subsystems/music-and-media.md` — `src/games/vampires/modules/music/*`, table media/layers
- `subsystems/dice-and-rolls.md` — rolls, rouse checks, overlays
- `subsystems/i18n.md` — RU/EN naming, `src/games/vampires/lib/i18n/*` and legacy i18n JS
- `subsystems/pathfinder2-sheet.md` — isolated `/pathfinder2/sheet` creator, local draft and pf2.ru source links

See also the older RU overview at `../architecture.md`.
