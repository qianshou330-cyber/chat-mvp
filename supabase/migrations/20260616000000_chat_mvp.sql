create extension if not exists pgcrypto;

create type public.conversation_type as enum ('direct', 'group');
create type public.message_type as enum ('text', 'image', 'file');
create type public.message_status as enum ('sending', 'sent', 'read');
create type public.member_role as enum ('owner', 'admin', 'member');
create type public.profile_status as enum ('online', 'away', 'offline');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  avatar_tone text not null default 'blue',
  bio text not null default '',
  status public.profile_status not null default 'offline',
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'accepted',
  created_at timestamptz not null default now(),
  unique (owner_id, contact_id),
  check (owner_id <> contact_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  type public.conversation_type not null,
  title text,
  avatar_url text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, user_id)
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  bucket_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  message_type public.message_type not null default 'text',
  attachment_id uuid references public.attachments(id) on delete set null,
  status public.message_status not null default 'sent',
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create table public.message_reads (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index contacts_owner_idx on public.contacts(owner_id);
create index conversation_members_user_idx on public.conversation_members(user_id);
create index messages_conversation_created_idx on public.messages(conversation_id, created_at);
create index attachments_owner_idx on public.attachments(owner_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger conversations_touch_updated_at
before update on public.conversations
for each row execute function public.touch_updated_at();

create or replace function public.is_conversation_member(
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
    where cm.conversation_id = target_conversation_id
      and cm.user_id = target_user_id
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
    where cm.conversation_id = target_conversation_id
      and cm.user_id = target_user_id
      and cm.role in ('owner', 'admin')
  );
$$;

alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_reads enable row level security;
alter table public.attachments enable row level security;

create policy "profiles are visible to authenticated users"
on public.profiles for select
to authenticated
using (true);

create policy "users insert own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

create policy "users update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "users manage own contacts"
on public.contacts for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "members read conversations"
on public.conversations for select
to authenticated
using (public.is_conversation_member(id));

create policy "authenticated users create conversations"
on public.conversations for insert
to authenticated
with check (created_by = auth.uid());

create policy "admins update conversations"
on public.conversations for update
to authenticated
using (public.is_conversation_admin(id))
with check (public.is_conversation_admin(id));

create policy "members read membership"
on public.conversation_members for select
to authenticated
using (public.is_conversation_member(conversation_id));

create policy "users join themselves or admins invite"
on public.conversation_members for insert
to authenticated
with check (
  user_id = auth.uid()
  or public.is_conversation_admin(conversation_id)
);

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
using (public.is_conversation_member(conversation_id));

create policy "members send messages"
on public.messages for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.is_conversation_member(conversation_id)
);

create policy "senders update own messages"
on public.messages for update
to authenticated
using (sender_id = auth.uid())
with check (sender_id = auth.uid());

create policy "members read read receipts"
on public.message_reads for select
to authenticated
using (
  exists (
    select 1
    from public.messages m
    where m.id = message_id
      and public.is_conversation_member(m.conversation_id)
  )
);

create policy "users write own read receipts"
on public.message_reads for insert
to authenticated
with check (user_id = auth.uid());

create policy "users update own read receipts"
on public.message_reads for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "owners read attachments"
on public.attachments for select
to authenticated
using (owner_id = auth.uid());

create policy "owners create attachments"
on public.attachments for insert
to authenticated
with check (owner_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-uploads',
  'chat-uploads',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain', 'text/markdown']
)
on conflict (id) do update
set file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "users upload to own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'chat-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users read own upload folder"
on storage.objects for select
to authenticated
using (
  bucket_id = 'chat-uploads'
  and (storage.foldername(name))[1] = auth.uid()::text
);
