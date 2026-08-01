-- Scene folders ("sessions"): group table_scenes rows so a chronicle can keep
-- a separate set of scenes per session. Does not replace table_scenes; a
-- scene with folder_id = null is ungrouped.
create table if not exists public.table_scene_folders (
  id text primary key,
  room text not null,
  name text not null,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists table_scene_folders_room_order_idx
  on public.table_scene_folders (room, order_index asc);

alter table public.table_scene_folders enable row level security;

grant select, insert, update, delete on table public.table_scene_folders
  to anon, authenticated, service_role;

drop policy if exists "Anyone can read scene folders" on public.table_scene_folders;
create policy "Anyone can read scene folders"
  on public.table_scene_folders
  for select
  using (true);

drop policy if exists "Anyone can create scene folders" on public.table_scene_folders;
create policy "Anyone can create scene folders"
  on public.table_scene_folders
  for insert
  with check (true);

drop policy if exists "Anyone can update scene folders" on public.table_scene_folders;
create policy "Anyone can update scene folders"
  on public.table_scene_folders
  for update
  using (true)
  with check (true);

drop policy if exists "Anyone can delete scene folders" on public.table_scene_folders;
create policy "Anyone can delete scene folders"
  on public.table_scene_folders
  for delete
  using (true);

alter table public.table_scene_folders replica identity full;

alter table public.table_scenes
  add column if not exists folder_id text references public.table_scene_folders(id) on delete set null;

create index if not exists table_scenes_folder_idx
  on public.table_scenes (folder_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'table_scene_folders'
  ) then
    alter publication supabase_realtime add table public.table_scene_folders;
  end if;
end $$;
