import type { AdminActivityLog, AppErrorEvent, MemberRole, Profile } from '../types'

export function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

export function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`
}

export function formatStatus(status: Profile['status']) {
  if (status === 'online') return '在线'
  if (status === 'away') return '暂离'
  return '离线'
}

export function formatGroupRole(role: MemberRole) {
  if (role === 'owner') return '群 owner'
  if (role === 'admin') return '群管理员'
  return '成员'
}

export function formatAdminActivity(action: AdminActivityLog['action']) {
  if (action === 'member_added') return '添加成员'
  if (action === 'member_removed') return '移除成员'
  if (action === 'member_role_updated') return '调整角色'
  if (action === 'group_member_added') return '添加群成员'
  if (action === 'group_member_removed') return '移除群成员'
  if (action === 'group_member_role_updated') return '调整群角色'
  if (action === 'group_renamed') return '修改群名称'
  if (action === 'message_deleted') return '删除群消息'
  if (action === 'group_announcement_updated') return '更新群公告'
  if (action === 'message_pinned') return '置顶消息'
  if (action === 'message_unpinned') return '取消置顶'
  if (action === 'attachment_hidden') return '隐藏群文件'
  if (action === 'group_muted') return '开启全体禁言'
  if (action === 'group_unmuted') return '解除全体禁言'
  if (action === 'member_muted') return '禁言成员'
  if (action === 'member_unmuted') return '解除成员禁言'
  return '退出其他设备'
}

export function formatErrorModule(module: AppErrorEvent['module']) {
  if (module === 'messages') return '消息错误'
  if (module === 'attachments') return '附件错误'
  if (module === 'notifications') return '通知错误'
  if (module === 'workspace_members') return '成员管理错误'
  if (module === 'devices') return '登录设备错误'
  if (module === 'profile') return '资料错误'
  return '登录错误'
}

export function formatShortDateTime(value: string) {
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return '时间未知'
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).format(timestamp)
}

export function formatDeviceStatus(lastSeenAt: string) {
  const minutes = minutesSince(lastSeenAt)
  if (minutes <= 2) return '在线'
  if (minutes <= 30) return '最近活跃'
  return '离线'
}

export function formatDeviceLastSeen(lastSeenAt: string) {
  const minutes = minutesSince(lastSeenAt)
  if (minutes < 1) return '刚刚活跃'
  if (minutes < 60) return `${minutes} 分钟前`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`

  const days = Math.floor(hours / 24)
  return `${days} 天前`
}

export function minutesSince(value: string) {
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return Number.POSITIVE_INFINITY
  return Math.max(0, Math.floor((Date.now() - timestamp) / 60000))
}

export function displayConversationTitle(title: string) {
  return title === 'New Group' ? '新群聊' : title
}
