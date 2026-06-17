export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/markdown',
]

export const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024

export const AVATAR_MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

export type AttachmentValidationResult =
  | { ok: true }
  | { ok: false; reason: string }

export function validateAttachment(
  file: Pick<File, 'name' | 'size' | 'type'>,
): AttachmentValidationResult {
  if (file.size <= 0) {
    return { ok: false, reason: '选择的文件是空文件。' }
  }

  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return { ok: false, reason: '文件大小不能超过 10 MB。' }
  }

  if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.type)) {
    return {
      ok: false,
      reason: '仅支持 PNG、JPEG、WebP、PDF、纯文本和 Markdown 文件。',
    }
  }

  return { ok: true }
}

export function validateAvatar(
  file: Pick<File, 'size' | 'type'>,
): AttachmentValidationResult {
  if (file.size <= 0) {
    return { ok: false, reason: '请选择头像图片。' }
  }

  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    return { ok: false, reason: '头像不能超过 2 MB。' }
  }

  if (!AVATAR_MIME_EXTENSIONS[file.type]) {
    return { ok: false, reason: '头像仅支持 PNG、JPEG 或 WebP。' }
  }

  return { ok: true }
}

export function avatarFileExtension(file: Pick<File, 'type'>) {
  return AVATAR_MIME_EXTENSIONS[file.type] ?? 'png'
}
