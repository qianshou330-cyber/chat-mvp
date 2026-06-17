import { useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCheck,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Search,
  SendHorizontal,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import './App.css'
import { useChatApp } from './hooks/useChatApp'
import type { Conversation, Message, Profile } from './types'

type Screen = 'login' | 'list' | 'chat' | 'group' | 'profile'

function App() {
  const chat = useChatApp()
  const [screen, setScreen] = useState<Screen>('login')

  const activeTitle = chat.activeConversation?.title ?? 'Chat'

  if (chat.isLoading) {
    return (
      <main className="app-shell" aria-label="Loading chat app">
        <section className="splash-screen">
          <div className="brand-mark">
            <MessageCircle size={46} />
          </div>
          <h1>Chat MVP</h1>
          <p>Preparing secure conversations</p>
        </section>
      </main>
    )
  }

  if (!chat.user || screen === 'login') {
    return (
      <main className="app-shell">
        <LoginScreen
          authNotice={chat.authNotice}
          isSupabaseConfigured={chat.isSupabaseConfigured}
          onSignIn={async (email) => {
            await chat.signInWithEmail(email)
            if (!chat.isSupabaseConfigured) setScreen('list')
          }}
        />
      </main>
    )
  }

  return (
    <main className="app-shell">
      <section className="mobile-app" aria-label="Chat MVP">
        {screen === 'list' && (
          <ConversationList
            conversations={chat.visibleConversations}
            getProfile={chat.getProfile}
            me={chat.me}
            query={chat.query}
            onCreateGroup={async () => {
              await chat.createGroup()
              setScreen('chat')
            }}
            onOpenConversation={(id) => {
              chat.setActiveConversationId(id)
              setScreen('chat')
            }}
            onOpenProfile={() => setScreen('profile')}
            onQueryChange={chat.setQuery}
            onSignOut={chat.signOut}
          />
        )}
        {screen === 'chat' && chat.activeConversation && chat.user && (
          <ChatView
            conversation={chat.activeConversation}
            getProfile={chat.getProfile}
            messages={chat.activeMessages}
            myUserId={chat.user.id}
            onBack={() => setScreen('list')}
            onOpenInfo={() => setScreen(chat.activeConversation?.type === 'group' ? 'group' : 'profile')}
            onSendFile={chat.sendFile}
            onSendText={chat.sendText}
            title={activeTitle}
          />
        )}
        {screen === 'group' && chat.activeConversation && (
          <GroupInfo
            conversation={chat.activeConversation}
            getProfile={chat.getProfile}
            onBack={() => setScreen('chat')}
          />
        )}
        {screen === 'profile' && chat.me && (
          <ProfileSettings
            authNotice={chat.authNotice}
            email={chat.user.email}
            profile={chat.me}
            onBack={() => setScreen('list')}
            onSave={chat.updateProfile}
            onSignOut={chat.signOut}
          />
        )}
      </section>
    </main>
  )
}

function LoginScreen({
  authNotice,
  isSupabaseConfigured,
  onSignIn,
}: {
  authNotice: string
  isSupabaseConfigured: boolean
  onSignIn: (email: string) => Promise<void>
}) {
  const [email, setEmail] = useState('founder@example.com')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)
    await onSignIn(email)
    setIsSubmitting(false)
  }

  return (
    <section className="login-screen">
      <div className="status-bar">
        <span>9:41</span>
        <span>5G</span>
      </div>
      <div className="login-hero">
        <div className="brand-mark large">
          <MessageCircle size={54} />
        </div>
        <h1>Chat MVP</h1>
        <p>Fast private conversations for small teams and communities.</p>
      </div>
      <form className="login-form" onSubmit={submit}>
        <label htmlFor="email">Email</label>
        <div className="input-row">
          <Mail size={20} />
          <input
            id="email"
            autoComplete="email"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            type="email"
            value={email}
          />
        </div>
        <button className="primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Sending' : isSupabaseConfigured ? 'Send magic link' : 'Use demo account'}
        </button>
        <p className="notice">
          {authNotice ||
            (isSupabaseConfigured
              ? 'Supabase is configured for passwordless email sign in.'
              : 'Demo mode is active until Supabase environment variables are added.')}
        </p>
      </form>
    </section>
  )
}

function ConversationList({
  conversations,
  getProfile,
  me,
  onCreateGroup,
  onOpenConversation,
  onOpenProfile,
  onQueryChange,
  onSignOut,
  query,
}: {
  conversations: Conversation[]
  getProfile: (profileId: string) => Profile | undefined
  me: Profile | null | undefined
  onCreateGroup: () => void
  onOpenConversation: (id: string) => void
  onOpenProfile: () => void
  onQueryChange: (query: string) => void
  onSignOut: () => void
  query: string
}) {
  return (
    <section className="screen">
      <header className="topbar">
        <button aria-label="Menu" className="icon-button" type="button">
          <Menu size={22} />
        </button>
        <div>
          <p className="eyebrow">Messages</p>
          <h1>Chats</h1>
        </div>
        <button aria-label="Open profile" className="avatar-button" onClick={onOpenProfile} type="button">
          <Avatar profile={me} />
        </button>
      </header>

      <div className="search-box">
        <Search size={18} />
        <input
          aria-label="Search chats"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search"
          value={query}
        />
      </div>

      <div className="quick-actions">
        <button className="quick-action" onClick={onCreateGroup} type="button">
          <Users size={18} />
          <span>New group</span>
        </button>
        <button className="quick-action" type="button">
          <UserPlus size={18} />
          <span>Add contact</span>
        </button>
        <button className="quick-action subtle" onClick={onSignOut} type="button">
          <LogOut size={18} />
          <span>Sign out</span>
        </button>
      </div>

      <div className="conversation-list">
        {conversations.length === 0 ? (
          <EmptyState
            icon={<MessageCircle size={28} />}
            title="No conversations"
            body="Create a group or add a contact to start chatting."
          />
        ) : (
          conversations.map((conversation) => (
            <button
              className="conversation-row"
              key={conversation.id}
              onClick={() => onOpenConversation(conversation.id)}
              type="button"
            >
              <Avatar
                profile={
                  conversation.type === 'direct'
                    ? getProfile(conversation.memberIds.find((id) => id !== me?.id) ?? '')
                    : undefined
                }
                title={conversation.title}
                variant={conversation.type}
              />
              <span className="conversation-copy">
                <span className="row-title">
                  <span>{conversation.title}</span>
                  <time>{formatTime(conversation.updatedAt)}</time>
                </span>
                <span className="row-preview">{conversation.lastMessage || 'No messages yet'}</span>
              </span>
              {conversation.unreadCount > 0 && (
                <span className="unread-badge">{conversation.unreadCount}</span>
              )}
            </button>
          ))
        )}
      </div>
    </section>
  )
}

function ChatView({
  conversation,
  getProfile,
  messages,
  myUserId,
  onBack,
  onOpenInfo,
  onSendFile,
  onSendText,
  title,
}: {
  conversation: Conversation
  getProfile: (profileId: string) => Profile | undefined
  messages: Message[]
  myUserId: string
  onBack: () => void
  onOpenInfo: () => void
  onSendFile: (file: File) => void
  onSendText: (body: string) => void
  title: string
}) {
  const [draft, setDraft] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const otherMemberId = conversation.memberIds.find((id) => id !== myUserId)
  const otherProfile = getProfile(otherMemberId ?? '')

  function submit(event: FormEvent) {
    event.preventDefault()
    onSendText(draft)
    setDraft('')
  }

  return (
    <section className="screen chat-screen">
      <header className="chat-header">
        <button aria-label="Back to chats" className="icon-button" onClick={onBack} type="button">
          <ArrowLeft size={22} />
        </button>
        <button className="chat-identity" onClick={onOpenInfo} type="button">
          <Avatar profile={conversation.type === 'direct' ? otherProfile : undefined} title={title} variant={conversation.type} />
          <span>
            <strong>{title}</strong>
            <small>
              {conversation.type === 'group'
                ? `${conversation.memberCount} members`
                : otherProfile?.status ?? 'offline'}
            </small>
          </span>
        </button>
        <button aria-label="More" className="icon-button" type="button">
          <MoreVertical size={22} />
        </button>
      </header>

      <div className="message-list" role="log">
        {messages.length === 0 ? (
          <EmptyState
            icon={<MessageCircle size={28} />}
            title="No messages yet"
            body="Send the first message to open the conversation."
          />
        ) : (
          messages.map((message) => (
            <MessageBubble
              isMine={message.senderId === myUserId}
              key={message.id}
              message={message}
              sender={getProfile(message.senderId)}
            />
          ))
        )}
      </div>

      <form className="composer" onSubmit={submit}>
        <input
          ref={fileInputRef}
          className="file-input"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onSendFile(file)
            event.target.value = ''
          }}
          type="file"
        />
        <button
          aria-label="Attach file"
          className="icon-button"
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          <Paperclip size={21} />
        </button>
        <input
          aria-label="Message"
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Message"
          value={draft}
        />
        <button aria-label="Send message" className="send-button" type="submit">
          <SendHorizontal size={20} />
        </button>
      </form>
    </section>
  )
}

function EmptyState({
  body,
  icon,
  title,
}: {
  body: string
  icon: ReactNode
  title: string
}) {
  return (
    <div className="empty-state">
      <span>{icon}</span>
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  )
}

function MessageBubble({
  isMine,
  message,
  sender,
}: {
  isMine: boolean
  message: Message
  sender: Profile | undefined
}) {
  return (
    <article className={`message ${isMine ? 'mine' : 'theirs'}`}>
      {!isMine && <Avatar profile={sender} size="small" />}
      <div className="bubble">
        {!isMine && <span className="sender-name">{sender?.displayName ?? 'Member'}</span>}
        {message.attachment && (
          <a className="attachment" href={message.attachment.url}>
            {message.type === 'image' ? <ImageIcon size={18} /> : <FileText size={18} />}
            <span>{message.attachment.fileName}</span>
          </a>
        )}
        <p>{message.body}</p>
        <span className="message-meta">
          {formatTime(message.createdAt)}
          {isMine && (message.status === 'read' ? <CheckCheck size={15} /> : <Check size={15} />)}
        </span>
      </div>
    </article>
  )
}

function GroupInfo({
  conversation,
  getProfile,
  onBack,
}: {
  conversation: Conversation
  getProfile: (profileId: string) => Profile | undefined
  onBack: () => void
}) {
  const members = useMemo(
    () => conversation.memberIds.map((id) => getProfile(id)).filter(Boolean) as Profile[],
    [conversation.memberIds, getProfile],
  )

  return (
    <section className="screen">
      <header className="topbar">
        <button aria-label="Back to chat" className="icon-button" onClick={onBack} type="button">
          <ArrowLeft size={22} />
        </button>
        <div>
          <p className="eyebrow">Group info</p>
          <h1>{conversation.title}</h1>
        </div>
        <button aria-label="Group settings" className="icon-button" type="button">
          <Settings size={22} />
        </button>
      </header>

      <section className="group-summary">
        <Avatar title={conversation.title} variant="group" size="large" />
        <h2>{conversation.title}</h2>
        <p>{conversation.memberCount} members</p>
      </section>

      <div className="settings-list">
        <button className="settings-row" type="button">
          <UserPlus size={20} />
          <span>Add member</span>
          <ChevronRight size={19} />
        </button>
        <button className="settings-row" type="button">
          <ShieldCheck size={20} />
          <span>Permissions</span>
          <ChevronRight size={19} />
        </button>
      </div>

      <div className="member-list">
        {members.map((member) => (
          <div className="member-row" key={member.id}>
            <Avatar profile={member} />
            <span>
              <strong>{member.displayName}</strong>
              <small>{member.status}</small>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

function ProfileSettings({
  authNotice,
  email,
  onBack,
  onSave,
  onSignOut,
  profile,
}: {
  authNotice: string
  email: string
  onBack: () => void
  onSave: (profile: Pick<Profile, 'displayName' | 'bio'>) => void
  onSignOut: () => void
  profile: Profile
}) {
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [bio, setBio] = useState(profile.bio)

  return (
    <section className="screen">
      <header className="topbar">
        <button aria-label="Back to chats" className="icon-button" onClick={onBack} type="button">
          <ArrowLeft size={22} />
        </button>
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Profile</h1>
        </div>
        <button aria-label="Sign out" className="icon-button" onClick={onSignOut} type="button">
          <LogOut size={22} />
        </button>
      </header>

      <section className="profile-hero">
        <Avatar profile={profile} size="large" />
        <button className="camera-button" type="button">
          <Camera size={18} />
        </button>
      </section>

      <form
        className="profile-form"
        onSubmit={(event) => {
          event.preventDefault()
          onSave({ displayName, bio })
          onBack()
        }}
      >
        <label htmlFor="displayName">Name</label>
        <input
          id="displayName"
          onChange={(event) => setDisplayName(event.target.value)}
          value={displayName}
        />
        <label htmlFor="bio">Bio</label>
        <textarea id="bio" onChange={(event) => setBio(event.target.value)} value={bio} />
        <div className="readonly-field">
          <span>Email</span>
          <strong>{email}</strong>
        </div>
        <button className="primary-button" type="submit">
          Save profile
        </button>
        {authNotice && <p className="notice">{authNotice}</p>}
      </form>
    </section>
  )
}

function Avatar({
  profile,
  size = 'default',
  title,
  variant = 'direct',
}: {
  profile?: Profile | null
  size?: 'small' | 'default' | 'large'
  title?: string
  variant?: 'direct' | 'group'
}) {
  const label = profile?.displayName ?? title ?? 'Group'
  const initials = label
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return (
    <span className={`avatar ${profile?.avatarTone ?? (variant === 'group' ? 'slate' : 'blue')} ${size}`}>
      {variant === 'group' && !profile ? <Users size={size === 'large' ? 34 : 20} /> : initials}
    </span>
  )
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export default App
