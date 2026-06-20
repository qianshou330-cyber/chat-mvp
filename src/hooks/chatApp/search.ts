import type { Conversation, Message, Profile, SearchFilters, SearchResult } from '../../types'

export const defaultSearchFilters: SearchFilters = {
  dateRange: 'all',
  messageType: 'all',
  senderId: '',
}

export function buildSearchResults(
  query: string,
  conversations: Conversation[],
  messages: Message[],
  profilesById: Map<string, Profile>,
  filters: SearchFilters = defaultSearchFilters,
): SearchResult[] {
  const normalized = normalizeSearch(query)
  if (!isSearchQueryReady(query)) return []

  const results: SearchResult[] = []
  const messagesByConversation = new Map<string, Message[]>()
  const hasMessageOnlyFilters = hasActiveSearchFilters(filters)

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

    if (!hasMessageOnlyFilters && matchesSearch(searchableConversationText, normalized)) {
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
      if (!matchesFilters(message, filters)) return
      if (!matchesSearch(message.body, normalized)) return

      results.push({
        id: `message-${message.id}`,
        conversationId: conversation.id,
        conversationTitle: conversation.title,
        kind: 'message',
        messageId: message.id,
        messageType: message.type,
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

export function isSearchQueryReady(value: string) {
  const normalized = normalizeSearch(value)
  if (!normalized) return false
  if (/[\u3400-\u9fff]/u.test(normalized)) return true
  return normalized.replace(/[^a-z0-9]/gi, '').length >= 2
}

export function hasActiveSearchFilters(filters: SearchFilters) {
  return filters.messageType !== 'all' || Boolean(filters.senderId) || filters.dateRange !== 'all'
}

export function searchDateRangeToIso(dateRange: SearchFilters['dateRange']) {
  if (dateRange === 'all') return ''

  const date = new Date()

  if (dateRange === 'today') {
    date.setHours(0, 0, 0, 0)
    return date.toISOString()
  }

  const days = dateRange === '7d' ? 7 : 30
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

function matchesSearch(value: string, normalizedQuery: string) {
  return normalizeSearch(value).includes(normalizedQuery)
}

function matchesFilters(message: Message, filters: SearchFilters) {
  if (filters.messageType !== 'all' && message.type !== filters.messageType) return false
  if (filters.senderId && message.senderId !== filters.senderId) return false

  const createdAfter = searchDateRangeToIso(filters.dateRange)
  if (createdAfter && Date.parse(message.createdAt) < Date.parse(createdAfter)) return false

  return true
}
