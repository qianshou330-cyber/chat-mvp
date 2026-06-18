create table if not exists public.device_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id text not null check (char_length(trim(device_id)) > 0),
  device_name text not null default '当前设备',
  browser_name text not null default '浏览器',
  platform text not null default 'Web',
  user_agent text not null default '',
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_id)
);

create index if not exists device_sessions_user_idx on public.device_sessions(user_id);
create index if not exists device_sessions_last_seen_idx on public.device_sessions(last_seen_at desc);

drop trigger if exists device_sessions_touch_updated_at on public.device_sessions;
create trigger device_sessions_touch_updated_at
before update on public.device_sessions
for each row execute function public.touch_updated_at();

alter table public.device_sessions enable row level security;

drop policy if exists "users read own device sessions" on public.device_sessions;
drop policy if exists "users create own device sessions" on public.device_sessions;
drop policy if exists "users update own device sessions" on public.device_sessions;

create policy "users read own device sessions"
on public.device_sessions for select
to authenticated
using (user_id = auth.uid());

create policy "users create own device sessions"
on public.device_sessions for insert
to authenticated
with check (user_id = auth.uid());

create policy "users update own device sessions"
on public.device_sessions for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.upsert_device_session(
  requested_device_id text,
  requested_device_name text,
  requested_browser_name text,
  requested_platform text,
  requested_user_agent text
)
returns public.device_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  session_row public.device_sessions%rowtype;
begin
  if current_user_id is null then
    raise exception 'Not authorized';
  end if;

  insert into public.device_sessions (
    user_id,
    device_id,
    device_name,
    browser_name,
    platform,
    user_agent,
    last_seen_at,
    revoked_at
  )
  values (
    current_user_id,
    trim(requested_device_id),
    coalesce(nullif(trim(requested_device_name), ''), '当前设备'),
    coalesce(nullif(trim(requested_browser_name), ''), '浏览器'),
    coalesce(nullif(trim(requested_platform), ''), 'Web'),
    coalesce(requested_user_agent, ''),
    now(),
    null
  )
  on conflict (user_id, device_id)
  do update set
    device_name = excluded.device_name,
    browser_name = excluded.browser_name,
    platform = excluded.platform,
    user_agent = excluded.user_agent,
    last_seen_at = now(),
    revoked_at = null
  returning * into session_row;

  return session_row;
end;
$$;

create or replace function public.revoke_other_device_sessions(current_device_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authorized';
  end if;

  update public.device_sessions
  set revoked_at = coalesce(revoked_at, now())
  where user_id = current_user_id
    and device_id <> trim(current_device_id)
    and revoked_at is null;
end;
$$;

create or replace function public.revoke_device_session(target_device_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authorized';
  end if;

  update public.device_sessions
  set revoked_at = coalesce(revoked_at, now())
  where user_id = current_user_id
    and device_id = trim(target_device_id);
end;
$$;

grant execute on function public.upsert_device_session(text, text, text, text, text) to authenticated;
grant execute on function public.revoke_other_device_sessions(text) to authenticated;
grant execute on function public.revoke_device_session(text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'device_sessions'
    ) then
      alter publication supabase_realtime add table public.device_sessions;
    end if;
  end if;
end $$;
