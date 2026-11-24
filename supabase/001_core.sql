-- NEXUS core schema. Run this first in Supabase SQL Editor.
-- Designed to match the currently supplied React components.
create extension if not exists pgcrypto;

create or replace function public.is_admin()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','moderator') and status = 'active'
  );
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  user_code text not null unique,
  display_name text not null default '',
  bio text not null default '',
  avatar_url text,
  banner_url text,
  game_nick text,
  server text,
  region text,
  camp_name text,
  role text not null default 'user' check (role in ('user','moderator','admin')),
  status text not null default 'active' check (status in ('active','suspended','banned')),
  profile_visibility text not null default 'public' check (profile_visibility in ('public','private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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
  clean_username := left(clean_username, 18);
  if length(clean_username) < 3 then clean_username := 'player'; end if;

  final_username := clean_username;
  while exists(select 1 from public.profiles where username = final_username) loop
    final_username := left(clean_username, 17) || floor(random()*10)::int::text;
  end loop;

  new_code := 'USR-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
  while exists(select 1 from public.profiles where user_code = new_code) loop
    new_code := 'USR-' || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
  end loop;

  insert into public.profiles(id, username, user_code, display_name)
  values(new.id, final_username, new_code, coalesce(new.raw_user_meta_data->>'display_name', final_username));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Prevent a normal user from elevating their role or changing account status.
create or replace function public.protect_profile_privileges()
returns trigger language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.status := old.status;
    new.user_code := old.user_code;
    new.id := old.id;
    new.username := old.username;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists protect_profile_privileges_trigger on public.profiles;
create trigger protect_profile_privileges_trigger
before update on public.profiles
for each row execute procedure public.protect_profile_privileges();

create table if not exists public.listing_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_zh text not null default '',
  name_id text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  description text not null default '',
  category_id uuid references public.listing_categories(id) on delete set null,
  type text not null default 'sale' check (type in ('sale','wanted','trade','giveaway')),
  price numeric(12,2) check (price is null or price >= 0),
  currency text not null default 'In-game',
  server text not null default '',
  region text not null default '',
  status text not null default 'available' check (status in ('available','sold','reserved','unavailable','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.listing_media (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  url text not null,
  position integer not null default 0 check (position between 0 and 4),
  created_at timestamptz not null default now(),
  unique(listing_id, position)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(body) <= 10000)
);

create table if not exists public.reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id, user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 3000),
  created_at timestamptz not null default now()
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(follower_id, followee_id),
  check(follower_id <> followee_id)
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(blocker_id, blocked_id),
  check(blocker_id <> blocked_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check(sender_id <> receiver_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('reaction','comment','follow','message','friend_request','friend_accepted','listing_inquiry','system')),
  data jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('listing','post','user','message','conversation')),
  target_id text not null,
  reason text not null check (char_length(reason) between 1 and 500),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now()
);

create table if not exists public.moderation_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists listings_created_idx on public.listings(created_at desc);
create index if not exists listings_type_status_idx on public.listings(type, status, created_at desc);
create index if not exists listings_category_idx on public.listings(category_id);
create index if not exists listings_seller_idx on public.listings(seller_id);
create index if not exists posts_created_idx on public.posts(created_at desc);
create index if not exists comments_post_created_idx on public.comments(post_id, created_at);
create index if not exists messages_pair_created_idx on public.messages(sender_id, receiver_id, created_at desc);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists reports_status_created_idx on public.reports(status, created_at desc);

insert into public.listing_categories(slug,name_en,name_zh,name_id) values
 ('weapons','Weapons','武器','Senjata'),
 ('armor','Armor','护甲','Armor'),
 ('gear','Gear','装备','Perlengkapan'),
 ('resources','Resources','资源','Sumber daya'),
 ('materials','Materials','材料','Material'),
 ('crafting','Crafting Items','制作材料','Bahan crafting'),
 ('furniture','Furniture','家具','Furnitur'),
 ('decorations','Decorations','装饰品','Dekorasi'),
 ('accessories','Accessories','配件','Aksesori'),
 ('rare','Rare Items','稀有物品','Barang langka'),
 ('collectibles','Collectibles','收藏品','Koleksi'),
 ('other','Other','其他','Lainnya')
on conflict (slug) do nothing;

-- RLS
alter table public.profiles enable row level security;
alter table public.listing_categories enable row level security;
alter table public.listings enable row level security;
alter table public.listing_media enable row level security;
alter table public.posts enable row level security;
alter table public.reactions enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_logs enable row level security;
alter table public.announcements enable row level security;

drop policy if exists profiles_public_read on public.profiles;
create policy profiles_public_read on public.profiles for select to authenticated
using (profile_visibility = 'public' or id = auth.uid() or public.is_staff());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

drop policy if exists categories_read on public.listing_categories;
create policy categories_read on public.listing_categories for select to authenticated using (true);
drop policy if exists categories_admin_write on public.listing_categories;
create policy categories_admin_write on public.listing_categories for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists listings_read on public.listings;
create policy listings_read on public.listings for select to authenticated
using (status <> 'removed' or public.is_staff() or seller_id = auth.uid());
drop policy if exists listings_insert_self on public.listings;
create policy listings_insert_self on public.listings for insert to authenticated
with check (seller_id = auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.status='active'));
drop policy if exists listings_update_owner_or_staff on public.listings;
create policy listings_update_owner_or_staff on public.listings for update to authenticated
using (seller_id = auth.uid() or public.is_staff())
with check (seller_id = auth.uid() or public.is_staff());
drop policy if exists listings_delete_owner_or_staff on public.listings;
create policy listings_delete_owner_or_staff on public.listings for delete to authenticated
using (seller_id = auth.uid() or public.is_staff());

drop policy if exists listing_media_read on public.listing_media;
create policy listing_media_read on public.listing_media for select to authenticated
using (exists(select 1 from public.listings l where l.id=listing_id and (l.status <> 'removed' or l.seller_id=auth.uid() or public.is_staff())));
drop policy if exists listing_media_insert_owner on public.listing_media;
create policy listing_media_insert_owner on public.listing_media for insert to authenticated
with check (exists(select 1 from public.listings l where l.id=listing_id and l.seller_id=auth.uid()));
drop policy if exists listing_media_delete_owner on public.listing_media;
create policy listing_media_delete_owner on public.listing_media for delete to authenticated
using (exists(select 1 from public.listings l where l.id=listing_id and (l.seller_id=auth.uid() or public.is_staff())));

drop policy if exists posts_read on public.posts;
create policy posts_read on public.posts for select to authenticated using (true);
drop policy if exists posts_insert_self on public.posts;
create policy posts_insert_self on public.posts for insert to authenticated with check (author_id=auth.uid());
drop policy if exists posts_update_self on public.posts;
create policy posts_update_self on public.posts for update to authenticated using (author_id=auth.uid() or public.is_staff()) with check (author_id=auth.uid() or public.is_staff());
drop policy if exists posts_delete_self_staff on public.posts;
create policy posts_delete_self_staff on public.posts for delete to authenticated using (author_id=auth.uid() or public.is_staff());

drop policy if exists reactions_read on public.reactions;
create policy reactions_read on public.reactions for select to authenticated using (true);
drop policy if exists reactions_insert_self on public.reactions;
create policy reactions_insert_self on public.reactions for insert to authenticated with check (user_id=auth.uid());
drop policy if exists reactions_delete_self on public.reactions;
create policy reactions_delete_self on public.reactions for delete to authenticated using (user_id=auth.uid());

drop policy if exists comments_read on public.comments;
create policy comments_read on public.comments for select to authenticated using (true);
drop policy if exists comments_insert_self on public.comments;
create policy comments_insert_self on public.comments for insert to authenticated with check (author_id=auth.uid());
drop policy if exists comments_delete_self_staff on public.comments;
create policy comments_delete_self_staff on public.comments for delete to authenticated using (author_id=auth.uid() or public.is_staff());

drop policy if exists follows_read on public.follows;
create policy follows_read on public.follows for select to authenticated using (true);
drop policy if exists follows_insert_self on public.follows;
create policy follows_insert_self on public.follows for insert to authenticated with check (follower_id=auth.uid() and follower_id<>followee_id);
drop policy if exists follows_delete_self on public.follows;
create policy follows_delete_self on public.follows for delete to authenticated using (follower_id=auth.uid());

drop policy if exists blocks_read_self on public.blocks;
create policy blocks_read_self on public.blocks for select to authenticated using (blocker_id=auth.uid());
drop policy if exists blocks_insert_self on public.blocks;
create policy blocks_insert_self on public.blocks for insert to authenticated with check (blocker_id=auth.uid() and blocker_id<>blocked_id);
drop policy if exists blocks_delete_self on public.blocks;
create policy blocks_delete_self on public.blocks for delete to authenticated using (blocker_id=auth.uid());

drop policy if exists messages_read_participant on public.messages;
create policy messages_read_participant on public.messages for select to authenticated
using (sender_id=auth.uid() or receiver_id=auth.uid());
drop policy if exists messages_insert_sender on public.messages;
create policy messages_insert_sender on public.messages for insert to authenticated
with check (sender_id=auth.uid() and not exists(select 1 from public.blocks b where b.blocker_id=receiver_id and b.blocked_id=sender_id));
drop policy if exists messages_update_receiver on public.messages;
create policy messages_update_receiver on public.messages for update to authenticated
using (receiver_id=auth.uid()) with check (receiver_id=auth.uid());

drop policy if exists notifications_read_self on public.notifications;
create policy notifications_read_self on public.notifications for select to authenticated using (user_id=auth.uid());
drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self on public.notifications for update to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists reports_insert_self on public.reports;
create policy reports_insert_self on public.reports for insert to authenticated with check (reporter_id=auth.uid());
drop policy if exists reports_read_self_staff on public.reports;
create policy reports_read_self_staff on public.reports for select to authenticated using (reporter_id=auth.uid() or public.is_staff());

drop policy if exists logs_read_staff on public.moderation_logs;
create policy logs_read_staff on public.moderation_logs for select to authenticated using (public.is_staff());

drop policy if exists announcements_read on public.announcements;
create policy announcements_read on public.announcements for select to authenticated using (true);
drop policy if exists announcements_admin_insert on public.announcements;
create policy announcements_admin_insert on public.announcements for insert to authenticated with check (public.is_admin());
drop policy if exists announcements_admin_delete on public.announcements;
create policy announcements_admin_delete on public.announcements for delete to authenticated using (public.is_admin());

-- Authenticated users only; app uses public URLs for media in this first iteration.
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.listings to authenticated;
grant select, insert, delete on public.listing_media to authenticated;
grant select, insert, update, delete on public.posts to authenticated;
grant select, insert, delete on public.reactions to authenticated;
grant select, insert, delete on public.comments to authenticated;
grant select, insert, delete on public.follows to authenticated;
grant select, insert, delete on public.blocks to authenticated;
grant select, insert, update on public.messages to authenticated;
grant select, update on public.notifications to authenticated;
grant select, insert on public.reports to authenticated;
grant select on public.moderation_logs to authenticated;
grant select, insert, delete on public.announcements to authenticated;
grant select, insert, update, delete on public.listing_categories to authenticated;
