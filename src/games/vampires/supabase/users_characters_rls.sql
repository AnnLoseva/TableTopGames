-- Users / characters RLS for the current app auth model.
--
-- Important: the app currently logs in with its own public.users table
-- (username + password_hash), not Supabase Auth. Because browser clients do not
-- carry an auth.uid() that matches public.users.id, these policies are
-- intentionally permissive enough for the app to keep working.
--
-- If you later migrate to Supabase Auth, replace the characters update/delete
-- policies with auth.uid() ownership checks and stop selecting password_hash
-- from the browser.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  clan text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists users_username_key
  on public.users (username);

create index if not exists characters_user_id_idx
  on public.characters (user_id);

create index if not exists characters_user_name_idx
  on public.characters (user_id, name);

grant usage on schema public to anon, authenticated;
grant select, insert, update on public.users to anon, authenticated;
grant select, insert, update, delete on public.characters to anon, authenticated;

alter table public.users enable row level security;
alter table public.characters enable row level security;

-- The login flow filters by username + password_hash from the browser, so
-- SELECT must be available to anon. This is compatible with the current app,
-- but not suitable for a real public password system.
drop policy if exists "VTM users can register" on public.users;
create policy "VTM users can register"
  on public.users
  for insert
  to public
  with check (
    length(trim(username)) >= 3
    and length(password_hash) > 0
  );

drop policy if exists "VTM users can login" on public.users;
create policy "VTM users can login"
  on public.users
  for select
  to public
  using (true);

drop policy if exists "VTM users can update own app profile fields" on public.users;
create policy "VTM users can update own app profile fields"
  on public.users
  for update
  to public
  using (true)
  with check (
    length(trim(username)) >= 3
    and length(password_hash) > 0
  );

drop policy if exists "VTM characters can be read by app" on public.characters;
create policy "VTM characters can be read by app"
  on public.characters
  for select
  to public
  using (true);

drop policy if exists "VTM characters can be created by app" on public.characters;
create policy "VTM characters can be created by app"
  on public.characters
  for insert
  to public
  with check (
    user_id is not null
    and length(trim(name)) > 0
  );

drop policy if exists "VTM characters can be updated by app" on public.characters;
create policy "VTM characters can be updated by app"
  on public.characters
  for update
  to public
  using (true)
  with check (
    user_id is not null
    and length(trim(name)) > 0
  );

drop policy if exists "VTM characters can be deleted by app" on public.characters;
create policy "VTM characters can be deleted by app"
  on public.characters
  for delete
  to public
  using (true);

alter table public.characters replica identity full;
