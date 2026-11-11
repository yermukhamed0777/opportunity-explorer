# Product expansion checklist

Baseline: GitHub main `d3ad28053becf1f0138c60ef2c8ed67e8dad1eea`, deployed Production `dpl_GLZzM8PvJrTuVKUUDiT6Wmf4nR9a` on 11 November 2026. This document records the implementation and validation work; unchecked items are not claims of completion.

## Inspection

- [x] Read the complete expansion specification.
- [x] Inspect source, routes, build and existing migrations.
- [x] Inspect connected Supabase tables and Storage (no buckets at baseline).
- [x] Confirm Production identifies the current main commit.
- [x] Compare deployed source-file hashes against GitHub.
- [x] Recheck environment capability flags and production login gate without retrieving secrets. Existing hosted auth URL configuration is recorded; new-origin and real email flows require owner testing.

## Data and product foundation

- [x] Central education-stage, major/career, goal and experience taxonomy.
- [x] Distinct, sourced skill maps for every supported field; skill evidence and status.
- [x] Verify a manageable course collection and add course progress.
- [x] Expand international opportunities with explicit status/uncertainty and official sources.
- [x] University capability comparison for up to four institutions.
- [x] Evidence-based illustrative pathway examples.

## Private workspace

- [x] Versioned migration: preferences, profile records, user skills, courses, documents, plans/items, searches and recent views.
- [x] Owner-only RLS, constraints, indexes and private Storage policies.
- [x] Skippable multi-step onboarding; editable development profile.
- [x] Private upload, validation, signed download, replacement and deletion.
- [x] Real text parsing with an editable review before any extracted profile data is saved.
- [x] Transparent profile-strength categories and explained recommendations.
- [x] Editable plans with milestones, dependencies, reordering and enforced weekly budgets.
- [x] Personalized dashboard, progress, saved searches, recent items and reminder preferences.

## AI, privacy and interface

- [x] Ground AI in actual records, selected context and explicitly permitted profile evidence.
- [x] Review AI plan suggestions before saving; no automatic writes or fabricated fallback AI.
- [x] Export data, clear history and control profile information supplied to AI.
- [x] Account deletion implementation with reauthentication; identify any required owner-only server credential.
- [x] Original restrained chameleon mascot, consistent branding and accessible responsive controls.
- [x] Preserve all existing tracker data, auth routes, activities and provider facts.

## Release

- [x] Test auth/callbacks, authorization, file validation/parsing, plan budget, recommendations and core workflows.
- [x] Run database/Storage isolation tests without retaining synthetic users.
- [x] Build, formatting/lint, dependency audit, diff and secret review.
- [x] Save migrations and apply to the connected project; verify advisors and grants.
- [ ] Save reviewed source to GitHub, pass CI, deploy exact source commit and smoke-test Production.
- [ ] Check safe clean Vercel alias; preserve working original URL.
- [x] Prepare www.prospectoai.com DNS instructions; do not purchase or attach an unowned domain.
- [ ] Report exact implementation counts, evidence, deployment identifiers and genuine owner actions.

Live owner inbox, password change, real signed-in AI and Storage network checks remain pending. Automated DOM tests use an in-memory adapter and are not a substitute for those checks. Account deletion requires a server-only owner key.
