export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function sanitizeLogContext(context: Record<string, unknown>) {
  const safeContext: Record<string, string | number | boolean> = {}

  Object.entries(context)
    .filter(([key]) => !/password|token|secret|body|filename|fileName/i.test(key))
    .slice(0, 8)
    .forEach(([key, value]) => {
      if (typeof value === 'string') {
        safeContext[key] = value.slice(0, 120)
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        safeContext[key] = value
      }
    })

  return safeContext
}

export function trimLogMessage(message: string) {
  return message.slice(0, 500)
}
