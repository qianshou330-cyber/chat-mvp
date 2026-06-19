export function friendlyErrorMessage(message: string | undefined, fallback: string) {
  const normalized = (message ?? '').toLowerCase()

  if (!message) return fallback

  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('networkerror') ||
    normalized.includes('load failed')
  ) {
    return '网络请求失败，请检查网络后重试。'
  }

  if (normalized.includes('invalid login credentials')) {
    return '邮箱或密码不正确。'
  }

  if (normalized.includes('already registered') || normalized.includes('already exists')) {
    return '这个邮箱已经注册过，请直接登录。'
  }

  if (
    normalized.includes('weak password') ||
    (normalized.includes('password') &&
      (normalized.includes('least') || normalized.includes('characters')))
  ) {
    return '密码太弱，请至少使用 8 个字符。'
  }

  if (normalized.includes('email not confirmed')) {
    return '这个邮箱还需要确认后才能登录。'
  }

  if (normalized.includes('rate limit') || normalized.includes('too many')) {
    return '尝试次数过多，请稍等一会儿再试。'
  }

  if (normalized.includes('no user found') || normalized.includes('user not found')) {
    return '没有找到使用这个邮箱注册的用户。请确认对方已经注册。'
  }

  if (normalized.includes('incoming contact request already exists')) {
    return '对方已经给你发来申请，请在好友申请里处理。'
  }

  if (normalized.includes('contact request must be accepted')) {
    return '需要对方同意好友申请后才能开始单聊。'
  }

  if (normalized.includes('contact request not found')) {
    return '没有找到这条好友申请，可能已经被处理。'
  }

  if (
    normalized.includes('workspace admin') ||
    normalized.includes('not a workspace member') ||
    normalized.includes('member role') ||
    normalized.includes('cannot remove')
  ) {
    return '你没有权限管理这个工作区成员。'
  }

  if (normalized.includes('workspace member already exists')) {
    return '这个用户已经在当前工作区。'
  }

  if (
    normalized.includes('row-level security') ||
    normalized.includes('permission denied') ||
    normalized.includes('not authorized') ||
    normalized.includes('unauthorized')
  ) {
    return '你没有权限执行这个操作。'
  }

  return fallback
}

export function isMissingWorkspaceSchema(message: string | undefined) {
  const normalized = (message ?? '').toLowerCase()
  return (
    normalized.includes('ensure_default_workspace') ||
    normalized.includes('workspace_members') ||
    normalized.includes('workspaces') ||
    normalized.includes('schema cache') ||
    normalized.includes('could not find the function') ||
    normalized.includes('does not exist')
  )
}

export function isMissingDeviceSessionSchema(message: string | undefined) {
  const normalized = (message ?? '').toLowerCase()
  return (
    normalized.includes('device_sessions') ||
    normalized.includes('upsert_device_session') ||
    normalized.includes('revoke_other_device_sessions') ||
    normalized.includes('revoke_device_session') ||
    normalized.includes('schema cache') ||
    normalized.includes('could not find the function') ||
    normalized.includes('does not exist')
  )
}

export function isMissingOperationalLogSchema(message: string | undefined) {
  const normalized = (message ?? '').toLowerCase()
  return (
    normalized.includes('app_error_events') ||
    normalized.includes('admin_activity_logs') ||
    normalized.includes('schema cache') ||
    normalized.includes('does not exist')
  )
}
