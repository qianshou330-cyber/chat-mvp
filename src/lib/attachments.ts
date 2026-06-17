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
    return { ok: false, reason: 'The selected file is empty.' }
  }

  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return { ok: false, reason: 'Files must be 10 MB or smaller.' }
  }

  if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.type)) {
    return {
      ok: false,
      reason: 'Only PNG, JPEG, WebP, PDF, plain text, and Markdown files are allowed.',
    }
  }

  return { ok: true }
}
