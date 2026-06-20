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
- Keep GitHub Actions green, confirm Vercel Production app/PWA assets, and use Chrome production smoke for real Supabase permission checks.
- Keep `docs/v0.7.7-search-trial-health-report.md` as the current search production-health record: GitHub Issues feedback status, sanitized app-error summary, A/B/C production smoke, and temporary data cleanup are complete for `codex.v077.*` / `codex-v077-*`.
- Continue using `docs/test-data-cleanup-sop.md` for `codex.v073.*` through `codex.v077.*` and matching `codex-v073-*` through `codex-v077-*` temporary data.
- Use `docs/v0.6.9-trial-feedback-report.md` for real company-trial feedback; P0/P1 fixes must stay minimal and pass local checks, CI, Vercel deploy, and Chrome production smoke.
- Keep using `docs/telegram-reference-evaluation.md` as the clean-room boundary for Telegram-style chat and detail page polish.
- Keep v0.6 focused on production trial readiness, member invitation, trial inspection, permission regression, media performance, and mobile stability rather than new headline features.
- v0.7.0 introduces server-backed message pagination and message search through `get_conversation_messages` and `search_messages`; v0.7.1 adds search-result context loading through `get_conversation_message_context`; v0.7.2 adds lightweight type, sender, and date filters through `search_messages_v2`; v0.7.3 adds cursor-based search-result pagination through `search_messages_v3`; v0.7.4 adds performance indexes and sanitized search error observability; v0.7.5 adds search scope/result-count UX and feedback convergence documentation; v0.7.6 closes search empty/completed states and preserved-result return behavior; v0.7.7 records search production health and real-feedback status.
- Defer deeper nested hook extraction until a later patch, after company-trial feedback confirms no data-flow regressions.
- Evaluate a dedicated enterprise search service only after the v0.7 contains-search approach reaches real data limits.
- Keep real Supabase multi-user Realtime and RLS checks in Chrome production smoke; never store production credentials in CI or the repository.
