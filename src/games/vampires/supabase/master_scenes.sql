-- Master scene draft metadata, interactives and light presets.
-- Does NOT replace table_scenes / table_images. Published scene remains is_active.
-- Depends on src/games/vampires/supabase/master_console_persistence.sql.

create table if not exists public.master_scene_meta (
  scene_id text primary key references public.table_scenes(id) on delete cascade,
  chronicle_id uuid not null references public.chronicles(id) on delete cascade,
  room text not null,
  sort_order integer not null default 0,
  archived boolean not null default false,
  encounter_marker text not null default '',
  draft_light_preset text not null default '',
  published_light_preset text not null default '',
  status text not null default 'draft',
  notes text not null default '',
  updated_at timestamptz not null default now(),
  constraint master_scene_meta_status_check
    check (status in ('draft', 'ready', 'published', 'archived'))
);

create index if not exists master_scene_meta_room_sort_idx
  on public.master_scene_meta (room, sort_order, archived);

create table if not exists public.master_scene_objects (
  id uuid primary key default gen_random_uuid(),
  chronicle_id uuid not null references public.chronicles(id) on delete cascade,
  room text not null,
  scene_id text not null references public.table_scenes(id) on delete cascade,
  object_type text not null,
  name text not null,
  layer_id text null,
  x double precision not null default 0,
  y double precision not null default 0,
  public_state jsonb not null default '{}'::jsonb,
  private_config jsonb not null default '{}'::jsonb,
  revealed boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint master_scene_objects_type_check check (object_type in (
    'door', 'light', 'trap', 'hotspot', 'sound_trigger', 'note', 'custom'
  )),
  constraint master_scene_objects_name_check check (length(trim(name)) between 1 and 160),
  constraint master_scene_objects_public_json check (jsonb_typeof(public_state) = 'object'),
  constraint master_scene_objects_private_json check (jsonb_typeof(private_config) = 'object')
);

create index if not exists master_scene_objects_scene_idx
  on public.master_scene_objects (room, scene_id, sort_order);

-- Player-safe projection of revealed interactives (no private_config).
create table if not exists public.master_scene_objects_public (
  id uuid primary key,
  room text not null,
  scene_id text not null,
  object_type text not null,
  name text not null,
  public_state jsonb not null default '{}'::jsonb,
  x double precision not null default 0,
  y double precision not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists master_scene_objects_public_room_scene_idx
  on public.master_scene_objects_public (room, scene_id);

create or replace function public.enforce_master_scene_scope()
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
  if tg_table_name in ('master_scene_meta', 'master_scene_objects') then
    select scenes.room into scene_room from public.table_scenes scenes where scenes.id = new.scene_id;
    if scene_room is null or scene_room <> new.room then
      raise exception 'scene_id does not belong to room';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_master_scene_scope() from public;

drop trigger if exists master_scene_meta_scope_guard on public.master_scene_meta;
create trigger master_scene_meta_scope_guard
before insert or update on public.master_scene_meta
for each row execute function public.enforce_master_scene_scope();

drop trigger if exists master_scene_objects_scope_guard on public.master_scene_objects;
create trigger master_scene_objects_scope_guard
before insert or update on public.master_scene_objects
for each row execute function public.enforce_master_scene_scope();

alter table public.master_scene_meta enable row level security;
alter table public.master_scene_objects enable row level security;
alter table public.master_scene_objects_public enable row level security;

revoke all on public.master_scene_meta from anon;
revoke all on public.master_scene_objects from anon;
-- public projection: readable by anyone in room pattern (matches table_scenes openness for MVP)
grant select on public.master_scene_objects_public to anon, authenticated;
grant select, insert, update, delete on public.master_scene_meta to authenticated;
grant select, insert, update, delete on public.master_scene_objects to authenticated;
grant insert, update, delete on public.master_scene_objects_public to authenticated;

drop policy if exists "Masters manage scene meta" on public.master_scene_meta;
create policy "Masters manage scene meta" on public.master_scene_meta
for all to authenticated
using (public.is_chronicle_master(chronicle_id))
with check (public.is_chronicle_master(chronicle_id));

drop policy if exists "Masters manage scene objects" on public.master_scene_objects;
create policy "Masters manage scene objects" on public.master_scene_objects
for all to authenticated
using (public.is_chronicle_master(chronicle_id))
with check (public.is_chronicle_master(chronicle_id));

drop policy if exists "Anyone can read public scene objects" on public.master_scene_objects_public;
create policy "Anyone can read public scene objects" on public.master_scene_objects_public
for select using (true);

drop policy if exists "Masters write public scene objects" on public.master_scene_objects_public;
create policy "Masters write public scene objects" on public.master_scene_objects_public
for all to authenticated
using (true)
with check (true);
