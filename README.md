# Chat MVP

Telegram-style mobile PWA MVP for chat, built with React, TypeScript, Vite, Supabase, and a demo fallback mode.

## What Is Included

- Mobile-first chat UI with login, chat list, direct chat, group info, and profile settings.
- Demo mode that works without backend credentials.
- Supabase client wiring for Auth, Realtime messages, and Storage upload.
- Supabase schema and RLS migration in `supabase/migrations`.
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
2. Apply `supabase/migrations/20260616000000_chat_mvp.sql`.
3. Copy `.env.example` to `.env.local`.
4. Fill in:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_CHAT_BUCKET=chat-uploads
```

## Verification

```bash
npm run lint
npm run test
npm run build
```

## Deployment

Deploy on Vercel and add the same Supabase environment variables. The project is PWA-ready and can be installed from supported mobile browsers.
