# Before Any Change

The general checklist for every task. Area-specific protocols live alongside this
file.

1. **Identify the task area.** Which subsystem does it touch? (See `../INDEX.md`.)
2. **Read `../CURRENT-STATE.md`.** Know what's fragile and in focus right now.
3. **Read `../FILE-MAP.md`.** Find the files, their **risk level**, and their
   edit protocol.
4. **Read the relevant subsystem doc(s)** in `../subsystems/`.
5. **Read the matching workflow** if the files are `high`/`critical`.
6. **Inspect the exact code.** Open only the files you need.
7. **Make the smallest safe change.** Don't refactor beyond the task.
8. **Run the appropriate checks** (`../DEV-COMMANDS.md` /
   `verification-checklist.md`).
9. **Update docs only if `../UPDATE-RULES.md` requires it.**

## Rules
- If the task is unclear, **do not** rewrite architecture to "fix" it — narrow the
  task or ask.
- If a file is **`critical`**, read its workflow *before* opening it for edit.
- If the change spans **multiple subsystems**, add a `../DECISIONS.md` entry.
- Prefer a small change + a note for the next agent over a large "clean" rewrite.
- Never change a shared contract (bridge params, Supabase schema, rules-data
  shape, VTM rules content) as a side effect of unrelated work.

## Which workflow next?
| Area | Workflow |
|---|---|
| `public/*.js`, `old-sheet.html`, the bridge | `legacy-edit-protocol.md` |
| `src/games/vampires/modules/table/*` | `react-table-edit-protocol.md` |
| `src/games/vampires/core/vtm5/rules/*`, disciplines, rolls logic | `vtm-mechanics-edit-protocol.md` |
| Supabase tables/buckets/saved shape | `supabase-edit-protocol.md` |
| Verifying anything | `verification-checklist.md` |
