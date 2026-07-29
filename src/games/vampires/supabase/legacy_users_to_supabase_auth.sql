-- Migrate legacy public.users (username + base64 password) to Supabase Auth.
-- Applied to production on 2026-07-12.
--
-- Design:
--  * Email is synthetic and deterministic: first 32 hex chars of
--    sha256(username) @vtm.local. Client computes the same email
--    (archiveEmail in modules/home/components/MainScreen.tsx).
--  * Existing rows were migrated in-place: legacy password_hash is base64 of
--    the plaintext password, so real passwords were restored and written into
--    auth.users via crypt(..., bf). Users keep their old username + password.
--  * public.users stays as the profile table; characters/chat keep pointing at
--    public.users.id. auth_user_id links a profile to its auth.users row.
--  * Registration goes through register_archive_user (security definer), so it
--    does not depend on GoTrue signup / email confirmation settings.
--  * migrate_legacy_auth is a self-healing path for any legacy row created
--    between the SQL migration and the client deploy.

create extension if not exists pgcrypto;

alter table public.users add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
create unique index if not exists users_auth_user_id_idx on public.users (auth_user_id) where auth_user_id is not null;

-- Deterministic synthetic email from username (matches client-side sha256 hex).
create or replace function public.archive_email_for_username(p_username text)
returns text
language sql
immutable
set search_path = public
as $$
  select substr(encode(extensions.digest(convert_to(p_username, 'UTF8'), 'sha256'), 'hex'), 1, 32) || '@vtm.local';
$$;

revoke all on function public.archive_email_for_username(text) from public;
grant execute on function public.archive_email_for_username(text) to anon, authenticated;

-- Internal helper: create a confirmed auth user with given email/password.
create or replace function public._create_archive_auth_user(p_email text, p_password text, p_username text)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
    p_email, extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('username', p_username),
    now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), new_id,
    jsonb_build_object('sub', new_id::text, 'email', p_email, 'email_verified', true, 'phone_verified', false),
    'email', new_id::text,
    now(), now(), now()
  );

  return new_id;
end;
$$;

revoke all on function public._create_archive_auth_user(text, text, text) from public;

-- Registration used by the site (replaces direct insert into public.users).
create or replace function public.register_archive_user(p_username text, p_password text)
returns table (id uuid, username text)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_email text;
  v_auth_id uuid;
  v_user public.users;
begin
  if length(trim(p_username)) < 3 then
    raise exception 'username_too_short';
  end if;
  if length(p_password) < 6 then
    raise exception 'password_too_short';
  end if;
  if exists (select 1 from public.users u where u.username = p_username) then
    raise exception 'duplicate_username' using errcode = '23505';
  end if;

  v_email := public.archive_email_for_username(p_username);
  v_auth_id := public._create_archive_auth_user(v_email, p_password, p_username);

  insert into public.users (username, password_hash, auth_user_id)
  values (p_username, encode(convert_to(p_password, 'UTF8'), 'base64'), v_auth_id)
  returning * into v_user;

  return query select v_user.id, v_user.username;
end;
$$;

revoke all on function public.register_archive_user(text, text) from public;
grant execute on function public.register_archive_user(text, text) to anon, authenticated;

-- Self-healing path: legacy row exists but no auth account yet (e.g. created
-- between migration and deploy). Verifies password against stored base64 hash.
create or replace function public.migrate_legacy_auth(p_username text, p_password text)
returns table (id uuid, username text)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user public.users;
  v_email text;
  v_auth_id uuid;
begin
  select * into v_user from public.users u
  where u.username = p_username
    and u.password_hash = encode(convert_to(p_password, 'UTF8'), 'base64');

  if v_user.id is null then
    return;
  end if;

  if v_user.auth_user_id is not null then
    return query select v_user.id, v_user.username;
    return;
  end if;

  v_email := public.archive_email_for_username(p_username);
  v_auth_id := public._create_archive_auth_user(v_email, p_password, p_username);
  update public.users set auth_user_id = v_auth_id where public.users.id = v_user.id;

  return query select v_user.id, v_user.username;
end;
$$;

revoke all on function public.migrate_legacy_auth(text, text) from public;
grant execute on function public.migrate_legacy_auth(text, text) to anon, authenticated;

-- One-time migration of all existing legacy users (passwords are recoverable base64).
do $$
declare
  rec record;
  v_email text;
  v_password text;
  v_auth_id uuid;
begin
  for rec in select * from public.users where auth_user_id is null loop
    begin
      v_password := convert_from(decode(rec.password_hash, 'base64'), 'UTF8');
      v_email := public.archive_email_for_username(rec.username);
      if exists (select 1 from auth.users au where au.email = v_email) then
        raise notice 'skip %, email already exists', rec.username;
        continue;
      end if;
      v_auth_id := public._create_archive_auth_user(v_email, v_password, rec.username);
      update public.users set auth_user_id = v_auth_id where id = rec.id;
    exception when others then
      raise notice 'failed to migrate user %: %', rec.username, sqlerrm;
    end;
  end loop;
end $$;

-- Provisioning (applied separately): chronicle 'campaign-666' created with
-- user Anna as master in chronicle_members.
