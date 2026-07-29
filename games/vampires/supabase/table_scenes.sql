create table if not exists public.table_scenes (
  id text primary key,
  room text not null,
  name text not null,
  thumbnail_url text not null default '',
  is_active boolean not null default false,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists table_scenes_room_created_at_idx
  on public.table_scenes (room, created_at asc);

create unique index if not exists table_scenes_one_active_per_room_idx
  on public.table_scenes (room)
  where is_active;

alter table public.table_scenes enable row level security;

drop policy if exists "Anyone can read table scenes" on public.table_scenes;
create policy "Anyone can read table scenes"
  on public.table_scenes
  for select
  using (true);

drop policy if exists "Anyone can create table scenes" on public.table_scenes;
create policy "Anyone can create table scenes"
  on public.table_scenes
  for insert
  with check (true);

drop policy if exists "Anyone can update table scenes" on public.table_scenes;
create policy "Anyone can update table scenes"
  on public.table_scenes
  for update
  using (true)
  with check (true);

drop policy if exists "Anyone can delete table scenes" on public.table_scenes;
create policy "Anyone can delete table scenes"
  on public.table_scenes
  for delete
  using (true);

alter table public.table_scenes replica identity full;

alter table public.table_images
  add column if not exists scene_id text,
  add column if not exists crop_x numeric null,
  add column if not exists crop_y numeric null,
  add column if not exists crop_width numeric null,
  add column if not exists crop_height numeric null;

create index if not exists table_images_room_scene_z_idx
  on public.table_images (room, scene_id, z_index asc);

insert into public.table_scenes (id, room, name, is_active, created_by, created_at, updated_at)
select
  'default-' || regexp_replace(room, '[^a-zA-Z0-9_-]+', '-', 'g') as id,
  room,
  'Основная сцена',
  true,
  'migration',
  now(),
  now()
from (
  select distinct room
  from public.table_images
  where scene_id is null
) rooms
where not exists (
  select 1
  from public.table_scenes scenes
  where scenes.room = rooms.room
);

update public.table_images images
set scene_id = scenes.id
from public.table_scenes scenes
where images.room = scenes.room
  and images.scene_id is null
  and scenes.is_active = true;

create table if not exists public.table_scene_music (
  id text primary key,
  room text not null,
  scene_id text not null references public.table_scenes(id) on delete cascade,
  title text not null,
  url text not null,
  source_type text not null default 'youtube',
  order_index integer not null default 0,
  is_default boolean not null default false,
  autoplay boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists table_scene_music_room_scene_order_idx
  on public.table_scene_music (room, scene_id, order_index asc);

create unique index if not exists table_scene_music_one_default_per_scene_idx
  on public.table_scene_music (scene_id)
  where is_default;

alter table public.table_scene_music enable row level security;

drop policy if exists "Anyone can read scene music" on public.table_scene_music;
create policy "Anyone can read scene music"
  on public.table_scene_music
  for select
  using (true);

drop policy if exists "Anyone can create scene music" on public.table_scene_music;
create policy "Anyone can create scene music"
  on public.table_scene_music
  for insert
  with check (true);

drop policy if exists "Anyone can update scene music" on public.table_scene_music;
create policy "Anyone can update scene music"
  on public.table_scene_music
  for update
  using (true)
  with check (true);

drop policy if exists "Anyone can delete scene music" on public.table_scene_music;
create policy "Anyone can delete scene music"
  on public.table_scene_music
  for delete
  using (true);

alter table public.table_scene_music replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'table_scenes'
  ) then
    alter publication supabase_realtime add table public.table_scenes;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'table_scene_music'
  ) then
    alter publication supabase_realtime add table public.table_scene_music;
  end if;
end $$;
