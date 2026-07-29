-- Owner-only player transcripts and personal chronicle documents.
-- Raw/processed text is private to its Supabase Auth owner. The active library
-- chronicle is only a grouping key; membership never expands document access.

create table if not exists public.personal_chronicle_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chronicle_id uuid not null references public.library_chronicles(id) on delete cascade,
  source_name text not null,
  title text not null,
  character_name text not null default '',
  speaker_hints text not null default '',
  status text not null default 'uploading',
  total_chunks integer not null,
  processed_chunks integer not null default 0,
  source_characters integer not null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint personal_chronicle_jobs_source_check
    check (length(btrim(source_name)) between 1 and 240),
  constraint personal_chronicle_jobs_title_check
    check (length(btrim(title)) between 1 and 240),
  constraint personal_chronicle_jobs_character_check
    check (length(character_name) <= 160),
  constraint personal_chronicle_jobs_speaker_hints_check
    check (length(speaker_hints) <= 1000),
  constraint personal_chronicle_jobs_status_check
    check (status in ('uploading', 'processing', 'summarizing', 'completed', 'failed')),
  constraint personal_chronicle_jobs_total_check
    check (total_chunks between 1 and 600),
  constraint personal_chronicle_jobs_processed_check
    check (processed_chunks between 0 and total_chunks),
  constraint personal_chronicle_jobs_source_size_check
    check (source_characters between 1 and 8000000),
  constraint personal_chronicle_jobs_error_check
    check (error_message is null or length(error_message) <= 2000)
);

create index if not exists personal_chronicle_jobs_owner_chronicle_idx
  on public.personal_chronicle_jobs (user_id, chronicle_id, created_at desc);
create index if not exists personal_chronicle_jobs_owner_status_idx
  on public.personal_chronicle_jobs (user_id, status, updated_at desc);
create index if not exists personal_chronicle_jobs_chronicle_idx
  on public.personal_chronicle_jobs (chronicle_id);

create table if not exists public.personal_chronicle_job_chunks (
  job_id uuid not null references public.personal_chronicle_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chronicle_id uuid not null references public.library_chronicles(id) on delete cascade,
  chunk_index integer not null,
  raw_content text not null,
  processed_content text,
  chunk_summary text,
  status text not null default 'pending',
  error_message text,
  updated_at timestamptz not null default now(),
  primary key (job_id, chunk_index),
  constraint personal_chronicle_job_chunks_index_check check (chunk_index >= 0),
  constraint personal_chronicle_job_chunks_raw_check
    check (length(btrim(raw_content)) between 1 and 20000),
  constraint personal_chronicle_job_chunks_processed_check
    check (processed_content is null or length(btrim(processed_content)) between 1 and 50000),
  constraint personal_chronicle_job_chunks_summary_check
    check (chunk_summary is null or length(btrim(chunk_summary)) between 1 and 5000),
  constraint personal_chronicle_job_chunks_status_check
    check (status in ('pending', 'processing', 'processed', 'failed')),
  constraint personal_chronicle_job_chunks_error_check
    check (error_message is null or length(error_message) <= 2000)
);

create index if not exists personal_chronicle_job_chunks_owner_job_idx
  on public.personal_chronicle_job_chunks (user_id, job_id, chunk_index);
create index if not exists personal_chronicle_job_chunks_job_status_idx
  on public.personal_chronicle_job_chunks (job_id, status, chunk_index);
create index if not exists personal_chronicle_job_chunks_chronicle_idx
  on public.personal_chronicle_job_chunks (chronicle_id);

create table if not exists public.personal_chronicle_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chronicle_id uuid not null references public.library_chronicles(id) on delete cascade,
  job_id uuid not null references public.personal_chronicle_jobs(id) on delete cascade,
  kind text not null,
  source_name text not null,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint personal_chronicle_documents_kind_check
    check (kind in ('clean_transcript', 'player_chronicle')),
  constraint personal_chronicle_documents_source_check
    check (length(btrim(source_name)) between 1 and 240),
  constraint personal_chronicle_documents_title_check
    check (length(btrim(title)) between 1 and 240),
  unique (job_id, kind)
);

create index if not exists personal_chronicle_documents_owner_chronicle_idx
  on public.personal_chronicle_documents (user_id, chronicle_id, created_at desc);
create index if not exists personal_chronicle_documents_chronicle_idx
  on public.personal_chronicle_documents (chronicle_id);

create table if not exists public.personal_chronicle_document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.personal_chronicle_documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chronicle_id uuid not null references public.library_chronicles(id) on delete cascade,
  section_title text not null default '',
  chunk_index integer not null,
  content text not null,
  created_at timestamptz not null default now(),
  tsv tsvector generated always as (
    to_tsvector('russian'::regconfig, coalesce(section_title, '') || ' ' || coalesce(content, ''))
  ) stored,
  constraint personal_chronicle_document_chunks_section_check
    check (length(section_title) <= 300),
  constraint personal_chronicle_document_chunks_index_check check (chunk_index >= 0),
  constraint personal_chronicle_document_chunks_content_check
    check (length(btrim(content)) between 1 and 100000),
  unique (document_id, chunk_index)
);

create index if not exists personal_chronicle_document_chunks_tsv_idx
  on public.personal_chronicle_document_chunks using gin (tsv);
create index if not exists personal_chronicle_document_chunks_owner_chronicle_idx
  on public.personal_chronicle_document_chunks (user_id, chronicle_id, document_id, chunk_index);
create index if not exists personal_chronicle_document_chunks_chronicle_idx
  on public.personal_chronicle_document_chunks (chronicle_id);

alter table public.personal_chronicle_jobs enable row level security;
alter table public.personal_chronicle_job_chunks enable row level security;
alter table public.personal_chronicle_documents enable row level security;
alter table public.personal_chronicle_document_chunks enable row level security;

revoke all on public.personal_chronicle_jobs from anon, authenticated;
revoke all on public.personal_chronicle_job_chunks from anon, authenticated;
revoke all on public.personal_chronicle_documents from anon, authenticated;
revoke all on public.personal_chronicle_document_chunks from anon, authenticated;

grant select, insert, update, delete on public.personal_chronicle_jobs to authenticated;
grant select, insert, update, delete on public.personal_chronicle_job_chunks to authenticated;
grant select, insert, update, delete on public.personal_chronicle_documents to authenticated;
grant select, insert, update, delete on public.personal_chronicle_document_chunks to authenticated;

drop policy if exists "Owners can read personal chronicle jobs" on public.personal_chronicle_jobs;
create policy "Owners can read personal chronicle jobs"
on public.personal_chronicle_jobs for select to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists "Members can create their personal chronicle jobs" on public.personal_chronicle_jobs;
create policy "Members can create their personal chronicle jobs"
on public.personal_chronicle_jobs for insert to authenticated
with check (
  (select auth.uid()) is not null
  and user_id = (select auth.uid())
  and exists (
    select 1 from public.library_chronicle_members membership
    where membership.chronicle_id = personal_chronicle_jobs.chronicle_id
      and membership.user_id = (select auth.uid())
  )
);

drop policy if exists "Owners can update personal chronicle jobs" on public.personal_chronicle_jobs;
create policy "Owners can update personal chronicle jobs"
on public.personal_chronicle_jobs for update to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()))
with check (
  (select auth.uid()) is not null
  and user_id = (select auth.uid())
  and exists (
    select 1 from public.library_chronicle_members membership
    where membership.chronicle_id = personal_chronicle_jobs.chronicle_id
      and membership.user_id = (select auth.uid())
  )
);

drop policy if exists "Owners can delete personal chronicle jobs" on public.personal_chronicle_jobs;
create policy "Owners can delete personal chronicle jobs"
on public.personal_chronicle_jobs for delete to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists "Owners can read personal chronicle job chunks" on public.personal_chronicle_job_chunks;
create policy "Owners can read personal chronicle job chunks"
on public.personal_chronicle_job_chunks for select to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists "Owners can insert personal chronicle job chunks" on public.personal_chronicle_job_chunks;
create policy "Owners can insert personal chronicle job chunks"
on public.personal_chronicle_job_chunks for insert to authenticated
with check (
  (select auth.uid()) is not null
  and user_id = (select auth.uid())
  and exists (
    select 1 from public.personal_chronicle_jobs job
    where job.id = personal_chronicle_job_chunks.job_id
      and job.user_id = (select auth.uid())
      and job.chronicle_id = personal_chronicle_job_chunks.chronicle_id
      and personal_chronicle_job_chunks.chunk_index < job.total_chunks
  )
);

drop policy if exists "Owners can update personal chronicle job chunks" on public.personal_chronicle_job_chunks;
create policy "Owners can update personal chronicle job chunks"
on public.personal_chronicle_job_chunks for update to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()))
with check (
  (select auth.uid()) is not null
  and user_id = (select auth.uid())
  and exists (
    select 1 from public.personal_chronicle_jobs job
    where job.id = personal_chronicle_job_chunks.job_id
      and job.user_id = (select auth.uid())
      and job.chronicle_id = personal_chronicle_job_chunks.chronicle_id
      and personal_chronicle_job_chunks.chunk_index < job.total_chunks
  )
);

drop policy if exists "Owners can delete personal chronicle job chunks" on public.personal_chronicle_job_chunks;
create policy "Owners can delete personal chronicle job chunks"
on public.personal_chronicle_job_chunks for delete to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists "Owners can read personal chronicle documents" on public.personal_chronicle_documents;
create policy "Owners can read personal chronicle documents"
on public.personal_chronicle_documents for select to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists "Owners can insert personal chronicle documents" on public.personal_chronicle_documents;
create policy "Owners can insert personal chronicle documents"
on public.personal_chronicle_documents for insert to authenticated
with check (
  (select auth.uid()) is not null
  and user_id = (select auth.uid())
  and exists (
    select 1 from public.personal_chronicle_jobs job
    where job.id = personal_chronicle_documents.job_id
      and job.user_id = (select auth.uid())
      and job.chronicle_id = personal_chronicle_documents.chronicle_id
  )
);

drop policy if exists "Owners can update personal chronicle documents" on public.personal_chronicle_documents;
create policy "Owners can update personal chronicle documents"
on public.personal_chronicle_documents for update to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()))
with check (
  (select auth.uid()) is not null
  and user_id = (select auth.uid())
  and exists (
    select 1 from public.personal_chronicle_jobs job
    where job.id = personal_chronicle_documents.job_id
      and job.user_id = (select auth.uid())
      and job.chronicle_id = personal_chronicle_documents.chronicle_id
  )
);

drop policy if exists "Owners can delete personal chronicle documents" on public.personal_chronicle_documents;
create policy "Owners can delete personal chronicle documents"
on public.personal_chronicle_documents for delete to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists "Owners can read personal chronicle document chunks" on public.personal_chronicle_document_chunks;
create policy "Owners can read personal chronicle document chunks"
on public.personal_chronicle_document_chunks for select to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

drop policy if exists "Owners can insert personal chronicle document chunks" on public.personal_chronicle_document_chunks;
create policy "Owners can insert personal chronicle document chunks"
on public.personal_chronicle_document_chunks for insert to authenticated
with check (
  (select auth.uid()) is not null
  and user_id = (select auth.uid())
  and exists (
    select 1 from public.personal_chronicle_documents document
    where document.id = personal_chronicle_document_chunks.document_id
      and document.user_id = (select auth.uid())
      and document.chronicle_id = personal_chronicle_document_chunks.chronicle_id
  )
);

drop policy if exists "Owners can update personal chronicle document chunks" on public.personal_chronicle_document_chunks;
create policy "Owners can update personal chronicle document chunks"
on public.personal_chronicle_document_chunks for update to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()))
with check (
  (select auth.uid()) is not null
  and user_id = (select auth.uid())
  and exists (
    select 1 from public.personal_chronicle_documents document
    where document.id = personal_chronicle_document_chunks.document_id
      and document.user_id = (select auth.uid())
      and document.chronicle_id = personal_chronicle_document_chunks.chronicle_id
  )
);

drop policy if exists "Owners can delete personal chronicle document chunks" on public.personal_chronicle_document_chunks;
create policy "Owners can delete personal chronicle document chunks"
on public.personal_chronicle_document_chunks for delete to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

create or replace function public.complete_personal_chronicle_job(
  p_job_id uuid,
  p_summary_title text,
  p_summary_content text
)
returns table (
  clean_document_id uuid,
  summary_document_id uuid
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_job public.personal_chronicle_jobs%rowtype;
  v_clean_document_id uuid;
  v_summary_document_id uuid;
  v_summary_title text := btrim(coalesce(p_summary_title, ''));
  v_summary_content text := btrim(coalesce(p_summary_content, ''));
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select job.* into v_job
  from public.personal_chronicle_jobs job
  where job.id = p_job_id and job.user_id = v_user_id
  for update;

  if v_job.id is null then
    raise exception 'Personal chronicle job not found' using errcode = 'P0002';
  end if;
  if length(v_summary_title) not between 1 and 240 then
    raise exception 'Summary title must contain 1 to 240 characters' using errcode = '22023';
  end if;
  if length(v_summary_content) not between 1 and 100000 then
    raise exception 'Summary content must contain 1 to 100000 characters' using errcode = '22023';
  end if;
  if (
    select count(*)
    from public.personal_chronicle_job_chunks chunk
    where chunk.job_id = v_job.id
      and chunk.user_id = v_user_id
      and chunk.status = 'processed'
      and length(btrim(coalesce(chunk.processed_content, ''))) > 0
  ) <> v_job.total_chunks then
    raise exception 'Not every source chunk has been processed' using errcode = '22023';
  end if;

  insert into public.personal_chronicle_documents (
    user_id, chronicle_id, job_id, kind, source_name, title, updated_at
  ) values (
    v_user_id,
    v_job.chronicle_id,
    v_job.id,
    'clean_transcript',
    left(regexp_replace(v_job.source_name, '\.[^.]+$', ''), 220) || '-clean.md',
    left(v_job.title || ' — полный обработанный текст', 240),
    now()
  )
  on conflict (job_id, kind) do update
    set source_name = excluded.source_name,
        title = excluded.title,
        updated_at = excluded.updated_at
  returning id into v_clean_document_id;

  insert into public.personal_chronicle_documents (
    user_id, chronicle_id, job_id, kind, source_name, title, updated_at
  ) values (
    v_user_id,
    v_job.chronicle_id,
    v_job.id,
    'player_chronicle',
    left(regexp_replace(v_job.source_name, '\.[^.]+$', ''), 220) || '-player-chronicle.md',
    v_summary_title,
    now()
  )
  on conflict (job_id, kind) do update
    set source_name = excluded.source_name,
        title = excluded.title,
        updated_at = excluded.updated_at
  returning id into v_summary_document_id;

  delete from public.personal_chronicle_document_chunks chunk
  where chunk.document_id in (v_clean_document_id, v_summary_document_id)
    and chunk.user_id = v_user_id;

  insert into public.personal_chronicle_document_chunks (
    document_id, user_id, chronicle_id, section_title, chunk_index, content
  )
  select
    v_clean_document_id,
    v_user_id,
    v_job.chronicle_id,
    'Часть ' || (chunk.chunk_index + 1),
    chunk.chunk_index,
    btrim(chunk.processed_content)
  from public.personal_chronicle_job_chunks chunk
  where chunk.job_id = v_job.id
    and chunk.user_id = v_user_id
  order by chunk.chunk_index;

  insert into public.personal_chronicle_document_chunks (
    document_id, user_id, chronicle_id, section_title, chunk_index, content
  ) values (
    v_summary_document_id,
    v_user_id,
    v_job.chronicle_id,
    'Личная хроника',
    0,
    v_summary_content
  );

  update public.personal_chronicle_jobs
  set status = 'completed',
      processed_chunks = total_chunks,
      error_message = null,
      updated_at = now(),
      completed_at = now()
  where id = v_job.id and user_id = v_user_id;

  return query select v_clean_document_id, v_summary_document_id;
end;
$$;

revoke all on function public.complete_personal_chronicle_job(uuid, text, text) from public, anon;
grant execute on function public.complete_personal_chronicle_job(uuid, text, text) to authenticated;

create or replace function public.search_my_personal_chronicle(
  p_chronicle_id uuid,
  p_query text,
  p_limit integer default 6
)
returns table (
  chronicle_id uuid,
  chronicle_title text,
  document_title text,
  section_title text,
  chunk_index integer,
  rank real,
  snippet text,
  source_scope text
)
language sql
stable
security invoker
set search_path = public
as $$
  with search_queries as (
    select
      websearch_to_tsquery('russian'::regconfig, btrim(coalesce(p_query, ''))) as strict_query,
      websearch_to_tsquery(
        'russian'::regconfig,
        regexp_replace(btrim(coalesce(p_query, '')), '\s+', ' OR ', 'g')
      ) as relaxed_query
  ), ranked as (
    select
      chunk.chronicle_id,
      chronicle.title as chronicle_title,
      document.title as document_title,
      chunk.section_title,
      chunk.chunk_index,
      (
        case when chunk.tsv @@ query.strict_query then 1.0 else 0.0 end
        + ts_rank(
          chunk.tsv,
          case when chunk.tsv @@ query.strict_query then query.strict_query else query.relaxed_query end
        )
      )::real as rank,
      ts_headline(
        'russian'::regconfig,
        chunk.content,
        case when chunk.tsv @@ query.strict_query then query.strict_query else query.relaxed_query end,
        'MaxWords=110, MinWords=45, MaxFragments=1, ShortWord=2'
      ) as snippet
    from public.personal_chronicle_document_chunks chunk
    join public.personal_chronicle_documents document on document.id = chunk.document_id
    join public.library_chronicles chronicle on chronicle.id = chunk.chronicle_id
    cross join search_queries query
    where (select auth.uid()) is not null
      and chunk.user_id = (select auth.uid())
      and chunk.chronicle_id = p_chronicle_id
      and length(btrim(coalesce(p_query, ''))) between 2 and 180
      and (chunk.tsv @@ query.strict_query or chunk.tsv @@ query.relaxed_query)
  )
  select
    ranked.chronicle_id,
    ranked.chronicle_title,
    ranked.document_title,
    ranked.section_title,
    ranked.chunk_index,
    ranked.rank,
    ranked.snippet,
    'personal'::text
  from ranked
  order by ranked.rank desc, ranked.document_title, ranked.chunk_index
  limit least(greatest(coalesce(p_limit, 6), 1), 16);
$$;

revoke all on function public.search_my_personal_chronicle(uuid, text, integer) from public, anon;
grant execute on function public.search_my_personal_chronicle(uuid, text, integer) to authenticated;
