create or replace function public.create_group_conversation(group_title text default '新群聊')
returns table (
  conversation_id uuid,
  conversation_title text,
  conversation_workspace_id uuid,
  conversation_updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_workspace_id uuid;
  safe_title text := left(coalesce(nullif(trim(group_title), ''), '新群聊'), 80);
  created_conversation public.conversations%rowtype;
begin
  if current_user_id is null then
    raise exception 'Not authorized';
  end if;

  select ensured.workspace_id
  into target_workspace_id
  from public.ensure_default_workspace() as ensured
  limit 1;

  if target_workspace_id is null or not public.is_workspace_member(target_workspace_id, current_user_id) then
    raise exception 'Not a workspace member';
  end if;

  insert into public.conversations (type, title, created_by, workspace_id)
  values ('group', safe_title, current_user_id, target_workspace_id)
  returning * into created_conversation;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (created_conversation.id, current_user_id, 'owner');

  return query
  select
    created_conversation.id,
    created_conversation.title,
    created_conversation.workspace_id,
    created_conversation.updated_at;
end;
$$;

grant execute on function public.create_group_conversation(text) to authenticated;
