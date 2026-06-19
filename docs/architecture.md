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
- `docs/telegram-reference-evaluation.md` defines how DrKLO/Telegram and Telegram-style Figma references may be used as clean-room interaction references.
- Do not copy Telegram source code, brand assets, logos, proprietary icons, translations, stickers, animations, MTProto, or Telegram API logic into this PWA.
- Reference is limited to product structure and interaction patterns such as chat list density, profile/settings grouping, media viewer behavior, upload progress, group details, and group permission flows.

## Next Production Tasks
- Finish the v0.6.8 real production trial launch gate: run A/B/C Chrome smoke with `codex.v068.*@example.com` temporary accounts and record the result in `docs/v0.6.8-production-smoke.md`.
- Keep GitHub Actions green, confirm Vercel Production app/PWA assets, and clean `codex.v068.*` / `codex-v068-*` temporary data through `docs/test-data-cleanup-sop.md`.
- Launch the 20-30 person company trial only after the v0.6.8 smoke has no P0/P1 and the administrator invitation copy is ready.
- Keep using `docs/telegram-reference-evaluation.md` as the clean-room boundary for Telegram-style chat and detail page polish.
- Keep v0.6 focused on production trial readiness, member invitation, trial inspection, permission regression, media performance, and mobile stability rather than new headline features.
- Defer service-side pagination and deeper nested hook extraction until a later v0.6.x patch, after company-trial feedback confirms no data-flow regressions.
- Add server-side search only after client search reaches real data limits.
- Keep real Supabase multi-user Realtime and RLS checks in Chrome production smoke; never store production credentials in CI or the repository.
