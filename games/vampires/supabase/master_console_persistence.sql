-- Master console persistence foundation.
--
-- Security boundary: these tables require a real Supabase Auth JWT and an
-- explicit chronicle_members row. The existing localStorage master password is
-- intentionally not consulted. Initial chronicles and their first master must
-- be provisioned by the service role / SQL administrator; there is no client
-- self-claim path for existing room slugs.

create extension if not exists pgcrypto;

create table if not exists public.chronicles (
  id uuid primary key default gen_random_uuid(),
  room text not null unique,
  name text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chronicles_room_format_check
    check (room ~ '^[[:alnum:]_.-]{1,48}$')
);

create table if not exists public.chronicle_members (
  chronicle_id uuid not null references public.chronicles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  primary key (chronicle_id, user_id),
  constraint chronicle_members_role_check
    check (role in ('master', 'observer', 'player'))
);

create index if not exists chronicle_members_user_role_idx
  on public.chronicle_members (user_id, role, chronicle_id);

create or replace function public.is_chronicle_member(target_chronicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chronicle_members member
    where member.chronicle_id = target_chronicle_id
      and member.user_id = auth.uid()
  );
$$;

create or replace function public.is_chronicle_master(target_chronicle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chronicle_members member
    where member.chronicle_id = target_chronicle_id
      and member.user_id = auth.uid()
      and member.role = 'master'
  );
$$;

revoke all on function public.is_chronicle_member(uuid) from public;
revoke all on function public.is_chronicle_master(uuid) from public;
grant execute on function public.is_chronicle_member(uuid) to authenticated;
grant execute on function public.is_chronicle_master(uuid) to authenticated;

create table if not exists public.chronicle_sessions (
  id uuid primary key default gen_random_uuid(),
  chronicle_id uuid not null references public.chronicles(id) on delete cascade,
  room text not null,
  sequence_number integer not null,
  night_number integer not null default 1,
  title text not null default '',
  status text not null default 'planned',
  started_at timestamptz,
  ended_at timestamptz,
  public_summary text not null default '',
  private_summary text not null default '',
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chronicle_sessions_sequence_check check (sequence_number > 0),
  constraint chronicle_sessions_night_check check (night_number > 0),
  constraint chronicle_sessions_status_check
    check (status in ('planned', 'active', 'ended', 'archived')),
  constraint chronicle_sessions_time_check
    check (ended_at is null or started_at is null or ended_at >= started_at),
  unique (chronicle_id, sequence_number)
);

create table if not exists public.master_layouts (
  id uuid primary key default gen_random_uuid(),
  chronicle_id uuid not null references public.chronicles(id) on delete cascade,
  room text not null,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  layout_version integer not null default 1,
  layout_json jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint master_layouts_name_check check (length(trim(name)) between 1 and 120),
  constraint master_layouts_version_check check (layout_version > 0),
  constraint master_layouts_json_check check (jsonb_typeof(layout_json) = 'object')
);

create table if not exists public.master_macros (
  id uuid primary key default gen_random_uuid(),
  chronicle_id uuid not null references public.chronicles(id) on delete cascade,
  room text not null,
  owner_id uuid references auth.users(id) on delete cascade,
  title text not null,
  action_type text not null,
  shortcut text,
  config jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint master_macros_title_check check (length(trim(title)) between 1 and 120),
  constraint master_macros_action_type_check check (action_type ~ '^[a-z][a-z0-9_.-]{0,63}$'),
  constraint master_macros_shortcut_check check (shortcut is null or length(shortcut) <= 64),
  constraint master_macros_config_check check (jsonb_typeof(config) = 'object')
);

create table if not exists public.chronicle_entity_links (
  id uuid primary key default gen_random_uuid(),
  chronicle_id uuid not null references public.chronicles(id) on delete cascade,
  room text not null,
  source_type text not null,
  source_id text not null,
  target_type text not null,
  target_id text not null,
  relation_type text not null,
  label text not null default '',
  visibility text not null default 'master',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint chronicle_entity_links_source_type_check
    check (source_type ~ '^[a-z][a-z0-9_.-]{0,63}$'),
  constraint chronicle_entity_links_target_type_check
    check (target_type ~ '^[a-z][a-z0-9_.-]{0,63}$'),
  constraint chronicle_entity_links_relation_type_check
    check (relation_type ~ '^[a-z][a-z0-9_.-]{0,63}$'),
  constraint chronicle_entity_links_source_id_check check (length(trim(source_id)) between 1 and 160),
  constraint chronicle_entity_links_target_id_check check (length(trim(target_id)) between 1 and 160),
  constraint chronicle_entity_links_source_id_trimmed_check check (source_id = trim(source_id)),
  constraint chronicle_entity_links_target_id_trimmed_check check (target_id = trim(target_id)),
  constraint chronicle_entity_links_not_self_check
    check (source_type <> target_type or source_id <> target_id),
  constraint chronicle_entity_links_visibility_check
    check (visibility in ('master', 'shared')),
  constraint chronicle_entity_links_metadata_check check (jsonb_typeof(metadata) = 'object'),
  unique (chronicle_id, source_type, source_id, target_type, target_id, relation_type)
);

create table if not exists public.master_action_log (
  id uuid primary key default gen_random_uuid(),
  chronicle_id uuid not null references public.chronicles(id) on delete cascade,
  room text not null,
  session_id uuid references public.chronicle_sessions(id) on delete set null,
  action_type text not null,
  actor_type text not null,
  actor_id text not null,
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  inverse_payload jsonb,
  visibility text not null default 'master',
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  reverted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint master_action_log_action_type_check check (action_type ~ '^[a-z][a-z0-9_.-]{0,63}$'),
  constraint master_action_log_actor_type_check check (actor_type ~ '^[a-z][a-z0-9_.-]{0,63}$'),
  constraint master_action_log_actor_id_check check (length(trim(actor_id)) between 1 and 160),
  constraint master_action_log_summary_check check (length(trim(summary)) between 1 and 500),
  constraint master_action_log_payload_check check (jsonb_typeof(payload) = 'object'),
  constraint master_action_log_inverse_payload_check
    check (inverse_payload is null or jsonb_typeof(inverse_payload) = 'object'),
  constraint master_action_log_visibility_check check (visibility in ('master', 'shared'))
);

create index if not exists chronicles_room_idx on public.chronicles (room);
create index if not exists chronicle_sessions_room_sequence_idx
  on public.chronicle_sessions (room, sequence_number desc);
create index if not exists master_layouts_room_owner_updated_idx
  on public.master_layouts (room, owner_id, updated_at desc);
create unique index if not exists master_layouts_one_default_per_owner_idx
  on public.master_layouts (chronicle_id, owner_id) where is_default;
create index if not exists master_macros_room_sort_idx
  on public.master_macros (room, sort_order asc, created_at asc);
create unique index if not exists master_macros_shortcut_per_scope_idx
  on public.master_macros (chronicle_id, coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), shortcut)
  where shortcut is not null;
create index if not exists chronicle_entity_links_room_source_idx
  on public.chronicle_entity_links (room, source_type, source_id);
create index if not exists chronicle_entity_links_room_target_idx
  on public.chronicle_entity_links (room, target_type, target_id);
create index if not exists master_action_log_room_created_idx
  on public.master_action_log (room, created_at desc);
create index if not exists master_action_log_session_created_idx
  on public.master_action_log (session_id, created_at desc);

create or replace function public.enforce_master_console_room()
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

revoke all on function public.enforce_master_console_room() from public;

create or replace function public.enforce_master_action_session_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  session_chronicle_id uuid;
begin
  if new.session_id is null then
    return new;
  end if;

  select sessions.chronicle_id into session_chronicle_id
  from public.chronicle_sessions sessions
  where sessions.id = new.session_id;

  if session_chronicle_id is null or session_chronicle_id <> new.chronicle_id then
    raise exception 'session_id does not belong to chronicle_id';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_master_action_session_scope() from public;

drop trigger if exists chronicle_sessions_room_guard on public.chronicle_sessions;
create trigger chronicle_sessions_room_guard before insert or update on public.chronicle_sessions
for each row execute function public.enforce_master_console_room();
drop trigger if exists master_layouts_room_guard on public.master_layouts;
create trigger master_layouts_room_guard before insert or update on public.master_layouts
for each row execute function public.enforce_master_console_room();
drop trigger if exists master_macros_room_guard on public.master_macros;
create trigger master_macros_room_guard before insert or update on public.master_macros
for each row execute function public.enforce_master_console_room();
drop trigger if exists chronicle_entity_links_room_guard on public.chronicle_entity_links;
create trigger chronicle_entity_links_room_guard before insert or update on public.chronicle_entity_links
for each row execute function public.enforce_master_console_room();
drop trigger if exists master_action_log_room_guard on public.master_action_log;
create trigger master_action_log_room_guard before insert or update on public.master_action_log
for each row execute function public.enforce_master_console_room();
drop trigger if exists master_action_log_session_guard on public.master_action_log;
create trigger master_action_log_session_guard before insert or update on public.master_action_log
for each row execute function public.enforce_master_action_session_scope();

alter table public.chronicles enable row level security;
alter table public.chronicle_members enable row level security;
alter table public.chronicle_sessions enable row level security;
alter table public.master_layouts enable row level security;
alter table public.master_macros enable row level security;
alter table public.chronicle_entity_links enable row level security;
alter table public.master_action_log enable row level security;

revoke all on public.chronicles from anon;
revoke all on public.chronicle_members from anon;
revoke all on public.chronicle_sessions from anon;
revoke all on public.master_layouts from anon;
revoke all on public.master_macros from anon;
revoke all on public.chronicle_entity_links from anon;
revoke all on public.master_action_log from anon;

grant select on public.chronicles to authenticated;
grant select, insert, update, delete on public.chronicle_members to authenticated;
grant select, insert, update, delete on public.chronicle_sessions to authenticated;
grant select, insert, update, delete on public.master_layouts to authenticated;
grant select, insert, update, delete on public.master_macros to authenticated;
grant select, insert, update, delete on public.chronicle_entity_links to authenticated;
grant select, insert on public.master_action_log to authenticated;

drop policy if exists "Chronicle members can read chronicles" on public.chronicles;
create policy "Chronicle members can read chronicles" on public.chronicles
for select to authenticated using (public.is_chronicle_member(id));

drop policy if exists "Members can read own membership" on public.chronicle_members;
create policy "Members can read own membership" on public.chronicle_members
for select to authenticated
using (user_id = auth.uid() or public.is_chronicle_master(chronicle_id));
drop policy if exists "Masters can insert chronicle membership" on public.chronicle_members;
create policy "Masters can insert chronicle membership" on public.chronicle_members
for insert to authenticated with check (public.is_chronicle_master(chronicle_id));
drop policy if exists "Masters can update chronicle membership" on public.chronicle_members;
create policy "Masters can update chronicle membership" on public.chronicle_members
for update to authenticated
using (public.is_chronicle_master(chronicle_id))
with check (public.is_chronicle_master(chronicle_id));
drop policy if exists "Masters can delete chronicle membership" on public.chronicle_members;
create policy "Masters can delete chronicle membership" on public.chronicle_members
for delete to authenticated using (public.is_chronicle_master(chronicle_id));

drop policy if exists "Masters can read chronicle sessions" on public.chronicle_sessions;
create policy "Masters can read chronicle sessions" on public.chronicle_sessions
for select to authenticated using (public.is_chronicle_master(chronicle_id));
drop policy if exists "Masters can insert chronicle sessions" on public.chronicle_sessions;
create policy "Masters can insert chronicle sessions" on public.chronicle_sessions
for insert to authenticated
with check (public.is_chronicle_master(chronicle_id) and created_by = auth.uid());
drop policy if exists "Masters can update chronicle sessions" on public.chronicle_sessions;
create policy "Masters can update chronicle sessions" on public.chronicle_sessions
for update to authenticated
using (public.is_chronicle_master(chronicle_id))
with check (public.is_chronicle_master(chronicle_id));
drop policy if exists "Masters can delete chronicle sessions" on public.chronicle_sessions;
create policy "Masters can delete chronicle sessions" on public.chronicle_sessions
for delete to authenticated using (public.is_chronicle_master(chronicle_id));

drop policy if exists "Owners can read master layouts" on public.master_layouts;
create policy "Owners can read master layouts" on public.master_layouts
for select to authenticated
using (public.is_chronicle_master(chronicle_id) and owner_id = auth.uid());
drop policy if exists "Owners can insert master layouts" on public.master_layouts;
create policy "Owners can insert master layouts" on public.master_layouts
for insert to authenticated
with check (public.is_chronicle_master(chronicle_id) and owner_id = auth.uid());
drop policy if exists "Owners can update master layouts" on public.master_layouts;
create policy "Owners can update master layouts" on public.master_layouts
for update to authenticated
using (public.is_chronicle_master(chronicle_id) and owner_id = auth.uid())
with check (public.is_chronicle_master(chronicle_id) and owner_id = auth.uid());
drop policy if exists "Owners can delete master layouts" on public.master_layouts;
create policy "Owners can delete master layouts" on public.master_layouts
for delete to authenticated
using (public.is_chronicle_master(chronicle_id) and owner_id = auth.uid());

drop policy if exists "Masters can read master macros" on public.master_macros;
create policy "Masters can read master macros" on public.master_macros
for select to authenticated using (public.is_chronicle_master(chronicle_id));
drop policy if exists "Masters can insert master macros" on public.master_macros;
create policy "Masters can insert master macros" on public.master_macros
for insert to authenticated
with check (public.is_chronicle_master(chronicle_id) and (owner_id is null or owner_id = auth.uid()));
drop policy if exists "Masters can update owned master macros" on public.master_macros;
create policy "Masters can update owned master macros" on public.master_macros
for update to authenticated
using (public.is_chronicle_master(chronicle_id) and (owner_id is null or owner_id = auth.uid()))
with check (public.is_chronicle_master(chronicle_id) and (owner_id is null or owner_id = auth.uid()));
drop policy if exists "Masters can delete owned master macros" on public.master_macros;
create policy "Masters can delete owned master macros" on public.master_macros
for delete to authenticated
using (public.is_chronicle_master(chronicle_id) and (owner_id is null or owner_id = auth.uid()));

drop policy if exists "Masters can read entity links" on public.chronicle_entity_links;
create policy "Masters can read entity links" on public.chronicle_entity_links
for select to authenticated using (public.is_chronicle_master(chronicle_id));
drop policy if exists "Masters can insert entity links" on public.chronicle_entity_links;
create policy "Masters can insert entity links" on public.chronicle_entity_links
for insert to authenticated with check (public.is_chronicle_master(chronicle_id));
drop policy if exists "Masters can update entity links" on public.chronicle_entity_links;
create policy "Masters can update entity links" on public.chronicle_entity_links
for update to authenticated
using (public.is_chronicle_master(chronicle_id))
with check (public.is_chronicle_master(chronicle_id));
drop policy if exists "Masters can delete entity links" on public.chronicle_entity_links;
create policy "Masters can delete entity links" on public.chronicle_entity_links
for delete to authenticated using (public.is_chronicle_master(chronicle_id));

drop policy if exists "Masters can read action log" on public.master_action_log;
create policy "Masters can read action log" on public.master_action_log
for select to authenticated using (public.is_chronicle_master(chronicle_id));
drop policy if exists "Masters can append action log" on public.master_action_log;
create policy "Masters can append action log" on public.master_action_log
for insert to authenticated
with check (
  public.is_chronicle_master(chronicle_id)
  and created_by = auth.uid()
  and reverted_at is null
);

alter table public.chronicle_sessions replica identity full;
alter table public.master_layouts replica identity full;
alter table public.master_macros replica identity full;
alter table public.chronicle_entity_links replica identity full;
alter table public.master_action_log replica identity full;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'chronicle_sessions',
    'master_layouts',
    'master_macros',
    'chronicle_entity_links',
    'master_action_log'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
