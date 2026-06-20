create index if not exists messages_search_pagination_idx
on public.messages(conversation_id, created_at desc, id desc);

create or replace function public.search_messages_v3(
  search_query text,
  target_conversation_id uuid default null,
  target_message_type public.message_type default null,
  target_sender_id uuid default null,
  created_after timestamptz default null,
  created_before timestamptz default null,
  before_created_at timestamptz default null,
  before_message_id uuid default null,
  result_limit integer default 30
)
returns table (
  result_id text,
  conversation_id uuid,
  conversation_title text,
  kind text,
  message_id uuid,
  message_type public.message_type,
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
      and (target_message_type is null or message.message_type = target_message_type)
      and (target_sender_id is null or message.sender_id = target_sender_id)
      and (created_after is null or message.created_at >= created_after)
      and (created_before is null or message.created_at <= created_before)
      and (
        before_created_at is null
        or message.created_at < before_created_at
        or (
          before_message_id is not null
          and message.created_at = before_created_at
          and message.id < before_message_id
        )
      )
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
    scoped_messages.id as message_id,
    scoped_messages.message_type,
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

grant execute on function public.search_messages_v3(
  text,
  uuid,
  public.message_type,
  uuid,
  timestamptz,
  timestamptz,
  timestamptz,
  uuid,
  integer
) to authenticated;
