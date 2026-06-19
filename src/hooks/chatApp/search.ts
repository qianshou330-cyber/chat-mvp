import type { Conversation, Message, Profile, SearchResult } from '../../types'

export function buildSearchResults(
  query: string,
  conversations: Conversation[],
  messages: Message[],
  profilesById: Map<string, Profile>,
): SearchResult[] {
  const normalized = normalizeSearch(query)
  if (!normalized) return []

  const results: SearchResult[] = []
  const messagesByConversation = new Map<string, Message[]>()

  messages.forEach((message) => {
    const conversationMessages = messagesByConversation.get(message.conversationId) ?? []
    conversationMessages.push(message)
    messagesByConversation.set(message.conversationId, conversationMessages)
  })

  conversations.forEach((conversation) => {
    const conversationMessages = (messagesByConversation.get(conversation.id) ?? []).filter(
      (message) => !message.deletedAt,
    )
    const memberNames = conversation.memberIds
      .map((memberId) => profilesById.get(memberId)?.displayName)
      .filter(Boolean)
      .join(' ')
    const searchableConversationText = [
      conversation.title,
      conversation.lastMessage,
      memberNames,
    ].join(' ')

    if (matchesSearch(searchableConversationText, normalized)) {
      results.push({
        id: `conversation-${conversation.id}`,
        conversationId: conversation.id,
        conversationTitle: conversation.title,
        kind: 'conversation',
        title: conversation.title,
        snippet: conversation.lastMessage || `${conversation.memberCount} 名成员`,
        senderName: conversation.type === 'group' ? '群聊' : '联系人',
        createdAt: conversation.updatedAt,
      })
    }

    conversationMessages.forEach((message) => {
      if (!matchesSearch(message.body, normalized)) return

      results.push({
        id: `message-${message.id}`,
        conversationId: conversation.id,
        conversationTitle: conversation.title,
        kind: 'message',
        title: conversation.title,
        snippet: message.body,
        senderName: profilesById.get(message.senderId)?.displayName ?? '成员',
        createdAt: message.createdAt,
      })
    })
  })

  return results
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 30)
}

export function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase('zh-CN')
}

function matchesSearch(value: string, normalizedQuery: string) {
  return normalizeSearch(value).includes(normalizedQuery)
}
