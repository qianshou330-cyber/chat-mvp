export type ConversationType = 'direct' | 'group'

export type MessageType = 'text' | 'image' | 'file'

export type MessageStatus = 'sending' | 'sent' | 'read'

export type MemberRole = 'owner' | 'admin' | 'member'

export type ProfileStatus = 'online' | 'away' | 'offline'

export interface AppUser {
  id: string
  email: string
}

export interface Profile {
  id: string
  displayName: string
  avatarTone: 'blue' | 'green' | 'amber' | 'rose' | 'slate'
  bio: string
  status: ProfileStatus
  lastSeen: string
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
  attachment?: Attachment
}

export interface ConversationMember {
  userId: string
  role: MemberRole
  joinedAt: string
}

export interface Conversation {
  id: string
  type: ConversationType
  title: string
  memberIds: string[]
  memberCount: number
  unreadCount: number
  updatedAt: string
  lastMessage: string
}

export interface ChatState {
  profiles: Profile[]
  conversations: Conversation[]
  messages: Message[]
  members: ConversationMember[]
}
