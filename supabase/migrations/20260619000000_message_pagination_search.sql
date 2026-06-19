create index if not exists messages_conversation_created_idx
on public.messages(conversation_id, created_at desc, id desc);

create index if not exists messages_body_idx
on public.messages(conversation_id, body);

create or replace function public.get_conversation_messages(
  target_conversation_id uuid,
  before_created_at timestamptz default null,
  page_size integer default 80
)
returns table (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  body text,
  message_type public.message_type,
  attachment_id uuid,
  status public.message_status,
  created_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid,
  delete_reason text,
  attachments jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  with limited_messages as (
    select message.*
    from public.messages message
    where message.conversation_id = target_conversation_id
      and public.can_access_conversation(message.conversation_id, auth.uid())
      and (
        before_created_at is null
        or message.created_at < before_created_at
      )
    order by message.created_at desc, message.id desc
    limit greatest(1, least(coalesce(page_size, 80), 100))
  )
  select
    message.id,
    message.conversation_id,
    message.sender_id,
    message.body,
    message.message_type,
    message.attachment_id,
    message.status,
    message.created_at,
    message.deleted_at,
    message.deleted_by,
    message.delete_reason,
    case
      when attachment.id is null then null
      else jsonb_build_object(
        'id', attachment.id,
        'owner_id', attachment.owner_id,
        'bucket_path', attachment.bucket_path,
        'file_name', attachment.file_name,
        'mime_type', attachment.mime_type,
        'size_bytes', attachment.size_bytes,
        'created_at', attachment.created_at,
        'deleted_at', attachment.deleted_at,
        'deleted_by', attachment.deleted_by,
        'delete_reason', attachment.delete_reason
      )
    end as attachments
  from limited_messages message
  left join public.attachments attachment on attachment.id = message.attachment_id
  order by message.created_at asc, message.id asc;
$$;

create or replace function public.search_messages(
  search_query text,
  target_conversation_id uuid default null,
  result_limit integer default 30
)
returns table (
  result_id text,
  conversation_id uuid,
  conversation_title text,
  kind text,
  title text,
  snippet text,
  sender_name text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  with normalized as (
    select lower(trim(coalesce(search_query, ''))) as query_text
  ),
  scoped_messages as (
    select
      message.id,
      message.conversation_id,
      message.sender_id,
      message.body,
      message.message_type,
      message.created_at,
      conversation.title as conversation_title,
      profile.display_name as sender_name,
      attachment.id as attachment_id,
      attachment.deleted_at as attachment_deleted_at
    from public.messages message
    join public.conversations conversation on conversation.id = message.conversation_id
    left join public.profiles profile on profile.id = message.sender_id
    left join public.attachments attachment on attachment.id = message.attachment_id
    cross join normalized
    where normalized.query_text <> ''
      and public.can_access_conversation(message.conversation_id, auth.uid())
      and message.deleted_at is null
      and (target_conversation_id is null or message.conversation_id = target_conversation_id)
      and (attachment.id is null or attachment.deleted_at is null)
      and (
        lower(coalesce(message.body, '')) like '%' || normalized.query_text || '%'
        or lower(coalesce(conversation.title, '')) like '%' || normalized.query_text || '%'
        or lower(coalesce(profile.display_name, '')) like '%' || normalized.query_text || '%'
        or lower(
          case message.message_type
            when 'image' then '图片 image'
            when 'video' then '视频 video'
            when 'file' then '文件 file'
            else '文本 text'
          end
        ) like '%' || normalized.query_text || '%'
      )
  )
  select
    'message-' || scoped_messages.id::text as result_id,
    scoped_messages.conversation_id,
    coalesce(scoped_messages.conversation_title, '会话') as conversation_title,
    'message' as kind,
    coalesce(scoped_messages.conversation_title, '会话') as title,
    coalesce(
      nullif(scoped_messages.body, ''),
      case scoped_messages.message_type
        when 'image' then '图片'
        when 'video' then '视频'
        when 'file' then '文件'
        else '消息'
      end
    ) as snippet,
    coalesce(scoped_messages.sender_name, '成员') as sender_name,
    scoped_messages.created_at
  from scoped_messages
  order by scoped_messages.created_at desc, scoped_messages.id desc
  limit greatest(1, least(coalesce(result_limit, 30), 100));
$$;

grant execute on function public.get_conversation_messages(uuid, timestamptz, integer) to authenticated;
grant execute on function public.search_messages(text, uuid, integer) to authenticated;
