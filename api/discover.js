import { requireUser } from '../lib/auth.js';
import { readFeed, refreshFeed } from '../lib/feed-store.js';
import { createDiscoverHandler } from '../lib/discover-handler.js';

const discover = createDiscoverHandler({
  read: readFeed,
  refresh: refreshFeed,
});
export default async function handler(req, res) {
  if (!(await requireUser(req, res))) return;
  // The underlying collector is public-source data; responses still require login.
  const setHeader = res.setHeader.bind(res);
  res.setHeader = (name, value) =>
    setHeader(
      name,
      name.toLowerCase() === 'cache-control' ? 'private, no-store' : value,
    );
  return discover(req, res);
}
