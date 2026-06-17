# Chat MVP v0.1 Beta Test Plan

## Release Snapshot

- Version: `v0.1-beta`
- Production URL: `https://chat-mvp-tau.vercel.app`
- Baseline tag: `v0.1-beta`
- Primary branch: `main`
- Target testers: 3 to 5 invited users
- Tracking issue: https://github.com/qianshou330-cyber/chat-mvp/issues/1

## Tester Setup

Ask each tester to create an account with email and password on the production URL. Email confirmation is currently disabled for MVP testing.

Recommended tester path:

1. Create an account.
2. Update display name in profile.
3. Add another registered tester by email.
4. Send direct text messages.
5. Create a group.
6. Upload one allowed attachment under 10 MB.
7. Sign out and sign back in.

## Feedback Format

Use GitHub Issues and pick one template:

- Bug: broken or blocked behavior.
- Experience feedback: confusing, slow, unclear, or awkward behavior.
- Feature request: a capability to consider after beta.

Each issue should include:

- Tester email or tester label.
- Device and browser.
- What they expected.
- What happened.
- Screenshot or screen recording when useful.

Use `docs/beta-outreach.md` for the tester invite message and checklist.
Use `docs/beta-triage.md` to classify issues.
Use `docs/beta-feedback-summary.md` after at least 10 feedback items are collected.

## Known Limits

- No end-to-end encryption.
- No native iOS or Android app.
- No voice calls, video calls, channels, or bots.
- No push notifications or full-text search yet.
- Contacts are accepted immediately; there is no friend-request approval flow.

## Production Smoke Data

Production smoke tests may create temporary users and conversations with email prefixes like `codex-smoke-`. Keep them if they are useful for debugging. To clean them up, use the Supabase dashboard:

1. Authentication -> Users: filter `codex-smoke-` and delete the test users.
2. Storage -> `chat-uploads`: remove folders owned by deleted smoke-test users if any remain.
3. Table Editor: confirm related `profiles`, `contacts`, `conversation_members`, `messages`, and `attachments` rows are gone or harmless.

Do not create or restore Supabase secret keys for cleanup. Use the dashboard owner session instead.
