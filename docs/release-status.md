# ProspectoAI 5 release verification

The expansion connects Explore, Build Your Profile, Professional Pathways, Admissions and Universities, and My Plan. GitHub remains the source of truth; a release must deploy the exact merged commit. No rollback to Opportunity Explorer is part of this release.

## Verified before deployment

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

Full signup → email confirmation → login → recovery → new password, actual model generation, private Storage network operations and account deletion need an owner-controlled signed-in session. Configuration flags and DOM tests cannot establish these outcomes. Production and Preview have AI credentials; the server-only Supabase deletion key remains absent. SMTP delivery is not verified.

Automatic review rejected persistent synthetic production login accounts and a broad untested RLS/session-policy rewrite. Neither is implemented through an alternative route. Existing ownership policies remain intact. The narrower atomic-evidence and revision-guard migration was applied and transaction-tested. Account cleanup now enumerates nested files and revokes refresh sessions before deletion, but existing access JWTs remain valid until expiry; signed download URLs remain usable for their short lifetime.

See [auth/domain setup](auth-routing-and-domains.md) for exact current URLs and later DNS instructions. No custom domain is purchased or attached without ownership. In-app notifications do not send email or push notifications.

## Publication checklist

Save all reviewed sources and migrations → pass GitHub CI → merge → insert only missing reviewed seed records and staged candidates → deploy the merged commit with current environment → compare source hashes → verify stable production routes and anonymous API denial → check runtime errors and scheduled jobs. Publish actual commit/deployment identifiers in the release report, not assumed values in this document.
