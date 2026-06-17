# Deployment Checklist

## GitHub
- Create the empty repository `qianshou330-cyber/chat-mvp`.
- Add it as `origin` and push `main`.
- Confirm GitHub Actions runs `lint`, `test`, and `build`.

## Supabase
- Create a Supabase project.
- Apply `supabase/migrations/20260616000000_chat_mvp.sql`.
- Confirm RLS is enabled on all public user data tables.
- Confirm the private `chat-uploads` bucket exists.
- Add `http://localhost:5173` and the Vercel production URL to Auth redirect URLs.

## Vercel
- Import the GitHub repository.
- Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_SUPABASE_CHAT_BUCKET`.
- Confirm Preview and Production deployments finish successfully.
- Run a mobile browser smoke test on the production URL.

## Smoke Test
- Register or sign in with email.
- Create a profile.
- Create a group.
- Send a text message.
- Upload an allowed attachment under 10 MB.
- Confirm a non-member cannot read conversation rows in Supabase.
