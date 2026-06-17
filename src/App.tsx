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
  Lock,
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
  const activeScreen = chat.user && screen === 'login' ? 'list' : screen

  async function handleSignOut() {
    await chat.signOut()
    setScreen('login')
  }

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

  if (!chat.user && activeScreen === 'login') {
    return (
      <main className="app-shell">
        <LoginScreen
          authNotice={chat.authNotice}
          isSupabaseConfigured={chat.isSupabaseConfigured}
          onCreateAccount={async (email, password) => {
            await chat.createAccountWithEmail(email, password)
          }}
          onSignIn={async (email, password) => {
            await chat.signInWithPassword(email, password)
            if (!chat.isSupabaseConfigured) setScreen('list')
          }}
        />
      </main>
    )
  }

  return (
    <main className="app-shell">
      <section className="mobile-app" aria-label="Chat MVP">
        {activeScreen === 'list' && (
          <ConversationList
            conversations={chat.visibleConversations}
            authNotice={chat.authNotice}
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
            onSignOut={handleSignOut}
            onAddContact={async (email) => {
              const conversationId = await chat.addContactByEmail(email)
              if (conversationId) {
                chat.setActiveConversationId(conversationId)
                setScreen('chat')
              }
              return Boolean(conversationId)
            }}
          />
        )}
        {activeScreen === 'chat' && chat.activeConversation && (
          <ChatView
            conversation={chat.activeConversation}
            getProfile={chat.getProfile}
            messages={chat.activeMessages}
            myUserId={chat.user?.id ?? ''}
            onBack={() => setScreen('list')}
            onOpenInfo={() => setScreen(chat.activeConversation?.type === 'group' ? 'group' : 'profile')}
            onSendFile={chat.sendFile}
            onSendText={chat.sendText}
            title={activeTitle}
          />
        )}
        {activeScreen === 'group' && chat.activeConversation && (
          <GroupInfo
            conversation={chat.activeConversation}
            getProfile={chat.getProfile}
            onBack={() => setScreen('chat')}
          />
        )}
        {activeScreen === 'profile' && chat.me && (
          <ProfileSettings
            authNotice={chat.authNotice}
            email={chat.user?.email ?? ''}
            profile={chat.me}
            onBack={() => setScreen('list')}
            onSave={chat.updateProfile}
            onSignOut={handleSignOut}
          />
        )}
      </section>
    </main>
  )
}

function LoginScreen({
  authNotice,
  isSupabaseConfigured,
  onCreateAccount,
  onSignIn,
}: {
  authNotice: string
  isSupabaseConfigured: boolean
  onCreateAccount: (email: string, password: string) => Promise<void>
  onSignIn: (email: string, password: string) => Promise<void>
}) {
  const [email, setEmail] = useState('founder@example.com')
  const [password, setPassword] = useState('')
  const [intent, setIntent] = useState<'create' | 'sign-in'>('create')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const nextIntent = submitter?.value === 'sign-in' ? 'sign-in' : 'create'
    setIsSubmitting(true)
    setIntent(nextIntent)
    if (!isSupabaseConfigured || nextIntent === 'sign-in') {
      await onSignIn(email, password)
    } else {
      await onCreateAccount(email, password)
    }
    setIsSubmitting(false)
  }

  async function openDemo() {
    setIsSubmitting(true)
    await onSignIn(email, password)
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
        {isSupabaseConfigured && (
          <>
            <label htmlFor="password">Password</label>
            <div className="input-row">
              <Lock size={20} />
              <input
                id="password"
                autoComplete={intent === 'create' ? 'new-password' : 'current-password'}
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                required
                type="password"
                value={password}
              />
            </div>
          </>
        )}
        {isSupabaseConfigured ? (
          <div className="auth-actions">
            <button
              className="primary-button"
              disabled={isSubmitting}
              onClick={() => setIntent('create')}
              type="submit"
              value="create"
            >
              {isSubmitting && intent === 'create' ? 'Creating' : 'Create account'}
            </button>
            <button
              className="secondary-button"
              disabled={isSubmitting}
              onClick={() => setIntent('sign-in')}
              type="submit"
              value="sign-in"
            >
              {isSubmitting && intent === 'sign-in' ? 'Signing in' : 'Sign in'}
            </button>
          </div>
        ) : (
          <button className="primary-button" disabled={isSubmitting} onClick={openDemo} type="button">
            {isSubmitting ? 'Opening demo' : 'Use demo account'}
          </button>
        )}
        <p className="notice">
          {authNotice ||
            (isSupabaseConfigured
              ? 'Create an account with email and password, then sign in anytime.'
              : 'Demo mode is active until Supabase environment variables are added.')}
        </p>
      </form>
    </section>
  )
}

function ConversationList({
  authNotice,
  conversations,
  getProfile,
  me,
  onAddContact,
  onCreateGroup,
  onOpenConversation,
  onOpenProfile,
  onQueryChange,
  onSignOut,
  query,
}: {
  authNotice: string
  conversations: Conversation[]
  getProfile: (profileId: string) => Profile | undefined
  me: Profile | null | undefined
  onAddContact: (email: string) => Promise<boolean>
  onCreateGroup: () => void
  onOpenConversation: (id: string) => void
  onOpenProfile: () => void
  onQueryChange: (query: string) => void
  onSignOut: () => void
  query: string
}) {
  const [isContactFormOpen, setIsContactFormOpen] = useState(false)
  const [contactEmail, setContactEmail] = useState('')
  const [isAddingContact, setIsAddingContact] = useState(false)

  async function submitContact(event: FormEvent) {
    event.preventDefault()
    setIsAddingContact(true)
    const didOpenChat = await onAddContact(contactEmail)
    setIsAddingContact(false)
    if (didOpenChat) {
      setContactEmail('')
      setIsContactFormOpen(false)
    }
  }

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
        <button
          className="quick-action"
          onClick={() => setIsContactFormOpen((isOpen) => !isOpen)}
          type="button"
        >
          <UserPlus size={18} />
          <span>Add contact</span>
        </button>
        <button className="quick-action subtle" onClick={onSignOut} type="button">
          <LogOut size={18} />
          <span>Sign out</span>
        </button>
      </div>

      {isContactFormOpen && (
        <form className="contact-panel" onSubmit={submitContact}>
          <label htmlFor="contactEmail">Contact email</label>
          <div className="input-row">
            <Mail size={20} />
            <input
              id="contactEmail"
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setContactEmail(event.target.value)}
              placeholder="teammate@example.com"
              required
              type="email"
              value={contactEmail}
            />
          </div>
          <div className="auth-actions">
            <button className="primary-button" disabled={isAddingContact} type="submit">
              {isAddingContact ? 'Starting' : 'Start chat'}
            </button>
            <button
              className="secondary-button"
              disabled={isAddingContact}
              onClick={() => setIsContactFormOpen(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
          {authNotice && <p className="notice">{authNotice}</p>}
        </form>
      )}

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
