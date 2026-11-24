-- NEXUS admin/moderation additions. Run after 001_core.sql.
-- These routines run with a fixed search_path and verify staff permissions.

create or replace function public.mod_action(act text, target text, note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'forbidden';
  end if;

  if act = 'remove_listing' then
    update public.listings set status='removed' where id=target::uuid;
  elsif act = 'restore_listing' then
    update public.listings set status='available' where id=target::uuid;
  elsif act = 'delete_post' then
    delete from public.posts where id=target::uuid;
  elsif act = 'resolve_report' then
    update public.reports set status='resolved' where id=target::uuid;
  elsif act in ('suspend_user','ban_user','activate_user','make_mod','make_user') then
    if not public.is_admin() then raise exception 'admin only'; end if;
    if exists(select 1 from public.profiles where id=target::uuid and role='admin') then
      raise exception 'cannot act on an admin';
    end if;

    if act='suspend_user' then
      update public.profiles set status='suspended' where id=target::uuid;
    elsif act='ban_user' then
      update public.profiles set status='banned' where id=target::uuid;
    elsif act='activate_user' then
      update public.profiles set status='active' where id=target::uuid;
    elsif act='make_mod' then
      update public.profiles set role='moderator' where id=target::uuid;
    else
      update public.profiles set role='user' where id=target::uuid;
    end if;
  else
    raise exception 'unknown action';
  end if;

  insert into public.moderation_logs(actor_id, action, target)
  values(auth.uid(), act || coalesce(': ' || note,''), target);
end;
$$;

revoke all on function public.mod_action(text,text,text) from public, anon;
grant execute on function public.mod_action(text,text,text) to authenticated;
