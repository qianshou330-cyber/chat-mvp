# Chat MVP

Telegram-style mobile PWA MVP for chat, built with React, TypeScript, Vite, Supabase, and a demo fallback mode.

Production beta URL: `https://chat-mvp-tau.vercel.app`

Current track: `v0.1-beta` small external test preparation.

## What Is Included

- Mobile-first chat UI with login, chat list, add contact, direct chat, group info, and profile settings.
- Demo mode that works without backend credentials.
- Supabase client wiring for email/password Auth, Realtime messages, and Storage upload.
- Supabase schema, RLS, and direct-contact RPC migrations in `supabase/migrations`.
- Client-side attachment validation for allowed file types and 10 MB uploads.
- Private attachment download links generated through Supabase signed URLs.
- GitHub Actions CI and Vercel deployment configuration.
- PWA manifest and app icon.
- Figma and Lovable handoff docs in `docs/`.

## Local Development

```bash
npm install
npm run dev
```

The app runs in demo mode until Supabase variables are configured.

## Supabase Setup

1. Create a Supabase project.
2. Apply all SQL files in `supabase/migrations` in filename order.
3. Enable the Email Auth provider and turn off email confirmation for local MVP testing.
4. Copy `.env.example` to `.env.local`.
5. Fill in:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_CHAT_BUCKET=chat-uploads
```

Allowed attachment types are PNG, JPEG, WebP, PDF, plain text, and Markdown. The migration configures the private `chat-uploads` bucket with the same 10 MB limit used by the client.

## Verification

```bash
npm run lint
npm run test
npm run build
```

## Deployment

Deploy on Vercel and add the same Supabase environment variables. The project is PWA-ready and can be installed from supported mobile browsers.

Use `docs/deployment-checklist.md` before promoting a Preview deployment to Production.

## Beta Testing

Use `docs/beta-test-plan.md` for invited tester setup, feedback format, and smoke-test data cleanup notes.

Use GitHub Issues with the included Bug, Experience feedback, and Feature request templates.

Known beta limits: no end-to-end encryption, no native mobile app, no voice/video calls, no channels, no bots, no push notifications, and no full-text search yet.
