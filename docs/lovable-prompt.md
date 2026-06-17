# Lovable Prompt

Build a Telegram-style mobile PWA chat app MVP using this repository as the product and engineering spec.

Use React, TypeScript, Supabase Auth, Supabase Postgres, Supabase Realtime, and Supabase Storage. Keep the UI mobile-first and close to the screens described in `docs/figma-brief.md`. Do not copy Telegram branding, logos, or proprietary assets.

## Required MVP
- Email/password sign-up and sign-in.
- Profile editing with display name and bio.
- Chat list with search, recent conversations, last message, unread count.
- Direct chat and group chat views.
- Realtime text messages.
- File/image attachment upload to the `chat-uploads` bucket.
- Group info screen with member list and permissions entry.
- PWA-ready layout and manifest.

## Data Model
Use the migration in `supabase/migrations/20260616000000_chat_mvp.sql` as the source of truth. Do not weaken RLS policies. Add new tables only when the MVP cannot work without them.

## Done When
- The app runs locally with `npm run dev`.
- `npm run build`, `npm run lint`, and `npm run test` pass.
- Supabase RLS is enabled on all user data tables.
- Non-members cannot read conversation messages.
- The app can be deployed on Vercel with only the Supabase environment variables.
