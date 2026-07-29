# Master search, commands & deep links

## Architecture

```
contribution.searchProvider(s)  ──┐
shell-providers (rolls/log/layouts) ──┼── collectSearchProviders()
                                    └── runMasterSearch()  → palette UI
```

- **Shell does not know tables.** It only fans out to registered providers.
- New module: export `searchProvider` / `searchProviders` on its contribution — no palette changes.
- Role filtering: each provider declares `allowedRoles` and uses role-scoped APIs
  (e.g. session log: master → drafts; observer → published projection only).

## Deep links

Canonical:

```
/master?room=<room>&module=<module-id>&entity=<entity-id>
```

Optional allow-listed extras (parser drops unknown keys):
`entityType`, `label`, `kind`, `focus`, plus legacy `actor|scene|entry|table|bond|layout`.

All parsing/writing goes through `parseMasterDeepLink` / `navigateMasterDeepLink`.

## Commands

Built-ins: open modules, create actor/scene/note, run macro, open layout,
publish current scene (confirm), open roller.

Modules can add `commandProvider.getCommands(ctx)`.

Dangerous commands show an inline confirm step before `run`.

## Shortcut

`Cmd/Ctrl+K` (capture phase, `preventDefault`) opens palette even from TipTap —
does not insert `k`. Bare `K` in editors is untouched.
