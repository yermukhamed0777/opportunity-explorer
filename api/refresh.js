import { timingSafeEqual } from 'node:crypto';
import { refreshFeed } from '../lib/feed-store.js';
import { refreshContent } from '../lib/content-updates.js';
import { intelligence, sourceRegistry } from '../lib/intelligence-data.js';
import { renewSources } from '../lib/renewal.js';
export function authorized(header, secret) {
  if (!secret || typeof header !== 'string') return false;
  const a = Buffer.from(header),
    b = Buffer.from('Bearer ' + secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!authorized(req.headers.authorization, process.env.CRON_SECRET))
    return res.status(401).json({ error: 'Unauthorized' });
  const [feed, renewal, content] = await Promise.allSettled([
    refreshFeed(),
    new Date().getUTCDay() === 1
      ? renewSources()
      : Promise.resolve({
          history: [
            { status: 'Not due', note: 'Legacy link review runs Mondays.' },
          ],
        }),
    refreshContent(intelligence.records, sourceRegistry()),
  ]);
  const feedOk = feed.status === 'fulfilled',
    renewalOk = renewal.status === 'fulfilled';
  return res
    .status(feedOk || renewalOk || content.status === 'fulfilled' ? 200 : 503)
    .json({
      ok: feedOk && renewalOk && content.status === 'fulfilled',
      content:
        content.status === 'fulfilled'
          ? {
              checked: content.value.checked,
              status: content.value.status,
              runAt: content.value.runAt,
            }
          : {
              error: 'Content checks failed; published records were retained.',
            },
      feed: feedOk
        ? {
            items: feed.value.items.length,
            refreshedAt: feed.value.refreshedAt,
          }
        : { error: 'Feed refresh failed; previous snapshot retained.' },
      renewal: renewalOk
        ? renewal.value.history[0]
        : { error: 'Source renewal failed; previous snapshot retained.' },
    });
}
