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
    'group_renamed'
  )
);

create or replace function public.is_group_owner(
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
    from public.conversation_members cm
    join public.conversations conversation
      on conversation.id = cm.conversation_id
    where cm.conversation_id = target_conversation_id
      and cm.user_id = target_user_id
      and cm.role = 'owner'
      and conversation.type = 'group'
      and (
        conversation.workspace_id is null
        or public.is_workspace_member(conversation.workspace_id, target_user_id)
      )
  );
$$;

create or replace function public.add_group_member(
  conversation_id uuid,
  member_user_id uuid
)
returns table (
  result_conversation_id uuid,
  result_member_user_id uuid,
  result_member_role public.member_role,
  result_joined_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_conversation public.conversations%rowtype;
  inserted_member public.conversation_members%rowtype;
begin
  if current_user_id is null then
    raise exception 'Not authorized';
  end if;

  select *
  into target_conversation
  from public.conversations
  where id = $1;

  if target_conversation.id is null or target_conversation.type <> 'group' then
    raise exception 'Group conversation not found';
  end if;

  if not public.is_conversation_admin($1, current_user_id) then
    raise exception 'Only group owner or admin can add members';
  end if;

  if target_conversation.workspace_id is not null
    and not public.is_workspace_member(target_conversation.workspace_id, $2)
  then
    raise exception 'Target user must be a workspace member';
  end if;

  insert into public.conversation_members (conversation_id, user_id, role)
  values ($1, $2, 'member')
  on conflict (conversation_id, user_id) do update
    set role = public.conversation_members.role
  returning * into inserted_member;

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
    'group_member_added',
    'success',
    jsonb_build_object('conversationId', $1)
  where target_conversation.workspace_id is not null;

  return query
  select
    inserted_member.conversation_id,
    inserted_member.user_id,
    inserted_member.role,
    inserted_member.joined_at;
end;
$$;

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
  where id = $1;

  if target_conversation.id is null or target_conversation.type <> 'group' then
    raise exception 'Group conversation not found';
  end if;

  select role
  into actor_role
  from public.conversation_members
  where conversation_id = $1
    and user_id = current_user_id;

  if actor_role not in ('owner', 'admin') then
    raise exception 'Only group owner or admin can remove members';
  end if;

  select role
  into target_role
  from public.conversation_members
  where conversation_id = $1
    and user_id = $2;

  if target_role is null then
    raise exception 'Group member not found';
  end if;

  if target_role <> 'member' then
    raise exception 'Only regular group members can be removed';
  end if;

  delete from public.conversation_members
  where conversation_id = $1
    and user_id = $2;

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

create or replace function public.update_group_member_role(
  conversation_id uuid,
  member_user_id uuid,
  role public.member_role
)
returns table (
  result_conversation_id uuid,
  result_member_user_id uuid,
  result_member_role public.member_role
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_conversation public.conversations%rowtype;
  target_role public.member_role;
begin
  if current_user_id is null then
    raise exception 'Not authorized';
  end if;

  select *
  into target_conversation
  from public.conversations
  where id = $1;

  if target_conversation.id is null or target_conversation.type <> 'group' then
    raise exception 'Group conversation not found';
  end if;

  if not public.is_group_owner($1, current_user_id) then
    raise exception 'Only group owner can update group roles';
  end if;

  if $3 not in ('admin', 'member') then
    raise exception 'Group role must be admin or member';
  end if;

  select cm.role
  into target_role
  from public.conversation_members cm
  where cm.conversation_id = $1
    and cm.user_id = $2;

  if target_role is null then
    raise exception 'Group member not found';
  end if;

  if target_role = 'owner' then
    raise exception 'Group owner role cannot be changed';
  end if;

  update public.conversation_members
  set role = $3
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
    'group_member_role_updated',
    'success',
    jsonb_build_object('conversationId', $1, 'role', $3::text)
  where target_conversation.workspace_id is not null;

  return query
  select $1, $2, $3;
end;
$$;

create or replace function public.rename_group(
  conversation_id uuid,
  title text
)
returns table (
  result_conversation_id uuid,
  result_title text,
  result_updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_conversation public.conversations%rowtype;
  safe_title text := left(coalesce(nullif(trim($2), ''), '新群聊'), 80);
begin
  if current_user_id is null then
    raise exception 'Not authorized';
  end if;

  select *
  into target_conversation
  from public.conversations
  where id = $1;

  if target_conversation.id is null or target_conversation.type <> 'group' then
    raise exception 'Group conversation not found';
  end if;

  if not public.is_conversation_admin($1, current_user_id) then
    raise exception 'Only group owner or admin can rename group';
  end if;

  update public.conversations
  set
    title = safe_title,
    updated_at = now()
  where id = $1
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
    current_user_id,
    current_user_id,
    'group_renamed',
    'success',
    jsonb_build_object('conversationId', $1)
  where target_conversation.workspace_id is not null;

  return query
  select target_conversation.id, target_conversation.title, target_conversation.updated_at;
end;
$$;

grant execute on function public.is_group_owner(uuid, uuid) to authenticated;
grant execute on function public.add_group_member(uuid, uuid) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.update_group_member_role(uuid, uuid, public.member_role) to authenticated;
grant execute on function public.rename_group(uuid, text) to authenticated;
