# Update Rules

When something changes, update the right doc — and only the right doc. Keep
long-term docs stable; keep `CURRENT-STATE.md` short.

| Change type | Update file | Required? | Notes |
|---|---|---|---|
| New route | `ARCHITECTURE-MAP.md`, `PROJECT-BRIEF.md`, `FILE-MAP.md` | Yes | Add the route + its component |
| New Supabase table | `subsystems/supabase-persistence.md`, `ARCHITECTURE-MAP.md`, `DECISIONS.md` | Yes | Add table + migration note; update `constants.ts` |
| Change to character data format | `subsystems/legacy-character-sheet.md`, `subsystems/supabase-persistence.md`, `DECISIONS.md` | Yes | Migration note; affects save/load both layers |
| Change to `rules.json` | `subsystems/rules-data.md` (if contract changes) | If contract changes | Keep RU/EN in sync; run `audit:disciplines` |
| New VTM mechanic | `subsystems/vtm-mechanics.md`, maybe `DECISIONS.md` | Yes | Note tests; check legacy duplicate |
| Move logic legacy → TS | `ARCHITECTURE-MAP.md` (Known duplication), `DECISIONS.md` | Yes | Record what moved and what remains duplicated |
| Change iframe bridge | `subsystems/character-sheet-bridge.md`, `DECISIONS.md` | Yes | Params/localStorage/postMessage are a contract |
| Change table layer/data model | `subsystems/game-table.md`, `src/games/vampires/modules/table/types.ts` docs, maybe `DECISIONS.md` | Yes | Shared contract |
| Change music/media system | `subsystems/music-and-media.md` | Yes | Adapters, buckets, autoplay behavior |
| New systemic risk | `RISKS.md` | Yes | One row + mitigation |
| Architectural decision | `DECISIONS.md` | Yes | Use the decision template |
| Current focus shift | `CURRENT-STATE.md` | Yes | Keep short; delete stale lines |
| Temporary bug (no systemic issue) | none (optionally `CURRENT-STATE.md` while active) | No | Use `templates/bug-investigation-template.md` in the task, not long-term docs |
| One-off task | none | No | Use `templates/task-card-template.md` |

## Principles
- **Temporary bugs** do not belong in long-term docs unless they reveal a
  systemic problem (then add a `RISKS.md` row and/or a decision).
- **Architectural decisions** go in `DECISIONS.md`.
- **Current focus** goes in `CURRENT-STATE.md` — and only there.
- **The file map** changes only when a file's *role or risk* changes, not on
  every edit.
- **Subsystem docs** change when the subsystem's *contract* changes, not for
  internal refactors that preserve behavior.
- When in doubt, prefer fewer, higher-signal updates over noise.
