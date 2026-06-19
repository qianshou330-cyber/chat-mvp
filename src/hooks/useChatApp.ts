import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  avatarStorageBucket,
  avatarVideoStorageBucket,
  chatStorageBucket,
  isSupabaseConfigured,
  supabase,
} from '../lib/supabase'
import { createDemoState, demoProfileEmails, demoUser } from '../data/demoData'
import {
  avatarFileExtension,
  validateAttachment,
  validateAvatar,
  validateAvatarVideo,
} from '../lib/attachments'
import { uploadStorageObject } from '../lib/storageUpload'
import { processAvatarVideo } from '../lib/videoAvatar'
import { DEVICE_HEARTBEAT_INTERVAL_MS, getDeviceMetadata, getOrCreateDeviceId } from './chatApp/device'
import {
  friendlyErrorMessage,
  isMissingDeviceSessionSchema,
  isMissingOperationalLogSchema,
  isMissingWorkspaceSchema,
} from './chatApp/errors'
import {
  mapAdminActivityLog,
  mapAppErrorEvent,
  mapContact,
  mapConversation,
  mapDeviceSession,
  mapMessage,
  mapProfile,
  mapWorkspace,
  mapWorkspaceMember,
} from './chatApp/mappers'
import { buildSearchResults, normalizeSearch } from './chatApp/search'
import {
  canDeleteGroupMessage,
  findConversationMember,
  findDirectConversation,
  getSendBlockReason,
  isGroupManagerRole,
  isWorkspaceManager,
  markAttachmentHidden,
  markMessageDeleted,
  upsertContact,
  upsertConversation,
  upsertConversationMember,
  upsertMembers,
  upsertProfile,
  upsertWorkspaceMember,
  withNewMessage,
  workspaceRoleRank,
} from './chatApp/state'
import { sanitizeLogContext, trimLogMessage } from './chatApp/logging'
import type {
  AdminActivityAction,
  AppErrorModule,
  AppUser,
  ChatState,
  ContactRequest,
  ContactStatus,
  Conversation,
  ConversationMember,
  MemberRole,
  Message,
  Profile,
  WorkspaceMember,
  WorkspaceRole,
} from '../types'

const initialState = createDemoState()

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

const safeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '-')

type NoticeScope = 'global' | 'login' | 'list' | 'chat' | 'group' | 'profile'

interface ScopedNotice {
  message: string
  scope: NoticeScope
}

interface UploadProgressState {
  label: string
  percent: number
}

export function useChatApp() {
  const [state, setState] = useState<ChatState>(initialState)
  const [user, setUser] = useState<AppUser | null>(null)
  const [activeConversationId, setActiveConversationId] = useState('conv-mira')
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<ScopedNotice>({ message: '', scope: 'global' })
  const [profileUploadProgress, setProfileUploadProgress] = useState<UploadProgressState | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(supabase))
  const currentDeviceId = useMemo(() => getOrCreateDeviceId(), [])
  const allowDeviceRestore = useRef(false)
  const currentChannel = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(
    null,
  )
  const stateChannel = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(
    null,
  )
  const pendingUploadFilesRef = useRef<Map<string, File>>(new Map())

  const activeConversation = state.conversations.find(
    (conversation) => conversation.id === activeConversationId,
  )

  const authNotice = notice.message

  function setAuthNotice(message: string) {
    setNotice({ message, scope: 'global' })
  }

  function setScopedNotice(scope: NoticeScope, message: string) {
    setNotice({ message, scope })
  }

  function noticeFor(scope: NoticeScope) {
    if (!notice.message) return ''
    if (notice.scope === scope) return notice.message
    if (notice.scope === 'global' && scope !== 'list') return notice.message
    return ''
  }

  const profilesById = useMemo(
    () => new Map(state.profiles.map((profile) => [profile.id, profile])),
    [state.profiles],
  )

  const searchResults = useMemo(
    () => buildSearchResults(query, state.conversations, state.messages, profilesById),
    [profilesById, query, state.conversations, state.messages],
  )

  const visibleConversations = useMemo(() => {
    const normalized = normalizeSearch(query)

    if (!normalized) {
      return [...state.conversations].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    }

    const matchingConversationIds = new Set(searchResults.map((result) => result.conversationId))

    return state.conversations
      .filter((conversation) => matchingConversationIds.has(conversation.id))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  }, [query, searchResults, state.conversations])

  const activeMessages = useMemo(
    () =>
      state.messages
        .filter((message) => message.conversationId === activeConversationId)
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    [activeConversationId, state.messages],
  )

  const me = user ? state.profiles.find((profile) => profile.id === user.id) : null

  const activeWorkspace = useMemo(
    () =>
      state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId) ??
      state.workspaces[0] ??
      null,
    [state.activeWorkspaceId, state.workspaces],
  )

  const workspaceMembers = useMemo(
    () =>
      state.workspaceMembers
        .filter((member) => !activeWorkspace || member.workspaceId === activeWorkspace.id)
        .sort((a, b) => workspaceRoleRank(a.role) - workspaceRoleRank(b.role)),
    [activeWorkspace, state.workspaceMembers],
  )

  const activeWorkspaceRole =
    workspaceMembers.find((member) => member.userId === user?.id)?.role ?? 'member'

  function recordAppError(
    module: AppErrorModule,
    message: string,
    context: Record<string, unknown> = {},
  ) {
    const currentUser = user ?? (!supabase ? demoUser : null)
    if (!currentUser) return

    const event = {
      id: uid(),
      workspaceId: activeWorkspace?.id ?? '',
      userId: currentUser.id,
      module,
      message: trimLogMessage(message),
      context: sanitizeLogContext(context),
      createdAt: new Date().toISOString(),
    }

    setState((previous) => ({
      ...previous,
      appErrorEvents: [event, ...previous.appErrorEvents].slice(0, 20),
    }))

    if (!supabase) return

    void supabase
      .from('app_error_events')
      .insert({
        id: event.id,
        workspace_id: event.workspaceId || null,
        user_id: currentUser.id,
        module,
        message: event.message,
        context: sanitizeLogContext(context),
      })
      .then(
        () => undefined,
        () => undefined,
      )
  }

  function recordAdminActivity(
    action: AdminActivityAction,
    targetUserId: string,
    result: 'success' | 'failure' = 'success',
    details: Record<string, unknown> = {},
  ) {
    const currentUser = user ?? (!supabase ? demoUser : null)
    if (!currentUser || !activeWorkspace || !isWorkspaceManager(activeWorkspaceRole)) return

    const entry = {
      id: uid(),
      workspaceId: activeWorkspace.id,
      actorId: currentUser.id,
      targetUserId,
      action,
      result,
      details: sanitizeLogContext(details),
      createdAt: new Date().toISOString(),
    }

    setState((previous) => ({
      ...previous,
      adminActivityLogs: [entry, ...previous.adminActivityLogs].slice(0, 20),
    }))

    if (!supabase) return

    void supabase
      .from('admin_activity_logs')
      .insert({
        id: entry.id,
        workspace_id: activeWorkspace.id,
        actor_id: currentUser.id,
        target_user_id: targetUserId || null,
        action,
        result,
        details: sanitizeLogContext(details),
      })
      .then(
        () => undefined,
        () => undefined,
      )
  }

  const incomingContactRequests = useMemo(
    () =>
      state.contacts
        .filter((contact) => contact.status === 'pending' && contact.direction === 'incoming')
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [state.contacts],
  )

  const outgoingContactRequests = useMemo(
    () =>
      state.contacts
        .filter((contact) => contact.status === 'pending' && contact.direction === 'outgoing')
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [state.contacts],
  )

  const refreshCurrentDeviceSession = useCallback(
    async (userId: string, allowRevokedRestore = false) => {
      if (!supabase) return { ok: true, rows: [] as Record<string, unknown>[] }

      const currentSession = await supabase
        .from('device_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('device_id', currentDeviceId)
        .maybeSingle()

      if (currentSession.error) {
        if (!isMissingDeviceSessionSchema(currentSession.error.message)) {
          setAuthNotice(
            friendlyErrorMessage(
              currentSession.error.message,
              '无法加载登录设备，请刷新后重试。',
            ),
          )
        }
        return { ok: true, rows: [] as Record<string, unknown>[] }
      }

      if (currentSession.data?.revoked_at && !allowRevokedRestore) {
        await supabase.auth.signOut({ scope: 'local' })
        pendingUploadFilesRef.current.clear()
        setUser(null)
        setState(createDemoState())
        setAuthNotice('这台设备已被退出，请重新登录。')
        setIsLoading(false)
        return { ok: false, rows: [] as Record<string, unknown>[] }
      }

      const metadata = getDeviceMetadata()
      const upsertResult = await supabase.rpc('upsert_device_session', {
        requested_browser_name: metadata.browserName,
        requested_device_id: currentDeviceId,
        requested_device_name: metadata.deviceName,
        requested_platform: metadata.platform,
        requested_user_agent: metadata.userAgent,
      })

      if (upsertResult.error) {
        if (!isMissingDeviceSessionSchema(upsertResult.error.message)) {
          setAuthNotice(
            friendlyErrorMessage(upsertResult.error.message, '无法更新登录设备，请刷新后重试。'),
          )
        }
        return { ok: true, rows: [] as Record<string, unknown>[] }
      }

      const sessionsResult = await supabase
        .from('device_sessions')
        .select('*')
        .eq('user_id', userId)
        .is('revoked_at', null)
        .order('last_seen_at', { ascending: false })

      if (sessionsResult.error) {
        setAuthNotice(
          friendlyErrorMessage(sessionsResult.error.message, '无法加载登录设备，请刷新后重试。'),
        )
      }

      return { ok: true, rows: sessionsResult.data ?? [] }
    },
    [currentDeviceId],
  )

  const loadSupabaseState = useCallback(async (userId: string) => {
    if (!supabase) return
    setIsLoading(true)

    const [profileResult, memberResult, contactsResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', userId),
      supabase
        .from('contacts')
        .select('*')
        .or(`owner_id.eq.${userId},contact_id.eq.${userId}`),
    ])

    if (profileResult.error) {
      setAuthNotice(
        friendlyErrorMessage(profileResult.error.message, '无法加载你的资料，请刷新后重试。'),
      )
    }

    if (contactsResult.error) {
      setAuthNotice(
        friendlyErrorMessage(contactsResult.error.message, '无法加载好友申请，请刷新后重试。'),
      )
    }

    let currentProfile = profileResult.data

    if (!profileResult.data) {
      const email = (await supabase.auth.getUser()).data.user?.email ?? 'member@example.com'
      const createdProfile = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          display_name: email.split('@')[0],
          bio: '',
          avatar_tone: 'blue',
          status: 'online',
        })
        .select()
        .single()

      if (createdProfile.error) {
        setAuthNotice(
          friendlyErrorMessage(
            createdProfile.error.message,
            '无法创建你的资料，请重试。',
          ),
        )
      } else {
        currentProfile = createdProfile.data
      }
    }

    let workspaceRows: Record<string, unknown>[] = []
    let workspaceMemberRows: Record<string, unknown>[] = []
    let appErrorEventRows: Record<string, unknown>[] = []
    let adminActivityLogRows: Record<string, unknown>[] = []
    let activeWorkspaceId = ''
    let hasWorkspaceSchema = true

    const defaultWorkspaceResult = await supabase
      .rpc('ensure_default_workspace')
      .maybeSingle()

    if (defaultWorkspaceResult.error) {
      hasWorkspaceSchema = false
      if (!isMissingWorkspaceSchema(defaultWorkspaceResult.error.message)) {
        setAuthNotice(
          friendlyErrorMessage(
            defaultWorkspaceResult.error.message,
            '无法加载工作区，请确认 v0.3 migration 已运行。',
          ),
        )
      }
    } else if (defaultWorkspaceResult.data) {
      const row = defaultWorkspaceResult.data as Record<string, unknown>
      activeWorkspaceId = String(row.workspace_id ?? '')
    }

    if (hasWorkspaceSchema) {
      const workspaceMembershipResult = await supabase
        .from('workspace_members')
        .select('*')
        .eq('user_id', userId)

      if (workspaceMembershipResult.error) {
        setAuthNotice(
          friendlyErrorMessage(
            workspaceMembershipResult.error.message,
            '无法加载工作区成员关系，请刷新后重试。',
          ),
        )
      }

      const workspaceMembershipRows = workspaceMembershipResult.data ?? []
      if (!activeWorkspaceId) {
        activeWorkspaceId = String(workspaceMembershipRows[0]?.workspace_id ?? '')
      }

      const workspaceIds = new Set<string>()
      if (activeWorkspaceId) workspaceIds.add(activeWorkspaceId)
      workspaceMembershipRows.forEach((member) => workspaceIds.add(member.workspace_id as string))

      if (workspaceIds.size > 0) {
        const [workspacesResult, workspaceMembersResult] = await Promise.all([
          supabase.from('workspaces').select('*').in('id', [...workspaceIds]),
          activeWorkspaceId
            ? supabase.from('workspace_members').select('*').eq('workspace_id', activeWorkspaceId)
            : Promise.resolve({ data: workspaceMembershipRows, error: null }),
        ])

        if (workspacesResult.error) {
          setAuthNotice(
            friendlyErrorMessage(workspacesResult.error.message, '无法加载工作区，请刷新后重试。'),
          )
        }

        if (workspaceMembersResult.error) {
          setAuthNotice(
            friendlyErrorMessage(
              workspaceMembersResult.error.message,
              '无法加载工作区成员，请刷新后重试。',
            ),
          )
        }

        workspaceRows = workspacesResult.data ?? []
        workspaceMemberRows = workspaceMembersResult.data ?? workspaceMembershipRows
      }
    }

    const currentWorkspaceRole =
      (workspaceMemberRows.find(
        (member) => member.workspace_id === activeWorkspaceId && member.user_id === userId,
      )?.role as WorkspaceRole | undefined) ?? 'member'

    if (activeWorkspaceId && isWorkspaceManager(currentWorkspaceRole)) {
      const [errorEventsResult, activityLogsResult] = await Promise.all([
        supabase
          .from('app_error_events')
          .select('*')
          .eq('workspace_id', activeWorkspaceId)
          .order('created_at', { ascending: false })
          .limit(12),
        supabase
          .from('admin_activity_logs')
          .select('*')
          .eq('workspace_id', activeWorkspaceId)
          .order('created_at', { ascending: false })
          .limit(12),
      ])

      if (errorEventsResult.error && !isMissingOperationalLogSchema(errorEventsResult.error.message)) {
        setAuthNotice(
          friendlyErrorMessage(errorEventsResult.error.message, '无法加载错误记录，请刷新后重试。'),
        )
      }

      if (activityLogsResult.error && !isMissingOperationalLogSchema(activityLogsResult.error.message)) {
        setAuthNotice(
          friendlyErrorMessage(activityLogsResult.error.message, '无法加载群管理记录，请刷新后重试。'),
        )
      }

      appErrorEventRows = errorEventsResult.data ?? []
      adminActivityLogRows = activityLogsResult.data ?? []
    }

    const deviceSessionResult = await refreshCurrentDeviceSession(
      userId,
      allowDeviceRestore.current,
    )
    allowDeviceRestore.current = false
    if (!deviceSessionResult.ok) return
    const deviceSessionRows = deviceSessionResult.rows

    const conversationIds =
      memberResult.data?.map((member) => member.conversation_id as string) ?? []
    const contactRows = contactsResult.data ?? []

    let conversationRows: Record<string, unknown>[] = []
    let memberRows: Record<string, unknown>[] = []
    let messageRows: Record<string, unknown>[] = []

    if (conversationIds.length > 0) {
      const [conversationsResult, membersResult, messagesResult] = await Promise.all([
        supabase.from('conversations').select('*').in('id', conversationIds),
        supabase
          .from('conversation_members')
          .select('*')
          .in('conversation_id', conversationIds),
        supabase
          .from('messages')
          .select('*, attachments(*)')
          .in('conversation_id', conversationIds)
          .order('created_at', { ascending: true }),
      ])

      if (conversationsResult.error) {
        setAuthNotice(
          friendlyErrorMessage(conversationsResult.error.message, '无法加载会话，请刷新后重试。'),
        )
      }

      if (membersResult.error) {
        setAuthNotice(
          friendlyErrorMessage(membersResult.error.message, '无法加载成员，请刷新后重试。'),
        )
      }

      if (messagesResult.error) {
        setAuthNotice(
          friendlyErrorMessage(messagesResult.error.message, '无法加载消息，请刷新后重试。'),
        )
      }

      conversationRows = conversationsResult.data ?? []
      memberRows = membersResult.data ?? []
      messageRows = messagesResult.data ?? []
    }

    const canReadGroupRecords =
      activeWorkspaceId &&
      !isWorkspaceManager(currentWorkspaceRole) &&
      memberRows.some(
        (member) =>
          member.user_id === userId &&
          (member.role === 'owner' || member.role === 'admin'),
      )

    if (canReadGroupRecords) {
      const [errorEventsResult, activityLogsResult] = await Promise.all([
        supabase
          .from('app_error_events')
          .select('*')
          .eq('workspace_id', activeWorkspaceId)
          .order('created_at', { ascending: false })
          .limit(12),
        supabase
          .from('admin_activity_logs')
          .select('*')
          .eq('workspace_id', activeWorkspaceId)
          .order('created_at', { ascending: false })
          .limit(12),
      ])

      if (errorEventsResult.error && !isMissingOperationalLogSchema(errorEventsResult.error.message)) {
        setAuthNotice(
          friendlyErrorMessage(errorEventsResult.error.message, '无法加载错误记录，请刷新后重试。'),
        )
      }

      if (activityLogsResult.error && !isMissingOperationalLogSchema(activityLogsResult.error.message)) {
        setAuthNotice(
          friendlyErrorMessage(activityLogsResult.error.message, '无法加载群管理记录，请刷新后重试。'),
        )
      }

      appErrorEventRows = errorEventsResult.data ?? []
      adminActivityLogRows = activityLogsResult.data ?? []
    }

    const profileIds = new Set<string>()
    if (currentProfile) profileIds.add(userId)
    contactRows.forEach((contact) => {
      profileIds.add(contact.owner_id as string)
      profileIds.add(contact.contact_id as string)
    })
    memberRows.forEach((member) => profileIds.add(member.user_id as string))
    workspaceMemberRows.forEach((member) => profileIds.add(member.user_id as string))

    const profilesResult =
      profileIds.size > 0
        ? await supabase.from('profiles').select('*').in('id', [...profileIds])
        : { data: [], error: null }

    if (profilesResult.error) {
      setAuthNotice(
        friendlyErrorMessage(profilesResult.error.message, '无法加载成员资料，请刷新后重试。'),
      )
    }

    const profiles = (profilesResult.data ?? []).map(mapProfile)
    const profilesById = new Map(profiles.map((profile) => [profile.id, profile]))
    if (currentProfile && !profilesById.has(userId)) {
      const mappedCurrentProfile = mapProfile(currentProfile)
      profiles.push(mappedCurrentProfile)
      profilesById.set(mappedCurrentProfile.id, mappedCurrentProfile)
    }
    const messages = await Promise.all(messageRows.map(mapMessage))

    setState({
      profiles,
      contacts: contactRows.map((row) => mapContact(row, userId)),
      conversations: conversationRows.map((row) => {
        const conversationMemberIds = memberRows
          .filter((member) => member.conversation_id === row.id)
          .map((member) => member.user_id as string)
        return mapConversation(row, conversationMemberIds, profilesById, userId, messages)
      }),
      messages,
      members: memberRows.map((member) => ({
        conversationId: member.conversation_id as string,
        userId: member.user_id as string,
        role: member.role as 'owner' | 'admin' | 'member',
        isMuted: Boolean(member.is_muted),
        joinedAt: member.joined_at as string,
      })),
      workspaces: workspaceRows.map(mapWorkspace),
      workspaceMembers: workspaceMemberRows.map(mapWorkspaceMember),
      deviceSessions: deviceSessionRows.map(mapDeviceSession),
      appErrorEvents: appErrorEventRows.map(mapAppErrorEvent),
      adminActivityLogs: adminActivityLogRows.map(mapAdminActivityLog),
      activeWorkspaceId,
    })
    setActiveConversationId((previous) =>
      conversationIds.includes(previous) ? previous : (conversationIds[0] ?? ''),
    )
    setIsLoading(false)
  }, [refreshCurrentDeviceSession])

  useEffect(() => {
    if (!supabase) return

    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      const sessionUser = data.session?.user
      if (sessionUser?.email) {
        const nextUser = { id: sessionUser.id, email: sessionUser.email }
        setUser(nextUser)
        void loadSupabaseState(nextUser.id)
      } else {
        setIsLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user
      if (sessionUser?.email) {
        const nextUser = { id: sessionUser.id, email: sessionUser.email }
        setUser(nextUser)
        void loadSupabaseState(nextUser.id)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadSupabaseState])

  useEffect(() => {
    if (!supabase || !user) return
    const client = supabase
    const reloadState = () => {
      void loadSupabaseState(user.id)
    }

    if (stateChannel.current) {
      void client.removeChannel(stateChannel.current)
    }

    stateChannel.current = client
      .channel(`contacts:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts',
          filter: `owner_id=eq.${user.id}`,
        },
        reloadState,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts',
          filter: `contact_id=eq.${user.id}`,
        },
        reloadState,
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_members',
          filter: `user_id=eq.${user.id}`,
        },
        reloadState,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspace_members',
          filter: `user_id=eq.${user.id}`,
        },
        reloadState,
      )
      .subscribe()

    return () => {
      if (stateChannel.current) {
        void client.removeChannel(stateChannel.current)
        stateChannel.current = null
      }
    }
  }, [loadSupabaseState, user])

  useEffect(() => {
    if (!supabase || !user) return

    let cancelled = false

    const syncDeviceSession = async () => {
      const result = await refreshCurrentDeviceSession(user.id)
      if (cancelled || !result.ok) return

      setState((previous) => ({
        ...previous,
        deviceSessions: result.rows.map(mapDeviceSession),
      }))
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void syncDeviceSession()
    }

    const interval = window.setInterval(() => {
      void syncDeviceSession()
    }, DEVICE_HEARTBEAT_INTERVAL_MS)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refreshCurrentDeviceSession, user])

  useEffect(() => {
    if (!supabase || !user || !activeConversationId) return
    const client = supabase
    const reloadState = () => {
      void loadSupabaseState(user.id)
    }

    if (currentChannel.current) {
      void client.removeChannel(currentChannel.current)
    }

    currentChannel.current = client
      .channel(`messages:${activeConversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>

          void (async () => {
            let messageRow = row

            if (row.attachment_id) {
              const messageResult = await client
                .from('messages')
                .select('*, attachments(*)')
                .eq('id', row.id)
                .single()

              if (messageResult.error) {
                setAuthNotice(
                  friendlyErrorMessage(
                    messageResult.error.message,
                    '无法加载新消息，请刷新后重试。',
                  ),
                )
              } else {
                messageRow = messageResult.data
              }
            }

            const message = await mapMessage(messageRow)
            setState((previous) => withNewMessage(previous, message))
          })()
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        reloadState,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `id=eq.${activeConversationId}`,
        },
        reloadState,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_members',
          filter: `conversation_id=eq.${activeConversationId}`,
        },
        reloadState,
      )
      .subscribe()

    return () => {
      if (currentChannel.current) {
        void client.removeChannel(currentChannel.current)
        currentChannel.current = null
      }
    }
  }, [activeConversationId, loadSupabaseState, user])

  async function createAccountWithEmail(email: string, password: string) {
    const trimmed = email.trim().toLowerCase()
    const cleanPassword = password.trim()
    if (!trimmed || !cleanPassword) return

    if (!supabase) {
      setUser({ ...demoUser, email: trimmed })
      setAuthNotice('')
      return
    }

    allowDeviceRestore.current = true

    const { error } = await supabase.auth.signUp({
      email: trimmed,
      password: cleanPassword,
    })

    if (error) {
      allowDeviceRestore.current = false
      setAuthNotice(friendlyErrorMessage(error.message, '无法创建账号，请重试。'))
      return
    }

    const signIn = await supabase.auth.signInWithPassword({
      email: trimmed,
      password: cleanPassword,
    })

    setAuthNotice(
      signIn.error ? friendlyErrorMessage(signIn.error.message, '账号已创建，但登录失败。') : '',
    )
    if (signIn.error) allowDeviceRestore.current = false
  }

  async function signInWithPassword(email: string, password: string) {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return

    if (!supabase) {
      setUser({ ...demoUser, email: trimmed })
      setAuthNotice('')
      return
    }

    const cleanPassword = password.trim()
    if (!cleanPassword) return

    allowDeviceRestore.current = true

    const { error } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password: cleanPassword,
    })

    if (error) allowDeviceRestore.current = false
    setAuthNotice(error ? friendlyErrorMessage(error.message, '无法登录，请重试。') : '')
  }

  async function signOut() {
    if (supabase) {
      const revoke = await supabase.rpc('revoke_device_session', {
        target_device_id: currentDeviceId,
      })
      if (revoke.error && !isMissingDeviceSessionSchema(revoke.error.message)) {
        setAuthNotice(friendlyErrorMessage(revoke.error.message, '无法更新登录设备状态。'))
      }
      await supabase.auth.signOut({ scope: 'local' })
    }
    pendingUploadFilesRef.current.clear()
    setUser(null)
    setNotice({ message: '', scope: 'global' })
    setState(createDemoState())
  }

  async function refreshDeviceSessions() {
    if (!user) return

    if (!supabase) {
      setAuthNotice('设备列表已刷新。')
      return
    }

    const result = await refreshCurrentDeviceSession(user.id)
    if (!result.ok) return

    setState((previous) => ({
      ...previous,
      deviceSessions: result.rows.map(mapDeviceSession),
    }))
  }

  async function revokeOtherDevices() {
    if (!user) return false

    if (!supabase) {
      setState((previous) => ({
        ...previous,
        deviceSessions: previous.deviceSessions.filter(
          (session) =>
            session.deviceId === currentDeviceId || session.deviceId === 'demo-current-device',
        ),
      }))
      setAuthNotice('其他设备已退出。')
      recordAdminActivity('other_devices_revoked', user.id, 'success')
      return true
    }

    const authSignOut = await supabase.auth.signOut({ scope: 'others' })
    if (authSignOut.error) {
      const notice = friendlyErrorMessage(authSignOut.error.message, '无法退出其他设备，请重试。')
      setAuthNotice(notice)
      recordAppError('devices', notice)
      return false
    }

    const { error } = await supabase.rpc('revoke_other_device_sessions', {
      current_device_id: currentDeviceId,
    })

    if (error) {
      const notice = friendlyErrorMessage(error.message, '无法退出其他设备，请重试。')
      setAuthNotice(notice)
      recordAppError('devices', notice)
      return false
    }

    setAuthNotice('其他设备已退出。')
    recordAdminActivity('other_devices_revoked', user.id, 'success')
    await refreshDeviceSessions()
    return true
  }

  async function revokeDeviceSession(deviceId: string) {
    if (!deviceId || deviceId === currentDeviceId) return false

    if (!supabase) {
      setState((previous) => ({
        ...previous,
        deviceSessions: previous.deviceSessions.filter((session) => session.deviceId !== deviceId),
      }))
      setAuthNotice('设备已移除。')
      return true
    }

    const { error } = await supabase.rpc('revoke_device_session', {
      target_device_id: deviceId,
    })

    if (error) {
      const notice = friendlyErrorMessage(error.message, '无法移除这个设备，请重试。')
      setAuthNotice(notice)
      recordAppError('devices', notice)
      return false
    }

    setAuthNotice('设备已移除。')
    await refreshDeviceSessions()
    return true
  }

  async function sendText(body: string) {
    const trimmed = body.trim()
    const currentUser = user ?? (!supabase ? demoUser : null)
    if (!trimmed || !currentUser || !activeConversation) return
    const sendBlockReason = getSendBlockReason(activeConversation, state.members, currentUser.id)
    if (sendBlockReason) {
      setScopedNotice('chat', sendBlockReason)
      return
    }

    const optimisticMessage: Message = {
      id: uid(),
      conversationId: activeConversation.id,
      senderId: currentUser.id,
      body: trimmed,
      type: 'text',
      status: supabase ? 'sending' : 'read',
      createdAt: new Date().toISOString(),
    }

    setState((previous) => withNewMessage(previous, optimisticMessage))

    if (!supabase) return

    const { error } = await supabase.from('messages').insert({
      id: optimisticMessage.id,
      conversation_id: activeConversation.id,
      sender_id: currentUser.id,
      body: trimmed,
      message_type: 'text',
      status: 'sent',
    })

    if (error) {
      const notice = friendlyErrorMessage(error.message, '消息发送失败，请重试。')
      setScopedNotice('chat', notice)
      setState((previous) => ({
        ...previous,
        messages: previous.messages.filter((message) => message.id !== optimisticMessage.id),
      }))
      recordAppError('messages', notice, { conversationId: activeConversation.id })
    } else {
      setState((previous) => ({
        ...previous,
        messages: previous.messages.map((message) =>
          message.id === optimisticMessage.id ? { ...message, status: 'sent' } : message,
        ),
      }))
    }
  }

  async function sendFile(file: File) {
    if (!user || !activeConversation) return
    const sendBlockReason = getSendBlockReason(activeConversation, state.members, user.id)
    if (sendBlockReason) {
      setScopedNotice('chat', sendBlockReason)
      return
    }

    const validation = validateAttachment(file)
    if (!validation.ok) {
      setScopedNotice('chat', validation.reason)
      return
    }

    const messageType: Message['type'] = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('video/')
        ? 'video'
        : 'file'
    const attachment = {
      id: uid(),
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      url: URL.createObjectURL(file),
    }

    const message: Message = {
      id: uid(),
      conversationId: activeConversation.id,
      senderId: user.id,
      body: messageType === 'image' ? '图片' : messageType === 'video' ? '视频' : file.name,
      type: messageType,
      status: supabase ? 'sending' : 'read',
      uploadProgress: supabase ? 0 : undefined,
      createdAt: new Date().toISOString(),
      attachment,
    }

    setState((previous) => withNewMessage(previous, message))
    pendingUploadFilesRef.current.set(message.id, file)

    if (!supabase) {
      pendingUploadFilesRef.current.delete(message.id)
      return
    }

    const storagePath = `${user.id}/${activeConversation.id}/${Date.now()}-${safeFileName(
      file.name,
    )}`
    try {
      await uploadStorageObject(chatStorageBucket, storagePath, file, {
        contentType: attachment.mimeType,
        onProgress: (progress) => {
          setState((previous) => ({
            ...previous,
            messages: previous.messages.map((item) =>
              item.id === message.id ? { ...item, uploadProgress: progress } : item,
            ),
          }))
        },
      })
    } catch (error) {
      const notice = friendlyErrorMessage(
        error instanceof Error ? error.message : '',
        '文件上传失败，请重试。',
      )
      setScopedNotice('chat', notice)
      setState((previous) => ({
        ...previous,
        messages: previous.messages.map((item) =>
          item.id === message.id ? { ...item, status: 'failed', uploadError: notice } : item,
        ),
      }))
      recordAppError('attachments', notice, {
        conversationId: activeConversation.id,
        sizeBytes: file.size,
      })
      return
    }

    const attachmentInsert = await supabase
      .from('attachments')
      .insert({
        id: attachment.id,
        owner_id: user.id,
        bucket_path: storagePath,
        file_name: file.name,
        mime_type: attachment.mimeType,
        size_bytes: file.size,
      })
      .select()
      .single()

    if (attachmentInsert.error) {
      const notice = friendlyErrorMessage(
        attachmentInsert.error.message,
        '无法保存文件信息，请重试。',
      )
      setScopedNotice('chat', notice)
      setState((previous) => ({
        ...previous,
        messages: previous.messages.map((item) =>
          item.id === message.id ? { ...item, status: 'failed', uploadError: notice } : item,
        ),
      }))
      recordAppError('attachments', notice, {
        conversationId: activeConversation.id,
        sizeBytes: file.size,
      })
      return
    }

    const messageInsert = await supabase.from('messages').insert({
      id: message.id,
      conversation_id: activeConversation.id,
      sender_id: user.id,
      body: message.body,
      message_type: message.type,
      attachment_id: attachment.id,
      status: 'sent',
    })

    if (messageInsert.error) {
      const notice = friendlyErrorMessage(messageInsert.error.message, '文件消息发送失败，请重试。')
      setScopedNotice('chat', notice)
      setState((previous) => ({
        ...previous,
        messages: previous.messages.map((item) =>
          item.id === message.id ? { ...item, status: 'failed', uploadError: notice } : item,
        ),
      }))
      recordAppError('attachments', notice, {
        conversationId: activeConversation.id,
        sizeBytes: file.size,
      })
    } else {
      pendingUploadFilesRef.current.delete(message.id)
      setState((previous) => ({
        ...previous,
        messages: previous.messages.map((item) =>
          item.id === message.id
            ? { ...item, status: 'sent', uploadError: undefined, uploadProgress: undefined }
            : item,
        ),
      }))
    }
  }

  function removeFailedMessage(messageId: string) {
    pendingUploadFilesRef.current.delete(messageId)
    setState((previous) => ({
      ...previous,
      messages: previous.messages.filter((message) => message.id !== messageId),
    }))
  }

  async function retryFileMessage(messageId: string) {
    const file = pendingUploadFilesRef.current.get(messageId)
    const failedMessage = state.messages.find((message) => message.id === messageId)

    if (!file || !failedMessage) {
      setScopedNotice('chat', '无法重试这个文件，请重新选择上传。')
      return
    }

    if (!activeConversation || activeConversation.id !== failedMessage.conversationId) {
      setScopedNotice('chat', '请先回到这条失败消息所在的会话再重试。')
      return
    }

    pendingUploadFilesRef.current.delete(messageId)
    setState((previous) => ({
      ...previous,
      messages: previous.messages.filter((message) => message.id !== messageId),
    }))
    await sendFile(file)
  }

  function updateProfile(nextProfile: Pick<Profile, 'displayName' | 'bio'>) {
    if (!user) return

    setState((previous) => ({
      ...previous,
      profiles: previous.profiles.map((profile) =>
        profile.id === user.id ? { ...profile, ...nextProfile } : profile,
      ),
    }))

    if (supabase) {
      void supabase
        .from('profiles')
        .update({
          display_name: nextProfile.displayName,
          bio: nextProfile.bio,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
    }
  }

  async function updateProfileAvatar(file: File) {
    const currentUser = user ?? (!supabase ? demoUser : null)
    if (!currentUser) return

    const validation = validateAvatar(file)
    if (!validation.ok) {
      setScopedNotice('profile', validation.reason)
      return
    }

    setProfileUploadProgress({ label: '上传图片头像', percent: 0 })
    const localUrl = URL.createObjectURL(file)

    setState((previous) => ({
      ...previous,
      profiles: previous.profiles.map((profile) =>
        profile.id === currentUser.id
          ? {
              ...profile,
              avatarUrl: localUrl,
              avatarMediaType: 'image',
              avatarVideoUrl: '',
              avatarVideoPosterUrl: '',
              avatarVideoUpdatedAt: '',
            }
          : profile,
      ),
    }))

    if (!supabase) {
      setProfileUploadProgress(null)
      setScopedNotice('profile', '头像已更新。')
      return
    }

    const storagePath = `${currentUser.id}/avatar-${Date.now()}.${avatarFileExtension(file)}`
    try {
      await uploadStorageObject(avatarStorageBucket, storagePath, file, {
        cacheControl: '3600',
        contentType: file.type,
        onProgress: (percent) =>
          setProfileUploadProgress({ label: '上传图片头像', percent }),
      })
    } catch (error) {
      setProfileUploadProgress(null)
      setScopedNotice(
        'profile',
        friendlyErrorMessage(
          error instanceof Error ? error.message : '',
          '头像上传失败，请重试。',
        ),
      )
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(avatarStorageBucket).getPublicUrl(storagePath)

    let profileUpdate = await supabase
      .from('profiles')
      .update({
        avatar_url: publicUrl,
        avatar_media_type: 'image',
        avatar_video_url: null,
        avatar_video_poster_url: null,
        avatar_video_updated_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentUser.id)

    if (
      profileUpdate.error &&
      /avatar_media_type|avatar_video/i.test(profileUpdate.error.message)
    ) {
      profileUpdate = await supabase
        .from('profiles')
        .update({
          avatar_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', currentUser.id)
    }

    if (profileUpdate.error) {
      setProfileUploadProgress(null)
      setScopedNotice(
        'profile',
        friendlyErrorMessage(profileUpdate.error.message, '头像已上传，但资料更新失败。'),
      )
      return
    }

    setState((previous) => ({
      ...previous,
      profiles: previous.profiles.map((profile) =>
        profile.id === currentUser.id
          ? {
              ...profile,
              avatarUrl: publicUrl,
              avatarMediaType: 'image',
              avatarVideoUrl: '',
              avatarVideoPosterUrl: '',
              avatarVideoUpdatedAt: '',
            }
          : profile,
      ),
    }))
    setProfileUploadProgress(null)
    setScopedNotice('profile', '头像已更新。')
  }

  async function updateProfileVideoAvatar(file: File) {
    const currentUser = user ?? (!supabase ? demoUser : null)
    if (!currentUser) return

    const validation = validateAvatarVideo(file)
    if (!validation.ok) {
      setScopedNotice('profile', validation.reason)
      return
    }

    setProfileUploadProgress({ label: '正在检查视频头像', percent: 5 })
    let processedVideo: Awaited<ReturnType<typeof processAvatarVideo>>
    try {
      setProfileUploadProgress({ label: '正在压缩视频头像', percent: 12 })
      processedVideo = await processAvatarVideo(file)
    } catch {
      setProfileUploadProgress(null)
      setScopedNotice('profile', '当前浏览器无法自动压缩这个视频，请换一个更短的视频。')
      return
    }

    const localVideoUrl = URL.createObjectURL(processedVideo.videoBlob)
    const localPosterUrl = URL.createObjectURL(processedVideo.posterBlob)
    const updatedAt = new Date().toISOString()

    setState((previous) => ({
      ...previous,
      profiles: previous.profiles.map((profile) =>
        profile.id === currentUser.id
          ? {
              ...profile,
              avatarUrl: localPosterUrl,
              avatarMediaType: 'video',
              avatarVideoUrl: localVideoUrl,
              avatarVideoPosterUrl: localPosterUrl,
              avatarVideoUpdatedAt: updatedAt,
            }
          : profile,
      ),
    }))

    if (!supabase) {
      setProfileUploadProgress(null)
      setScopedNotice('profile', '视频头像已更新。')
      return
    }

    const timestamp = Date.now()
    const videoExtension = processedVideo.videoBlob.type.includes('webm') ? 'webm' : 'mp4'
    const videoPath = `${currentUser.id}/avatar-video-${timestamp}.${videoExtension}`
    const posterPath = `${currentUser.id}/avatar-video-poster-${timestamp}.jpg`

    try {
      setProfileUploadProgress({ label: '正在上传视频头像', percent: 15 })
      await uploadStorageObject(avatarVideoStorageBucket, videoPath, processedVideo.videoBlob, {
        cacheControl: '3600',
        contentType: processedVideo.videoBlob.type || file.type,
        onProgress: (percent) =>
          setProfileUploadProgress({
            label: '正在上传视频头像',
            percent: Math.min(75, 15 + Math.round(percent * 0.6)),
          }),
      })
    } catch (error) {
      setProfileUploadProgress(null)
      setScopedNotice(
        'profile',
        friendlyErrorMessage(
          error instanceof Error ? error.message : '',
          '视频头像上传失败，请重试。',
        ),
      )
      return
    }

    try {
      setProfileUploadProgress({ label: '正在上传视频封面', percent: 76 })
      await uploadStorageObject(avatarStorageBucket, posterPath, processedVideo.posterBlob, {
        cacheControl: '3600',
        contentType: 'image/jpeg',
        onProgress: (percent) =>
          setProfileUploadProgress({
            label: '正在上传视频封面',
            percent: Math.min(96, 76 + Math.round(percent * 0.2)),
          }),
      })
    } catch (error) {
      setProfileUploadProgress(null)
      setScopedNotice(
        'profile',
        friendlyErrorMessage(
          error instanceof Error ? error.message : '',
          '视频封面上传失败，请重试。',
        ),
      )
      return
    }

    const {
      data: { publicUrl: videoUrl },
    } = supabase.storage.from(avatarVideoStorageBucket).getPublicUrl(videoPath)
    const {
      data: { publicUrl: posterUrl },
    } = supabase.storage.from(avatarStorageBucket).getPublicUrl(posterPath)

    setProfileUploadProgress({ label: '正在保存头像资料', percent: 98 })
    const profileUpdate = await supabase
      .from('profiles')
      .update({
        avatar_url: posterUrl,
        avatar_media_type: 'video',
        avatar_video_url: videoUrl,
        avatar_video_poster_url: posterUrl,
        avatar_video_updated_at: updatedAt,
        updated_at: updatedAt,
      })
      .eq('id', currentUser.id)

    if (profileUpdate.error) {
      setProfileUploadProgress(null)
      setScopedNotice(
        'profile',
        friendlyErrorMessage(profileUpdate.error.message, '视频头像已上传，但资料更新失败。'),
      )
      return
    }

    setState((previous) => ({
      ...previous,
      profiles: previous.profiles.map((profile) =>
        profile.id === currentUser.id
          ? {
              ...profile,
              avatarUrl: posterUrl,
              avatarMediaType: 'video',
              avatarVideoUrl: videoUrl,
              avatarVideoPosterUrl: posterUrl,
              avatarVideoUpdatedAt: updatedAt,
            }
          : profile,
      ),
    }))
    setProfileUploadProgress(null)
    setScopedNotice('profile', '视频头像已更新。')
  }

  async function removeProfileVideoAvatar() {
    const currentUser = user ?? (!supabase ? demoUser : null)
    if (!currentUser) return
    const updatedAt = new Date().toISOString()

    setState((previous) => ({
      ...previous,
      profiles: previous.profiles.map((profile) =>
        profile.id === currentUser.id
          ? {
              ...profile,
              avatarMediaType: 'image',
              avatarVideoUrl: '',
              avatarVideoPosterUrl: '',
              avatarVideoUpdatedAt: '',
            }
          : profile,
      ),
    }))

    if (!supabase) {
      setScopedNotice('profile', '已移除视频头像。')
      return
    }

    const profileUpdate = await supabase
      .from('profiles')
      .update({
        avatar_media_type: 'image',
        avatar_video_url: null,
        avatar_video_poster_url: null,
        avatar_video_updated_at: null,
        updated_at: updatedAt,
      })
      .eq('id', currentUser.id)

    if (profileUpdate.error) {
      setScopedNotice('profile', friendlyErrorMessage(profileUpdate.error.message, '无法移除视频头像。'))
      return
    }

    setScopedNotice('profile', '已移除视频头像。')
  }

  async function createGroup() {
    if (!user) return false

    const groupTitle = '新群聊'
    const createdAt = new Date().toISOString()

    if (supabase) {
      const { data, error } = await supabase.rpc('create_group_conversation', {
        group_title: groupTitle,
      })

      if (error) {
        setScopedNotice('list', friendlyErrorMessage(error.message, '无法创建群聊，请重试。'))
        return false
      }

      const createdConversation = Array.isArray(data) ? data[0] : data
      const conversationId = createdConversation?.conversation_id as string | undefined

      if (!conversationId) {
        setScopedNotice('list', '无法创建群聊，请刷新后重试。')
        return false
      }

      const conversation: Conversation = {
        id: conversationId,
        type: 'group',
        title: (createdConversation?.conversation_title as string | undefined) ?? groupTitle,
        workspaceId:
          (createdConversation?.conversation_workspace_id as string | undefined) ||
          state.activeWorkspaceId ||
          undefined,
        memberIds: [user.id],
        memberCount: 1,
        unreadCount: 0,
        updatedAt:
          (createdConversation?.conversation_updated_at as string | undefined) ?? createdAt,
        lastMessage: '群聊已创建',
        isMuted: false,
      }

      setState((previous) => ({
        ...previous,
        conversations: [conversation, ...previous.conversations],
        members: upsertMembers(previous.members, conversation.id, conversation.memberIds),
      }))
      setActiveConversationId(conversationId)
      return true
    }

    const groupId = uid()
    const conversation: Conversation = {
      id: groupId,
      type: 'group',
      title: groupTitle,
      workspaceId: state.activeWorkspaceId || undefined,
      memberIds: [user.id],
      memberCount: 1,
      unreadCount: 0,
      updatedAt: createdAt,
      lastMessage: '群聊已创建',
      isMuted: false,
    }

    setState((previous) => ({
      ...previous,
      conversations: [conversation, ...previous.conversations],
      members: upsertMembers(previous.members, conversation.id, conversation.memberIds),
    }))
    setActiveConversationId(groupId)
    return true

  }

  async function sendContactRequestByEmail(email: string) {
    const trimmed = email.trim().toLowerCase()
    const currentUser = user ?? (!supabase ? demoUser : null)
    if (!trimmed || !currentUser) return false

    if (trimmed === currentUser.email.toLowerCase()) {
      setScopedNotice('list', '不能添加自己。')
      return false
    }

    if (!supabase) {
      const targetProfileId = demoProfileEmails[trimmed]
      const targetProfile = state.profiles.find((profile) => profile.id === targetProfileId)

      if (!targetProfile) {
        const notice = '没有找到使用这个邮箱注册的用户。请确认对方已经注册。'
        setScopedNotice('list', notice)
        return false
      }

      const existingConversation = findDirectConversation(
        state.conversations,
        currentUser.id,
        targetProfile.id,
      )

      if (existingConversation) {
        setActiveConversationId(existingConversation.id)
        setScopedNotice('list', '已打开现有聊天。')
        return true
      }

      const existingContact = state.contacts.find(
        (contact) =>
          ((contact.ownerId === currentUser.id && contact.contactId === targetProfile.id) ||
            (contact.ownerId === targetProfile.id && contact.contactId === currentUser.id)) &&
          contact.status !== 'declined',
      )

      if (existingContact?.status === 'pending') {
        setScopedNotice(
          'list',
          existingContact.direction === 'incoming'
            ? '对方已经给你发来申请，请在好友申请里处理。'
            : '好友申请已发送，等待对方同意。',
        )
        return true
      }

      if (existingContact?.status === 'accepted') {
        setScopedNotice('list', '你们已经是好友，可以在聊天列表里继续对话。')
        return true
      }

      const contactRequest: ContactRequest = {
        id: uid(),
        ownerId: currentUser.id,
        contactId: targetProfile.id,
        status: 'pending',
        createdAt: new Date().toISOString(),
        direction: 'outgoing',
      }

      setState((previous) => ({
        ...previous,
        contacts: upsertContact(previous.contacts, contactRequest),
      }))
      setScopedNotice('list', '已发送好友申请，等待对方同意。')
      return true
    }

    const { data, error } = await supabase
      .rpc('send_contact_request_by_email', { search_email: trimmed })
      .single()

    if (error) {
      setScopedNotice(
        'list',
        friendlyErrorMessage(error.message, '无法发送好友申请，请检查邮箱后重试。'),
      )
      return false
    }

    const row = data as Record<string, unknown>
    const targetProfile = mapProfile({
      id: row.target_profile_id,
      display_name: row.target_display_name,
      avatar_url: row.target_avatar_url,
      avatar_tone: row.target_avatar_tone,
      bio: row.target_bio,
      status: row.target_status,
      last_seen: row.target_last_seen,
    })
    const contactStatus = String(row.contact_status ?? 'pending') as ContactStatus
    const contactRequest: ContactRequest = {
      id: String(row.request_id),
      ownerId: currentUser.id,
      contactId: targetProfile.id,
      status: contactStatus,
      createdAt: String(row.created_at ?? new Date().toISOString()),
      direction: 'outgoing',
    }

    setState((previous) => ({
      ...previous,
      profiles: upsertProfile(previous.profiles, targetProfile),
      contacts: upsertContact(previous.contacts, contactRequest),
    }))

    if (contactStatus === 'accepted') {
      const existingConversation = findDirectConversation(
        state.conversations,
        currentUser.id,
        targetProfile.id,
      )
      if (existingConversation) setActiveConversationId(existingConversation.id)
      setScopedNotice('list', '你们已经是好友，可以在聊天列表里继续对话。')
      void loadSupabaseState(currentUser.id)
      return true
    }

    if (contactStatus === 'declined') {
      setScopedNotice('list', '对方已拒绝好友申请。')
      return true
    }

    setScopedNotice('list', '已发送好友申请，等待对方同意。')
    return true
  }

  async function respondToContactRequest(requestId: string, action: 'accepted' | 'declined') {
    const currentUser = user ?? (!supabase ? demoUser : null)
    if (!currentUser) return null

    const request = state.contacts.find((contact) => contact.id === requestId)
    if (!request || request.direction !== 'incoming') {
      setAuthNotice('没有找到这条好友申请。')
      return null
    }

    const requesterProfile = state.profiles.find((profile) => profile.id === request.ownerId)

    if (!supabase) {
      if (action === 'declined') {
        setState((previous) => ({
          ...previous,
          contacts: previous.contacts.map((contact) =>
            contact.id === requestId ? { ...contact, status: 'declined' } : contact,
          ),
        }))
        setAuthNotice('已拒绝好友申请。')
        return null
      }

      if (!requesterProfile) {
        setAuthNotice('无法读取申请人资料。')
        return null
      }

      const existingConversation = findDirectConversation(
        state.conversations,
        currentUser.id,
        requesterProfile.id,
      )
      const conversationId = existingConversation?.id ?? uid()
      const conversation: Conversation = existingConversation ?? {
        id: conversationId,
        type: 'direct',
        title: requesterProfile.displayName,
        memberIds: [currentUser.id, requesterProfile.id],
        memberCount: 2,
        unreadCount: 0,
        updatedAt: new Date().toISOString(),
        lastMessage: '',
        isMuted: false,
      }

      const reciprocalContact: ContactRequest = {
        id: uid(),
        ownerId: currentUser.id,
        contactId: requesterProfile.id,
        status: 'accepted',
        createdAt: new Date().toISOString(),
        direction: 'outgoing',
      }

      setState((previous) => ({
        ...previous,
        contacts: upsertContact(
          upsertContact(
            previous.contacts.map((contact) =>
              contact.id === requestId ? { ...contact, status: 'accepted' } : contact,
            ),
            reciprocalContact,
          ),
          { ...request, status: 'accepted' },
        ),
        conversations: upsertConversation(previous.conversations, conversation),
        members: upsertMembers(previous.members, conversation.id, conversation.memberIds),
      }))
      setActiveConversationId(conversationId)
      setAuthNotice(`已同意 ${requesterProfile.displayName} 的好友申请。`)
      return conversationId
    }

    const { data, error } = await supabase
      .rpc('respond_to_contact_request', { request_id: requestId, action })
      .single()

    if (error) {
      setAuthNotice(friendlyErrorMessage(error.message, '无法处理好友申请，请重试。'))
      return null
    }

    const row = data as Record<string, unknown>
    const nextStatus = String(row.contact_status ?? action) as ContactStatus
    const profile = mapProfile({
      id: row.requester_profile_id,
      display_name: row.requester_display_name,
      avatar_url: row.requester_avatar_url,
      avatar_tone: row.requester_avatar_tone,
      bio: row.requester_bio,
      status: row.requester_status,
      last_seen: row.requester_last_seen,
    })
    const updatedContact: ContactRequest = {
      id: String(row.request_id ?? requestId),
      ownerId: profile.id,
      contactId: currentUser.id,
      status: nextStatus,
      createdAt: request.createdAt,
      direction: 'incoming',
    }

    const conversationId = row.conversation_id ? String(row.conversation_id) : null
    const conversation: Conversation | null =
      nextStatus === 'accepted' && conversationId
        ? {
            id: conversationId,
            type: 'direct',
            title: profile.displayName,
            memberIds: [currentUser.id, profile.id],
            memberCount: 2,
            unreadCount: 0,
            updatedAt: new Date().toISOString(),
            lastMessage: '',
            isMuted: false,
          }
        : null

    setState((previous) => ({
      ...previous,
      profiles: upsertProfile(previous.profiles, profile),
      contacts: upsertContact(previous.contacts, updatedContact),
      conversations: conversation
        ? upsertConversation(previous.conversations, conversation)
        : previous.conversations,
      members: conversation
        ? upsertMembers(previous.members, conversation.id, conversation.memberIds)
        : previous.members,
    }))

    if (conversationId && nextStatus === 'accepted') {
      setActiveConversationId(conversationId)
      setAuthNotice(`已同意 ${profile.displayName} 的好友申请。`)
      void loadSupabaseState(currentUser.id)
      return conversationId
    }

    setAuthNotice('已拒绝好友申请。')
    return null
  }

  async function addWorkspaceMemberByEmail(email: string, role: WorkspaceRole = 'member') {
    const trimmed = email.trim().toLowerCase()
    const currentUser = user ?? (!supabase ? demoUser : null)
    if (!trimmed || !currentUser || !activeWorkspace) return false

    if (trimmed === currentUser.email.toLowerCase()) {
      setAuthNotice('你已经在当前工作区。')
      return false
    }

    if (!isWorkspaceManager(activeWorkspaceRole)) {
      setAuthNotice('只有 owner 或 admin 可以添加工作区成员。')
      return false
    }

    if (!supabase) {
      const targetProfileId = demoProfileEmails[trimmed]
      const targetProfile = state.profiles.find((profile) => profile.id === targetProfileId)

      if (!targetProfile) {
        setAuthNotice('没有找到使用这个邮箱注册的用户。')
        return false
      }

      const exists = state.workspaceMembers.some(
        (member) =>
          member.workspaceId === activeWorkspace.id && member.userId === targetProfile.id,
      )
      if (exists) {
        setAuthNotice('这个用户已经在当前工作区。')
        return true
      }

      const workspaceMember: WorkspaceMember = {
        workspaceId: activeWorkspace.id,
        userId: targetProfile.id,
        role,
        joinedAt: new Date().toISOString(),
      }

      setState((previous) => ({
        ...previous,
        workspaceMembers: upsertWorkspaceMember(previous.workspaceMembers, workspaceMember),
      }))
      setAuthNotice(`已将 ${targetProfile.displayName} 加入 ${activeWorkspace.name}。`)
      recordAdminActivity('member_added', targetProfile.id, 'success', { role })
      return true
    }

    const { data, error } = await supabase
      .rpc('add_workspace_member_by_email', {
        search_email: trimmed,
        requested_role: role,
      })
      .single()

    if (error) {
      const notice = friendlyErrorMessage(
        error.message,
        '无法添加工作区成员，请检查邮箱后重试。请确认对方已经注册。',
      )
      setAuthNotice(notice)
      recordAppError('workspace_members', notice, { role })
      recordAdminActivity('member_added', '', 'failure', { role, reason: notice })
      return false
    }

    const row = data as Record<string, unknown>
    const profile = mapProfile({
      id: row.member_user_id,
      display_name: row.member_display_name,
      avatar_url: row.member_avatar_url,
      avatar_tone: row.member_avatar_tone,
      bio: row.member_bio,
      status: row.member_status,
      last_seen: row.member_last_seen,
    })
    const workspaceMember = mapWorkspaceMember({
      workspace_id: row.workspace_id,
      user_id: row.member_user_id,
      role: row.member_role,
      joined_at: row.joined_at,
    })

    setState((previous) => ({
      ...previous,
      profiles: upsertProfile(previous.profiles, profile),
      workspaceMembers: upsertWorkspaceMember(previous.workspaceMembers, workspaceMember),
    }))
    setAuthNotice(`已将 ${profile.displayName} 加入当前工作区。`)
    recordAdminActivity('member_added', profile.id, 'success', { role: workspaceMember.role })
    void loadSupabaseState(currentUser.id)
    return true
  }

  async function removeWorkspaceMember(memberUserId: string) {
    const currentUser = user ?? (!supabase ? demoUser : null)
    if (!currentUser || !activeWorkspace) return false

    if (memberUserId === currentUser.id) {
      setAuthNotice('不能在这里移除自己。')
      return false
    }

    if (!isWorkspaceManager(activeWorkspaceRole)) {
      setAuthNotice('只有 owner 或 admin 可以移除工作区成员。')
      return false
    }

    const targetMember = state.workspaceMembers.find(
      (member) => member.workspaceId === activeWorkspace.id && member.userId === memberUserId,
    )
    if (!targetMember) {
      setAuthNotice('没有找到这个工作区成员。')
      return false
    }

    if (targetMember.role === 'owner') {
      setAuthNotice('不能移除工作区 owner。')
      return false
    }

    if (!supabase) {
      setState((previous) => ({
        ...previous,
        workspaceMembers: previous.workspaceMembers.filter(
          (member) =>
            !(member.workspaceId === activeWorkspace.id && member.userId === memberUserId),
        ),
        conversations: previous.conversations.map((conversation) =>
          conversation.workspaceId === activeWorkspace.id
            ? {
                ...conversation,
                memberIds: conversation.memberIds.filter((id) => id !== memberUserId),
                memberCount: conversation.memberIds.filter((id) => id !== memberUserId).length,
              }
            : conversation,
        ),
      }))
      setAuthNotice('成员已移除。')
      recordAdminActivity('member_removed', memberUserId, 'success')
      return true
    }

    const { error } = await supabase.rpc('remove_workspace_member', {
      member_user_id: memberUserId,
    })

    if (error) {
      const notice = friendlyErrorMessage(error.message, '无法移除工作区成员，请重试。')
      setAuthNotice(notice)
      recordAppError('workspace_members', notice, { targetUserId: memberUserId })
      recordAdminActivity('member_removed', memberUserId, 'failure', { reason: notice })
      return false
    }

    setState((previous) => ({
      ...previous,
      workspaceMembers: previous.workspaceMembers.filter(
        (member) =>
          !(member.workspaceId === activeWorkspace.id && member.userId === memberUserId),
      ),
      conversations: previous.conversations.map((conversation) =>
        conversation.workspaceId === activeWorkspace.id
          ? {
              ...conversation,
              memberIds: conversation.memberIds.filter((id) => id !== memberUserId),
              memberCount: conversation.memberIds.filter((id) => id !== memberUserId).length,
            }
          : conversation,
      ),
    }))
    setAuthNotice('成员已移除，受影响用户刷新后将无法继续访问该工作区群聊。')
    recordAdminActivity('member_removed', memberUserId, 'success')
    void loadSupabaseState(currentUser.id)
    return true
  }

  async function updateWorkspaceMemberRole(memberUserId: string, role: WorkspaceRole) {
    const currentUser = user ?? (!supabase ? demoUser : null)
    if (!currentUser || !activeWorkspace) return false

    if (!isWorkspaceManager(activeWorkspaceRole)) {
      setAuthNotice('只有 owner 或 admin 可以调整工作区成员角色。')
      return false
    }

    if (role === 'owner') {
      setAuthNotice('当前版本暂不支持转移 owner。')
      return false
    }

    if (!supabase) {
      setState((previous) => ({
        ...previous,
        workspaceMembers: previous.workspaceMembers.map((member) =>
          member.workspaceId === activeWorkspace.id && member.userId === memberUserId
            ? { ...member, role }
            : member,
        ),
      }))
      setAuthNotice('成员角色已更新。')
      recordAdminActivity('member_role_updated', memberUserId, 'success', { role })
      return true
    }

    const { error } = await supabase.rpc('update_workspace_member_role', {
      member_user_id: memberUserId,
      requested_role: role,
    })

    if (error) {
      const notice = friendlyErrorMessage(error.message, '无法更新成员角色，请重试。')
      setAuthNotice(notice)
      recordAppError('workspace_members', notice, { targetUserId: memberUserId, role })
      recordAdminActivity('member_role_updated', memberUserId, 'failure', {
        role,
        reason: notice,
      })
      return false
    }

    setState((previous) => ({
      ...previous,
      workspaceMembers: previous.workspaceMembers.map((member) =>
        member.workspaceId === activeWorkspace.id && member.userId === memberUserId
          ? { ...member, role }
          : member,
      ),
    }))
    setAuthNotice('成员角色已更新。')
    recordAdminActivity('member_role_updated', memberUserId, 'success', { role })
    void loadSupabaseState(currentUser.id)
    return true
  }

  async function addGroupMember(conversationId: string, memberUserId: string) {
    const currentUser = user ?? (!supabase ? demoUser : null)
    const conversation = state.conversations.find((item) => item.id === conversationId)
    const targetProfile = state.profiles.find((profile) => profile.id === memberUserId)
    if (!currentUser || !conversation || conversation.type !== 'group' || !targetProfile) return false

    const currentMember = findConversationMember(state.members, conversationId, currentUser.id)
    if (!isGroupManagerRole(currentMember?.role)) {
      setAuthNotice('只有群 owner 或 admin 可以添加群成员。')
      return false
    }

    if (conversation.memberIds.includes(memberUserId)) {
      setAuthNotice('这个成员已经在群聊中。')
      return true
    }

    if (
      conversation.workspaceId &&
      !state.workspaceMembers.some(
        (member) =>
          member.workspaceId === conversation.workspaceId && member.userId === memberUserId,
      )
    ) {
      setAuthNotice('只能添加当前工作区成员进群。')
      return false
    }

    const member: ConversationMember = {
      conversationId,
      userId: memberUserId,
      role: 'member',
      isMuted: false,
      joinedAt: new Date().toISOString(),
    }

    if (!supabase) {
      setState((previous) => ({
        ...previous,
        conversations: previous.conversations.map((item) =>
          item.id === conversationId
            ? {
                ...item,
                memberIds: [...item.memberIds, memberUserId],
                memberCount: item.memberCount + 1,
              }
            : item,
        ),
        members: upsertConversationMember(previous.members, member),
      }))
      setAuthNotice(`已将 ${targetProfile.displayName} 加入群聊。`)
      recordAdminActivity('group_member_added', memberUserId, 'success', { conversationId })
      return true
    }

    const { error } = await supabase.rpc('add_group_member', {
      conversation_id: conversationId,
      member_user_id: memberUserId,
    })

    if (error) {
      const notice = friendlyErrorMessage(error.message, '无法添加群成员，请稍后重试。')
      setAuthNotice(notice)
      recordAppError('workspace_members', notice, { conversationId, targetUserId: memberUserId })
      return false
    }

    setState((previous) => ({
      ...previous,
      conversations: previous.conversations.map((item) =>
        item.id === conversationId
          ? {
              ...item,
              memberIds: item.memberIds.includes(memberUserId)
                ? item.memberIds
                : [...item.memberIds, memberUserId],
              memberCount: item.memberIds.includes(memberUserId)
                ? item.memberCount
                : item.memberCount + 1,
            }
          : item,
      ),
      members: upsertConversationMember(previous.members, member),
    }))
    setAuthNotice(`已将 ${targetProfile.displayName} 加入群聊。`)
    void loadSupabaseState(currentUser.id)
    return true
  }

  async function addGroupMemberByEmail(conversationId: string, email: string) {
    const trimmed = email.trim().toLowerCase()
    const currentUser = user ?? (!supabase ? demoUser : null)
    const conversation = state.conversations.find((item) => item.id === conversationId)
    if (!trimmed || !currentUser || !conversation || conversation.type !== 'group') return false

    const currentMember = findConversationMember(state.members, conversationId, currentUser.id)
    if (!isGroupManagerRole(currentMember?.role)) {
      setAuthNotice('只有群 owner 或 admin 可以添加群成员。')
      return false
    }

    if (trimmed === currentUser.email.toLowerCase()) {
      setAuthNotice('你已经在这个群聊中。')
      return false
    }

    if (!supabase) {
      const targetProfileId = demoProfileEmails[trimmed]
      const targetProfile = state.profiles.find((profile) => profile.id === targetProfileId)

      if (!targetProfile) {
        setAuthNotice('对方需先注册，才能被添加到群聊。')
        return false
      }

      if (conversation.memberIds.includes(targetProfile.id)) {
        setAuthNotice('对方已经在群聊中。')
        return true
      }

      const joinedAt = new Date().toISOString()
      const workspaceMember: WorkspaceMember | null = conversation.workspaceId
        ? {
            workspaceId: conversation.workspaceId,
            userId: targetProfile.id,
            role: 'member',
            joinedAt,
          }
        : null
      const groupMember: ConversationMember = {
        conversationId,
        userId: targetProfile.id,
        role: 'member',
        isMuted: false,
        joinedAt,
      }

      setState((previous) => ({
        ...previous,
        conversations: previous.conversations.map((item) =>
          item.id === conversationId
            ? {
                ...item,
                memberIds: item.memberIds.includes(targetProfile.id)
                  ? item.memberIds
                  : [...item.memberIds, targetProfile.id],
                memberCount: item.memberIds.includes(targetProfile.id)
                  ? item.memberCount
                  : item.memberCount + 1,
              }
            : item,
        ),
        members: upsertConversationMember(previous.members, groupMember),
        workspaceMembers: workspaceMember
          ? upsertWorkspaceMember(previous.workspaceMembers, workspaceMember)
          : previous.workspaceMembers,
      }))
      setAuthNotice(`已将 ${targetProfile.displayName} 加入群聊。`)
      recordAdminActivity('group_member_added', targetProfile.id, 'success', { conversationId })
      return true
    }

    const { data, error } = await supabase
      .rpc('add_group_member_by_email', {
        target_conversation_id: conversationId,
        search_email: trimmed,
      })
      .single()

    if (error) {
      const notice = friendlyErrorMessage(error.message, '无法添加群成员，请确认对方已经注册后重试。')
      setAuthNotice(notice)
      recordAppError('workspace_members', notice, { conversationId })
      return false
    }

    const row = data as Record<string, unknown>
    const profile = mapProfile({
      id: row.result_member_user_id,
      display_name: row.member_display_name,
      avatar_url: row.member_avatar_url,
      avatar_tone: row.member_avatar_tone,
      bio: row.member_bio,
      status: row.member_status,
      last_seen: row.member_last_seen,
    })
    const groupMember: ConversationMember = {
      conversationId: String(row.result_conversation_id ?? conversationId),
      userId: String(row.result_member_user_id),
      role: (row.result_member_role as MemberRole) ?? 'member',
      isMuted: false,
      joinedAt: String(row.result_joined_at ?? new Date().toISOString()),
    }
    const workspaceMember: WorkspaceMember | null = row.result_workspace_id
      ? {
          workspaceId: String(row.result_workspace_id),
          userId: String(row.result_member_user_id),
          role: (row.result_workspace_role as WorkspaceRole) ?? 'member',
          joinedAt: String(row.result_workspace_joined_at ?? new Date().toISOString()),
        }
      : null

    setState((previous) => ({
      ...previous,
      profiles: upsertProfile(previous.profiles, profile),
      conversations: previous.conversations.map((item) =>
        item.id === conversationId
          ? {
              ...item,
              memberIds: item.memberIds.includes(profile.id)
                ? item.memberIds
                : [...item.memberIds, profile.id],
              memberCount: item.memberIds.includes(profile.id)
                ? item.memberCount
                : item.memberCount + 1,
            }
          : item,
      ),
      members: upsertConversationMember(previous.members, groupMember),
      workspaceMembers: workspaceMember
        ? upsertWorkspaceMember(previous.workspaceMembers, workspaceMember)
        : previous.workspaceMembers,
    }))
    setAuthNotice(`已将 ${profile.displayName} 加入群聊。`)
    void loadSupabaseState(currentUser.id)
    return true
  }

  async function removeGroupMember(conversationId: string, memberUserId: string) {
    const currentUser = user ?? (!supabase ? demoUser : null)
    const conversation = state.conversations.find((item) => item.id === conversationId)
    const targetMember = findConversationMember(state.members, conversationId, memberUserId)
    if (!currentUser || !conversation || conversation.type !== 'group' || !targetMember) return false

    const currentMember = findConversationMember(state.members, conversationId, currentUser.id)
    if (!isGroupManagerRole(currentMember?.role)) {
      setAuthNotice('只有群 owner 或 admin 可以移除群成员。')
      return false
    }

    if (targetMember.role !== 'member') {
      setAuthNotice('只能移除普通群成员。')
      return false
    }

    if (!supabase) {
      setState((previous) => ({
        ...previous,
        conversations: previous.conversations.map((item) =>
          item.id === conversationId
            ? {
                ...item,
                memberIds: item.memberIds.filter((id) => id !== memberUserId),
                memberCount: Math.max(0, item.memberCount - 1),
              }
            : item,
        ),
        members: previous.members.filter(
          (member) =>
            !(member.conversationId === conversationId && member.userId === memberUserId),
        ),
      }))
      setAuthNotice('群成员已移除。')
      recordAdminActivity('group_member_removed', memberUserId, 'success', { conversationId })
      return true
    }

    const { error } = await supabase.rpc('remove_group_member', {
      conversation_id: conversationId,
      member_user_id: memberUserId,
    })

    if (error) {
      const notice = friendlyErrorMessage(error.message, '无法移除群成员，请稍后重试。')
      setAuthNotice(notice)
      recordAppError('workspace_members', notice, { conversationId, targetUserId: memberUserId })
      return false
    }

    setState((previous) => ({
      ...previous,
      conversations: previous.conversations.map((item) =>
        item.id === conversationId
          ? {
              ...item,
              memberIds: item.memberIds.filter((id) => id !== memberUserId),
              memberCount: Math.max(0, item.memberCount - 1),
            }
          : item,
      ),
      members: previous.members.filter(
        (member) => !(member.conversationId === conversationId && member.userId === memberUserId),
      ),
    }))
    setAuthNotice('群成员已移除，刷新后对方将不能继续访问该群聊。')
    void loadSupabaseState(currentUser.id)
    return true
  }

  async function updateGroupMemberRole(
    conversationId: string,
    memberUserId: string,
    role: Extract<MemberRole, 'admin' | 'member'>,
  ) {
    const currentUser = user ?? (!supabase ? demoUser : null)
    const conversation = state.conversations.find((item) => item.id === conversationId)
    const currentMember = currentUser
      ? findConversationMember(state.members, conversationId, currentUser.id)
      : undefined
    const targetMember = findConversationMember(state.members, conversationId, memberUserId)
    if (!currentUser || !conversation || conversation.type !== 'group' || !targetMember) return false

    if (currentMember?.role !== 'owner') {
      setAuthNotice('只有群 owner 可以调整群管理员。')
      return false
    }

    if (targetMember.role === 'owner') {
      setAuthNotice('不能调整群 owner 的角色。')
      return false
    }

    if (!supabase) {
      setState((previous) => ({
        ...previous,
        members: previous.members.map((member) =>
          member.conversationId === conversationId && member.userId === memberUserId
            ? { ...member, role }
            : member,
        ),
      }))
      setAuthNotice('群成员角色已更新。')
      recordAdminActivity('group_member_role_updated', memberUserId, 'success', {
        conversationId,
        role,
      })
      return true
    }

    const { error } = await supabase.rpc('update_group_member_role', {
      conversation_id: conversationId,
      member_user_id: memberUserId,
      role,
    })

    if (error) {
      const notice = friendlyErrorMessage(error.message, '无法更新群成员角色，请稍后重试。')
      setAuthNotice(notice)
      recordAppError('workspace_members', notice, { conversationId, targetUserId: memberUserId, role })
      return false
    }

    setState((previous) => ({
      ...previous,
      members: previous.members.map((member) =>
        member.conversationId === conversationId && member.userId === memberUserId
          ? { ...member, role }
          : member,
      ),
    }))
    setAuthNotice('群成员角色已更新。')
    void loadSupabaseState(currentUser.id)
    return true
  }

  async function renameGroup(conversationId: string, title: string) {
    const currentUser = user ?? (!supabase ? demoUser : null)
    const trimmed = title.trim().slice(0, 80)
    const conversation = state.conversations.find((item) => item.id === conversationId)
    if (!currentUser || !conversation || conversation.type !== 'group' || !trimmed) return false

    const currentMember = findConversationMember(state.members, conversationId, currentUser.id)
    if (!isGroupManagerRole(currentMember?.role)) {
      setAuthNotice('只有群 owner 或 admin 可以修改群名称。')
      return false
    }

    if (!supabase) {
      setState((previous) => ({
        ...previous,
        conversations: previous.conversations.map((item) =>
          item.id === conversationId ? { ...item, title: trimmed } : item,
        ),
      }))
      setAuthNotice('群名称已更新。')
      recordAdminActivity('group_renamed', currentUser.id, 'success', { conversationId })
      return true
    }

    const { error } = await supabase.rpc('rename_group', {
      conversation_id: conversationId,
      title: trimmed,
    })

    if (error) {
      const notice = friendlyErrorMessage(error.message, '无法修改群名称，请稍后重试。')
      setAuthNotice(notice)
      recordAppError('workspace_members', notice, { conversationId })
      return false
    }

    setState((previous) => ({
      ...previous,
      conversations: previous.conversations.map((item) =>
        item.id === conversationId ? { ...item, title: trimmed } : item,
      ),
    }))
    setAuthNotice('群名称已更新。')
    void loadSupabaseState(currentUser.id)
    return true
  }

  async function deleteGroupMessage(conversationId: string, messageId: string) {
    const currentUser = user ?? (!supabase ? demoUser : null)
    const conversation = state.conversations.find((item) => item.id === conversationId)
    const message = state.messages.find((item) => item.id === messageId)
    if (!currentUser || !conversation || !message) return false

    if (!canDeleteGroupMessage(conversation, state.members, message, currentUser.id)) {
      setAuthNotice('你没有权限删除这条群消息，或撤回时间已超过 2 分钟。')
      return false
    }

    const reason = message.senderId === currentUser.id ? 'recalled' : 'moderated'

    if (!supabase) {
      setState((previous) => markMessageDeleted(previous, conversationId, messageId, currentUser.id, reason))
      setAuthNotice('消息已删除。')
      recordAdminActivity('message_deleted', message.senderId, 'success', {
        conversationId,
        messageId,
        reason,
      })
      return true
    }

    const { error } = await supabase.rpc('delete_group_message', {
      target_conversation_id: conversationId,
      target_message_id: messageId,
    })

    if (error) {
      const notice = friendlyErrorMessage(error.message, '无法删除这条消息，请稍后重试。')
      setAuthNotice(notice)
      recordAppError('messages', notice, { conversationId, messageId })
      return false
    }

    setState((previous) => markMessageDeleted(previous, conversationId, messageId, currentUser.id, reason))
    setAuthNotice('消息已删除。')
    void loadSupabaseState(currentUser.id)
    return true
  }

  async function updateGroupAnnouncement(conversationId: string, announcement: string) {
    const currentUser = user ?? (!supabase ? demoUser : null)
    const conversation = state.conversations.find((item) => item.id === conversationId)
    const normalized = announcement.trim().slice(0, 500)
    if (!currentUser || !conversation || conversation.type !== 'group') return false

    const currentMember = findConversationMember(state.members, conversationId, currentUser.id)
    if (!isGroupManagerRole(currentMember?.role)) {
      setAuthNotice('只有群 owner 或 admin 可以修改群公告。')
      return false
    }

    if (!supabase) {
      setState((previous) => ({
        ...previous,
        conversations: previous.conversations.map((item) =>
          item.id === conversationId ? { ...item, announcement: normalized } : item,
        ),
      }))
      setAuthNotice(normalized ? '群公告已更新。' : '群公告已清空。')
      recordAdminActivity('group_announcement_updated', currentUser.id, 'success', { conversationId })
      return true
    }

    const { error } = await supabase.rpc('update_group_announcement', {
      target_conversation_id: conversationId,
      next_announcement: normalized,
    })

    if (error) {
      const notice = friendlyErrorMessage(error.message, '无法更新群公告，请稍后重试。')
      setAuthNotice(notice)
      recordAppError('workspace_members', notice, { conversationId })
      return false
    }

    setState((previous) => ({
      ...previous,
      conversations: previous.conversations.map((item) =>
        item.id === conversationId ? { ...item, announcement: normalized } : item,
      ),
    }))
    setAuthNotice(normalized ? '群公告已更新。' : '群公告已清空。')
    void loadSupabaseState(currentUser.id)
    return true
  }

  async function pinGroupMessage(conversationId: string, messageId: string) {
    const currentUser = user ?? (!supabase ? demoUser : null)
    const conversation = state.conversations.find((item) => item.id === conversationId)
    const message = state.messages.find((item) => item.id === messageId)
    if (!currentUser || !conversation || conversation.type !== 'group' || !message || message.deletedAt) {
      return false
    }

    const currentMember = findConversationMember(state.members, conversationId, currentUser.id)
    if (!isGroupManagerRole(currentMember?.role)) {
      setAuthNotice('只有群 owner 或 admin 可以置顶消息。')
      return false
    }

    if (!supabase) {
      setState((previous) => ({
        ...previous,
        conversations: previous.conversations.map((item) =>
          item.id === conversationId ? { ...item, pinnedMessageId: messageId } : item,
        ),
      }))
      setAuthNotice('消息已置顶。')
      recordAdminActivity('message_pinned', currentUser.id, 'success', { conversationId, messageId })
      return true
    }

    const { error } = await supabase.rpc('pin_group_message', {
      target_conversation_id: conversationId,
      target_message_id: messageId,
    })

    if (error) {
      const notice = friendlyErrorMessage(error.message, '无法置顶消息，请稍后重试。')
      setAuthNotice(notice)
      recordAppError('messages', notice, { conversationId, messageId })
      return false
    }

    setState((previous) => ({
      ...previous,
      conversations: previous.conversations.map((item) =>
        item.id === conversationId ? { ...item, pinnedMessageId: messageId } : item,
      ),
    }))
    setAuthNotice('消息已置顶。')
    void loadSupabaseState(currentUser.id)
    return true
  }

  async function unpinGroupMessage(conversationId: string) {
    const currentUser = user ?? (!supabase ? demoUser : null)
    const conversation = state.conversations.find((item) => item.id === conversationId)
    if (!currentUser || !conversation || conversation.type !== 'group') return false

    const currentMember = findConversationMember(state.members, conversationId, currentUser.id)
    if (!isGroupManagerRole(currentMember?.role)) {
      setAuthNotice('只有群 owner 或 admin 可以取消置顶。')
      return false
    }

    if (!supabase) {
      setState((previous) => ({
        ...previous,
        conversations: previous.conversations.map((item) =>
          item.id === conversationId ? { ...item, pinnedMessageId: undefined } : item,
        ),
      }))
      setAuthNotice('已取消置顶。')
      recordAdminActivity('message_unpinned', currentUser.id, 'success', { conversationId })
      return true
    }

    const { error } = await supabase.rpc('unpin_group_message', {
      target_conversation_id: conversationId,
    })

    if (error) {
      const notice = friendlyErrorMessage(error.message, '无法取消置顶，请稍后重试。')
      setAuthNotice(notice)
      recordAppError('messages', notice, { conversationId })
      return false
    }

    setState((previous) => ({
      ...previous,
      conversations: previous.conversations.map((item) =>
        item.id === conversationId ? { ...item, pinnedMessageId: undefined } : item,
      ),
    }))
    setAuthNotice('已取消置顶。')
    void loadSupabaseState(currentUser.id)
    return true
  }

  async function hideGroupAttachment(conversationId: string, attachmentId: string) {
    const currentUser = user ?? (!supabase ? demoUser : null)
    const conversation = state.conversations.find((item) => item.id === conversationId)
    const message = state.messages.find(
      (item) => item.conversationId === conversationId && item.attachment?.id === attachmentId,
    )
    if (!currentUser || !conversation || conversation.type !== 'group' || !message?.attachment) {
      return false
    }

    const currentMember = findConversationMember(state.members, conversationId, currentUser.id)
    if (!isGroupManagerRole(currentMember?.role)) {
      setAuthNotice('只有群 owner 或 admin 可以隐藏群文件。')
      return false
    }

    if (!supabase) {
      setState((previous) => markAttachmentHidden(previous, conversationId, attachmentId, currentUser.id))
      setAuthNotice('群文件已隐藏。')
      recordAdminActivity('attachment_hidden', message.senderId, 'success', {
        conversationId,
        messageId: message.id,
        attachmentId,
      })
      return true
    }

    const { error } = await supabase.rpc('hide_group_attachment', {
      target_conversation_id: conversationId,
      target_attachment_id: attachmentId,
    })

    if (error) {
      const notice = friendlyErrorMessage(error.message, '无法隐藏这个文件，请稍后重试。')
      setAuthNotice(notice)
      recordAppError('attachments', notice, { conversationId, attachmentId })
      return false
    }

    setState((previous) => markAttachmentHidden(previous, conversationId, attachmentId, currentUser.id))
    setAuthNotice('群文件已隐藏。')
    void loadSupabaseState(currentUser.id)
    return true
  }

  async function toggleGroupMute(conversationId: string, muted: boolean) {
    const currentUser = user ?? (!supabase ? demoUser : null)
    const conversation = state.conversations.find((item) => item.id === conversationId)
    if (!currentUser || !conversation || conversation.type !== 'group') return false

    const currentMember = findConversationMember(state.members, conversationId, currentUser.id)
    if (!isGroupManagerRole(currentMember?.role)) {
      setScopedNotice('group', '只有群 owner 或 admin 可以设置全体禁言。')
      return false
    }

    if (!supabase) {
      setState((previous) => ({
        ...previous,
        conversations: previous.conversations.map((item) =>
          item.id === conversationId ? { ...item, isMuted: muted } : item,
        ),
      }))
      setScopedNotice('group', muted ? '已开启全体禁言。' : '已解除全体禁言。')
      recordAdminActivity(muted ? 'group_muted' : 'group_unmuted', currentUser.id, 'success', {
        conversationId,
      })
      return true
    }

    const { error } = await supabase.rpc('set_group_mute', {
      target_conversation_id: conversationId,
      muted,
    })

    if (error) {
      const notice = friendlyErrorMessage(error.message, '无法更新群禁言状态，请稍后重试。')
      setScopedNotice('group', notice)
      recordAppError('workspace_members', notice, { conversationId })
      return false
    }

    setState((previous) => ({
      ...previous,
      conversations: previous.conversations.map((item) =>
        item.id === conversationId ? { ...item, isMuted: muted } : item,
      ),
    }))
    setScopedNotice('group', muted ? '已开启全体禁言。' : '已解除全体禁言。')
    void loadSupabaseState(currentUser.id)
    return true
  }

  async function toggleMemberMute(
    conversationId: string,
    memberUserId: string,
    muted: boolean,
  ) {
    const currentUser = user ?? (!supabase ? demoUser : null)
    const conversation = state.conversations.find((item) => item.id === conversationId)
    const targetMember = findConversationMember(state.members, conversationId, memberUserId)
    if (!currentUser || !conversation || conversation.type !== 'group' || !targetMember) return false

    const currentMember = findConversationMember(state.members, conversationId, currentUser.id)
    if (!isGroupManagerRole(currentMember?.role)) {
      setScopedNotice('group', '只有群 owner 或 admin 可以禁言群成员。')
      return false
    }

    if (targetMember.role !== 'member') {
      setScopedNotice('group', '只能禁言普通群成员。')
      return false
    }

    if (!supabase) {
      setState((previous) => ({
        ...previous,
        members: previous.members.map((member) =>
          member.conversationId === conversationId && member.userId === memberUserId
            ? { ...member, isMuted: muted }
            : member,
        ),
      }))
      setScopedNotice('group', muted ? '成员已禁言。' : '成员已解除禁言。')
      recordAdminActivity(muted ? 'member_muted' : 'member_unmuted', memberUserId, 'success', {
        conversationId,
      })
      return true
    }

    const { error } = await supabase.rpc('set_member_mute', {
      target_conversation_id: conversationId,
      target_member_user_id: memberUserId,
      muted,
    })

    if (error) {
      const notice = friendlyErrorMessage(error.message, '无法更新成员禁言状态，请稍后重试。')
      setScopedNotice('group', notice)
      recordAppError('workspace_members', notice, { conversationId, targetUserId: memberUserId })
      return false
    }

    setState((previous) => ({
      ...previous,
      members: previous.members.map((member) =>
        member.conversationId === conversationId && member.userId === memberUserId
          ? { ...member, isMuted: muted }
          : member,
      ),
    }))
    setScopedNotice('group', muted ? '成员已禁言。' : '成员已解除禁言。')
    void loadSupabaseState(currentUser.id)
    return true
  }

  function getProfile(profileId: string) {
    return state.profiles.find((profile) => profile.id === profileId)
  }

  return {
    activeConversation,
    activeConversationId,
    activeMessages,
    activeWorkspace,
    activeWorkspaceRole,
    addGroupMember,
    addGroupMemberByEmail,
    addWorkspaceMemberByEmail,
    adminActivityLogs: state.adminActivityLogs,
    appErrorEvents: state.appErrorEvents,
    authNotice,
    createGroup,
    currentDeviceId,
    deleteGroupMessage,
    deviceSessions: state.deviceSessions,
    getProfile,
    hideGroupAttachment,
    incomingContactRequests,
    isLoading,
    isSupabaseConfigured,
    me,
    noticeFor,
    outgoingContactRequests,
    profileUploadProgress,
    query,
    searchResults,
    sendFile,
    sendContactRequestByEmail,
    sendText,
    setActiveConversationId,
    setQuery,
    createAccountWithEmail,
    signInWithPassword,
    signOut,
    state,
    refreshDeviceSessions,
    respondToContactRequest,
    retryFileMessage,
    revokeDeviceSession,
    revokeOtherDevices,
    removeFailedMessage,
    removeWorkspaceMember,
    removeGroupMember,
    renameGroup,
    pinGroupMessage,
    unpinGroupMessage,
    updateGroupAnnouncement,
    updateProfile,
    updateProfileAvatar,
    updateProfileVideoAvatar,
    updateGroupMemberRole,
    toggleGroupMute,
    toggleMemberMute,
    updateWorkspaceMemberRole,
    removeProfileVideoAvatar,
    user,
    visibleConversations,
    workspaceMembers,
  }
}
