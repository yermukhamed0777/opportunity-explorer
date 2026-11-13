# Controlled updates and editorial review

Vercel calls `/api/refresh` daily at 01:00 UTC (09:00 China/Hong Kong time). `CRON_SECRET` authenticates the request. Feed collection, the legacy weekly review and expanded content checks run independently; one failure does not discard the other results. The legacy HEAD review runs on Mondays. Supabase's expanded-content expiry job runs daily at 00:15 UTC; the older resource expiry job runs Mondays at 00:00 UTC.

- Public Telegram previews and approved RSS sources supply attributed discovery leads. Incoming posts remain unverified.
- The source auditor makes bounded HEAD requests only to the fixed HTTPS source list in the reviewed catalogs. It does not follow redirects or fetch arbitrary visitor-provided URLs.
- The expanded checker makes bounded GET requests to at most 120 approved URLs per run, rotating due sources. Reachability, fingerprints and discovered links are review observations, not verified provider facts. Failed checks may reflect redirects, timeouts or access restrictions; they do not prove a programme closed.
- Link availability and changed response headers enter the review report. These checks do not change the provider-fact verification date.
- Unavailable sources, changed headers and facts older than 30 days enter the review queue. Previous snapshots remain if collection or storage fails.
- A Supabase pg_cron job marks public opportunity records expired when their known final deadline passes. It never deletes saved trackers or activities.
- University facilities, course details and employer conditions require a human source review before a factual update. This avoids automatically publishing uncertain data or assuming permission to scrape page content.

## Maintainer workflow

1. As an authorized administrator, open **System Health & content** to inspect expanded source checks, candidates and publication history. The legacy report is under **Source review status** or the authenticated `/api/renewal` endpoint.
2. Open each original provider page. Check programme existence, changed details, deadlines and whether a posting is still open. A HEAD failure can be a method restriction; it is not proof a programme closed.
3. Correct provider facts in the administrator's reviewed publication flow, or edit the appropriate source under `data/` in GitHub. `dist/` must not contain public catalog JSON. Update `checkedOn` only after checking the facts. Known expired postings should be archived or given a confirmed closing date; unknown dates remain unknown.
4. Search for an existing stable ID before adding an entry. Keep IDs of saved records stable.
5. Run `npm run check`, `npm run format:check` and `npm run seed:export`. Review the diff and publish a PR.
6. The baseline `supabase/seed.sql` upserts legacy public resources. Expanded initial imports use `node scripts/export-intelligence.mjs`, which inserts missing records and review candidates without replacing existing administrator publications. Never overwrite reviewed live records with an old seed.
7. Merge after validation and deploy that exact GitHub revision to Vercel. Test the public URL, navigation, source endpoints and accounts.

Ordinary signed-in visitors cannot publish content. Server and database checks enforce the private administrator role, and each publication uses an expected version plus an audit history. Repository changes still pass CI. Vercel Blob stores the source reports; PostgreSQL cron history is available in the Supabase dashboard.

## AI diagnostics

The current reviewed primary model is `openai/gpt-4.1-nano`. A single backup attempt may use `openai/gpt-5-nano` only when the same Gateway credential's model metadata marks it eligible and request availability is explicitly available. Unknown or denied availability is not permission. Authentication, billing, owner-verification, regional and content-policy failures stop rather than retrying through a different credential.

Administrator health shows a safe, read-only Gateway access check. Chat returns `X-Prospecto-Request-Id` for correlation. Logs contain the generated request ID, public model ID, allowlisted error code, status, reported provider and generation ID where available, and a normalized safe message. Raw exception bodies, authorization headers, keys, session tokens, prompts, conversation text and CV contents are never logged. A provider name or generation ID may be unavailable when the Gateway rejects a request before routing.

On 13 November 2026, live diagnosis established `customer_verification_required`: the primary Gemini model was ineligible, the OpenAI replacement was eligible, and account-wide HTTP requests were unavailable. The owner must complete Vercel's account verification. Model metadata or a configured key does not establish successful generation; repeat the signed-in test after verification.

## Recovery

If a provider fails, retain its last facts and review date with a caution. If a refresh fails, retain the last stored snapshot. If storage cannot be read, do not overwrite it. A source outage must never erase the catalog or users' activities.
