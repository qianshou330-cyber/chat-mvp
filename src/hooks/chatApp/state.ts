import type {
  ChatState,
  ContactRequest,
  Conversation,
  ConversationMember,
  MemberRole,
  Message,
  Profile,
  WorkspaceMember,
  WorkspaceRole,
} from '../../types'

export function upsertMessage(messages: Message[], incoming: Message) {
  const exists = messages.some((message) => message.id === incoming.id)
  return exists
    ? messages.map((message) => (message.id === incoming.id ? incoming : message))
    : [...messages, incoming]
}

export function upsertProfile(profiles: Profile[], incoming: Profile) {
  const exists = profiles.some((profile) => profile.id === incoming.id)
  return exists
    ? profiles.map((profile) => {
        if (profile.id !== incoming.id) return profile
        const shouldPreserveVideo =
          profile.avatarMediaType === 'video' &&
          incoming.avatarMediaType === 'image' &&
          !incoming.avatarVideoUrl &&
          incoming.avatarUrl === profile.avatarUrl

        return shouldPreserveVideo
          ? {
              ...profile,
              ...incoming,
              avatarMediaType: profile.avatarMediaType,
              avatarVideoUrl: profile.avatarVideoUrl,
              avatarVideoPosterUrl: profile.avatarVideoPosterUrl,
              avatarVideoUpdatedAt: profile.avatarVideoUpdatedAt,
            }
          : incoming
      })
    : [...profiles, incoming]
}

export function upsertContact(contacts: ContactRequest[], incoming: ContactRequest) {
  const exists = contacts.some(
    (contact) =>
      contact.id === incoming.id ||
      (contact.ownerId === incoming.ownerId && contact.contactId === incoming.contactId),
  )
  return exists
    ? contacts.map((contact) =>
        contact.id === incoming.id ||
        (contact.ownerId === incoming.ownerId && contact.contactId === incoming.contactId)
          ? { ...contact, ...incoming }
          : contact,
      )
    : [incoming, ...contacts]
}

export function upsertConversation(conversations: Conversation[], incoming: Conversation) {
  const exists = conversations.some((conversation) => conversation.id === incoming.id)
  return exists
    ? conversations.map((conversation) =>
        conversation.id === incoming.id
          ? {
              ...conversation,
              ...incoming,
              lastMessage: incoming.lastMessage || conversation.lastMessage,
              updatedAt: incoming.lastMessage ? incoming.updatedAt : conversation.updatedAt,
            }
          : conversation,
      )
    : [incoming, ...conversations]
}

export function upsertWorkspaceMember(
  members: WorkspaceMember[],
  incoming: WorkspaceMember,
) {
  const exists = members.some(
    (member) =>
      member.workspaceId === incoming.workspaceId && member.userId === incoming.userId,
  )
  return exists
    ? members.map((member) =>
        member.workspaceId === incoming.workspaceId && member.userId === incoming.userId
          ? { ...member, ...incoming }
          : member,
      )
    : [...members, incoming]
}

export function upsertMembers(
  members: ChatState['members'],
  conversationId: string,
  memberIds: string[],
) {
  const existingIds = new Set(
    members
      .filter((member) => member.conversationId === conversationId)
      .map((member) => member.userId),
  )
  const now = new Date().toISOString()
  return [
    ...members,
    ...memberIds
      .filter((userId) => !existingIds.has(userId))
      .map((userId, index) => ({
        conversationId,
        userId,
        role: index === 0 ? 'owner' as const : 'member' as const,
        isMuted: false,
        joinedAt: now,
      })),
  ]
}

export function upsertConversationMember(
  members: ChatState['members'],
  incoming: ConversationMember,
) {
  const exists = members.some(
    (member) =>
      member.conversationId === incoming.conversationId && member.userId === incoming.userId,
  )

  return exists
    ? members.map((member) =>
        member.conversationId === incoming.conversationId && member.userId === incoming.userId
          ? { ...member, ...incoming }
          : member,
      )
    : [...members, incoming]
}

export function findConversationMember(
  members: ChatState['members'],
  conversationId: string,
  userId: string,
) {
  return members.find(
    (member) => member.conversationId === conversationId && member.userId === userId,
  )
}

export function isGroupManagerRole(role: MemberRole | undefined) {
  return role === 'owner' || role === 'admin'
}

export function getSendBlockReason(
  conversation: Conversation | undefined,
  members: ChatState['members'],
  currentUserId: string,
) {
  if (!conversation || conversation.type !== 'group') return ''

  const currentMember = findConversationMember(members, conversation.id, currentUserId)
  if (!currentMember || isGroupManagerRole(currentMember.role)) return ''
  if (currentMember.isMuted) return '你已被管理员禁言，暂时不能发言。'
  if (conversation.isMuted) return '本群已开启全体禁言，仅管理员可发言。'
  return ''
}

export function canDeleteGroupMessage(
  conversation: Conversation | undefined,
  members: ChatState['members'],
  message: Message | undefined,
  currentUserId: string,
) {
  if (!conversation || conversation.type !== 'group' || !message || message.deletedAt) return false

  const currentMember = findConversationMember(members, conversation.id, currentUserId)
  const senderMember = findConversationMember(members, conversation.id, message.senderId)
  const isOwnRecentMessage =
    message.senderId === currentUserId &&
    Date.now() - Date.parse(message.createdAt) <= 2 * 60 * 1000

  return isOwnRecentMessage || (isGroupManagerRole(currentMember?.role) && senderMember?.role === 'member')
}

export function latestConversationMessage(conversationId: string, messages: Message[]) {
  return [...messages]
    .filter((message) => message.conversationId === conversationId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]
}

export function conversationLastMessageText(message: Message | undefined) {
  if (!message) return ''
  if (message.deletedAt) return '已删除消息'
  if (message.attachment?.deletedAt) return '附件已隐藏'
  if (message.type === 'image') {
    return message.body && message.body !== '图片' ? `图片：${message.body}` : '图片'
  }
  if (message.type === 'video') {
    return message.body && message.body !== '视频' ? `视频：${message.body}` : '视频'
  }
  if (message.type === 'file') {
    return `文件：${message.attachment?.fileName ?? message.body}`
  }
  return message.body
}

export function markMessageDeleted(
  state: ChatState,
  conversationId: string,
  messageId: string,
  deletedBy: string,
  deleteReason: string,
) {
  const deletedAt = new Date().toISOString()
  const messages = state.messages.map((message) =>
    message.id === messageId
      ? {
          ...message,
          deletedAt,
          deletedBy,
          deleteReason,
          attachment: undefined,
        }
      : message,
  )
  const latestMessage = latestConversationMessage(conversationId, messages)

  return {
    ...state,
    messages,
    conversations: state.conversations.map((conversation) =>
      conversation.id === conversationId
        ? {
            ...conversation,
            pinnedMessageId:
              conversation.pinnedMessageId === messageId ? undefined : conversation.pinnedMessageId,
            lastMessage: conversationLastMessageText(latestMessage),
            updatedAt: deletedAt,
          }
        : conversation,
    ),
  }
}

export function markAttachmentHidden(
  state: ChatState,
  conversationId: string,
  attachmentId: string,
  deletedBy: string,
) {
  const deletedAt = new Date().toISOString()
  const messages = state.messages.map((message) =>
    message.conversationId === conversationId && message.attachment?.id === attachmentId
      ? {
          ...message,
          attachment: {
            ...message.attachment,
            url: '#',
            deletedAt,
            deletedBy,
            deleteReason: 'hidden',
          },
        }
      : message,
  )
  const latestMessage = latestConversationMessage(conversationId, messages)

  return {
    ...state,
    messages,
    conversations: state.conversations.map((conversation) =>
      conversation.id === conversationId
        ? {
            ...conversation,
            lastMessage: conversationLastMessageText(latestMessage),
            updatedAt: deletedAt,
          }
        : conversation,
    ),
  }
}

export function findDirectConversation(
  conversations: Conversation[],
  firstUserId: string,
  secondUserId: string,
) {
  return conversations.find(
    (conversation) =>
      conversation.type === 'direct' &&
      conversation.memberIds.includes(firstUserId) &&
      conversation.memberIds.includes(secondUserId),
  )
}

export function isWorkspaceManager(role: WorkspaceRole) {
  return role === 'owner' || role === 'admin'
}

export function workspaceRoleRank(role: WorkspaceRole) {
  if (role === 'owner') return 0
  if (role === 'admin') return 1
  return 2
}

export function withNewMessage(state: ChatState, message: Message): ChatState {
  return {
    ...state,
    messages: upsertMessage(state.messages, message),
    conversations: state.conversations.map((conversation) =>
      conversation.id === message.conversationId
        ? {
            ...conversation,
            lastMessage: conversationLastMessageText(message),
            updatedAt: message.createdAt,
            unreadCount: 0,
          }
        : conversation,
    ),
  }
}
