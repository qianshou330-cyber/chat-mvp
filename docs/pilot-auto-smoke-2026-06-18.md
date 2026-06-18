# v0.4.2-beta 5 人先导自动验收记录

## 基线

- 生产站点：`https://chat-mvp-tau.vercel.app`
- 目标版本：`v0.4.2-beta`
- 验收时间：2026-06-18
- 测试账号前缀：`codex.pilot.*`

## 临时账号

- `codex.pilot.owner.20260618111636@example.com`
- `codex.pilot.admin.20260618111636@example.com`
- `codex.pilot.member1.20260618111636@example.com`
- `codex.pilot.member2.20260618111636@example.com`
- `codex.pilot.member3.20260618111636@example.com`
- 额外最小复现账号：`codex.pilot.min.20260618111703@example.com`

> 临时密码未写入仓库、文档或 Issue。后续清理时按测试账号前缀定位。

## 已通过项目

- 5 个临时账号可注册并登录。
- owner 可创建默认工作区。
- owner 可添加 admin/member 到工作区。
- admin 可读取管理员记录。
- member 不能读取管理员记录。
- owner 与 member1 可完成好友申请审批。
- A/B direct chat 消息写入成功。
- 非会话成员不能读取 A/B 私聊消息。
- 当前设备记录可写入 `device_sessions`。

## 阻塞问题

- GitHub Issue：[#7 [缺陷][P1] 生产环境群聊创建被 conversations RLS 阻止](https://github.com/qianshou330-cyber/chat-mvp/issues/7)
- 复现：owner 是默认工作区 owner，且可读取自己的 `workspace_members`，但直接创建 `conversations` 时被 RLS 拒绝。
- 影响：群聊创建路径无法通过，5 人先导不能继续作为通过状态。
- 处理：进入 v0.4.3 最小修复，新增服务端 RPC 原子创建群聊，不放宽表级 RLS。

## v0.4.3 修复复验

- 修复提交：`ae5a636 Fix group creation through RPC`
- 已在 Supabase SQL Editor 运行：`20260618030000_group_creation_rpc.sql`
- 已确认 Vercel 生产 bundle 包含 `create_group_conversation`。
- 后端最小复验账号：`codex.pilot.rpc.20260618112415@example.com`
- 5 人脚本化复验账号：
  - `codex.pilot.v043.owner.20260618112740@example.com`
  - `codex.pilot.v043.admin.20260618112740@example.com`
  - `codex.pilot.v043.member1.20260618112740@example.com`
  - `codex.pilot.v043.member2.20260618112740@example.com`
  - `codex.pilot.v043.member3.20260618112740@example.com`
- 复验通过项：
  - owner 默认工作区创建成功。
  - owner 添加 4 名成员成功。
  - admin 角色调整成功。
  - admin 可读管理员记录，member 不可读。
  - 好友申请、同意、direct chat 消息成功。
  - 非 direct 成员不可读取私聊消息。
  - `create_group_conversation` 创建工作区群聊成功。
  - owner 将 admin/member 加入群聊成功。
  - 群消息、中文关键词查询成功。
  - 附件上传、成员读取 attachment row、成员创建 signed URL 成功。
  - member3 被移除工作区后，不能读取工作区群聊消息和附件。
  - member3 加回工作区和群聊成功，保持 5 人先导环境完整。
  - 登录设备记录存在。
  - push subscription RLS 通过。
- Chrome 前端补验：
  - admin 临时账号可登录生产站点。
  - 左上角菜单“新建群聊”通过真实 UI 创建成功，并进入消息输入页。
  - 个人资料页显示工作区管理、管理员记录、登录设备和消息通知。
  - 点击“开启通知”后显示“消息通知已开启”。
  - owner 发送消息后，真实 FCM push subscription 的 `last_sent_at` 更新，`last_error` 为 null。

## 当前结论

`v0.4.2-beta` 自动先导发现 P1，因此不再作为 5 人先导最终基线。`ae5a636` 修复候选已通过脚本化 5 人复验、生产 UI 群聊创建补验和通知链路补验，可作为 `v0.4.3-beta` 候选。
