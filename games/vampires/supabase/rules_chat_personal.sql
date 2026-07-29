-- Личные данные для чата-библиотекаря. Applied 2026-07-13.
--
-- Изоляция: get_my_characters — единственный путь чата к листам персонажей.
-- security definer + фильтр по auth.uid(); параметров нет, значит запросить
-- чужие данные технически невозможно. Дневник игрока чат читает из
-- localStorage на устройстве игрока и никуда не отправляет.

create or replace function public.get_my_characters()
returns table (id uuid, name text, clan text, data jsonb)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, c.clan, c.data
  from public.characters c
  join public.users u on u.id = c.user_id
  where u.auth_user_id is not null
    and u.auth_user_id = auth.uid()
  order by c.created_at desc;
$$;

revoke all on function public.get_my_characters() from public;
revoke all on function public.get_my_characters() from anon;
grant execute on function public.get_my_characters() to authenticated;
