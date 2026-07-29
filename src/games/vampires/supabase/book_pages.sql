-- Rulebook pages for the VTM rules assistant. Applied 2026-07-13.
-- Page = PDF page number, so citations match the exact file players own.
-- Copyright: full text readable only by authenticated users; the site shows
-- short quoted snippets with page references. Book text is NOT in the repo —
-- it is ingested via /master/ingest-books from locally generated JSONL.

create table if not exists public.book_pages (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  title text not null,
  lang text not null default 'ru',
  page integer not null,
  content text not null,
  created_at timestamptz not null default now(),
  constraint book_pages_lang_check check (lang in ('ru', 'en')),
  constraint book_pages_page_check check (page > 0),
  unique (source, page)
);

create or replace function public.book_page_tsv(p_lang text, p_content text)
returns tsvector
language sql
immutable
set search_path = public
as $$
  select case
    when p_lang = 'en' then to_tsvector('english', p_content)
    else to_tsvector('russian', p_content)
  end;
$$;

alter table public.book_pages
  add column if not exists tsv tsvector
  generated always as (public.book_page_tsv(lang, content)) stored;

create index if not exists book_pages_tsv_idx on public.book_pages using gin (tsv);
create index if not exists book_pages_source_page_idx on public.book_pages (source, page);

alter table public.book_pages enable row level security;
revoke all on public.book_pages from anon;
grant select on public.book_pages to authenticated;

drop policy if exists "Authenticated users can read book pages" on public.book_pages;
create policy "Authenticated users can read book pages" on public.book_pages
for select to authenticated using (true);

-- Full-text search with ranked snippets.
create or replace function public.search_book_pages(
  p_query text,
  p_source text default null,
  p_limit integer default 8
)
returns table (source text, title text, page integer, rank real, snippet text)
language sql
stable
set search_path = public
as $$
  select
    bp.source,
    bp.title,
    bp.page,
    ts_rank(bp.tsv, q)::real as rank,
    ts_headline(
      (case when bp.lang = 'en' then 'english' else 'russian' end)::regconfig,
      bp.content,
      q,
      'MaxWords=80, MinWords=45, MaxFragments=1, ShortWord=2'
    ) as snippet
  from public.book_pages bp
  cross join lateral websearch_to_tsquery(
    (case when bp.lang = 'en' then 'english' else 'russian' end)::regconfig,
    p_query
  ) q
  where bp.tsv @@ q
    and (p_source is null or bp.source = p_source)
  order by ts_rank(bp.tsv, q) desc
  limit least(greatest(coalesce(p_limit, 8), 1), 20);
$$;

revoke all on function public.search_book_pages(text, text, integer) from public;
revoke all on function public.search_book_pages(text, text, integer) from anon;
grant execute on function public.search_book_pages(text, text, integer) to authenticated;

-- Masters (of any chronicle) can manage book pages via /master/ingest-books.
create or replace function public.is_any_chronicle_master()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chronicle_members m
    where m.user_id = auth.uid() and m.role = 'master'
  );
$$;

revoke all on function public.is_any_chronicle_master() from public;
grant execute on function public.is_any_chronicle_master() to authenticated;

grant insert, update, delete on public.book_pages to authenticated;

drop policy if exists "Masters can insert book pages" on public.book_pages;
create policy "Masters can insert book pages" on public.book_pages
for insert to authenticated with check (public.is_any_chronicle_master());

drop policy if exists "Masters can update book pages" on public.book_pages;
create policy "Masters can update book pages" on public.book_pages
for update to authenticated
using (public.is_any_chronicle_master())
with check (public.is_any_chronicle_master());

drop policy if exists "Masters can delete book pages" on public.book_pages;
create policy "Masters can delete book pages" on public.book_pages
for delete to authenticated using (public.is_any_chronicle_master());
