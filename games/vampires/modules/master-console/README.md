# Master Console

Desktop-first shell for `/master?room=<room-id>`. Bootstraps the same VTM5 Hub
runtime as the table, but never imports `GameTable`.

## Live modules (lazy-loaded)

overview · actors · scenes · lore · blood-bonds · session-log

Register in `contributions.ts` only (allow-listed ids).

## Deep links & display

```text
/master?room=<room>&module=<id>&entity=<id>
/master?room=<room>&layout=second-screen&display=detached
```

Parser: `search/deep-link.ts`. Detached windows: `multi-window/open-detached.ts`.

## Sync

| Channel | Use |
|---|---|
| Supabase Realtime | Domain tables (stable channel keys) |
| BroadcastChannel + storage event | Tiny window signals (hello/layout-hint) |
| master_layouts | Saved compositions (not window geometry) |

## Search / commands

`⌘K` → `MasterCommandPalette`. Providers on each contribution; shell fans out.

## Security

Local password gate is compatibility only. Real authorization = Supabase Auth +
`chronicle_members.role = 'master'` + RLS.

`MasterConsoleRoute` verifies the live Auth user and room membership before it
mounts any master module, then rechecks both when the local password unlocks the
console. Missing sessions return to the home login; authenticated non-members
receive an explicit access-denied state instead of a partially working shell.
