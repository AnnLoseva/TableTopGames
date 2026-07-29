-- Master-only storage for hidden rolls.
-- Depends on src/games/vampires/supabase/master_console_persistence.sql (is_chronicle_master).
-- Public /table rolls stay in table_rolls with the same RollMessage shape.
-- Players never SELECT these rows and must not subscribe to this table.

create table if not exists public.master_hidden_rolls (
  id text primary key,
  chronicle_id uuid not null references public.chronicles(id) on delete cascade,
  room text not null,
  roll_json jsonb not null,
  revealed_at timestamptz null,
  revealed_public_roll_id text null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint master_hidden_rolls_json_object check (jsonb_typeof(roll_json) = 'object')
);

create index if not exists master_hidden_rolls_room_created_at_idx
  on public.master_hidden_rolls (room, created_at desc)
  where revealed_at is null;

create or replace function public.enforce_master_hidden_roll_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_room text;
begin
  select chronicles.room into expected_room
  from public.chronicles
  where chronicles.id = new.chronicle_id;

  if expected_room is null or new.room <> expected_room then
    raise exception 'room does not match chronicle_id';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_master_hidden_roll_scope() from public;

drop trigger if exists master_hidden_rolls_scope_guard on public.master_hidden_rolls;
create trigger master_hidden_rolls_scope_guard
before insert or update on public.master_hidden_rolls
for each row execute function public.enforce_master_hidden_roll_scope();

alter table public.master_hidden_rolls enable row level security;

revoke all on public.master_hidden_rolls from anon;
grant select, insert, update, delete on public.master_hidden_rolls to authenticated;

drop policy if exists "Masters can read hidden rolls" on public.master_hidden_rolls;
create policy "Masters can read hidden rolls" on public.master_hidden_rolls
for select to authenticated using (public.is_chronicle_master(chronicle_id));

drop policy if exists "Masters can insert hidden rolls" on public.master_hidden_rolls;
create policy "Masters can insert hidden rolls" on public.master_hidden_rolls
for insert to authenticated
with check (public.is_chronicle_master(chronicle_id) and created_by = auth.uid());

drop policy if exists "Masters can update hidden rolls" on public.master_hidden_rolls;
create policy "Masters can update hidden rolls" on public.master_hidden_rolls
for update to authenticated
using (public.is_chronicle_master(chronicle_id))
with check (public.is_chronicle_master(chronicle_id));

drop policy if exists "Masters can delete hidden rolls" on public.master_hidden_rolls;
create policy "Masters can delete hidden rolls" on public.master_hidden_rolls
for delete to authenticated using (public.is_chronicle_master(chronicle_id));

-- Intentionally NOT added to supabase_realtime publication for anon clients.
-- Masters may subscribe via filtered postgres_changes after Auth membership.
