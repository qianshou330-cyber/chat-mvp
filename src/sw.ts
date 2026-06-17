/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { revision: string | null; url: string }>
}

type PushPayload = {
  body?: string
  data?: {
    conversationId?: string
    messageId?: string
    messageType?: string
    url?: string
  }
  title?: string
}

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
void self.skipWaiting()
clientsClaim()

self.addEventListener('push', (event) => {
  const payload = readPushPayload(event)
  const data = payload.data ?? {}
  const notificationUrl = data.url ?? buildConversationUrl(data.conversationId)

  event.waitUntil(
    self.registration.showNotification(payload.title ?? '聊天 MVP', {
      badge: '/app-icon.svg',
      body: payload.body ?? '你有一条新消息',
      data: {
        conversationId: data.conversationId,
        messageId: data.messageId,
        messageType: data.messageType,
        url: notificationUrl,
      },
      icon: '/app-icon.svg',
      tag: data.conversationId ? `conversation:${data.conversationId}` : undefined,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const notificationData = event.notification.data as { url?: string } | undefined
  const targetUrl = new URL(notificationData?.url ?? '/', self.location.origin).href

  event.waitUntil(openOrFocusClient(targetUrl))
})

function readPushPayload(event: PushEvent): PushPayload {
  if (!event.data) return {}

  try {
    return event.data.json() as PushPayload
  } catch {
    return {}
  }
}

function buildConversationUrl(conversationId?: string) {
  if (!conversationId) return '/'
  return `/?chat=${encodeURIComponent(conversationId)}`
}

async function openOrFocusClient(targetUrl: string) {
  const windowClients = await self.clients.matchAll({
    includeUncontrolled: true,
    type: 'window',
  })

  const existingClient = windowClients.find((client) => client.url.startsWith(self.location.origin))
  if (existingClient) {
    await existingClient.navigate(targetUrl)
    return existingClient.focus()
  }

  return self.clients.openWindow(targetUrl)
}
