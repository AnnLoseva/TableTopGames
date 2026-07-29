alter table public.table_images
  add column if not exists opacity numeric not null default 1,
  add column if not exists blend_mode text not null default 'normal',
  add column if not exists rotation numeric not null default 0,
  add column if not exists flip_x boolean not null default false,
  add column if not exists flip_y boolean not null default false,
  add column if not exists brightness numeric not null default 1,
  add column if not exists contrast numeric not null default 1,
  add column if not exists saturation numeric not null default 1;

alter table public.table_images
  drop constraint if exists table_images_blend_mode_check;

alter table public.table_images
  add constraint table_images_blend_mode_check
  check (blend_mode in (
    'normal',
    'multiply',
    'screen',
    'overlay',
    'darken',
    'lighten',
    'color-dodge',
    'color-burn',
    'hard-light',
    'soft-light',
    'difference',
    'luminosity'
  ));

alter table public.table_images
  drop constraint if exists table_images_media_adjustments_check;

alter table public.table_images
  add constraint table_images_media_adjustments_check
  check (
    opacity between 0 and 1
    and brightness between 0 and 3
    and contrast between 0 and 3
    and saturation between 0 and 4
  );
