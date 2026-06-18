import { useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase, vapidPublicKey } from '../lib/supabase'

type NotificationPermissionState = NotificationPermission | 'unsupported'

type PushStatus =
  | 'disabled'
  | 'enabled'
  | 'unsupported'
  | 'denied'
  | 'missing-config'
  | 'demo'
  | 'saving'
  | 'error'

export function usePushNotifications(userId?: string, workspaceId?: string) {
  const [permission, setPermission] = useState<NotificationPermissionState>(() =>
    getNotificationPermission(),
  )
  const [isBusy, setIsBusy] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const isSupported = hasPushSupport()
  const isConfigured = Boolean(vapidPublicKey)
  const canUseSupabase = Boolean(supabase && isSupabaseConfigured && userId)

  useEffect(() => {
    let isActive = true

    async function syncPushState() {
      if (!isActive) return
      setPermission(getNotificationPermission())
      setErrorMessage('')

      if (!isSupported || !userId) {
        setIsSubscribed(false)
        return
      }

      try {
        const subscription = await getExistingSubscription()
        const isSaved = subscription ? await hasSavedSubscription(subscription.endpoint) : false
        if (isActive) setIsSubscribed(isSaved)
      } catch {
        if (isActive) setIsSubscribed(false)
      }
    }

    void syncPushState()

    return () => {
      isActive = false
    }
  }, [isSupported, userId])

  const status: PushStatus = useMemo(() => {
    if (!isSupported) return 'unsupported'
    if (!canUseSupabase) return 'demo'
    if (!isConfigured) return 'missing-config'
    if (permission === 'denied') return 'denied'
    if (isBusy) return 'saving'
    if (isSubscribed && permission === 'granted') return 'enabled'
    if (errorMessage) return 'error'
    return 'disabled'
  }, [canUseSupabase, errorMessage, isBusy, isConfigured, isSubscribed, isSupported, permission])

  const statusMessage = getPushStatusMessage(status, errorMessage)

  async function enableNotifications() {
    setErrorMessage('')

    if (!isSupported) {
      setPermission('unsupported')
      return
    }

    if (!canUseSupabase) {
      setErrorMessage('Demo 模式暂不支持消息通知。')
      return
    }

    if (!vapidPublicKey) {
      setErrorMessage('通知服务尚未配置 VAPID 公钥。')
      return
    }

    if (Notification.permission === 'denied') {
      setPermission('denied')
      setErrorMessage('你已拒绝浏览器通知权限，请在浏览器设置中重新开启。')
      return
    }

    setIsBusy(true)

    try {
      const nextPermission =
        Notification.permission === 'granted'
          ? 'granted'
          : await Notification.requestPermission()
      setPermission(nextPermission)

      if (nextPermission !== 'granted') {
        setErrorMessage('未获得浏览器通知权限。')
        return
      }

      const registration = await ensureServiceWorkerRegistration()
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          userVisibleOnly: true,
        }))

      await saveSubscription(subscription)
      setIsSubscribed(true)
    } catch (error) {
      const message = formatPushError(error, '通知开启失败，请稍后重试。')
      setErrorMessage(message)
      recordNotificationError(userId, workspaceId, message)
    } finally {
      setIsBusy(false)
    }
  }

  async function disableNotifications() {
    setErrorMessage('')

    if (!isSupported || !canUseSupabase) {
      setIsSubscribed(false)
      return
    }

    setIsBusy(true)

    try {
      const subscription = await getExistingSubscription()
      if (subscription) {
        await disableSubscription(subscription.endpoint)
        await subscription.unsubscribe()
      }
      setIsSubscribed(false)
      setPermission(getNotificationPermission())
    } catch (error) {
      const message = formatPushError(error, '通知关闭失败，请稍后重试。')
      setErrorMessage(message)
      recordNotificationError(userId, workspaceId, message)
    } finally {
      setIsBusy(false)
    }
  }

  return {
    disableNotifications,
    enableNotifications,
    isBusy,
    isConfigured,
    isSubscribed,
    isSupported,
    permission,
    status,
    statusMessage,
  }
}

function recordNotificationError(userId: string | undefined, workspaceId: string | undefined, message: string) {
  if (!supabase || !userId) return

  void supabase
    .from('app_error_events')
    .insert({
      workspace_id: workspaceId || null,
      user_id: userId,
      module: 'notifications',
      message: message.slice(0, 500),
      context: {},
    })
    .then(
      () => undefined,
      () => undefined,
    )
}

function hasPushSupport() {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

function getNotificationPermission(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

async function ensureServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('当前浏览器不支持 Service Worker。')
  }

  const registrations = await navigator.serviceWorker.getRegistrations()
  const existingRegistration = registrations.find((registration) =>
    registration.active?.scriptURL.endsWith('/sw.js'),
  )

  if (existingRegistration) return existingRegistration

  await navigator.serviceWorker.register('/sw.js')
  return navigator.serviceWorker.ready
}

async function getExistingSubscription() {
  if (!hasPushSupport()) return null
  const registration = await ensureServiceWorkerRegistration()
  return registration.pushManager.getSubscription()
}

async function saveSubscription(subscription: PushSubscription) {
  const json = subscription.toJSON()
  const keys = json.keys

  if (!json.endpoint || !keys?.p256dh || !keys.auth) {
    throw new Error('浏览器返回的通知订阅不完整。')
  }

  const { error } = await supabase!.rpc('upsert_push_subscription', {
    subscription_auth: keys.auth,
    subscription_endpoint: json.endpoint,
    subscription_p256dh: keys.p256dh,
    subscription_user_agent: navigator.userAgent,
  })

  if (error) throw new Error(error.message)
}

async function disableSubscription(endpoint: string) {
  const { error } = await supabase!.rpc('disable_push_subscription', {
    subscription_endpoint: endpoint,
  })

  if (error) throw new Error(error.message)
}

async function hasSavedSubscription(endpoint: string) {
  if (!supabase) return false

  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('endpoint', endpoint)
    .eq('enabled', true)
    .limit(1)

  if (error) throw new Error(error.message)
  return Boolean(data?.length)
}

function getPushStatusMessage(status: PushStatus, errorMessage: string) {
  if (status === 'unsupported') return '当前浏览器不支持推送通知。'
  if (status === 'demo') return 'Demo 模式暂不支持消息通知。'
  if (status === 'missing-config') return '通知服务尚未配置，稍后再试。'
  if (status === 'denied') return '你已拒绝浏览器通知权限，请在浏览器设置中重新开启。'
  if (status === 'saving') return '正在更新通知设置...'
  if (status === 'enabled') return '消息通知已开启。'
  if (status === 'error') return errorMessage || '通知设置更新失败，请稍后重试。'
  return '开启后，新消息会通过浏览器通知提醒你。通知内容不会显示消息正文。'
}

function formatPushError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : ''
  const normalized = message.toLowerCase()

  if (!message) return fallback

  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('load failed')
  ) {
    return '通知服务连接失败，请检查网络后重试。'
  }

  if (
    normalized.includes('permission') ||
    normalized.includes('denied') ||
    normalized.includes('not allowed')
  ) {
    return '浏览器没有授予通知权限，请在浏览器设置中开启。'
  }

  if (
    normalized.includes('vapid') ||
    normalized.includes('applicationserverkey') ||
    normalized.includes('invalid character') ||
    normalized.includes('push subscription')
  ) {
    return '通知订阅配置异常，请联系管理员检查 VAPID 公钥。'
  }

  if (
    normalized.includes('upsert_push_subscription') ||
    normalized.includes('disable_push_subscription') ||
    normalized.includes('push_subscriptions') ||
    normalized.includes('schema cache') ||
    normalized.includes('could not find the function')
  ) {
    return '通知数据表或 RPC 尚未部署，请联系管理员检查 Supabase 配置。'
  }

  if (
    normalized.includes('row-level security') ||
    normalized.includes('permission denied') ||
    normalized.includes('unauthorized') ||
    normalized.includes('not authorized')
  ) {
    return '你没有权限更新通知订阅，请重新登录后再试。'
  }

  return fallback
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index)
  }

  return outputArray
}
