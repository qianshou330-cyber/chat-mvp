# 测试数据清理 SOP

## 目标

用于清理生产 smoke test 和自动外测留下的临时数据。只处理明确测试前缀，不清理真实试用用户。

## 2026-06-18 清理记录

- 已在 Supabase SQL Editor 删除 65 个测试 Auth 用户。
- 删除后再次查询，测试 Auth 用户数量为 0。
- Supabase 阻止直接 SQL 删除 `storage.objects`；测试 Storage 对象需按本 SOP 在 Storage 控制台删除。

## 测试前缀

清理对象必须匹配这些前缀之一：

- `codex.v02.`
- `codex.v03.`
- `codex.v031.`
- `codex.v04.`
- `codex.push.`
- `codex.browserpush.`
- `codex.directpush.`
- `codex-smoke-`
- `device-smoke-`

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
3. 再次运行预览，确认匹配数量为 0。
4. 打开生产站点做一次最小 smoke：登录、聊天列表、个人资料、管理员记录。

Auth 用户清理 SQL：

```sql
delete from auth.users users
where users.email like 'codex.v02.%@example.com'
   or users.email like 'codex.v03.%@example.com'
   or users.email like 'codex.v031.%@example.com'
   or users.email like 'codex.v04.%@example.com'
   or users.email like 'codex.push.%@example.com'
   or users.email like 'codex.browserpush.%@example.com'
   or users.email like 'codex.directpush.%@example.com'
   or users.email like 'codex-smoke-%@example.com'
returning email;
```

Storage 清理不要直接删除 `storage.objects`。Supabase 会阻止这类 SQL，以避免孤儿对象和误删文件。请在控制台进入 `Storage`，按文件名搜索并删除：

- `device-smoke-`
- `codex-smoke-`
- `codex-v03-`
- `workspace-smoke-`

## 安全边界

- 不使用 service role key。
- 不删除没有测试前缀的用户。
- 不运行无 `where` 条件的删除语句。
- 不直接 SQL 删除 `storage.objects`。
- 清理正式试用数据前必须先导出或截图确认影响范围。
