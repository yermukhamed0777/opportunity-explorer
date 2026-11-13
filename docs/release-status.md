# ProspectoAI 5 release verification

The expansion connects Explore, Build Your Profile, Professional Pathways, Admissions and Universities, and My Plan. GitHub remains the source of truth; a release must deploy the exact merged commit. No rollback to Opportunity Explorer is part of this release.

## Phase 1 technical fixes · 13 November 2026

Implementation base: merged main commit `8410c2ab936eee0be7ad062b76fdd3eb910cb647` (PRs #4–#9). Phase 1 implementation commit `c5f2fe02ab91e958c47865d43f020ab0ee4b519a` is saved in [PR #10](https://github.com/yermukhamed0777/opportunity-explorer/pull/10), on `codex/phase-1-critical-fixes`. [GitHub CI run 50](https://github.com/yermukhamed0777/opportunity-explorer/actions/runs/43357117038) passed for that implementation. Its release is merged only after passing CI; the exact final merge commit and deployment are recorded in the PR/release handoff and Vercel metadata rather than a self-referential commit hash here.

Phase 1 makes local startup load optional `.env.local` settings and build missing bundles before listening; incomplete public account settings produce a safe setup banner with disabled forms. Configuration rejects privileged or unrecognized browser keys. Chat separates invalid input (400), known service outages (503) and unexpected server errors (500); 503 catalog fallbacks remain usable in the existing chat screen. Chat, public capability reporting and plan drafting share the same API-key-or-OIDC availability rule. Quota, consent, authentication, sanitized diagnostics and review-before-save protections remain intact. No layout or color-system changes are included.

The current suite contains **76 tests**: the prior 63 plus configuration/secret-isolation, clean local startup, chat status/fallback and OIDC drafting regressions. Local Phase 1 validation passed build, lint, scoped strict type checking, all 76 tests and formatting; the complete dependency audit found zero vulnerabilities. Production verification covers the original routes, signed-out API denial, private catalog paths, exact deployed asset hashes and signed-in health. Vercel’s pre-existing `customer_verification_required` restriction remains an account setup limitation; these fixes do not claim successful AI generation.

## Earlier production continuation · 13 November 2026

The expansion and corrective releases are merged in PRs #4–#7. Actual Vercel builds exposed overlapping function rules, which are fixed. Signed-in browser testing exposed tracker writes to removed navigation counters, which are fixed and covered by a combined-page regression test. At that release, all 63 automated tests passed with build, ESLint, strict calendar-module checking and formatting; the production dependency audit has zero findings.

Production checks passed for 13 routes, nine anonymous API denials, five inaccessible catalog paths, and all 17 built static asset hashes. Owner sign-in/session restoration, administrator health, private DOCX upload, real extraction, unselected review entries, AI consent defaults, expiring private download and approved test-file deletion were verified live. The test document and extracted text were removed; no fictional evidence was saved to the user's profile. Mobile 390px navigation, comparison, notifications, keyboard command search, Escape and focus restoration were checked. Database isolation suites passed in rollback-only transactions, and original user record counts remain intact.

Safe AI diagnostics established `customer_verification_required` from the actual authenticated request. Gemini is a valid public model but ineligible under this team's settings. The selected replacement, `openai/gpt-4.1-nano`, is eligible; account-wide generation still requires owner verification. The bounded backup requires explicit team availability and does not bypass authentication, billing, regional restrictions or quota. Successful AI text generation and reviewed AI plan generation must be retested after owner verification. Full email confirmation/recovery, SMTP delivery and account deletion remain unverified; deletion still requires the server-only owner credential. The original Vercel URL remains active.

The daily Vercel checker ran on 13 November; its latest report checked 120 sources and recorded 107 failed checks for review. Failures did not replace published facts. Both recent daily Supabase expiry runs succeeded. Source fingerprints are not independent factual verification.

The complete dependency audit also found a development-only minimatch advisory. Pinning the patched `11.0.8` release preserves the working ESLint configuration; all release checks pass. The full audit now reports zero findings, and GitHub CI audits development dependencies as well as production dependencies.

## Baseline evidence before the initial expansion deployment

- Build, ESLint, formatting and 55 Node tests pass. Tests include real PDF/DOCX extraction, recovery callback handling, anonymous API denial, budget validation, content/date validation, failed-import retention and DOM workflows with an in-memory database adapter.
- TypeScript checks the shared production calendar/timezone validation module (`lib/dates.js`) with strict JavaScript checking. The application remains JavaScript; this is not a claim that the entire legacy application has TypeScript coverage.
- Production dependencies have zero npm audit findings at release review.
- Connected, rollback-only SQL tests pass for admissions-folder/essay/evidence ownership, cross-owner document references, admin denial, version conflicts, correction/archive/restore history, the null-revision guard and atomic project-evidence saving. No fixture login or account is retained.
- Three additive migrations extend the five baseline migrations. Existing user plans, preferences, activities, tracker and profile records are retained.

## Content and research boundaries

The initial expanded seed contains 560 records: 280 official courses/open learning resources, 22 universities, 25 public-work/leadership profiles, 23 funding records, 24 other programmes, 100 editorial portfolio-project ideas, 33 editorial research ideas, 33 illustrative pathways, 13 fictional CV formats and seven location planning guides. The 33 field maps contain 516 editorial skills.

Only two funding records have reviewed current-open application evidence. Five programme records describe upcoming cycles, 39 programme/funding records have unannounced or expected cycles, and one is closed. These are not 47 open vacancies. Ten normalized geographic regions are represented; worldwide listings are not counted as another geographic region.

Eighteen uncertain records remain staged. Mature targets of 75 universities, 250 opportunities and 50 funding records have not been reached; the specification permits the strongest verified subset with an update pipeline. No numerical filler has been added. Twenty-one public-work profiles are limited to award/work/affiliation facts; their education or full career histories are explicitly unestablished. Four leadership profiles include broader public career context. Editorial examples never imply a real person's endorsement, completed user work or proven research novelty.

Costs are sourced planning estimates only where established. Country guides identify missing details rather than inventing city-level facts or visa entitlements. Official course availability does not establish a free certificate or professional accreditation.

## Live boundaries requiring honest reporting

Owner sign-in/session restoration and private Storage upload/extraction/review/download/test-file deletion were verified live. Full signup → email confirmation → login → recovery → new password, actual model generation and account deletion still require owner-controlled validation. Configuration flags and DOM tests cannot establish these outcomes. Production and Preview have AI credentials; the server-only Supabase deletion key remains absent. SMTP delivery is not verified.

Automatic review rejected persistent synthetic production login accounts and a broad untested RLS/session-policy rewrite. Neither is implemented through an alternative route. Existing ownership policies remain intact. The narrower atomic-evidence and revision-guard migration was applied and transaction-tested. Account cleanup now enumerates nested files and revokes refresh sessions before deletion, but existing access JWTs remain valid until expiry; signed download URLs remain usable for their short lifetime.

See [auth/domain setup](auth-routing-and-domains.md) for exact current URLs and later DNS instructions. No custom domain is purchased or attached without ownership. In-app notifications do not send email or push notifications.

## Publication checklist

Save all reviewed sources and migrations → pass GitHub CI → merge → insert only missing reviewed seed records and staged candidates → deploy the merged commit with current environment → compare source hashes → verify stable production routes and anonymous API denial → check runtime errors and scheduled jobs. Publish actual commit/deployment identifiers in the release report, not assumed values in this document.

## Course addition — 13 November 2026

Added MIT OpenCourseWare’s Physical Metallurgy (3.40J, Fall 2009), reviewed against the official course, syllabus and OCW access information. It is an archived graduate learning resource with published prerequisites, free materials and no OCW credit or certificate. The reviewed catalog now contains 281 courses and 561 total records.
