alter table public.conversations
add column if not exists is_muted boolean not null default false;

alter table public.conversation_members
add column if not exists is_muted boolean not null default false;

alter table public.admin_activity_logs
drop constraint if exists admin_activity_logs_action_check;

alter table public.admin_activity_logs
add constraint admin_activity_logs_action_check
check (
  action in (
    'member_added',
    'member_removed',
    'member_role_updated',
    'other_devices_revoked',
    'group_member_added',
    'group_member_removed',
    'group_member_role_updated',
    'group_renamed',
    'message_deleted',
    'group_announcement_updated',
    'message_pinned',
    'message_unpinned',
    'attachment_hidden',
    'group_muted',
    'group_unmuted',
    'member_muted',
    'member_unmuted'
  )
);

create or replace function public.can_send_message(
  target_conversation_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.conversation_members member
    join public.conversations conversation
      on conversation.id = member.conversation_id
    where member.conversation_id = target_conversation_id
      and member.user_id = target_user_id
      and (
        conversation.workspace_id is null
        or public.is_workspace_member(conversation.workspace_id, target_user_id)
      )
      and (
        conversation.type = 'direct'
        or member.role in ('owner', 'admin')
        or (member.is_muted is false and conversation.is_muted is false)
      )
  );
$$;

drop policy if exists "members send messages" on public.messages;

create policy "members send messages"
on public.messages for insert
with check (
  sender_id = auth.uid()
  and public.can_send_message(conversation_id, auth.uid())
);

create or replace function public.set_group_mute(
  target_conversation_id uuid,
  muted boolean
)
returns table (
  result_conversation_id uuid,
  result_is_muted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  target_conversation public.conversations%rowtype;
begin
  if actor_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into target_conversation
  from public.conversations
  where id = target_conversation_id;

  if target_conversation.id is null or target_conversation.type <> 'group' then
    raise exception 'Group conversation not found';
  end if;

  if not public.is_group_manager(target_conversation_id, actor_id) then
    raise exception 'Only group owner or admin can mute the group';
  end if;

  update public.conversations
  set
    is_muted = muted,
    updated_at = now()
  where id = target_conversation_id
  returning * into target_conversation;

  insert into public.admin_activity_logs (
    workspace_id,
    actor_id,
    target_user_id,
    action,
    result,
    details
  )
  select
    target_conversation.workspace_id,
    actor_id,
    actor_id,
    case when muted then 'group_muted' else 'group_unmuted' end,
    'success',
    jsonb_build_object('conversationId', target_conversation_id)
  where target_conversation.workspace_id is not null;

  return query
  select target_conversation.id, target_conversation.is_muted;
end;
$$;

create or replace function public.set_member_mute(
  target_conversation_id uuid,
  target_member_user_id uuid,
  muted boolean
)
returns table (
  result_conversation_id uuid,
  result_member_user_id uuid,
  result_is_muted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  target_conversation public.conversations%rowtype;
  target_role public.member_role;
begin
  if actor_id is null then
    raise exception 'Not authenticated';
  end if;

  select *
  into target_conversation
  from public.conversations
  where id = target_conversation_id;

  if target_conversation.id is null or target_conversation.type <> 'group' then
    raise exception 'Group conversation not found';
  end if;

  if not public.is_group_manager(target_conversation_id, actor_id) then
    raise exception 'Only group owner or admin can mute members';
  end if;

  select role
  into target_role
  from public.conversation_members
  where conversation_id = target_conversation_id
    and user_id = target_member_user_id;

  if target_role is null then
    raise exception 'Group member not found';
  end if;

  if target_role <> 'member' then
    raise exception 'Only regular members can be muted';
  end if;

  update public.conversation_members
  set is_muted = muted
  where conversation_id = target_conversation_id
    and user_id = target_member_user_id;

  insert into public.admin_activity_logs (
    workspace_id,
    actor_id,
    target_user_id,
    action,
    result,
    details
  )
  select
    target_conversation.workspace_id,
    actor_id,
    target_member_user_id,
    case when muted then 'member_muted' else 'member_unmuted' end,
    'success',
    jsonb_build_object('conversationId', target_conversation_id)
  where target_conversation.workspace_id is not null;

  return query
  select target_conversation_id, target_member_user_id, muted;
end;
$$;

grant execute on function public.can_send_message(uuid, uuid) to authenticated;
grant execute on function public.set_group_mute(uuid, boolean) to authenticated;
grant execute on function public.set_member_mute(uuid, uuid, boolean) to authenticated;
