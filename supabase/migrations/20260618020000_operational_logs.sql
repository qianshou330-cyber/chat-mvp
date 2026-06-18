create table if not exists public.app_error_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  module text not null check (
    module in (
      'auth',
      'messages',
      'attachments',
      'notifications',
      'workspace_members',
      'devices',
      'profile'
    )
  ),
  message text not null check (char_length(message) <= 500),
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_activity_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  action text not null check (
    action in (
      'member_added',
      'member_removed',
      'member_role_updated',
      'other_devices_revoked'
    )
  ),
  result text not null default 'success' check (result in ('success', 'failure')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists app_error_events_workspace_created_idx
on public.app_error_events(workspace_id, created_at desc);

create index if not exists app_error_events_user_created_idx
on public.app_error_events(user_id, created_at desc);

create index if not exists admin_activity_logs_workspace_created_idx
on public.admin_activity_logs(workspace_id, created_at desc);

alter table public.app_error_events enable row level security;
alter table public.admin_activity_logs enable row level security;

drop policy if exists "users create own error events" on public.app_error_events;
drop policy if exists "workspace admins read error events" on public.app_error_events;
drop policy if exists "workspace admins create activity logs" on public.admin_activity_logs;
drop policy if exists "workspace admins read activity logs" on public.admin_activity_logs;

create policy "users create own error events"
on public.app_error_events for insert
to authenticated
with check (user_id = auth.uid());

create policy "workspace admins read error events"
on public.app_error_events for select
to authenticated
using (
  workspace_id is not null
  and public.is_workspace_admin(workspace_id)
);

create policy "workspace admins create activity logs"
on public.admin_activity_logs for insert
to authenticated
with check (
  actor_id = auth.uid()
  and public.is_workspace_admin(workspace_id)
);

create policy "workspace admins read activity logs"
on public.admin_activity_logs for select
to authenticated
using (public.is_workspace_admin(workspace_id));

grant select, insert on public.app_error_events to authenticated;
grant select, insert on public.admin_activity_logs to authenticated;
