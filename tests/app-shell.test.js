import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';

test('tracker account restoration and delayed feeds survive replacement workspace navigation', async () => {
  const w = new Window({ url: 'https://app.example/#dashboard' });
  try {
    w.document.write(
      readFileSync('dist/index.html', 'utf8').replace(
        /<script\b[^>]*>[\s\S]*?<\/script>/gi,
        '',
      ),
    );
    const catalog = JSON.parse(readFileSync('data/opportunities.json'));
    w.EXPLORER_CATALOG = catalog;
    w.OPPORTUNITIES = catalog.opportunities;
    w.structuredClone = structuredClone;
    w.Option = function (text, value) {
      const option = w.document.createElement('option');
      option.textContent = text;
      option.value = value;
      return option;
    };
    let completeFeed;
    w.ProspectoAuth = {
      fetch: () => new Promise((resolve) => (completeFeed = resolve)),
    };
    w.eval(readFileSync('dist/app.js', 'utf8'));
    w.document.querySelector('.main-nav').innerHTML =
      '<button class="nav-item" data-view="dashboard">My dashboard</button>';
    let rendered;
    w.ProspectoWorkspace = { views: ['dashboard'] };
    w.ProspectoPlatform = { render: (view) => (rendered = view) };
    const id = catalog.opportunities[0].id;
    assert.doesNotThrow(() =>
      w.ProspectoTracker.setCloud({ saved: [id], progress: {} }),
    );
    assert.deepEqual([...w.ProspectoTracker.snapshot().saved], [id]);
    w.ProspectoTracker.setView('dashboard');
    assert.equal(rendered, 'dashboard');
    completeFeed({
      ok: true,
      json: async () => ({ items: [], sources: [] }),
    });
    await new Promise((resolve) => setImmediate(resolve));
    w.ProspectoTracker.setView('latest');
    assert.match(
      w.document.querySelector('#breadcrumb-title').textContent,
      /Latest/,
    );
    w.ProspectoTracker.setView('dashboard');
    assert.equal(rendered, 'dashboard');
  } finally {
    await w.happyDOM.close();
  }
});
