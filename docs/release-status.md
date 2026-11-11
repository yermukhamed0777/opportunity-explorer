# Release checkpoint — 11 November 2026

The ProspectoAI release remains in draft. It is not yet a fully verified production release.

## Verified

- GitHub backup branch preserves `b287a5382c5adf33c7b7a789c048492fb2ee41c3`.
- Complete ProspectoAI source is saved on `feat/prospectoai`; PR #1 is a draft.
- 24 automated checks, the build, formatting and `git diff --check` pass.
- The dependency audit reports zero known vulnerabilities at the checkpoint.
- Preview HTML, frontend assets, logo, public configuration, feed and review endpoints respond successfully.
- Browser tests cover university search, skill filtering, career filtering, guest catalog chat, protected activity access and guest tracker notes after reload.
- A form navigation bug found in preview was fixed and rechecked.
- Supabase migrations `20261111055623_prospectoai_accounts` and `20261111072014_prospectoai_profiles_and_activity_controls` are applied.
- Supabase contains 58 source-backed public resource records, private workspace tables, ownership policies and an active weekly expiry job.
- Two-user RLS and daily quota checks passed inside a SQL transaction that was rolled back. No test identities or test activities were retained.

## Owner-dependent work and remaining checks

- Public email sign-ups and password recovery require Supabase production delivery and redirect configuration. Dashboard sign-in was not completed, and the connector does not expose those settings.
- AI generation needs a server-side `AI_GATEWAY_API_KEY`, or separately approved deployment OIDC. The live config currently reports AI generation unconfigured. Guest answers are labelled catalog search.
- Automatic approval review rejected enabling OIDC and reassigning the production alias to the older complete deployment. Neither action was performed. The original production URL therefore still points to the broken release at this checkpoint.
- Creation/use of a persistent synthetic login fixture was rejected. Full registration/login/logout/password recovery and signed-in browser flows remain unverified; the rollback-only policy checks are separate evidence.
- A complete narrow-viewport browser check and a live scheduled source-renewal run remain outstanding. Renewal logic is unit-tested, and schedules are configured; that is not the same as a successful production run.
- Vercel's GitHub import returned a provider rate limit twice. Preview files match the GitHub branch and carry its commit metadata, but automatic Git import is not verified.
- The release must not be merged into `main` or described as finished until the remaining checks pass.

See `recovery.md` for the missing frontend assets and the exact limitations of recovering screenshot-only external-editor changes. See `maintenance.md` for source review and renewal behavior.
