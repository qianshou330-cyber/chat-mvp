import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { chatStorageBucket, isSupabaseConfigured, supabase } from '../lib/supabase'
import { createDemoState, demoProfileEmails, demoUser } from '../data/demoData'
import { validateAttachment } from '../lib/attachments'
import type { AppUser, ChatState, Conversation, Message, Profile } from '../types'

const initialState = createDemoState()

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

const SIGNED_ATTACHMENT_URL_EXPIRES_SECONDS = 60 * 60

const safeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '-')

function friendlyErrorMessage(message: string | undefined, fallback: string) {
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
    return '没有找到使用这个邮箱注册的用户。'
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

export function useChatApp() {
  const [state, setState] = useState<ChatState>(initialState)
  const [user, setUser] = useState<AppUser | null>(null)
  const [activeConversationId, setActiveConversationId] = useState('conv-mira')
  const [query, setQuery] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [isLoading, setIsLoading] = useState(Boolean(supabase))
  const currentChannel = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(
    null,
  )

  const activeConversation = state.conversations.find(
    (conversation) => conversation.id === activeConversationId,
  )

  const visibleConversations = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return state.conversations
      .filter((conversation) => conversation.title.toLowerCase().includes(normalized))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  }, [query, state.conversations])

  const activeMessages = useMemo(
    () =>
      state.messages
        .filter((message) => message.conversationId === activeConversationId)
        .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    [activeConversationId, state.messages],
  )

  const me = user ? state.profiles.find((profile) => profile.id === user.id) : null

  const loadSupabaseState = useCallback(async (userId: string) => {
    if (!supabase) return
    setIsLoading(true)

    const [profileResult, memberResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', userId),
    ])

    if (profileResult.error) {
      setAuthNotice(
        friendlyErrorMessage(profileResult.error.message, '无法加载你的资料，请刷新后重试。'),
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

    const conversationIds =
      memberResult.data?.map((member) => member.conversation_id as string) ?? []

    if (conversationIds.length === 0) {
      setState((previous) => ({
        ...previous,
        profiles: currentProfile ? [mapProfile(currentProfile)] : previous.profiles,
        conversations: [],
        messages: [],
      }))
      setIsLoading(false)
      return
    }

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

    const memberRows = membersResult.data ?? []
    const memberProfileIds = [...new Set(memberRows.map((member) => member.user_id as string))]
    const profilesResult =
      memberProfileIds.length > 0
        ? await supabase.from('profiles').select('*').in('id', memberProfileIds)
        : { data: [], error: null }
    const profiles = (profilesResult.data ?? []).map(mapProfile)
    const profilesById = new Map(profiles.map((profile) => [profile.id, profile]))
    const messages = await Promise.all((messagesResult.data ?? []).map(mapMessage))

    setState({
      profiles,
      conversations: (conversationsResult.data ?? []).map((row) => {
        const conversationMemberIds = memberRows
          .filter((member) => member.conversation_id === row.id)
          .map((member) => member.user_id as string)
        return mapConversation(row, conversationMemberIds, profilesById, userId, messages)
      }),
      messages,
      members: memberRows.map((member) => ({
        userId: member.user_id as string,
        role: member.role as 'owner' | 'admin' | 'member',
        joinedAt: member.joined_at as string,
      })),
    })
    setActiveConversationId(conversationIds[0] ?? '')
    setIsLoading(false)
  }, [])

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
    if (!supabase || !user || !activeConversationId) return
    const client = supabase

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
      .subscribe()

    return () => {
      if (currentChannel.current) {
        void client.removeChannel(currentChannel.current)
        currentChannel.current = null
      }
    }
  }, [activeConversationId, user])

  async function createAccountWithEmail(email: string, password: string) {
    const trimmed = email.trim().toLowerCase()
    const cleanPassword = password.trim()
    if (!trimmed || !cleanPassword) return

    if (!supabase) {
      setUser({ ...demoUser, email: trimmed })
      setAuthNotice('')
      return
    }

    const { error } = await supabase.auth.signUp({
      email: trimmed,
      password: cleanPassword,
    })

    if (error) {
      setAuthNotice(friendlyErrorMessage(error.message, '无法创建账号，请重试。'))
      return
    }

    const signIn = await supabase.auth.signInWithPassword({
      email: trimmed,
      password: cleanPassword,
    })

    setAuthNotice(
      signIn.error
        ? friendlyErrorMessage(signIn.error.message, '账号已创建，但登录失败。')
        : '账号已创建并登录。',
    )
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

    const { error } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password: cleanPassword,
    })

    setAuthNotice(error ? friendlyErrorMessage(error.message, '无法登录，请重试。') : '已登录。')
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut()
    setUser(null)
    setState(createDemoState())
  }

  async function sendText(body: string) {
    const trimmed = body.trim()
    const currentUser = user ?? (!supabase ? demoUser : null)
    if (!trimmed || !currentUser || !activeConversation) return

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
      setAuthNotice(friendlyErrorMessage(error.message, '消息发送失败，请重试。'))
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

    const validation = validateAttachment(file)
    if (!validation.ok) {
      setAuthNotice(validation.reason)
      return
    }

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
      body: file.type.startsWith('image/') ? 'Image' : file.name,
      type: file.type.startsWith('image/') ? 'image' : 'file',
      status: supabase ? 'sending' : 'read',
      createdAt: new Date().toISOString(),
      attachment,
    }

    setState((previous) => withNewMessage(previous, message))

    if (!supabase) return

    const storagePath = `${user.id}/${activeConversation.id}/${Date.now()}-${safeFileName(
      file.name,
    )}`
    const upload = await supabase.storage.from(chatStorageBucket).upload(storagePath, file)

    if (upload.error) {
      setAuthNotice(
        friendlyErrorMessage(upload.error.message, '文件上传失败，请重试。'),
      )
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
      setAuthNotice(
        friendlyErrorMessage(
          attachmentInsert.error.message,
          '无法保存文件信息，请重试。',
        ),
      )
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
      setAuthNotice(
        friendlyErrorMessage(messageInsert.error.message, '文件消息发送失败，请重试。'),
      )
    }
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

  async function createGroup() {
    if (!user) return

    const groupId = uid()
    const conversation: Conversation = {
      id: groupId,
      type: 'group',
      title: 'New Group',
      memberIds: [user.id],
      memberCount: 1,
      unreadCount: 0,
      updatedAt: new Date().toISOString(),
      lastMessage: 'Group created',
    }

    setState((previous) => ({
      ...previous,
      conversations: [conversation, ...previous.conversations],
    }))
    setActiveConversationId(groupId)

    if (!supabase) return

    const { error } = await supabase.from('conversations').insert({
      id: groupId,
      type: 'group',
      title: conversation.title,
      created_by: user.id,
    })

    if (!error) {
      await supabase.from('conversation_members').insert({
        conversation_id: groupId,
        user_id: user.id,
        role: 'owner',
      })
    } else {
      setAuthNotice(friendlyErrorMessage(error.message, '无法创建群聊，请重试。'))
    }
  }

  async function addContactByEmail(email: string) {
    const trimmed = email.trim().toLowerCase()
    const currentUser = user ?? (!supabase ? demoUser : null)
    if (!trimmed || !currentUser) return null

    if (trimmed === currentUser.email.toLowerCase()) {
      setAuthNotice('不能添加自己。')
      return null
    }

    if (!supabase) {
      const targetProfileId = demoProfileEmails[trimmed]
      const targetProfile = state.profiles.find((profile) => profile.id === targetProfileId)

      if (!targetProfile) {
        setAuthNotice('没有找到使用这个邮箱注册的用户。')
        return null
      }

      const existingConversation = state.conversations.find(
        (conversation) =>
          conversation.type === 'direct' &&
          conversation.memberIds.includes(currentUser.id) &&
          conversation.memberIds.includes(targetProfile.id),
      )

      if (existingConversation) {
        setActiveConversationId(existingConversation.id)
        setAuthNotice('已打开现有聊天。')
        return existingConversation.id
      }

      const conversationId = uid()
      const conversation: Conversation = {
        id: conversationId,
        type: 'direct',
        title: targetProfile.displayName,
        memberIds: [currentUser.id, targetProfile.id],
        memberCount: 2,
        unreadCount: 0,
        updatedAt: new Date().toISOString(),
        lastMessage: '',
      }

      setState((previous) => ({
        ...previous,
        conversations: [conversation, ...previous.conversations],
      }))
      setActiveConversationId(conversationId)
      setAuthNotice(`已创建和 ${targetProfile.displayName} 的聊天。`)
      return conversationId
    }

    const { data, error } = await supabase
      .rpc('create_direct_conversation_by_email', { search_email: trimmed })
      .single()

    if (error) {
      setAuthNotice(
        friendlyErrorMessage(error.message, '无法添加联系人，请检查邮箱后重试。'),
      )
      return null
    }

    const row = data as Record<string, unknown>
    const conversationId = String(row.conversation_id)
    const targetProfile = mapProfile({
      id: row.target_profile_id,
      display_name: row.target_display_name,
      avatar_tone: row.target_avatar_tone,
      bio: row.target_bio,
      status: row.target_status,
      last_seen: row.target_last_seen,
    })

    const conversation: Conversation = {
      id: conversationId,
      type: 'direct',
      title: targetProfile.displayName,
      memberIds: [currentUser.id, targetProfile.id],
      memberCount: 2,
      unreadCount: 0,
      updatedAt: new Date().toISOString(),
      lastMessage: '',
    }

    setState((previous) => ({
      ...previous,
      profiles: upsertProfile(previous.profiles, targetProfile),
      conversations: upsertConversation(previous.conversations, conversation),
    }))
    setActiveConversationId(conversationId)
    setAuthNotice(
      row.was_existing ? '已打开现有聊天。' : `已创建和 ${targetProfile.displayName} 的聊天。`,
    )
    return conversationId
  }

  function getProfile(profileId: string) {
    return state.profiles.find((profile) => profile.id === profileId)
  }

  return {
    activeConversation,
    activeConversationId,
    activeMessages,
    addContactByEmail,
    authNotice,
    createGroup,
    getProfile,
    isLoading,
    isSupabaseConfigured,
    me,
    query,
    sendFile,
    sendText,
    setActiveConversationId,
    setQuery,
    createAccountWithEmail,
    signInWithPassword,
    signOut,
    state,
    updateProfile,
    user,
    visibleConversations,
  }
}

function upsertMessage(messages: Message[], incoming: Message) {
  const exists = messages.some((message) => message.id === incoming.id)
  return exists
    ? messages.map((message) => (message.id === incoming.id ? incoming : message))
    : [...messages, incoming]
}

function upsertProfile(profiles: Profile[], incoming: Profile) {
  const exists = profiles.some((profile) => profile.id === incoming.id)
  return exists
    ? profiles.map((profile) => (profile.id === incoming.id ? incoming : profile))
    : [...profiles, incoming]
}

function upsertConversation(conversations: Conversation[], incoming: Conversation) {
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

function withNewMessage(state: ChatState, message: Message): ChatState {
  return {
    ...state,
    messages: upsertMessage(state.messages, message),
    conversations: state.conversations.map((conversation) =>
      conversation.id === message.conversationId
        ? {
            ...conversation,
            lastMessage: message.body,
            updatedAt: message.createdAt,
            unreadCount: 0,
          }
        : conversation,
    ),
  }
}

function mapProfile(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    displayName: String(row.display_name ?? 'Member'),
    avatarTone: (row.avatar_tone as Profile['avatarTone']) ?? 'blue',
    bio: String(row.bio ?? ''),
    status: (row.status as Profile['status']) ?? 'offline',
    lastSeen: String(row.last_seen ?? new Date().toISOString()),
  }
}

function mapConversation(
  row: Record<string, unknown>,
  memberIds: string[],
  profilesById: Map<string, Profile>,
  currentUserId: string,
  messages: Message[],
): Conversation {
  const latestMessage = messages
    .filter((message) => message.conversationId === row.id)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]
  const type = (row.type as Conversation['type']) ?? 'direct'
  const fallbackTitle =
    type === 'direct'
      ? profilesById.get(memberIds.find((id) => id !== currentUserId) ?? '')?.displayName
      : undefined

  return {
    id: String(row.id),
    type,
    title: String(row.title ?? fallbackTitle ?? 'Conversation'),
    memberIds,
    memberCount: memberIds.length,
    unreadCount: 0,
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
    lastMessage: latestMessage?.body ?? '',
  }
}

async function mapMessage(row: Record<string, unknown>): Promise<Message> {
  const attachment = row.attachments as Record<string, unknown> | null

  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    senderId: String(row.sender_id),
    body: String(row.body ?? ''),
    type: (row.message_type as Message['type']) ?? 'text',
    status: (row.status as Message['status']) ?? 'sent',
    createdAt: String(row.created_at),
    attachment: attachment
      ? {
          id: String(attachment.id),
          fileName: String(attachment.file_name),
          mimeType: String(attachment.mime_type),
          sizeBytes: Number(attachment.size_bytes ?? 0),
          url: await createSignedAttachmentUrl(attachment),
        }
      : undefined,
  }
}

async function createSignedAttachmentUrl(attachment: Record<string, unknown>) {
  const bucketPath = String(attachment.bucket_path ?? '')

  if (!supabase || !bucketPath) return '#'

  const { data, error } = await supabase.storage
    .from(chatStorageBucket)
    .createSignedUrl(bucketPath, SIGNED_ATTACHMENT_URL_EXPIRES_SECONDS)

  return error ? '#' : (data.signedUrl ?? '#')
}
