import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ArrowLeft,
  Bell,
  Building2,
  Camera,
  Check,
  CheckCheck,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Lock,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  Monitor,
  Paperclip,
  Search,
  SendHorizontal,
  Settings,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react'
import './App.css'
import { useChatApp } from './hooks/useChatApp'
import { usePushNotifications } from './hooks/usePushNotifications'
import type {
  AdminActivityLog,
  AppErrorEvent,
  ContactRequest,
  Conversation,
  ConversationMember,
  DeviceSession,
  MemberRole,
  Message,
  Profile,
  SearchResult,
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
} from './types'

type Screen = 'login' | 'list' | 'chat' | 'group' | 'profile' | 'workspace'
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
            onOpenWorkspaceManagement={() => setScreen('workspace')}
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
            conversationMembers={chat.state.members}
            getProfile={chat.getProfile}
            messages={chat.activeMessages}
            myUserId={chat.user?.id ?? ''}
            onBack={() => setScreen('list')}
            onDeleteMessage={chat.deleteGroupMessage}
            onOpenInfo={() => setScreen(chat.activeConversation?.type === 'group' ? 'group' : 'profile')}
            onPinMessage={chat.pinGroupMessage}
            onSendFile={chat.sendFile}
            onSendText={chat.sendText}
            onUnpinMessage={chat.unpinGroupMessage}
            title={activeTitle}
          />
        )}
        {activeScreen === 'group' && chat.activeConversation && (
          <GroupInfo
            activeWorkspace={chat.activeWorkspace}
            conversation={chat.activeConversation}
            currentUserId={chat.user?.id ?? ''}
            getProfile={chat.getProfile}
            messages={chat.activeMessages}
            members={chat.state.members}
            onBack={() => setScreen('chat')}
            onAddGroupMember={chat.addGroupMember}
            onHideGroupAttachment={chat.hideGroupAttachment}
            onRemoveGroupMember={chat.removeGroupMember}
            onRenameGroup={chat.renameGroup}
            onUpdateAnnouncement={chat.updateGroupAnnouncement}
            onUpdateGroupMemberRole={chat.updateGroupMemberRole}
            workspaceMembers={chat.workspaceMembers}
          />
        )}
        {activeScreen === 'profile' && chat.me && (
          <ProfileSettings
            activeWorkspace={chat.activeWorkspace}
            authNotice={chat.authNotice}
            currentDeviceId={chat.currentDeviceId}
            deviceSessions={chat.deviceSessions}
            email={chat.user?.email ?? ''}
            profile={chat.me}
            onBack={() => setScreen('list')}
            onAvatarUpload={chat.updateProfileAvatar}
            onRefreshDeviceSessions={chat.refreshDeviceSessions}
            onRevokeDeviceSession={chat.revokeDeviceSession}
            onRevokeOtherDevices={chat.revokeOtherDevices}
            onSave={chat.updateProfile}
            onSignOut={handleSignOut}
          />
        )}
        {activeScreen === 'workspace' && (
          <WorkspaceManagement
            adminActivityLogs={chat.adminActivityLogs}
            activeWorkspace={chat.activeWorkspace}
            activeWorkspaceRole={chat.activeWorkspaceRole}
            appErrorEvents={chat.appErrorEvents}
            authNotice={chat.authNotice}
            currentUserId={chat.user?.id ?? ''}
            getProfile={chat.getProfile}
            onAddWorkspaceMember={chat.addWorkspaceMemberByEmail}
            onBack={() => setScreen('list')}
            onRemoveWorkspaceMember={chat.removeWorkspaceMember}
            onUpdateWorkspaceMemberRole={chat.updateWorkspaceMemberRole}
            workspaceMembers={chat.workspaceMembers}
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
  onOpenWorkspaceManagement,
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
  onOpenWorkspaceManagement: () => void
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

  function handleOpenWorkspaceManagement() {
    setIsMenuOpen(false)
    onOpenWorkspaceManagement()
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
              <button className="menu-item" onClick={handleOpenWorkspaceManagement} role="menuitem" type="button">
                <Building2 size={18} />
                <span>工作区管理</span>
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
  conversationMembers,
  getProfile,
  messages,
  myUserId,
  onBack,
  onDeleteMessage,
  onOpenInfo,
  onPinMessage,
  onSendFile,
  onSendText,
  onUnpinMessage,
  title,
}: {
  conversation: Conversation
  conversationMembers: ConversationMember[]
  getProfile: (profileId: string) => Profile | undefined
  messages: Message[]
  myUserId: string
  onBack: () => void
  onDeleteMessage: (conversationId: string, messageId: string) => Promise<boolean>
  onOpenInfo: () => void
  onPinMessage: (conversationId: string, messageId: string) => Promise<boolean>
  onSendFile: (file: File) => void
  onSendText: (body: string) => void
  onUnpinMessage: (conversationId: string) => Promise<boolean>
  title: string
}) {
  const [draft, setDraft] = useState('')
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false)
  const [messageSearchQuery, setMessageSearchQuery] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const otherMemberId = conversation.memberIds.find((id) => id !== myUserId)
  const otherProfile = getProfile(otherMemberId ?? '')
  const currentMember = conversationMembers.find(
    (member) => member.conversationId === conversation.id && member.userId === myUserId,
  )
  const isGroupManager = currentMember?.role === 'owner' || currentMember?.role === 'admin'
  const pinnedMessage = conversation.pinnedMessageId
    ? messages.find((message) => message.id === conversation.pinnedMessageId && !message.deletedAt)
    : undefined
  const messageSearchResults = useMemo(
    () => buildConversationMessageResults(messageSearchQuery, conversation, messages, getProfile),
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

      {conversation.type === 'group' && conversation.announcement && (
        <section className="conversation-notice" aria-label="群公告">
          <strong>群公告</strong>
          <p>{conversation.announcement}</p>
        </section>
      )}

      {conversation.type === 'group' && pinnedMessage && (
        <section className="conversation-notice pinned" aria-label="置顶消息">
          <strong>置顶消息</strong>
          <div className="pinned-message-button">
            {getProfile(pinnedMessage.senderId)?.displayName ?? '成员'}：{pinnedMessage.body}
          </div>
          {isGroupManager && (
            <button
              className="ghost-button compact-button"
              onClick={() => {
                void onUnpinMessage(conversation.id)
              }}
              type="button"
            >
              取消置顶
            </button>
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
              canDelete={canDeleteGroupMessageFromView(
                conversation,
                conversationMembers,
                message,
                myUserId,
              )}
              canPin={conversation.type === 'group' && isGroupManager && !message.deletedAt}
              isMine={message.senderId === myUserId}
              isPinned={conversation.pinnedMessageId === message.id}
              key={message.id}
              message={message}
              onDelete={() => {
                void onDeleteMessage(conversation.id, message.id)
              }}
              onPin={() => {
                void onPinMessage(conversation.id, message.id)
              }}
              onUnpin={() => {
                void onUnpinMessage(conversation.id)
              }}
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
    .filter((message) => !message.deletedAt && message.body.toLocaleLowerCase('zh-CN').includes(normalizedQuery))
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
  canDelete,
  canPin,
  isMine,
  isPinned,
  message,
  onDelete,
  onPin,
  onUnpin,
  sender,
}: {
  canDelete: boolean
  canPin: boolean
  isMine: boolean
  isPinned: boolean
  message: Message
  onDelete: () => void
  onPin: () => void
  onUnpin: () => void
  sender: Profile | undefined
}) {
  return (
    <article className={`message ${isMine ? 'mine' : 'theirs'} ${message.deletedAt ? 'deleted' : ''}`}>
      {!isMine && <Avatar profile={sender} size="small" />}
      <div className="bubble">
        {!isMine && <span className="sender-name">{sender?.displayName ?? '成员'}</span>}
        {isPinned && !message.deletedAt && <span className="pin-label">已置顶</span>}
        {message.deletedAt ? (
          <p className="deleted-message">此消息已删除</p>
        ) : (
          <>
            {message.attachment?.deletedAt ? (
              <p className="deleted-message">此附件已被管理员隐藏</p>
            ) : message.attachment ? (
              <AttachmentPreview message={message} />
            ) : null}
            {!message.attachment?.deletedAt && <p>{message.body}</p>}
          </>
        )}
        <span className="message-meta">
          {formatTime(message.createdAt)}
          {isMine && (message.status === 'read' ? <CheckCheck size={15} /> : <Check size={15} />)}
        </span>
        {!message.deletedAt && (canDelete || canPin) && (
          <div className="message-actions">
            {canPin && (
              <button className="text-action" onClick={isPinned ? onUnpin : onPin} type="button">
                {isPinned ? '取消置顶' : '置顶'}
              </button>
            )}
            {canDelete && (
              <button className="text-action danger" onClick={onDelete} type="button">
                删除
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

function AttachmentPreview({ message }: { message: Message }) {
  const [didImageFail, setDidImageFail] = useState(false)
  const attachment = message.attachment
  if (!attachment) return null

  const shouldShowImage = message.type === 'image' && !didImageFail

  if (shouldShowImage) {
    return (
      <a className="image-attachment" href={attachment.url} rel="noreferrer" target="_blank">
        <img
          alt={attachment.fileName}
          loading="lazy"
          onError={() => setDidImageFail(true)}
          src={attachment.url}
        />
      </a>
    )
  }

  return (
    <a className="attachment" href={attachment.url} rel="noreferrer" target="_blank">
      {message.type === 'image' ? <ImageIcon size={18} /> : <FileText size={18} />}
      <span>{attachment.fileName}</span>
    </a>
  )
}

function canDeleteGroupMessageFromView(
  conversation: Conversation,
  members: ConversationMember[],
  message: Message,
  currentUserId: string,
) {
  if (conversation.type !== 'group' || message.deletedAt) return false

  const currentMember = members.find(
    (member) => member.conversationId === conversation.id && member.userId === currentUserId,
  )
  const senderMember = members.find(
    (member) => member.conversationId === conversation.id && member.userId === message.senderId,
  )
  const isOwnRecent =
    message.senderId === currentUserId &&
    Date.now() - Date.parse(message.createdAt) <= 2 * 60 * 1000

  return isOwnRecent || ((currentMember?.role === 'owner' || currentMember?.role === 'admin') && senderMember?.role === 'member')
}

function GroupInfo({
  activeWorkspace,
  conversation,
  currentUserId,
  getProfile,
  messages,
  members: allConversationMembers,
  onAddGroupMember,
  onBack,
  onHideGroupAttachment,
  onRemoveGroupMember,
  onRenameGroup,
  onUpdateAnnouncement,
  onUpdateGroupMemberRole,
  workspaceMembers,
}: {
  activeWorkspace: Workspace | null
  conversation: Conversation
  currentUserId: string
  getProfile: (profileId: string) => Profile | undefined
  messages: Message[]
  members: ConversationMember[]
  onAddGroupMember: (conversationId: string, memberUserId: string) => Promise<boolean>
  onBack: () => void
  onHideGroupAttachment: (conversationId: string, attachmentId: string) => Promise<boolean>
  onRemoveGroupMember: (conversationId: string, memberUserId: string) => Promise<boolean>
  onRenameGroup: (conversationId: string, title: string) => Promise<boolean>
  onUpdateAnnouncement: (conversationId: string, announcement: string) => Promise<boolean>
  onUpdateGroupMemberRole: (
    conversationId: string,
    memberUserId: string,
    role: Extract<MemberRole, 'admin' | 'member'>,
  ) => Promise<boolean>
  workspaceMembers: WorkspaceMember[]
}) {
  const title = displayConversationTitle(conversation.title)
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [editingConversationId, setEditingConversationId] = useState('')
  const [titleDraftState, setTitleDraftState] = useState({
    conversationId: conversation.id,
    value: conversation.title,
  })
  const [announcementDraftState, setAnnouncementDraftState] = useState({
    conversationId: conversation.id,
    value: conversation.announcement ?? '',
  })
  const conversationMembers = useMemo(() => {
    const storedMembers = allConversationMembers.filter(
      (member) => member.conversationId === conversation.id,
    )
    if (storedMembers.length > 0) return storedMembers

    return conversation.memberIds.map((userId, index) => ({
      conversationId: conversation.id,
      userId,
      role: index === 0 ? 'owner' as const : 'member' as const,
      joinedAt: '',
    }))
  }, [allConversationMembers, conversation.id, conversation.memberIds])
  const currentMember = conversationMembers.find((member) => member.userId === currentUserId)
  const canManageGroup = currentMember?.role === 'owner' || currentMember?.role === 'admin'
  const canManageRoles = currentMember?.role === 'owner'
  const isEditingTitle = editingConversationId === conversation.id
  const titleDraft =
    titleDraftState.conversationId === conversation.id
      ? titleDraftState.value
      : conversation.title
  const announcementDraft =
    announcementDraftState.conversationId === conversation.id
      ? announcementDraftState.value
      : (conversation.announcement ?? '')
  const workspaceCandidates = workspaceMembers
    .filter((member) => !conversation.memberIds.includes(member.userId))
    .map((member) => getProfile(member.userId))
    .filter(Boolean) as Profile[]
  const groupFiles = useMemo(
    () =>
      messages
        .filter((message) => message.conversationId === conversation.id && message.attachment)
        .filter((message) => canManageGroup || (!message.deletedAt && !message.attachment?.deletedAt))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [canManageGroup, conversation.id, messages],
  )

  function updateTitleDraft(value: string) {
    setTitleDraftState({ conversationId: conversation.id, value })
  }

  function updateAnnouncementDraft(value: string) {
    setAnnouncementDraftState({ conversationId: conversation.id, value })
  }

  async function submitGroupMember() {
    if (!selectedMemberId) return
    setIsBusy(true)
    const ok = await onAddGroupMember(conversation.id, selectedMemberId)
    if (ok) setSelectedMemberId('')
    setIsBusy(false)
  }

  async function submitTitleUpdate() {
    const nextTitle = titleDraft.trim()
    if (!nextTitle) return
    setIsBusy(true)
    const ok = await onRenameGroup(conversation.id, nextTitle)
    if (ok) setEditingConversationId('')
    setIsBusy(false)
  }

  async function submitAnnouncementUpdate() {
    setIsBusy(true)
    await onUpdateAnnouncement(conversation.id, announcementDraft)
    setIsBusy(false)
  }

  async function removeMember(memberUserId: string) {
    setIsBusy(true)
    await onRemoveGroupMember(conversation.id, memberUserId)
    setIsBusy(false)
  }

  async function updateMemberRole(
    memberUserId: string,
    role: Extract<MemberRole, 'admin' | 'member'>,
  ) {
    setIsBusy(true)
    await onUpdateGroupMemberRole(conversation.id, memberUserId, role)
    setIsBusy(false)
  }

  async function hideAttachment(attachmentId: string) {
    setIsBusy(true)
    await onHideGroupAttachment(conversation.id, attachmentId)
    setIsBusy(false)
  }

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
        {canManageGroup && (
          <div className="group-title-editor">
            {isEditingTitle ? (
              <>
                <input
                  aria-label="群名称"
                  disabled={isBusy}
                  maxLength={80}
                  onChange={(event) => updateTitleDraft(event.target.value)}
                  value={titleDraft}
                />
                <button
                  className="secondary-button"
                  disabled={isBusy || !titleDraft.trim()}
                  onClick={() => {
                    void submitTitleUpdate()
                  }}
                  type="button"
                >
                  保存群名
                </button>
                <button
                  className="ghost-button"
                  disabled={isBusy}
                  onClick={() => {
                    updateTitleDraft(conversation.title)
                    setEditingConversationId('')
                  }}
                  type="button"
                >
                  取消
                </button>
              </>
            ) : (
              <button
                className="secondary-button compact-button"
                onClick={() => setEditingConversationId(conversation.id)}
                type="button"
              >
                编辑群名
              </button>
            )}
          </div>
        )}
      </section>

      <div className="settings-list">
        <div className="group-announcement-editor">
          <span>
            <strong>群公告</strong>
            <small>显示在聊天页顶部，第一版仅支持纯文本。</small>
          </span>
          {canManageGroup ? (
            <>
              <textarea
                aria-label="群公告"
                disabled={isBusy}
                maxLength={500}
                onChange={(event) => updateAnnouncementDraft(event.target.value)}
                placeholder="输入群公告"
                value={announcementDraft}
              />
              <button
                className="secondary-button compact-button"
                disabled={isBusy}
                onClick={() => {
                  void submitAnnouncementUpdate()
                }}
                type="button"
              >
                保存公告
              </button>
            </>
          ) : (
            <p>{conversation.announcement || '暂无群公告。'}</p>
          )}
        </div>
        <div className="settings-row static-row">
          <Building2 size={20} />
          <span>
            <strong>所属工作区</strong>
            <small>{activeWorkspace?.name ?? '暂无工作区'}</small>
          </span>
        </div>
        <div className="settings-row static-row">
          <ShieldCheck size={20} />
          <span>
            <strong>成员权限</strong>
            <small>owner 可调整群管理员；owner/admin 可添加或移除普通群成员</small>
          </span>
        </div>
        {canManageGroup && (
          <div className="group-member-manager">
            <label htmlFor="groupMemberSelect">从工作区添加成员</label>
            <div className="workspace-member-controls">
              <select
                id="groupMemberSelect"
                disabled={isBusy || workspaceCandidates.length === 0}
                onChange={(event) => setSelectedMemberId(event.target.value)}
                value={selectedMemberId}
              >
                <option value="">
                  {workspaceCandidates.length === 0 ? '暂无可添加成员' : '选择成员'}
                </option>
                {workspaceCandidates.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.displayName}
                  </option>
                ))}
              </select>
              <button
                className="secondary-button"
                disabled={isBusy || !selectedMemberId}
                onClick={() => {
                  void submitGroupMember()
                }}
                type="button"
              >
                加入群聊
              </button>
            </div>
          </div>
        )}
        <div className="group-files-panel">
          <span className="panel-heading">
            <strong>群文件</strong>
            <small>{groupFiles.length === 0 ? '暂无群文件' : `${groupFiles.length} 个文件`}</small>
          </span>
          {groupFiles.length === 0 ? (
            <p className="empty-inline">暂无群文件。</p>
          ) : (
            groupFiles.map((message) => {
              const attachment = message.attachment
              if (!attachment) return null
              const profile = getProfile(message.senderId)
              const isHidden = Boolean(message.deletedAt || attachment.deletedAt)

              return (
                <div className="group-file-row" key={attachment.id}>
                  {attachment.mimeType.startsWith('image/') ? <ImageIcon size={18} /> : <FileText size={18} />}
                  <span>
                    <strong>{attachment.fileName}</strong>
                    <small>
                      {profile?.displayName ?? '成员'} · {formatFileSize(attachment.sizeBytes)} · {formatTime(message.createdAt)}
                    </small>
                    {isHidden && <em>{message.deletedAt ? '消息已删除，文件已隐藏' : '文件已隐藏'}</em>}
                  </span>
                  {!isHidden ? (
                    <a className="text-action" href={attachment.url} rel="noreferrer" target="_blank">
                      打开
                    </a>
                  ) : (
                    <span className="role-badge">已隐藏</span>
                  )}
                  {canManageGroup && !attachment.deletedAt && !message.deletedAt && (
                    <button
                      className="text-action danger"
                      disabled={isBusy}
                      onClick={() => {
                        void hideAttachment(attachment.id)
                      }}
                      type="button"
                    >
                      隐藏
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="member-list">
        {conversationMembers.map((member) => {
          const profile = getProfile(member.userId)
          const canRemove = canManageGroup && member.role === 'member' && member.userId !== currentUserId
          const canEditRole = canManageRoles && member.role !== 'owner'

          return (
            <div className="member-row group-member-row" key={`${member.conversationId}-${member.userId}`}>
              <Avatar profile={profile} />
              <span>
                <strong>{profile?.displayName ?? '成员'}</strong>
                <small>{formatStatus(profile?.status ?? 'offline')}</small>
              </span>
              <div className="group-member-actions">
                {canEditRole ? (
                  <select
                    aria-label={`${profile?.displayName ?? '成员'} 的群角色`}
                    disabled={isBusy}
                    onChange={(event) => {
                      void updateMemberRole(
                        member.userId,
                        event.target.value as Extract<MemberRole, 'admin' | 'member'>,
                      )
                    }}
                    value={member.role}
                  >
                    <option value="member">成员</option>
                    <option value="admin">群管理员</option>
                  </select>
                ) : (
                  <span className="role-badge">{formatGroupRole(member.role)}</span>
                )}
                {canRemove && (
                  <button
                    aria-label={`移出群聊 ${profile?.displayName ?? '成员'}`}
                    className="icon-button danger-icon-button"
                    disabled={isBusy}
                    onClick={() => {
                      void removeMember(member.userId)
                    }}
                    type="button"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ProfileSettings({
  activeWorkspace,
  authNotice,
  currentDeviceId,
  deviceSessions,
  email,
  onAvatarUpload,
  onBack,
  onRefreshDeviceSessions,
  onRevokeDeviceSession,
  onRevokeOtherDevices,
  onSave,
  onSignOut,
  profile,
}: {
  activeWorkspace: Workspace | null
  authNotice: string
  currentDeviceId: string
  deviceSessions: DeviceSession[]
  email: string
  onAvatarUpload: (file: File) => Promise<void>
  onBack: () => void
  onRefreshDeviceSessions: () => Promise<void>
  onRevokeDeviceSession: (deviceId: string) => Promise<boolean>
  onRevokeOtherDevices: () => Promise<boolean>
  onSave: (profile: Pick<Profile, 'displayName' | 'bio'>) => void
  onSignOut: () => void
  profile: Profile
}) {
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [bio, setBio] = useState(profile.bio)
  const [isDeviceBusy, setIsDeviceBusy] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const pushNotifications = usePushNotifications(profile.id, activeWorkspace?.id)

  async function handleRevokeOtherDevices() {
    setIsDeviceBusy(true)
    await onRevokeOtherDevices()
    setIsDeviceBusy(false)
  }

  async function handleRevokeDevice(deviceId: string) {
    setIsDeviceBusy(true)
    await onRevokeDeviceSession(deviceId)
    setIsDeviceBusy(false)
  }

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
        <section className="device-card" aria-label="登录设备">
          <div className="workspace-card-header">
            <span className="notification-icon">
              <Monitor size={20} />
            </span>
            <div>
              <strong>登录设备</strong>
              <p>{deviceSessions.length} 台设备正在使用这个账号</p>
            </div>
            <button
              className="secondary-button compact-button"
              disabled={isDeviceBusy}
              onClick={() => {
                void onRefreshDeviceSessions()
              }}
              type="button"
            >
              刷新
            </button>
          </div>

          <div className="device-session-list">
            {deviceSessions.length === 0 ? (
              <p className="device-note">当前还没有设备记录，刷新后会自动登记。</p>
            ) : (
              deviceSessions.map((device) => {
                const isCurrentDevice =
                  device.deviceId === currentDeviceId || device.deviceId === 'demo-current-device'

                return (
                  <div className="device-session-row" key={device.id}>
                    <Monitor size={18} />
                    <span>
                      <strong>{device.deviceName}</strong>
                      <small>
                        {device.browserName} · {device.platform} ·{' '}
                        {formatDeviceLastSeen(device.lastSeenAt)}
                      </small>
                    </span>
                    <div className="device-row-actions">
                      <span className="role-badge">{formatDeviceStatus(device.lastSeenAt)}</span>
                      {isCurrentDevice ? (
                        <span className="current-device-badge">当前设备</span>
                      ) : (
                        <button
                          className="icon-button danger-icon-button"
                          disabled={isDeviceBusy}
                          aria-label={`移除设备 ${device.deviceName}`}
                          onClick={() => {
                            void handleRevokeDevice(device.deviceId)
                          }}
                          type="button"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <button
            className="secondary-button danger-secondary-button"
            disabled={isDeviceBusy || deviceSessions.length <= 1}
            onClick={() => {
              void handleRevokeOtherDevices()
            }}
            type="button"
          >
            {isDeviceBusy ? '处理中' : '退出其他设备'}
          </button>
          <p className="device-note">移除单台设备后，该设备下次刷新或心跳时会退出。</p>
        </section>
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

function WorkspaceManagement({
  adminActivityLogs,
  activeWorkspace,
  activeWorkspaceRole,
  appErrorEvents,
  authNotice,
  currentUserId,
  getProfile,
  onAddWorkspaceMember,
  onBack,
  onRemoveWorkspaceMember,
  onUpdateWorkspaceMemberRole,
  workspaceMembers,
}: {
  adminActivityLogs: AdminActivityLog[]
  activeWorkspace: Workspace | null
  activeWorkspaceRole: WorkspaceRole
  appErrorEvents: AppErrorEvent[]
  authNotice: string
  currentUserId: string
  getProfile: (profileId: string) => Profile | undefined
  onAddWorkspaceMember: (email: string, role: WorkspaceRole) => Promise<boolean>
  onBack: () => void
  onRemoveWorkspaceMember: (memberUserId: string) => Promise<boolean>
  onUpdateWorkspaceMemberRole: (memberUserId: string, role: WorkspaceRole) => Promise<boolean>
  workspaceMembers: WorkspaceMember[]
}) {
  const [memberEmail, setMemberEmail] = useState('')
  const [memberRole, setMemberRole] = useState<WorkspaceRole>('member')
  const [isMemberBusy, setIsMemberBusy] = useState(false)
  const canManageWorkspace = activeWorkspaceRole === 'owner' || activeWorkspaceRole === 'admin'

  async function submitWorkspaceMember() {
    setIsMemberBusy(true)
    try {
      const added = await onAddWorkspaceMember(memberEmail, memberRole)
      if (added) setMemberEmail('')
    } finally {
      setIsMemberBusy(false)
    }
  }

  async function handleRemoveWorkspaceMember(memberUserId: string) {
    setIsMemberBusy(true)
    try {
      await onRemoveWorkspaceMember(memberUserId)
    } finally {
      setIsMemberBusy(false)
    }
  }

  async function handleUpdateWorkspaceMemberRole(memberUserId: string, role: WorkspaceRole) {
    setIsMemberBusy(true)
    try {
      await onUpdateWorkspaceMemberRole(memberUserId, role)
    } finally {
      setIsMemberBusy(false)
    }
  }

  return (
    <section className="screen">
      <header className="topbar">
        <button aria-label="返回聊天列表" className="icon-button" onClick={onBack} type="button">
          <ArrowLeft size={22} />
        </button>
        <div>
          <p className="eyebrow">工作区</p>
          <h1>工作区管理</h1>
        </div>
        <span className="icon-button passive-icon">
          <Building2 size={22} />
        </span>
      </header>

      <div className="workspace-management">
        <section className="workspace-card" aria-label="工作区管理">
          <div className="workspace-card-header">
            <span className="notification-icon">
              <Building2 size={20} />
            </span>
            <div>
              <strong>{activeWorkspace?.name ?? '我的工作区'}</strong>
              <p>
                {workspaceMembers.length} 名成员 · 我的角色：
                {formatWorkspaceRole(activeWorkspaceRole)}
              </p>
            </div>
          </div>

          {canManageWorkspace && (
            <div className="workspace-member-form">
              <label htmlFor="workspaceMemberEmail">添加成员邮箱</label>
              <input
                id="workspaceMemberEmail"
                inputMode="email"
                onChange={(event) => setMemberEmail(event.target.value)}
                placeholder="member@example.com"
                type="email"
                value={memberEmail}
              />
              <label htmlFor="workspaceMemberRole">角色</label>
              <div className="workspace-member-controls">
                <select
                  id="workspaceMemberRole"
                  disabled={isMemberBusy}
                  onChange={(event) => setMemberRole(event.target.value as WorkspaceRole)}
                  value={memberRole}
                >
                  <option value="member">成员</option>
                  <option value="admin">管理员</option>
                </select>
                <button
                  className="secondary-button"
                  disabled={isMemberBusy || !memberEmail.trim()}
                  onClick={submitWorkspaceMember}
                  type="button"
                >
                  {isMemberBusy ? '添加中' : '添加成员'}
                </button>
              </div>
              <p className="form-hint">对方需要先完成注册，才能被添加到工作区。</p>
            </div>
          )}

          {authNotice && <p className="notice">{authNotice}</p>}

          <div className="workspace-member-list">
            {workspaceMembers.map((member) => {
              const memberProfile = getProfile(member.userId)
              const isSelf = member.userId === currentUserId
              const canEditMember = canManageWorkspace && !isSelf && member.role !== 'owner'

              return (
                <div className="workspace-member-row" key={`${member.workspaceId}-${member.userId}`}>
                  <Avatar profile={memberProfile} />
                  <span>
                    <strong>{memberProfile?.displayName ?? '成员'}</strong>
                    <small>{formatWorkspaceRole(member.role)}</small>
                  </span>
                  {canEditMember ? (
                    <div className="workspace-row-actions">
                      <select
                        aria-label={`${memberProfile?.displayName ?? '成员'} 的角色`}
                        disabled={isMemberBusy}
                        onChange={(event) => {
                          void handleUpdateWorkspaceMemberRole(
                            member.userId,
                            event.target.value as WorkspaceRole,
                          )
                        }}
                        value={member.role}
                      >
                        <option value="member">成员</option>
                        <option value="admin">管理员</option>
                      </select>
                      <button
                        aria-label={`移除 ${memberProfile?.displayName ?? '成员'}`}
                        className="icon-button danger-icon-button"
                        disabled={isMemberBusy}
                        onClick={() => {
                          void handleRemoveWorkspaceMember(member.userId)
                        }}
                        type="button"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ) : (
                    <span className="role-badge">{formatWorkspaceRole(member.role)}</span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="profile-links">
            <a
              className="feedback-link"
              href="https://github.com/qianshou330-cyber/chat-mvp/issues/new/choose"
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink size={16} />
              反馈问题
            </a>
            <a
              className="feedback-link"
              href="https://github.com/qianshou330-cyber/chat-mvp/blob/main/docs/company-trial-safety.md"
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink size={16} />
              试用说明
            </a>
          </div>
        </section>

        {canManageWorkspace && (
          <section className="admin-log-card" aria-label="管理员记录">
            <div className="workspace-card-header">
              <span className="notification-icon">
                <ShieldCheck size={20} />
              </span>
              <div>
                <strong>管理员记录</strong>
                <p>最近的成员操作和关键错误，方便试用期间排查问题。</p>
              </div>
            </div>

            <div className="admin-log-list">
              {adminActivityLogs.length === 0 ? (
                <p className="device-note">
                  暂无管理员操作记录。添加成员、移除成员或调整角色后会显示在这里。
                </p>
              ) : (
                adminActivityLogs.slice(0, 4).map((log) => {
                  const actor = getProfile(log.actorId)
                  const target = getProfile(log.targetUserId)

                  return (
                    <div className="admin-log-row" key={log.id}>
                      <span>
                        <strong>{formatAdminActivity(log.action)}</strong>
                        <small>
                          {actor?.displayName ?? '管理员'} · {target?.displayName ?? '目标成员'} ·{' '}
                          {formatShortDateTime(log.createdAt)}
                        </small>
                      </span>
                      <span className={log.result === 'success' ? 'role-badge' : 'error-badge'}>
                        {log.result === 'success' ? '成功' : '失败'}
                      </span>
                    </div>
                  )
                })
              )}
            </div>

            <div className="admin-log-list">
              {appErrorEvents.length === 0 ? (
                <p className="device-note">
                  暂无关键错误记录。登录、消息、附件、通知或成员管理失败时会显示脱敏记录。
                </p>
              ) : (
                appErrorEvents.slice(0, 3).map((event) => (
                  <div className="admin-log-row" key={event.id}>
                    <span>
                      <strong>{formatErrorModule(event.module)}</strong>
                      <small>
                        {event.message} · {formatShortDateTime(event.createdAt)}
                      </small>
                    </span>
                    <span className="error-badge">错误</span>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </div>
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

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${Math.round(sizeBytes / 1024)} KB`
  return `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`
}

function formatStatus(status: Profile['status']) {
  if (status === 'online') return '在线'
  if (status === 'away') return '暂离'
  return '离线'
}

function formatWorkspaceRole(role: WorkspaceRole) {
  if (role === 'owner') return '所有者'
  if (role === 'admin') return '管理员'
  return '成员'
}

function formatGroupRole(role: MemberRole) {
  if (role === 'owner') return '群 owner'
  if (role === 'admin') return '群管理员'
  return '成员'
}

function formatAdminActivity(action: AdminActivityLog['action']) {
  if (action === 'member_added') return '添加成员'
  if (action === 'member_removed') return '移除成员'
  if (action === 'member_role_updated') return '调整角色'
  if (action === 'group_member_added') return '添加群成员'
  if (action === 'group_member_removed') return '移除群成员'
  if (action === 'group_member_role_updated') return '调整群角色'
  if (action === 'group_renamed') return '修改群名称'
  if (action === 'message_deleted') return '删除群消息'
  if (action === 'group_announcement_updated') return '更新群公告'
  if (action === 'message_pinned') return '置顶消息'
  if (action === 'message_unpinned') return '取消置顶'
  if (action === 'attachment_hidden') return '隐藏群文件'
  return '退出其他设备'
}

function formatErrorModule(module: AppErrorEvent['module']) {
  if (module === 'messages') return '消息错误'
  if (module === 'attachments') return '附件错误'
  if (module === 'notifications') return '通知错误'
  if (module === 'workspace_members') return '成员管理错误'
  if (module === 'devices') return '登录设备错误'
  if (module === 'profile') return '资料错误'
  return '登录错误'
}

function formatShortDateTime(value: string) {
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return '时间未知'
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    day: '2-digit',
  }).format(timestamp)
}

function formatDeviceStatus(lastSeenAt: string) {
  const minutes = minutesSince(lastSeenAt)
  if (minutes <= 2) return '在线'
  if (minutes <= 30) return '最近活跃'
  return '离线'
}

function formatDeviceLastSeen(lastSeenAt: string) {
  const minutes = minutesSince(lastSeenAt)
  if (minutes < 1) return '刚刚活跃'
  if (minutes < 60) return `${minutes} 分钟前`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`

  const days = Math.floor(hours / 24)
  return `${days} 天前`
}

function minutesSince(value: string) {
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) return Number.POSITIVE_INFINITY
  return Math.max(0, Math.floor((Date.now() - timestamp) / 60000))
}

function displayConversationTitle(title: string) {
  return title === 'New Group' ? '新群聊' : title
}

export default App
