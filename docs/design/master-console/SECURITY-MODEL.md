# Security model и аудит текущего состояния

## Фактическая авторизация сегодня

React-клиент создаётся с публичным anon key (`src/games/vampires/lib/supabase.ts`). Регистрация и
login работают напрямую с `public.users`: браузер кодирует пароль через `btoa`,
сравнивает `username + password_hash` в публичном select и сохраняет `{id,
username}` в `vtm-chat-user`/`vtm-sheet-user`. Это не Supabase Auth session,
поэтому запросы не несут trustworthy `auth.uid()`.

Мастер в `/vampires/table` определяется `role` из URL/localStorage и паролем из
`vtm-table-master-password`; значение по умолчанию `1234`, а проверка полностью
клиентская. Любой пользователь может изменить эти значения. Это UI gate, не
authorization boundary.

## Что может anon-клиент

SQL в репозитории включает RLS, но политики `to public using (true)` /
`with check (true)` и grants делают её разрешительной:

- `users`: anon может читать все строки, включая поле, необходимое браузерному
  password lookup, регистрировать и обновлять записи;
- `characters`: anon может читать, создавать, менять и удалять любые строки;
- `table_rolls`, `table_chat_messages`, `table_images`, `table_scenes`,
  `table_scene_music`, `table_music`, `table_music_library`: публичное чтение и
  в большинстве случаев публичное изменение;
- buckets `table-images`, `table-music`, `character-portraits` публично читаемы,
  а SQL даёт public upload/update/delete;
- realtime publication содержит общие table rows, а `table-room:<room>`
  broadcast не является приватным авторизованным каналом.

`media_studio_layers.sql` только добавляет колонки/constraints к
`table_images`; отдельной защиты он не создаёт. Состояние реально применённых в
live Supabase миграций этим repo-аудитом не доказано, но repository contract уже
не позволяет обещать приватность.

## Можно ли сделать мастерские данные приватными без изменения auth

Нет. Случайный room id, URL role, localStorage, скрытый React-компонент, anon RLS
и фильтр `owner_role='master'` не дают проверяемой identity. Даже отдельная
master table с permissive anon policy будет читаться напрямую через REST и
подписываться через Realtime. Edge/API proxy с общим клиентским паролем также не
решает membership и ротацию безопасно.

## Минимальная security foundation

1. Ввести Supabase Auth (или эквивалентную server-verified identity); не хранить
   пароль/хэш в browser-readable `public.users`.
2. Добавить `chronicles` и `chronicle_members(user_id, chronicle_id, role)` с
   master-managed membership. `room` — lookup/slug, не credential.
3. Переписать RLS: `auth.uid()` + membership predicates; запретить anon writes и
   чтение master tables; определить observer отдельно.
4. Разделить master rows и player-safe published projections. Не полагаться на
   column hiding в строке, доступной игроку.
5. Выполнять publish/reveal/mass macro/undo через проверяемые transaction RPC или
   server actions, которые выводят actor identity из JWT и пишут action log.
6. Разделить Realtime subscriptions: игрок физически не может SELECT master
   rows; private broadcast использует authorized/private channel либо только
   postgres_changes под RLS. Проверить фактическое поведение Realtime с JWT.
7. Сделать storage private для master assets, выдавать signed URLs после
   membership check; опубликованные assets копировать/переводить в player-safe
   bucket осознанной командой.
8. Мигрировать существующих пользователей/персонажей с rollback plan; до
   завершения миграции сохранить текущие flows в compatibility window, но не
   запускать master secrets.

## Security acceptance gate

До production UI нужны automated integration tests на две хроники и пять
контекстов (anon, outsider, player, observer, master). Player/outsider должны
получать zero rows и zero realtime events для каждого private entity, не только
403 в UI. Нужны негативные тесты direct REST, guessed room, forged role,
cross-room ids, storage paths, RPC и realtime subscribe. Только после этого
можно считать принцип «private by default» выполненным.

## Реализованная persistence foundation

`src/games/vampires/supabase/master_console_persistence.sql` определяет `chronicles`,
`chronicle_members` и master-only таблицы. Их RLS опирается только на
`auth.uid()` и membership role; anon privileges отозваны. Первичная chronicle и
первый master назначаются service role/администратором — self-claim комнаты не
разрешён. Это безопасный schema-контракт, но он не означает, что legacy login уже
мигрирован: текущий `/vampires/master` localStorage gate не получает persistence-доступ,
пока браузер не имеет настоящей Supabase Auth session.
