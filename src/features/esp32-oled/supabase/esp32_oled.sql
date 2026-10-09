-- ESP32-C3 OLED control plane. All browser/device traffic goes through the
-- same-origin Next.js API; these tables and the private bucket are server-only.

create table if not exists public.esp32_devices (
  id uuid primary key default gen_random_uuid(),
  device_uid text not null unique check (char_length(device_uid) between 8 and 80),
  token_hash text not null check (char_length(token_hash) = 64),
  setup_ap_ssid text check (setup_ap_ssid is null or char_length(setup_ap_ssid) between 8 and 32),
  setup_ap_password text check (setup_ap_password is null or char_length(setup_ap_password) between 8 and 63),
  owner_auth_user_id uuid references auth.users(id) on delete set null,
  name text not null default 'My OLED' check (char_length(name) between 1 and 48),
  firmware_version text,
  hardware jsonb not null default '{}'::jsonb,
  manifest jsonb not null default '[]'::jsonb,
  active_slot smallint check (active_slot between 0 and 9),
  flash_size bigint not null default 0 check (flash_size >= 0),
  fs_total bigint not null default 0 check (fs_total >= 0),
  fs_used bigint not null default 0 check (fs_used >= 0 and fs_used <= fs_total),
  brightness smallint not null default 128 check (brightness between 0 and 255),
  speed_multiplier numeric(4,2) not null default 1 check (speed_multiplier between 0.25 and 4),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists esp32_devices_owner_idx
  on public.esp32_devices(owner_auth_user_id) where owner_auth_user_id is not null and revoked_at is null;
create index if not exists esp32_devices_owner_auth_user_idx
  on public.esp32_devices(owner_auth_user_id);

alter table public.esp32_devices add column if not exists setup_ap_ssid text;
alter table public.esp32_devices add column if not exists setup_ap_password text;

create table if not exists public.esp32_pairing_challenges (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.esp32_devices(id) on delete cascade,
  pin_hash text not null check (char_length(pin_hash) = 64),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists esp32_pairing_active_idx
  on public.esp32_pairing_challenges(pin_hash, expires_at)
  where consumed_at is null;
create index if not exists esp32_pairing_challenges_device_idx
  on public.esp32_pairing_challenges(device_id);

create table if not exists public.esp32_pairing_attempts (
  rate_key_hash text primary key check (char_length(rate_key_hash) = 64),
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0),
  blocked_until timestamptz
);

create table if not exists public.esp32_device_commands (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.esp32_devices(id) on delete cascade,
  owner_auth_user_id uuid not null references auth.users(id) on delete cascade,
  command_type text not null check (command_type in (
    'upload_asset', 'delete_asset', 'rename_asset', 'set_active',
    'set_settings', 'request_manifest', 'reboot', 'reset_wifi'
  )),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'in_progress', 'succeeded', 'failed', 'cancelled')),
  idempotency_key text not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  acknowledged_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (device_id, idempotency_key)
);

create index if not exists esp32_commands_device_queue_idx
  on public.esp32_device_commands(device_id, status, available_at, created_at);
create index if not exists esp32_commands_owner_idx
  on public.esp32_device_commands(owner_auth_user_id, created_at desc);

create table if not exists public.esp32_gift_invites (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.esp32_devices(id) on delete cascade,
  sender_auth_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_auth_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_username text not null check (char_length(recipient_username) between 3 and 64),
  status text not null default 'pending' check (status in ('pending', 'wifi_reset_sent', 'ready', 'cancelled')),
  reset_command_id uuid references public.esp32_device_commands(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists esp32_gift_invites_active_device_idx
  on public.esp32_gift_invites(device_id)
  where status in ('pending', 'wifi_reset_sent');
create index if not exists esp32_gift_invites_recipient_idx
  on public.esp32_gift_invites(recipient_auth_user_id, created_at desc);
create index if not exists esp32_gift_invites_sender_idx
  on public.esp32_gift_invites(sender_auth_user_id, created_at desc);

create table if not exists public.esp32_device_events (
  id bigint generated by default as identity primary key,
  device_id uuid not null references public.esp32_devices(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 1 and 64),
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists esp32_events_device_idx
  on public.esp32_device_events(device_id, occurred_at desc);

create or replace function public.esp32_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists esp32_devices_touch on public.esp32_devices;
create trigger esp32_devices_touch before update on public.esp32_devices
for each row execute function public.esp32_touch_updated_at();
drop trigger if exists esp32_commands_touch on public.esp32_device_commands;
create trigger esp32_commands_touch before update on public.esp32_device_commands
for each row execute function public.esp32_touch_updated_at();
drop trigger if exists esp32_gift_invites_touch on public.esp32_gift_invites;
create trigger esp32_gift_invites_touch before update on public.esp32_gift_invites
for each row execute function public.esp32_touch_updated_at();

create or replace function public.esp32_claim_device(
  p_pin_hash text,
  p_owner uuid,
  p_rate_key_hash text,
  p_name text default 'My OLED'
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rate public.esp32_pairing_attempts%rowtype;
  v_candidate record;
  v_device_id uuid;
  v_count integer := 0;
begin
  insert into public.esp32_pairing_attempts(rate_key_hash, attempts)
  values (p_rate_key_hash, 0)
  on conflict (rate_key_hash) do nothing;

  select * into v_rate
  from public.esp32_pairing_attempts
  where rate_key_hash = p_rate_key_hash
  for update;

  if v_rate.blocked_until is not null and v_rate.blocked_until > now() then
    raise exception 'RATE_LIMITED';
  end if;

  if v_rate.window_started_at < now() - interval '10 minutes' then
    update public.esp32_pairing_attempts
      set window_started_at = now(), attempts = 1, blocked_until = null
      where rate_key_hash = p_rate_key_hash;
  else
    update public.esp32_pairing_attempts
      set attempts = attempts + 1,
          blocked_until = case when attempts + 1 > 5 then now() + interval '15 minutes' else blocked_until end
      where rate_key_hash = p_rate_key_hash
      returning * into v_rate;
    if v_rate.attempts > 5 then raise exception 'RATE_LIMITED'; end if;
  end if;

  for v_candidate in
    select c.id as challenge_id, d.id as device_id
    from public.esp32_pairing_challenges c
    join public.esp32_devices d on d.id = c.device_id
    where c.pin_hash = p_pin_hash
      and c.consumed_at is null
      and c.expires_at > now()
      and d.owner_auth_user_id is null
      and d.revoked_at is null
      and d.last_seen_at > now() - interval '90 seconds'
    order by c.created_at desc
    limit 2
    for update of c, d
  loop
    v_count := v_count + 1;
    v_device_id := v_candidate.device_id;
  end loop;

  if v_count = 0 then raise exception 'PAIRING_NOT_FOUND'; end if;
  if v_count > 1 then raise exception 'PAIRING_AMBIGUOUS'; end if;

  update public.esp32_devices
    set owner_auth_user_id = p_owner,
        name = left(coalesce(nullif(trim(p_name), ''), 'My OLED'), 48)
    where id = v_device_id and owner_auth_user_id is null;
  if not found then raise exception 'DEVICE_ALREADY_CLAIMED'; end if;

  update public.esp32_pairing_challenges
    set consumed_at = now()
    where device_id = v_device_id and consumed_at is null;
  delete from public.esp32_pairing_attempts where rate_key_hash = p_rate_key_hash;
  return v_device_id;
end;
$$;

create or replace function public.esp32_consume_rate_limit(
  p_rate_key_hash text,
  p_limit integer,
  p_window_seconds integer,
  p_block_seconds integer
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rate public.esp32_pairing_attempts%rowtype;
begin
  if p_limit < 1 or p_window_seconds < 1 or p_block_seconds < 1 then return false; end if;
  insert into public.esp32_pairing_attempts(rate_key_hash, attempts)
  values (p_rate_key_hash, 0)
  on conflict (rate_key_hash) do nothing;
  select * into v_rate from public.esp32_pairing_attempts where rate_key_hash = p_rate_key_hash for update;
  if v_rate.blocked_until is not null and v_rate.blocked_until > now() then return false; end if;
  if v_rate.window_started_at < now() - make_interval(secs => p_window_seconds) then
    update public.esp32_pairing_attempts set window_started_at = now(), attempts = 1, blocked_until = null where rate_key_hash = p_rate_key_hash;
    return true;
  end if;
  update public.esp32_pairing_attempts
    set attempts = attempts + 1,
        blocked_until = case when attempts + 1 > p_limit then now() + make_interval(secs => p_block_seconds) else blocked_until end
    where rate_key_hash = p_rate_key_hash
    returning * into v_rate;
  return v_rate.attempts <= p_limit;
end;
$$;

create or replace function public.esp32_claim_next_command(p_device_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.esp32_device_commands%rowtype;
begin
  perform 1 from public.esp32_devices where id = p_device_id for share;
  if not found then return null; end if;

  update public.esp32_device_commands
    set status = 'failed', acknowledged_at = now(), error_message = 'delivery retry limit exceeded'
    where device_id = p_device_id and status = 'in_progress' and attempts >= 5
      and claimed_at < now() - interval '30 seconds';

  select * into v_row
  from public.esp32_device_commands
  where device_id = p_device_id
    and attempts < 5
    and available_at <= now()
    and (
      status = 'queued'
      or (status = 'in_progress' and claimed_at < now() - interval '30 seconds')
    )
  order by created_at
  limit 1
  for update skip locked;

  if v_row.id is null then return null; end if;

  update public.esp32_device_commands
    set status = 'in_progress', claimed_at = now(), attempts = attempts + 1
    where id = v_row.id
    returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.esp32_queue_owned_command(
  p_owner uuid,
  p_device_id uuid,
  p_command_type text,
  p_payload jsonb,
  p_idempotency_key text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row public.esp32_device_commands%rowtype;
begin
  perform 1 from public.esp32_devices
  where id = p_device_id and owner_auth_user_id = p_owner and revoked_at is null
  for update;
  if not found then raise exception 'DEVICE_NOT_FOUND'; end if;

  insert into public.esp32_device_commands(
    device_id, owner_auth_user_id, command_type, payload, idempotency_key
  ) values (
    p_device_id, p_owner, p_command_type, coalesce(p_payload, '{}'::jsonb), p_idempotency_key
  ) returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.esp32_create_gift_invite(
  p_device_id uuid,
  p_sender uuid,
  p_recipient_username text
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_recipient uuid;
  v_invite uuid;
begin
  select auth_user_id into v_recipient
  from public.users
  where username = trim(p_recipient_username)
  limit 1;
  if v_recipient is null then raise exception 'GIFT_RECIPIENT_NOT_FOUND'; end if;
  if v_recipient = p_sender then raise exception 'GIFT_RECIPIENT_IS_SENDER'; end if;

  perform 1 from public.esp32_devices
  where id = p_device_id and owner_auth_user_id = p_sender and revoked_at is null
  for update;
  if not found then raise exception 'DEVICE_NOT_FOUND'; end if;

  update public.esp32_gift_invites
  set status = 'cancelled'
  where device_id = p_device_id and status = 'pending';

  insert into public.esp32_gift_invites(
    device_id, sender_auth_user_id, recipient_auth_user_id, recipient_username
  ) values (
    p_device_id, p_sender, v_recipient, trim(p_recipient_username)
  ) returning id into v_invite;
  return v_invite;
end;
$$;

create or replace function public.esp32_accept_gift(
  p_invite_id uuid,
  p_recipient uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_invite public.esp32_gift_invites%rowtype;
  v_command_id uuid;
begin
  select * into v_invite from public.esp32_gift_invites
  where id = p_invite_id for update;
  if v_invite.id is null or v_invite.recipient_auth_user_id <> p_recipient then
    raise exception 'GIFT_INVITE_NOT_FOUND';
  end if;
  if v_invite.status <> 'pending' or v_invite.expires_at <= now() then
    raise exception 'GIFT_INVITE_EXPIRED';
  end if;

  update public.esp32_devices
  set owner_auth_user_id = p_recipient
  where id = v_invite.device_id
    and owner_auth_user_id = v_invite.sender_auth_user_id
    and revoked_at is null;
  if not found then raise exception 'GIFT_DEVICE_CHANGED'; end if;

  if exists (
    select 1 from public.esp32_device_commands
    where device_id = v_invite.device_id and status = 'in_progress'
  ) then raise exception 'GIFT_DEVICE_BUSY'; end if;

  update public.esp32_device_commands
  set status = 'cancelled', acknowledged_at = now(), error_message = 'cancelled by ownership transfer'
  where device_id = v_invite.device_id and status in ('queued', 'in_progress');

  insert into public.esp32_device_commands(
    device_id, owner_auth_user_id, command_type, payload, idempotency_key
  ) values (
    v_invite.device_id, p_recipient, 'reset_wifi',
    jsonb_build_object('reason', 'gift_transfer', 'inviteId', v_invite.id),
    'gift-reset-' || v_invite.id::text
  ) returning id into v_command_id;

  update public.esp32_gift_invites
  set status = 'wifi_reset_sent', accepted_at = now(), reset_command_id = v_command_id
  where id = v_invite.id;
  return jsonb_build_object('deviceId', v_invite.device_id, 'commandId', v_command_id);
end;
$$;

create or replace function public.esp32_cancel_gift(
  p_invite_id uuid,
  p_sender uuid
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.esp32_gift_invites
  set status = 'cancelled'
  where id = p_invite_id and sender_auth_user_id = p_sender and status = 'pending';
  return found;
end;
$$;

alter table public.esp32_devices enable row level security;
alter table public.esp32_pairing_challenges enable row level security;
alter table public.esp32_pairing_attempts enable row level security;
alter table public.esp32_device_commands enable row level security;
alter table public.esp32_device_events enable row level security;
alter table public.esp32_gift_invites enable row level security;

revoke all on table public.esp32_devices from anon, authenticated;
revoke all on table public.esp32_pairing_challenges from anon, authenticated;
revoke all on table public.esp32_pairing_attempts from anon, authenticated;
revoke all on table public.esp32_device_commands from anon, authenticated;
revoke all on table public.esp32_device_events from anon, authenticated;
revoke all on table public.esp32_gift_invites from anon, authenticated;
grant all on table public.esp32_devices to service_role;
grant all on table public.esp32_pairing_challenges to service_role;
grant all on table public.esp32_pairing_attempts to service_role;
grant all on table public.esp32_device_commands to service_role;
grant all on table public.esp32_device_events to service_role;
grant all on table public.esp32_gift_invites to service_role;
grant usage, select on sequence public.esp32_device_events_id_seq to service_role;

revoke all on function public.esp32_claim_device(text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.esp32_consume_rate_limit(text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.esp32_claim_next_command(uuid) from public, anon, authenticated;
revoke all on function public.esp32_queue_owned_command(uuid, uuid, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.esp32_create_gift_invite(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.esp32_accept_gift(uuid, uuid) from public, anon, authenticated;
revoke all on function public.esp32_cancel_gift(uuid, uuid) from public, anon, authenticated;
grant execute on function public.esp32_claim_device(text, uuid, text, text) to service_role;
grant execute on function public.esp32_consume_rate_limit(text, integer, integer, integer) to service_role;
grant execute on function public.esp32_claim_next_command(uuid) to service_role;
grant execute on function public.esp32_queue_owned_command(uuid, uuid, text, jsonb, text) to service_role;
grant execute on function public.esp32_create_gift_invite(uuid, uuid, text) to service_role;
grant execute on function public.esp32_accept_gift(uuid, uuid) to service_role;
grant execute on function public.esp32_cancel_gift(uuid, uuid) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('esp32-oled-assets', 'esp32-oled-assets', false, 2097152, array['application/octet-stream'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
