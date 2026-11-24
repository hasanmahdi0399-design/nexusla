-- NEXUS hardening + automatic notifications. Run after 003_admin.sql.
-- This migration does not add group chats or any payment processing.

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'active'
  );
$$;

-- Suspended/banned accounts may still read content, but cannot create or
-- modify marketplace/social activity. Staff permissions remain role-checked.
drop policy if exists listings_update_owner_or_staff on public.listings;
create policy listings_update_owner_or_staff on public.listings
for update to authenticated
using ((seller_id = auth.uid() and public.is_active_user()) or public.is_staff())
with check ((seller_id = auth.uid() and public.is_active_user()) or public.is_staff());

drop policy if exists listing_media_insert_owner on public.listing_media;
create policy listing_media_insert_owner on public.listing_media
for insert to authenticated
with check (
  public.is_active_user()
  and exists(select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid())
);

drop policy if exists posts_insert_self on public.posts;
create policy posts_insert_self on public.posts
for insert to authenticated
with check (author_id = auth.uid() and public.is_active_user());

drop policy if exists posts_update_self on public.posts;
create policy posts_update_self on public.posts
for update to authenticated
using ((author_id = auth.uid() and public.is_active_user()) or public.is_staff())
with check ((author_id = auth.uid() and public.is_active_user()) or public.is_staff());

drop policy if exists reactions_insert_self on public.reactions;
create policy reactions_insert_self on public.reactions
for insert to authenticated
with check (user_id = auth.uid() and public.is_active_user());

drop policy if exists comments_insert_self on public.comments;
create policy comments_insert_self on public.comments
for insert to authenticated
with check (author_id = auth.uid() and public.is_active_user());

drop policy if exists follows_insert_self on public.follows;
create policy follows_insert_self on public.follows
for insert to authenticated
with check (follower_id = auth.uid() and follower_id <> followee_id and public.is_active_user());

drop policy if exists messages_insert_sender on public.messages;
create policy messages_insert_sender on public.messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and public.is_active_user()
  and not exists (
    select 1 from public.blocks b
    where (b.blocker_id = receiver_id and b.blocked_id = sender_id)
       or (b.blocker_id = sender_id and b.blocked_id = receiver_id)
  )
);

drop policy if exists reports_insert_self on public.reports;
create policy reports_insert_self on public.reports
for insert to authenticated
with check (reporter_id = auth.uid() and public.is_active_user());

-- Storage upload is limited to active accounts and their own UID folder.
drop policy if exists nexus_media_upload_own_folder on storage.objects;
create policy nexus_media_upload_own_folder on storage.objects
for insert to authenticated
with check (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_active_user()
);

drop policy if exists nexus_media_update_own_folder on storage.objects;
create policy nexus_media_update_own_folder on storage.objects
for update to authenticated
using (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_active_user()
)
with check (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_active_user()
);

-- Notification helpers run as database-owned code, not with client-supplied
-- privileges. They never expose message contents in notification payloads.
create or replace function public.notify_reaction()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare recipient uuid; actor_name text;
begin
  select author_id into recipient from public.posts where id = new.post_id;
  if recipient is not null and recipient <> new.user_id then
    select username into actor_name from public.profiles where id = new.user_id;
    insert into public.notifications(user_id, actor_id, kind, data)
    values(recipient, new.user_id, 'reaction', jsonb_build_object('who', actor_name, 'post_id', new.post_id));
  end if;
  return new;
end;
$$;

drop trigger if exists nexus_reaction_notification on public.reactions;
create trigger nexus_reaction_notification after insert on public.reactions
for each row execute function public.notify_reaction();

create or replace function public.notify_comment()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare recipient uuid; actor_name text;
begin
  select author_id into recipient from public.posts where id = new.post_id;
  if recipient is not null and recipient <> new.author_id then
    select username into actor_name from public.profiles where id = new.author_id;
    insert into public.notifications(user_id, actor_id, kind, data)
    values(recipient, new.author_id, 'comment', jsonb_build_object('who', actor_name, 'post_id', new.post_id, 'comment_id', new.id));
  end if;
  return new;
end;
$$;

drop trigger if exists nexus_comment_notification on public.comments;
create trigger nexus_comment_notification after insert on public.comments
for each row execute function public.notify_comment();

create or replace function public.notify_follow()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare actor_name text;
begin
  select username into actor_name from public.profiles where id = new.follower_id;
  insert into public.notifications(user_id, actor_id, kind, data)
  values(new.followee_id, new.follower_id, 'follow', jsonb_build_object('who', actor_name));
  return new;
end;
$$;

drop trigger if exists nexus_follow_notification on public.follows;
create trigger nexus_follow_notification after insert on public.follows
for each row execute function public.notify_follow();

create or replace function public.notify_message()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare actor_name text;
begin
  select username into actor_name from public.profiles where id = new.sender_id;
  insert into public.notifications(user_id, actor_id, kind, data)
  values(new.receiver_id, new.sender_id, 'message', jsonb_build_object('who', actor_name));
  return new;
end;
$$;

drop trigger if exists nexus_message_notification on public.messages;
create trigger nexus_message_notification after insert on public.messages
for each row execute function public.notify_message();

-- Clients can read/update their own notifications, but cannot forge them.
revoke insert on public.notifications from anon, authenticated;
