import { timingSafeEqual } from 'node:crypto';
import { refreshFeed } from '../lib/feed-store.js';
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
  try {
    const snapshot = await refreshFeed();
    return res.status(200).json({
      ok: true,
      refreshedAt: snapshot.refreshedAt,
      items: snapshot.items.length,
      sources: snapshot.sources,
    });
  } catch {
    return res.status(503).json({
      ok: false,
      error: 'Refresh failed. Previously stored feed data was retained.',
    });
  }
}
