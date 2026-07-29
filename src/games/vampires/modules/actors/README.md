# Actors

UI-independent actor domain for player characters, full NPC sheets and compact
SPCs, plus the master-console **НПС и SPC** module.

## Domain

A linked `characters` row remains the source of truth and is hydrated on load;
`chronicle_actors` stores only chronicle metadata, compact fallback stats and
explicit manual overrides. GM-only fields live in the separate
`chronicle_actor_private` table and are excluded from normalized/public payloads.

Compact-to-full conversion is deliberately two-step: prepare a character draft,
create it through the canonical character-sheet ownership flow, then link the
returned `characters.id`. Unlinking never deletes the character.

Realtime subscriptions are room-filtered for actor tables and ID-filtered for
linked character sheets. Bulk changes use the single
`bulk_update_chronicle_actors` RPC.

## Master module (`contribution.ts`)

Registered as `actors` in `src/games/vampires/modules/master-console/contributions.ts`.

Layout: `[table | detail card 316px]`.

- Combined filters (search, scene, faction, clan, kind, status, tags)
- Sortable columns, row selection, bulk actions with confirm + action log
- Data-driven create templates (`utils/actor-templates.ts`)
- «Мои персонажи» import dialog: any character of the app user (legacy `users`
  auth via `vtm-chat-user`/`vtm-sheet-user`) becomes a linked actor
  (`createLinkedActorFromCharacter`, default kind `full_npc`); duplicates are
  blocked by the chronicle-level unique index
- Quick actions: roller request, rouse request, full sheet route, scene, clone,
  hunger, archive
- Private GM fields only on `MasterActor` / detail card; `toActorPublicPayload`
  never includes them

Does **not** import `GameTable.tsx`. Reuses `src/games/vampires/modules/table` character sheet URL
helper, scene fetch for active scene, and master action log API.

## Layout

```text
src/games/vampires/modules/actors/
  api/           Supabase CRUD + clone
  components/    ActorsModule UI
  hooks/         realtime hydration + active scene id
  services/      normalize, vitals, bulk actions
  utils/         filters, sort, templates, labels, saved filters
  contribution.ts
  types.ts
```
