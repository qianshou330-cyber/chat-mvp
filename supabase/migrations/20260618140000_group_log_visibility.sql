drop policy if exists "workspace admins read error events" on public.app_error_events;
drop policy if exists "workspace admins read activity logs" on public.admin_activity_logs;

create policy "workspace or group admins read error events"
on public.app_error_events for select
to authenticated
using (
  (
    workspace_id is not null
    and public.is_workspace_admin(workspace_id)
  )
  or (
    context ? 'conversationId'
    and (context->>'conversationId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_conversation_admin((context->>'conversationId')::uuid)
  )
);

create policy "workspace or group admins read activity logs"
on public.admin_activity_logs for select
to authenticated
using (
  public.is_workspace_admin(workspace_id)
  or (
    details ? 'conversationId'
    and (details->>'conversationId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and public.is_conversation_admin((details->>'conversationId')::uuid)
  )
);
