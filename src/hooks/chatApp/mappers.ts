import { chatStorageBucket, supabase } from '../../lib/supabase'
import type {
  AdminActivityAction,
  AdminActivityLog,
  AppErrorEvent,
  AppErrorModule,
  ContactRequest,
  ContactStatus,
  Conversation,
  DeviceSession,
  Message,
  Profile,
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
} from '../../types'
import { isRecord, sanitizeLogContext } from './logging'
import { conversationLastMessageText } from './state'

const SIGNED_ATTACHMENT_URL_EXPIRES_SECONDS = 60 * 60

export function mapProfile(row: Record<string, unknown>): Profile {
  const avatarVideoUrl = String(row.avatar_video_url ?? '')
  const avatarVideoPosterUrl = String(row.avatar_video_poster_url ?? '')

  return {
    id: String(row.id),
    displayName: String(row.display_name ?? '成员'),
    avatarUrl: String(row.avatar_url ?? ''),
    avatarMediaType: row.avatar_media_type === 'video' || avatarVideoUrl ? 'video' : 'image',
    avatarVideoUrl,
    avatarVideoPosterUrl,
    avatarVideoUpdatedAt: String(row.avatar_video_updated_at ?? ''),
    avatarTone: (row.avatar_tone as Profile['avatarTone']) ?? 'blue',
    bio: String(row.bio ?? ''),
    status: (row.status as Profile['status']) ?? 'offline',
    lastSeen: String(row.last_seen ?? new Date().toISOString()),
  }
}

export function mapContact(row: Record<string, unknown>, currentUserId: string): ContactRequest {
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

export function mapWorkspace(row: Record<string, unknown>): Workspace {
  return {
    id: String(row.id),
    name: String(row.name ?? '我的工作区'),
    createdBy: String(row.created_by ?? ''),
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  }
}

export function mapWorkspaceMember(row: Record<string, unknown>): WorkspaceMember {
  return {
    workspaceId: String(row.workspace_id),
    userId: String(row.user_id),
    role: (row.role as WorkspaceRole) ?? 'member',
    joinedAt: String(row.joined_at ?? new Date().toISOString()),
  }
}

export function mapDeviceSession(row: Record<string, unknown>): DeviceSession {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    deviceId: String(row.device_id),
    deviceName: String(row.device_name ?? '当前设备'),
    browserName: String(row.browser_name ?? '浏览器'),
    platform: String(row.platform ?? 'Web'),
    lastSeenAt: String(row.last_seen_at ?? new Date().toISOString()),
    revokedAt: String(row.revoked_at ?? ''),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  }
}

export function mapAppErrorEvent(row: Record<string, unknown>): AppErrorEvent {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id ?? ''),
    userId: String(row.user_id ?? ''),
    module: (row.module as AppErrorModule) ?? 'messages',
    message: String(row.message ?? '发生错误'),
    context: isRecord(row.context) ? sanitizeLogContext(row.context) : {},
    createdAt: String(row.created_at ?? new Date().toISOString()),
  }
}

export function mapAdminActivityLog(row: Record<string, unknown>): AdminActivityLog {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id ?? ''),
    actorId: String(row.actor_id ?? ''),
    targetUserId: String(row.target_user_id ?? ''),
    action: (row.action as AdminActivityAction) ?? 'member_added',
    result: row.result === 'failure' ? 'failure' : 'success',
    details: isRecord(row.details) ? sanitizeLogContext(row.details) : {},
    createdAt: String(row.created_at ?? new Date().toISOString()),
  }
}

export function mapConversation(
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
    workspaceId: row.workspace_id ? String(row.workspace_id) : undefined,
    memberIds,
    memberCount: memberIds.length,
    unreadCount: 0,
    updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
    lastMessage: conversationLastMessageText(latestMessage),
    announcement: String(row.announcement ?? ''),
    pinnedMessageId: row.pinned_message_id ? String(row.pinned_message_id) : undefined,
    isMuted: Boolean(row.is_muted),
  }
}

export async function mapMessage(row: Record<string, unknown>): Promise<Message> {
  const attachment = row.attachments as Record<string, unknown> | null
  const deletedAt = row.deleted_at ? String(row.deleted_at) : undefined
  const attachmentDeletedAt = attachment?.deleted_at ? String(attachment.deleted_at) : undefined

  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    senderId: String(row.sender_id),
    body: String(row.body ?? ''),
    type: (row.message_type as Message['type']) ?? 'text',
    status: (row.status as Message['status']) ?? 'sent',
    createdAt: String(row.created_at),
    deletedAt,
    deletedBy: row.deleted_by ? String(row.deleted_by) : undefined,
    deleteReason: row.delete_reason ? String(row.delete_reason) : undefined,
    attachment: attachment && !deletedAt
      ? {
          id: String(attachment.id),
          fileName: String(attachment.file_name),
          mimeType: String(attachment.mime_type),
          sizeBytes: Number(attachment.size_bytes ?? 0),
          url: attachmentDeletedAt ? '#' : await createSignedAttachmentUrl(attachment),
          deletedAt: attachmentDeletedAt,
          deletedBy: attachment.deleted_by ? String(attachment.deleted_by) : undefined,
          deleteReason: attachment.delete_reason ? String(attachment.delete_reason) : undefined,
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
