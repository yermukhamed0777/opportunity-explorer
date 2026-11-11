# Release verification

Version 4.0 adds the development workspace without removing original tracker or account data. See [architecture and test boundaries](development-workspace.md) and [auth/domain configuration](auth-routing-and-domains.md).

- Local build and 40 automated tests pass, including real PDF/DOCX text extraction and DOM workflows using an in-memory adapter.
- Transaction-only connected-database tests pass for two-user isolation, foreign document/plan rejection, anonymous grants, private bucket policies and weekly plan budgets. No test users remain.
- Production dependencies have no npm audit findings at the time of review.
- Source data and idempotent Supabase seed contain 131 catalog records with source/review metadata. They are not 131 currently open opportunities.
- Hosted authentication requires confirmation. Custom SMTP, a new canonical custom domain, server-side account deletion credentials and owner inbox/password-change testing remain owner actions.
- Live model generation, private Storage network operations and the full confirmation/recovery sequence must be marked passed only after an owner-controlled login is used. Configuration flags and local tests do not establish these outcomes.

Release procedure: review diff and credentials → save reviewed source through GitHub → pass CI → merge main → deploy that exact merged source with latest environment → compare deployment metadata and source hashes → verify stable production routes and anonymous API denial → complete owner-controlled signed-in checks.

Deployment identifiers belong to the Vercel deployment metadata; use its `githubCommitSha` to identify the exact source revision. Never restore an older Opportunity Explorer deployment to publish this release.
