-- Character portraits bucket: portraits and touchstone images are stored in
-- Storage as files; characters.data keeps only the public URL (previously the
-- whole base64 image was embedded in the JSON, bloating every character row).
-- Applied to the live project on 2026-07-07 (migration character_portraits_bucket).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('character-portraits', 'character-portraits', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "VTM public read character portraits" on storage.objects;
create policy "VTM public read character portraits"
  on storage.objects for select to public
  using (bucket_id = 'character-portraits');

drop policy if exists "VTM public upload character portraits" on storage.objects;
create policy "VTM public upload character portraits"
  on storage.objects for insert to public
  with check (bucket_id = 'character-portraits');

drop policy if exists "VTM public update character portraits" on storage.objects;
create policy "VTM public update character portraits"
  on storage.objects for update to public
  using (bucket_id = 'character-portraits')
  with check (bucket_id = 'character-portraits');

drop policy if exists "VTM public delete character portraits" on storage.objects;
create policy "VTM public delete character portraits"
  on storage.objects for delete to public
  using (bucket_id = 'character-portraits');
