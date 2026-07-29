-- Night overview private notes and plot hooks.
-- Depends on games/vampires/supabase/master_console_persistence.sql.

create table if not exists public.master_session_notes (
  id uuid primary key default gen_random_uuid(),
  chronicle_id uuid not null references public.chronicles(id) on delete cascade,
  room text not null,
  session_id uuid null references public.chronicle_sessions(id) on delete set null,
  title text not null default '',
  body_html text not null default '',
  entity_type text not null default '',
  entity_id text not null default '',
  visibility text not null default 'master',
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint master_session_notes_visibility_check check (visibility in ('master', 'shared')),
  constraint master_session_notes_title_check check (length(title) <= 200)
);

create index if not exists master_session_notes_room_updated_idx
  on public.master_session_notes (room, updated_at desc);

create table if not exists public.master_plot_hooks (
  id uuid primary key default gen_random_uuid(),
  chronicle_id uuid not null references public.chronicles(id) on delete cascade,
  room text not null,
  title text not null,
  next_step text not null default '',
  heat text not null default 'background',
  status text not null default 'active',
  related_actor_ids text[] not null default '{}'::text[],
  related_location_ids text[] not null default '{}'::text[],
  related_session_ids text[] not null default '{}'::text[],
  lore_entry_id text not null default '',
  sort_order integer not null default 0,
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint master_plot_hooks_title_check check (length(trim(title)) between 1 and 200),
  constraint master_plot_hooks_heat_check
    check (heat in ('background', 'smoldering', 'boiling', 'critical')),
  constraint master_plot_hooks_status_check
    check (status in ('active', 'resolved', 'archived'))
);

create index if not exists master_plot_hooks_room_status_idx
  on public.master_plot_hooks (room, status, sort_order);

create or replace function public.enforce_master_overview_scope()
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

revoke all on function public.enforce_master_overview_scope() from public;

drop trigger if exists master_session_notes_scope_guard on public.master_session_notes;
create trigger master_session_notes_scope_guard
before insert or update on public.master_session_notes
for each row execute function public.enforce_master_overview_scope();

drop trigger if exists master_plot_hooks_scope_guard on public.master_plot_hooks;
create trigger master_plot_hooks_scope_guard
before insert or update on public.master_plot_hooks
for each row execute function public.enforce_master_overview_scope();

alter table public.master_session_notes enable row level security;
alter table public.master_plot_hooks enable row level security;

revoke all on public.master_session_notes from anon;
revoke all on public.master_plot_hooks from anon;
grant select, insert, update, delete on public.master_session_notes to authenticated;
grant select, insert, update, delete on public.master_plot_hooks to authenticated;

drop policy if exists "Masters manage session notes" on public.master_session_notes;
create policy "Masters manage session notes" on public.master_session_notes
for all to authenticated
using (public.is_chronicle_master(chronicle_id))
with check (public.is_chronicle_master(chronicle_id));

drop policy if exists "Masters manage plot hooks" on public.master_plot_hooks;
create policy "Masters manage plot hooks" on public.master_plot_hooks
for all to authenticated
using (public.is_chronicle_master(chronicle_id))
with check (public.is_chronicle_master(chronicle_id));
