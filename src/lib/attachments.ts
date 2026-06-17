export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/markdown',
]

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
