import { createClient } from 'npm:@supabase/supabase-js@2.108.2'
import webpush from 'npm:web-push@3.6.7'

type MessageRecord = {
  conversation_id?: string
  id?: string
  message_type?: string
  sender_id?: string
}

type WebhookPayload = {
  record?: MessageRecord
  table?: string
  type?: string
}

type PushSubscriptionRow = {
  auth: string
  endpoint: string
  id: string
  p256dh: string
  user_id: string
}

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return jsonResponse({ ok: true }, 200)
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const webhookSecret = Deno.env.get('WEBHOOK_SECRET')
  const receivedSecret =
    request.headers.get('x-webhook-secret') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  if (!webhookSecret || receivedSecret !== webhookSecret) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const vapidPublicKey = Deno.env.get('WEB_PUSH_VAPID_PUBLIC_KEY')
  const vapidPrivateKey = Deno.env.get('WEB_PUSH_VAPID_PRIVATE_KEY')
  const vapidSubject = Deno.env.get('WEB_PUSH_SUBJECT') ?? 'mailto:admin@example.com'

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
    return jsonResponse({ error: 'Missing server push configuration' }, 500)
  }

  const payload = (await request.json()) as WebhookPayload
  const message = payload.record

  if (payload.table !== 'messages' || !message?.id || !message.conversation_id || !message.sender_id) {
    return jsonResponse({ ok: true, skipped: 'not a message insert' }, 200)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  const { data: members, error: membersError } = await supabase
    .from('conversation_members')
    .select('user_id')
    .eq('conversation_id', message.conversation_id)
    .neq('user_id', message.sender_id)

  if (membersError) {
    return jsonResponse({ error: membersError.message }, 500)
  }

  const recipientIds = (members ?? []).map((member) => String(member.user_id))
  if (recipientIds.length === 0) {
    return jsonResponse({ ok: true, sent: 0 }, 200)
  }

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from('push_subscriptions')
    .select('id,user_id,endpoint,p256dh,auth')
    .in('user_id', recipientIds)
    .eq('enabled', true)

  if (subscriptionsError) {
    return jsonResponse({ error: subscriptionsError.message }, 500)
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)

  let sent = 0
  let disabled = 0

  for (const subscription of (subscriptions ?? []) as PushSubscriptionRow[]) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            auth: subscription.auth,
            p256dh: subscription.p256dh,
          },
        },
        JSON.stringify({
          body: '你有一条新消息',
          data: {
            conversationId: message.conversation_id,
            messageId: message.id,
            messageType: message.message_type ?? 'text',
            url: `/?chat=${message.conversation_id}`,
          },
          title: '聊天 MVP',
        }),
      )

      sent += 1
      await supabase
        .from('push_subscriptions')
        .update({
          last_error: null,
          last_sent_at: new Date().toISOString(),
        })
        .eq('id', subscription.id)
    } catch (error) {
      const statusCode = Number((error as { statusCode?: number }).statusCode ?? 0)
      const shouldDisable = statusCode === 404 || statusCode === 410
      if (shouldDisable) disabled += 1

      const updatePayload: { enabled?: boolean; last_error: string } = {
        last_error: error instanceof Error ? error.message : 'Push delivery failed',
      }
      if (shouldDisable) updatePayload.enabled = false

      await supabase
        .from('push_subscriptions')
        .update(updatePayload)
        .eq('id', subscription.id)
    }
  }

  return jsonResponse({ disabled, ok: true, sent }, 200)
})

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
    status,
  })
}
