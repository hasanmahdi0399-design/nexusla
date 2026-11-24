-- NEXUS community features: friends, expiring stories, seller reviews.
-- Run after 004_security_notifications.sql.

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> recipient_id),
  unique(requester_id, recipient_id)
);
alter table public.friend_requests drop constraint if exists friend_requests_requester_id_recipient_id_key;
create unique index if not exists friend_requests_one_active_pair on public.friend_requests(requester_id,recipient_id) where status in ('pending','accepted');
create index if not exists friend_requests_recipient_idx on public.friend_requests(recipient_id,status,created_at desc);
create index if not exists friend_requests_requester_idx on public.friend_requests(requester_id,status,created_at desc);
alter table public.friend_requests enable row level security;
drop policy if exists friend_requests_read_participant on public.friend_requests;
create policy friend_requests_read_participant on public.friend_requests for select to authenticated
using (requester_id=auth.uid() or recipient_id=auth.uid());
drop policy if exists friend_requests_insert_requester on public.friend_requests;
create policy friend_requests_insert_requester on public.friend_requests for insert to authenticated
with check (requester_id=auth.uid() and public.is_active_user() and not exists (
  select 1 from public.blocks b where (b.blocker_id=requester_id and b.blocked_id=recipient_id)
    or (b.blocker_id=recipient_id and b.blocked_id=requester_id)
));
drop policy if exists friend_requests_update_participant on public.friend_requests;
create policy friend_requests_update_participant on public.friend_requests for update to authenticated
using ((recipient_id=auth.uid() and status='pending') or (requester_id=auth.uid() and status='pending'))
with check (
  (recipient_id=auth.uid() and status in ('accepted','declined'))
  or (requester_id=auth.uid() and status='cancelled')
);
grant select,insert,update on public.friend_requests to authenticated;

create or replace function public.notify_friend_request()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare actor_name text;
begin
  select username into actor_name from public.profiles where id=new.requester_id;
  insert into public.notifications(user_id,actor_id,kind,data)
  values(new.recipient_id,new.requester_id,'friend_request',jsonb_build_object('who',actor_name,'request_id',new.id));
  return new;
end; $$;
drop trigger if exists nexus_friend_request_notification on public.friend_requests;
create trigger nexus_friend_request_notification after insert on public.friend_requests
for each row execute function public.notify_friend_request();

create or replace function public.notify_friend_accepted()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare actor_name text;
begin
  if old.status='pending' and new.status='accepted' then
    select username into actor_name from public.profiles where id=new.recipient_id;
    insert into public.notifications(user_id,actor_id,kind,data)
    values(new.requester_id,new.recipient_id,'friend_accepted',jsonb_build_object('who',actor_name));
  end if;
  return new;
end; $$;
drop trigger if exists nexus_friend_accepted_notification on public.friend_requests;
create trigger nexus_friend_accepted_notification after update of status on public.friend_requests
for each row execute function public.notify_friend_accepted();

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  media_url text not null,
  caption text not null default '' check (char_length(caption)<=300),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now()+interval '24 hours')
);
create index if not exists stories_expiry_idx on public.stories(expires_at desc);
alter table public.stories enable row level security;
drop policy if exists stories_read_active on public.stories;
create policy stories_read_active on public.stories for select to authenticated
using (expires_at>now() and (exists(select 1 from public.profiles p where p.id=author_id and p.profile_visibility='public') or author_id=auth.uid() or public.is_staff()));
drop policy if exists stories_insert_self on public.stories;
create policy stories_insert_self on public.stories for insert to authenticated
with check (author_id=auth.uid() and public.is_active_user() and expires_at<=now()+interval '25 hours' and expires_at>now());
drop policy if exists stories_delete_self_staff on public.stories;
create policy stories_delete_self_staff on public.stories for delete to authenticated
using (author_id=auth.uid() or public.is_staff());
grant select,insert,delete on public.stories to authenticated;

create table if not exists public.seller_reviews (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  body text not null default '' check (char_length(body)<=1200),
  created_at timestamptz not null default now(),
  check (seller_id<>reviewer_id),
  unique(seller_id,reviewer_id)
);
create index if not exists seller_reviews_seller_idx on public.seller_reviews(seller_id,created_at desc);
alter table public.seller_reviews enable row level security;
drop policy if exists seller_reviews_read on public.seller_reviews;
create policy seller_reviews_read on public.seller_reviews for select to authenticated using (true);
drop policy if exists seller_reviews_insert_after_contact on public.seller_reviews;
create policy seller_reviews_insert_after_contact on public.seller_reviews for insert to authenticated
with check (
 reviewer_id=auth.uid() and public.is_active_user() and exists(
   select 1 from public.messages m where
   ((m.sender_id=auth.uid() and m.receiver_id=seller_id) or (m.sender_id=seller_id and m.receiver_id=auth.uid()))
 )
);
drop policy if exists seller_reviews_update_owner on public.seller_reviews;
create policy seller_reviews_update_owner on public.seller_reviews for update to authenticated
using (reviewer_id=auth.uid()) with check (reviewer_id=auth.uid());
drop policy if exists seller_reviews_delete_owner_staff on public.seller_reviews;
create policy seller_reviews_delete_owner_staff on public.seller_reviews for delete to authenticated
using (reviewer_id=auth.uid() or public.is_staff());
grant select,insert,update,delete on public.seller_reviews to authenticated;

-- Clean up expired stories regularly with Supabase Cron if enabled:
-- select cron.schedule('nexus-expired-stories','0 * * * *', $$delete from public.stories where expires_at < now()$$);
