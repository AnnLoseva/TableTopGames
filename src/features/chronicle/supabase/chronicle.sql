-- Chronicle (fanfic) domain — chapters + named timeline snapshots.
-- Applied live 2026-09-13 (see docs/ai/DECISIONS.md).
--
-- Security model, and the reason it differs from every other table in this
-- project: a chapter row carries data the reader must NEVER receive — drafts
-- and `author_notes`. Row-level security can hide rows but not columns, so
-- `anon` is given no access to this table at all; the public site reads a
-- view (`chronicle_published_chapters`) that selects published rows and only
-- the public columns. The view is deliberately SECURITY DEFINER (Postgres'
-- default, `security_invoker = false`): it runs as its owner, so it can read
-- the locked-down base table on behalf of an anonymous reader while the table
-- itself stays unreachable through the Data API.
--
-- Characters, relationships and the relationship timeline are NOT redefined
-- here — they live in characters_map_* and are reused as-is (the map is this
-- domain's timeline view). See src/features/characters_map/supabase/characters_map.sql.

-- Mirrors CHARACTERS_MAP_OWNER_AUTH_USER_ID / CHRONICLE_OWNER_AUTH_USER_ID in
-- the TypeScript constants — the single writer/author account.
-- 44153f98-aaf2-4935-b7b2-45fe3155edc6

create table if not exists public.chronicle_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null,
  month integer check (month is null or (month between 1 and 12)),
  day integer check (day is null or (day between 1 and 31)),
  label text not null default '',
  description text not null default '',
  cover_image text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chronicle_chapters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  slug text not null,
  chapter_number integer not null default 1,
  -- TipTap document, plus a plain-text mirror for word counts and excerpts
  -- (so neither the editor nor the reader list has to walk the JSON).
  content jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  content_text text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published')),
  -- Same optional-precision date model as the relationship map: the year is
  -- what the timeline orders by, month/day refine it when known.
  timeline_year integer,
  timeline_month integer check (timeline_month is null or (timeline_month between 1 and 12)),
  timeline_day integer check (timeline_day is null or (timeline_day between 1 and 31)),
  timeline_label text not null default '',
  timeline_snapshot_id uuid references public.chronicle_snapshots(id) on delete set null,
  author_notes text not null default '',
  cover_image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  -- A published chapter must sit somewhere on the timeline; a draft may not
  -- know its year yet.
  constraint chronicle_chapters_published_needs_year
    check (status = 'draft' or timeline_year is not null)
);

create unique index if not exists chronicle_chapters_slug_idx
  on public.chronicle_chapters (slug);

create index if not exists chronicle_chapters_status_idx
  on public.chronicle_chapters (status, chapter_number);

create index if not exists chronicle_chapters_timeline_idx
  on public.chronicle_chapters (timeline_year);

create index if not exists chronicle_snapshots_year_idx
  on public.chronicle_snapshots (year);

alter table public.chronicle_chapters enable row level security;
alter table public.chronicle_snapshots enable row level security;

-- No `anon` grant anywhere here: the public site never touches these tables.
revoke all on public.chronicle_chapters from anon;
revoke all on public.chronicle_snapshots from anon;
grant select, insert, update, delete on public.chronicle_chapters to authenticated;
grant select, insert, update, delete on public.chronicle_snapshots to authenticated;

drop policy if exists "Only the author can read chapters" on public.chronicle_chapters;
create policy "Only the author can read chapters"
  on public.chronicle_chapters for select
  to authenticated
  using ((select auth.uid()) = '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid);

drop policy if exists "Only the author can insert chapters" on public.chronicle_chapters;
create policy "Only the author can insert chapters"
  on public.chronicle_chapters for insert
  to authenticated
  with check ((select auth.uid()) = '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid);

drop policy if exists "Only the author can update chapters" on public.chronicle_chapters;
create policy "Only the author can update chapters"
  on public.chronicle_chapters for update
  to authenticated
  using ((select auth.uid()) = '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid)
  with check ((select auth.uid()) = '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid);

drop policy if exists "Only the author can delete chapters" on public.chronicle_chapters;
create policy "Only the author can delete chapters"
  on public.chronicle_chapters for delete
  to authenticated
  using ((select auth.uid()) = '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid);

drop policy if exists "Only the author can read snapshots" on public.chronicle_snapshots;
create policy "Only the author can read snapshots"
  on public.chronicle_snapshots for select
  to authenticated
  using ((select auth.uid()) = '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid);

drop policy if exists "Only the author can insert snapshots" on public.chronicle_snapshots;
create policy "Only the author can insert snapshots"
  on public.chronicle_snapshots for insert
  to authenticated
  with check ((select auth.uid()) = '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid);

drop policy if exists "Only the author can update snapshots" on public.chronicle_snapshots;
create policy "Only the author can update snapshots"
  on public.chronicle_snapshots for update
  to authenticated
  using ((select auth.uid()) = '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid)
  with check ((select auth.uid()) = '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid);

drop policy if exists "Only the author can delete snapshots" on public.chronicle_snapshots;
create policy "Only the author can delete snapshots"
  on public.chronicle_snapshots for delete
  to authenticated
  using ((select auth.uid()) = '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid);

-- The reader's only door. Published rows, public columns: no `author_notes`,
-- no `status`, no `user_id`, no drafts. SECURITY DEFINER on purpose (see the
-- header) — Supabase's linter flags such views by design, and here that is the
-- mechanism, not an oversight.
drop view if exists public.chronicle_published_chapters;
create view public.chronicle_published_chapters
with (security_invoker = false) as
  select
    id,
    title,
    slug,
    chapter_number,
    content,
    content_text,
    timeline_year,
    timeline_month,
    timeline_day,
    timeline_label,
    cover_image,
    published_at
  from public.chronicle_chapters
  where status = 'published';

grant select on public.chronicle_published_chapters to anon, authenticated;

-- Public site copy (title/subtitle/intro) plus the one reader-facing toggle:
-- whether a chapter's in-world year is shown to readers. A single row, public
-- to read (it *is* the public page's text), author-only to change.
create table if not exists public.chronicle_settings (
  id integer primary key default 1 check (id = 1),
  title text not null default 'Хроника',
  subtitle text not null default '',
  intro text not null default '',
  show_year_to_reader boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.chronicle_settings (id) values (1) on conflict (id) do nothing;

alter table public.chronicle_settings enable row level security;

grant select on public.chronicle_settings to anon;
grant select, update on public.chronicle_settings to authenticated;

drop policy if exists "Anyone can read chronicle settings" on public.chronicle_settings;
create policy "Anyone can read chronicle settings"
  on public.chronicle_settings for select
  to public
  using (true);

drop policy if exists "Only the author can update chronicle settings" on public.chronicle_settings;
create policy "Only the author can update chronicle settings"
  on public.chronicle_settings for update
  to authenticated
  using ((select auth.uid()) = '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid)
  with check ((select auth.uid()) = '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid);
