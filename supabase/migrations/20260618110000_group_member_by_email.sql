create or replace function public.add_group_member_by_email(
  target_conversation_id uuid,
  search_email text
)
returns table (
  result_conversation_id uuid,
  result_member_user_id uuid,
  result_member_role public.member_role,
  result_joined_at timestamptz,
  result_workspace_id uuid,
  result_workspace_role public.member_role,
  result_workspace_joined_at timestamptz,
  member_display_name text,
  member_avatar_url text,
  member_avatar_tone text,
  member_bio text,
  member_status public.profile_status,
  member_last_seen timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_email text := lower(trim(search_email));
  target_conversation public.conversations%rowtype;
  target_user_id uuid;
  target_email text;
  inserted_member public.conversation_members%rowtype;
  ensured_workspace_member public.workspace_members%rowtype;
begin
  if current_user_id is null then
    raise exception 'Not authorized';
  end if;

  if normalized_email = '' then
    raise exception 'No user found';
  end if;

  select *
  into target_conversation
  from public.conversations
  where id = target_conversation_id;

  if target_conversation.id is null or target_conversation.type <> 'group' then
    raise exception 'Group conversation not found';
  end if;

  if not public.is_conversation_admin(target_conversation_id, current_user_id) then
    raise exception 'Only group owner or admin can add members';
  end if;

  select users.id, users.email
  into target_user_id, target_email
  from auth.users
  where lower(users.email) = normalized_email
  limit 1;

  if target_user_id is null then
    raise exception 'No user found';
  end if;

  insert into public.profiles (id, display_name, bio, avatar_tone, status)
  values (
    target_user_id,
    coalesce(split_part(target_email, '@', 1), '成员'),
    '',
    'blue',
    'offline'
  )
  on conflict (id) do nothing;

  if target_conversation.workspace_id is not null then
    insert into public.workspace_members (workspace_id, user_id, role)
    values (target_conversation.workspace_id, target_user_id, 'member')
    on conflict (workspace_id, user_id) do nothing;

    select *
    into ensured_workspace_member
    from public.workspace_members
    where workspace_id = target_conversation.workspace_id
      and user_id = target_user_id;
  end if;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (target_conversation_id, target_user_id, 'member')
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
    target_user_id,
    'group_member_added',
    'success',
    jsonb_build_object('conversationId', target_conversation_id)
  where target_conversation.workspace_id is not null;

  return query
  select
    inserted_member.conversation_id,
    inserted_member.user_id,
    inserted_member.role,
    inserted_member.joined_at,
    ensured_workspace_member.workspace_id,
    ensured_workspace_member.role,
    ensured_workspace_member.joined_at,
    profiles.display_name,
    profiles.avatar_url,
    profiles.avatar_tone,
    profiles.bio,
    profiles.status,
    profiles.last_seen
  from public.profiles
  where profiles.id = target_user_id;
end;
$$;

grant execute on function public.add_group_member_by_email(uuid, text) to authenticated;
