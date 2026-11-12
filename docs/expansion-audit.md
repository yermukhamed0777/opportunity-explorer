# Expansion audit and acceptance checklist

Audit on 12 November 2026 (Hong Kong). GitHub main and Production both identify `7503ce8328e37488172ade4aa227925b615b4dea`; all 82 deployed source SHA1s match GitHub. No Vercel-only source was found. Baseline build, formatting and 40 tests pass. Vercel reports no runtime errors over the last 24 hours. The signed-out page has no app-origin console errors or horizontal overflow at 1348px; extension errors are unrelated. Signed-in and mobile browser checks remain pending.

The baseline Supabase audit had five migrations, 131 resource rows, one private document bucket and RLS on all exposed user tables. Existing user records are retained. Production and Preview have AI credentials; neither has `SUPABASE_SECRET_KEY`. Custom SMTP and complete email delivery are not established. Leaked-password checking is disabled; private quota-table denial and two narrow definer RPCs are intentional. No privileged key was retrieved.

| Specification      | Acceptance work                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| 1 Mission          | Connected discovery, evidence and planning workflows                                             |
| 2 Process          | Audit → repair → implementation → production verification → exact-commit deployment              |
| 3 Structure        | Five connected workspaces and contextual actions                                                 |
| 4 Pathways         | Separate public-source facts, leadership analysis and illustrative archetypes                    |
| 5 CV / portfolio   | Educational CV formats, annotated bullets, detailed project records                              |
| 6 Comparison       | Twelve explained, stage-sensitive evidence categories                                            |
| 7 Skills           | Rich skill records, emerging skills, six statuses and evidence links                             |
| 8 Universities     | Capabilities, official admissions routes, location guides and private folders                    |
| 9 Coverage         | Expand a verified global subset; keep uncertain data in review                                   |
| 10 Funding         | Dedicated search with structured funding components                                              |
| 11 Opportunities   | Consistent cycle states, verified dates and eligibility caveats                                  |
| 12 Research        | Safe, realistic ideas with methods, datasets and outputs                                         |
| 13 Learning        | Expand official resources and link progress to skills/projects/evidence                          |
| 14 Updates         | Approved-source checks, staged changes, history, safe failures and schedules                     |
| 15 Assistant       | Original white lion, grounded cross-workspace guidance and reviewed writes                       |
| 16 Notices         | Responsive notification drawer, timezone-aware deadlines and preferences                         |
| 17 Design          | Grouped navigation, command palette, contrast, keyboard and reduced motion                       |
| 18 Personalization | Explained factors; no unexplained success score                                                  |
| 19 Privacy         | Owner-only records/files, reviewed extraction, consent, export and deletion                      |
| 20 Admin           | Server/database authorization, health, review, history and restoration                           |
| 21 Auth            | Owner-controlled production tests; synthetic production logins were rejected by automatic review |
| 22 Tests           | Unit/integration/SQL/content/deadline/import/browser/release evidence                            |
| 23 Targets         | Calculate verified totals; never generate factual filler                                         |
| 24 Sync            | Version migrations, apply, pass CI, deploy exact GitHub source and compare                       |
| 25 Report          | Exact required report headings and one immediate owner action                                    |

Numerical content targets are quality targets, not permission to invent programmes or biographies. Editorial project ideas and fictional CV formats are labelled separately from verified external facts. This checklist records acceptance scope, not a claim that unchecked live work is already complete.
