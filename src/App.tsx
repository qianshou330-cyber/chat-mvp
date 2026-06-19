import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ArrowLeft,
  Bell,
  Check,
  CheckCheck,
  FileText,
  Image as ImageIcon,
  Lock,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  Monitor,
  MoreHorizontal,
  Paperclip,
  Search,
  SendHorizontal,
  Settings,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  Video,
} from 'lucide-react'
import './App.css'
import { useChatApp } from './hooks/useChatApp'
import { usePushNotifications } from './hooks/usePushNotifications'
import type {
  AdminActivityLog,
  AppErrorEvent,
  Attachment,
  ContactRequest,
  Conversation,
  ConversationMember,
  DeviceSession,
  MemberRole,
  Message,
  Profile,
  SearchResult,
  Workspace,
} from './types'

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
          authNotice={chat.noticeFor('login')}
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
            authNotice={chat.noticeFor('list')}
            getProfile={chat.getProfile}
            incomingContactRequests={chat.incomingContactRequests}
            me={chat.me}
            outgoingContactRequests={chat.outgoingContactRequests}
            query={chat.query}
            searchResults={chat.searchResults}
            onCreateGroup={async () => {
              const created = await chat.createGroup()
              if (created) setScreen('chat')
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
            authNotice={chat.noticeFor('chat')}
            conversation={chat.activeConversation}
            conversationMembers={chat.state.members}
            getProfile={chat.getProfile}
            messages={chat.activeMessages}
            myUserId={chat.user?.id ?? ''}
            onBack={() => setScreen('list')}
            onDeleteMessage={chat.deleteGroupMessage}
            onOpenInfo={() => setScreen(chat.activeConversation?.type === 'group' ? 'group' : 'profile')}
            onPinMessage={chat.pinGroupMessage}
            onRemoveFailedUpload={chat.removeFailedMessage}
            onRetryUpload={chat.retryFileMessage}
            onSendFile={chat.sendFile}
            onSendText={chat.sendText}
            onUnpinMessage={chat.unpinGroupMessage}
            title={activeTitle}
          />
        )}
        {activeScreen === 'group' && chat.activeConversation && (
          <GroupInfo
            adminActivityLogs={chat.adminActivityLogs}
            activeWorkspace={chat.activeWorkspace}
            appErrorEvents={chat.appErrorEvents}
            authNotice={chat.noticeFor('group')}
            conversation={chat.activeConversation}
            currentUserId={chat.user?.id ?? ''}
            getProfile={chat.getProfile}
            messages={chat.activeMessages}
            members={chat.state.members}
            onBack={() => setScreen('chat')}
            onAddGroupMemberByEmail={chat.addGroupMemberByEmail}
            onHideGroupAttachment={chat.hideGroupAttachment}
            onRemoveGroupMember={chat.removeGroupMember}
            onRenameGroup={chat.renameGroup}
            onToggleGroupMute={chat.toggleGroupMute}
            onToggleMemberMute={chat.toggleMemberMute}
            onUpdateAnnouncement={chat.updateGroupAnnouncement}
            onUpdateGroupMemberRole={chat.updateGroupMemberRole}
          />
        )}
        {activeScreen === 'profile' && chat.me && (
          <ProfileSettings
            activeWorkspace={chat.activeWorkspace}
            authNotice={chat.noticeFor('profile')}
            currentDeviceId={chat.currentDeviceId}
            deviceSessions={chat.deviceSessions}
            email={chat.user?.email ?? ''}
            profile={chat.me}
            uploadProgress={chat.profileUploadProgress}
            onBack={() => setScreen('list')}
            onAvatarUpload={chat.updateProfileAvatar}
            onAvatarVideoUpload={chat.updateProfileVideoAvatar}
            onRefreshDeviceSessions={chat.refreshDeviceSessions}
            onRemoveVideoAvatar={chat.removeProfileVideoAvatar}
            onRevokeDeviceSession={chat.revokeDeviceSession}
            onRevokeOtherDevices={chat.revokeOtherDevices}
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
    <section className="screen list-screen">
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
                  </span>
                  <span className="row-preview">{conversation.lastMessage || '暂无消息'}</span>
                </span>
                <span className="conversation-meta">
                  <time>{formatTime(conversation.updatedAt)}</time>
                  {conversation.unreadCount > 0 && (
                    <span className="unread-badge">{conversation.unreadCount}</span>
                  )}
                </span>
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
  authNotice,
  conversation,
  conversationMembers,
  getProfile,
  messages,
  myUserId,
  onBack,
  onDeleteMessage,
  onOpenInfo,
  onPinMessage,
  onRemoveFailedUpload,
  onRetryUpload,
  onSendFile,
  onSendText,
  onUnpinMessage,
  title,
}: {
  authNotice: string
  conversation: Conversation
  conversationMembers: ConversationMember[]
  getProfile: (profileId: string) => Profile | undefined
  messages: Message[]
  myUserId: string
  onBack: () => void
  onDeleteMessage: (conversationId: string, messageId: string) => Promise<boolean>
  onOpenInfo: () => void
  onPinMessage: (conversationId: string, messageId: string) => Promise<boolean>
  onRemoveFailedUpload: (messageId: string) => void
  onRetryUpload: (messageId: string) => void
  onSendFile: (file: File) => void
  onSendText: (body: string) => void
  onUnpinMessage: (conversationId: string) => Promise<boolean>
  title: string
}) {
  const [draft, setDraft] = useState('')
  const [imageViewerAttachment, setImageViewerAttachment] = useState<Attachment | null>(null)
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false)
  const [messageSearchQuery, setMessageSearchQuery] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const otherMemberId = conversation.memberIds.find((id) => id !== myUserId)
  const otherProfile = getProfile(otherMemberId ?? '')
  const currentMember = conversationMembers.find(
    (member) => member.conversationId === conversation.id && member.userId === myUserId,
  )
  const isGroupManager = currentMember?.role === 'owner' || currentMember?.role === 'admin'
  const sendBlockReason = getChatMuteReason(conversation, currentMember)
  const isComposerDisabled = Boolean(sendBlockReason)
  const pinnedMessage = conversation.pinnedMessageId
    ? messages.find((message) => message.id === conversation.pinnedMessageId && !message.deletedAt)
    : undefined
  const messageSearchResults = useMemo(
    () => buildConversationMessageResults(messageSearchQuery, conversation, messages, getProfile),
    [conversation, getProfile, messageSearchQuery, messages],
  )

  function submit(event: FormEvent) {
    event.preventDefault()
    if (isComposerDisabled) return
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
          <Avatar
            allowMotion
            profile={conversation.type === 'direct' ? otherProfile : undefined}
            title={title}
            variant={conversation.type}
          />
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
              onOpenImage={(attachment) => setImageViewerAttachment(attachment)}
              onDelete={() => {
                void onDeleteMessage(conversation.id, message.id)
              }}
              onPin={() => {
                void onPinMessage(conversation.id, message.id)
              }}
              onUnpin={() => {
                void onUnpinMessage(conversation.id)
              }}
              onRemoveFailedUpload={() => onRemoveFailedUpload(message.id)}
              onRetryUpload={() => onRetryUpload(message.id)}
              sender={getProfile(message.senderId)}
            />
          ))
        )}
      </div>

      {(authNotice || sendBlockReason) && (
        <p className="notice chat-notice">{authNotice || sendBlockReason}</p>
      )}

      <form className="composer" onSubmit={submit}>
        <input
          ref={fileInputRef}
          accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,application/pdf,text/plain,text/markdown"
          aria-label="文件附件"
          className="file-input"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file && !isComposerDisabled) onSendFile(file)
            event.target.value = ''
          }}
          type="file"
        />
        <button
          aria-label="添加附件"
          className="icon-button"
          disabled={isComposerDisabled}
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          <Paperclip size={21} />
        </button>
        <input
          aria-label="消息"
          disabled={isComposerDisabled}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={sendBlockReason || '输入消息'}
          value={draft}
        />
        <button
          aria-label="发送消息"
          className="send-button"
          disabled={isComposerDisabled || !draft.trim()}
          type="submit"
        >
          <SendHorizontal size={20} />
        </button>
      </form>

      {imageViewerAttachment && (
        <ImageViewer
          attachment={imageViewerAttachment}
          onClose={() => setImageViewerAttachment(null)}
        />
      )}
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

function shouldRenderMessageBody(message: Message) {
  if (!message.body.trim()) return false
  if (!message.attachment) return true
  if (message.attachment.deletedAt) return false
  if (message.type === 'image' && message.body === '图片') return false
  if (message.type === 'video' && message.body === '视频') return false
  if (message.type === 'file' && message.body === message.attachment.fileName) return false
  return true
}

function MessageBubble({
  canDelete,
  canPin,
  isMine,
  isPinned,
  message,
  onDelete,
  onOpenImage,
  onPin,
  onRemoveFailedUpload,
  onRetryUpload,
  onUnpin,
  sender,
}: {
  canDelete: boolean
  canPin: boolean
  isMine: boolean
  isPinned: boolean
  message: Message
  onDelete: () => void
  onOpenImage: (attachment: Attachment) => void
  onPin: () => void
  onRemoveFailedUpload: () => void
  onRetryUpload: () => void
  onUnpin: () => void
  sender: Profile | undefined
}) {
  const canManageFailedUpload = isMine && message.status === 'failed' && Boolean(message.uploadError)

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
              <AttachmentPreview message={message} onOpenImage={onOpenImage} />
            ) : null}
            {shouldRenderMessageBody(message) && <p>{message.body}</p>}
          </>
        )}
        <span className="message-meta">
          {formatTime(message.createdAt)}
          {isMine && (message.status === 'read' ? <CheckCheck size={15} /> : <Check size={15} />)}
        </span>
        {typeof message.uploadProgress === 'number' && (
          <div className="upload-progress" aria-label="上传进度">
            <span style={{ width: `${message.uploadProgress}%` }} />
            <small>{message.uploadProgress}%</small>
          </div>
        )}
        {message.uploadError && <p className="upload-error">{message.uploadError}</p>}
        {canManageFailedUpload && (
          <div className="upload-actions" aria-label="上传失败操作">
            <button className="text-action" onClick={onRetryUpload} type="button">
              重试
            </button>
            <button className="text-action danger" onClick={onRemoveFailedUpload} type="button">
              移除
            </button>
          </div>
        )}
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

function AttachmentPreview({
  message,
  onOpenImage,
}: {
  message: Message
  onOpenImage: (attachment: Attachment) => void
}) {
  const [didImageFail, setDidImageFail] = useState(false)
  const attachment = message.attachment
  if (!attachment) return null

  const shouldShowImage = message.type === 'image' && !didImageFail
  const shouldShowVideo = message.type === 'video'

  if (shouldShowImage) {
    return (
      <button
        aria-label={`打开图片 ${attachment.fileName}`}
        className="image-attachment"
        onClick={() => onOpenImage(attachment)}
        type="button"
      >
        <img
          alt={attachment.fileName}
          loading="lazy"
          onError={() => setDidImageFail(true)}
          src={attachment.url}
        />
      </button>
    )
  }

  if (shouldShowVideo) {
    return (
      <div className="video-attachment" aria-label={`视频消息 ${attachment.fileName}`}>
        <video controls preload="metadata" src={attachment.url} />
        <div className="video-attachment-meta">
          <span className="video-attachment-title">
            <Video size={15} />
            {attachment.fileName}
          </span>
          <small>{formatFileSize(attachment.sizeBytes)} · 点击播放</small>
        </div>
      </div>
    )
  }

  return (
    <a className="attachment" href={attachment.url} rel="noreferrer" target="_blank">
      {message.type === 'image' ? <ImageIcon size={18} /> : <FileText size={18} />}
      <span>{attachment.fileName}</span>
    </a>
  )
}

function ImageViewer({
  attachment,
  onClose,
}: {
  attachment: Attachment
  onClose: () => void
}) {
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false)
  const [fallbackNotice, setFallbackNotice] = useState('')
  const longPressTimer = useRef<number | null>(null)

  function clearLongPressTimer() {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  async function saveImage() {
    setIsActionSheetOpen(false)
    setFallbackNotice('')
    try {
      const response = await fetch(attachment.url)
      if (!response.ok) throw new Error('Image download failed')
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = attachment.fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch {
      window.open(attachment.url, '_blank', 'noopener,noreferrer')
      setFallbackNotice('已打开原图；如果没有自动保存，请使用系统长按保存。')
    }
  }

  return (
    <div className="image-viewer" role="dialog" aria-label="图片预览">
      <button className="image-viewer-back" onClick={onClose} type="button">
        <ArrowLeft size={22} />
        返回
      </button>
      <button
        aria-label="图片操作"
        className="image-viewer-more"
        onClick={() => {
          setFallbackNotice('')
          setIsActionSheetOpen(true)
        }}
        type="button"
      >
        <MoreHorizontal size={22} />
        操作
      </button>
      <button
        aria-label="关闭图片预览"
        className="image-viewer-canvas"
        onClick={() => {
          if (isActionSheetOpen) {
            setIsActionSheetOpen(false)
            return
          }
          onClose()
        }}
        onPointerCancel={clearLongPressTimer}
        onPointerDown={() => {
          clearLongPressTimer()
          longPressTimer.current = window.setTimeout(() => {
            setIsActionSheetOpen(true)
          }, 550)
        }}
        onPointerLeave={clearLongPressTimer}
        onPointerUp={clearLongPressTimer}
        type="button"
      >
        <img alt={attachment.fileName} src={attachment.url} />
      </button>
      {isActionSheetOpen && (
        <div className="image-action-sheet">
          <button onClick={() => void saveImage()} type="button">
            保存图片
          </button>
          <a href={attachment.url} rel="noreferrer" target="_blank">
            打开原图
          </a>
          <button onClick={() => setIsActionSheetOpen(false)} type="button">
            取消
          </button>
        </div>
      )}
      {fallbackNotice && <p className="image-viewer-notice">{fallbackNotice}</p>}
    </div>
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

function getChatMuteReason(
  conversation: Conversation,
  currentMember: ConversationMember | undefined,
) {
  if (conversation.type !== 'group') return ''
  if (!currentMember || currentMember.role === 'owner' || currentMember.role === 'admin') return ''
  if (currentMember.isMuted) return '你已被管理员禁言，暂时不能发言。'
  if (conversation.isMuted) return '本群已开启全体禁言，仅管理员可发言。'
  return ''
}

function GroupInfo({
  adminActivityLogs,
  activeWorkspace,
  appErrorEvents,
  authNotice,
  conversation,
  currentUserId,
  getProfile,
  messages,
  members: allConversationMembers,
  onAddGroupMemberByEmail,
  onBack,
  onHideGroupAttachment,
  onRemoveGroupMember,
  onRenameGroup,
  onToggleGroupMute,
  onToggleMemberMute,
  onUpdateAnnouncement,
  onUpdateGroupMemberRole,
}: {
  adminActivityLogs: AdminActivityLog[]
  activeWorkspace: Workspace | null
  appErrorEvents: AppErrorEvent[]
  authNotice: string
  conversation: Conversation
  currentUserId: string
  getProfile: (profileId: string) => Profile | undefined
  messages: Message[]
  members: ConversationMember[]
  onAddGroupMemberByEmail: (conversationId: string, email: string) => Promise<boolean>
  onBack: () => void
  onHideGroupAttachment: (conversationId: string, attachmentId: string) => Promise<boolean>
  onRemoveGroupMember: (conversationId: string, memberUserId: string) => Promise<boolean>
  onRenameGroup: (conversationId: string, title: string) => Promise<boolean>
  onToggleGroupMute: (conversationId: string, muted: boolean) => Promise<boolean>
  onToggleMemberMute: (
    conversationId: string,
    memberUserId: string,
    muted: boolean,
  ) => Promise<boolean>
  onUpdateAnnouncement: (conversationId: string, announcement: string) => Promise<boolean>
  onUpdateGroupMemberRole: (
    conversationId: string,
    memberUserId: string,
    role: Extract<MemberRole, 'admin' | 'member'>,
  ) => Promise<boolean>
}) {
  const title = displayConversationTitle(conversation.title)
  const [memberEmail, setMemberEmail] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [editingConversationId, setEditingConversationId] = useState('')
  const [isManagementOpen, setIsManagementOpen] = useState(false)
  const [inviteCopyStatus, setInviteCopyStatus] = useState('')
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
      isMuted: false,
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
  const groupFiles = useMemo(
    () =>
      messages
        .filter((message) => message.conversationId === conversation.id && message.attachment)
        .filter((message) => canManageGroup || (!message.deletedAt && !message.attachment?.deletedAt))
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [canManageGroup, conversation.id, messages],
  )
  const visibleAdminActivityLogs = activeWorkspace
    ? adminActivityLogs.filter((log) => log.workspaceId === activeWorkspace.id)
    : adminActivityLogs
  const visibleAppErrorEvents = activeWorkspace
    ? appErrorEvents.filter((event) => event.workspaceId === activeWorkspace.id)
    : appErrorEvents
  const groupAdminActivityLogs = visibleAdminActivityLogs.filter(
    (log) => log.details?.conversationId === conversation.id,
  )
  const groupAppErrorEvents = visibleAppErrorEvents.filter(
    (event) => event.context?.conversationId === conversation.id,
  )
  const managerCount = conversationMembers.filter(
    (member) => member.role === 'owner' || member.role === 'admin',
  ).length
  const mutedMemberCount = conversationMembers.filter((member) => member.isMuted).length
  const inviteOrigin =
    typeof window === 'undefined' ? 'https://chat-mvp-tau.vercel.app' : window.location.origin
  const inviteText = `请先打开 ${inviteOrigin} 注册并登录，完成后把注册邮箱发给管理员。管理员会把你加入群聊「${title}」。`
  const workspaceErrorCount = visibleAppErrorEvents.length
  const notificationErrorCount = visibleAppErrorEvents.filter(
    (event) => event.module === 'notifications',
  ).length
  const attachmentErrorCount = visibleAppErrorEvents.filter(
    (event) => event.module === 'attachments',
  ).length
  const recentWorkspaceActivityCount = visibleAdminActivityLogs.length

  function updateTitleDraft(value: string) {
    setTitleDraftState({ conversationId: conversation.id, value })
  }

  function updateAnnouncementDraft(value: string) {
    setAnnouncementDraftState({ conversationId: conversation.id, value })
  }

  async function submitGroupMember(event: FormEvent) {
    event.preventDefault()
    if (!memberEmail.trim()) return
    setIsBusy(true)
    const ok = await onAddGroupMemberByEmail(conversation.id, memberEmail)
    if (ok) setMemberEmail('')
    setIsBusy(false)
  }

  async function copyInviteText() {
    setInviteCopyStatus('')

    try {
      await navigator.clipboard.writeText(inviteText)
      setInviteCopyStatus('邀请说明已复制，可以直接发给对方。')
    } catch {
      setInviteCopyStatus('浏览器没有允许自动复制，请手动复制下方说明。')
    }
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

  async function toggleGroupMute() {
    setIsBusy(true)
    await onToggleGroupMute(conversation.id, !conversation.isMuted)
    setIsBusy(false)
  }

  async function toggleMemberMute(memberUserId: string, muted: boolean) {
    setIsBusy(true)
    await onToggleMemberMute(conversation.id, memberUserId, muted)
    setIsBusy(false)
  }

  return (
    <section className="screen detail-screen group-detail-screen">
      <header className="topbar">
        <button aria-label="返回聊天" className="icon-button" onClick={onBack} type="button">
          <ArrowLeft size={22} />
        </button>
        <div>
          <p className="eyebrow">群聊信息</p>
          <h1>群详情</h1>
        </div>
        {canManageGroup ? (
          <button
            aria-expanded={isManagementOpen}
            aria-label="更多群管理"
            className="icon-button"
            onClick={() => setIsManagementOpen((isOpen) => !isOpen)}
            type="button"
          >
            <Settings size={22} />
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
      </header>

      <section className="group-summary">
        <div className="detail-avatar-wrap">
          <Avatar title={title} variant="group" size="large" />
        </div>
        <div className="detail-title-stack">
          <h2>{title}</h2>
          <p>
            {conversation.memberCount} 名成员 · {managerCount} 名管理员
            {conversation.isMuted ? ' · 已全体禁言' : ''}
          </p>
        </div>
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
        <div className="group-quick-actions">
          {canManageGroup && (
            <button
              className="group-quick-action"
              onClick={() => document.getElementById('groupMemberEmail')?.focus()}
              type="button"
            >
              <UserPlus size={18} />
              <span>添加成员</span>
            </button>
          )}
          <button
            className="group-quick-action"
            onClick={() => document.getElementById('groupMemberList')?.scrollIntoView({ block: 'start' })}
            type="button"
          >
            <Users size={18} />
            <span>成员</span>
          </button>
          <button
            className="group-quick-action"
            onClick={() => document.getElementById('groupFilesPanel')?.scrollIntoView({ block: 'start' })}
            type="button"
          >
            <FileText size={18} />
            <span>群文件</span>
          </button>
          {canManageGroup && (
            <button
              className="group-quick-action"
              onClick={() => setIsManagementOpen((isOpen) => !isOpen)}
              type="button"
            >
              <Settings size={18} />
              <span>更多管理</span>
            </button>
          )}
        </div>
      </section>

      <div className="settings-list">
        <section className="group-section" aria-label="群公告与权限">
          <div className="group-section-header">
            <span>
              <strong>群公告与权限</strong>
              <small>
                {managerCount} 名管理员 · {mutedMemberCount > 0 ? `${mutedMemberCount} 名成员已禁言` : '暂无成员被禁言'}
              </small>
            </span>
          </div>
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
          <ShieldCheck size={20} />
          <span>
            <strong>群权限</strong>
            <small>owner 可调整群管理员；owner/admin 可添加、移除或禁言普通成员</small>
          </span>
        </div>
        <div className="settings-row mute-row">
          <ShieldCheck size={20} />
          <span>
            <strong>全体禁言</strong>
            <small>
              {conversation.isMuted
                ? '已开启，仅群 owner/admin 可发言'
                : '未开启，普通成员可正常发言'}
            </small>
          </span>
          {canManageGroup ? (
            <button
              className={conversation.isMuted ? 'secondary-button compact-button' : 'danger-secondary-button compact-button'}
              disabled={isBusy}
              onClick={() => {
                void toggleGroupMute()
              }}
              type="button"
            >
              {conversation.isMuted ? '解除禁言' : '开启禁言'}
            </button>
          ) : (
            <span className="role-badge">{conversation.isMuted ? '已禁言' : '未禁言'}</span>
          )}
        </div>
        </section>
        {canManageGroup && (
          <section className="group-section" aria-label="添加群成员">
          <form className="group-member-manager" onSubmit={(event) => void submitGroupMember(event)}>
            <label htmlFor="groupMemberEmail">添加成员</label>
            <div className="workspace-member-controls">
              <input
                aria-label="添加群成员邮箱"
                autoComplete="email"
                disabled={isBusy}
                id="groupMemberEmail"
                onChange={(event) => setMemberEmail(event.target.value)}
                placeholder="member@example.com"
                type="email"
                value={memberEmail}
              />
              <button
                className="secondary-button"
                disabled={isBusy || !memberEmail.trim()}
                type="submit"
              >
                添加成员
              </button>
            </div>
            <p className="form-hint">对方需要先注册；添加后会进入当前群。</p>
            <div className="invite-copy-card" role="region" aria-label="邀请说明">
              <span>
                <strong>邀请说明</strong>
                <small>给还没注册的同事，先完成注册再添加进群。</small>
              </span>
              <textarea
                aria-label="可复制邀请说明"
                onFocus={(event) => event.currentTarget.select()}
                readOnly
                value={inviteText}
              />
              <button
                className="secondary-button compact-button"
                onClick={() => {
                  void copyInviteText()
                }}
                type="button"
              >
                复制邀请文案
              </button>
              {inviteCopyStatus && <small className="copy-status">{inviteCopyStatus}</small>}
            </div>
            {authNotice && <p className="form-hint notice-inline">{authNotice}</p>}
          </form>
          </section>
        )}
        <section className="group-section" aria-label="群文件">
        <div className="group-files-panel" id="groupFilesPanel">
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
                  {attachment.mimeType.startsWith('image/') ? (
                    <ImageIcon size={18} />
                  ) : attachment.mimeType.startsWith('video/') ? (
                    <Video size={18} />
                  ) : (
                    <FileText size={18} />
                  )}
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
        </section>
        {canManageGroup && isManagementOpen && (
          <section className="group-section trial-health-card" aria-label="试用巡检">
            <div className="workspace-card-header">
              <ShieldCheck size={24} />
              <span>
                <strong>试用巡检</strong>
                <p>给 20-30 人公司试用时快速查看最近错误、通知和文件状态。</p>
              </span>
            </div>
            <div className="trial-health-grid">
              <span>
                <strong>{workspaceErrorCount}</strong>
                <small>最近错误</small>
              </span>
              <span>
                <strong>{notificationErrorCount}</strong>
                <small>通知失败</small>
              </span>
              <span>
                <strong>{attachmentErrorCount}</strong>
                <small>附件失败</small>
              </span>
              <span>
                <strong>{recentWorkspaceActivityCount}</strong>
                <small>管理操作</small>
              </span>
            </div>
            {visibleAppErrorEvents.length > 0 ? (
              <div className="admin-log-list compact-log-list">
                {visibleAppErrorEvents.slice(0, 3).map((event) => (
                  <div className="admin-log-row" key={event.id}>
                    <span>
                      <strong>{formatErrorModule(event.module)}</strong>
                      <small>
                        {event.message} · {formatShortDateTime(event.createdAt)}
                      </small>
                    </span>
                    <span className="error-badge">需关注</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-inline">最近没有记录到关键错误。</p>
            )}
          </section>
        )}
        {canManageGroup && isManagementOpen && (
          <section className="group-section admin-log-card group-management-records" aria-label="群管理记录">
            <div className="workspace-card-header">
              <ShieldCheck size={24} />
              <span>
                <strong>群管理记录</strong>
                <p>仅显示当前群的最近管理操作和关键错误。</p>
              </span>
            </div>
            {groupAdminActivityLogs.length === 0 ? (
              <p className="empty-inline">暂无当前群管理操作。</p>
            ) : (
              <div className="admin-log-list">
                {groupAdminActivityLogs.slice(0, 4).map((log) => {
                  const targetProfile = getProfile(log.targetUserId)

                  return (
                    <div className="admin-log-row" key={log.id}>
                      <span>
                        <strong>{formatAdminActivity(log.action)}</strong>
                        <small>
                          {targetProfile?.displayName ?? '成员'} · {formatShortDateTime(log.createdAt)}
                        </small>
                      </span>
                      <span className={log.result === 'success' ? 'role-badge' : 'error-badge'}>
                        {log.result === 'success' ? '成功' : '失败'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
            {groupAppErrorEvents.length > 0 && (
              <div className="admin-log-list">
                {groupAppErrorEvents.slice(0, 3).map((event) => (
                  <div className="admin-log-row" key={event.id}>
                    <span>
                      <strong>{formatErrorModule(event.module)}</strong>
                      <small>
                        {event.message} · {formatShortDateTime(event.createdAt)}
                      </small>
                    </span>
                    <span className="error-badge">需关注</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <section className="group-section group-members-section" aria-label="群成员" id="groupMemberList">
        <div className="group-section-header">
          <span>
            <strong>群成员</strong>
            <small>
              {conversationMembers.length} 人 · {managerCount} 名管理员
            </small>
          </span>
          {canManageGroup && (
            <span className="role-badge">
              {canManageRoles ? 'owner 可调整角色' : 'admin 可管理成员'}
            </span>
          )}
        </div>
      <div className="member-list group-member-list">
        {conversationMembers.map((member) => {
          const profile = getProfile(member.userId)
          const canRemove = canManageGroup && member.role === 'member' && member.userId !== currentUserId
          const canEditRole = canManageRoles && member.role !== 'owner'
          const canToggleMute = canManageGroup && member.role === 'member' && member.userId !== currentUserId

          return (
            <div className="member-row group-member-row" key={`${member.conversationId}-${member.userId}`}>
              <Avatar profile={profile} />
              <span>
                <strong>{profile?.displayName ?? '成员'}</strong>
                <small>
                  {formatStatus(profile?.status ?? 'offline')}
                  {member.isMuted ? ' · 已禁言' : ''}
                </small>
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
                {canToggleMute && (
                  <button
                    className={member.isMuted ? 'text-action' : 'text-action danger'}
                    disabled={isBusy}
                    onClick={() => {
                      void toggleMemberMute(member.userId, !member.isMuted)
                    }}
                    type="button"
                  >
                    {member.isMuted ? '解除禁言' : '禁言'}
                  </button>
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
  onAvatarVideoUpload,
  onBack,
  onRefreshDeviceSessions,
  onRemoveVideoAvatar,
  onRevokeDeviceSession,
  onRevokeOtherDevices,
  onSave,
  onSignOut,
  profile,
  uploadProgress,
}: {
  activeWorkspace: Workspace | null
  authNotice: string
  currentDeviceId: string
  deviceSessions: DeviceSession[]
  email: string
  onAvatarUpload: (file: File) => Promise<void>
  onAvatarVideoUpload: (file: File) => Promise<void>
  onBack: () => void
  onRefreshDeviceSessions: () => Promise<void>
  onRemoveVideoAvatar: () => Promise<void>
  onRevokeDeviceSession: (deviceId: string) => Promise<boolean>
  onRevokeOtherDevices: () => Promise<boolean>
  onSave: (profile: Pick<Profile, 'displayName' | 'bio'>) => void
  onSignOut: () => void
  profile: Profile
  uploadProgress: { label: string; percent: number } | null
}) {
  const [displayName, setDisplayName] = useState(profile.displayName)
  const [bio, setBio] = useState(profile.bio)
  const [editingField, setEditingField] = useState<'displayName' | 'bio' | null>(null)
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false)
  const [isDeviceBusy, setIsDeviceBusy] = useState(false)
  const [isDeviceSectionOpen, setIsDeviceSectionOpen] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement | null>(null)
  const avatarVideoInputRef = useRef<HTMLInputElement | null>(null)
  const pushNotifications = usePushNotifications(profile.id, activeWorkspace?.id)
  const hasProfileChanges = displayName !== profile.displayName || bio !== profile.bio

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
    <section className="screen detail-screen profile-detail-screen">
      <header className="topbar">
        <button aria-label="返回聊天列表" className="icon-button" onClick={onBack} type="button">
          <ArrowLeft size={22} />
        </button>
        <div>
          <p className="eyebrow">设置</p>
          <h1>个人资料</h1>
        </div>
      </header>

      <section className="profile-hero">
        <div className="detail-avatar-wrap">
          <button
            aria-expanded={isAvatarMenuOpen}
            aria-haspopup="menu"
            aria-label="头像操作"
            className="profile-avatar-trigger"
            onClick={() => setIsAvatarMenuOpen((current) => !current)}
            type="button"
          >
            <Avatar allowMotion profile={profile} size="large" />
          </button>
        </div>
        <div className="profile-identity-summary">
          <strong>{profile.displayName}</strong>
          <small>{email}</small>
          <em>点击头像更换图片或视频头像</em>
        </div>
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
        <input
          ref={avatarVideoInputRef}
          accept="video/mp4,video/webm"
          aria-label="视频头像文件"
          className="file-input"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void onAvatarVideoUpload(file)
            event.target.value = ''
          }}
          type="file"
        />
        {isAvatarMenuOpen && (
          <div className="profile-avatar-menu" role="menu" aria-label="头像操作菜单">
          <button
            onClick={() => {
              setIsAvatarMenuOpen(false)
              avatarInputRef.current?.click()
            }}
            role="menuitem"
            type="button"
          >
            <ImageIcon size={16} />
            更换图片头像
          </button>
          <button
            onClick={() => {
              setIsAvatarMenuOpen(false)
              avatarVideoInputRef.current?.click()
            }}
            role="menuitem"
            type="button"
          >
            <Video size={16} />
            更换视频头像
          </button>
          {profile.avatarMediaType === 'video' && (
            <button
              className="danger-menu-item"
              onClick={() => {
                setIsAvatarMenuOpen(false)
                void onRemoveVideoAvatar()
              }}
              role="menuitem"
              type="button"
            >
              移除视频头像
            </button>
          )}
          <button onClick={() => setIsAvatarMenuOpen(false)} role="menuitem" type="button">
            取消
          </button>
        </div>
        )}
        {uploadProgress && (
          <div className="profile-upload-progress" aria-label="头像上传进度">
            <strong>{uploadProgress.label}</strong>
            <div className="upload-progress">
              <span style={{ width: `${uploadProgress.percent}%` }} />
              <small>{uploadProgress.percent}%</small>
            </div>
          </div>
        )}
      </section>

      <form
        className="profile-form"
        onSubmit={(event) => {
          event.preventDefault()
          onSave({ displayName, bio })
          setEditingField(null)
        }}
      >
        <section className="profile-settings-section" aria-label="个人信息">
          <button
            className="profile-setting-row"
            onClick={() => setEditingField(editingField === 'displayName' ? null : 'displayName')}
            type="button"
          >
            <span>
              <small>昵称</small>
              <strong>{displayName || '未设置'}</strong>
            </span>
            <em>{editingField === 'displayName' ? '收起' : '编辑'}</em>
          </button>
          {editingField === 'displayName' && (
            <input
              aria-label="昵称"
              id="displayName"
              onChange={(event) => setDisplayName(event.target.value)}
              value={displayName}
            />
          )}

          <button
            className="profile-setting-row"
            onClick={() => setEditingField(editingField === 'bio' ? null : 'bio')}
            type="button"
          >
            <span>
              <small>简介</small>
              <strong>{bio || '未填写'}</strong>
            </span>
            <em>{editingField === 'bio' ? '收起' : '编辑'}</em>
          </button>
          {editingField === 'bio' && (
            <textarea aria-label="简介" id="bio" onChange={(event) => setBio(event.target.value)} value={bio} />
          )}

          <div className="profile-setting-row readonly-row">
            <span>
              <small>邮箱</small>
              <strong>{email}</strong>
            </span>
          </div>
        </section>

        {hasProfileChanges && (
          <button className="primary-button" type="submit">
            保存资料
          </button>
        )}

        <section className="profile-settings-section device-card" aria-label="登录设备">
          <button
            aria-controls="device-session-panel"
            aria-expanded={isDeviceSectionOpen}
            className="profile-disclosure-row"
            onClick={() => setIsDeviceSectionOpen((current) => !current)}
            type="button"
          >
            <Monitor size={20} />
            <span>
              <strong>登录设备</strong>
              <small>{deviceSessions.length} 台设备正在使用这个账号</small>
            </span>
            <em>{isDeviceSectionOpen ? '收起' : '查看'}</em>
          </button>

          {isDeviceSectionOpen && (
            <div className="device-session-panel" id="device-session-panel">
              <button
                className="secondary-button compact-button"
                disabled={isDeviceBusy}
                onClick={() => {
                  void onRefreshDeviceSessions()
                }}
                type="button"
              >
                刷新设备
              </button>
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
            </div>
          )}
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
        <button className="profile-sign-out-row" onClick={onSignOut} type="button">
          <LogOut size={20} />
          <span>
            <strong>退出登录</strong>
            <small>退出当前账号并回到登录页</small>
          </span>
        </button>
        {authNotice && <p className="notice">{authNotice}</p>}
      </form>
    </section>
  )
}

function Avatar({
  allowMotion = false,
  profile,
  size = 'default',
  title,
  variant = 'direct',
}: {
  allowMotion?: boolean
  profile?: Profile | null
  size?: 'small' | 'default' | 'large'
  title?: string
  variant?: 'direct' | 'group'
}) {
  const [failedVideoUrl, setFailedVideoUrl] = useState('')
  const label = profile?.displayName ?? title ?? '群聊'
  const initials = label
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
  const avatarVideoUrl = profile?.avatarVideoUrl ?? ''
  const shouldShowVideo =
    allowMotion &&
    failedVideoUrl !== avatarVideoUrl &&
    !prefersReducedMotion() &&
    profile?.avatarMediaType === 'video' &&
    Boolean(avatarVideoUrl)

  return (
    <span className={`avatar ${profile?.avatarTone ?? (variant === 'group' ? 'slate' : 'blue')} ${size}`}>
      {shouldShowVideo ? (
        <video
          aria-label={`${label} 的视频头像`}
          autoPlay
          loop
          muted
          onError={() => setFailedVideoUrl(avatarVideoUrl)}
          playsInline
          poster={profile?.avatarVideoPosterUrl || profile?.avatarUrl}
          src={avatarVideoUrl}
        />
      ) : profile?.avatarUrl ? (
        <img alt="" decoding="async" loading="lazy" src={profile.avatarUrl} />
      ) : variant === 'group' && !profile ? (
        <Users size={size === 'large' ? 34 : 20} />
      ) : (
        initials
      )}
    </span>
  )
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
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
  if (action === 'group_muted') return '开启全体禁言'
  if (action === 'group_unmuted') return '解除全体禁言'
  if (action === 'member_muted') return '禁言成员'
  if (action === 'member_unmuted') return '解除成员禁言'
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
