# v0.1 Beta Release Notes

## Status

`v0.1-beta` is the first small external test release for Chat MVP.

Production URL: `https://chat-mvp-tau.vercel.app`

## Included

- Email and password registration/sign-in.
- Profile display name and bio editing.
- Direct chat through Add contact by registered email.
- Group creation.
- Realtime text messages.
- Private attachment uploads with Supabase signed download URLs.
- Mobile-first PWA shell with installable manifest and service worker.

## Security Baseline

- Supabase RLS is enabled for user-facing tables.
- Storage bucket is private.
- Attachment reads use signed URLs.
- Vercel contains only public frontend environment variables.
- No active Supabase secret key is required by the frontend.

## Not Included

- End-to-end encryption.
- Voice/video calls.
- Channels, bots, or large-public-group tooling.
- Push notifications.
- Message search.
- Native mobile apps.

## Release Checklist

- Local `npm run lint`, `npm run test`, and `npm run build` pass.
- GitHub Actions CI passes on `main`.
- Vercel Production deploys from `main`.
- Production smoke test passes for auth, direct chat, group, message, and attachment.
- Third non-member account cannot read private direct chat rows or attachment metadata.

