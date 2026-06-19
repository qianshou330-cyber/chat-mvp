create or replace function public.remove_group_member(
  conversation_id uuid,
  member_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_conversation public.conversations%rowtype;
  actor_role public.member_role;
  target_role public.member_role;
begin
  if current_user_id is null then
    raise exception 'Not authorized';
  end if;

  select *
  into target_conversation
  from public.conversations
  where conversations.id = $1;

  if target_conversation.id is null or target_conversation.type <> 'group' then
    raise exception 'Group conversation not found';
  end if;

  select conversation_members.role
  into actor_role
  from public.conversation_members
  where conversation_members.conversation_id = $1
    and conversation_members.user_id = current_user_id;

  if actor_role not in ('owner', 'admin') then
    raise exception 'Only group owner or admin can remove members';
  end if;

  select conversation_members.role
  into target_role
  from public.conversation_members
  where conversation_members.conversation_id = $1
    and conversation_members.user_id = $2;

  if target_role is null then
    raise exception 'Group member not found';
  end if;

  if target_role <> 'member' then
    raise exception 'Only regular group members can be removed';
  end if;

  delete from public.conversation_members
  where conversation_members.conversation_id = $1
    and conversation_members.user_id = $2;

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
    current_user_id,
    $2,
    'group_member_removed',
    'success',
    jsonb_build_object('conversationId', $1)
  where target_conversation.workspace_id is not null;
end;
$$;

grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
