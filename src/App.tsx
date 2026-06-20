import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ArrowLeft,
  Check,
  CheckCheck,
  FileText,
  Image as ImageIcon,
  Lock,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Search,
  SendHorizontal,
  UserPlus,
  Users,
  Video,
} from 'lucide-react'
import './App.css'
import { useChatApp } from './hooks/useChatApp'
import Avatar from './components/Avatar'
import { displayConversationTitle, formatFileSize, formatStatus, formatTime } from './lib/uiFormat'
import {
  buildSearchResults,
  defaultSearchFilters,
  isSearchQueryReady,
} from './hooks/chatApp/search'
import type {
  Attachment,
  ConnectionStatus,
  ContactRequest,
  Conversation,
  ConversationMember,
  Message,
  Profile,
  SearchCursor,
  SearchFilters,
  SearchPage,
  SearchResult,
} from './types'

type Screen = 'login' | 'list' | 'chat' | 'group' | 'profile'

const GroupInfo = lazy(() => import('./components/GroupInfo'))
const ProfileSettings = lazy(() => import('./components/ProfileSettings'))

function ScreenFallback() {
  return (
    <section className="screen detail-screen" aria-label="正在加载">
      <p className="notice">正在加载...</p>
    </section>
  )
}

const APP_DISPLAY_NAME = '聊天 MVP'
const INITIAL_VISIBLE_MESSAGE_COUNT = 80
const MESSAGE_LOAD_STEP = 80
const MESSAGE_TYPE_FILTERS: Array<{ label: string; value: SearchFilters['messageType'] }> = [
  { label: '全部', value: 'all' },
  { label: '文本', value: 'text' },
  { label: '图片', value: 'image' },
  { label: '视频', value: 'video' },
  { label: '文件', value: 'file' },
]
const DATE_RANGE_FILTERS: Array<{ label: string; value: SearchFilters['dateRange'] }> = [
  { label: '全部时间', value: 'all' },
  { label: '今天', value: 'today' },
  { label: '近 7 天', value: '7d' },
  { label: '近 30 天', value: '30d' },
]

function mergeSearchResultPages(existing: SearchResult[], incoming: SearchResult[]) {
  const seen = new Set(existing.map((result) => result.id))
  const merged = [...existing]

  incoming.forEach((result) => {
    if (seen.has(result.id)) return
    merged.push(result)
    seen.add(result.id)
  })

  return merged.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

const emptySearchPage: SearchPage = {
  results: [],
  hasMore: false,
}

function searchFilterSummary(
  filters: SearchFilters,
  senderOptions: Array<{ id: string; name: string }> = [],
) {
  const parts: string[] = []
  const typeLabel = MESSAGE_TYPE_FILTERS.find((option) => option.value === filters.messageType)?.label
  const dateLabel = DATE_RANGE_FILTERS.find((option) => option.value === filters.dateRange)?.label
  const senderLabel = senderOptions.find((sender) => sender.id === filters.senderId)?.name

  if (filters.messageType !== 'all' && typeLabel) parts.push(typeLabel)
  if (filters.senderId) parts.push(senderLabel ? `发送人：${senderLabel}` : '已选发送人')
  if (filters.dateRange !== 'all' && dateLabel) parts.push(dateLabel)

  return parts
}

function App() {
  const chat = useChatApp()
  const [screen, setScreen] = useState<Screen>('login')
  const [focusedMessageId, setFocusedMessageId] = useState('')

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
    setFocusedMessageId('')
  }

  async function openSearchResult(result: SearchResult) {
    chat.setActiveConversationId(result.conversationId)
    if (result.messageId) {
      await chat.loadMessageContext(result.conversationId, result.messageId)
      setFocusedMessageId(result.messageId)
    } else {
      setFocusedMessageId('')
    }
    setScreen('chat')
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
            searchFilters={chat.searchFilters}
            searchResults={chat.searchResults}
            hasMoreSearchResults={chat.hasMoreSearchResults}
            isSearchLoading={chat.isSearchLoading}
            isSearchLoadingMore={chat.isSearchLoadingMore}
            searchError={chat.searchError}
            onCreateGroup={async () => {
              const created = await chat.createGroup()
              setFocusedMessageId('')
              if (created) setScreen('chat')
            }}
            onOpenConversation={(id) => {
              chat.setActiveConversationId(id)
              setFocusedMessageId('')
              setScreen('chat')
            }}
            onOpenProfile={() => setScreen('profile')}
            onOpenSearchResult={(result) => {
              void openSearchResult(result)
            }}
            onLoadMoreSearchResults={chat.loadMoreSearchResults}
            onRetrySearchResults={chat.retrySearchResults}
            onSearchFiltersChange={chat.setSearchFilters}
            onQueryChange={chat.setQuery}
            onSignOut={handleSignOut}
            onRespondToContactRequest={async (requestId, action) => {
              const conversationId = await chat.respondToContactRequest(requestId, action)
              if (conversationId) {
                chat.setActiveConversationId(conversationId)
                setFocusedMessageId('')
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
            connectionStatus={chat.connectionStatus}
            conversation={chat.activeConversation}
            conversationMembers={chat.state.members}
            getProfile={chat.getProfile}
            hasOlderMessages={chat.hasOlderActiveMessages}
            focusedMessageId={focusedMessageId}
            isLoadingOlderMessages={chat.isLoadingOlderMessages}
            isServerMessagePagingEnabled={chat.isServerMessagePagingEnabled}
            messages={chat.activeMessages}
            myUserId={chat.user?.id ?? ''}
            onBack={() => setScreen('list')}
            onDeleteMessage={chat.deleteGroupMessage}
            onLoadMessageContext={chat.loadMessageContext}
            onLoadOlderMessages={chat.loadOlderMessages}
            onOpenInfo={() => setScreen(chat.activeConversation?.type === 'group' ? 'group' : 'profile')}
            onPinMessage={chat.pinGroupMessage}
            onRemoveFailedUpload={chat.removeFailedMessage}
            onRetryUpload={chat.retryFileMessage}
            onSearchMessages={chat.searchConversationMessages}
            onSendFile={chat.sendFile}
            onSendText={chat.sendText}
            onUnpinMessage={chat.unpinGroupMessage}
            title={activeTitle}
            key={chat.activeConversation.id}
          />
        )}
        {activeScreen === 'group' && chat.activeConversation && (
          <Suspense fallback={<ScreenFallback />}>
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
          </Suspense>
        )}
        {activeScreen === 'profile' && chat.me && (
          <Suspense fallback={<ScreenFallback />}>
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
          </Suspense>
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
  hasMoreSearchResults,
  incomingContactRequests,
  isSearchLoading,
  isSearchLoadingMore,
  me,
  outgoingContactRequests,
  onCreateGroup,
  onLoadMoreSearchResults,
  onOpenConversation,
  onOpenProfile,
  onOpenSearchResult,
  onQueryChange,
  onRespondToContactRequest,
  onRetrySearchResults,
  onSearchFiltersChange,
  onSendContactRequest,
  onSignOut,
  query,
  searchError,
  searchFilters,
  searchResults,
}: {
  authNotice: string
  conversations: Conversation[]
  getProfile: (profileId: string) => Profile | undefined
  hasMoreSearchResults: boolean
  incomingContactRequests: ContactRequest[]
  isSearchLoading: boolean
  isSearchLoadingMore: boolean
  me: Profile | null | undefined
  outgoingContactRequests: ContactRequest[]
  onCreateGroup: () => void
  onLoadMoreSearchResults: () => Promise<boolean>
  onOpenConversation: (id: string) => void
  onOpenProfile: () => void
  onOpenSearchResult: (result: SearchResult) => void
  onQueryChange: (query: string) => void
  onRespondToContactRequest: (
    requestId: string,
    action: 'accepted' | 'declined',
  ) => Promise<boolean>
  onRetrySearchResults: () => Promise<boolean>
  onSearchFiltersChange: (filters: SearchFilters) => void
  onSendContactRequest: (email: string) => Promise<boolean>
  onSignOut: () => void
  query: string
  searchError: string
  searchFilters: SearchFilters
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
  const canRunSearch = isSearchQueryReady(query)

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

      {isSearching && (
        <SearchFilterBar
          filters={searchFilters}
          onChange={onSearchFiltersChange}
          query={query}
          scope="global"
        />
      )}

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
          canRunSearch={canRunSearch}
          error={searchError}
          hasMore={hasMoreSearchResults}
          isLoading={isSearchLoading}
          isLoadingMore={isSearchLoadingMore}
          onLoadMore={() => {
            void onLoadMoreSearchResults()
          }}
          onOpenResult={onOpenSearchResult}
          onRetry={() => {
            void onRetrySearchResults()
          }}
          query={query}
          results={searchResults}
          scopeLabel="全部会话"
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
  canRunSearch,
  error,
  hasMore,
  isLoading,
  isLoadingMore,
  onLoadMore,
  onOpenResult,
  onRetry,
  query,
  results,
  scopeLabel,
}: {
  canRunSearch: boolean
  error: string
  hasMore: boolean
  isLoading: boolean
  isLoadingMore: boolean
  onLoadMore: () => void
  onOpenResult: (result: SearchResult) => void
  onRetry: () => void
  query: string
  results: SearchResult[]
  scopeLabel: string
}) {
  return (
    <section className="search-results" aria-label="搜索结果">
      <div className="request-panel-title">
        <strong>搜索结果</strong>
        <span>{`${scopeLabel} · 已显示 ${results.length} 条`}</span>
      </div>
      {error && (
        <div className="search-error" role="alert">
          <span>{error}</span>
          <button onClick={onRetry} type="button">
            重试
          </button>
        </div>
      )}
      {!canRunSearch ? (
        <EmptyState
          icon={<Search size={28} />}
          title="继续输入关键词"
          body="中文 1 个字即可搜索；英文或数字请至少输入 2 个字符。"
        />
      ) : isLoading && results.length === 0 ? (
        <EmptyState
          icon={<Search size={28} />}
          title="正在搜索"
          body="正在查询已保存消息，请稍候。"
        />
      ) : results.length === 0 ? (
        <EmptyState
          icon={<Search size={28} />}
          title="没有搜索结果"
          body="换个联系人、群名或消息关键词试试。"
        />
      ) : (
        <>
          {results.map((result) => (
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
                  {`${searchResultTypeText(result)} · ${result.senderName} · ${formatTime(result.createdAt)}`}
                </small>
                <span className="result-snippet">
                  <HighlightedText query={query} text={result.snippet} />
                </span>
              </span>
            </button>
          ))}
          {hasMore && (
            <>
              <p className="search-scope-note">还有更多结果，可继续加载或缩小筛选范围。</p>
              <button
                className="search-load-more"
                disabled={isLoadingMore}
                onClick={onLoadMore}
                type="button"
              >
                {isLoadingMore ? '正在加载...' : '加载更多结果'}
              </button>
            </>
          )}
        </>
      )}
    </section>
  )
}

function SearchFilterBar({
  filters,
  onChange,
  query,
  scope,
  senderOptions = [],
}: {
  filters: SearchFilters
  onChange: (filters: SearchFilters) => void
  query: string
  scope: 'global' | 'conversation'
  senderOptions?: Array<{ id: string; name: string }>
}) {
  const hasFilters =
    filters.messageType !== 'all' || filters.senderId || filters.dateRange !== 'all'
  const summary = searchFilterSummary(filters, senderOptions)

  function update(nextFilters: Partial<SearchFilters>) {
    onChange({ ...filters, ...nextFilters })
  }

  return (
    <section className="search-filter-bar" aria-label="搜索筛选">
      <div className="filter-row" role="group" aria-label="消息类型">
        {MESSAGE_TYPE_FILTERS.map((option) => (
          <button
            className={filters.messageType === option.value ? 'filter-chip active' : 'filter-chip'}
            key={option.value}
            onClick={() => update({ messageType: option.value })}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="filter-row compact">
        {scope === 'conversation' && (
          <label className="filter-select">
            <span>发送人</span>
            <select
              aria-label="按发送人筛选"
              onChange={(event) => update({ senderId: event.target.value })}
              value={filters.senderId}
            >
              <option value="">全部成员</option>
              {senderOptions.map((sender) => (
                <option key={sender.id} value={sender.id}>
                  {sender.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="filter-select">
          <span>时间</span>
          <select
            aria-label="按时间筛选"
            onChange={(event) =>
              update({ dateRange: event.target.value as SearchFilters['dateRange'] })
            }
            value={filters.dateRange}
          >
            {DATE_RANGE_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {hasFilters && (
          <button
            className="filter-reset"
            onClick={() => onChange(defaultSearchFilters)}
            type="button"
          >
            清除筛选
          </button>
        )}
      </div>
      {query.trim() && !isSearchQueryReady(query) && (
        <p className="search-scope-note">中文 1 个字即可搜索；英文或数字请至少输入 2 个字符。</p>
      )}
      {hasFilters && summary.length > 0 && (
        <p className="search-filter-summary">{`已筛选：${summary.join(' · ')}`}</p>
      )}
    </section>
  )
}

function ChatView({
  authNotice,
  connectionStatus,
  conversation,
  conversationMembers,
  focusedMessageId,
  getProfile,
  hasOlderMessages: hasServerOlderMessages,
  isLoadingOlderMessages,
  isServerMessagePagingEnabled,
  messages,
  myUserId,
  onBack,
  onDeleteMessage,
  onLoadMessageContext,
  onLoadOlderMessages,
  onOpenInfo,
  onPinMessage,
  onRemoveFailedUpload,
  onRetryUpload,
  onSearchMessages,
  onSendFile,
  onSendText,
  onUnpinMessage,
  title,
}: {
  authNotice: string
  connectionStatus: ConnectionStatus
  conversation: Conversation
  conversationMembers: ConversationMember[]
  focusedMessageId: string
  getProfile: (profileId: string) => Profile | undefined
  hasOlderMessages: boolean
  isLoadingOlderMessages: boolean
  isServerMessagePagingEnabled: boolean
  messages: Message[]
  myUserId: string
  onBack: () => void
  onDeleteMessage: (conversationId: string, messageId: string) => Promise<boolean>
  onLoadMessageContext: (conversationId: string, messageId: string) => Promise<boolean>
  onLoadOlderMessages: (conversationId: string) => Promise<boolean>
  onOpenInfo: () => void
  onPinMessage: (conversationId: string, messageId: string) => Promise<boolean>
  onRemoveFailedUpload: (messageId: string) => void
  onRetryUpload: (messageId: string) => void
  onSearchMessages: (
    conversationId: string,
    searchQuery: string,
    filters?: SearchFilters,
    cursor?: SearchCursor | null,
  ) => Promise<SearchPage>
  onSendFile: (file: File) => void
  onSendText: (body: string) => void
  onUnpinMessage: (conversationId: string) => Promise<boolean>
  title: string
}) {
  const [draft, setDraft] = useState('')
  const [imageViewerAttachment, setImageViewerAttachment] = useState<Attachment | null>(null)
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false)
  const [messageSearchQuery, setMessageSearchQuery] = useState('')
  const [messageSearchFilters, setMessageSearchFilters] = useState<SearchFilters>(defaultSearchFilters)
  const [focusedInlineMessageId, setFocusedInlineMessageId] = useState('')
  const [highlightedMessageId, setHighlightedMessageId] = useState('')
  const [openingSearchResultId, setOpeningSearchResultId] = useState('')
  const [serverMessageSearchPage, setServerMessageSearchPage] = useState<SearchPage>(emptySearchPage)
  const [isServerMessageSearchLoading, setIsServerMessageSearchLoading] = useState(false)
  const [isServerMessageSearchLoadingMore, setIsServerMessageSearchLoadingMore] = useState(false)
  const [visibleMessageCount, setVisibleMessageCount] = useState(INITIAL_VISIBLE_MESSAGE_COUNT)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const messageListRef = useRef<HTMLDivElement | null>(null)
  const messageRefs = useRef<Record<string, HTMLElement | null>>({})
  const messageSearchRequestIdRef = useRef(0)
  const otherMemberId = conversation.memberIds.find((id) => id !== myUserId)
  const otherProfile = getProfile(otherMemberId ?? '')
  const currentMember = conversationMembers.find(
    (member) => member.conversationId === conversation.id && member.userId === myUserId,
  )
  const isGroupManager = currentMember?.role === 'owner' || currentMember?.role === 'admin'
  const sendBlockReason = getChatMuteReason(conversation, currentMember)
  const connectionBlockReason =
    connectionStatus === 'offline' ? '网络不可用，恢复后可继续发送。' : ''
  const isComposerDisabled = Boolean(sendBlockReason || connectionBlockReason)
  const pinnedMessage = conversation.pinnedMessageId
    ? messages.find((message) => message.id === conversation.pinnedMessageId && !message.deletedAt)
    : undefined
  const conversationProfilesById = useMemo(() => {
    const entries: Array<[string, Profile]> = []
    conversation.memberIds.forEach((id) => {
      const profile = getProfile(id)
      if (profile) entries.push([id, profile])
    })
    return new Map(entries)
  }, [conversation.memberIds, getProfile])
  const hasClientOlderMessages = !isServerMessagePagingEnabled && messages.length > visibleMessageCount
  const visibleMessages = hasClientOlderMessages ? messages.slice(-visibleMessageCount) : messages
  const hasOlderMessages = hasServerOlderMessages || hasClientOlderMessages
  const localMessageSearchResults = useMemo(
    () => buildSearchResults(
      messageSearchQuery,
      [conversation],
      visibleMessages,
      conversationProfilesById,
      messageSearchFilters,
    ).filter((result) => result.kind === 'message'),
    [conversation, conversationProfilesById, messageSearchFilters, messageSearchQuery, visibleMessages],
  )
  const hasMessageSearchQuery = Boolean(messageSearchQuery.trim())
  const canRunMessageSearch = isSearchQueryReady(messageSearchQuery)
  const messageSearchResults = !hasMessageSearchQuery
    ? []
    : isServerMessagePagingEnabled
      ? serverMessageSearchPage.results
      : localMessageSearchResults
  const isMessageSearchLoading = canRunMessageSearch && isServerMessageSearchLoading
  const effectiveFocusedMessageId = focusedInlineMessageId || focusedMessageId
  const senderOptions = conversationMembers
    .filter((member) => member.conversationId === conversation.id)
    .map((member) => ({
      id: member.userId,
      name: getProfile(member.userId)?.displayName ?? '成员',
    }))

  useEffect(() => {
    const normalizedQuery = messageSearchQuery.trim()
    const requestId = messageSearchRequestIdRef.current + 1
    messageSearchRequestIdRef.current = requestId
    const shouldSearch = isServerMessagePagingEnabled && isSearchQueryReady(normalizedQuery)

    const timeoutId = window.setTimeout(() => {
      setServerMessageSearchPage(emptySearchPage)
      setIsServerMessageSearchLoadingMore(false)

      if (!isServerMessagePagingEnabled || !isSearchQueryReady(normalizedQuery)) {
        setIsServerMessageSearchLoading(false)
        return
      }

      setIsServerMessageSearchLoading(true)

      void onSearchMessages(conversation.id, normalizedQuery, messageSearchFilters, null).then((page) => {
        if (messageSearchRequestIdRef.current !== requestId) return
        setServerMessageSearchPage(page)
        setIsServerMessageSearchLoading(false)
      })
    }, shouldSearch ? 300 : 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [conversation.id, isServerMessagePagingEnabled, messageSearchFilters, messageSearchQuery, onSearchMessages])

  useEffect(() => {
    if (!effectiveFocusedMessageId) return

    const target = messageRefs.current[effectiveFocusedMessageId]
    if (!target) return

    setHighlightedMessageId(effectiveFocusedMessageId)
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })

    const timeoutId = window.setTimeout(() => {
      setHighlightedMessageId('')
    }, 2600)

    return () => window.clearTimeout(timeoutId)
  }, [effectiveFocusedMessageId, visibleMessages])

  async function retryConversationSearch() {
    const normalizedQuery = messageSearchQuery.trim()
    if (!isSearchQueryReady(normalizedQuery)) return

    const requestId = messageSearchRequestIdRef.current + 1
    messageSearchRequestIdRef.current = requestId
    setIsServerMessageSearchLoading(true)
    setIsServerMessageSearchLoadingMore(false)

    const page = await onSearchMessages(conversation.id, normalizedQuery, messageSearchFilters, null)
    if (messageSearchRequestIdRef.current !== requestId) return

    setServerMessageSearchPage(page)
    setIsServerMessageSearchLoading(false)
  }

  async function loadMoreConversationSearchResults() {
    const normalizedQuery = messageSearchQuery.trim()
    const cursor = serverMessageSearchPage.cursor ?? null

    if (
      !isSearchQueryReady(normalizedQuery) ||
      !cursor ||
      !serverMessageSearchPage.hasMore ||
      isServerMessageSearchLoading ||
      isServerMessageSearchLoadingMore
    ) {
      return
    }

    const requestId = messageSearchRequestIdRef.current + 1
    messageSearchRequestIdRef.current = requestId
    setIsServerMessageSearchLoadingMore(true)
    setServerMessageSearchPage((page) => ({ ...page, error: undefined }))

    const nextPage = await onSearchMessages(conversation.id, normalizedQuery, messageSearchFilters, cursor)
    if (messageSearchRequestIdRef.current !== requestId) return

    if (nextPage.error) {
      setServerMessageSearchPage((page) => ({ ...page, error: nextPage.error }))
      setIsServerMessageSearchLoadingMore(false)
      return
    }

    setServerMessageSearchPage((page) => ({
      results: mergeSearchResultPages(page.results, nextPage.results),
      cursor: nextPage.cursor,
      hasMore: nextPage.hasMore,
    }))
    setIsServerMessageSearchLoadingMore(false)
  }

  async function openMessageSearchResult(result: SearchResult) {
    setOpeningSearchResultId(result.id)

    if (result.messageId && isServerMessagePagingEnabled) {
      await onLoadMessageContext(conversation.id, result.messageId)
    }

    if (result.messageId) {
      setFocusedInlineMessageId(result.messageId)
    }
    setOpeningSearchResultId('')
    setIsMessageSearchOpen(false)
  }

  async function loadOlderMessagesWithScrollAnchor() {
    const list = messageListRef.current
    const previousHeight = list?.scrollHeight ?? 0
    const previousTop = list?.scrollTop ?? 0

    if (isServerMessagePagingEnabled) {
      const didLoad = await onLoadOlderMessages(conversation.id)
      if (didLoad && list) {
        window.requestAnimationFrame(() => {
          list.scrollTop = previousTop + (list.scrollHeight - previousHeight)
        })
      }
      return
    }

    setVisibleMessageCount((count) => count + MESSAGE_LOAD_STEP)
    if (list) {
      window.requestAnimationFrame(() => {
        list.scrollTop = previousTop + (list.scrollHeight - previousHeight)
      })
    }
  }

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

      <div className={`connection-status ${connectionStatus}`} role="status">
        <span>{formatConnectionStatus(connectionStatus)}</span>
      </div>

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
          <SearchFilterBar
            filters={messageSearchFilters}
            onChange={setMessageSearchFilters}
            query={messageSearchQuery}
            scope="conversation"
            senderOptions={senderOptions}
          />
          {messageSearchQuery.trim() && (
            <div className="inline-results">
              <strong>
                {isMessageSearchLoading
                  ? '正在搜索...'
                  : `当前会话 · 已显示 ${messageSearchResults.length} 条结果`}
              </strong>
              {serverMessageSearchPage.error && (
                <div className="search-error compact" role="alert">
                  <span>{serverMessageSearchPage.error}</span>
                  <button
                    onClick={() => {
                      void retryConversationSearch()
                    }}
                    type="button"
                  >
                    重试
                  </button>
                </div>
              )}
              {!canRunMessageSearch ? (
                <p className="search-scope-note">中文 1 个字即可搜索；英文或数字请至少输入 2 个字符。</p>
              ) : isServerMessagePagingEnabled ? (
                <p className="search-scope-note">正在搜索当前会话的已保存消息。</p>
              ) : hasOlderMessages && (
                <p className="search-scope-note">当前只搜索已加载消息。可先加载更早消息后再搜索。</p>
              )}
              {!isMessageSearchLoading && canRunMessageSearch && messageSearchResults.length === 0 ? (
                <p>没有找到匹配的消息。</p>
              ) : !isMessageSearchLoading && canRunMessageSearch ? (
                messageSearchResults.map((result) => (
                  <button
                    aria-label={`当前会话搜索结果：${result.snippet}`}
                    className="inline-result-row"
                    key={result.id}
                    disabled={openingSearchResultId === result.id}
                    onClick={() => {
                      void openMessageSearchResult(result)
                    }}
                    type="button"
                  >
                    <span>
                      <HighlightedText query={messageSearchQuery} text={result.snippet} />
                    </span>
                    <small>
                      {openingSearchResultId === result.id
                        ? '正在定位...'
                        : `${searchResultTypeText(result)} · ${result.senderName} · ${formatTime(result.createdAt)}`}
                    </small>
                  </button>
                ))
              ) : null}
              {canRunMessageSearch && serverMessageSearchPage.hasMore && (
                <>
                  <p className="search-scope-note">还有更多当前会话结果，可继续加载或缩小筛选范围。</p>
                  <button
                    className="search-load-more compact"
                    disabled={isServerMessageSearchLoadingMore}
                    onClick={() => {
                      void loadMoreConversationSearchResults()
                    }}
                    type="button"
                  >
                    {isServerMessageSearchLoadingMore ? '正在加载...' : '加载更多结果'}
                  </button>
                </>
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

      <div className="message-list" ref={messageListRef} role="log">
        {messages.length === 0 ? (
          <EmptyState
            icon={<MessageCircle size={28} />}
            title="暂无消息"
            body="发送第一条消息，开始这段对话。"
          />
        ) : (
          <>
            {hasOlderMessages && (
              <div className="message-window-controls">
                <button
                  className="ghost-button compact-button"
                  disabled={isLoadingOlderMessages}
                  onClick={() => {
                    void loadOlderMessagesWithScrollAnchor()
                  }}
                  type="button"
                >
                  {isLoadingOlderMessages ? '正在加载...' : '加载更早消息'}
                </button>
                <small>
                  {isServerMessagePagingEnabled
                    ? `已加载 ${visibleMessages.length} 条消息`
                    : `已显示最近 ${visibleMessages.length} / ${messages.length} 条消息`}
                </small>
              </div>
            )}
            {visibleMessages.map((message) => (
              <MessageBubble
                canDelete={canDeleteGroupMessageFromView(
                  conversation,
                  conversationMembers,
                  message,
                  myUserId,
                )}
                canPin={conversation.type === 'group' && isGroupManager && !message.deletedAt}
                isMine={message.senderId === myUserId}
                isHighlighted={highlightedMessageId === message.id}
                isPinned={conversation.pinnedMessageId === message.id}
                key={message.id}
                message={message}
                messageRef={(node) => {
                  messageRefs.current[message.id] = node
                }}
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
            ))}
          </>
        )}
      </div>

      {(authNotice || sendBlockReason || connectionBlockReason) && (
        <p className="notice chat-notice">{authNotice || sendBlockReason || connectionBlockReason}</p>
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
          placeholder={sendBlockReason || connectionBlockReason || '输入消息'}
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

function searchResultTypeText(result: SearchResult) {
  if (result.kind === 'conversation') return '会话'
  if (result.messageType === 'image') return '图片'
  if (result.messageType === 'video') return '视频'
  if (result.messageType === 'file') return '文件'
  return '消息'
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
  isHighlighted,
  isPinned,
  message,
  messageRef,
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
  isHighlighted: boolean
  isMine: boolean
  isPinned: boolean
  message: Message
  messageRef: (node: HTMLElement | null) => void
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
    <article
      className={`message ${isMine ? 'mine' : 'theirs'} ${message.deletedAt ? 'deleted' : ''} ${
        isHighlighted ? 'highlighted' : ''
      }`}
      ref={messageRef}
    >
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

function formatConnectionStatus(status: ConnectionStatus) {
  if (status === 'connecting') return '连接中'
  if (status === 'reconnecting') return '正在重连'
  if (status === 'offline') return '离线'
  return '已连接'
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


export default App
