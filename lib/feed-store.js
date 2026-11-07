import { get, put } from '@vercel/blob';
import { collectFeeds } from './feeds.js';
import { createFeedCache } from './feed-cache.js';

const FEED_PATH = 'opportunity-explorer/latest.json';

export async function readFeed() {
  const result = await get(FEED_PATH, { access: 'private', useCache: false });
  if (!result) return null;
  if (result.statusCode !== 200)
    throw new Error('Feed storage could not be read.');
  const snapshot = JSON.parse(await new Response(result.stream).text());
  if (!Array.isArray(snapshot.items) || !Array.isArray(snapshot.sources)) {
    throw new Error('Stored feed has an invalid shape.');
  }
  return snapshot;
}

const cache = createFeedCache({
  read: readFeed,
  collect: collectFeeds,
  write: (snapshot) =>
    put(FEED_PATH, JSON.stringify(snapshot), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      cacheControlMaxAge: 60,
    }),
});

export const refreshFeed = cache.refresh;
