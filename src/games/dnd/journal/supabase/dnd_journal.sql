-- Applied to the live Supabase project (klhxbaagarqxaqnrvurr) 2026-07-31.
--
-- Public-read, owner-or-device-write D&D journal: pages + page images,
-- synced between the RenaCompanion iPad app (Support/JournalSyncService.swift)
-- and TableTopGames' /dnd/journal page. See docs/ai/DECISIONS.md (2026-07-31
-- entries) for the reasoning.
--
-- Source shapes mirrored (core fields only — see the DECISIONS note on
-- newer Swift-side additions not yet mirrored here: entryType/structuredFields,
-- folderId, sortOrder):
--   "DnD Interactive Sheet/DnD Interactive Sheet/Models/GameState/JournalPage.swift"
--   "DnD Interactive Sheet/DnD Interactive Sheet/Models/GameState/JournalImage.swift"
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
--   creates/updates as of 2026-07-31 — it doesn't propagate deletes yet.)

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

alter table public.dnd_journal_pages enable row level security;
alter table public.dnd_journal_images enable row level security;

drop policy if exists "Owners can read their journal pages" on public.dnd_journal_pages;
drop policy if exists "Any signed-in account can read journal pages" on public.dnd_journal_pages;
drop policy if exists "Anyone can read journal pages" on public.dnd_journal_pages;
create policy "Anyone can read journal pages"
  on public.dnd_journal_pages for select
  to public
  using (deleted_at is null);

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

drop policy if exists "Owners can read their journal images" on public.dnd_journal_images;
drop policy if exists "Any signed-in account can read journal images" on public.dnd_journal_images;
drop policy if exists "Anyone can read journal images" on public.dnd_journal_images;
create policy "Anyone can read journal images"
  on public.dnd_journal_images for select
  to public
  using (deleted_at is null);

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
-- no SELECT policy, per Supabase's own linter guidance. No SELECT policy is
-- granted on `storage.objects` for this bucket on purpose: a broad SELECT
-- policy on a public bucket doesn't add read access (the public flag already
-- grants that) but does let API callers LIST every file in the bucket, which
-- is unrelated exposure. Only the owner or device account can upload/delete,
-- which is still RLS-enforced regardless of the bucket's public flag.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dnd-journal-images', 'dnd-journal-images', true, 10485760, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Owners can read their journal image files" on storage.objects;
drop policy if exists "Any signed-in account can read journal image files" on storage.objects;
drop policy if exists "Anyone can read journal image files" on storage.objects;

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
