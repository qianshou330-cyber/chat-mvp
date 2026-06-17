import type { AppUser, ChatState, Conversation, Message, Profile } from '../types'

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
    displayName: 'Alex Chen',
    avatarTone: 'blue',
    bio: 'Building the first chat MVP.',
    status: 'online',
    lastSeen: minutesAgo(0),
  },
  {
    id: 'user-mira',
    displayName: 'Mira Stone',
    avatarTone: 'green',
    bio: 'Product, research, launch notes.',
    status: 'online',
    lastSeen: minutesAgo(2),
  },
  {
    id: 'user-ian',
    displayName: 'Ian Park',
    avatarTone: 'amber',
    bio: 'Frontend and design systems.',
    status: 'away',
    lastSeen: minutesAgo(18),
  },
  {
    id: 'user-nora',
    displayName: 'Nora Lee',
    avatarTone: 'rose',
    bio: 'Backend, data, security.',
    status: 'offline',
    lastSeen: minutesAgo(83),
  },
]

export const demoProfileEmails: Record<string, string> = {
  'mira@example.com': 'user-mira',
  'ian@example.com': 'user-ian',
  'nora@example.com': 'user-nora',
}

export const demoConversations: Conversation[] = [
  {
    id: 'conv-mira',
    type: 'direct',
    title: 'Mira Stone',
    memberIds: ['user-me', 'user-mira'],
    memberCount: 2,
    unreadCount: 2,
    updatedAt: minutesAgo(1),
    lastMessage: 'The mobile layout feels ready for review.',
  },
  {
    id: 'conv-launch',
    type: 'group',
    title: 'Launch Room',
    memberIds: ['user-me', 'user-mira', 'user-ian', 'user-nora'],
    memberCount: 4,
    unreadCount: 5,
    updatedAt: minutesAgo(7),
    lastMessage: 'Nora shared the RLS checklist.',
  },
  {
    id: 'conv-ian',
    type: 'direct',
    title: 'Ian Park',
    memberIds: ['user-me', 'user-ian'],
    memberCount: 2,
    unreadCount: 0,
    updatedAt: minutesAgo(31),
    lastMessage: 'I added the compact message composer.',
  },
]

export const demoMessages: Message[] = [
  {
    id: 'msg-1',
    conversationId: 'conv-mira',
    senderId: 'user-mira',
    body: 'I cleaned up the onboarding copy and kept the screen tight.',
    type: 'text',
    status: 'read',
    createdAt: minutesAgo(24),
  },
  {
    id: 'msg-2',
    conversationId: 'conv-mira',
    senderId: 'user-me',
    body: 'Great. I want the chat list to feel fast and familiar.',
    type: 'text',
    status: 'read',
    createdAt: minutesAgo(18),
  },
  {
    id: 'msg-3',
    conversationId: 'conv-mira',
    senderId: 'user-mira',
    body: 'The mobile layout feels ready for review.',
    type: 'text',
    status: 'read',
    createdAt: minutesAgo(1),
  },
  {
    id: 'msg-4',
    conversationId: 'conv-launch',
    senderId: 'user-nora',
    body: 'RLS should gate every message by conversation membership.',
    type: 'text',
    status: 'read',
    createdAt: minutesAgo(32),
  },
  {
    id: 'msg-5',
    conversationId: 'conv-launch',
    senderId: 'user-ian',
    body: 'I will keep the components compact for smaller phones.',
    type: 'text',
    status: 'read',
    createdAt: minutesAgo(17),
  },
  {
    id: 'msg-6',
    conversationId: 'conv-launch',
    senderId: 'user-me',
    body: 'Perfect. Let us ship the clickable MVP first.',
    type: 'text',
    status: 'sent',
    createdAt: minutesAgo(9),
  },
  {
    id: 'msg-7',
    conversationId: 'conv-launch',
    senderId: 'user-nora',
    body: 'Nora shared the RLS checklist.',
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
    body: 'I added the compact message composer.',
    type: 'text',
    status: 'read',
    createdAt: minutesAgo(31),
  },
]

export const createDemoState = (): ChatState => ({
  profiles: [...demoProfiles],
  conversations: [...demoConversations],
  messages: [...demoMessages],
  members: demoConversations.flatMap((conversation) =>
    conversation.memberIds.map((userId, index) => ({
      userId,
      role: index === 0 ? 'owner' : 'member',
      joinedAt: minutesAgo(120),
    })),
  ),
})
