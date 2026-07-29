-- Run this in Supabase SQL Editor when media or music uploads fail with
-- Storage/RLS permission errors. The app intentionally uses public room links,
-- so these policies allow anonymous and authenticated table users to manage
-- table media in the app buckets.

create schema if not exists storage;

grant usage on schema public to anon, authenticated;
grant usage on schema storage to anon, authenticated;

grant select, insert, update, delete on public.table_images to anon, authenticated;
grant select, insert, update, delete on public.table_music to anon, authenticated;
grant select, insert, update, delete on public.table_music_library to anon, authenticated;
grant select, insert, update, delete on public.table_scenes to anon, authenticated;
grant select, insert, update, delete on public.table_scene_music to anon, authenticated;
grant select, insert, update, delete on public.table_rolls to anon, authenticated;
grant select, insert on public.table_chat_messages to anon, authenticated;

grant select, insert, update, delete on storage.objects to anon, authenticated;
grant select on storage.buckets to anon, authenticated;

alter table public.table_images enable row level security;
alter table public.table_music enable row level security;
alter table public.table_music_library enable row level security;
alter table public.table_scenes enable row level security;
alter table public.table_scene_music enable row level security;
alter table public.table_rolls enable row level security;
alter table public.table_chat_messages enable row level security;

alter table public.table_images
  add column if not exists scene_id text,
  add column if not exists layer_type text not null default 'image',
  add column if not exists owner_role text not null default 'player',
  add column if not exists owner_id text null,
  add column if not exists parent_id text null,
  add column if not exists on_table boolean not null default true;

alter table public.table_images
  drop constraint if exists table_images_layer_type_check;

alter table public.table_images
  add constraint table_images_layer_type_check
  check (layer_type in ('image', 'video', 'folder', 'text', 'file'));

alter table public.table_images
  drop constraint if exists table_images_owner_role_check;

alter table public.table_images
  add constraint table_images_owner_role_check
  check (owner_role in ('master', 'player'));

create table if not exists public.table_music_library (
  id text primary key,
  room text not null,
  item_type text not null default 'track' check (item_type in ('track', 'folder')),
  parent_id text null,
  name text not null,
  url text not null default '',
  created_at timestamptz not null default now()
);

alter table public.table_music_library enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('table-images', 'table-images', true, null, null),
  (
    'table-music',
    'table-music',
    true,
    null,
    array[
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'audio/aac',
      'audio/flac',
      'audio/mp4',
      'audio/webm',
      'audio/x-m4a'
    ]
  )
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "VTM public read table media buckets" on storage.objects;
create policy "VTM public read table media buckets"
  on storage.objects
  for select
  to public
  using (bucket_id in ('table-images', 'table-music'));

drop policy if exists "VTM public upload table media buckets" on storage.objects;
create policy "VTM public upload table media buckets"
  on storage.objects
  for insert
  to public
  with check (bucket_id in ('table-images', 'table-music'));

drop policy if exists "VTM public update table media buckets" on storage.objects;
create policy "VTM public update table media buckets"
  on storage.objects
  for update
  to public
  using (bucket_id in ('table-images', 'table-music'))
  with check (bucket_id in ('table-images', 'table-music'));

drop policy if exists "VTM public delete table media buckets" on storage.objects;
create policy "VTM public delete table media buckets"
  on storage.objects
  for delete
  to public
  using (bucket_id in ('table-images', 'table-music'));

drop policy if exists "VTM public read table images" on public.table_images;
create policy "VTM public read table images"
  on public.table_images
  for select
  to public
  using (true);

drop policy if exists "VTM public create table images" on public.table_images;
create policy "VTM public create table images"
  on public.table_images
  for insert
  to public
  with check (true);

drop policy if exists "VTM public update table images" on public.table_images;
create policy "VTM public update table images"
  on public.table_images
  for update
  to public
  using (true)
  with check (true);

drop policy if exists "VTM public delete table images" on public.table_images;
create policy "VTM public delete table images"
  on public.table_images
  for delete
  to public
  using (true);

drop policy if exists "VTM public manage music library" on public.table_music_library;
create policy "VTM public manage music library"
  on public.table_music_library
  for all
  to public
  using (true)
  with check (true);

drop policy if exists "VTM public manage scene music" on public.table_scene_music;
create policy "VTM public manage scene music"
  on public.table_scene_music
  for all
  to public
  using (true)
  with check (true);

drop policy if exists "VTM public manage table music" on public.table_music;
create policy "VTM public manage table music"
  on public.table_music
  for all
  to public
  using (true)
  with check (true);
