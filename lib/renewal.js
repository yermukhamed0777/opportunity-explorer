import { readFileSync } from 'node:fs';
import { get, put } from '@vercel/blob';
const resources = JSON.parse(
  readFileSync(new URL('../data/resources.json', import.meta.url)),
);
const catalog = JSON.parse(
  readFileSync(new URL('../data/opportunities.json', import.meta.url)),
);
const path = 'prospectoai/renewal.json';
export function sourceIndex() {
  const index = new Map();
  for (const [kind, items] of [
    ['university', resources.universities],
    ['course', resources.courses],
    ['career', resources.careers],
    ['opportunity', catalog.opportunities],
  ])
    for (const entry of items) {
      const sources = entry.sources || [[entry.name, entry.url]];
      for (const [label, url] of sources) {
        const u = new URL(url);
        if (u.protocol !== 'https:') continue;
        u.hash = '';
        const key = u.href;
        if (!index.has(key)) index.set(key, { url: key, refs: [] });
        index.get(key).refs.push({
          id: entry.id,
          kind,
          name: entry.name,
          label,
          verifiedOn: entry.checkedOn,
        });
      }
    }
  return [...index.values()];
}
export async function auditLinks({
  fetcher = fetch,
  previous = null,
  now = new Date().toISOString(),
  sources = sourceIndex(),
} = {}) {
  const old = new Map((previous?.links || []).map((x) => [x.url, x]));
  const results = new Array(sources.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(8, sources.length) }, async () => {
      while (cursor < sources.length) {
        const i = cursor++,
          source = sources[i],
          prior = old.get(source.url);
        try {
          const response = await fetcher(source.url, {
            method: 'HEAD',
            redirect: 'manual',
            signal: AbortSignal.timeout(4000),
            headers: {
              'User-Agent':
                'ProspectoAI/3.0 (+https://github.com/yermukhamed0777/opportunity-explorer)',
            },
          });
          const ok = response.status >= 200 && response.status < 300;
          const etag = response.headers.get('etag'),
            modified = response.headers.get('last-modified');
          const changed =
            ok &&
            !!prior?.lastSuccessAt &&
            ((etag && prior.etag && etag !== prior.etag) ||
              (modified && prior.modified && modified !== prior.modified));
          results[i] = {
            ...source,
            lastCheckedAt: now,
            lastSuccessAt: ok ? now : prior?.lastSuccessAt || null,
            httpStatus: response.status,
            etag: etag || prior?.etag || null,
            modified: modified || prior?.modified || null,
            state: !ok ? 'review' : changed ? 'changed' : 'reachable',
            reason: !ok
              ? response.status >= 300 && response.status < 400
                ? 'Redirect needs review.'
                : response.status === 404 || response.status === 410
                  ? 'Source unavailable; review before promoting.'
                  : 'Automatic link check unavailable; manual review needed.'
              : changed
                ? 'Provider headers changed. Facts need manual review.'
                : 'Link responded. This does not re-verify the facts.',
          };
        } catch {
          results[i] = {
            ...source,
            lastCheckedAt: now,
            lastSuccessAt: prior?.lastSuccessAt || null,
            httpStatus: null,
            state: 'unavailable',
            reason: 'Check timed out or failed. Previous records are retained.',
            etag: prior?.etag || null,
            modified: prior?.modified || null,
          };
        }
      }
    }),
  );
  const today = now.slice(0, 10),
    expired = catalog.opportunities
      .filter((o) => o.archived || (o.finalDeadline && o.finalDeadline < today))
      .map((o) => ({
        id: o.id,
        name: o.name,
        finalDeadline: o.finalDeadline,
        state: o.archived ? 'archived' : 'expired',
      }));
  const queue = results.flatMap((l) =>
    l.refs
      .filter(
        (r) =>
          l.state !== 'reachable' ||
          r.verifiedOn <
            new Date(Date.parse(now) - 30 * 86400000)
              .toISOString()
              .slice(0, 10),
      )
      .map((r) => ({
        ...r,
        url: l.url,
        reason:
          l.state === 'reachable'
            ? 'Provider facts need a fresh review; the recorded review is over 30 days old.'
            : l.reason,
        lastCheckedAt: now,
      })),
  );
  const run = {
    checkedAt: now,
    links: results.length,
    reachable: results.filter(
      (x) => x.state === 'reachable' || x.state === 'changed',
    ).length,
    needsReview: queue.length,
    expired: expired.length,
  };
  return {
    schemaVersion: 1,
    lastRunAt: now,
    status: run.reachable === results.length ? 'complete' : 'partial',
    links: results,
    reviewQueue: queue,
    expired,
    history: [run, ...(previous?.history || [])].slice(0, 12),
    note: 'Automated availability checks do not verify facts. Changes and unavailable sources wait for repository review. No saved user records are removed.',
  };
}
export async function readRenewal() {
  const r = await get(path, { access: 'private', useCache: false });
  if (!r) return null;
  if (r.statusCode !== 200) throw Error('Renewal storage unavailable');
  const data = JSON.parse(await new Response(r.stream).text());
  if (data.schemaVersion !== 1 || !Array.isArray(data.links))
    throw Error('Invalid renewal snapshot');
  return data;
}
export async function renewSources() {
  let previous;
  try {
    previous = await readRenewal();
  } catch {
    throw Error(
      'Cannot safely read previous renewal snapshot. No overwrite performed.',
    );
  }
  const snapshot = await auditLinks({ previous });
  await put(path, JSON.stringify(snapshot), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
  });
  console.log('Source renewal', snapshot.history[0]);
  return snapshot;
}
