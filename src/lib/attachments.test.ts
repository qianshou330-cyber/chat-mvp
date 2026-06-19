import { describe, expect, it } from 'vitest'
import {
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_AVATAR_VIDEO_SIZE_BYTES,
  validateAttachment,
  validateAvatar,
  validateAvatarVideo,
} from './attachments'

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
      reason: '仅支持 PNG、JPEG、WebP、MP4、WebM、PDF、纯文本和 Markdown 文件。',
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

describe('validateAvatar', () => {
  it('allows supported image avatars under 2 MB', () => {
    expect(validateAvatar({ size: 24_000, type: 'image/png' })).toEqual({ ok: true })
    expect(validateAvatar({ size: 24_000, type: 'image/jpeg' })).toEqual({ ok: true })
    expect(validateAvatar({ size: 24_000, type: 'image/webp' })).toEqual({ ok: true })
  })

  it('rejects oversized or unsupported avatars with Chinese errors', () => {
    expect(validateAvatar({ size: 2 * 1024 * 1024 + 1, type: 'image/png' })).toEqual({
      ok: false,
      reason: '头像不能超过 2 MB。',
    })
    expect(validateAvatar({ size: 24_000, type: 'text/plain' })).toEqual({
      ok: false,
      reason: '头像仅支持 PNG、JPEG 或 WebP。',
    })
  })
})

describe('validateAvatarVideo', () => {
  it('allows supported video avatars before automatic compression', () => {
    expect(validateAvatarVideo({ size: 48_000, type: 'video/mp4' })).toEqual({ ok: true })
    expect(validateAvatarVideo({ size: 48_000, type: 'video/webm' })).toEqual({ ok: true })
    expect(validateAvatarVideo({ size: MAX_AVATAR_VIDEO_SIZE_BYTES + 1, type: 'video/mp4' })).toEqual({
      ok: true,
    })
  })

  it('rejects unsupported video avatars with Chinese errors', () => {
    expect(validateAvatarVideo({ size: 48_000, type: 'video/quicktime' })).toEqual({
      ok: false,
      reason: '视频头像仅支持 MP4 或 WebM。',
    })
  })
})
