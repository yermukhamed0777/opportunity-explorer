const MAX_AGE_MS = 8 * 24 * 60 * 60 * 1000;

export function createDiscoverHandler({ read, refresh, now = Date.now }) {
  return async function handler(req, res) {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    let snapshot = null;
    try {
      snapshot = await read();
    } catch {
      /* A refresh may recover a transient read failure. */
    }
    let refreshFailed = false;
    const checkedAt = Date.parse(snapshot?.refreshedAt);
    if (
      !snapshot ||
      !Number.isFinite(checkedAt) ||
      now() - checkedAt > MAX_AGE_MS
    ) {
      try {
        snapshot = await refresh();
      } catch {
        refreshFailed = true;
      }
    }
    if (!snapshot) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(503).json({
        error:
          'Automatic sources are temporarily unavailable. The curated collection remains available.',
        items: [],
        sources: [],
      });
    }
    res.setHeader(
      'Cache-Control',
      refreshFailed
        ? 'no-store'
        : 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
    );
    return res
      .status(200)
      .json(refreshFailed ? { ...snapshot, refreshFailed: true } : snapshot);
  };
}
