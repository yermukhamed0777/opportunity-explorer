import { readRenewal } from '../lib/renewal.js';
export default async function handler(req, res) {
  res.setHeader(
    'Cache-Control',
    'public, s-maxage=300, stale-while-revalidate=3600',
  );
  if (req.method !== 'GET')
    return res.status(405).json({ error: 'Method not allowed' });
  try {
    const report = await readRenewal();
    if (!report)
      return res.status(200).json({
        status: 'pending',
        reviewQueue: [],
        links: [],
        history: [],
        note: 'The first weekly source review has not run yet.',
      });
    return res.status(200).json(report);
  } catch {
    return res.status(503).json({
      status: 'unavailable',
      reviewQueue: [],
      links: [],
      history: [],
      error:
        'Review report unavailable. Curated content retains its original review dates.',
    });
  }
}
