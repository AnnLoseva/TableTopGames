-- Unified PC / NPC / SPC actor domain.
-- Depends on src/games/vampires/supabase/master_console_persistence.sql.

create table if not exists public.chronicle_actors (
  id uuid primary key default gen_random_uuid(),
  chronicle_id uuid not null references public.chronicles(id) on delete cascade,
  room text not null,
  kind text not null,
  character_id uuid references public.characters(id) on delete set null,
  name text not null,
  faction text not null default '',
  actor_role text not null default '',
  status text not null default 'active',
  tags text[] not null default '{}'::text[],
  current_scene_id text references public.table_scenes(id) on delete set null,
  compact_stats jsonb not null default '{}'::jsonb,
  image_url text not null default '',
  manual_overrides jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chronicle_actors_kind_check check (kind in (
    'player_character',
    'full_npc',
    'compact_spc',
    'ghoul',
    'mortal',
    'thin_blood',
    'custom'
  )),
  constraint chronicle_actors_name_check check (length(trim(name)) between 1 and 160),
  constraint chronicle_actors_status_check check (status in ('active', 'inactive', 'missing', 'dead', 'archived')),
  constraint chronicle_actors_tags_check check (cardinality(tags) <= 32),
  constraint chronicle_actors_compact_stats_check check (jsonb_typeof(compact_stats) = 'object'),
  constraint chronicle_actors_manual_overrides_check check (jsonb_typeof(manual_overrides) = 'object')
);

create table if not exists public.chronicle_actor_private (
  actor_id uuid primary key references public.chronicle_actors(id) on delete cascade,
  chronicle_id uuid not null references public.chronicles(id) on delete cascade,
  room text not null,
  secrets text not null default '',
  motivation text not null default '',
  plans text not null default '',
  notes text not null default '',
  private_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chronicle_actor_private_data_check check (jsonb_typeof(private_data) = 'object')
);

create unique index if not exists chronicle_actors_linked_character_unique_idx
  on public.chronicle_actors (chronicle_id, character_id)
  where character_id is not null;
create index if not exists chronicle_actors_room_status_name_idx
  on public.chronicle_actors (room, status, name);
create index if not exists chronicle_actors_room_scene_idx
  on public.chronicle_actors (room, current_scene_id);
create index if not exists chronicle_actor_private_room_idx
  on public.chronicle_actor_private (room, actor_id);

create or replace function public.enforce_chronicle_actor_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_room text;
  scene_room text;
begin
  select chronicles.room into expected_room
  from public.chronicles
  where chronicles.id = new.chronicle_id;

  if expected_room is null or new.room <> expected_room then
    raise exception 'room does not match chronicle_id';
  end if;

  -- Nested IF is required: this trigger also runs on chronicle_actor_private,
  -- whose NEW record has no current_scene_id field, and referencing a missing
  -- record field inside a combined AND expression raises 42703 (surfaces as
  -- HTTP 400 from PostgREST).
  if tg_table_name = 'chronicle_actors' then
    if new.current_scene_id is not null then
      select scenes.room into scene_room
      from public.table_scenes scenes
      where scenes.id = new.current_scene_id;
      if scene_room is null or scene_room <> new.room then
        raise exception 'current_scene_id does not belong to actor room';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_chronicle_actor_scope() from public;

create or replace function public.enforce_actor_private_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  parent_chronicle_id uuid;
  parent_room text;
begin
  select actors.chronicle_id, actors.room
  into parent_chronicle_id, parent_room
  from public.chronicle_actors actors
  where actors.id = new.actor_id;

  if parent_chronicle_id is null
    or parent_chronicle_id <> new.chronicle_id
    or parent_room <> new.room then
    raise exception 'private actor fields do not match actor scope';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_actor_private_parent() from public;

drop trigger if exists chronicle_actors_scope_guard on public.chronicle_actors;
create trigger chronicle_actors_scope_guard
before insert or update on public.chronicle_actors
for each row execute function public.enforce_chronicle_actor_scope();

drop trigger if exists chronicle_actor_private_scope_guard on public.chronicle_actor_private;
create trigger chronicle_actor_private_scope_guard
before insert or update on public.chronicle_actor_private
for each row execute function public.enforce_chronicle_actor_scope();

drop trigger if exists chronicle_actor_private_parent_guard on public.chronicle_actor_private;
create trigger chronicle_actor_private_parent_guard
before insert or update on public.chronicle_actor_private
for each row execute function public.enforce_actor_private_parent();

create or replace function public.bulk_update_chronicle_actors(
  p_room text,
  p_actor_ids uuid[],
  p_patch jsonb
)
returns setof public.chronicle_actors
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_chronicle_id uuid;
  allowed_keys constant text[] := array[
    'faction',
    'actor_role',
    'status',
    'tags',
    'current_scene_id',
    'compact_stats',
    'image_url',
    'manual_overrides'
  ];
begin
  if jsonb_typeof(p_patch) <> 'object' then
    raise exception 'actor patch must be a JSON object';
  end if;
  if coalesce(array_length(p_actor_ids, 1), 0) = 0 or array_length(p_actor_ids, 1) > 100 then
    raise exception 'actor_ids must contain between 1 and 100 ids';
  end if;
  if exists (
    select 1
    from jsonb_object_keys(p_patch) as patch_key(key)
    where not (key = any(allowed_keys))
  ) then
    raise exception 'actor patch contains unsupported fields';
  end if;
  if p_patch ? 'tags' and jsonb_typeof(p_patch->'tags') <> 'array' then
    raise exception 'tags must be an array';
  end if;
  if p_patch ? 'compact_stats' and jsonb_typeof(p_patch->'compact_stats') <> 'object' then
    raise exception 'compact_stats must be an object';
  end if;
  if p_patch ? 'manual_overrides' and jsonb_typeof(p_patch->'manual_overrides') <> 'object' then
    raise exception 'manual_overrides must be an object';
  end if;
  if p_patch ? 'status' and jsonb_typeof(p_patch->'status') <> 'string' then
    raise exception 'status must be a string';
  end if;

  select chronicles.id into target_chronicle_id
  from public.chronicles
  where chronicles.room = p_room;

  if target_chronicle_id is null or not public.is_chronicle_master(target_chronicle_id) then
    raise exception 'master membership required';
  end if;

  return query
  update public.chronicle_actors actors
  set
    faction = case when p_patch ? 'faction' then p_patch->>'faction' else actors.faction end,
    actor_role = case when p_patch ? 'actor_role' then p_patch->>'actor_role' else actors.actor_role end,
    status = case when p_patch ? 'status' then p_patch->>'status' else actors.status end,
    tags = case when p_patch ? 'tags'
      then array(select jsonb_array_elements_text(p_patch->'tags')) else actors.tags end,
    current_scene_id = case when p_patch ? 'current_scene_id'
      then nullif(p_patch->>'current_scene_id', '') else actors.current_scene_id end,
    compact_stats = case when p_patch ? 'compact_stats' then p_patch->'compact_stats' else actors.compact_stats end,
    image_url = case when p_patch ? 'image_url' then p_patch->>'image_url' else actors.image_url end,
    manual_overrides = case when p_patch ? 'manual_overrides' then p_patch->'manual_overrides' else actors.manual_overrides end,
    updated_at = now()
  where actors.room = p_room
    and actors.chronicle_id = target_chronicle_id
    and actors.id = any(p_actor_ids)
  returning actors.*;
end;
$$;

revoke all on function public.bulk_update_chronicle_actors(text, uuid[], jsonb) from public;
grant execute on function public.bulk_update_chronicle_actors(text, uuid[], jsonb) to authenticated;

alter table public.chronicle_actors enable row level security;
alter table public.chronicle_actor_private enable row level security;

revoke all on public.chronicle_actors from anon;
revoke all on public.chronicle_actor_private from anon;
grant select, insert, update, delete on public.chronicle_actors to authenticated;
grant select, insert, update, delete on public.chronicle_actor_private to authenticated;

drop policy if exists "Masters can read chronicle actors" on public.chronicle_actors;
create policy "Masters can read chronicle actors" on public.chronicle_actors
for select to authenticated using (public.is_chronicle_master(chronicle_id));
drop policy if exists "Masters can insert chronicle actors" on public.chronicle_actors;
create policy "Masters can insert chronicle actors" on public.chronicle_actors
for insert to authenticated
with check (public.is_chronicle_master(chronicle_id) and created_by = auth.uid());
drop policy if exists "Masters can update chronicle actors" on public.chronicle_actors;
create policy "Masters can update chronicle actors" on public.chronicle_actors
for update to authenticated
using (public.is_chronicle_master(chronicle_id))
with check (public.is_chronicle_master(chronicle_id));
drop policy if exists "Masters can delete chronicle actors" on public.chronicle_actors;
create policy "Masters can delete chronicle actors" on public.chronicle_actors
for delete to authenticated using (public.is_chronicle_master(chronicle_id));

drop policy if exists "Masters can read private actor fields" on public.chronicle_actor_private;
create policy "Masters can read private actor fields" on public.chronicle_actor_private
for select to authenticated using (public.is_chronicle_master(chronicle_id));
drop policy if exists "Masters can insert private actor fields" on public.chronicle_actor_private;
create policy "Masters can insert private actor fields" on public.chronicle_actor_private
for insert to authenticated with check (public.is_chronicle_master(chronicle_id));
drop policy if exists "Masters can update private actor fields" on public.chronicle_actor_private;
create policy "Masters can update private actor fields" on public.chronicle_actor_private
for update to authenticated
using (public.is_chronicle_master(chronicle_id))
with check (public.is_chronicle_master(chronicle_id));
drop policy if exists "Masters can delete private actor fields" on public.chronicle_actor_private;
create policy "Masters can delete private actor fields" on public.chronicle_actor_private
for delete to authenticated using (public.is_chronicle_master(chronicle_id));

alter table public.chronicle_actors replica identity full;
alter table public.chronicle_actor_private replica identity full;

do $$
declare
  table_name text;
begin
  foreach table_name in array array['chronicle_actors', 'chronicle_actor_private'] loop
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
