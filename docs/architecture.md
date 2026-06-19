# Architecture

## Stack
- React + TypeScript + Vite for the mobile PWA.
- Supabase Auth for email/password sign-up and sign-in.
- Supabase Postgres for profiles, contacts, conversations, members, messages, read receipts, and attachments.
- Supabase Realtime for inserted messages.
- Supabase Storage for uploaded files.
- Supabase Edge Functions and `pg_net`/Database Webhook trigger for Web Push delivery.
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
- Push notification payloads intentionally omit message body, attachment filename, and email.

## External References
- `docs/telegram-reference-evaluation.md` defines how DrKLO/Telegram may be used as a clean-room interaction reference.
- Do not copy Telegram source code, brand assets, logos, proprietary icons, translations, stickers, animations, MTProto, or Telegram API logic into this PWA.
- Reference is limited to product structure and interaction patterns such as chat list density, media viewer behavior, upload progress, group details, and group permission flows.

## Next Production Tasks
- Finish v0.5.4 group permission detail polish and production smoke before tagging `v0.5.4-beta`.
- Keep using `docs/telegram-reference-evaluation.md` as the clean-room boundary for group permission and media UX polish.
- Continue v0.5.x with media viewer, upload progress, group file, and message governance refinements.
- Add server-side search only after client search reaches real data limits.
- Add Playwright tests for multi-user realtime flows.
