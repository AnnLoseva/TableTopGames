# TableTopGames

Digital character sheets and online campaign tools for tabletop roleplaying
games. The current game domains are Vampire: The Masquerade V5 and Pathfinder 2.

## Routes

| Route | Description |
|-------|-------------|
| `/` | Main screen |
| `/character-sheet` | Character sheet (React shell → legacy iframe) |
| `/table` | Campaign table (scenes, layers, rolls, chat, music) |
| `/master` | Master console (desktop; requires `?room=` + master gate) |
| `/journal` | Player personal journal (localStorage) |
| `/reference` | Rules reference |
| `/pathfinder2/sheet` | Pathfinder 2 character creation draft (not linked from `/`) |

Master console deep links:

```text
/master?room=<room>&module=<id>&entity=<id>
/master?room=<room>&layout=second-screen&display=detached
```

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint     # TypeScript check (tsc --noEmit)
npm run build    # production build
npm run audit:structure
npm run test:master-console
```

Discipline mechanics audits:

```bash
npm run audit:disciplines
npm run validate:disciplines
npm run test:disciplines
npm run test:vtm-parity
```

## Architecture

The project is migrating to a layered model:

```text
Infrastructure → Hub → Game Systems → Modules
```

| Layer | Path | Role |
|-------|------|------|
| Infrastructure | `core/infrastructure/` | Low-level shared contracts (placeholder) |
| Hub | `core/hub/` | Game-neutral chronicle, module and system registry contracts |
| Game Domains | `games/{vampires,pathfinder2}/` | Game-specific route boundary and Pathfinder 2 implementation |
| Game Systems | `games/vampires/core/vtm5/` | Pure VTM5 rules + adapters for modules |
| Modules | `games/vampires/modules/*/` | Feature areas: table, chat, music, rolls, … |

**Full documentation:** [`docs/new-architecture.md`](docs/new-architecture.md)

VTM runtime bootstrap:

```ts
import {
  bootstrapChronicleRuntime,
  createVtm5ChronicleHub,
} from '@/games/vampires/core'

const hub = createVtm5ChronicleHub()
const runtime = bootstrapChronicleRuntime(hub, {
  id: 'chronicle-1',
  name: 'Campaign',
  systemId: 'vtm5',
  roomId: 'campaign-666',
})
```

### Key folders

- `app/` — Next.js route shells
- `app/(vampires)/` — URL-neutral App Router group for VTM routes and providers
- `games/vampires/` — VTM modules, mechanics, client helpers, scripts and Supabase files
- `games/pathfinder2/` — isolated Pathfinder 2 sheet and local rules guide
- `games/vampires/modules/table/` — table data layer, API, hooks, components
- `games/vampires/modules/chat/`, `games/vampires/modules/music/` — extracted feature modules
- `games/vampires/core/vtm5/rules/` — framework-independent VTM5 mechanics
- `public/vampires/` — legacy character sheet and VTM static assets

### Legacy sheet

The full character sheet runs as vanilla JS inside an iframe (`public/vampires/old-sheet.html`).
Do not rewrite `public/vampires/main.js` in wide PRs — see `docs/architecture.md`.

## Docs

- [`docs/new-architecture.md`](docs/new-architecture.md) — target architecture and migration status
- [`docs/architecture.md`](docs/architecture.md) — detailed migration plan and contracts
- [`docs/ai/`](docs/ai/) — agent context (file map, workflows, risks)
