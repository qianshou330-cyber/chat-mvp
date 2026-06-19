const DEVICE_ID_STORAGE_KEY = 'chat_mvp_device_id'

export const DEVICE_HEARTBEAT_INTERVAL_MS = 60 * 1000

function createDeviceId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function getOrCreateDeviceId() {
  if (typeof window === 'undefined') return 'server-device'

  const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY)
  if (existing) return existing

  const nextDeviceId = createDeviceId()
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, nextDeviceId)
  return nextDeviceId
}

export function getDeviceMetadata() {
  if (typeof navigator === 'undefined') {
    return {
      browserName: '浏览器',
      deviceName: '当前设备',
      platform: 'Web',
      userAgent: '',
    }
  }

  const userAgent = navigator.userAgent
  const browserName = detectBrowserName(userAgent)
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    'Web'

  return {
    browserName,
    deviceName: `${browserName} · ${platform}`,
    platform,
    userAgent,
  }
}

function detectBrowserName(userAgent: string) {
  const normalized = userAgent.toLowerCase()
  if (normalized.includes('edg/')) return 'Edge'
  if (normalized.includes('chrome/')) return 'Chrome'
  if (normalized.includes('firefox/')) return 'Firefox'
  if (normalized.includes('safari/')) return 'Safari'
  return '浏览器'
}
