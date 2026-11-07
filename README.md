# Opportunity Explorer

A practical way to find, compare and keep track of research programs, hackathons, olympiads and scholarships.

**[Open the live site](https://opportunity-explorer-ruddy.vercel.app/)**

## What it does

- Filter opportunities by subject, student stage, location, format, deadline and funding.
- Compare up to three options side by side, including eligibility restrictions and costs.
- Save an application tracker with stages and private notes.
- Export and restore a tracker backup, copy opportunity links, or download calendar reminders.
- Read new announcements from public scholarship websites and Telegram channels.

The curated collection and automatic announcements are separate. Curated listings link to their providers and show review dates, funding gaps and uncertain details. Incoming feed items are discovery leads, not verified eligibility decisions.

## Run locally

Requires **Node.js 24** and npm.

```bash
npm ci
npm run build
npm run dev
```

Open `http://127.0.0.1:4173`. The local server serves the frontend and its saved feed snapshot. For live functions, use a linked Vercel development environment with the environment variables below.

```bash
npm run check          # catalog validation and tests
npm run format:check   # source formatting
npm audit             # dependency audit
```

## Project structure

| Path              | Purpose                                                                |
| ----------------- | ---------------------------------------------------------------------- |
| `dist/`           | Frontend, curated catalog and fallback feed snapshot                   |
| `api/discover.js` | Public feed endpoint                                                   |
| `api/refresh.js`  | Authenticated refresh endpoint                                         |
| `lib/`            | Feed collection, storage, caching and catalog validation               |
| `scripts/`        | Catalog generation and local preview server                            |
| `tests/`          | Catalog, filtering, tracker, feed, failure-recovery and preview checks |
| `vercel.json`     | Hosting settings and weekly refresh schedule                           |

The app uses plain HTML, CSS and JavaScript. The backend uses Node.js functions, Cheerio and a private Vercel Blob store.

## Deploy on Vercel

Import the repository root using the **Other** framework preset. The configuration builds the catalog with `npm run build` and serves `dist/`. Keep `api/`, `lib/`, the package files and `vercel.json` in the deployment: the feed updater needs them.

Connect a **private Vercel Blob store** and set these server-side environment variables:

| Variable                | Purpose                                   |
| ----------------------- | ----------------------------------------- |
| `BLOB_READ_WRITE_TOKEN` | Read and update the private feed snapshot |
| `CRON_SECRET`           | Authenticate scheduled refresh requests   |

`.env.example` lists the names without credentials. Set real values in the hosting dashboard or an untracked local environment file.

The scheduled job runs on Mondays at `00:00 UTC`. Vercel supplies the bearer secret to `/api/refresh`. If a stored snapshot is older than eight days, a visitor request can also refresh it. A failed refresh serves the last available snapshot with a warning. Hosting limits and source availability still apply.

GitHub hosts the source code. The full application needs Vercel's functions and storage; GitHub Pages alone would serve only the static frontend.

## Updating opportunities

Edit `dist/opportunities.json`, then run:

```bash
npm run build
npm run check
```

`dist/data.js` is generated from the catalog. Keep IDs stable so saved opportunities continue to work. Update an entry's `checkedOn` only after revisiting its provider information, and update `updatedAt` after a researched catalog release. Keep expired entries with `archived: true`.

A confirmed deadline requires a real calendar day. Unknown dates stay `null`, tentative windows stay labelled, and a passed early round must not replace a still-valid final deadline. Exact times and timezone cautions belong in `deadlineDetail`. Code changes and feed collection do not change provider review dates.

## Automatic sources

- [StudyQA](https://t.me/studyqa)
- [No Borders Abroad](https://t.me/noborders_abroad)
- [Scholars4Dev](https://www.scholars4dev.com/)
- [Opportunity Desk](https://opportunitydesk.org/)

The collector uses their public previews or RSS feeds, filters announcements, deduplicates links and stores short attributed excerpts. It does not log in to Telegram, join groups or send messages. Tags are keyword hints; final eligibility and award details belong to the original provider.

Feed failures retain saved announcements and their original collection dates. Sources can change their markup, restrict public previews or stop publishing, so availability is shown in the interface.

## Privacy and reminders

The tracker stays in the visitor's browser. There is no account system, cross-device synchronization, analytics or shared notes database. Clearing browser data removes the tracker; export a private backup first. A backup contains notes. Shared opportunity links and calendar files do not.

Calendar downloads are all-day reminders of the provider's deadline date. They are not exact cut-off times or guaranteed alerts; check the source timezone and your calendar's notification settings. The site does not submit applications.

## Maintenance

The tests and formatting checks run on pushes and pull requests. A dependency override pins Zod to a patched version while the storage SDK's dependency chain still pins an older release. Review the override when updating dependencies.

Created by **Yermukhamed Tuktibay**.
