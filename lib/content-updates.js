import { createHash } from 'node:crypto';
import { get, put } from '@vercel/blob';
import { load } from 'cheerio';
import {
  canonicalUrl,
  duplicateKey,
  cycleStatus,
} from './intelligence-core.js';
const PATH = 'prospectoai/intelligence-update-report.json';
export async function readContentReport() {
  const r = await get(PATH, { access: 'private', useCache: false });
  if (!r) return null;
  if (r.statusCode !== 200) throw Error('Content report unavailable.');
  return JSON.parse(await new Response(r.stream).text());
}
export async function inspectSources({
  records,
  sources,
  previous = null,
  fetcher = fetch,
  now = new Date(),
  maxSources = 120,
}) {
  const old = new Map((previous?.checks || []).map((x) => [x.url, x])),
    known = new Set(
      records.flatMap((r) => r.sources?.map((s) => canonicalUrl(s[1])) || []),
    ),
    checks = [],
    candidates = [];
  let cursor = 0;
  const allDue = [...sources]
    .filter((s) => {
      const prior = old.get(s.url);
      return (
        !prior?.checkedAt ||
        +now - Date.parse(prior.checkedAt) >=
          (prior.state === 'Failed' ? 1 : s.frequencyDays || 7) * 86400000
      );
    })
    .sort(
      (a, b) =>
        (a.frequencyDays || 7) - (b.frequencyDays || 7) ||
        String(old.get(a.url)?.checkedAt || '').localeCompare(
          String(old.get(b.url)?.checkedAt || ''),
        ) ||
        a.url.localeCompare(b.url),
    );
  const due = allDue.slice(0, maxSources);
  await Promise.all(
    Array.from({ length: Math.min(12, due.length) }, async () => {
      while (cursor < due.length) {
        const source = due[cursor++],
          prior = old.get(source.url);
        try {
          const r = await fetcher(source.url, {
            method: 'GET',
            redirect: 'manual',
            signal: AbortSignal.timeout(2000),
            headers: {
              'User-Agent':
                'ProspectoAI source review (+https://github.com/yermukhamed0777/opportunity-explorer)',
            },
          });
          if (!r.ok)
            throw Error(
              'Provider returned ' + r.status + '; manual review required.',
            );
          if (Number(r.headers.get('content-length') || 0) > 1000000)
            throw Error('Source exceeds review size limit.');
          const reader = r.body?.getReader();
          let bytes = 0,
            chunks = [];
          if (reader) {
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              bytes += value.length;
              if (bytes > 1000000) {
                await reader.cancel();
                throw Error('Source exceeds review size limit.');
              }
              chunks.push(value);
            }
          }
          const text = Buffer.concat(
            chunks.map((x) => Buffer.from(x)),
          ).toString('utf8');
          const $ = load(text);
          $('script,style,nav,footer').remove();
          const content = $('main').text() || $('body').text(),
            hash = createHash('sha256')
              .update(content.replace(/\s+/g, ' ').trim())
              .digest('hex'),
            changed = !!prior?.hash && prior.hash !== hash;
          checks.push({
            url: source.url,
            checkedAt: now.toISOString(),
            lastSuccessAt: now.toISOString(),
            hash,
            state: changed ? 'Review' : 'Reachable',
            note: 'Reachability and content fingerprint only; provider facts are not automatically reverified.',
          });
          if (changed)
            candidates.push({
              id: 'changed-' + hash.slice(0, 20),
              sourceUrl: source.url,
              type: 'Changed source',
              title: $('title').text().slice(0, 200),
              recordIds: source.recordIds,
              observedDates: [
                ...new Set(content.match(/20\d{2}-\d{2}-\d{2}/g) || []),
              ].slice(0, 10),
              state: 'Review',
              note: 'Dates are unconfirmed observations. Compare against the official application notice.',
            });
          $('a[href]').each((_, el) => {
            if (candidates.length >= 100) return;
            const title = $(el).text().replace(/\s+/g, ' ').trim();
            if (
              !/scholarship|fellowship|internship|research placement|application.*20\d{2}|summer.*research/i.test(
                title,
              ) ||
              title.length < 12
            )
              return;
            try {
              const url = canonicalUrl(
                new URL($(el).attr('href'), source.url).href,
              );
              if (
                new URL(url).hostname !== new URL(source.url).hostname ||
                known.has(url) ||
                candidates.some((c) => c.sourceUrl === url)
              )
                return;
              candidates.push({
                id:
                  'lead-' +
                  createHash('sha256').update(url).digest('hex').slice(0, 20),
                sourceUrl: url,
                type: 'Potential new listing',
                title: title.slice(0, 200),
                state: 'Review',
                note: 'Unverified lead, not a published opportunity. Administrator must establish current cycle and eligibility.',
              });
            } catch {}
          });
        } catch (error) {
          checks.push({
            url: source.url,
            checkedAt: now.toISOString(),
            lastSuccessAt: prior?.lastSuccessAt || null,
            hash: prior?.hash || null,
            state: 'Failed',
            note: String(error.message).slice(0, 200),
          });
        }
      }
    }),
  );
  const duplicates = [],
    seen = new Map();
  for (const r of records) {
    try {
      const key = duplicateKey(r);
      if (seen.has(key))
        duplicates.push({
          ids: [seen.get(key), r.id],
          source: r.sources[0][1],
        });
      else seen.set(key, r.id);
    } catch {}
  }
  const merged = new Map((previous?.checks || []).map((x) => [x.url, x]));
  for (const c of checks) merged.set(c.url, c);
  return {
    runAt: now.toISOString(),
    status: !checks.length
      ? 'Not due'
      : checks.some((c) => c.state === 'Reachable' || c.state === 'Review')
        ? 'Completed'
        : 'Failed',
    remainingDue: allDue.length - due.length,
    checked: checks.length,
    failed: checks.filter((c) => c.state === 'Failed').length,
    checks: [...merged.values()],
    candidates: [
      ...new Map(
        [...(previous?.candidates || []), ...candidates].map((c) => [c.id, c]),
      ).values(),
    ].slice(-500),
    duplicates,
    expired: records
      .filter((r) => ['Previous cycle', 'Closed'].includes(cycleStatus(r, now)))
      .map((r) => r.id),
    history: [
      {
        at: now.toISOString(),
        checked: checks.length,
        failed: checks.filter((c) => c.state === 'Failed').length,
      },
      ...(previous?.history || []),
    ].slice(0, 30),
    note: 'Nothing is automatically published or rewritten. Failed imports retain published records and previous successful checks.',
  };
}
export async function refreshContent(records, sources) {
  let previous;
  try {
    previous = await readContentReport();
  } catch {
    throw Error(
      'Previous content report could not be read; it has not been overwritten.',
    );
  }
  const report = await inspectSources({ records, sources, previous });
  if (report.status === 'Not due') return report;
  if (report.status === 'Failed')
    throw Error('All due source checks failed; previous report retained.');
  await put(PATH, JSON.stringify(report), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });
  return report;
}
