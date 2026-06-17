# Deployment Checklist

## GitHub
- Create the empty repository `qianshou330-cyber/chat-mvp`.
- Add it as `origin` and push `main`.
- Confirm GitHub Actions runs `lint`, `test`, and `build`.

## Supabase
- Create a Supabase project.
- Apply all SQL files in `supabase/migrations` in filename order.
- Enable the Email Auth provider.
- Turn off email confirmation for MVP testing, or configure production SMTP before enabling confirmation.
- Confirm RLS is enabled on all public user data tables.
- Confirm the private `chat-uploads` bucket exists.

## Vercel
- Import the GitHub repository.
- Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_SUPABASE_CHAT_BUCKET`.
- Confirm Preview and Production deployments finish successfully.
- Run a mobile browser smoke test on the production URL.

## Smoke Test
- Register or sign in with email and password.
- Create a profile.
- Add a registered user by email and open a direct chat.
- Create a group.
- Send a text message.
- Upload an allowed attachment under 10 MB.
- Confirm a non-member cannot read conversation rows in Supabase.
