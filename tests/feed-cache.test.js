import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeedCache } from '../lib/feed-cache.js';
import { createDiscoverHandler } from '../lib/discover-handler.js';

const saved = {
  refreshedAt: '2026-10-01T00:00:00Z',
  lastSuccessfulRefresh: '2026-10-01T00:00:00Z',
  items: [{ id: 'saved' }],
  sources: [],
};
function response() {
  return {
    code: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('a failed storage read never overwrites an unread snapshot', async () => {
  let writes = 0;
  const cache = createFeedCache({
    read: async () => {
      throw Error('storage down');
    },
    collect: async () => saved,
    write: async () => {
      writes++;
    },
  });
  await assert.rejects(cache.refresh());
  assert.equal(writes, 0);
});

test('concurrent refreshes collect and write once, and the lock resets after failure', async () => {
  let collections = 0,
    writes = 0;
  const cache = createFeedCache({
    read: async () => saved,
    collect: async () => {
      collections++;
      return saved;
    },
    write: async () => {
      writes++;
      if (writes === 1) throw Error('write down');
    },
  });
  const first = cache.refresh();
  assert.equal(first, cache.refresh());
  await assert.rejects(first);
  assert.equal(collections, 1);
  await cache.refresh();
  assert.equal(writes, 2);
});

test('an initial total source outage cannot create an empty feed', async () => {
  let writes = 0;
  const cache = createFeedCache({
    read: async () => null,
    collect: async () => ({ items: [], lastSuccessfulRefresh: null }),
    write: async () => {
      writes++;
    },
  });
  await assert.rejects(cache.refresh());
  assert.equal(writes, 0);
});

test('the public API serves saved data with a warning after a failed refresh', async () => {
  const handler = createDiscoverHandler({
    read: async () => saved,
    refresh: async () => {
      throw Error('offline');
    },
    now: () => Date.parse('2026-11-07T00:00:00Z'),
  });
  const res = response();
  await handler({ method: 'GET' }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.refreshedAt, saved.refreshedAt);
  assert.equal(res.body.refreshFailed, true);
  assert.deepEqual(res.body.items, saved.items);
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

test('an invalid collection date triggers recovery and missing data returns 503', async () => {
  let calls = 0;
  const handler = createDiscoverHandler({
    read: async () => ({ ...saved, refreshedAt: 'invalid' }),
    refresh: async () => {
      calls++;
      return saved;
    },
  });
  const res = response();
  await handler({ method: 'GET' }, res);
  assert.equal(calls, 1);
  assert.equal(res.code, 200);
  const unavailable = createDiscoverHandler({
    read: async () => null,
    refresh: async () => {
      throw Error('offline');
    },
  });
  const down = response();
  await unavailable({ method: 'GET' }, down);
  assert.equal(down.code, 503);
});

test('unsupported methods do not read or refresh the feed', async () => {
  const handler = createDiscoverHandler({
    read: async () => {
      throw Error('must not run');
    },
    refresh: async () => {
      throw Error('must not run');
    },
  });
  const res = response();
  await handler({ method: 'POST' }, res);
  assert.equal(res.code, 405);
  assert.equal(res.headers.Allow, 'GET');
});
