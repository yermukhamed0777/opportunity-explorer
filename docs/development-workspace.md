# Development workspace

## Product and data

The private workspace adds four-step skippable onboarding, 33 field-specific learning maps, structured experience records, course and skill progress, editable plans, document review, source history, saved searches, in-app reminders and a personal dashboard. The original explorer, tracker, activities, auth routes and provider records remain available.

Reviewed catalogs contain 33 original/additional programme records (23 retained, 10 added), 12 university capability profiles (9 retained, 3 added), 28 courses (11 retained, 17 added), 33 field maps, 10 illustrative career archetypes and 9 retained career sources/postings. The new programme records span seven geographic regions and worldwide remote volunteering. Some are directories or explicitly closed-cycle watchlists; counts are not counts of currently open vacancies. Source URLs and review dates are in the JSON. Unknown duration, prices, skills or deadlines are labelled as unknown. Programmes with restricted nationality or institution eligibility retain those caveats.

Field learning maps are editorial routes, supported by US Bureau of Labor Statistics occupational context. They are not degree curricula or local licensing advice. Core skills are distinct by subject; transferable categories are shared where appropriate. No university admissions requirements, chances or score thresholds are added. Three university additions use official Monash, UCT and USP laboratory / student-research pages.

## Architecture and privacy

- `src/workspace.js` owns the new views; `lib/workspace-model.js` shares browser/server validation. The catalog API remains authenticated; source JSON is never emitted as a public asset.
- Nine additive tables use owner-only read/insert/update/delete policies. A private `profile-documents` bucket limits MIME types and size to 10 MB, with four owner-folder Storage policies. A document reference cannot point to another owner's file.
- PDF extraction uses pinned `unpdf`; DOCX uses pinned `mammoth` raw text, never HTML. Header/extension validation, archive expansion limits, 50-page PDF limit, 192 MB worker heap and 15-second termination bound processing. Scanned PDFs require external OCR. No fake extraction or automatic profile acceptance is used.
- Extracted lines have tentative categories. All start unselected and excluded from AI. The review transaction saves selected edited entries and updates the draft together, guarded by document revision.
- Signed downloads expire in 60 seconds. A holder of a signed URL can use it before expiry; links are not sent to AI or analytics. Individual files can be replaced/deleted. Reviewed profile records survive source-file deletion, with the reference cleared.
- Plan triggers lock the parent plan and enforce the sum of active hours per Monday-based week. Lowering a plan limit below an assigned week fails. AI suggestions remain an editable draft; explicit acceptance creates a plan. Resource IDs and weekly hours are validated before writes.
- AI profile context defaults off. With consent, server queries include selected preferences, skills, courses, plans, activities and individually permitted reviewed profile records. Raw document text, file links and unpermitted records are excluded. Typed chat messages/filters are sent when used. Chats stay in the tab and can be cleared. Provider terms still govern processing; no promise of provider zero retention is made.
- Export contains private user data and no credentials or signed URLs. Account deletion is implemented but truthfully unavailable until the owner supplies the server secret. It requires recent reauthentication and a typed confirmation. No paid service is provisioned by this release.

## Verification boundaries

Automated checks cover real PDF/DOCX parsing, validation and bounds, unsigned API denial, safe callbacks, consent defaults, recommendations, comparison limits, plan budgets and full DOM workflows with an in-memory test adapter. Transaction-only SQL tests verify two-user ownership isolation and database budget rules; all fixtures are rolled back. These tests do not establish email delivery, a real user session, Storage network delivery or actual model output.

A browser smoke check verifies the signed-out production login gate. Complete live signup → email confirmation → login → reset email → owner password change → protected navigation, actual private upload/download and AI generation still require the owner-controlled login/inbox. Do not describe them as passed until observed.
