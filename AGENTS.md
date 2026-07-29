# AGENTS.md — entry point for every AI agent

You are working in **TableTopGames**: a multi-game tabletop RPG workspace whose
load-bearing production domain is Vampire: The Masquerade V5 (digital character
sheet + campaign room) and whose isolated Pathfinder 2 domain starts at
`/pathfinder2/sheet`. This is a **live, non-trivial project**, not a blank slate.
Do not "rebuild it properly from scratch." Make small, safe, well-scoped changes.

The full AI context lives in **`docs/ai/`**. This file is only the protocol.

---

## Required reading order (before you touch anything)

```text
1. Read AGENTS.md              (this file)
2. Read docs/ai/INDEX.md       (map of all context docs)
3. Read docs/ai/CURRENT-STATE.md   (what is fragile / in focus right now)
4. Read docs/ai/FILE-MAP.md    (which files exist, their risk level & protocol)
5. Read ONLY the relevant subsystem + workflow docs for your task
6. THEN inspect the actual code
7. THEN make the smallest safe change
8. THEN run the appropriate verification (docs/ai/DEV-COMMANDS.md)
9. THEN update docs/ai/* only if the rules in UPDATE-RULES.md require it
```

Do not read the whole repository. Read the docs, pick the subsystem, open only
the files that subsystem names.

---

## Core rules

1. **No chaotic edits.** One task = one focused change. If the task is unclear,
   ask or narrow it — do not "improve" architecture on the side.
2. **Minimal context.** Load the subsystem doc + the few files it points to.
   Reading everything is a mistake, not diligence.
3. **Understand the subsystem before changing it.** Every subsystem has a doc in
   `docs/ai/subsystems/`. Read it first.
4. **Legacy is load-bearing.** `public/vampires/main.js` (~11k lines),
   `public/vampires/old-sheet.html` (~5k lines) and the iframe bridge run the real
   character sheet. Follow `docs/ai/workflows/legacy-edit-protocol.md`. No broad
   refactors without an explicit task for it.
5. **The game table is an orchestrator, not a dumping ground.**
   `src/games/vampires/modules/table/GameTable.tsx` must not grow. Extract UI into
   its owning VTM module and rules into
   `src/games/vampires/core/vtm5/rules/*`. See
   `docs/ai/workflows/react-table-edit-protocol.md`.
6. **VTM mechanics stay pure.** Logic in `src/games/vampires/core/vtm5/rules/*` must be
   framework-independent and testable. See
   `docs/ai/workflows/vtm-mechanics-edit-protocol.md`. If you change
   `src/games/vampires/core/vtm5/rules/health/index.ts` or `humanity/index.ts`, check
   whether the legacy duplicate (`public/vampires/vtm-health.js`,
   `public/vampires/vtm-humanity.js`) needs the same change.
7. **Supabase contracts are shared state.** Never rename tables/buckets or change
   the shape of saved data casually. Follow
   `docs/ai/workflows/supabase-edit-protocol.md` and record schema changes in
   `docs/ai/DECISIONS.md`.
8. **Rules data is a data layer.** `public/vampires/rules.json` / `rules_eng.json` hold
   clans, skills, disciplines, merits, flaws, predator types. Do not put UI logic
   there and mind RU/EN name drift.
9. **Keep docs honest.** Record architectural/contract/route/mechanic changes and
   the current focus per `docs/ai/UPDATE-RULES.md`. Do not bloat
   `CURRENT-STATE.md`; long-term decisions go in `DECISIONS.md`.

---

## Verification (see docs/ai/DEV-COMMANDS.md for details)

```bash
npm run lint                 # tsc --noEmit — type check, run after most edits
npm run build                # full Next.js build
npm run audit:structure      # project structure / duplication audit
npm run audit:disciplines    # discipline rules audit
npm run validate:disciplines # discipline mechanics validation
npm run test:disciplines     # discipline engine tests
```

Smoke routes: `/`, `/character-sheet`, `/character-sheet?new=1`,
`/table?room=campaign-666&role=master`, `/table?room=campaign-666&role=player`.

> Note: this repo may run in an environment without a local Node toolchain. If a
> command can't run, say so plainly and describe what you would have verified —
> do not pretend it passed.

---

## If you are not sure

- Do **not** guess at repo state or invent files — check `FILE-MAP.md` or open
  the file.
- Do **not** rewrite a monolith to "make it clearer." That is a separate task.
- Prefer the smallest change that solves the task, plus a note for the next agent.
- If the change spans multiple subsystems, add a `DECISIONS.md` entry.

Agent-specific notes: `docs/ai/agents/{claude,chatgpt,grok,codex}.md`.
