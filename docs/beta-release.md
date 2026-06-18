# v0.2 Beta 发布说明

## 状态

`v0.2-beta` 是 Chat MVP 当前已冻结的小范围外测基线。

- 标签：`v0.2-beta`
- 基线提交：`5ff3e25 Harden push delivery timeout`
- 旧标签：`v0.1-beta`，保留不移动
- 生产地址：`https://chat-mvp-tau.vercel.app`
- 下一步：`v0.2.1-beta` 文档收口和外测执行

## 已包含

- 邮箱和密码注册/登录。
- 修改显示名称、个人简介和头像。
- 通过好友申请审批创建单聊。
- 创建群聊。
- 实时文字消息。
- 私有附件上传和 Supabase signed URL 下载。
- 移动优先 PWA 外壳、manifest 和 service worker。
- 客户端消息搜索：聊天列表搜索和当前会话搜索。
- Web Push 通知：浏览器订阅、Supabase 订阅表、Edge Function、`pg_net`/Webhook 触发和隐私保护 payload。

## 已完成验收

- 本地 `npm run lint`、`npm run test -- --run`、`npm run build` 通过。
- Vercel Production 从 `main` 部署成功。
- Supabase 已运行全部 migrations。
- 生产 smoke test 覆盖登录、搜索、头像、好友申请、单聊、群聊、消息、附件和通知。
- 真实浏览器 Web Push 验收通过：收件人收到“你有一条新消息”，发送者不收到自己的消息通知。
- `push_subscriptions.last_sent_at` 已在真实推送后更新，`last_error` 为空。
- 第三方非成员账号不能读取私聊行、附件元数据或他人的 push subscription。

## 安全基线

- 用户数据表已开启 Supabase RLS。
- 附件 bucket 为私有，附件读取使用 signed URL。
- 头像 bucket 只允许用户写入自己的目录。
- 推送通知 payload 不包含消息正文、附件名或邮箱。
- Vercel 只保存公开前端环境变量。
- 前端不需要 Supabase secret、service role key、VAPID private key 或 webhook secret。

## 暂不包含

- 端到端加密。
- 原生 iOS 或 Android App。
- 语音/视频通话。
- 频道、机器人或大规模公开群工具。
- 服务端全文搜索。
- 团队/工作区、管理员成员管理和多端设备管理，这些进入 `v0.3` 公司试用版。
- 视频动态头像，排到 `v0.5+`。

## v0.2.1 发布收口

`v0.2.1-beta` 用于文档和外测流程收口，不改变 `v0.2-beta` 的功能边界。

- README 和 `docs/` 统一为 `v0.2-beta` 当前状态。
- 补充 Web Push Dashboard Webhook 失败时的 `pg_net` 等效触发器说明。
- 补充 20-30 人公司试用版路线。
- 保持不提交任何 private key、service role key、webhook secret 或数据库密码。
