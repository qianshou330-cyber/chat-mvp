export type ConversationType = 'direct' | 'group'

export type MessageType = 'text' | 'image' | 'file'

export type MessageStatus = 'sending' | 'sent' | 'read'

export type MemberRole = 'owner' | 'admin' | 'member'

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
}
