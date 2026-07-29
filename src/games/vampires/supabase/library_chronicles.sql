-- Private game chronicles for the authenticated librarian chat.
-- Applied through Supabase migration; chronicle text is ingested separately and
-- is intentionally not stored in Git.

create table if not exists public.library_chronicles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  normalized_title text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint library_chronicles_title_check
    check (length(btrim(title)) between 1 and 160),
  constraint library_chronicles_normalized_title_check
    check (length(btrim(normalized_title)) between 1 and 160)
);

create table if not exists public.library_chronicle_members (
  chronicle_id uuid not null references public.library_chronicles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_opened_at timestamptz not null default now(),
  primary key (chronicle_id, user_id)
);

create index if not exists library_chronicle_members_user_opened_idx
  on public.library_chronicle_members (user_id, last_opened_at desc);

create table if not exists public.library_chronicle_chunks (
  id uuid primary key default gen_random_uuid(),
  chronicle_id uuid not null references public.library_chronicles(id) on delete cascade,
  source_name text not null,
  document_title text not null,
  section_title text not null default '',
  chunk_index integer not null,
  content text not null,
  created_at timestamptz not null default now(),
  tsv tsvector generated always as (
    to_tsvector(
      'russian'::regconfig,
      coalesce(document_title, '') || ' ' ||
      coalesce(section_title, '') || ' ' ||
      coalesce(content, '')
    )
  ) stored,
  constraint library_chronicle_chunks_source_check
    check (length(btrim(source_name)) between 1 and 240),
  constraint library_chronicle_chunks_document_check
    check (length(btrim(document_title)) between 1 and 240),
  constraint library_chronicle_chunks_section_check
    check (length(section_title) <= 300),
  constraint library_chronicle_chunks_index_check check (chunk_index >= 0),
  constraint library_chronicle_chunks_content_check check (length(btrim(content)) > 0),
  unique (chronicle_id, source_name, chunk_index)
);

create index if not exists library_chronicle_chunks_tsv_idx
  on public.library_chronicle_chunks using gin (tsv);
create index if not exists library_chronicle_chunks_chronicle_document_idx
  on public.library_chronicle_chunks (chronicle_id, document_title, chunk_index);

alter table public.library_chronicles enable row level security;
alter table public.library_chronicle_members enable row level security;
alter table public.library_chronicle_chunks enable row level security;

revoke all on public.library_chronicles from anon, authenticated;
revoke all on public.library_chronicle_members from anon, authenticated;
revoke all on public.library_chronicle_chunks from anon, authenticated;
grant select on public.library_chronicles to authenticated;
grant select on public.library_chronicle_members to authenticated;
grant select on public.library_chronicle_chunks to authenticated;
grant insert, delete on public.library_chronicle_chunks to authenticated;

drop policy if exists "Members can read their library chronicles" on public.library_chronicles;
create policy "Members can read their library chronicles"
on public.library_chronicles
for select to authenticated
using (
  (select auth.uid()) is not null
  and exists (
    select 1
    from public.library_chronicle_members membership
    where membership.chronicle_id = library_chronicles.id
      and membership.user_id = (select auth.uid())
  )
);

drop policy if exists "Users can read their library chronicle memberships" on public.library_chronicle_members;
create policy "Users can read their library chronicle memberships"
on public.library_chronicle_members
for select to authenticated
using (
  (select auth.uid()) is not null
  and user_id = (select auth.uid())
);

drop policy if exists "Members can read their library chronicle text" on public.library_chronicle_chunks;
create policy "Members can read their library chronicle text"
on public.library_chronicle_chunks
for select to authenticated
using (
  (select auth.uid()) is not null
  and exists (
    select 1
    from public.library_chronicle_members membership
    where membership.chronicle_id = library_chronicle_chunks.chronicle_id
      and membership.user_id = (select auth.uid())
  )
);

-- Chronicle uploads are limited twice: the caller must be a Storyteller in the
-- main game subsystem and must already be subscribed to the target library
-- chronicle. The same checks also protect direct Data API writes.
drop policy if exists "Subscribed masters can insert library chronicle text" on public.library_chronicle_chunks;
create policy "Subscribed masters can insert library chronicle text"
on public.library_chronicle_chunks
for insert to authenticated
with check (
  (select auth.uid()) is not null
  and (select public.is_any_chronicle_master())
  and exists (
    select 1
    from public.library_chronicle_members membership
    where membership.chronicle_id = library_chronicle_chunks.chronicle_id
      and membership.user_id = (select auth.uid())
  )
);

drop policy if exists "Subscribed masters can delete library chronicle text" on public.library_chronicle_chunks;
create policy "Subscribed masters can delete library chronicle text"
on public.library_chronicle_chunks
for delete to authenticated
using (
  (select auth.uid()) is not null
  and (select public.is_any_chronicle_master())
  and exists (
    select 1
    from public.library_chronicle_members membership
    where membership.chronicle_id = library_chronicle_chunks.chronicle_id
      and membership.user_id = (select auth.uid())
  )
);

-- Entering an exact chronicle title creates (or refreshes) only the caller's
-- library subscription. It does not grant a role in public.chronicle_members.
create or replace function public.open_library_chronicle(p_title text)
returns table (
  id uuid,
  title text,
  joined_at timestamptz,
  last_opened_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_normalized_title text;
  v_chronicle_id uuid;
  v_title text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  v_normalized_title := lower(
    regexp_replace(btrim(coalesce(p_title, '')), '\s+', ' ', 'g')
  );
  if length(v_normalized_title) not between 1 and 160 then
    return;
  end if;

  select chronicle.id, chronicle.title
  into v_chronicle_id, v_title
  from public.library_chronicles chronicle
  where chronicle.normalized_title = v_normalized_title
    and chronicle.is_active
  limit 1;

  if v_chronicle_id is null then
    return;
  end if;

  insert into public.library_chronicle_members (
    chronicle_id,
    user_id,
    last_opened_at
  ) values (
    v_chronicle_id,
    v_user_id,
    now()
  )
  on conflict (chronicle_id, user_id) do update
    set last_opened_at = excluded.last_opened_at;

  return query
  select
    v_chronicle_id,
    v_title,
    membership.joined_at,
    membership.last_opened_at
  from public.library_chronicle_members membership
  where membership.chronicle_id = v_chronicle_id
    and membership.user_id = v_user_id;
end;
$$;

revoke all on function public.open_library_chronicle(text) from public, anon;
grant execute on function public.open_library_chronicle(text) to authenticated;

create or replace function public.list_my_library_chronicles()
returns table (
  id uuid,
  title text,
  joined_at timestamptz,
  last_opened_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select
    chronicle.id,
    chronicle.title,
    membership.joined_at,
    membership.last_opened_at
  from public.library_chronicle_members membership
  join public.library_chronicles chronicle
    on chronicle.id = membership.chronicle_id
  where (select auth.uid()) is not null
    and membership.user_id = (select auth.uid())
    and chronicle.is_active
  order by membership.last_opened_at desc, chronicle.title;
$$;

revoke all on function public.list_my_library_chronicles() from public, anon;
grant execute on function public.list_my_library_chronicles() to authenticated;

create or replace function public.search_library_chronicle(
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
  snippet text
)
language sql
stable
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
      chunk.document_title,
      chunk.section_title,
      chunk.chunk_index,
      (
        case when chunk.tsv @@ query.strict_query then 1.0 else 0.0 end
        + ts_rank(
          chunk.tsv,
          case
            when chunk.tsv @@ query.strict_query then query.strict_query
            else query.relaxed_query
          end
        )
      )::real as rank,
      ts_headline(
        'russian'::regconfig,
        chunk.content,
        case
          when chunk.tsv @@ query.strict_query then query.strict_query
          else query.relaxed_query
        end,
        'MaxWords=110, MinWords=45, MaxFragments=1, ShortWord=2'
      ) as snippet
    from public.library_chronicle_chunks chunk
    join public.library_chronicles chronicle on chronicle.id = chunk.chronicle_id
    cross join search_queries query
    where chunk.chronicle_id = p_chronicle_id
      and chronicle.is_active
      and length(btrim(coalesce(p_query, ''))) between 2 and 180
      and exists (
        select 1
        from public.library_chronicle_members membership
        where membership.chronicle_id = chunk.chronicle_id
          and membership.user_id = (select auth.uid())
      )
      and (chunk.tsv @@ query.strict_query or chunk.tsv @@ query.relaxed_query)
  )
  select
    ranked.chronicle_id,
    ranked.chronicle_title,
    ranked.document_title,
    ranked.section_title,
    ranked.chunk_index,
    ranked.rank,
    ranked.snippet
  from ranked
  order by ranked.rank desc, ranked.document_title, ranked.chunk_index
  limit least(greatest(coalesce(p_limit, 6), 1), 16);
$$;

revoke all on function public.search_library_chronicle(uuid, text, integer) from public, anon;
grant execute on function public.search_library_chronicle(uuid, text, integer) to authenticated;

-- Atomically replaces one uploaded document. SECURITY INVOKER keeps RLS in
-- force, while the explicit validation prevents oversized or malformed JSON
-- payloads from reaching the chunk table.
create or replace function public.replace_library_chronicle_document(
  p_chronicle_id uuid,
  p_source_name text,
  p_document_title text,
  p_chunks jsonb
)
returns table (
  source_name text,
  document_title text,
  inserted_chunks integer
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_source_name text := btrim(coalesce(p_source_name, ''));
  v_document_title text := btrim(coalesce(p_document_title, ''));
  v_chunk_count integer;
  v_total_length bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not (select public.is_any_chronicle_master()) then
    raise exception 'Storyteller role required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.library_chronicles chronicle
    join public.library_chronicle_members membership
      on membership.chronicle_id = chronicle.id
    where chronicle.id = p_chronicle_id
      and chronicle.is_active
      and membership.user_id = (select auth.uid())
  ) then
    raise exception 'Chronicle membership required' using errcode = '42501';
  end if;

  if length(v_source_name) not between 1 and 240 then
    raise exception 'Source name must contain 1 to 240 characters' using errcode = '22023';
  end if;
  if length(v_document_title) not between 1 and 240 then
    raise exception 'Document title must contain 1 to 240 characters' using errcode = '22023';
  end if;
  if p_chunks is null or jsonb_typeof(p_chunks) <> 'array' then
    raise exception 'Chunks must be a JSON array' using errcode = '22023';
  end if;

  v_chunk_count := jsonb_array_length(p_chunks);
  if v_chunk_count not between 1 and 500 then
    raise exception 'A document must contain 1 to 500 chunks' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_chunks) chunk
    where jsonb_typeof(chunk) <> 'object'
      or length(coalesce(chunk ->> 'section_title', '')) > 300
      or length(btrim(coalesce(chunk ->> 'content', ''))) not between 1 and 50000
  ) then
    raise exception 'A chunk is malformed or exceeds its size limit' using errcode = '22023';
  end if;

  select coalesce(sum(length(chunk ->> 'content')), 0)
  into v_total_length
  from jsonb_array_elements(p_chunks) chunk;
  if v_total_length > 2000000 then
    raise exception 'Document exceeds the 2 MB text limit' using errcode = '22023';
  end if;

  delete from public.library_chronicle_chunks chunk
  where chunk.chronicle_id = p_chronicle_id
    and chunk.source_name = v_source_name;

  insert into public.library_chronicle_chunks (
    chronicle_id,
    source_name,
    document_title,
    section_title,
    chunk_index,
    content
  )
  select
    p_chronicle_id,
    v_source_name,
    v_document_title,
    left(coalesce(item.value ->> 'section_title', ''), 300),
    item.ordinality::integer - 1,
    btrim(item.value ->> 'content')
  from jsonb_array_elements(p_chunks) with ordinality as item(value, ordinality);

  return query
  select v_source_name, v_document_title, v_chunk_count;
end;
$$;

revoke all on function public.replace_library_chronicle_document(uuid, text, text, jsonb) from public, anon;
grant execute on function public.replace_library_chronicle_document(uuid, text, text, jsonb) to authenticated;

insert into public.library_chronicles (title, normalized_title, is_active)
values ('Знамение Геенны 1', 'знамение геенны 1', true)
on conflict (normalized_title) do update
set title = excluded.title,
    is_active = excluded.is_active;
