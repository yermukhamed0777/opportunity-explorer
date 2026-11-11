import test from 'node:test';
import assert from 'node:assert/strict';
import { auditLinks, sourceIndex } from '../lib/renewal.js';
test('source audit deduplicates URLs and retains saved history during outages', async () => {
  const sources = [
    {
      url: 'https://official.example/program',
      refs: [
        {
          id: 'one',
          kind: 'career',
          name: 'Example',
          verifiedOn: '2026-10-01',
        },
      ],
    },
  ];
  let result = await auditLinks({
    sources,
    now: '2026-11-11T00:00:00Z',
    fetcher: async () =>
      new Response(null, { status: 200, headers: { etag: 'a' } }),
  });
  assert.equal(result.links[0].state, 'reachable');
  assert.equal(result.reviewQueue.length, 1);
  const prior = result;
  result = await auditLinks({
    sources,
    previous: prior,
    now: '2026-11-18T00:00:00Z',
    fetcher: async () => {
      throw Error('offline');
    },
  });
  assert.equal(result.links[0].lastSuccessAt, '2026-11-11T00:00:00Z');
  assert.equal(result.status, 'partial');
  assert.equal(result.history.length, 2);
  result = await auditLinks({
    sources,
    previous: prior,
    fetcher: async () =>
      new Response(null, { status: 200, headers: { etag: 'b' } }),
  });
  assert.equal(result.links[0].state, 'changed');
  assert(result.reviewQueue.length);
  const index = sourceIndex();
  assert.equal(new Set(index.map((x) => x.url)).size, index.length);
  assert(index.length > 30);
});
