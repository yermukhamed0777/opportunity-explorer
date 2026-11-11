import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreviewServer } from '../scripts/dev-server.js';

test('local preview serves public assets and rejects unsafe requests', async () => {
  const server = createPreviewServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = 'http://127.0.0.1:' + server.address().port;
  try {
    const home = await fetch(url);
    assert.equal(home.status, 200);
    assert((await home.text()).includes('ProspectoAI'));
    const head = await fetch(url + '/app.js', { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    assert.equal((await fetch(url + '/api/discover')).status, 401);
    assert.equal(
      (await fetch(url + '/index.html', { method: 'POST' })).status,
      405,
    );
    assert.equal((await fetch(url + '/%2e%2e%2fpackage.json')).status, 403);
    assert.equal((await fetch(url + '/%00')).status, 400);
    assert.equal((await fetch(url + '/.env')).status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
