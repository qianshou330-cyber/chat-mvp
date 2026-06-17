# v0.1 Beta 发布说明

## 状态

`v0.1-beta` 是 Chat MVP 的第一版小范围外测基线。

`v0.1.1-beta` 候选基线为 `7c4da01 Add avatar upload and contact requests`，在生产 smoke test 通过后再打 tag。

生产地址：`https://chat-mvp-tau.vercel.app`

## 已包含

- 邮箱和密码注册/登录。
- 修改显示名称、个人简介和头像。
- 通过好友申请审批创建单聊。
- 创建群聊。
- 实时文字消息。
- 私有附件上传和 Supabase signed URL 下载。
- 移动优先 PWA 外壳、manifest 和 service worker。
- 客户端消息搜索：聊天列表搜索和当前会话搜索。

## 安全基线

- 用户数据表已开启 Supabase RLS。
- 附件 bucket 为私有，附件读取使用 signed URL。
- 头像 bucket 只允许用户写入自己的目录。
- Vercel 只保存公开前端环境变量。
- 前端不需要 Supabase secret 或 service role key。

## 暂不包含

- 端到端加密。
- 语音/视频通话。
- 频道、机器人或大规模公开群工具。
- 推送通知。
- 服务端全文搜索。
- 原生手机 App。

## 发布检查

- 本地 `npm run lint`、`npm run test -- --run`、`npm run build` 通过。
- Vercel Production 从 `main` 部署成功。
- Supabase 已运行 `20260617010000_avatar_contact_requests.sql`。
- 生产 smoke test 覆盖 auth、头像、好友申请、单聊、群聊、消息和附件。
- 第三方非成员账号不能读取私聊行或附件元数据。
