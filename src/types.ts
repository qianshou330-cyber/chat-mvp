export type ConversationType = 'direct' | 'group'

export type MessageType = 'text' | 'image' | 'file'

export type MessageStatus = 'sending' | 'sent' | 'read'

export type MemberRole = 'owner' | 'admin' | 'member'

export type WorkspaceRole = MemberRole

export type ProfileStatus = 'online' | 'away' | 'offline'

export type ContactStatus = 'pending' | 'accepted' | 'declined'

export type ContactDirection = 'incoming' | 'outgoing'

export interface AppUser {
  id: string
  email: string
}

export interface Profile {
  id: string
  displayName: string
  avatarUrl: string
  avatarTone: 'blue' | 'green' | 'amber' | 'rose' | 'slate'
  bio: string
  status: ProfileStatus
  lastSeen: string
}

export interface ContactRequest {
  id: string
  ownerId: string
  contactId: string
  status: ContactStatus
  createdAt: string
  direction: ContactDirection
}

export interface Attachment {
  id: string
  fileName: string
  mimeType: string
  sizeBytes: number
  url: string
}

export interface Message {
  id: string
  conversationId: string
  senderId: string
  body: string
  type: MessageType
  status: MessageStatus
  createdAt: string
  deletedAt?: string
  deletedBy?: string
  deleteReason?: string
  attachment?: Attachment
}

export interface ConversationMember {
  conversationId: string
  userId: string
  role: MemberRole
  joinedAt: string
}

export interface Conversation {
  id: string
  type: ConversationType
  title: string
  workspaceId?: string
  memberIds: string[]
  memberCount: number
  unreadCount: number
  updatedAt: string
  lastMessage: string
  announcement?: string
  pinnedMessageId?: string
}

export interface Workspace {
  id: string
  name: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface WorkspaceMember {
  workspaceId: string
  userId: string
  role: WorkspaceRole
  joinedAt: string
}

export interface DeviceSession {
  id: string
  userId: string
  deviceId: string
  deviceName: string
  browserName: string
  platform: string
  lastSeenAt: string
  revokedAt: string
  createdAt: string
}

export type AppErrorModule =
  | 'auth'
  | 'messages'
  | 'attachments'
  | 'notifications'
  | 'workspace_members'
  | 'devices'
  | 'profile'

export interface AppErrorEvent {
  id: string
  workspaceId: string
  userId: string
  module: AppErrorModule
  message: string
  createdAt: string
}

export type AdminActivityAction =
  | 'member_added'
  | 'member_removed'
  | 'member_role_updated'
  | 'other_devices_revoked'
  | 'group_member_added'
  | 'group_member_removed'
  | 'group_member_role_updated'
  | 'group_renamed'
  | 'message_deleted'
  | 'group_announcement_updated'
  | 'message_pinned'
  | 'message_unpinned'

export interface AdminActivityLog {
  id: string
  workspaceId: string
  actorId: string
  targetUserId: string
  action: AdminActivityAction
  result: 'success' | 'failure'
  createdAt: string
}

export interface SearchResult {
  id: string
  conversationId: string
  conversationTitle: string
  kind: 'conversation' | 'message'
  title: string
  snippet: string
  senderName: string
  createdAt: string
}

export interface ChatState {
  profiles: Profile[]
  contacts: ContactRequest[]
  conversations: Conversation[]
  messages: Message[]
  members: ConversationMember[]
  workspaces: Workspace[]
  workspaceMembers: WorkspaceMember[]
  deviceSessions: DeviceSession[]
  appErrorEvents: AppErrorEvent[]
  adminActivityLogs: AdminActivityLog[]
  activeWorkspaceId: string
}
