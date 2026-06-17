# Chat MVP v0.1 Beta 外测计划

## 发布快照

- 版本：`v0.1-beta`
- 生产地址：`https://chat-mvp-tau.vercel.app`
- 基线标签：`v0.1-beta`
- 主分支：`main`
- 目标测试者：3 到 5 名邀请用户
- 跟踪 Issue：https://github.com/qianshou330-cyber/chat-mvp/issues/1

## 测试者准备

请每位测试者在生产地址使用邮箱和密码创建账号。当前 MVP 测试阶段已关闭邮箱确认。

建议测试路径：

1. 创建账号。
2. 修改显示名称和个人简介。
3. 通过邮箱添加另一名已注册测试用户。
4. 发送单聊文字消息。
5. 创建群聊。
6. 上传一个 10 MB 以内的允许类型附件。
7. 退出登录后重新登录。

## 反馈格式

统一使用 GitHub Issues，并选择一个模板：

- 缺陷反馈：功能坏掉或流程被阻塞。
- 体验反馈：看不懂、太慢、不顺手或布局不舒服。
- 功能建议：beta 之后可考虑的新能力。

每条反馈建议包含：

- 测试者邮箱或测试者代号。
- 设备和浏览器。
- 期望发生什么。
- 实际发生什么。
- 必要时附截图或录屏。

使用 `docs/beta-outreach.md` 发送邀请文案和测试者清单。
使用 `docs/beta-triage.md` 分类反馈。
收集至少 10 条反馈后，使用 `docs/beta-feedback-summary.md` 输出总结。

## 已知限制

- 暂不支持端到端加密。
- 暂不提供原生 iOS 或 Android App。
- 暂不支持语音通话、视频通话、频道或机器人。
- 暂不支持推送通知或全文搜索。
- 联系人默认直接接受，暂没有好友申请审批流程。

## 生产 Smoke Test 数据

生产 smoke test 可能会创建带 `codex-smoke-` 邮箱前缀的临时用户和会话。如果这些数据有调试价值，可以暂时保留。需要清理时，请在 Supabase 控制台操作：

1. Authentication -> Users：筛选 `codex-smoke-` 并删除测试用户。
2. Storage -> `chat-uploads`：如果仍有对应测试用户文件夹，手动删除。
3. Table Editor：确认相关 `profiles`、`contacts`、`conversation_members`、`messages`、`attachments` 行已经删除或不会影响测试。

清理时不要创建或恢复 Supabase secret key。使用控制台 owner 登录态即可。
