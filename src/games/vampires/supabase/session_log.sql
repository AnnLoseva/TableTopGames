-- Master session log (chronicle journal), separate from player localStorage diary.
-- Published body is a controlled projection — players never SELECT draft body.
-- Depends on src/games/vampires/supabase/master_console_persistence.sql.

create table if not exists public.session_log_entries (
  id uuid primary key default gen_random_uuid(),
  chronicle_id uuid not null references public.chronicles(id) on delete cascade,
  room text not null,
  session_id uuid null references public.chronicle_sessions(id) on delete set null,
  title text not null default '',
  body_html text not null default '',
  tags text[] not null default '{}'::text[],
  visibility text not null default 'private',
  status text not null default 'draft',
  shared_player_ids uuid[] not null default '{}'::uuid[],
  attachments jsonb not null default '[]'::jsonb,
  version integer not null default 1,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_log_entries_title_check check (length(title) <= 200),
  constraint session_log_entries_visibility_check
    check (visibility in ('private', 'shared_all', 'shared_selected')),
  constraint session_log_entries_status_check
    check (status in ('draft', 'published', 'archived')),
  constraint session_log_entries_version_check check (version >= 1),
  constraint session_log_entries_tags_check check (cardinality(tags) <= 48),
  constraint session_log_entries_attachments_check check (jsonb_typeof(attachments) = 'array')
);

-- Player-readable projection only (no draft body).
create table if not exists public.session_log_published (
  entry_id uuid primary key references public.session_log_entries(id) on delete cascade,
  chronicle_id uuid not null references public.chronicles(id) on delete cascade,
  room text not null,
  session_id uuid null,
  title text not null default '',
  body_html text not null default '',
  tags text[] not null default '{}'::text[],
  visibility text not null default 'shared_all',
  shared_player_ids uuid[] not null default '{}'::uuid[],
  published_at timestamptz not null default now(),
  published_version integer not null default 1,
  constraint session_log_published_visibility_check
    check (visibility in ('shared_all', 'shared_selected'))
);

create index if not exists session_log_entries_room_updated_idx
  on public.session_log_entries (room, status, updated_at desc);
create index if not exists session_log_entries_session_idx
  on public.session_log_entries (session_id, updated_at desc);
create index if not exists session_log_published_room_idx
  on public.session_log_published (room, published_at desc);

create or replace function public.enforce_session_log_scope()
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

revoke all on function public.enforce_session_log_scope() from public;

drop trigger if exists session_log_entries_scope on public.session_log_entries;
create trigger session_log_entries_scope
before insert or update on public.session_log_entries
for each row execute function public.enforce_session_log_scope();

drop trigger if exists session_log_published_scope on public.session_log_published;
create trigger session_log_published_scope
before insert or update on public.session_log_published
for each row execute function public.enforce_session_log_scope();

-- Optimistic concurrency: reject stale version updates.
create or replace function public.session_log_bump_version()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.version <= old.version then
    new.version := old.version + 1;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists session_log_entries_version_bump on public.session_log_entries;
create trigger session_log_entries_version_bump
before update on public.session_log_entries
for each row execute function public.session_log_bump_version();

alter table public.session_log_entries enable row level security;
alter table public.session_log_published enable row level security;

revoke all on public.session_log_entries from anon;
revoke all on public.session_log_published from anon;

grant select, insert, update, delete on public.session_log_entries to authenticated;
grant select, insert, update, delete on public.session_log_published to authenticated;

drop policy if exists "Masters manage session log drafts" on public.session_log_entries;
create policy "Masters manage session log drafts" on public.session_log_entries
for all to authenticated
using (public.is_chronicle_master(chronicle_id))
with check (public.is_chronicle_master(chronicle_id));

-- Players/members never read draft table.
-- Published projection:
drop policy if exists "Masters manage published session log" on public.session_log_published;
create policy "Masters manage published session log" on public.session_log_published
for all to authenticated
using (public.is_chronicle_master(chronicle_id))
with check (public.is_chronicle_master(chronicle_id));

drop policy if exists "Members read published session log" on public.session_log_published;
create policy "Members read published session log" on public.session_log_published
for select to authenticated
using (
  public.is_chronicle_member(chronicle_id)
  and (
    visibility = 'shared_all'
    or (visibility = 'shared_selected' and auth.uid() = any (shared_player_ids))
  )
);
