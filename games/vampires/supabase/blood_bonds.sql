-- Blood bonds domain (master-only).
-- Depends on games/vampires/supabase/master_console_persistence.sql and chronicle_actors.

create table if not exists public.blood_bonds (
  id uuid primary key default gen_random_uuid(),
  chronicle_id uuid not null references public.chronicles(id) on delete cascade,
  room text not null,
  thrall_actor_id uuid not null references public.chronicle_actors(id) on delete cascade,
  regnant_actor_id uuid not null references public.chronicle_actors(id) on delete cascade,
  level integer not null default 1,
  drinks_count integer not null default 0,
  first_drink_at timestamptz null,
  last_drink_at timestamptz null,
  expires_at timestamptz null,
  status text not null default 'active',
  visibility text not null default 'master',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blood_bonds_level_check check (level between 1 and 3),
  constraint blood_bonds_drinks_check check (drinks_count >= 0),
  constraint blood_bonds_not_self check (thrall_actor_id <> regnant_actor_id),
  constraint blood_bonds_status_check check (status in ('active', 'inactive', 'broken')),
  constraint blood_bonds_visibility_check check (visibility in ('master', 'shared'))
);

-- At most one active bond per thrall→regnant direction.
create unique index if not exists blood_bonds_active_pair_unique_idx
  on public.blood_bonds (chronicle_id, thrall_actor_id, regnant_actor_id)
  where status = 'active';

create index if not exists blood_bonds_room_status_idx
  on public.blood_bonds (room, status, updated_at desc);
create index if not exists blood_bonds_thrall_idx
  on public.blood_bonds (thrall_actor_id);
create index if not exists blood_bonds_regnant_idx
  on public.blood_bonds (regnant_actor_id);

create table if not exists public.blood_bond_events (
  id uuid primary key default gen_random_uuid(),
  bond_id uuid not null references public.blood_bonds(id) on delete cascade,
  chronicle_id uuid not null references public.chronicles(id) on delete cascade,
  room text not null,
  event_type text not null,
  previous_level integer null,
  new_level integer null,
  occurred_at timestamptz not null default now(),
  session_id uuid null references public.chronicle_sessions(id) on delete set null,
  note text not null default '',
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint blood_bond_events_type_check check (event_type in (
    'created', 'drink', 'level_up', 'level_down', 'break', 'deactivate', 'reactivate', 'note', 'corrective'
  ))
  -- Append-only: no update/delete for clients (see grants).
);

create index if not exists blood_bond_events_bond_occurred_idx
  on public.blood_bond_events (bond_id, occurred_at desc);
create index if not exists blood_bond_events_room_occurred_idx
  on public.blood_bond_events (room, occurred_at desc);

create or replace function public.enforce_blood_bond_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_room text;
  thrall_room text;
  regnant_room text;
  thrall_chronicle uuid;
  regnant_chronicle uuid;
begin
  select chronicles.room into expected_room
  from public.chronicles
  where chronicles.id = new.chronicle_id;
  if expected_room is null or new.room <> expected_room then
    raise exception 'room does not match chronicle_id';
  end if;

  if tg_table_name = 'blood_bonds' then
    select actors.room, actors.chronicle_id into thrall_room, thrall_chronicle
    from public.chronicle_actors actors where actors.id = new.thrall_actor_id;
    select actors.room, actors.chronicle_id into regnant_room, regnant_chronicle
    from public.chronicle_actors actors where actors.id = new.regnant_actor_id;
    if thrall_room is null or regnant_room is null then
      raise exception 'thrall/regnant actor missing';
    end if;
    if thrall_room <> new.room or regnant_room <> new.room
      or thrall_chronicle <> new.chronicle_id or regnant_chronicle <> new.chronicle_id then
      raise exception 'actors must belong to the same chronicle/room';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_blood_bond_scope() from public;

drop trigger if exists blood_bonds_scope_guard on public.blood_bonds;
create trigger blood_bonds_scope_guard
before insert or update on public.blood_bonds
for each row execute function public.enforce_blood_bond_scope();

drop trigger if exists blood_bond_events_scope_guard on public.blood_bond_events;
create trigger blood_bond_events_scope_guard
before insert or update on public.blood_bond_events
for each row execute function public.enforce_blood_bond_scope();

alter table public.blood_bonds enable row level security;
alter table public.blood_bond_events enable row level security;

revoke all on public.blood_bonds from anon;
revoke all on public.blood_bond_events from anon;
grant select, insert, update on public.blood_bonds to authenticated;
-- No DELETE grant: break via status, not history wipe.
grant select, insert on public.blood_bond_events to authenticated;

drop policy if exists "Masters manage blood bonds" on public.blood_bonds;
create policy "Masters manage blood bonds" on public.blood_bonds
for all to authenticated
using (public.is_chronicle_master(chronicle_id))
with check (public.is_chronicle_master(chronicle_id));

drop policy if exists "Masters read bond events" on public.blood_bond_events;
create policy "Masters read bond events" on public.blood_bond_events
for select to authenticated
using (public.is_chronicle_master(chronicle_id));

drop policy if exists "Masters insert bond events" on public.blood_bond_events;
create policy "Masters insert bond events" on public.blood_bond_events
for insert to authenticated
with check (public.is_chronicle_master(chronicle_id) and created_by = auth.uid());
