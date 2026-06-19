import { createClient } from '@supabase/supabase-js'

export const supabaseProjectUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(supabaseProjectUrl && supabaseAnonKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseProjectUrl as string, supabaseAnonKey as string)
  : null

export const chatStorageBucket =
  (import.meta.env.VITE_SUPABASE_CHAT_BUCKET as string | undefined) ?? 'chat-uploads'

export const avatarStorageBucket =
  (import.meta.env.VITE_SUPABASE_AVATAR_BUCKET as string | undefined) ?? 'profile-avatars'

export const avatarVideoStorageBucket =
  (import.meta.env.VITE_SUPABASE_AVATAR_VIDEO_BUCKET as string | undefined) ??
  'profile-avatar-videos'

export const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
