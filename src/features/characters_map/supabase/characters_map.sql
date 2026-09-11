-- Applied to the live Supabase project (klhxbaagarqxaqnrvurr) 2026-09-09.
--
-- "/characters_map": a universal character relationship map, unrelated to
-- any tabletop-game domain in this repo (shares only the Supabase project,
-- like /votes and /dnd/journal). See docs/ai/DECISIONS.md (2026-09-09 entry).
--
-- Access model: single-editor, public read — same shape as the D&D journal.
-- Anyone with the link can view the map; only the owner account ("Anna" in
-- `public.users`, auth_user_id 44153f98-aaf2-4935-b7b2-45fe3155edc6) can
-- write. Unlike the journal there is only one writer (no offline device
-- sync), so this uses plain hard deletes instead of a soft-delete tombstone.
--
-- Shape:
-- - `characters_map_characters` — one node per character (name, description,
--   an optional portrait in Storage, and a canvas position so the map layout
--   persists).
-- - `characters_map_relationships` — one directed or mutual edge between two
--   characters. Relationships are intentionally NOT symmetric: A can have a
--   "loves" edge pointing at B while B has a different "fears" edge pointing
--   back at A, and any pair can carry several edges at once (e.g. a mutual
--   "команда, одноклассники, женаты" edge alongside one-directional ones).
--   `kind = 'mutual'` renders without an arrowhead (applies both ways);
--   `kind = 'directed'` renders from -> to only.

create table if not exists public.characters_map_characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  image_path text,
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint characters_map_characters_name_check check (length(trim(name)) between 1 and 200),
  constraint characters_map_characters_description_check check (length(description) <= 10000)
);

-- Added 2026-09-09 (see DECISIONS.md): a free-form VTM-style character sheet
-- (concept/clan/generation/predator type/sire/ambition/desire, attributes,
-- skills, disciplines, health/willpower tracks, humanity, blood potency,
-- touchstones, merits & flaws). Deliberately untyped JSON, not validated
-- against any rules engine — this domain stays isolated from
-- src/games/vampires/core/vtm5/rules/* and rules.json; the shape lives only
-- in src/features/characters_map/types.ts (`CharacterSheet`). The size cap
-- is a sanity bound, not a real quota.
alter table public.characters_map_characters
  add column if not exists sheet jsonb not null default '{}'::jsonb;

alter table public.characters_map_characters
  drop constraint if exists characters_map_characters_sheet_check;
alter table public.characters_map_characters
  add constraint characters_map_characters_sheet_check check (pg_column_size(sheet) <= 50000);

-- Added 2026-09-10 (see DECISIONS.md): `sheet` also carries the timeline model —
-- `birthYear`/`birthDateLabel` (null birth year = always shown, never gated),
-- `baseKind` ('human'/'vampire'/'ghost', default human) and `events` (dated
-- kind/alive changes). No new columns needed; reuses the existing flexible
-- `sheet` JSON. See `CharacterSheet` in types.ts and `timeline.ts`.

-- Added 2026-09-09 (see DECISIONS.md): `sheet.gallery` — a list of photos
-- (house, pets, notable events) separate from the single portrait in
-- `image_path`. Each item is `{ id, imagePath, caption, category }`, with the
-- image stored in the same `characters-map-images` bucket as the portrait.
-- No new columns/buckets needed; reuses the existing flexible `sheet` JSON
-- and storage policies below. See `GalleryItem` in types.ts.

create index if not exists characters_map_characters_user_idx
  on public.characters_map_characters (user_id);

create table if not exists public.characters_map_relationships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  from_character_id uuid not null references public.characters_map_characters(id) on delete cascade,
  to_character_id uuid not null references public.characters_map_characters(id) on delete cascade,
  kind text not null default 'directed',
  label text not null,
  description text not null default '',
  color text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint characters_map_relationships_kind_check check (kind in ('directed', 'mutual')),
  constraint characters_map_relationships_label_check check (length(trim(label)) between 1 and 100),
  constraint characters_map_relationships_description_check check (length(description) <= 10000),
  constraint characters_map_relationships_color_check check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  constraint characters_map_relationships_not_self check (from_character_id <> to_character_id)
);

create index if not exists characters_map_relationships_from_idx
  on public.characters_map_relationships (from_character_id);

create index if not exists characters_map_relationships_to_idx
  on public.characters_map_relationships (to_character_id);

-- Added 2026-09-10 (see DECISIONS.md): a timeline of dated events that change
-- how the relationship renders (appear/disappear via `active`, plus
-- label/color/description overrides), folded chronologically at render time
-- by `resolveRelationshipState` in src/features/characters_map/timeline.ts.
-- A relationship with no events behaves exactly as before this feature.
alter table public.characters_map_relationships
  add column if not exists events jsonb not null default '[]'::jsonb;

alter table public.characters_map_relationships
  drop constraint if exists characters_map_relationships_events_check;
alter table public.characters_map_relationships
  add constraint characters_map_relationships_events_check check (pg_column_size(events) <= 20000);

alter table public.characters_map_characters enable row level security;
alter table public.characters_map_relationships enable row level security;

-- Explicit grants keep these tables reachable through the Data API even on
-- Supabase projects where newly-created public tables are no longer exposed
-- automatically (see dnd_journal.sql for the same note). RLS below still
-- decides which rows/actions each caller gets.
grant select on public.characters_map_characters, public.characters_map_relationships to anon;
grant select, insert, update, delete on public.characters_map_characters, public.characters_map_relationships to authenticated;

drop policy if exists "Anyone can read map characters" on public.characters_map_characters;
create policy "Anyone can read map characters"
  on public.characters_map_characters for select
  to public
  using (true);

drop policy if exists "Only the owner account can insert map characters" on public.characters_map_characters;
create policy "Only the owner account can insert map characters"
  on public.characters_map_characters for insert
  to authenticated
  with check ((select auth.uid()) = '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid);

drop policy if exists "Only the owner account can update map characters" on public.characters_map_characters;
create policy "Only the owner account can update map characters"
  on public.characters_map_characters for update
  to authenticated
  using ((select auth.uid()) = '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid)
  with check ((select auth.uid()) = '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid);

drop policy if exists "Only the owner account can delete map characters" on public.characters_map_characters;
create policy "Only the owner account can delete map characters"
  on public.characters_map_characters for delete
  to authenticated
  using ((select auth.uid()) = '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid);

drop policy if exists "Anyone can read map relationships" on public.characters_map_relationships;
create policy "Anyone can read map relationships"
  on public.characters_map_relationships for select
  to public
  using (true);

drop policy if exists "Only the owner account can insert map relationships" on public.characters_map_relationships;
create policy "Only the owner account can insert map relationships"
  on public.characters_map_relationships for insert
  to authenticated
  with check ((select auth.uid()) = '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid);

drop policy if exists "Only the owner account can update map relationships" on public.characters_map_relationships;
create policy "Only the owner account can update map relationships"
  on public.characters_map_relationships for update
  to authenticated
  using ((select auth.uid()) = '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid)
  with check ((select auth.uid()) = '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid);

drop policy if exists "Only the owner account can delete map relationships" on public.characters_map_relationships;
create policy "Only the owner account can delete map relationships"
  on public.characters_map_relationships for delete
  to authenticated
  using ((select auth.uid()) = '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid);

-- Storage: public bucket for portraits, one folder per uploader ("<user_id>/<id>-<filename>").
-- Anyone reads via the public URL endpoint (getPublicUrl, bypasses RLS); the
-- SELECT policy below only prevents strangers from LISTing the bucket
-- contents through the API, same reasoning as dnd-journal-images.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('characters-map-images', 'characters-map-images', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Only the owner account can list character map image files" on storage.objects;
create policy "Only the owner account can list character map image files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'characters-map-images'
    and (select auth.uid()) = '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid
  );

drop policy if exists "Only the owner account can upload character map image files" on storage.objects;
create policy "Only the owner account can upload character map image files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'characters-map-images'
    and (select auth.uid()) = '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid
  );

drop policy if exists "Only the owner account can delete character map image files" on storage.objects;
create policy "Only the owner account can delete character map image files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'characters-map-images'
    and (select auth.uid()) = '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid
  );

-- Added 2026-09-11 (see DECISIONS.md): cached English machine translation of
-- owner-authored free text, so the map can be viewed in English with zero
-- live API calls for non-owner viewers. Nullable — a row with no cached
-- translation (or a stale one, detected by a content hash, not `updated_at`
-- — that timestamp also bumps on a plain canvas drag) just falls back to the
-- original Russian for that field; see `localizeCharacter`/
-- `localizeRelationship` in src/features/characters_map/i18n.ts. Populated
-- only by the owner account, while in edit mode with the map set to
-- English, via the `characters-map-translate` Edge Function
-- (src/features/characters_map/supabase/functions/characters-map-translate).
-- No RLS changes needed — this is just another column on rows already
-- covered by the existing owner-only UPDATE policies above.
alter table public.characters_map_characters
  add column if not exists translation_en jsonb;

alter table public.characters_map_characters
  drop constraint if exists characters_map_characters_translation_en_check;
alter table public.characters_map_characters
  add constraint characters_map_characters_translation_en_check
  check (translation_en is null or pg_column_size(translation_en) <= 50000);

alter table public.characters_map_relationships
  add column if not exists translation_en jsonb;

alter table public.characters_map_relationships
  drop constraint if exists characters_map_relationships_translation_en_check;
alter table public.characters_map_relationships
  add constraint characters_map_relationships_translation_en_check
  check (translation_en is null or pg_column_size(translation_en) <= 20000);
