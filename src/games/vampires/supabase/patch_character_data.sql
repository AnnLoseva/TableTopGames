-- Atomic character data patching for legacy sheet autosave.
--
-- Merge semantics match public/supabase.js mergeCharacterPatch:
-- objects are merged recursively; arrays, scalars, and JSON null replace whole
-- values. The patch RPC filters by both character id and app user id because the
-- browser currently uses the anon key plus the app's own users table.

create or replace function public.vtm_jsonb_deep_merge(a jsonb, b jsonb)
returns jsonb
language sql
immutable
as $$
  select
    case
      when b is null then
        case when jsonb_typeof(a) = 'object' then a else '{}'::jsonb end
      when jsonb_typeof(b) <> 'object' then b
      else (
        case when jsonb_typeof(a) = 'object' then a else '{}'::jsonb end
      ) || coalesce((
        select jsonb_object_agg(
          patch.key,
          case
            when jsonb_typeof(a -> patch.key) = 'object'
              and jsonb_typeof(patch.value) = 'object'
              then public.vtm_jsonb_deep_merge(a -> patch.key, patch.value)
            else patch.value
          end
        )
        from jsonb_each(b) as patch(key, value)
      ), '{}'::jsonb)
    end;
$$;

create or replace function public.vtm_patch_character_data(
  p_id uuid,
  p_user_id uuid,
  p_patch jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  patched_data jsonb;
begin
  update public.characters
  set data = public.vtm_jsonb_deep_merge(data, coalesce(p_patch, '{}'::jsonb))
  where id = p_id
    and user_id = p_user_id
  returning data into patched_data;

  if patched_data is null then
    raise exception 'Character % was not found for user %', p_id, p_user_id
      using errcode = 'P0002';
  end if;

  return patched_data;
end;
$$;

revoke all on function public.vtm_jsonb_deep_merge(jsonb, jsonb) from public;
revoke all on function public.vtm_patch_character_data(uuid, uuid, jsonb) from public;

grant execute on function public.vtm_jsonb_deep_merge(jsonb, jsonb) to anon, authenticated;
grant execute on function public.vtm_patch_character_data(uuid, uuid, jsonb) to anon, authenticated;

do $$
declare
  result jsonb;
begin
  result := public.vtm_jsonb_deep_merge(
    '{"nested":{"keep":1},"top":true}'::jsonb,
    '{"nested":{"add":2}}'::jsonb
  );
  if result <> '{"nested":{"keep":1,"add":2},"top":true}'::jsonb then
    raise exception 'vtm_jsonb_deep_merge object merge failed: %', result;
  end if;

  result := public.vtm_jsonb_deep_merge(
    '{"list":[1,2],"keep":true}'::jsonb,
    '{"list":[3]}'::jsonb
  );
  if result <> '{"list":[3],"keep":true}'::jsonb then
    raise exception 'vtm_jsonb_deep_merge array replacement failed: %', result;
  end if;

  result := public.vtm_jsonb_deep_merge(
    '{"value":{"old":true},"keep":true}'::jsonb,
    '{"value":7}'::jsonb
  );
  if result <> '{"value":7,"keep":true}'::jsonb then
    raise exception 'vtm_jsonb_deep_merge scalar replacement failed: %', result;
  end if;

  result := public.vtm_jsonb_deep_merge(
    '{"value":{"old":true},"keep":true}'::jsonb,
    '{"value":null}'::jsonb
  );
  if result <> '{"value":null,"keep":true}'::jsonb then
    raise exception 'vtm_jsonb_deep_merge null replacement failed: %', result;
  end if;
end $$;
