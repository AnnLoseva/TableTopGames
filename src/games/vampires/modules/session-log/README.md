# Session Log (Журнал сессии)

Master chronicle journal for the console. **Separate** from the player personal diary (`src/games/vampires/modules/journal`, `vtm-journal:*` localStorage).

## Decision

| Concern | Choice |
|---|---|
| Extend player journal entity? | **No** — player diary is local-only TipTap notes per user/room |
| Persistence | **`session_log_entries`** (master draft) + **`session_log_published`** (player projection) |
| Old journal entries | Unchanged — still open via `/journal` and table journal panel |
| Editor | Reuses **`JournalEditor`** (single TipTap implementation) |

## Security

- Masters CRUD drafts in `session_log_entries` (RLS: chronicle master).
- Players **never** SELECT draft body — only `session_log_published`.
- Publish copies title/body/tags at that moment into the projection.
- Unpublish / archive deletes the projection row.
- Private drafts cannot become player-readable without explicit publish + shared visibility.

## Features

- title, body (TipTap), session link, visibility, status, tags, attachments metadata
- list search/filters, visibility badge, updated_at, linked session
- create / duplicate / archive
- autosave debounce (`AUTOSAVE_DEBOUNCE_MS = 750`) + save status
- optimistic concurrency via `version` / `updated_at` (conflict UI: keep mine / take theirs)
- entity link chips (scene, actor, lore, bond) → master deep-links
- actions: show to players, make private, attach entity, create plot hook, add to timeline

## Local fallback

`vtm-session-log:{room}` and `vtm-session-log-published:{room}` when Supabase is unavailable.
Does **not** touch `vtm-journal:*`.
