import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { chatStorageBucket, isSupabaseConfigured, supabase } from '../lib/supabase'
import { createDemoState, demoUser } from '../data/demoData'
import { validateAttachment } from '../lib/attachments'
import type { AppUser, ChatState, Conversation, Message, Profile } from '../types'

const initialState = createDemoState()

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

const safeFileName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, '-')

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
      setAuthNotice(profileResult.error.message)
    }

    if (!profileResult.data) {
      const email = (await supabase.auth.getUser()).data.user?.email ?? 'member@example.com'
      await supabase.from('profiles').upsert({
        id: userId,
        display_name: email.split('@')[0],
        bio: '',
        avatar_tone: 'blue',
        status: 'online',
      })
    }

    const conversationIds =
      memberResult.data?.map((member) => member.conversation_id as string) ?? []

    if (conversationIds.length === 0) {
      setState((previous) => ({
        ...previous,
        profiles: profileResult.data ? [mapProfile(profileResult.data)] : previous.profiles,
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
    const messages = (messagesResult.data ?? []).map(mapMessage)

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

    if (currentChannel.current) {
      void supabase.removeChannel(currentChannel.current)
    }

    currentChannel.current = supabase
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
          const row = payload.new as Record<string, string>
          setState((previous) =>
            withNewMessage(previous, {
              id: row.id,
              conversationId: row.conversation_id,
              senderId: row.sender_id,
              body: row.body ?? '',
              type: (row.message_type as Message['type']) ?? 'text',
              status: row.sender_id === user.id ? 'sent' : 'read',
              createdAt: row.created_at,
            }),
          )
        },
      )
      .subscribe()

    return () => {
      if (currentChannel.current && supabase) {
        void supabase.removeChannel(currentChannel.current)
        currentChannel.current = null
      }
    }
  }, [activeConversationId, user])

  async function signInWithEmail(email: string) {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return

    if (!supabase) {
      setUser({ ...demoUser, email: trimmed })
      setAuthNotice('')
      return
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: window.location.origin,
      },
    })

    setAuthNotice(
      error
        ? error.message
        : 'Magic link sent. Open the email on this device to finish sign in.',
    )
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut()
    setUser(null)
    setState(createDemoState())
  }

  async function sendText(body: string) {
    const trimmed = body.trim()
    if (!trimmed || !user || !activeConversation) return

    const optimisticMessage: Message = {
      id: uid(),
      conversationId: activeConversation.id,
      senderId: user.id,
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
      sender_id: user.id,
      body: trimmed,
      message_type: 'text',
      status: 'sent',
    })

    if (error) {
      setAuthNotice(error.message)
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
      setAuthNotice(upload.error.message)
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
      setAuthNotice(attachmentInsert.error.message)
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
      setAuthNotice(messageInsert.error.message)
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
      setAuthNotice(error.message)
    }
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
    isLoading,
    isSupabaseConfigured,
    me,
    query,
    sendFile,
    sendText,
    setActiveConversationId,
    setQuery,
    signInWithEmail,
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

function mapMessage(row: Record<string, unknown>): Message {
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
          url: '#',
        }
      : undefined,
  }
}
