create or replace function public.create_direct_conversation_by_email(search_email text)
returns table (
  conversation_id uuid,
  target_profile_id uuid,
  target_display_name text,
  target_avatar_tone text,
  target_bio text,
  target_status public.profile_status,
  target_last_seen timestamptz,
  was_existing boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  requester_id uuid := auth.uid();
  requester_email text;
  normalized_email text := coalesce(lower(trim(search_email)), '');
  target_user record;
  existing_conversation_id uuid;
  new_conversation_id uuid;
begin
  if requester_id is null then
    raise exception 'Not authenticated';
  end if;

  if normalized_email = '' then
    raise exception 'Enter an email address';
  end if;

  select users.id, users.email
  into target_user
  from auth.users
  where lower(users.email) = normalized_email
  limit 1;

  if target_user.id is null then
    raise exception 'No user found';
  end if;

  if target_user.id = requester_id then
    raise exception 'You cannot add yourself';
  end if;

  select users.email
  into requester_email
  from auth.users
  where users.id = requester_id;

  insert into public.profiles (id, display_name, bio, avatar_tone, status)
  values (
    requester_id,
    split_part(coalesce(requester_email, 'member@example.com'), '@', 1),
    '',
    'blue',
    'online'
  )
  on conflict (id) do nothing;

  insert into public.profiles (id, display_name, bio, avatar_tone, status)
  values (
    target_user.id,
    split_part(coalesce(target_user.email, 'member@example.com'), '@', 1),
    '',
    'blue',
    'offline'
  )
  on conflict (id) do nothing;

  insert into public.contacts (owner_id, contact_id, status)
  values (requester_id, target_user.id, 'accepted')
  on conflict (owner_id, contact_id) do nothing;

  insert into public.contacts (owner_id, contact_id, status)
  values (target_user.id, requester_id, 'accepted')
  on conflict (owner_id, contact_id) do nothing;

  select own_membership.conversation_id
  into existing_conversation_id
  from public.conversation_members own_membership
  join public.conversation_members target_membership
    on target_membership.conversation_id = own_membership.conversation_id
  join public.conversations conversation
    on conversation.id = own_membership.conversation_id
  where conversation.type = 'direct'
    and own_membership.user_id = requester_id
    and target_membership.user_id = target_user.id
  limit 1;

  if existing_conversation_id is null then
    insert into public.conversations (type, title, created_by)
    values ('direct', null, requester_id)
    returning id into new_conversation_id;

    insert into public.conversation_members (conversation_id, user_id, role)
    values
      (new_conversation_id, requester_id, 'owner'),
      (new_conversation_id, target_user.id, 'member');
  else
    new_conversation_id := existing_conversation_id;
  end if;

  return query
  select
    new_conversation_id,
    profiles.id,
    profiles.display_name,
    profiles.avatar_tone,
    profiles.bio,
    profiles.status,
    profiles.last_seen,
    existing_conversation_id is not null
  from public.profiles
  where profiles.id = target_user.id;
end;
$$;

grant execute on function public.create_direct_conversation_by_email(text) to authenticated;
