# Chat MVP

Telegram-style mobile PWA MVP for chat, built with React, TypeScript, Vite, Supabase, and a demo fallback mode.

生产 beta 地址：`https://chat-mvp-tau.vercel.app`

当前阶段：`v0.2-beta` 已冻结，准备进入小范围真实外测和 `v0.2.1-beta` 文档收口。

## 已包含能力

- 移动优先聊天 UI：登录、聊天列表、好友申请、单聊、群聊信息和个人资料设置。
- 无后端凭据也能打开的 Demo 模式。
- Supabase 邮箱密码登录、Realtime 消息、Storage 上传和 signed URL 下载。
- Supabase schema、RLS、头像上传 bucket、好友申请 RPC migrations，位于 `supabase/migrations`。
- 附件类型校验和 10 MB 上传限制；头像仅支持 PNG/JPEG/WebP，限制 2 MB。
- 客户端消息搜索：支持聊天列表搜索和当前会话搜索。
- Web Push/PWA 通知基础设施：浏览器订阅、Supabase 订阅表、Edge Function 和隐私保护通知 payload。
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
VITE_VAPID_PUBLIC_KEY=
```

Allowed attachment types are PNG, JPEG, WebP, PDF, plain text, and Markdown. The migrations configure the private `chat-uploads` bucket with the same 10 MB limit used by the client, plus the public `profile-avatars` bucket for 2 MB profile images.

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
```

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

所有反馈统一进入 GitHub Issues，使用已有的缺陷反馈、体验反馈和功能建议模板。

已知 beta 限制：暂不支持端到端加密、原生移动 App、语音/视频通话、频道、机器人和服务端全文搜索。Web Push 第一版重点支持 Chrome/Edge 和 Android Chrome，iOS/Safari 需要单独验收。
