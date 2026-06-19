alter table public.admin_activity_logs
drop constraint if exists admin_activity_logs_action_check;

alter table public.admin_activity_logs
add constraint admin_activity_logs_action_check
check (
  action in (
    'member_added',
    'member_removed',
    'member_role_updated',
    'other_devices_revoked',
    'group_member_added',
    'group_member_removed',
    'group_member_role_updated',
    'group_renamed',
    'message_deleted',
    'group_announcement_updated',
    'message_pinned',
    'message_unpinned',
    'attachment_hidden'
  )
);
