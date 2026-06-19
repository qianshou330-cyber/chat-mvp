import { useState } from 'react'
import { Users } from 'lucide-react'
import type { Profile } from '../types'

export default function Avatar({
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
