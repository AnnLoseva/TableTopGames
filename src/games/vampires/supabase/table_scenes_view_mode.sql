-- Per-scene view mode: 'table' clamps player pan/zoom to the stage rectangle,
-- 'free' lets players pan anywhere. Master is never clamped. Defaults to
-- 'table' (today's existing behavior) so old scenes keep working unchanged.
alter table public.table_scenes
  add column if not exists view_mode text not null default 'table';

alter table public.table_scenes
  drop constraint if exists table_scenes_view_mode_check;

alter table public.table_scenes
  add constraint table_scenes_view_mode_check check (view_mode in ('table', 'free'));
