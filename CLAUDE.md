# Claude Instructions

Start with **AGENTS.md**. This file only contains Claude-specific notes for this
repository. The shared protocol, reading order, and rules live in `AGENTS.md` and
`docs/ai/`.

## Claude-specific notes

- **You are good at reading large files and mapping architecture.** Use that:
  when a task touches `public/vampires/main.js`, `public/vampires/old-sheet.html`, or
  `components/table/GameTable.tsx`, read the relevant region and summarize the
  data flow before editing.
- **Do not rewrite monoliths without a dedicated task.** "This file is too big"
  is not permission to refactor it. Large refactors of `main.js`,
  `old-sheet.html`, or `GameTable.tsx` require an explicit, separate task.
- **Read the workflow before editing a critical file.** Before touching
  `public/vampires/main.js` / `public/vampires/old-sheet.html` → `docs/ai/workflows/legacy-edit-protocol.md`.
  Before touching `components/table/GameTable.tsx` →
  `docs/ai/workflows/react-table-edit-protocol.md`. Before touching
  `src/games/vampires/core/vtm5/rules/*` → `docs/ai/workflows/vtm-mechanics-edit-protocol.md`.
- **Record long-term architectural decisions** in `docs/ai/DECISIONS.md` using
  the template in `docs/ai/templates/decision-entry-template.md`. One entry per
  real decision — not per bug.
- **Do not bloat `CURRENT-STATE.md`.** Keep it short and current: focus,
  fragile areas, active problems, next tasks. Delete stale lines.
- **Propose doc updates only when they matter** — i.e. when architecture, data
  contracts, routes, VTM mechanics, or the current focus change. Follow
  `docs/ai/UPDATE-RULES.md`. Do not add temporary-bug noise to long-term docs.
- **Before a critical edit, summarize the risks** (which subsystems and contracts
  are affected) so the user can confirm scope.
- There is an older, still-accurate RU overview at `docs/architecture.md`. Treat
  `docs/ai/` as the operational source of truth and keep the two consistent.
