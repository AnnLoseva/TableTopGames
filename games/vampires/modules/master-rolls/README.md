# Master Rolls

Permanent master-console right-rail roller. Reuses canonical `RollMessage`
shape, `games/vampires/modules/rolls` builders (quick/rouse/opposed/willpower), and
`games/vampires/modules/table/api/roll-api` for **public** history compatible with `/table`.

## Privacy

| Visibility | Storage | Player realtime | Player history |
|---|---|---|---|
| Public | `table_rolls` via `insertRollRecord` | yes (same as table) | yes |
| Hidden | `master_hidden_rolls` (master RLS only) or local fallback | **never** | **never** |

Reveal copies a public `RollMessage` into `table_rolls` and marks the hidden row
revealed. Hidden rolls are not published on the shared table channel.

## Actor data

Pools and hunger come from `games/vampires/modules/actors` via `actorToRollCharacter` /
`normalizeActor` — not from GameTable character state.

## Undo

`useMasterUndo` keeps a session stack of **inverse operations**
(`delete_hidden_roll`, `restore_actor_hunger`). Ctrl/Cmd+Z never fires while
focus is in inputs, textareas, contenteditable or ProseMirror.
