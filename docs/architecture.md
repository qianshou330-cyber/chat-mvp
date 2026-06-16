# Architecture

## Stack
- React + TypeScript + Vite for the mobile PWA.
- Supabase Auth for email sign-in.
- Supabase Postgres for profiles, contacts, conversations, members, messages, read receipts, and attachments.
- Supabase Realtime for inserted messages.
- Supabase Storage for uploaded files.
- Vercel for deployment.

## Runtime Modes
- Demo mode: active when Supabase environment variables are missing. Uses local seeded data so the UI can be reviewed immediately.
- Supabase mode: active when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are configured.

## Security Model
- Every user data table has RLS enabled.
- Conversation and message reads are gated by `is_conversation_member`.
- Conversation and membership management is gated by `is_conversation_admin`.
- Users can only update their own profile and read receipts.
- Upload paths are scoped by authenticated user id.

## Next Production Tasks
- Add a server-side RPC for atomic direct chat creation.
- Add push notifications for PWA installs.
- Add full-text message search.
- Add signed URL handling for attachments shared inside conversations.
- Add Playwright tests for multi-user realtime flows.
