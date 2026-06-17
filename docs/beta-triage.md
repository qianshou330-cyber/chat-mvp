# v0.1 Beta Triage Guide

## Triage Cadence

Review new issues once per test day.

Recommended order:

1. Blocking bugs.
2. Security or permission reports.
3. Reproducible attachment/message delivery issues.
4. Experience feedback.
5. Feature requests.

## Labels

Use the repository default labels:

- `bug`: broken behavior or failed acceptance path.
- `question`: experience feedback that needs discussion.
- `enhancement`: feature request or v0.2 candidate.
- `documentation`: tester instructions, release notes, or summary updates.

## Severity

| Severity | Meaning | Example |
| --- | --- | --- |
| P0 | Blocks beta for most testers | Cannot register, cannot sign in, production app blank |
| P1 | Blocks a core chat path | Messages fail, Add contact fails, attachment cannot open |
| P2 | Usability problem | Confusing copy, awkward layout, unclear empty state |
| P3 | Later improvement | Search, push notifications, richer profiles |

Add the severity at the top of the issue body if labels are not available:

```md
Severity: P1
Area: Direct chat
Status: Needs reproduction
```

## Reproduction Standard

For a bug to be ready to fix, capture:

- Tester label.
- Device and browser.
- Production URL used.
- Exact steps.
- Expected result.
- Actual result.
- Screenshot or recording when visual.

If the issue is about permissions, also capture whether the account is a conversation member.

## Fix Flow

Every fix should follow this sequence:

1. Reproduce locally or in production with a test account.
2. Patch the smallest affected area.
3. Run `npm run lint`, `npm run test -- --run`, and `npm run build`.
4. Push to `main`.
5. Wait for GitHub Actions.
6. Smoke test production after Vercel deploys.
7. Comment on the issue with what was verified.

## v0.2 Candidate Scoring

Use this score when at least 10 feedback items exist.

| Factor | Score |
| --- | --- |
| Blocks current beta path | 3 |
| Mentioned by 2 or more testers | 2 |
| Reduces support or confusion | 2 |
| Enables a clear next user story | 2 |
| High implementation risk | -2 |

Default candidates:

1. Push notifications.
2. Message search.
3. Contact request approval.
4. Large group experience improvements.

