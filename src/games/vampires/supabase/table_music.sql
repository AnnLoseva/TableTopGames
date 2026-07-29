create table if not exists public.table_music (
  room text primary key,
  url text not null default '',
  active_uri text,
  is_playing boolean not null default false,
  position_seconds numeric not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.table_music
  add column if not exists provider text default 'none',
  add column if not exists playlist_id text,
  add column if not exists playlist_index integer,
  add column if not exists track_id text,
  add column if not exists source_type text;

alter table public.table_music enable row level security;

drop policy if exists "Anyone can read table music" on public.table_music;
create policy "Anyone can read table music"
  on public.table_music
  for select
  using (true);

drop policy if exists "Anyone can create table music" on public.table_music;
create policy "Anyone can create table music"
  on public.table_music
  for insert
  with check (true);

drop policy if exists "Anyone can update table music" on public.table_music;
create policy "Anyone can update table music"
  on public.table_music
  for update
  using (true)
  with check (true);

alter table public.table_music replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'table_music'
  ) then
    alter publication supabase_realtime add table public.table_music;
  end if;
end $$;

create table if not exists public.table_music_library (
  id text primary key,
  room text not null,
  item_type text not null default 'track' check (item_type in ('track', 'folder')),
  parent_id text null,
  name text not null,
  url text not null default '',
  autoplay boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists table_music_library_room_created_at_idx
  on public.table_music_library (room, created_at asc);

alter table public.table_music_library enable row level security;

drop policy if exists "Anyone can read table music library" on public.table_music_library;
create policy "Anyone can read table music library"
  on public.table_music_library
  for select
  using (true);

drop policy if exists "Anyone can create table music library" on public.table_music_library;
create policy "Anyone can create table music library"
  on public.table_music_library
  for insert
  with check (true);

drop policy if exists "Anyone can update table music library" on public.table_music_library;
create policy "Anyone can update table music library"
  on public.table_music_library
  for update
  using (true)
  with check (true);

drop policy if exists "Anyone can delete table music library" on public.table_music_library;
create policy "Anyone can delete table music library"
  on public.table_music_library
  for delete
  using (true);

alter table public.table_music_library replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'table_music_library'
  ) then
    alter publication supabase_realtime add table public.table_music_library;
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'table-music',
  'table-music',
  true,
  null,
  array['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac', 'audio/mp4', 'audio/webm', 'audio/x-m4a']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can read table music files" on storage.objects;
create policy "Anyone can read table music files"
  on storage.objects
  for select
  using (bucket_id = 'table-music');

drop policy if exists "Anyone can upload table music files" on storage.objects;
create policy "Anyone can upload table music files"
  on storage.objects
  for insert
  with check (bucket_id = 'table-music');

drop policy if exists "Anyone can update table music files" on storage.objects;
create policy "Anyone can update table music files"
  on storage.objects
  for update
  using (bucket_id = 'table-music')
  with check (bucket_id = 'table-music');

drop policy if exists "Anyone can delete table music files" on storage.objects;
create policy "Anyone can delete table music files"
  on storage.objects
  for delete
  using (bucket_id = 'table-music');
