-- Public, read-only delivery buckets for generated tabletop rule catalogs.
-- Git-tracked JSON remains the source of truth and local fallback.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'rules-pathfinder2',
    'rules-pathfinder2',
    true,
    10485760,
    array['application/json']::text[]
  ),
  (
    'rules-vampires',
    'rules-vampires',
    true,
    10485760,
    array['application/json']::text[]
  )
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read rule catalogs" on storage.objects;

create policy "Public can read rule catalogs"
  on storage.objects
  for select
  to public
  using (bucket_id in ('rules-pathfinder2', 'rules-vampires'));

-- Intentionally no INSERT/UPDATE/DELETE policy. Publishing uses a server-side
-- service-role key; browsers can only read these public rule catalogs.
