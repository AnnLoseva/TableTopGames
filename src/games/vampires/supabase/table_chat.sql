create table if not exists public.table_chat_messages (
  id text primary key,
  room text not null,
  user_id text not null,
  username text not null,
  character_id text null,
  character_name text not null,
  character_image text not null default '',
  message text not null check (char_length(trim(message)) > 0 and char_length(message) <= 4000),
  created_at timestamptz not null default now()
);

alter table public.table_chat_messages
  add column if not exists character_image text not null default '';

create index if not exists table_chat_messages_room_created_at_idx
  on public.table_chat_messages (room, created_at desc);

alter table public.table_chat_messages enable row level security;

drop policy if exists "Anyone can read table chat messages" on public.table_chat_messages;
create policy "Anyone can read table chat messages"
  on public.table_chat_messages
  for select
  using (true);

drop policy if exists "Anyone can create table chat messages" on public.table_chat_messages;
create policy "Anyone can create table chat messages"
  on public.table_chat_messages
  for insert
  with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'table_chat_messages'
  ) then
    alter publication supabase_realtime add table public.table_chat_messages;
  end if;
end $$;
