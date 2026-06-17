import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ArrowLeft,
  Bell,
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
import { usePushNotifications } from './hooks/usePushNotifications'
import type { ContactRequest, Conversation, Message, Profile, SearchResult } from './types'

type Screen = 'login' | 'list' | 'chat' | 'group' | 'profile'
const APP_DISPLAY_NAME = '聊天 MVP'

function App() {
  const chat = useChatApp()
  const [screen, setScreen] = useState<Screen>('login')

  const activeTitle = displayConversationTitle(chat.activeConversation?.title ?? '聊天')
  const activeScreen = chat.user && screen === 'login' ? 'list' : screen

  useEffect(() => {
    const targetConversationId = new URLSearchParams(window.location.search).get('chat')
    if (!targetConversationId || !chat.user) return

    const hasConversation = chat.state.conversations.some(
      (conversation) => conversation.id === targetConversationId,
    )
    if (!hasConversation) return

    const nextUrl = new URL(window.location.href)
    nextUrl.searchParams.delete('chat')
    window.history.replaceState(null, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)

    const openChatTimer = window.setTimeout(() => {
      chat.setActiveConversationId(targetConversationId)
      setScreen('chat')
    }, 0)

    return () => window.clearTimeout(openChatTimer)
  }, [chat, chat.user])

  async function handleSignOut() {
    await chat.signOut()
    setScreen('login')
  }

  if (chat.isLoading) {
    return (
      <main className="app-shell" aria-label="正在加载聊天应用">
        <section className="splash-screen">
          <div className="brand-mark">
            <MessageCircle size={46} />
          </div>
          <h1>{APP_DISPLAY_NAME}</h1>
          <p>正在准备安全聊天</p>
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
      <section className="mobile-app" aria-label={APP_DISPLAY_NAME}>
        {activeScreen === 'list' && (
          <ConversationList
            conversations={chat.visibleConversations}
            authNotice={chat.authNotice}
            getProfile={chat.getProfile}
            incomingContactRequests={chat.incomingContactRequests}
            me={chat.me}
            outgoingContactRequests={chat.outgoingContactRequests}
            query={chat.query}
            searchResults={chat.searchResults}
            onCreateGroup={async () => {
              await chat.createGroup()
              setScreen('chat')
            }}
            onOpenConversation={(id) => {
              chat.setActiveConversationId(id)
              setScreen('chat')
            }}
            onOpenProfile={() => setScreen('profile')}
            onOpenSearchResult={(result) => {
              chat.setActiveConversationId(result.conversationId)
              setScreen('chat')
            }}
            onQueryChange={chat.setQuery}
            onSignOut={handleSignOut}
            onRespondToContactRequest={async (requestId, action) => {
              const conversationId = await chat.respondToContactRequest(requestId, action)
              if (conversationId) {
                chat.setActiveConversationId(conversationId)
                setScreen('chat')
              }
              return action === 'declined' || Boolean(conversationId)
            }}
            onSendContactRequest={chat.sendContactRequestByEmail}
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
            onAvatarUpload={chat.updateProfileAvatar}
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
        <h1>{APP_DISPLAY_NAME}</h1>
        <p>面向小团队和社群的轻量聊天测试版。</p>
      </div>
      <form className="login-form" onSubmit={submit}>
        <label htmlFor="email">邮箱</label>
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
            <label htmlFor="password">密码</label>
            <div className="input-row">
              <Lock size={20} />
              <input
                id="password"
                autoComplete={intent === 'create' ? 'new-password' : 'current-password'}
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="至少 8 个字符"
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
              {isSubmitting && intent === 'create' ? '创建中' : '创建账号'}
            </button>
            <button
              className="secondary-button"
              disabled={isSubmitting}
              onClick={() => setIntent('sign-in')}
              type="submit"
              value="sign-in"
            >
              {isSubmitting && intent === 'sign-in' ? '登录中' : '登录'}
            </button>
          </div>
        ) : (
          <button className="primary-button" disabled={isSubmitting} onClick={openDemo} type="button">
            {isSubmitting ? '正在打开 Demo' : '使用 Demo 账号'}
          </button>
        )}
        <p className="notice">
          {authNotice ||
            (isSupabaseConfigured
              ? '使用邮箱和密码创建账号，之后可随时登录。'
              : '当前是 Demo 模式，配置 Supabase 环境变量后会切换到真实登录。')}
        </p>
      </form>
    </section>
  )
}

function ConversationList({
  authNotice,
  conversations,
  getProfile,
  incomingContactRequests,
  me,
  outgoingContactRequests,
  onCreateGroup,
  onOpenConversation,
  onOpenProfile,
  onOpenSearchResult,
  onQueryChange,
  onRespondToContactRequest,
  onSendContactRequest,
  onSignOut,
  query,
  searchResults,
}: {
  authNotice: string
  conversations: Conversation[]
  getProfile: (profileId: string) => Profile | undefined
  incomingContactRequests: ContactRequest[]
  me: Profile | null | undefined
  outgoingContactRequests: ContactRequest[]
  onCreateGroup: () => void
  onOpenConversation: (id: string) => void
  onOpenProfile: () => void
  onOpenSearchResult: (result: SearchResult) => void
  onQueryChange: (query: string) => void
  onRespondToContactRequest: (
    requestId: string,
    action: 'accepted' | 'declined',
  ) => Promise<boolean>
  onSendContactRequest: (email: string) => Promise<boolean>
  onSignOut: () => void
  query: string
  searchResults: SearchResult[]
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isContactFormOpen, setIsContactFormOpen] = useState(false)
  const [contactEmail, setContactEmail] = useState('')
  const [isAddingContact, setIsAddingContact] = useState(false)
  const [respondingRequestId, setRespondingRequestId] = useState('')
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isMenuOpen) return

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isMenuOpen])

  async function submitContact(event: FormEvent) {
    event.preventDefault()
    setIsAddingContact(true)
    const didSendRequest = await onSendContactRequest(contactEmail)
    setIsAddingContact(false)
    if (didSendRequest) {
      setContactEmail('')
      setIsContactFormOpen(false)
    }
  }

  const isSearching = query.trim().length > 0

  async function respondToRequest(requestId: string, action: 'accepted' | 'declined') {
    setRespondingRequestId(requestId)
    await onRespondToContactRequest(requestId, action)
    setRespondingRequestId('')
  }

  function handleCreateGroup() {
    setIsMenuOpen(false)
    onCreateGroup()
  }

  function handleOpenContactForm() {
    setIsMenuOpen(false)
    setIsContactFormOpen(true)
  }

  function handleSignOut() {
    setIsMenuOpen(false)
    onSignOut()
  }

  return (
    <section className="screen">
      <header className="topbar">
        <div className="menu-wrapper" ref={menuRef}>
          <button
            aria-expanded={isMenuOpen}
            aria-haspopup="menu"
            aria-label={isMenuOpen ? '关闭操作菜单' : '打开操作菜单'}
            className="icon-button"
            onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
            type="button"
          >
            <Menu size={22} />
          </button>
          {isMenuOpen && (
            <div aria-label="聊天操作" className="action-menu" role="menu">
              <button className="menu-item" onClick={handleCreateGroup} role="menuitem" type="button">
                <Users size={18} />
                <span>新建群聊</span>
              </button>
              <button className="menu-item" onClick={handleOpenContactForm} role="menuitem" type="button">
                <UserPlus size={18} />
                <span>发送好友申请</span>
              </button>
              <button className="menu-item danger" onClick={handleSignOut} role="menuitem" type="button">
                <LogOut size={18} />
                <span>退出登录</span>
              </button>
            </div>
          )}
        </div>
        <div>
          <p className="eyebrow">消息</p>
          <h1>聊天</h1>
        </div>
        <button aria-label="打开个人资料" className="avatar-button" onClick={onOpenProfile} type="button">
          <Avatar profile={me} />
        </button>
      </header>

      <div className="search-box">
        <Search size={18} />
        <input
          aria-label="搜索聊天"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索"
          value={query}
        />
      </div>

      {isContactFormOpen && (
        <form className="contact-panel" onSubmit={submitContact}>
          <label htmlFor="contactEmail">对方邮箱</label>
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
              {isAddingContact ? '发送中' : '发送申请'}
            </button>
            <button
              className="secondary-button"
              disabled={isAddingContact}
              onClick={() => setIsContactFormOpen(false)}
              type="button"
            >
              取消
            </button>
          </div>
          {authNotice && <p className="notice">{authNotice}</p>}
        </form>
      )}

      {!isContactFormOpen && authNotice && <p className="notice list-notice">{authNotice}</p>}

      {(incomingContactRequests.length > 0 || outgoingContactRequests.length > 0) && (
        <section className="request-panel" aria-label="好友申请">
          <div className="request-panel-title">
            <strong>好友申请</strong>
            {incomingContactRequests.length > 0 && (
              <span>{incomingContactRequests.length}</span>
            )}
          </div>

          {incomingContactRequests.map((request) => {
            const requester = getProfile(request.ownerId)
            return (
              <div className="request-row" key={request.id}>
                <Avatar profile={requester} />
                <span>
                  <strong>{requester?.displayName ?? '成员'}</strong>
                  <small>想添加你为好友</small>
                </span>
                <div className="request-actions">
                  <button
                    className="mini-button primary"
                    disabled={respondingRequestId === request.id}
                    onClick={() => void respondToRequest(request.id, 'accepted')}
                    type="button"
                  >
                    同意
                  </button>
                  <button
                    className="mini-button"
                    disabled={respondingRequestId === request.id}
                    onClick={() => void respondToRequest(request.id, 'declined')}
                    type="button"
                  >
                    拒绝
                  </button>
                </div>
              </div>
            )
          })}

          {outgoingContactRequests.map((request) => {
            const target = getProfile(request.contactId)
            return (
              <div className="request-row compact" key={request.id}>
                <Avatar profile={target} />
                <span>
                  <strong>{target?.displayName ?? '成员'}</strong>
                  <small>已发送，等待对方同意</small>
                </span>
              </div>
            )
          })}
        </section>
      )}

      {isSearching ? (
        <SearchResults
          onOpenResult={onOpenSearchResult}
          query={query}
          results={searchResults}
        />
      ) : (
        <div className="conversation-list">
          {conversations.length === 0 ? (
          <EmptyState
            icon={<MessageCircle size={28} />}
            title="暂无会话"
            body="创建群聊或发送好友申请，等对方同意后开始聊天。"
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
                  title={displayConversationTitle(conversation.title)}
                  variant={conversation.type}
                />
                <span className="conversation-copy">
                  <span className="row-title">
                    <span>{displayConversationTitle(conversation.title)}</span>
                    <time>{formatTime(conversation.updatedAt)}</time>
                  </span>
                  <span className="row-preview">{conversation.lastMessage || '暂无消息'}</span>
                </span>
                {conversation.unreadCount > 0 && (
                  <span className="unread-badge">{conversation.unreadCount}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </section>
  )
}

function SearchResults({
  onOpenResult,
  query,
  results,
}: {
  onOpenResult: (result: SearchResult) => void
  query: string
  results: SearchResult[]
}) {
  return (
    <section className="search-results" aria-label="搜索结果">
      <div className="request-panel-title">
        <strong>搜索结果</strong>
        <span>{results.length}</span>
      </div>
      {results.length === 0 ? (
        <EmptyState
          icon={<Search size={28} />}
          title="没有搜索结果"
          body="换个联系人、群名或消息关键词试试。"
        />
      ) : (
        results.map((result) => (
          <button
            aria-label={`打开搜索结果：${result.title}`}
            className="search-result-row"
            key={result.id}
            onClick={() => onOpenResult(result)}
            type="button"
          >
            <span className="result-kind">
              {result.kind === 'conversation' ? <MessageCircle size={17} /> : <Search size={17} />}
            </span>
            <span className="result-copy">
              <strong>{displayConversationTitle(result.title)}</strong>
              <small>
                {result.kind === 'message'
                  ? `${result.senderName} · ${formatTime(result.createdAt)}`
                  : `${result.senderName} · ${formatTime(result.createdAt)}`}
              </small>
              <span className="result-snippet">
                <HighlightedText query={query} text={result.snippet} />
              </span>
            </span>
          </button>
        ))
      )}
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
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false)
  const [messageSearchQuery, setMessageSearchQuery] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const otherMemberId = conversation.memberIds.find((id) => id !== myUserId)
  const otherProfile = getProfile(otherMemberId ?? '')
  const messageSearchResults = useMemo(
    () =>
      buildConversationMessageResults(
        messageSearchQuery,
        conversation,
        messages,
        getProfile,
      ),
    [conversation, getProfile, messageSearchQuery, messages],
  )

  function submit(event: FormEvent) {
    event.preventDefault()
    onSendText(draft)
    setDraft('')
  }

  return (
    <section className="screen chat-screen">
      <header className="chat-header">
        <button aria-label="返回聊天列表" className="icon-button" onClick={onBack} type="button">
          <ArrowLeft size={22} />
        </button>
        <button className="chat-identity" onClick={onOpenInfo} type="button">
          <Avatar profile={conversation.type === 'direct' ? otherProfile : undefined} title={title} variant={conversation.type} />
          <span>
            <strong>{title}</strong>
            <small>
              {conversation.type === 'group'
                ? `${conversation.memberCount} 名成员`
                : formatStatus(otherProfile?.status ?? 'offline')}
            </small>
          </span>
        </button>
        <button
          aria-label={isMessageSearchOpen ? '关闭会话搜索' : '搜索当前会话'}
          className="icon-button"
          onClick={() => setIsMessageSearchOpen((isOpen) => !isOpen)}
          type="button"
        >
          <Search size={22} />
        </button>
      </header>

      {isMessageSearchOpen && (
        <section className="in-chat-search" aria-label="当前会话搜索">
          <div className="search-box compact">
            <Search size={18} />
            <input
              aria-label="搜索当前会话消息"
              onChange={(event) => setMessageSearchQuery(event.target.value)}
              placeholder="搜索当前会话"
              value={messageSearchQuery}
            />
          </div>
          {messageSearchQuery.trim() && (
            <div className="inline-results">
              <strong>{messageSearchResults.length} 条结果</strong>
              {messageSearchResults.length === 0 ? (
                <p>没有找到匹配的消息。</p>
              ) : (
                messageSearchResults.map((result) => (
                  <button
                    aria-label={`当前会话搜索结果：${result.snippet}`}
                    className="inline-result-row"
                    key={result.id}
                    onClick={() => setIsMessageSearchOpen(false)}
                    type="button"
                  >
                    <span>
                      <HighlightedText query={messageSearchQuery} text={result.snippet} />
                    </span>
                    <small>{`${result.senderName} · ${formatTime(result.createdAt)}`}</small>
                  </button>
                ))
              )}
            </div>
          )}
        </section>
      )}

      <div className="message-list" role="log">
        {messages.length === 0 ? (
          <EmptyState
            icon={<MessageCircle size={28} />}
            title="暂无消息"
            body="发送第一条消息，开始这段对话。"
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
          aria-label="文件附件"
          className="file-input"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onSendFile(file)
            event.target.value = ''
          }}
          type="file"
        />
        <button
          aria-label="添加附件"
          className="icon-button"
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          <Paperclip size={21} />
        </button>
        <input
          aria-label="消息"
          onChange={(event) => setDraft(event.target.value)}
          placeholder="输入消息"
          value={draft}
        />
        <button aria-label="发送消息" className="send-button" type="submit">
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

function HighlightedText({ query, text }: { query: string; text: string }) {
  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN')
  if (!normalizedQuery) return text

  const normalizedText = text.toLocaleLowerCase('zh-CN')
  const start = normalizedText.indexOf(normalizedQuery)

  if (start === -1) return text

  const end = start + query.trim().length

  return (
    <>
      {text.slice(0, start)}
      <mark>{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  )
}

function buildConversationMessageResults(
  query: string,
  conversation: Conversation,
  messages: Message[],
  getProfile: (profileId: string) => Profile | undefined,
): SearchResult[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN')

  if (!normalizedQuery) return []

  return messages
    .filter((message) => message.body.toLocaleLowerCase('zh-CN').includes(normalizedQuery))
    .map((message) => ({
      id: `current-message-${message.id}`,
      conversationId: conversation.id,
      conversationTitle: conversation.title,
      kind: 'message' as const,
      title: conversation.title,
      snippet: message.body,
      senderName: getProfile(message.senderId)?.displayName ?? '成员',
      createdAt: message.createdAt,
    }))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
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
        {!isMine && <span className="sender-name">{sender?.displayName ?? '成员'}</span>}
        {message.attachment && (
          <a className="attachment" href={message.attachment.url} rel="noreferrer" target="_blank">
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
  const title = displayConversationTitle(conversation.title)

  return (
    <section className="screen">
      <header className="topbar">
        <button aria-label="返回聊天" className="icon-button" onClick={onBack} type="button">
          <ArrowLeft size={22} />
        </button>
        <div>
          <p className="eyebrow">群聊信息</p>
          <h1>{title}</h1>
        </div>
        <button aria-label="群聊设置" className="icon-button" type="button">
          <Settings size={22} />
        </button>
      </header>

      <section className="group-summary">
        <Avatar title={title} variant="group" size="large" />
        <h2>{title}</h2>
        <p>{conversation.memberCount} 名成员</p>
      </section>

      <div className="settings-list">
        <button className="settings-row" type="button">
          <UserPlus size={20} />
          <span>添加成员</span>
          <ChevronRight size={19} />
        </button>
        <button className="settings-row" type="button">
          <ShieldCheck size={20} />
          <span>权限设置</span>
          <ChevronRight size={19} />
        </button>
      </div>

      <div className="member-list">
        {members.map((member) => (
          <div className="member-row" key={member.id}>
            <Avatar profile={member} />
            <span>
              <strong>{member.displayName}</strong>
              <small>{formatStatus(member.status)}</small>
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
  onAvatarUpload,
  onBack,
  onSave,
  onSignOut,
  profile,
}: {
  authNotice: string
  email: string
  onAvatarUpload: (file: File) => Promise<void>
  onBack: () => void
  onSave: (profile: Pick<Profile, 'displayName' | 'bio'>) => void
  onSignOut: () => void
  profile: Profile
}) {
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [bio, setBio] = useState(profile.bio)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const pushNotifications = usePushNotifications(profile.id)

  return (
    <section className="screen">
      <header className="topbar">
        <button aria-label="返回聊天列表" className="icon-button" onClick={onBack} type="button">
          <ArrowLeft size={22} />
        </button>
        <div>
          <p className="eyebrow">设置</p>
          <h1>个人资料</h1>
        </div>
        <button aria-label="退出登录" className="icon-button" onClick={onSignOut} type="button">
          <LogOut size={22} />
        </button>
      </header>

      <section className="profile-hero">
        <Avatar profile={profile} size="large" />
        <input
          ref={avatarInputRef}
          accept="image/png,image/jpeg,image/webp"
          aria-label="头像文件"
          className="file-input"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void onAvatarUpload(file)
            event.target.value = ''
          }}
          type="file"
        />
        <button
          aria-label="更换头像"
          className="camera-button"
          onClick={() => avatarInputRef.current?.click()}
          type="button"
        >
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
        <label htmlFor="displayName">昵称</label>
        <input
          id="displayName"
          onChange={(event) => setDisplayName(event.target.value)}
          value={displayName}
        />
        <label htmlFor="bio">简介</label>
        <textarea id="bio" onChange={(event) => setBio(event.target.value)} value={bio} />
        <div className="readonly-field">
          <span>邮箱</span>
          <strong>{email}</strong>
        </div>
        <section className="notification-card" aria-label="消息通知">
          <span className="notification-icon">
            <Bell size={20} />
          </span>
          <div>
            <strong>消息通知</strong>
            <p>{pushNotifications.statusMessage}</p>
          </div>
          <button
            className={pushNotifications.isSubscribed ? 'secondary-button' : 'primary-button'}
            disabled={
              pushNotifications.isBusy ||
              pushNotifications.status === 'unsupported' ||
              pushNotifications.status === 'demo' ||
              pushNotifications.status === 'missing-config' ||
              pushNotifications.status === 'denied'
            }
            onClick={() => {
              if (pushNotifications.isSubscribed) {
                void pushNotifications.disableNotifications()
              } else {
                void pushNotifications.enableNotifications()
              }
            }}
            type="button"
          >
            {pushNotifications.isBusy
              ? '处理中'
              : pushNotifications.isSubscribed
                ? '关闭通知'
                : '开启通知'}
          </button>
        </section>
        <button className="primary-button" type="submit">
          保存资料
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
  const label = profile?.displayName ?? title ?? '群聊'
  const initials = label
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return (
    <span className={`avatar ${profile?.avatarTone ?? (variant === 'group' ? 'slate' : 'blue')} ${size}`}>
      {profile?.avatarUrl ? (
        <img alt="" src={profile.avatarUrl} />
      ) : variant === 'group' && !profile ? (
        <Users size={size === 'large' ? 34 : 20} />
      ) : (
        initials
      )}
    </span>
  )
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

function formatStatus(status: Profile['status']) {
  if (status === 'online') return '在线'
  if (status === 'away') return '暂离'
  return '离线'
}

function displayConversationTitle(title: string) {
  return title === 'New Group' ? '新群聊' : title
}

export default App
