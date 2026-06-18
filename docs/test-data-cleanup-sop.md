# 测试数据清理 SOP

## 目标

用于清理生产 smoke test 和自动外测留下的临时数据。只处理明确测试前缀，不清理真实试用用户。

## 2026-06-18 清理记录

- 已在 Supabase SQL Editor 删除 65 个测试 Auth 用户。
- 删除后再次查询，测试 Auth 用户数量为 0。
- 已在 Supabase Storage 控制台删除 `chat-uploads` 中的测试对象，包含 `device-smoke-`、`codex-smoke-`、`codex-v03-`、`workspace-smoke-` 和同批测试用户残留附件。
- 已在 SQL Editor 复验，`chat-uploads` 中上述测试对象数量为 0。
- 已完成 v0.4.1 后端 smoke：默认工作区、成员管理、管理员记录、群聊消息、移除后不可读、push subscription RLS 均通过。
- v0.4.1 smoke 使用的 9 个 `codex.v04.smoke.*@example.com` 临时 Auth 用户已删除，复验数量为 0。
- Supabase 阻止直接 SQL 删除 `storage.objects`；测试 Storage 对象需按本 SOP 在 Storage 控制台删除。
- v0.4.2 smoke 使用 `codex.v042.*@example.com` 和 `codex.v042.notify.*@example.com` 临时 Auth 用户；清理前必须先预览命中列表。
- v0.4.2 smoke 可能留下 `codex-v042-` 测试附件；必须通过 Storage 控制台删除，不能直接 SQL 删除 `storage.objects`。
- v0.4.2 smoke 使用的 6 个 `codex.v042.*@example.com` 临时 Auth 用户已在 Supabase 控制台删除，复验数量为 0。
- v0.4.2 smoke 的 `chat-uploads` bucket 已按 `codex-v042` 搜索复验，测试附件数量为 0。
- 5 人先导自动验收使用 `codex.pilot.*@example.com` 临时 Auth 用户；清理前必须先预览命中列表，并确认不包含真实试用成员。
- 5 人先导自动验收可能留下 `codex-pilot-` 测试附件；必须通过 Storage 控制台删除，不能直接 SQL 删除 `storage.objects`。
- v0.4.3-beta 收口已删除 17 个 `codex.pilot.*@example.com` 临时 Auth 用户；复验数量为 0。
- v0.4.3-beta 收口已删除 `chat-uploads` 中唯一 `codex-pilot-` 测试附件；复验数量为 0。

## 测试前缀

清理对象必须匹配这些前缀之一：

- `codex.v02.`
- `codex.v03.`
- `codex.v031.`
- `codex.v04.`
- `codex.v042.`
- `codex.pilot.`
- `codex.push.`
- `codex.browserpush.`
- `codex.directpush.`
- `codex-smoke-`
- `codex-pilot-`
- `codex-v03-`
- `codex-v042-`
- `device-smoke-`
- `workspace-smoke-`

## 清理前预览

在 Supabase SQL Editor 先运行只读预览：

```sql
with test_users as (
  select id, email
  from auth.users
  where email like 'codex.v02.%@example.com'
     or email like 'codex.v03.%@example.com'
     or email like 'codex.v031.%@example.com'
     or email like 'codex.v04.%@example.com'
     or email like 'codex.v042.%@example.com'
     or email like 'codex.pilot.%@example.com'
     or email like 'codex.push.%@example.com'
     or email like 'codex.browserpush.%@example.com'
     or email like 'codex.directpush.%@example.com'
     or email like 'codex-smoke-%@example.com'
)
select 'auth.users' as target, count(*) as rows from test_users
union all
select 'storage.objects', count(*)
from storage.objects objects
where objects.name ilike '%device-smoke-%'
   or objects.name ilike '%codex-smoke-%'
   or objects.name ilike '%codex-pilot-%'
   or objects.name ilike '%codex-v042-%'
   or exists (
     select 1 from test_users
     where objects.owner_id = test_users.id::text
        or objects.name like test_users.id::text || '/%'
   );
```

如果预览命中非测试邮箱，停止清理。

## 推荐清理步骤

1. 先在 SQL Editor 预览命中的测试 Auth 用户和 Storage 对象。
2. 删除测试 Auth 用户。
3. 通过 Supabase `Storage -> chat-uploads/profile-avatars` 文件列表删除测试对象。
4. 再次运行预览，确认匹配数量为 0。
5. 打开生产站点做一次最小 smoke：登录、聊天列表、个人资料、管理员记录。

Auth 用户清理 SQL：

```sql
delete from auth.users users
where users.email like 'codex.v02.%@example.com'
   or users.email like 'codex.v03.%@example.com'
   or users.email like 'codex.v031.%@example.com'
   or users.email like 'codex.v04.%@example.com'
   or users.email like 'codex.v042.%@example.com'
   or users.email like 'codex.pilot.%@example.com'
   or users.email like 'codex.push.%@example.com'
   or users.email like 'codex.browserpush.%@example.com'
   or users.email like 'codex.directpush.%@example.com'
   or users.email like 'codex-smoke-%@example.com'
returning email;
```

Storage 清理不要直接删除 `storage.objects`。Supabase 会阻止这类 SQL，以避免孤儿对象和误删文件。请在控制台进入 `Storage`，按文件名搜索并删除：

- `device-smoke-`
- `codex-smoke-`
- `codex-pilot-`
- `codex-v03-`
- `codex-v042-`
- `workspace-smoke-`

## 安全边界

- 不使用 service role key。
- 不删除没有测试前缀的用户。
- 不运行无 `where` 条件的删除语句。
- 不直接 SQL 删除 `storage.objects`。
- 清理正式试用数据前必须先导出或截图确认影响范围。
