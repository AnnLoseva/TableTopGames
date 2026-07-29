# Agent Notes: Codex

Entry points: `../../AGENTS.md`, then `../FILE-MAP.md` and the relevant workflow.

## Strengths to lean on
- Making the actual code changes with small, reviewable diffs.
- Running the available checks and iterating on failures.

## Required before editing
1. Read `../../AGENTS.md`.
2. Read `../FILE-MAP.md` to get the file's **risk level** and **edit protocol**.
3. Read the matching workflow in `../workflows/` (and the subsystem doc).

## Guardrails
- **Prefer small diffs.** One task, one focused change.
- **No broad refactors** unless the task explicitly says so — especially in
  `public/vampires/main.js`, `public/vampires/old-sheet.html`, `games/vampires/modules/table/GameTable.tsx`.
- Never hardcode Supabase table/bucket names — use `games/vampires/modules/table/constants.ts`.
- Never change the bridge params/postMessage, Supabase schema, or rules-data
  shape as a side effect.
- **Run checks when available:** `npm run lint`, `npm run build`, and the
  discipline scripts for VTM changes (`../DEV-COMMANDS.md`).
- If a task is bigger than one clean diff, split it and note the follow-ups.
