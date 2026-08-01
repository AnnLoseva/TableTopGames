-- Background candidates remain table_images rows so an uploaded or existing
-- image can be reused as a scene background without duplicating its Storage
-- object. Candidates are kept off-canvas (`on_table = false`) and rendered by
-- the Layers panel's dedicated Background group.
alter table public.table_images
  add column if not exists is_background boolean not null default false;

create index if not exists table_images_room_scene_background_idx
  on public.table_images (room, scene_id)
  where is_background;
