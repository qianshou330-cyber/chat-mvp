alter table public.attachments
add column if not exists deleted_at timestamptz;

alter table public.attachments
add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

alter table public.attachments
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
    'message_unpinned',
    'attachment_hidden'
  )
);

create or replace function public.hide_group_attachment(
  target_conversation_id uuid,
  target_attachment_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_id uuid := auth.uid();
  target_workspace_id uuid;
  attachment_owner_id uuid;
  attachment_message_id uuid;
begin
  if actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_group_manager(target_conversation_id, actor_id) then
    raise exception 'Only group owner or admin can hide attachment';
  end if;

  select conversation.workspace_id, attachment.owner_id, message.id
  into target_workspace_id, attachment_owner_id, attachment_message_id
  from public.messages message
  join public.attachments attachment on attachment.id = message.attachment_id
  join public.conversations conversation on conversation.id = message.conversation_id
  where message.conversation_id = target_conversation_id
    and attachment.id = target_attachment_id
    and conversation.type = 'group';

  if target_workspace_id is null or attachment_message_id is null then
    raise exception 'Attachment not found';
  end if;

  update public.attachments
  set
    deleted_at = coalesce(deleted_at, now()),
    deleted_by = coalesce(deleted_by, actor_id),
    delete_reason = coalesce(delete_reason, 'hidden')
  where id = target_attachment_id;

  update public.conversations
  set updated_at = now()
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
    attachment_owner_id,
    'attachment_hidden',
    'success',
    jsonb_build_object(
      'conversationId', target_conversation_id,
      'messageId', attachment_message_id,
      'attachmentId', target_attachment_id
    )
  );
end;
$$;

create or replace function public.list_group_attachments(target_conversation_id uuid)
returns table (
  attachment_id uuid,
  message_id uuid,
  owner_id uuid,
  file_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz,
  message_deleted_at timestamptz,
  attachment_deleted_at timestamptz,
  delete_reason text
)
language sql
security definer
set search_path = public
as $$
  select
    attachment.id as attachment_id,
    message.id as message_id,
    attachment.owner_id,
    attachment.file_name,
    attachment.mime_type,
    attachment.size_bytes,
    message.created_at,
    message.deleted_at as message_deleted_at,
    attachment.deleted_at as attachment_deleted_at,
    coalesce(attachment.delete_reason, message.delete_reason) as delete_reason
  from public.messages message
  join public.attachments attachment on attachment.id = message.attachment_id
  join public.conversations conversation on conversation.id = message.conversation_id
  where message.conversation_id = target_conversation_id
    and conversation.type = 'group'
    and exists (
      select 1
      from public.conversation_members member
      where member.conversation_id = target_conversation_id
        and member.user_id = auth.uid()
    )
    and (
      public.is_group_manager(target_conversation_id, auth.uid())
      or (message.deleted_at is null and attachment.deleted_at is null)
    )
  order by message.created_at desc;
$$;

grant execute on function public.hide_group_attachment(uuid, uuid) to authenticated;
grant execute on function public.list_group_attachments(uuid) to authenticated;
