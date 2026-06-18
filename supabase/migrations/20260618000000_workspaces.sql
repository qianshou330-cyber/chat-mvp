create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table public.conversations
add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

create index if not exists workspaces_created_by_idx on public.workspaces(created_by);
create index if not exists workspace_members_user_idx on public.workspace_members(user_id);
create index if not exists conversations_workspace_idx on public.conversations(workspace_id);

drop trigger if exists workspaces_touch_updated_at on public.workspaces;
create trigger workspaces_touch_updated_at
before update on public.workspaces
for each row execute function public.touch_updated_at();

create or replace function public.is_workspace_member(
  target_workspace_id uuid,
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
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = target_user_id
  );
$$;

create or replace function public.is_workspace_admin(
  target_workspace_id uuid,
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
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = target_user_id
      and wm.role in ('owner', 'admin')
  );
$$;

create or replace function public.can_access_conversation(
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
    from public.conversations conversation
    where conversation.id = target_conversation_id
      and public.is_conversation_member(conversation.id, target_user_id)
      and (
        conversation.workspace_id is null
        or public.is_workspace_member(conversation.workspace_id, target_user_id)
      )
  );
$$;

create or replace function public.is_conversation_admin(
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
      and cm.role in ('owner', 'admin')
      and (
        conversation.workspace_id is null
        or public.is_workspace_member(conversation.workspace_id, target_user_id)
      )
  );
$$;

create or replace function public.can_insert_conversation_member(
  target_conversation_id uuid,
  target_member_user_id uuid,
  target_actor_id uuid default auth.uid()
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.conversations conversation
    where conversation.id = target_conversation_id
      and (
        (
          target_member_user_id = target_actor_id
          and conversation.created_by = target_actor_id
          and (
            conversation.workspace_id is null
            or public.is_workspace_member(conversation.workspace_id, target_actor_id)
          )
        )
        or (
          conversation.type = 'group'
          and public.is_conversation_admin(conversation.id, target_actor_id)
          and (
            conversation.workspace_id is null
            or public.is_workspace_member(conversation.workspace_id, target_member_user_id)
          )
        )
      )
  );
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

drop policy if exists "workspace members read workspaces" on public.workspaces;
drop policy if exists "users create own workspaces" on public.workspaces;
drop policy if exists "workspace admins update workspaces" on public.workspaces;
drop policy if exists "workspace members read memberships" on public.workspace_members;
drop policy if exists "workspace admins insert memberships" on public.workspace_members;
drop policy if exists "workspace admins update memberships" on public.workspace_members;
drop policy if exists "workspace admins delete memberships" on public.workspace_members;

create policy "workspace members read workspaces"
on public.workspaces for select
to authenticated
using (public.is_workspace_member(id));

create policy "users create own workspaces"
on public.workspaces for insert
to authenticated
with check (created_by = auth.uid());

create policy "workspace admins update workspaces"
on public.workspaces for update
to authenticated
using (public.is_workspace_admin(id))
with check (public.is_workspace_admin(id));

create policy "workspace members read memberships"
on public.workspace_members for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "workspace admins insert memberships"
on public.workspace_members for insert
to authenticated
with check (public.is_workspace_admin(workspace_id));

create policy "workspace admins update memberships"
on public.workspace_members for update
to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

create policy "workspace admins delete memberships"
on public.workspace_members for delete
to authenticated
using (public.is_workspace_admin(workspace_id));

drop policy if exists "members read conversations" on public.conversations;
drop policy if exists "authenticated users create conversations" on public.conversations;
drop policy if exists "admins update conversations" on public.conversations;
drop policy if exists "members read membership" on public.conversation_members;
drop policy if exists "users join themselves or admins invite" on public.conversation_members;
drop policy if exists "users join themselves or group admins invite" on public.conversation_members;
drop policy if exists "admins manage members" on public.conversation_members;
drop policy if exists "admins remove members" on public.conversation_members;
drop policy if exists "members read messages" on public.messages;
drop policy if exists "members send messages" on public.messages;
drop policy if exists "owners read attachments" on public.attachments;
drop policy if exists "users upload to own folder" on storage.objects;
drop policy if exists "conversation members read uploads" on storage.objects;

create policy "members read conversations"
on public.conversations for select
to authenticated
using (public.can_access_conversation(id));

create policy "authenticated users create conversations"
on public.conversations for insert
to authenticated
with check (
  created_by = auth.uid()
  and (
    workspace_id is null
    or public.is_workspace_member(workspace_id)
  )
);

create policy "admins update conversations"
on public.conversations for update
to authenticated
using (public.is_conversation_admin(id))
with check (public.is_conversation_admin(id));

create policy "members read membership"
on public.conversation_members for select
to authenticated
using (public.can_access_conversation(conversation_id));

create policy "users join themselves or group admins invite"
on public.conversation_members for insert
to authenticated
with check (public.can_insert_conversation_member(conversation_id, user_id));

create policy "admins manage members"
on public.conversation_members for update
to authenticated
using (public.is_conversation_admin(conversation_id))
with check (public.is_conversation_admin(conversation_id));

create policy "admins remove members"
on public.conversation_members for delete
to authenticated
using (public.is_conversation_admin(conversation_id));

create policy "members read messages"
on public.messages for select
to authenticated
using (public.can_access_conversation(conversation_id));

create policy "members send messages"
on public.messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.can_access_conversation(conversation_id)
);

create policy "owners read attachments"
on public.attachments for select
to authenticated
using (
  owner_id = auth.uid()
  or exists (
    select 1
    from public.messages message
    where message.attachment_id = attachments.id
      and public.can_access_conversation(message.conversation_id)
  )
);

create policy "users upload to own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'chat-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.can_access_conversation(((storage.foldername(name))[2])::uuid)
);

create policy "conversation members read uploads"
on storage.objects for select
to authenticated
using (
  bucket_id = 'chat-uploads'
  and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.can_access_conversation(((storage.foldername(name))[2])::uuid)
);

create or replace function public.ensure_default_workspace()
returns table (
  workspace_id uuid,
  workspace_name text,
  workspace_role public.member_role
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_email text;
  result_workspace_id uuid;
  result_workspace_name text;
  result_workspace_role public.member_role;
begin
  if current_user_id is null then
    raise exception 'Not authorized';
  end if;

  select users.email
  into current_email
  from auth.users
  where users.id = current_user_id;

  insert into public.profiles (id, display_name, bio, avatar_tone, status)
  values (
    current_user_id,
    coalesce(split_part(current_email, '@', 1), '成员'),
    '',
    'blue',
    'online'
  )
  on conflict (id) do nothing;

  select wm.workspace_id, workspace.name, wm.role
  into result_workspace_id, result_workspace_name, result_workspace_role
  from public.workspace_members wm
  join public.workspaces workspace
    on workspace.id = wm.workspace_id
  where wm.user_id = current_user_id
  order by
    wm.joined_at desc
  limit 1;

  if result_workspace_id is null then
    insert into public.workspaces (name, created_by)
    values (
      coalesce(split_part(current_email, '@', 1), '我的') || ' 的工作区',
      current_user_id
    )
    returning id, name
    into result_workspace_id, result_workspace_name;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (result_workspace_id, current_user_id, 'owner');

    result_workspace_role := 'owner';
  end if;

  update public.conversations as conversation
  set workspace_id = result_workspace_id
  where conversation.created_by = current_user_id
    and conversation.type = 'group'
    and conversation.workspace_id is null;

  return query
  select result_workspace_id, result_workspace_name, result_workspace_role;
end;
$$;

create or replace function public.add_workspace_member_by_email(
  search_email text,
  requested_role public.member_role default 'member'
)
returns table (
  workspace_id uuid,
  member_user_id uuid,
  member_display_name text,
  member_avatar_url text,
  member_avatar_tone text,
  member_bio text,
  member_status public.profile_status,
  member_last_seen timestamptz,
  member_role public.member_role,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_email text := lower(trim(search_email));
  target_workspace_id uuid;
  target_user_id uuid;
  target_email text;
  inserted_member public.workspace_members%rowtype;
begin
  if current_user_id is null then
    raise exception 'Not authorized';
  end if;

  if requested_role = 'owner' then
    raise exception 'Invalid member role';
  end if;

  select ensured.workspace_id
  into target_workspace_id
  from public.ensure_default_workspace() as ensured
  limit 1;

  if not public.is_workspace_admin(target_workspace_id, current_user_id) then
    raise exception 'Not a workspace admin';
  end if;

  select users.id, users.email
  into target_user_id, target_email
  from auth.users
  where lower(users.email) = normalized_email
  limit 1;

  if target_user_id is null then
    raise exception 'No user found';
  end if;

  if target_user_id = current_user_id then
    raise exception 'Workspace member already exists';
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

  if exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = target_user_id
  ) then
    raise exception 'Workspace member already exists';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (target_workspace_id, target_user_id, requested_role)
  returning * into inserted_member;

  return query
  select
    inserted_member.workspace_id,
    profiles.id,
    profiles.display_name,
    profiles.avatar_url,
    profiles.avatar_tone,
    profiles.bio,
    profiles.status,
    profiles.last_seen,
    inserted_member.role,
    inserted_member.joined_at
  from public.profiles
  where profiles.id = target_user_id;
end;
$$;

create or replace function public.remove_workspace_member(member_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_workspace_id uuid;
  target_role public.member_role;
begin
  if current_user_id is null then
    raise exception 'Not authorized';
  end if;

  if member_user_id = current_user_id then
    raise exception 'Cannot remove yourself';
  end if;

  select ensured.workspace_id
  into target_workspace_id
  from public.ensure_default_workspace() as ensured
  limit 1;

  if not public.is_workspace_admin(target_workspace_id, current_user_id) then
    raise exception 'Not a workspace admin';
  end if;

  select wm.role
  into target_role
  from public.workspace_members wm
  where wm.workspace_id = target_workspace_id
    and wm.user_id = member_user_id;

  if target_role is null then
    raise exception 'Not a workspace member';
  end if;

  if target_role = 'owner' then
    raise exception 'Cannot remove owner';
  end if;

  delete from public.conversation_members cm
  using public.conversations conversation
  where cm.conversation_id = conversation.id
    and conversation.workspace_id = target_workspace_id
    and cm.user_id = member_user_id;

  delete from public.workspace_members wm
  where wm.workspace_id = target_workspace_id
    and wm.user_id = member_user_id;
end;
$$;

drop function if exists public.update_workspace_member_role(uuid, public.member_role);

create or replace function public.update_workspace_member_role(
  member_user_id uuid,
  requested_role public.member_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_workspace_id uuid;
  target_role public.member_role;
begin
  if current_user_id is null then
    raise exception 'Not authorized';
  end if;

  if requested_role = 'owner' then
    raise exception 'Invalid member role';
  end if;

  select ensured.workspace_id
  into target_workspace_id
  from public.ensure_default_workspace() as ensured
  limit 1;

  if not public.is_workspace_admin(target_workspace_id, current_user_id) then
    raise exception 'Not a workspace admin';
  end if;

  select wm.role
  into target_role
  from public.workspace_members wm
  where wm.workspace_id = target_workspace_id
    and wm.user_id = member_user_id;

  if target_role is null then
    raise exception 'Not a workspace member';
  end if;

  if target_role = 'owner' then
    raise exception 'Cannot change owner role';
  end if;

  update public.workspace_members wm
  set role = requested_role
  where wm.workspace_id = target_workspace_id
    and wm.user_id = member_user_id;
end;
$$;

grant execute on function public.ensure_default_workspace() to authenticated;
grant execute on function public.add_workspace_member_by_email(text, public.member_role) to authenticated;
grant execute on function public.remove_workspace_member(uuid) to authenticated;
grant execute on function public.update_workspace_member_role(uuid, public.member_role) to authenticated;
grant execute on function public.can_insert_conversation_member(uuid, uuid, uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'workspaces'
    ) then
      alter publication supabase_realtime add table public.workspaces;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'workspace_members'
    ) then
      alter publication supabase_realtime add table public.workspace_members;
    end if;
  end if;
end $$;
