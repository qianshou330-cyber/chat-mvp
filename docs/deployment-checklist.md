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
- Set Auth Site URL to `https://chat-mvp-tau.vercel.app` for production.
- Confirm RLS is enabled on all public user data tables.
- Confirm the private `chat-uploads` bucket exists.
- Do not create or use Supabase secret keys for the frontend.

## Vercel
- Import the GitHub repository.
- Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_SUPABASE_CHAT_BUCKET`.
- Confirm Vercel does not contain Supabase secret keys, service-role keys, or database passwords.
- Confirm Preview and Production deployments finish successfully.
- Run a mobile browser smoke test on the production URL.

## Smoke Test
- Register or sign in with email and password.
- Create a profile.
- Add a registered user by email and open a direct chat.
- Create a group.
- Send a text message.
- Upload an allowed attachment under 10 MB.
- Open the uploaded attachment from another member account.
- Confirm a non-member cannot read conversation rows in Supabase.
- Confirm a non-member cannot read attachment metadata or create a signed download URL.

## Beta Release
- Tag the beta-ready commit as `v0.1-beta`.
- Use `docs/beta-test-plan.md` for tester instructions and issue triage.
- Collect feedback through GitHub Issue templates before prioritizing push notifications, search, and large-group work.
