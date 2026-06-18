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

## 当前结论

`v0.4.2-beta` 暂不进入真实 5 人先导。需要先部署并验证 v0.4.3 群聊创建修复，再重新跑先导 smoke。
