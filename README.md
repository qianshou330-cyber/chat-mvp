# Chat MVP

Telegram-style mobile PWA MVP for chat, built with React, TypeScript, Vite, Supabase, and a demo fallback mode.

生产 beta 地址：`https://chat-mvp-tau.vercel.app`

当前阶段：`v0.8.1-beta` 公开公测候选版；目标是在 2026-07-01 前完成 UI 质感、页面内提示、公开注册风险提示、生产 smoke 和 30 人公测上线清单收口。

## 已包含能力

- 移动优先聊天 UI：登录、聊天列表、好友申请、单聊、群聊信息和个人资料设置。
- 无后端凭据也能打开的 Demo 模式。
- Supabase 邮箱密码登录、Realtime 消息、Storage 上传和 signed URL 下载。
- Supabase schema、RLS、头像上传 bucket、好友申请 RPC migrations，位于 `supabase/migrations`。
- 附件类型校验和 10 MB 上传限制；支持图片、视频、PDF 和文本文件；头像图片限制 2 MB，视频头像会自动处理到 5 秒/5 MB 内。
- 服务端消息搜索：支持聊天列表搜索、当前会话搜索、历史消息分页、搜索结果上下文、类型/发送人/时间筛选和结果加载更多。
- Web Push/PWA 通知基础设施：浏览器订阅、Supabase 订阅表、Edge Function 和隐私保护通知 payload。
- v0.3 公司试用基础设施：默认工作区、管理员成员管理、群聊工作区归属和登录设备管理。
- v0.4 稳定化基础设施：关键错误记录、管理员操作记录和管理员可见的最近记录入口。
- v0.6 公司试用稳定化：群详情内可复制邀请说明、管理员运行状态摘要、最近错误/通知/附件失败观察入口、聊天主界面视觉收口，以及 v0.6.2 的首屏 bundle 和 PWA 构建收口。
- v0.8.1 公开公测收口：登录页敏感信息提醒、详情页轻量化、页面内提示归位、7 月 1 日上线清单和 `codex.v081.*` 临时数据治理。
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

v0.7.0 消息规模与搜索需要运行 `supabase/migrations/20260619000000_message_pagination_search.sql`。运行后聊天页按会话分页加载历史消息，当前会话搜索和全局消息搜索可查询服务端已保存消息。

v0.7.1 搜索体验与历史消息可靠性需要运行 `supabase/migrations/20260619010000_message_search_context.sql`。运行后搜索结果会带消息定位信息，并可按目标消息加载附近历史上下文。

v0.7.2 搜索筛选与结果质量需要运行 `supabase/migrations/20260619020000_message_search_filters.sql`。运行后全局搜索支持类型/时间筛选，当前会话搜索支持类型/发送人/时间筛选。

v0.7.3 搜索结果分页与请求可靠性需要运行 `supabase/migrations/20260620000000_message_search_pagination.sql`。运行后全局搜索和当前会话搜索都支持“加载更多结果”，并使用请求防抖和旧请求丢弃避免结果错乱。

v0.7.4 搜索性能与可观测性需要运行 `supabase/migrations/20260620010000_message_search_performance.sql`。运行后搜索相关索引和 trigram 支持会增强，搜索失败会以脱敏上下文进入现有错误记录。

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

## v0.6.5 - v0.6.9 Trial Gate

`v0.6.5-beta` adds local Playwright E2E smoke coverage for the company-trial gate. It runs Demo-mode chat, group details, media preview, and offline composer checks without storing production credentials. See `docs/v0.6.5-e2e-handoff.md`.

`v0.6.6-beta` extends GitHub Actions CI to run Playwright E2E, upload failure reports, and standardize `codex.v065.*` / `codex.v066.*` cleanup rules. See `docs/v0.6.6-ci-e2e-handoff.md`.

`v0.6.7-beta` standardizes the production trial gate: GitHub Actions must be green, Vercel Production must serve the app/PWA assets, Chrome production smoke remains the place for real A/B/C Supabase permission checks, and `codex.v067.*` temporary data must follow the cleanup SOP. See `docs/v0.6.7-production-trial-gate.md`.

`v0.6.8-beta` turns that gate into the real production trial launch check: temporary `codex.v068.*` A/B/C accounts run the full production smoke, the result is recorded in `docs/v0.6.8-production-smoke.md`, and the company-trial launch materials are aligned to this baseline.

`v0.6.9-beta` is reserved for the first company-trial feedback convergence pass after the `v0.6.8-beta` smoke passes. It records P0/P1/P2 feedback in `docs/v0.6.9-trial-feedback-report.md` and only allows minimal stability, permission, notification, media, member-management, and mobile-blocking fixes.

`v0.7.0-beta` adds server-backed message pagination and message search for longer company-trial conversations. See `docs/v0.7.0-message-scale-search.md`.

`v0.7.1-beta` improves search-result context loading, highlighted result navigation, long-conversation scroll stability, and server-search documentation. See `docs/v0.7.1-search-context-reliability.md`.

`v0.7.2-beta` adds lightweight type, sender, and date filters for message search while keeping the Supabase RPC contains-search approach. See `docs/v0.7.2-search-filters-quality.md`.

`v0.7.3-beta` adds search-result pagination, 300 ms request debounce, stale-response protection, and retryable search errors. See `docs/v0.7.3-search-pagination-reliability.md`.

`v0.7.4-beta` adds search performance indexes and sanitized search failure observability without changing the search RPC response shape. See `docs/v0.7.4-search-performance-handoff.md`.

`v0.7.5-beta` improves search result scope labels, displayed-result counts, selected-filter summaries, and trial-feedback documentation. See `docs/v0.7.5-search-ux-trial-feedback.md`.

`v0.7.6-beta` closes the v0.7 search UX loop with clearer empty/completed states, preserved search state after returning from a result, and search-feedback closure documentation. See `docs/v0.7.6-search-trial-feedback-closure.md`.

`v0.7.7-beta` records the search production-health check, GitHub Issues feedback status, sanitized app-error summary, and A/B/C smoke cleanup. See `docs/v0.7.7-search-trial-health-report.md`.

`v0.8.0-beta` hardens production operations without adding chat features: backup/restore rehearsal checklist, production ops handoff, Web Push health check, permission regression, and temporary smoke cleanup. See `docs/v0.8.0-production-ops-handoff.md`.

`v0.8.1-beta` is the July 1 public beta candidate. It keeps registration open, adds public-beta safety copy, tightens detail-page UI and scoped notices, and uses `docs/v0.8.1-public-beta-launch-checklist.md` as the launch gate.

## Deployment

Deploy on Vercel and add the public frontend environment variables only. The project is PWA-ready and can be installed from supported mobile browsers.

Use `docs/deployment-checklist.md` before promoting a Preview deployment to Production.

## Beta 外测

使用 `docs/beta-test-plan.md` 安排 2026-07-01 公开公测、反馈格式和 smoke test 数据清理。

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

使用 `docs/v0.8.1-public-beta-launch-checklist.md` 执行 2026-07-01 公开公测上线前、上线当天和上线后 72 小时巡检。

使用 `docs/v0.4.2-beta.md` 查看 v0.4.2 稳定性补丁范围、验收清单和不做事项。

`v0.6.0-beta` 作为 20-30 人公司试用稳定基线使用。管理员可在群详情复制邀请说明给未注册成员，并通过“更多管理 -> 运行状态”查看最近错误、通知失败、附件失败和管理操作。

`v0.6.1-beta` 作为试用前运维收口补丁使用：清理 `codex.v060.*` 自动验收数据、补一次真实 Chrome Web Push smoke、同步公司试用文档，并在 `docs/v0.6.1-production-smoke.md` 固定生产 smoke 记录。

`v0.6.2-beta` 作为性能与可维护性补丁使用：拆分群详情/个人资料页懒加载组件，主 JS bundle 从约 `514 kB` 降到约 `489 kB`，并将 PWA service worker 改为 `iife` 构建以消除 `inlineDynamicImports` 警告。记录见 `docs/v0.6.2-performance-handoff.md`。

`v0.6.3-beta` 作为数据层可维护性和消息列表性能补丁使用：`useChatApp()` 对外接口保持不变，纯逻辑拆到 `src/hooks/chatApp/`，聊天页默认先渲染最近 80 条消息并支持“加载更早消息”。记录见 `docs/v0.6.3-maintainability-handoff.md`。

`v0.6.4-beta` 作为实时消息可靠性补丁使用：聊天页显示连接状态，浏览器离线时禁用发送，Realtime 重连后刷新当前数据，文本消息发送失败时保留失败气泡并支持重试/移除。记录见 `docs/v0.6.4-realtime-reliability-handoff.md`。

所有反馈统一进入 GitHub Issues，使用已有的缺陷反馈、体验反馈和功能建议模板。

已知 beta 限制：暂不支持端到端加密、原生移动 App、语音/视频通话和企业级全文搜索服务。视频动态头像不等于语音/视频通话。当前产品路线图不包含频道和机器人。Web Push 第一版重点支持 Chrome/Edge 和 Android Chrome，iOS/Safari 需要单独验收。
