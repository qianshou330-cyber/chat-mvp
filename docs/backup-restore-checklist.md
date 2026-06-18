# 备份与恢复检查清单

## Supabase

- 确认所有 migration 已按文件名顺序运行。
- 确认 `profiles`、`contacts`、`conversations`、`conversation_members`、`messages`、`attachments`、`workspaces`、`workspace_members`、`device_sessions`、`push_subscriptions`、`app_error_events`、`admin_activity_logs` 均开启 RLS。
- 试用前导出一次 Supabase 项目备份或确认平台自动备份策略。
- 恢复演练时先在非生产项目验证，不直接覆盖生产。

## Storage

- 确认 `chat-uploads` 为私有 bucket。
- 确认 `profile-avatars` 仅用于头像。
- 抽查附件 signed URL 仍需要会话成员权限。
- 按 `docs/test-data-cleanup-sop.md` 清理测试附件，不删除正式用户目录。

## Edge Functions 与 Webhook

- `send-message-push` 已部署。
- Function secrets 只保存在 Supabase：`WEB_PUSH_VAPID_PRIVATE_KEY`、`WEBHOOK_SECRET`、`SUPABASE_SERVICE_ROLE_KEY`。
- Database Webhook 监听 `public.messages INSERT`，并带 `x-webhook-secret`。
- 通知 payload 不包含消息正文、附件名或邮箱。

## Vercel

- 只配置公开前端变量：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`VITE_SUPABASE_CHAT_BUCKET`、`VITE_SUPABASE_AVATAR_BUCKET`、`VITE_VAPID_PUBLIC_KEY`。
- 不配置 Supabase secret、service role、VAPID private key 或 webhook secret。
- 每次发布后检查 Production URL、PWA manifest、service worker 和 SPA 刷新路由。

## 恢复后 Smoke

- 登录和退出。
- 工作区成员管理。
- 单聊、群聊、附件上传和打开。
- 搜索、通知、登录设备。
- owner/admin 可见管理员记录，member/非成员不可见。

