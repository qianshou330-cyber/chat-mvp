import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

vi.stubEnv('VITE_SUPABASE_URL', '')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
vi.stubEnv('VITE_SUPABASE_CHAT_BUCKET', 'chat-uploads')
