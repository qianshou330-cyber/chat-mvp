alter table public.conversations
add column if not exists announcement text not null default '';

alter table public.conversations
add column if not exists pinned_message_id uuid references public.messages(id) on delete set null;

alter table public.messages
add column if not exists deleted_at timestamptz;

alter table public.messages
add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

alter table public.messages
add column if not exists delete_reason text;

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
    'message_unpinned'
  )
);

create or replace function public.is_group_manager(
  target_conversation_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members member
    join public.conversations conversation on conversation.id = member.conversation_id
    where member.conversation_id = target_conversation_id
      and member.user_id = target_user_id
      and member.role in ('owner', 'admin')
      and conversation.type = 'group'
  );
$$;

create or replace function public.delete_group_message(
  target_conversation_id uuid,
  target_message_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  actor_role public.member_role;
  target_sender_id uuid;
  target_created_at timestamptz;
  target_deleted_at timestamptz;
  sender_role public.member_role;
  target_workspace_id uuid;
  can_delete boolean := false;
begin
  if actor_id is null then
    raise exception 'Not authenticated';
  end if;

  select conversation.workspace_id
  into target_workspace_id
  from public.conversations conversation
  where conversation.id = target_conversation_id
    and conversation.type = 'group';

  if target_workspace_id is null then
    raise exception 'Group conversation not found';
  end if;

  select member.role
  into actor_role
  from public.conversation_members member
  where member.conversation_id = target_conversation_id
    and member.user_id = actor_id;

  if actor_role is null then
    raise exception 'Not a group member';
  end if;

  select message.sender_id, message.created_at, message.deleted_at
  into target_sender_id, target_created_at, target_deleted_at
  from public.messages message
  where message.id = target_message_id
    and message.conversation_id = target_conversation_id;

  if target_sender_id is null then
    raise exception 'Message not found';
  end if;

  if target_deleted_at is not null then
    return;
  end if;

  select member.role
  into sender_role
  from public.conversation_members member
  where member.conversation_id = target_conversation_id
    and member.user_id = target_sender_id;

  can_delete :=
    (target_sender_id = actor_id and target_created_at >= now() - interval '2 minutes')
    or (actor_role in ('owner', 'admin') and coalesce(sender_role, 'member') = 'member');

  if not can_delete then
    raise exception 'Not allowed to delete this message';
  end if;

  update public.messages
  set
    deleted_at = now(),
    deleted_by = actor_id,
    delete_reason = case when target_sender_id = actor_id then 'recalled' else 'moderated' end
  where id = target_message_id;

  update public.conversations
  set
    pinned_message_id = case
      when pinned_message_id = target_message_id then null
      else pinned_message_id
    end,
    updated_at = now()
  where id = target_conversation_id;

  insert into public.admin_activity_logs (
    workspace_id,
    actor_id,
    target_user_id,
    action,
    result,
    details
  )
  values (
    target_workspace_id,
    actor_id,
    target_sender_id,
    'message_deleted',
    'success',
    jsonb_build_object(
      'conversationId', target_conversation_id,
      'messageId', target_message_id,
      'reason', case when target_sender_id = actor_id then 'recalled' else 'moderated' end
    )
  );
end;
$$;

create or replace function public.update_group_announcement(
  target_conversation_id uuid,
  next_announcement text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  target_workspace_id uuid;
  normalized_announcement text := left(trim(coalesce(next_announcement, '')), 500);
begin
  if actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_group_manager(target_conversation_id, actor_id) then
    raise exception 'Only group owner or admin can update announcement';
  end if;

  select workspace_id
  into target_workspace_id
  from public.conversations
  where id = target_conversation_id
    and type = 'group';

  if target_workspace_id is null then
    raise exception 'Group conversation not found';
  end if;

  update public.conversations
  set announcement = normalized_announcement,
      updated_at = now()
  where id = target_conversation_id;

  insert into public.admin_activity_logs (
    workspace_id,
    actor_id,
    target_user_id,
    action,
    result,
    details
  )
  values (
    target_workspace_id,
    actor_id,
    actor_id,
    'group_announcement_updated',
    'success',
    jsonb_build_object('conversationId', target_conversation_id)
  );
end;
$$;

create or replace function public.pin_group_message(
  target_conversation_id uuid,
  target_message_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  target_workspace_id uuid;
begin
  if actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_group_manager(target_conversation_id, actor_id) then
    raise exception 'Only group owner or admin can pin message';
  end if;

  select workspace_id
  into target_workspace_id
  from public.conversations
  where id = target_conversation_id
    and type = 'group';

  if target_workspace_id is null then
    raise exception 'Group conversation not found';
  end if;

  if not exists (
    select 1
    from public.messages message
    where message.id = target_message_id
      and message.conversation_id = target_conversation_id
      and message.deleted_at is null
  ) then
    raise exception 'Message not found';
  end if;

  update public.conversations
  set pinned_message_id = target_message_id,
      updated_at = now()
  where id = target_conversation_id;

  insert into public.admin_activity_logs (
    workspace_id,
    actor_id,
    target_user_id,
    action,
    result,
    details
  )
  values (
    target_workspace_id,
    actor_id,
    actor_id,
    'message_pinned',
    'success',
    jsonb_build_object('conversationId', target_conversation_id, 'messageId', target_message_id)
  );
end;
$$;

create or replace function public.unpin_group_message(target_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  target_workspace_id uuid;
  previous_message_id uuid;
begin
  if actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_group_manager(target_conversation_id, actor_id) then
    raise exception 'Only group owner or admin can unpin message';
  end if;

  select workspace_id, pinned_message_id
  into target_workspace_id, previous_message_id
  from public.conversations
  where id = target_conversation_id
    and type = 'group';

  if target_workspace_id is null then
    raise exception 'Group conversation not found';
  end if;

  update public.conversations
  set pinned_message_id = null,
      updated_at = now()
  where id = target_conversation_id;

  insert into public.admin_activity_logs (
    workspace_id,
    actor_id,
    target_user_id,
    action,
    result,
    details
  )
  values (
    target_workspace_id,
    actor_id,
    actor_id,
    'message_unpinned',
    'success',
    jsonb_build_object('conversationId', target_conversation_id, 'messageId', previous_message_id)
  );
end;
$$;

grant execute on function public.is_group_manager(uuid, uuid) to authenticated;
grant execute on function public.delete_group_message(uuid, uuid) to authenticated;
grant execute on function public.update_group_announcement(uuid, text) to authenticated;
grant execute on function public.pin_group_message(uuid, uuid) to authenticated;
grant execute on function public.unpin_group_message(uuid) to authenticated;
