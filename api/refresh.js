import { timingSafeEqual } from 'node:crypto';
import { refreshFeed } from '../lib/feed-store.js';
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
  const [feed, renewal] = await Promise.allSettled([
    refreshFeed(),
    renewSources(),
  ]);
  const feedOk = feed.status === 'fulfilled',
    renewalOk = renewal.status === 'fulfilled';
  return res.status(feedOk || renewalOk ? 200 : 503).json({
    ok: feedOk && renewalOk,
    feed: feedOk
      ? { items: feed.value.items.length, refreshedAt: feed.value.refreshedAt }
      : { error: 'Feed refresh failed; previous snapshot retained.' },
    renewal: renewalOk
      ? renewal.value.history[0]
      : { error: 'Source renewal failed; previous snapshot retained.' },
  });
}
