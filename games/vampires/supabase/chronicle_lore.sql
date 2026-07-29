-- Chronicle lore + random tables.
-- System VTM rules stay in public/vampires/rules.json + modules/reference — never copied here.
-- Depends on games/vampires/supabase/master_console_persistence.sql.

create table if not exists public.chronicle_lore_categories (
  id uuid primary key default gen_random_uuid(),
  chronicle_id uuid not null references public.chronicles(id) on delete cascade,
  room text not null,
  slug text not null,
  title text not null,
  kind text not null default 'custom',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chronicle_lore_categories_slug_check
    check (slug ~ '^[a-z][a-z0-9_-]{0,63}$'),
  constraint chronicle_lore_categories_title_check
    check (length(trim(title)) between 1 and 120),
  constraint chronicle_lore_categories_kind_check
    check (kind in (
      'clans', 'disciplines', 'merits', 'npc', 'locations', 'plots', 'random_tables', 'custom', 'system'
    )),
  unique (chronicle_id, slug)
);

create table if not exists public.chronicle_lore_entries (
  id uuid primary key default gen_random_uuid(),
  chronicle_id uuid not null references public.chronicles(id) on delete cascade,
  room text not null,
  category_id uuid null references public.chronicle_lore_categories(id) on delete set null,
  category_slug text not null default 'custom',
  title text not null,
  short_summary text not null default '',
  body_html text not null default '',
  tags text[] not null default '{}'::text[],
  visibility text not null default 'master',
  status text not null default 'draft',
  attachments jsonb not null default '[]'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chronicle_lore_entries_title_check check (length(trim(title)) between 1 and 200),
  constraint chronicle_lore_entries_visibility_check check (visibility in ('master', 'shared')),
  constraint chronicle_lore_entries_status_check check (status in ('draft', 'published', 'archived')),
  constraint chronicle_lore_entries_tags_check check (cardinality(tags) <= 48),
  constraint chronicle_lore_entries_attachments_check check (jsonb_typeof(attachments) = 'array')
);

-- Physically separate GM-only notes (never selected by player policies).
create table if not exists public.chronicle_lore_entry_private (
  entry_id uuid primary key references public.chronicle_lore_entries(id) on delete cascade,
  chronicle_id uuid not null references public.chronicles(id) on delete cascade,
  room text not null,
  private_note text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.chronicle_random_tables (
  id uuid primary key default gen_random_uuid(),
  chronicle_id uuid not null references public.chronicles(id) on delete cascade,
  room text not null,
  title text not null,
  description text not null default '',
  tags text[] not null default '{}'::text[],
  visibility text not null default 'master',
  dice_expression text not null default '',
  rows jsonb not null default '[]'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chronicle_random_tables_title_check check (length(trim(title)) between 1 and 200),
  constraint chronicle_random_tables_visibility_check check (visibility in ('master', 'shared')),
  constraint chronicle_random_tables_rows_check check (jsonb_typeof(rows) = 'array'),
  constraint chronicle_random_tables_tags_check check (cardinality(tags) <= 48)
);

create index if not exists chronicle_lore_categories_room_sort_idx
  on public.chronicle_lore_categories (room, sort_order, title);
create index if not exists chronicle_lore_entries_room_category_idx
  on public.chronicle_lore_entries (room, category_slug, status, updated_at desc);
create index if not exists chronicle_lore_entries_room_tags_idx
  on public.chronicle_lore_entries using gin (tags);
create index if not exists chronicle_lore_entries_title_trgm_idx
  on public.chronicle_lore_entries using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(short_summary, '') || ' ' || coalesce(body_html, '')));
create index if not exists chronicle_random_tables_room_idx
  on public.chronicle_random_tables (room, updated_at desc);

create or replace function public.enforce_chronicle_lore_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_room text;
begin
  select chronicles.room into expected_room
  from public.chronicles
  where chronicles.id = new.chronicle_id;
  if expected_room is null or new.room <> expected_room then
    raise exception 'room does not match chronicle_id';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_chronicle_lore_scope() from public;

drop trigger if exists chronicle_lore_categories_scope on public.chronicle_lore_categories;
create trigger chronicle_lore_categories_scope
before insert or update on public.chronicle_lore_categories
for each row execute function public.enforce_chronicle_lore_scope();

drop trigger if exists chronicle_lore_entries_scope on public.chronicle_lore_entries;
create trigger chronicle_lore_entries_scope
before insert or update on public.chronicle_lore_entries
for each row execute function public.enforce_chronicle_lore_scope();

drop trigger if exists chronicle_lore_entry_private_scope on public.chronicle_lore_entry_private;
create trigger chronicle_lore_entry_private_scope
before insert or update on public.chronicle_lore_entry_private
for each row execute function public.enforce_chronicle_lore_scope();

drop trigger if exists chronicle_random_tables_scope on public.chronicle_random_tables;
create trigger chronicle_random_tables_scope
before insert or update on public.chronicle_random_tables
for each row execute function public.enforce_chronicle_lore_scope();

alter table public.chronicle_lore_categories enable row level security;
alter table public.chronicle_lore_entries enable row level security;
alter table public.chronicle_lore_entry_private enable row level security;
alter table public.chronicle_random_tables enable row level security;

revoke all on public.chronicle_lore_categories from anon;
revoke all on public.chronicle_lore_entries from anon;
revoke all on public.chronicle_lore_entry_private from anon;
revoke all on public.chronicle_random_tables from anon;

grant select, insert, update, delete on public.chronicle_lore_categories to authenticated;
grant select, insert, update, delete on public.chronicle_lore_entries to authenticated;
grant select, insert, update, delete on public.chronicle_lore_entry_private to authenticated;
grant select, insert, update, delete on public.chronicle_random_tables to authenticated;

-- Masters: full access. Shared published entries: readable by chronicle members (future players).
drop policy if exists "Masters manage lore categories" on public.chronicle_lore_categories;
create policy "Masters manage lore categories" on public.chronicle_lore_categories
for all to authenticated
using (public.is_chronicle_master(chronicle_id))
with check (public.is_chronicle_master(chronicle_id));

drop policy if exists "Masters manage lore entries" on public.chronicle_lore_entries;
create policy "Masters manage lore entries" on public.chronicle_lore_entries
for all to authenticated
using (public.is_chronicle_master(chronicle_id))
with check (public.is_chronicle_master(chronicle_id));

drop policy if exists "Members read shared lore entries" on public.chronicle_lore_entries;
create policy "Members read shared lore entries" on public.chronicle_lore_entries
for select to authenticated
using (
  public.is_chronicle_member(chronicle_id)
  and visibility = 'shared'
  and status = 'published'
);

drop policy if exists "Masters manage lore private notes" on public.chronicle_lore_entry_private;
create policy "Masters manage lore private notes" on public.chronicle_lore_entry_private
for all to authenticated
using (public.is_chronicle_master(chronicle_id))
with check (public.is_chronicle_master(chronicle_id));

drop policy if exists "Masters manage random tables" on public.chronicle_random_tables;
create policy "Masters manage random tables" on public.chronicle_random_tables
for all to authenticated
using (public.is_chronicle_master(chronicle_id))
with check (public.is_chronicle_master(chronicle_id));

drop policy if exists "Members read shared random tables" on public.chronicle_random_tables;
create policy "Members read shared random tables" on public.chronicle_random_tables
for select to authenticated
using (
  public.is_chronicle_member(chronicle_id)
  and visibility = 'shared'
);
