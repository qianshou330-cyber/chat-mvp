alter table public.profiles
add column if not exists avatar_url text;

alter table public.contacts
alter column status set default 'pending';

update public.contacts
set status = 'accepted'
where status is null
   or status not in ('pending', 'accepted', 'declined');

alter table public.contacts
drop constraint if exists contacts_status_check;

alter table public.contacts
add constraint contacts_status_check
check (status in ('pending', 'accepted', 'declined'));

create index if not exists contacts_contact_idx on public.contacts(contact_id);

drop policy if exists "users manage own contacts" on public.contacts;
drop policy if exists "users read related contacts" on public.contacts;
drop policy if exists "users create pending contact requests" on public.contacts;
drop policy if exists "users delete own pending contacts" on public.contacts;

create policy "users read related contacts"
on public.contacts for select
to authenticated
using (owner_id = auth.uid() or contact_id = auth.uid());

create policy "users create pending contact requests"
on public.contacts for insert
to authenticated
with check (
  owner_id = auth.uid()
  and contact_id <> auth.uid()
  and status = 'pending'
);

create policy "users delete own pending contacts"
on public.contacts for delete
to authenticated
using (
  owner_id = auth.uid()
  and status in ('pending', 'declined')
);

drop policy if exists "users join themselves or admins invite" on public.conversation_members;

create policy "users join themselves or group admins invite"
on public.conversation_members for insert
to authenticated
with check (
  user_id = auth.uid()
  or (
    public.is_conversation_admin(conversation_id)
    and exists (
      select 1
      from public.conversations
      where conversations.id = conversation_id
        and conversations.type = 'group'
    )
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public reads profile avatars" on storage.objects;
drop policy if exists "users upload own profile avatars" on storage.objects;
drop policy if exists "users update own profile avatars" on storage.objects;
drop policy if exists "users delete own profile avatars" on storage.objects;

create policy "public reads profile avatars"
on storage.objects for select
to public
using (bucket_id = 'profile-avatars');

create policy "users upload own profile avatars"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users update own profile avatars"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users delete own profile avatars"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace function public.send_contact_request_by_email(search_email text)
returns table (
  request_id uuid,
  target_profile_id uuid,
  target_display_name text,
  target_avatar_url text,
  target_avatar_tone text,
  target_bio text,
  target_status public.profile_status,
  target_last_seen timestamptz,
  contact_status text,
  created_at timestamptz
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
  existing_contact public.contacts%rowtype;
  reverse_contact public.contacts%rowtype;
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

  select *
  into existing_contact
  from public.contacts
  where owner_id = requester_id
    and contact_id = target_user.id
  limit 1;

  if existing_contact.id is not null then
    if existing_contact.status = 'declined' then
      update public.contacts
      set status = 'pending',
          created_at = now()
      where id = existing_contact.id
      returning * into existing_contact;
    end if;

    return query
    select
      existing_contact.id,
      profiles.id,
      profiles.display_name,
      profiles.avatar_url,
      profiles.avatar_tone,
      profiles.bio,
      profiles.status,
      profiles.last_seen,
      existing_contact.status,
      existing_contact.created_at
    from public.profiles
    where profiles.id = target_user.id;
    return;
  end if;

  select *
  into reverse_contact
  from public.contacts
  where owner_id = target_user.id
    and contact_id = requester_id
  limit 1;

  if reverse_contact.id is not null and reverse_contact.status = 'pending' then
    raise exception 'Incoming contact request already exists';
  end if;

  if reverse_contact.id is not null and reverse_contact.status = 'accepted' then
    insert into public.contacts (owner_id, contact_id, status)
    values (requester_id, target_user.id, 'accepted')
    on conflict (owner_id, contact_id)
    do update set status = 'accepted'
    returning * into existing_contact;

    return query
    select
      existing_contact.id,
      profiles.id,
      profiles.display_name,
      profiles.avatar_url,
      profiles.avatar_tone,
      profiles.bio,
      profiles.status,
      profiles.last_seen,
      existing_contact.status,
      existing_contact.created_at
    from public.profiles
    where profiles.id = target_user.id;
    return;
  end if;

  insert into public.contacts (owner_id, contact_id, status)
  values (requester_id, target_user.id, 'pending')
  returning * into existing_contact;

  return query
  select
    existing_contact.id,
    profiles.id,
    profiles.display_name,
    profiles.avatar_url,
    profiles.avatar_tone,
    profiles.bio,
    profiles.status,
    profiles.last_seen,
    existing_contact.status,
    existing_contact.created_at
  from public.profiles
  where profiles.id = target_user.id;
end;
$$;

create or replace function public.respond_to_contact_request(request_id uuid, action text)
returns table (
  handled_request_id uuid,
  requester_profile_id uuid,
  requester_display_name text,
  requester_avatar_url text,
  requester_avatar_tone text,
  requester_bio text,
  requester_status public.profile_status,
  requester_last_seen timestamptz,
  contact_status text,
  conversation_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  responder_id uuid := auth.uid();
  normalized_action text := lower(trim(coalesce(action, '')));
  request_row public.contacts%rowtype;
  reciprocal_row public.contacts%rowtype;
  existing_conversation_id uuid;
  new_conversation_id uuid;
begin
  if responder_id is null then
    raise exception 'Not authenticated';
  end if;

  if normalized_action in ('accept', 'accepted') then
    normalized_action := 'accepted';
  elsif normalized_action in ('decline', 'declined') then
    normalized_action := 'declined';
  else
    raise exception 'Unknown contact request action';
  end if;

  select *
  into request_row
  from public.contacts
  where id = request_id
    and contact_id = responder_id
    and status = 'pending'
  for update;

  if request_row.id is null then
    raise exception 'Contact request not found';
  end if;

  if normalized_action = 'declined' then
    update public.contacts
    set status = 'declined'
    where id = request_row.id
    returning * into request_row;

    return query
    select
      request_row.id,
      profiles.id,
      profiles.display_name,
      profiles.avatar_url,
      profiles.avatar_tone,
      profiles.bio,
      profiles.status,
      profiles.last_seen,
      request_row.status,
      null::uuid
    from public.profiles
    where profiles.id = request_row.owner_id;
    return;
  end if;

  update public.contacts
  set status = 'accepted'
  where id = request_row.id
  returning * into request_row;

  insert into public.contacts (owner_id, contact_id, status)
  values (responder_id, request_row.owner_id, 'accepted')
  on conflict (owner_id, contact_id)
  do update set status = 'accepted'
  returning * into reciprocal_row;

  select own_membership.conversation_id
  into existing_conversation_id
  from public.conversation_members own_membership
  join public.conversation_members requester_membership
    on requester_membership.conversation_id = own_membership.conversation_id
  join public.conversations conversation
    on conversation.id = own_membership.conversation_id
  where conversation.type = 'direct'
    and own_membership.user_id = responder_id
    and requester_membership.user_id = request_row.owner_id
  limit 1;

  if existing_conversation_id is null then
    insert into public.conversations (type, title, created_by)
    values ('direct', null, responder_id)
    returning id into new_conversation_id;

    insert into public.conversation_members (conversation_id, user_id, role)
    values
      (new_conversation_id, responder_id, 'owner'),
      (new_conversation_id, request_row.owner_id, 'member')
    on conflict do nothing;
  else
    new_conversation_id := existing_conversation_id;
  end if;

  return query
  select
    request_row.id,
    profiles.id,
    profiles.display_name,
    profiles.avatar_url,
    profiles.avatar_tone,
    profiles.bio,
    profiles.status,
    profiles.last_seen,
    request_row.status,
    new_conversation_id
  from public.profiles
  where profiles.id = request_row.owner_id;
end;
$$;

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
begin
  raise exception 'Contact request must be accepted before starting a direct chat';
end;
$$;

grant execute on function public.send_contact_request_by_email(text) to authenticated;
grant execute on function public.respond_to_contact_request(uuid, text) to authenticated;
grant execute on function public.create_direct_conversation_by_email(text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'contacts'
    ) then
      alter publication supabase_realtime add table public.contacts;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'conversation_members'
    ) then
      alter publication supabase_realtime add table public.conversation_members;
    end if;
  end if;
end $$;
