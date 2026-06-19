# Deployment Checklist

## GitHub
- Create the empty repository `qianshou330-cyber/chat-mvp`.
- Add it as `origin` and push `main`.
- Confirm GitHub Actions runs `lint`, `test`, and `build`.

## Supabase
- Create a Supabase project.
- Apply all SQL files in `supabase/migrations` in filename order.
- Enable the Email Auth provider.
- Turn off email confirmation for MVP testing, or configure production SMTP before enabling confirmation.
- Set Auth Site URL to `https://chat-mvp-tau.vercel.app` for production.
- Confirm RLS is enabled on all public user data tables.
- Confirm the private `chat-uploads` bucket exists.
- Confirm the public `profile-avatars` and `profile-avatar-videos` buckets exist.
- Confirm `workspaces`, `workspace_members`, and `device_sessions` exist after v0.3 migrations.
- Confirm `ensure_default_workspace`, `add_workspace_member_by_email`, `add_group_member_by_email`, `remove_workspace_member`, `update_workspace_member_role`, `upsert_device_session`, `revoke_other_device_sessions`, and `revoke_device_session` exist.
- Confirm `app_error_events` and `admin_activity_logs` exist after the v0.4 migration and RLS is enabled.
- Confirm `messages.message_type` accepts `video` after running `20260618120000_video_messages.sql`.
- Deploy the `send-message-push` Edge Function after setting server-only secrets.
- Create a Database Webhook for `public.messages` `INSERT` events with the `x-webhook-secret` header. If the Dashboard Webhook form fails because the internal `supabase_functions` schema is unavailable, install the reviewed `pg_net` trigger fallback that calls the same Edge Function URL with the same header.
- Do not create or use Supabase secret keys for the frontend.

## Vercel
- Import the GitHub repository.
- Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_CHAT_BUCKET`, `VITE_SUPABASE_AVATAR_BUCKET`, `VITE_SUPABASE_AVATAR_VIDEO_BUCKET`, and `VITE_VAPID_PUBLIC_KEY`.
- Confirm Vercel does not contain Supabase secret keys, service-role keys, or database passwords.
- Confirm Vercel does not contain `WEB_PUSH_VAPID_PRIVATE_KEY` or `WEBHOOK_SECRET`.
- Confirm Preview and Production deployments finish successfully.
- Run a mobile browser smoke test on the production URL.

## Smoke Test
- Register or sign in with email and password.
- Create a profile.
- Upload a static avatar and an MP4/WebM video avatar; confirm the profile screen shows processing/upload progress and chat lists still show the static poster.
- Add a registered user by email and open a direct chat.
- Create a group.
- Send a text message.
- Upload an allowed attachment under 10 MB.
- Send an MP4/WebM video message under 10 MB and confirm another member can play it.
- Open the uploaded attachment from another member account.
- Enable notifications on member B, send a message from member A, and confirm B receives a generic notification.
- Confirm `push_subscriptions.last_sent_at` updates without `last_error` after a real browser subscription receives a push.
- Confirm the notification payload does not contain message body, attachment filename, or email.
- Confirm a non-member cannot read conversation rows in Supabase.
- Confirm a non-member cannot read attachment metadata or create a signed download URL.
- Confirm the profile page only shows personal profile, notifications, and “登录设备”.
- Confirm group details show “添加成员”, “群文件”, and owner/admin-only “群管理记录”.
- Confirm `docs/company-trial-safety.md` remains available for company-trial safety guidance.
- Sign in to the same account from two browsers or windows and confirm both devices are listed.
- Use “退出其他设备” and confirm the current device remains signed in while the other device exits after refresh or heartbeat.
- Confirm owner/admin can add and remove group members from group details, while member cannot manage members.
- Confirm a removed group member cannot read group messages or attachments after refresh.
- Confirm owner/admin can see “群管理记录”, while member cannot see that region.
- Trigger one member-management failure and confirm a sanitized error event is created without message body, attachment filename, token, or secret.
- Run `docs/test-data-cleanup-sop.md` after smoke tests if temporary `codex.*` users or test uploads are no longer needed.

## Beta Release
- Tag the beta-ready commit as `v0.2-beta`.
- Tag documentation-only follow-up releases as `v0.2.1-beta` after checks pass.
- Tag the company-trial-ready commit as `v0.3-beta` after v0.3 smoke test passes.
- Tag the company-trial-gate commit as `v0.3.1-beta` after the trial safety entry and smoke test pass.
- Tag the stability baseline as `v0.4-beta` after operational logs pass production smoke test.
- Tag the operational-maintenance baseline as `v0.4.1-beta` after cleanup SOP, backup checklist, daily report template, and production smoke test pass.
- Use `docs/beta-test-plan.md` for tester instructions and issue triage.
- Collect feedback through GitHub Issue templates before prioritizing the next beta scope.
