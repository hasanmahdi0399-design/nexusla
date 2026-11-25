-- NEXUS revamp: username-only login, Messenger-style DMs, Facebook-style profiles.
-- Run after 006_final_security.sql. Safe to run more than once.

-- 1. Realtime: the original migrations never switched it on for these tables.
--    Needed for live messages, "Seen" receipts and unread badges.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- 2. Photos in direct messages (text is still limited to 5000 characters).
alter table public.messages add column if not exists image_url text;
alter table public.messages alter column body set default '';
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages add constraint messages_body_check check (char_length(body) <= 5000);
alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages add constraint messages_content_check check (char_length(body) > 0 or image_url is not null);

-- 3. Usernames up to 24 characters (the old trigger cut them to 18, which would
--    break username-only login). The login e-mail is derived from the username.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer
set search_path = public
as $$
declare
  raw_username text;
  clean_username text;
  final_username text;
  new_code text;
begin
  raw_username := coalesce(new.raw_user_meta_data->>'username', 'player');
  clean_username := lower(regexp_replace(raw_username, '[^a-zA-Z0-9_]', '', 'g'));
  clean_username := left(clean_username, 24);
  if length(clean_username) < 3 then clean_username := 'player'; end if;

  final_username := clean_username;
  while exists(select 1 from public.profiles where username = final_username) loop
    final_username := left(clean_username, 23) || floor(random()*10)::int::text;
  end loop;

  new_code := 'USR-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
  while exists(select 1 from public.profiles where user_code = new_code) loop
    new_code := 'USR-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
  end loop;

  insert into public.profiles(id, username, user_code, display_name)
  values(new.id, final_username, new_code,
         left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), final_username), 40));
  return new;
end;
$$;

-- 4. Bigger uploads: phone photos / animated GIF banners (5 MB).
update storage.buckets set file_size_limit = 5242880 where id = 'media';

-- 5. People can always see the profile of someone they have messaged, even if
--    that person later set their profile to private (so chats never "vanish").
drop policy if exists profiles_read_dm_peers on public.profiles;
create policy profiles_read_dm_peers on public.profiles for select to authenticated
using (exists (
  select 1 from public.messages m
  where (m.sender_id = auth.uid() and m.receiver_id = profiles.id)
     or (m.receiver_id = auth.uid() and m.sender_id = profiles.id)
));

-- 6. Friends: anyone can see who is friends with whom (like a Facebook friends list),
--    and either friend can unfriend.
drop policy if exists friend_requests_read_accepted on public.friend_requests;
create policy friend_requests_read_accepted on public.friend_requests for select to authenticated
using (status = 'accepted');

drop policy if exists friend_requests_delete_friend on public.friend_requests;
create policy friend_requests_delete_friend on public.friend_requests for delete to authenticated
using ((requester_id = auth.uid() or recipient_id = auth.uid()) and status = 'accepted');
grant delete on public.friend_requests to authenticated;

-- 7. Profile text limits.
alter table public.profiles drop constraint if exists profiles_text_limits;
alter table public.profiles add constraint profiles_text_limits
  check (char_length(display_name) <= 40 and char_length(bio) <= 500) not valid;

-- 8. Optional: clean up expired stories every hour (needs the pg_cron extension enabled in Supabase).
-- select cron.schedule('nexus-expired-stories', '0 * * * *', $$delete from public.stories where expires_at < now()$$);
