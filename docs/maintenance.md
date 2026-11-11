# Weekly updates and editorial review

Vercel calls `/api/refresh` on Monday at 00:00 UTC (08:00 Hong Kong). `CRON_SECRET` authenticates the request. Feed collection and source auditing run independently; one failure does not discard the other result.

- Public Telegram previews and approved RSS sources supply attributed discovery leads. Incoming posts remain unverified.
- The source auditor makes bounded HEAD requests only to the fixed HTTPS source list in the reviewed catalogs. It does not follow redirects or fetch arbitrary visitor-provided URLs.
- Link availability and changed response headers enter the review report. These checks do not change the provider-fact verification date.
- Unavailable sources, changed headers and facts older than 30 days enter the review queue. Previous snapshots remain if collection or storage fails.
- A Supabase pg_cron job marks public opportunity records expired when their known final deadline passes. It never deletes saved trackers or activities.
- University facilities, course details and employer conditions require a human source review before a factual update. This avoids automatically publishing uncertain data or assuming permission to scrape page content.

## Maintainer workflow

1. Open **Sources & review queue** or `/api/renewal` to inspect the latest check and history.
2. Open each original provider page. Check programme existence, changed details, deadlines and whether a posting is still open. A HEAD failure can be a method restriction; it is not proof a programme closed.
3. Edit `dist/resources.json` or `dist/opportunities.json`. Update `checkedOn` only after checking the facts. Known expired postings should be archived or given a confirmed closing date; unknown dates remain unknown.
4. Search for an existing stable ID before adding an entry. Keep IDs of saved records stable.
5. Run `npm run check`, `npm run format:check` and `npm run seed:export`. Review the diff and publish a PR.
6. Apply the generated, idempotent `supabase/seed.sql` through the authenticated Supabase connector or SQL editor. It only upserts public source-backed records.
7. Merge after validation and deploy that exact GitHub revision to Vercel. Test the public URL, navigation, source endpoints and accounts.

The public review report is read-only. Repository review is the approval workflow; website visitors cannot promote records or alter the catalog. Vercel Blob stores the last report and twelve run summaries. PostgreSQL cron history is available in the Supabase dashboard.

## Recovery

If a provider fails, retain its last facts and review date with a caution. If a refresh fails, retain the last stored snapshot. If storage cannot be read, do not overwrite it. A source outage must never erase the catalog or users' activities.
