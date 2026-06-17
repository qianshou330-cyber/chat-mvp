# v0.1 Beta 发布说明

## 状态

`v0.1-beta` 是 Chat MVP 的第一版小范围外测版本。

生产地址：`https://chat-mvp-tau.vercel.app`

## 已包含

- 邮箱和密码注册/登录。
- 修改显示名称和个人简介。
- 通过已注册邮箱添加联系人并创建单聊。
- 创建群聊。
- 实时文字消息。
- 私有附件上传和 Supabase signed URL 下载。
- 移动优先 PWA 外壳、manifest 和 service worker。

## 安全基线

- 用户数据表已开启 Supabase RLS。
- Storage bucket 是私有的。
- 附件读取使用 signed URL。
- Vercel 只保存公开前端环境变量。
- 前端不需要 active Supabase secret key。

## 暂不包含

- 端到端加密。
- 语音/视频通话。
- 频道、机器人或大规模公开群工具。
- 推送通知。
- 消息搜索。
- 原生手机 App。

## 发布检查

- 本地 `npm run lint`、`npm run test`、`npm run build` 通过。
- GitHub Actions 在 `main` 通过。
- Vercel Production 从 `main` 部署。
- 生产 smoke test 覆盖 auth、单聊、群聊、消息和附件。
- 第三方非成员账号不能读取私聊行或附件元数据。
