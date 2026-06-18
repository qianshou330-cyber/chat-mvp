import type {
  AppUser,
  ChatState,
  ContactRequest,
  Conversation,
  AdminActivityLog,
  AppErrorEvent,
  Message,
  Profile,
  Workspace,
  WorkspaceMember,
  DeviceSession,
} from '../types'

const now = new Date()

const minutesAgo = (minutes: number) =>
  new Date(now.getTime() - minutes * 60 * 1000).toISOString()

export const demoUser: AppUser = {
  id: 'user-me',
  email: 'founder@example.com',
}

export const demoProfiles: Profile[] = [
  {
    id: 'user-me',
    displayName: '陈启明',
    avatarUrl: '',
    avatarMediaType: 'image',
    avatarVideoUrl: '',
    avatarVideoPosterUrl: '',
    avatarVideoUpdatedAt: '',
    avatarTone: 'blue',
    bio: '正在打磨第一版聊天 MVP。',
    status: 'online',
    lastSeen: minutesAgo(0),
  },
  {
    id: 'user-mira',
    displayName: '林小米',
    avatarUrl: '',
    avatarMediaType: 'image',
    avatarVideoUrl: '',
    avatarVideoPosterUrl: '',
    avatarVideoUpdatedAt: '',
    avatarTone: 'green',
    bio: '负责产品、调研和发布记录。',
    status: 'online',
    lastSeen: minutesAgo(2),
  },
  {
    id: 'user-ian',
    displayName: '周一凡',
    avatarUrl: '',
    avatarMediaType: 'image',
    avatarVideoUrl: '',
    avatarVideoPosterUrl: '',
    avatarVideoUpdatedAt: '',
    avatarTone: 'amber',
    bio: '负责前端和设计系统。',
    status: 'away',
    lastSeen: minutesAgo(18),
  },
  {
    id: 'user-nora',
    displayName: '李诺拉',
    avatarUrl: '',
    avatarMediaType: 'image',
    avatarVideoUrl: '',
    avatarVideoPosterUrl: '',
    avatarVideoUpdatedAt: '',
    avatarTone: 'rose',
    bio: '负责后端、数据和安全。',
    status: 'offline',
    lastSeen: minutesAgo(83),
  },
  {
    id: 'user-zoe',
    displayName: '宋知夏',
    avatarUrl: '',
    avatarMediaType: 'image',
    avatarVideoUrl: '',
    avatarVideoPosterUrl: '',
    avatarVideoUpdatedAt: '',
    avatarTone: 'slate',
    bio: '准备参加第一轮外测。',
    status: 'offline',
    lastSeen: minutesAgo(144),
  },
]

export const demoProfileEmails: Record<string, string> = {
  'mira@example.com': 'user-mira',
  'ian@example.com': 'user-ian',
  'nora@example.com': 'user-nora',
  'zoe@example.com': 'user-zoe',
}

export const demoContacts: ContactRequest[] = [
  {
    id: 'contact-me-mira',
    ownerId: 'user-me',
    contactId: 'user-mira',
    status: 'accepted',
    createdAt: minutesAgo(240),
    direction: 'outgoing',
  },
  {
    id: 'contact-me-ian',
    ownerId: 'user-me',
    contactId: 'user-ian',
    status: 'accepted',
    createdAt: minutesAgo(230),
    direction: 'outgoing',
  },
  {
    id: 'contact-nora-me',
    ownerId: 'user-nora',
    contactId: 'user-me',
    status: 'pending',
    createdAt: minutesAgo(12),
    direction: 'incoming',
  },
]

export const demoWorkspaces: Workspace[] = [
  {
    id: 'workspace-demo',
    name: '启明团队',
    createdBy: 'user-me',
    createdAt: minutesAgo(360),
    updatedAt: minutesAgo(12),
  },
]

export const demoWorkspaceMembers: WorkspaceMember[] = [
  {
    workspaceId: 'workspace-demo',
    userId: 'user-me',
    role: 'owner',
    joinedAt: minutesAgo(360),
  },
  {
    workspaceId: 'workspace-demo',
    userId: 'user-mira',
    role: 'admin',
    joinedAt: minutesAgo(340),
  },
  {
    workspaceId: 'workspace-demo',
    userId: 'user-ian',
    role: 'member',
    joinedAt: minutesAgo(330),
  },
  {
    workspaceId: 'workspace-demo',
    userId: 'user-nora',
    role: 'member',
    joinedAt: minutesAgo(320),
  },
]

export const demoDeviceSessions: DeviceSession[] = [
  {
    id: 'device-demo-current',
    userId: 'user-me',
    deviceId: 'demo-current-device',
    deviceName: '当前浏览器',
    browserName: 'Demo 浏览器',
    platform: 'Web',
    lastSeenAt: minutesAgo(0),
    revokedAt: '',
    createdAt: minutesAgo(45),
  },
  {
    id: 'device-demo-tablet',
    userId: 'user-me',
    deviceId: 'demo-tablet-device',
    deviceName: '备用设备',
    browserName: 'Demo 浏览器',
    platform: 'Tablet',
    lastSeenAt: minutesAgo(42),
    revokedAt: '',
    createdAt: minutesAgo(180),
  },
]

export const demoAppErrorEvents: AppErrorEvent[] = [
  {
    id: 'error-demo-attachment',
    workspaceId: 'workspace-demo',
    userId: 'user-me',
    module: 'attachments',
    message: '文件上传失败，请重试。',
    createdAt: minutesAgo(68),
  },
]

export const demoAdminActivityLogs: AdminActivityLog[] = [
  {
    id: 'activity-demo-member-added',
    workspaceId: 'workspace-demo',
    actorId: 'user-me',
    targetUserId: 'user-ian',
    action: 'member_added',
    result: 'success',
    createdAt: minutesAgo(330),
  },
  {
    id: 'activity-demo-role-updated',
    workspaceId: 'workspace-demo',
    actorId: 'user-me',
    targetUserId: 'user-mira',
    action: 'member_role_updated',
    result: 'success',
    createdAt: minutesAgo(300),
  },
]

export const demoConversations: Conversation[] = [
  {
    id: 'conv-mira',
    type: 'direct',
    title: '林小米',
    memberIds: ['user-me', 'user-mira'],
    memberCount: 2,
    unreadCount: 2,
    updatedAt: minutesAgo(1),
    lastMessage: '移动端布局已经可以开始评审了。',
  },
  {
    id: 'conv-launch',
    type: 'group',
    title: '上线准备群',
    workspaceId: 'workspace-demo',
    memberIds: ['user-me', 'user-mira', 'user-ian', 'user-nora'],
    memberCount: 4,
    unreadCount: 5,
    updatedAt: minutesAgo(7),
    lastMessage: '文件：rls-checklist.md',
  },
  {
    id: 'conv-ian',
    type: 'direct',
    title: '周一凡',
    memberIds: ['user-me', 'user-ian'],
    memberCount: 2,
    unreadCount: 0,
    updatedAt: minutesAgo(31),
    lastMessage: '我已经加上紧凑版消息输入框。',
  },
]

export const demoMessages: Message[] = [
  {
    id: 'msg-1',
    conversationId: 'conv-mira',
    senderId: 'user-mira',
    body: '我整理了登录引导文案，界面也尽量保持紧凑。',
    type: 'text',
    status: 'read',
    createdAt: minutesAgo(24),
  },
  {
    id: 'msg-2',
    conversationId: 'conv-mira',
    senderId: 'user-me',
    body: '很好，我希望聊天列表用起来足够快，也足够熟悉。',
    type: 'text',
    status: 'read',
    createdAt: minutesAgo(18),
  },
  {
    id: 'msg-3',
    conversationId: 'conv-mira',
    senderId: 'user-mira',
    body: '移动端布局已经可以开始评审了。',
    type: 'text',
    status: 'read',
    createdAt: minutesAgo(1),
  },
  {
    id: 'msg-4',
    conversationId: 'conv-launch',
    senderId: 'user-nora',
    body: 'RLS 需要按会话成员关系限制每一条消息。',
    type: 'text',
    status: 'read',
    createdAt: minutesAgo(32),
  },
  {
    id: 'msg-5',
    conversationId: 'conv-launch',
    senderId: 'user-ian',
    body: '我会让组件在小屏手机上也保持紧凑。',
    type: 'text',
    status: 'read',
    createdAt: minutesAgo(17),
  },
  {
    id: 'msg-6',
    conversationId: 'conv-launch',
    senderId: 'user-me',
    body: '很好，我们先把可点击的 MVP 发出去。',
    type: 'text',
    status: 'sent',
    createdAt: minutesAgo(9),
  },
  {
    id: 'msg-7',
    conversationId: 'conv-launch',
    senderId: 'user-nora',
    body: '李诺拉分享了 RLS 检查清单。',
    type: 'file',
    status: 'read',
    createdAt: minutesAgo(7),
    attachment: {
      id: 'att-rls',
      fileName: 'rls-checklist.md',
      mimeType: 'text/markdown',
      sizeBytes: 4280,
      url: '#',
    },
  },
  {
    id: 'msg-8',
    conversationId: 'conv-ian',
    senderId: 'user-ian',
    body: '我已经加上紧凑版消息输入框。',
    type: 'text',
    status: 'read',
    createdAt: minutesAgo(31),
  },
]

export const createDemoState = (): ChatState => ({
  profiles: [...demoProfiles],
  contacts: [...demoContacts],
  conversations: [...demoConversations],
  messages: [...demoMessages],
  members: demoConversations.flatMap((conversation) =>
    conversation.memberIds.map((userId, index) => ({
      conversationId: conversation.id,
      userId,
      role: index === 0 ? 'owner' : 'member',
      joinedAt: minutesAgo(120),
      })),
  ),
  workspaces: [...demoWorkspaces],
  workspaceMembers: [...demoWorkspaceMembers],
  deviceSessions: [...demoDeviceSessions],
  appErrorEvents: [...demoAppErrorEvents],
  adminActivityLogs: [...demoAdminActivityLogs],
  activeWorkspaceId: demoWorkspaces[0]?.id ?? '',
})
