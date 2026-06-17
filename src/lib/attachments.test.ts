import { describe, expect, it } from 'vitest'
import { MAX_ATTACHMENT_SIZE_BYTES, validateAttachment } from './attachments'

describe('validateAttachment', () => {
  it('accepts allowed image files within the size limit', () => {
    expect(
      validateAttachment({
        name: 'preview.png',
        size: 1024,
        type: 'image/png',
      }),
    ).toEqual({ ok: true })
  })

  it('rejects unsupported file types', () => {
    expect(
      validateAttachment({
        name: 'payload.exe',
        size: 1024,
        type: 'application/x-msdownload',
      }),
    ).toEqual({
      ok: false,
      reason: '仅支持 PNG、JPEG、WebP、PDF、纯文本和 Markdown 文件。',
    })
  })

  it('rejects files above 10 MB', () => {
    expect(
      validateAttachment({
        name: 'large.pdf',
        size: MAX_ATTACHMENT_SIZE_BYTES + 1,
        type: 'application/pdf',
      }),
    ).toEqual({ ok: false, reason: '文件大小不能超过 10 MB。' })
  })
})
