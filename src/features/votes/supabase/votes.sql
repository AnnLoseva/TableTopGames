-- Applied to the live Supabase project (klhxbaagarqxaqnrvurr) 2026-09-06.
--
-- Percentage-allocation polls ("/votes"): fully anonymous, no auth, no
-- relation to any tabletop-game domain in this repo. Shares only the
-- Supabase project. See docs/ai/DECISIONS.md (2026-09-06 entry).
--
-- Access model: anyone can create a poll and anyone can read/submit
-- responses — same "open, no-login" shape as the D&D journal's public reads,
-- except here writes are open too (there is no owner to protect; a poll's
-- only secret is its slug). The client withholds the results view until the
-- visitor has submitted their own allocation (see PollRoute.tsx); RLS does
-- not enforce that — it is a UX choice, not a security boundary.

create or replace function public.votes_allocations_valid(allocations jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  total numeric := 0;
  value_text text;
  value_num numeric;
  entry_count integer := 0;
begin
  if jsonb_typeof(allocations) is distinct from 'object' then
    return false;
  end if;

  for value_text in select value from jsonb_each_text(allocations) loop
    entry_count := entry_count + 1;
    begin
      value_num := value_text::numeric;
    exception when others then
      return false;
    end;
    if value_num < 0 or value_num > 100 then
      return false;
    end if;
    total := total + value_num;
  end loop;

  return entry_count > 0 and total = 100;
end;
$$;

create table if not exists public.votes_polls (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  background_image_url text,
  options jsonb not null,
  created_at timestamptz not null default now(),
  constraint votes_polls_slug_check check (slug ~ '^[a-z0-9]{6,32}$'),
  constraint votes_polls_title_check check (length(trim(title)) between 1 and 200),
  constraint votes_polls_description_check check (length(description) <= 2000),
  constraint votes_polls_background_url_check check (
    background_image_url is null or length(background_image_url) <= 2000
  ),
  constraint votes_polls_options_check check (
    jsonb_typeof(options) = 'array'
    and jsonb_array_length(options) between 2 and 12
  )
);

create index if not exists votes_polls_created_idx on public.votes_polls (created_at desc);

create table if not exists public.votes_responses (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.votes_polls(id) on delete cascade,
  allocations jsonb not null,
  created_at timestamptz not null default now(),
  constraint votes_responses_allocations_check check (public.votes_allocations_valid(allocations))
);

create index if not exists votes_responses_poll_idx on public.votes_responses (poll_id, created_at desc);

alter table public.votes_polls enable row level security;
alter table public.votes_responses enable row level security;

grant select, insert on public.votes_polls to anon, authenticated;
grant select, insert on public.votes_responses to anon, authenticated;

drop policy if exists "Anyone can read polls" on public.votes_polls;
create policy "Anyone can read polls"
  on public.votes_polls for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can create polls" on public.votes_polls;
create policy "Anyone can create polls"
  on public.votes_polls for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Anyone can read poll responses" on public.votes_responses;
create policy "Anyone can read poll responses"
  on public.votes_responses for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can submit a poll response" on public.votes_responses;
create policy "Anyone can submit a poll response"
  on public.votes_responses for insert
  to anon, authenticated
  with check (true);
