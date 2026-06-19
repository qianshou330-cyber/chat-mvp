# Chat MVP

Telegram-style mobile PWA MVP for chat, built with React, TypeScript, Vite, Supabase, and a demo fallback mode.

生产 beta 地址：`https://chat-mvp-tau.vercel.app`

当前阶段：`v0.6.8-beta` 真实生产试用启动闸门，重点用临时 A/B/C 生产账号完成 Chrome smoke，确认权限、通知、媒体、群管理和试用巡检后，再启动 20-30 人公司试用。

## 已包含能力

- 移动优先聊天 UI：登录、聊天列表、好友申请、单聊、群聊信息和个人资料设置。
- 无后端凭据也能打开的 Demo 模式。
- Supabase 邮箱密码登录、Realtime 消息、Storage 上传和 signed URL 下载。
- Supabase schema、RLS、头像上传 bucket、好友申请 RPC migrations，位于 `supabase/migrations`。
- 附件类型校验和 10 MB 上传限制；支持图片、视频、PDF 和文本文件；头像图片限制 2 MB，视频头像会自动处理到 5 秒/5 MB 内。
- 客户端消息搜索：支持聊天列表搜索和当前会话搜索。
- Web Push/PWA 通知基础设施：浏览器订阅、Supabase 订阅表、Edge Function 和隐私保护通知 payload。
- v0.3 公司试用基础设施：默认工作区、管理员成员管理、群聊工作区归属和登录设备管理。
- v0.4 稳定化基础设施：关键错误记录、管理员操作记录和管理员可见的最近记录入口。
- v0.6 公司试用稳定化：群详情内可复制邀请说明、管理员试用巡检摘要、最近错误/通知/附件失败观察入口、聊天主界面视觉收口，以及 v0.6.2 的首屏 bundle 和 PWA 构建收口。
- GitHub Actions CI、Vercel 部署配置、PWA manifest 和 app icon。
- Figma 和 Lovable 交接文档，位于 `docs/`。

## Local Development

```bash
npm install
npm run dev
```

The app runs in demo mode until Supabase variables are configured.

## Supabase Setup

1. Create a Supabase project.
2. Apply all SQL files in `supabase/migrations` in filename order.
3. Enable the Email Auth provider and turn off email confirmation for local MVP testing.
4. Copy `.env.example` to `.env.local`.
5. Fill in:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_CHAT_BUCKET=chat-uploads
VITE_SUPABASE_AVATAR_BUCKET=profile-avatars
VITE_SUPABASE_AVATAR_VIDEO_BUCKET=profile-avatar-videos
VITE_VAPID_PUBLIC_KEY=
```

Allowed attachment types are PNG, JPEG, WebP, MP4, WebM, PDF, plain text, and Markdown. The migrations configure the private `chat-uploads` bucket with the same 10 MB limit used by the client, the public `profile-avatars` bucket for 2 MB profile images, and the public `profile-avatar-videos` bucket for MP4/WebM source files that the browser processes into 5-second, 5 MB video avatars.

v0.3 工作区功能需要运行 `supabase/migrations/20260618000000_workspaces.sql`。运行后新用户会自动拥有默认工作区，新建群聊会归属当前工作区。

v0.3 登录设备管理需要继续运行 `supabase/migrations/20260618010000_device_sessions.sql`。运行后个人资料页会显示“登录设备”，用户可以退出其他设备或移除单台设备。

v0.4 稳定化日志需要运行 `supabase/migrations/20260618020000_operational_logs.sql`。运行后 owner/admin 可以在个人资料页看到最近管理员操作和关键错误。

v0.5 视频动态头像需要运行 `supabase/migrations/20260618100000_video_avatars.sql`。运行后用户可上传 MP4/WebM 视频头像，浏览器会自动裁成方形、截取封面并尽量压缩到 5 秒/5 MB 内；聊天列表仍使用静态封面头像。

v0.5.2 视频消息需要运行 `supabase/migrations/20260618120000_video_messages.sql`。运行后 `messages.message_type` 支持 `video`，聊天附件可发送 MP4/WebM 视频。

## Web Push Setup

1. Generate a VAPID key pair.
2. Add `VITE_VAPID_PUBLIC_KEY` to Vercel and local `.env.local`.
3. Add Supabase Edge Function secrets:

```bash
WEB_PUSH_VAPID_PUBLIC_KEY=
WEB_PUSH_VAPID_PRIVATE_KEY=
WEB_PUSH_SUBJECT=mailto:you@example.com
WEBHOOK_SECRET=
SUPABASE_SERVICE_ROLE_KEY=
```

4. Deploy `supabase/functions/send-message-push`.
5. Create a Supabase Database Webhook for `public.messages` `INSERT` events that calls the function URL and sends `x-webhook-secret: <WEBHOOK_SECRET>`.

Do not add VAPID private keys, webhook secrets, service-role keys, or database passwords to Vercel frontend variables or GitHub.

## Verification

```bash
npm run lint
npm run test
npm run build
npm run e2e
```

## v0.6.5 - v0.6.8 Trial Gate

`v0.6.5-beta` adds local Playwright E2E smoke coverage for the company-trial gate. It runs Demo-mode chat, group details, media preview, and offline composer checks without storing production credentials. See `docs/v0.6.5-e2e-handoff.md`.

`v0.6.6-beta` extends GitHub Actions CI to run Playwright E2E, upload failure reports, and standardize `codex.v065.*` / `codex.v066.*` cleanup rules. See `docs/v0.6.6-ci-e2e-handoff.md`.

`v0.6.7-beta` standardizes the production trial gate: GitHub Actions must be green, Vercel Production must serve the app/PWA assets, Chrome production smoke remains the place for real A/B/C Supabase permission checks, and `codex.v067.*` temporary data must follow the cleanup SOP. See `docs/v0.6.7-production-trial-gate.md`.

`v0.6.8-beta` turns that gate into the real production trial launch check: temporary `codex.v068.*` A/B/C accounts run the full production smoke, the result is recorded in `docs/v0.6.8-production-smoke.md`, and the company-trial launch materials are aligned to this baseline.

## Deployment

Deploy on Vercel and add the public frontend environment variables only. The project is PWA-ready and can be installed from supported mobile browsers.

Use `docs/deployment-checklist.md` before promoting a Preview deployment to Production.

## Beta 外测

使用 `docs/beta-test-plan.md` 安排受邀测试者、反馈格式和 smoke test 数据清理。

使用 `docs/beta-outreach.md` 复制外测邀请文案和测试者检查清单。

使用 `docs/beta-triage.md` 和 `docs/beta-feedback-summary.md` 归类反馈，并决定 v0.3 公司试用版范围。

使用 `docs/company-trial-plan.md` 跟踪 20-30 人公司内部试用前需要补齐的能力。

使用 `docs/v0.2.1-external-test-run.md` 执行当前外测批次，记录测试者、必测路径、P0/P1 和进入 v0.3 的门槛。

使用 `docs/v0.3-implementation-backlog.md` 拆分公司试用版工程任务。

使用 `docs/v0.3-production-smoke-test.md` 记录 v0.3 生产 smoke test 和测试数据清理步骤。

使用 `docs/company-trial-safety.md` 查看隐私说明、数据保留说明、敏感信息提示和管理员使用说明。

使用 `docs/v0.3.1-company-trial-gate.md` 执行 5 人先导和 20-30 人公司内部试用前的闸门检查。

使用 `docs/v0.4-stability-plan.md` 查看错误记录、管理员操作记录和 v0.4 稳定化边界。
使用 `docs/test-data-cleanup-sop.md` 清理生产 smoke test 和自动外测测试数据。
使用 `docs/backup-restore-checklist.md` 做试用前备份、恢复和云端配置检查。
使用 `docs/trial-daily-report-template.md` 记录 5 人先导和 20-30 人试用日报。

使用 `docs/5-person-pilot-kickoff.md` 启动 5 人先导试用，登记试用用户、Day 1 必测路径和扩容闸门。

使用 `docs/2026-07-company-trial-plan.md` 执行 2026 年 7 月公司内部试用和 v0.4.x 稳定化计划。

使用 `docs/v0.4.2-beta.md` 查看 v0.4.2 稳定性补丁范围、验收清单和不做事项。

`v0.6.0-beta` 作为 20-30 人公司试用稳定基线使用。管理员可在群详情复制邀请说明给未注册成员，并通过“更多管理 -> 试用巡检”查看最近错误、通知失败、附件失败和管理操作。

`v0.6.1-beta` 作为试用前运维收口补丁使用：清理 `codex.v060.*` 自动验收数据、补一次真实 Chrome Web Push smoke、同步公司试用文档，并在 `docs/v0.6.1-production-smoke.md` 固定生产 smoke 记录。

`v0.6.2-beta` 作为性能与可维护性补丁使用：拆分群详情/个人资料页懒加载组件，主 JS bundle 从约 `514 kB` 降到约 `489 kB`，并将 PWA service worker 改为 `iife` 构建以消除 `inlineDynamicImports` 警告。记录见 `docs/v0.6.2-performance-handoff.md`。

`v0.6.3-beta` 作为数据层可维护性和消息列表性能补丁使用：`useChatApp()` 对外接口保持不变，纯逻辑拆到 `src/hooks/chatApp/`，聊天页默认先渲染最近 80 条消息并支持“加载更早消息”。记录见 `docs/v0.6.3-maintainability-handoff.md`。

`v0.6.4-beta` 作为实时消息可靠性补丁使用：聊天页显示连接状态，浏览器离线时禁用发送，Realtime 重连后刷新当前数据，文本消息发送失败时保留失败气泡并支持重试/移除。记录见 `docs/v0.6.4-realtime-reliability-handoff.md`。

所有反馈统一进入 GitHub Issues，使用已有的缺陷反馈、体验反馈和功能建议模板。

已知 beta 限制：暂不支持端到端加密、原生移动 App、语音/视频通话和服务端全文搜索。视频动态头像不等于语音/视频通话。当前产品路线图不包含频道和机器人。Web Push 第一版重点支持 Chrome/Edge 和 Android Chrome，iOS/Safari 需要单独验收。
