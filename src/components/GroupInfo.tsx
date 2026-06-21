import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  ArrowLeft,
  FileText,
  Image as ImageIcon,
  Settings,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  Video,
} from 'lucide-react'
import Avatar from './Avatar'
import {
  displayConversationTitle,
  formatAdminActivity,
  formatErrorModule,
  formatFileSize,
  formatGroupRole,
  formatShortDateTime,
  formatStatus,
  formatTime,
} from '../lib/uiFormat'
import type {
  AdminActivityLog,
  AppErrorEvent,
  Conversation,
  ConversationMember,
  MemberRole,
  Message,
  Profile,
  Workspace,
} from '../types'

export default function GroupInfo({
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
          <h1>{title}</h1>
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
          <section className="group-section trial-health-card" aria-label="运行状态">
            <div className="workspace-card-header">
              <ShieldCheck size={24} />
              <span>
                <strong>运行状态</strong>
                <p>管理员用于上线后快速查看错误、通知和文件状态。</p>
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
