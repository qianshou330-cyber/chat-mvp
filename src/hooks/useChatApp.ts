import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  avatarStorageBucket,
  chatStorageBucket,
  isSupabaseConfigured,
  supabase,
} from '../lib/supabase'
import { createDemoState, demoProfileEmails, demoUser } from '../data/demoData'
import { avatarFileExtension, validateAttachment, validateAvatar } from '../lib/attachments'
import type {
  AppUser,
  ChatState,
  ContactRequest,
  ContactStatus,
  Conversation,
  Message,
  Profile,
} from '../types'

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
  const stateChannel = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(
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

    const profileIds = new Set<string>()
    if (currentProfile) profileIds.add(userId)
    contactRows.forEach((contact) => {
      profileIds.add(contact.owner_id as string)
      profileIds.add(contact.contact_id as string)
    })
    memberRows.forEach((member) => profileIds.add(member.user_id as string))

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
        userId: member.user_id as string,
        role: member.role as 'owner' | 'admin' | 'member',
        joinedAt: member.joined_at as string,
      })),
    })
    setActiveConversationId((previous) =>
      conversationIds.includes(previous) ? previous : (conversationIds[0] ?? ''),
    )
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
      .subscribe()

    return () => {
      if (stateChannel.current) {
        void client.removeChannel(stateChannel.current)
        stateChannel.current = null
      }
    }
  }, [loadSupabaseState, user])

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
      body: file.type.startsWith('image/') ? '图片' : file.name,
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

  async function updateProfileAvatar(file: File) {
    const currentUser = user ?? (!supabase ? demoUser : null)
    if (!currentUser) return

    const validation = validateAvatar(file)
    if (!validation.ok) {
      setAuthNotice(validation.reason)
      return
    }

    const localUrl = URL.createObjectURL(file)

    setState((previous) => ({
      ...previous,
      profiles: previous.profiles.map((profile) =>
        profile.id === currentUser.id ? { ...profile, avatarUrl: localUrl } : profile,
      ),
    }))

    if (!supabase) {
      setAuthNotice('头像已更新。')
      return
    }

    const storagePath = `${currentUser.id}/avatar-${Date.now()}.${avatarFileExtension(file)}`
    const upload = await supabase.storage.from(avatarStorageBucket).upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    })

    if (upload.error) {
      setAuthNotice(friendlyErrorMessage(upload.error.message, '头像上传失败，请重试。'))
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(avatarStorageBucket).getPublicUrl(storagePath)

    const profileUpdate = await supabase
      .from('profiles')
      .update({
        avatar_url: publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', currentUser.id)

    if (profileUpdate.error) {
      setAuthNotice(
        friendlyErrorMessage(profileUpdate.error.message, '头像已上传，但资料更新失败。'),
      )
      return
    }

    setState((previous) => ({
      ...previous,
      profiles: previous.profiles.map((profile) =>
        profile.id === currentUser.id ? { ...profile, avatarUrl: publicUrl } : profile,
      ),
    }))
    setAuthNotice('头像已更新。')
  }

  async function createGroup() {
    if (!user) return

    const groupId = uid()
    const conversation: Conversation = {
      id: groupId,
      type: 'group',
      title: '新群聊',
      memberIds: [user.id],
      memberCount: 1,
      unreadCount: 0,
      updatedAt: new Date().toISOString(),
      lastMessage: '群聊已创建',
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

  async function sendContactRequestByEmail(email: string) {
    const trimmed = email.trim().toLowerCase()
    const currentUser = user ?? (!supabase ? demoUser : null)
    if (!trimmed || !currentUser) return false

    if (trimmed === currentUser.email.toLowerCase()) {
      setAuthNotice('不能添加自己。')
      return false
    }

    if (!supabase) {
      const targetProfileId = demoProfileEmails[trimmed]
      const targetProfile = state.profiles.find((profile) => profile.id === targetProfileId)

      if (!targetProfile) {
        setAuthNotice('没有找到使用这个邮箱注册的用户。')
        return false
      }

      const existingConversation = findDirectConversation(
        state.conversations,
        currentUser.id,
        targetProfile.id,
      )

      if (existingConversation) {
        setActiveConversationId(existingConversation.id)
        setAuthNotice('已打开现有聊天。')
        return true
      }

      const existingContact = state.contacts.find(
        (contact) =>
          ((contact.ownerId === currentUser.id && contact.contactId === targetProfile.id) ||
            (contact.ownerId === targetProfile.id && contact.contactId === currentUser.id)) &&
          contact.status !== 'declined',
      )

      if (existingContact?.status === 'pending') {
        setAuthNotice(
          existingContact.direction === 'incoming'
            ? '对方已经给你发来申请，请在好友申请里处理。'
            : '好友申请已发送，等待对方同意。',
        )
        return true
      }

      if (existingContact?.status === 'accepted') {
        setAuthNotice('你们已经是好友，可以在聊天列表里继续对话。')
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
      setAuthNotice('已发送好友申请，等待对方同意。')
      return true
    }

    const { data, error } = await supabase
      .rpc('send_contact_request_by_email', { search_email: trimmed })
      .single()

    if (error) {
      setAuthNotice(
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
      setAuthNotice('你们已经是好友，可以在聊天列表里继续对话。')
      void loadSupabaseState(currentUser.id)
      return true
    }

    if (contactStatus === 'declined') {
      setAuthNotice('对方已拒绝好友申请。')
      return true
    }

    setAuthNotice('已发送好友申请，等待对方同意。')
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
        members: upsertMembers(previous.members, conversation.memberIds),
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
          }
        : null

    setState((previous) => ({
      ...previous,
      profiles: upsertProfile(previous.profiles, profile),
      contacts: upsertContact(previous.contacts, updatedContact),
      conversations: conversation
        ? upsertConversation(previous.conversations, conversation)
        : previous.conversations,
      members: conversation ? upsertMembers(previous.members, conversation.memberIds) : previous.members,
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

  function getProfile(profileId: string) {
    return state.profiles.find((profile) => profile.id === profileId)
  }

  return {
    activeConversation,
    activeConversationId,
    activeMessages,
    authNotice,
    createGroup,
    getProfile,
    incomingContactRequests,
    isLoading,
    isSupabaseConfigured,
    me,
    outgoingContactRequests,
    query,
    sendFile,
    sendContactRequestByEmail,
    sendText,
    setActiveConversationId,
    setQuery,
    createAccountWithEmail,
    signInWithPassword,
    signOut,
    state,
    respondToContactRequest,
    updateProfile,
    updateProfileAvatar,
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

function upsertContact(contacts: ContactRequest[], incoming: ContactRequest) {
  const exists = contacts.some(
    (contact) =>
      contact.id === incoming.id ||
      (contact.ownerId === incoming.ownerId && contact.contactId === incoming.contactId),
  )
  return exists
    ? contacts.map((contact) =>
        contact.id === incoming.id ||
        (contact.ownerId === incoming.ownerId && contact.contactId === incoming.contactId)
          ? { ...contact, ...incoming }
          : contact,
      )
    : [incoming, ...contacts]
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

function upsertMembers(members: ChatState['members'], memberIds: string[]) {
  const existingIds = new Set(members.map((member) => member.userId))
  const now = new Date().toISOString()
  return [
    ...members,
    ...memberIds
      .filter((userId) => !existingIds.has(userId))
      .map((userId, index) => ({
        userId,
        role: index === 0 ? 'owner' as const : 'member' as const,
        joinedAt: now,
      })),
  ]
}

function findDirectConversation(conversations: Conversation[], firstUserId: string, secondUserId: string) {
  return conversations.find(
    (conversation) =>
      conversation.type === 'direct' &&
      conversation.memberIds.includes(firstUserId) &&
      conversation.memberIds.includes(secondUserId),
  )
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
    displayName: String(row.display_name ?? '成员'),
    avatarUrl: String(row.avatar_url ?? ''),
    avatarTone: (row.avatar_tone as Profile['avatarTone']) ?? 'blue',
    bio: String(row.bio ?? ''),
    status: (row.status as Profile['status']) ?? 'offline',
    lastSeen: String(row.last_seen ?? new Date().toISOString()),
  }
}

function mapContact(row: Record<string, unknown>, currentUserId: string): ContactRequest {
  const ownerId = String(row.owner_id)
  const contactId = String(row.contact_id)

  return {
    id: String(row.id),
    ownerId,
    contactId,
    status: (row.status as ContactStatus) ?? 'pending',
    createdAt: String(row.created_at ?? new Date().toISOString()),
    direction: contactId === currentUserId ? 'incoming' : 'outgoing',
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
    title: String(row.title ?? fallbackTitle ?? '会话'),
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
