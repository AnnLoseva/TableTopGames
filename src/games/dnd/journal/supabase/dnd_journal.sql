-- Applied to the live Supabase project (klhxbaagarqxaqnrvurr) 2026-07-31.
--
-- Public-read, owner-or-device-write D&D journal: pages + page images,
-- synced between the RenaCompanion iPad app (Support/JournalSyncService.swift)
-- and TableTopGames' /dnd/journal page. See docs/ai/DECISIONS.md (2026-07-31
-- entries) for the reasoning.
--
-- Source shapes mirrored (pages, images, and nested folders; structured
-- entryType/structuredFields remain local to the iPad app):
--   "DnD Interactive Sheet/DnD Interactive Sheet/Models/GameState/JournalPage.swift"
--   "DnD Interactive Sheet/DnD Interactive Sheet/Models/GameState/JournalImage.swift"
--   "DnD Interactive Sheet/DnD Interactive Sheet/Models/GameState/JournalFolder.swift"
--
-- Access model: this is a single-editor journal, public to read (no login
-- required — anyone with the link can read it, like a public campaign blog).
-- Two Supabase Auth identities may write:
--   - the owner account ("Anna" in `public.users`; auth_user_id
--     44153f98-aaf2-4935-b7b2-45fe3155edc6) — the human, via the site's UI.
--   - a dedicated device service account ("RenaCompanionDevice" in
--     `public.users`; auth_user_id 0b0db998-4d46-4957-9221-5663ba7a7b73) —
--     the RenaCompanion iPad app's background sync, so it never has to embed
--     the owner's real password in a shipped binary. Its grant is scoped to
--     exactly this journal.
-- Both ids were looked up directly (queried after creation), never guessed.
-- The TS client mirrors the owner id as DND_JOURNAL_OWNER_AUTH_USER_ID to
-- hide edit controls in the site's UI for everyone else; RLS below is the
-- actual enforcement for both identities.
--
-- Sync model:
-- - Rows are identified by the *client-generated* uuid already produced by
--   `JournalPage.uuid` / `JournalImage.uuid` (and by the TS client below), so
--   the same row id is meaningful on both the iPad app and the site.
-- - Soft delete only (`deleted_at`); no hard DELETE policy is granted. Two
--   offline-first writers can otherwise race a hard delete against a stale
--   update and resurrect a row the other side removed. `deleted_at` is just
--   another column, so last-write-wins (by `updated_at`) resolves it the same
--   way it resolves every other field. (In practice, the iPad app's sync only
--   creates/updates page rows as of 2026-07-31. Folder tombstones are
--   propagated explicitly so an offline device cannot resurrect a folder.)

create table if not exists public.dnd_journal_pages (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  body_markdown text not null default '',
  type text not null default 'note',
  aliases text[] not null default '{}',
  is_favorite boolean not null default false,
  is_pinned boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint dnd_journal_pages_title_check check (length(title) <= 200),
  constraint dnd_journal_pages_body_check check (length(body_markdown) <= 200000),
  constraint dnd_journal_pages_type_check check (type in (
    'note', 'session', 'character', 'location', 'organization', 'event',
    'chronology', 'quest', 'plotHook', 'item', 'document', 'image', 'main', 'bestiary'
  ))
);

create index if not exists dnd_journal_pages_owner_idx
  on public.dnd_journal_pages (user_id, deleted_at, updated_at desc);

create table if not exists public.dnd_journal_folders (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  section_id text not null,
  parent_folder_id uuid references public.dnd_journal_folders(id) on delete set null,
  name text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint dnd_journal_folders_name_check check (length(trim(name)) between 1 and 200),
  constraint dnd_journal_folders_section_check check (section_id in (
    'main', 'session', 'character', 'location', 'organization', 'chronology',
    'quest', 'item', 'template', 'images', 'bestiary'
  )),
  constraint dnd_journal_folders_not_own_parent check (parent_folder_id is distinct from id)
);

create index if not exists dnd_journal_folders_tree_idx
  on public.dnd_journal_folders (section_id, parent_folder_id, deleted_at, sort_order, name);

create index if not exists dnd_journal_folders_parent_idx
  on public.dnd_journal_folders (parent_folder_id);

create index if not exists dnd_journal_folders_user_idx
  on public.dnd_journal_folders (user_id);

alter table public.dnd_journal_pages
  add column if not exists folder_id uuid references public.dnd_journal_folders(id) on delete set null,
  add column if not exists sort_order integer not null default 0;

create index if not exists dnd_journal_pages_folder_idx
  on public.dnd_journal_pages (folder_id, is_archived, sort_order, updated_at desc);

create table if not exists public.dnd_journal_images (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  page_id uuid references public.dnd_journal_pages(id) on delete set null,
  name text not null default '',
  storage_path text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint dnd_journal_images_name_check check (length(name) <= 200),
  unique (storage_path)
);

create index if not exists dnd_journal_images_owner_page_idx
  on public.dnd_journal_images (user_id, page_id, deleted_at);

create index if not exists dnd_journal_images_page_idx
  on public.dnd_journal_images (page_id);

alter table public.dnd_journal_pages enable row level security;
alter table public.dnd_journal_images enable row level security;
alter table public.dnd_journal_folders enable row level security;

-- Explicit grants keep this table reachable through the Data API even on
-- Supabase projects where newly-created public tables are no longer exposed
-- automatically. RLS below still decides which rows each caller can access.
grant select on public.dnd_journal_pages, public.dnd_journal_images, public.dnd_journal_folders to anon;
grant select, insert, update on public.dnd_journal_pages, public.dnd_journal_images, public.dnd_journal_folders to authenticated;

-- The owner/device carve-out below is required, not cosmetic: Postgres requires an
-- UPDATE's resulting row to also satisfy an applicable SELECT policy. A plain
-- "deleted_at is null" here made every soft-delete (UPDATE ... SET deleted_at = now())
-- fail RLS, since the row stops matching its own read policy the moment it's deleted.
drop policy if exists "Owners can read their journal pages" on public.dnd_journal_pages;
drop policy if exists "Any signed-in account can read journal pages" on public.dnd_journal_pages;
drop policy if exists "Anyone can read journal pages" on public.dnd_journal_pages;
create policy "Anyone can read journal pages"
  on public.dnd_journal_pages for select
  to public
  using (
    deleted_at is null
    or (select auth.uid()) in (
      '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid,
      '0b0db998-4d46-4957-9221-5663ba7a7b73'::uuid
    )
  );

drop policy if exists "Owners can insert their journal pages" on public.dnd_journal_pages;
drop policy if exists "Only the owner account can insert journal pages" on public.dnd_journal_pages;
create policy "Only the owner account can insert journal pages"
  on public.dnd_journal_pages for insert
  to authenticated
  with check ((select auth.uid()) in (
    '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid,
    '0b0db998-4d46-4957-9221-5663ba7a7b73'::uuid
  ));

drop policy if exists "Owners can update their journal pages" on public.dnd_journal_pages;
drop policy if exists "Only the owner account can update journal pages" on public.dnd_journal_pages;
create policy "Only the owner account can update journal pages"
  on public.dnd_journal_pages for update
  to authenticated
  using ((select auth.uid()) in (
    '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid,
    '0b0db998-4d46-4957-9221-5663ba7a7b73'::uuid
  ))
  with check ((select auth.uid()) in (
    '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid,
    '0b0db998-4d46-4957-9221-5663ba7a7b73'::uuid
  ));

-- No delete policy: pages are soft-deleted via UPDATE (deleted_at), see above.

drop policy if exists "Anyone can read journal folders" on public.dnd_journal_folders;
create policy "Anyone can read journal folders"
  on public.dnd_journal_folders for select
  to public
  using (
    deleted_at is null
    or (select auth.uid()) in (
      '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid,
      '0b0db998-4d46-4957-9221-5663ba7a7b73'::uuid
    )
  );

drop policy if exists "Only the owner account can insert journal folders" on public.dnd_journal_folders;
create policy "Only the owner account can insert journal folders"
  on public.dnd_journal_folders for insert
  to authenticated
  with check ((select auth.uid()) in (
    '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid,
    '0b0db998-4d46-4957-9221-5663ba7a7b73'::uuid
  ));

drop policy if exists "Only the owner account can update journal folders" on public.dnd_journal_folders;
create policy "Only the owner account can update journal folders"
  on public.dnd_journal_folders for update
  to authenticated
  using ((select auth.uid()) in (
    '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid,
    '0b0db998-4d46-4957-9221-5663ba7a7b73'::uuid
  ))
  with check ((select auth.uid()) in (
    '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid,
    '0b0db998-4d46-4957-9221-5663ba7a7b73'::uuid
  ));

-- No delete policy: folders use a tombstone so the offline iPad writer can
-- observe deletions instead of re-creating the folder on its next sync.

-- Same owner/device carve-out as pages above, same reason: an UPDATE that sets
-- deleted_at must still satisfy the SELECT policy on the resulting row.
drop policy if exists "Owners can read their journal images" on public.dnd_journal_images;
drop policy if exists "Any signed-in account can read journal images" on public.dnd_journal_images;
drop policy if exists "Anyone can read journal images" on public.dnd_journal_images;
create policy "Anyone can read journal images"
  on public.dnd_journal_images for select
  to public
  using (
    deleted_at is null
    or (select auth.uid()) in (
      '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid,
      '0b0db998-4d46-4957-9221-5663ba7a7b73'::uuid
    )
  );

drop policy if exists "Owners can insert their journal images" on public.dnd_journal_images;
drop policy if exists "Only the owner account can insert journal images" on public.dnd_journal_images;
create policy "Only the owner account can insert journal images"
  on public.dnd_journal_images for insert
  to authenticated
  with check ((select auth.uid()) in (
    '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid,
    '0b0db998-4d46-4957-9221-5663ba7a7b73'::uuid
  ));

drop policy if exists "Owners can update their journal images" on public.dnd_journal_images;
drop policy if exists "Only the owner account can update journal images" on public.dnd_journal_images;
create policy "Only the owner account can update journal images"
  on public.dnd_journal_images for update
  to authenticated
  using ((select auth.uid()) in (
    '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid,
    '0b0db998-4d46-4957-9221-5663ba7a7b73'::uuid
  ))
  with check ((select auth.uid()) in (
    '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid,
    '0b0db998-4d46-4957-9221-5663ba7a7b73'::uuid
  ));

-- Storage: PUBLIC bucket (like `character-portraits`), one folder per writer
-- ("<user_id>/<image id>-<filename>", `user_id` being whichever of the two
-- identities uploaded it). Anyone can read via the public URL endpoint
-- (`getPublicUrl`, not a signed URL) — this bypasses RLS entirely and needs
-- no public SELECT policy, per Supabase's own linter guidance (a broad `to
-- public` SELECT policy on a public bucket doesn't add read access but does
-- let API callers LIST every file in the bucket, unrelated exposure).
-- A SELECT policy scoped to just the two writer identities (below) is still
-- required, though: INSERT's WITH CHECK on `storage.objects` isn't enough on
-- its own — Postgres also requires the inserted row to satisfy an applicable
-- SELECT policy, and with none defined at all every upload failed RLS.
-- Scoping it to `authenticated` + owner/device (not `to public`) keeps the
-- no-listing-for-strangers property while letting the actual writers upload.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dnd-journal-images', 'dnd-journal-images', true, 10485760, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Owners can read their journal image files" on storage.objects;
drop policy if exists "Any signed-in account can read journal image files" on storage.objects;
drop policy if exists "Anyone can read journal image files" on storage.objects;
drop policy if exists "Only the owner account can list journal image files" on storage.objects;
create policy "Only the owner account can list journal image files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'dnd-journal-images'
    and (select auth.uid()) in (
      '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid,
      '0b0db998-4d46-4957-9221-5663ba7a7b73'::uuid
    )
  );

drop policy if exists "Owners can upload their journal image files" on storage.objects;
drop policy if exists "Only the owner account can upload journal image files" on storage.objects;
create policy "Only the owner account can upload journal image files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'dnd-journal-images'
    and (select auth.uid()) in (
      '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid,
      '0b0db998-4d46-4957-9221-5663ba7a7b73'::uuid
    )
  );

drop policy if exists "Owners can delete their journal image files" on storage.objects;
drop policy if exists "Only the owner account can delete journal image files" on storage.objects;
create policy "Only the owner account can delete journal image files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'dnd-journal-images'
    and (select auth.uid()) in (
      '44153f98-aaf2-4935-b7b2-45fe3155edc6'::uuid,
      '0b0db998-4d46-4957-9221-5663ba7a7b73'::uuid
    )
  );

-- The browser subscribes to page and folder changes from either writer. Add
-- both tables once; the guards keep this source SQL idempotent.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'dnd_journal_pages'
  ) then
    alter publication supabase_realtime add table public.dnd_journal_pages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'dnd_journal_folders'
  ) then
    alter publication supabase_realtime add table public.dnd_journal_folders;
  end if;
end
$$;
