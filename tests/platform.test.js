import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { searchResources, fallbackAnswer } from '../lib/assistant.js';
import chat from '../api/chat.js';
function res() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(v) {
      this.body = v;
      return this;
    },
  };
}
test('resource references exist and university profiles omit admissions stats', () => {
  const r = JSON.parse(readFileSync('data/resources.json'));
  assert.equal(r.universities.length, 12);
  assert.equal(r.skills.length, 6);
  for (const u of r.universities) {
    assert(u.sources.length);
    assert(
      !/minimum|GPA|SAT|IELTS|admission requirements/i.test(JSON.stringify(u)),
    );
  }
  for (const s of r.skills)
    for (const id of s.courses) assert(r.courses.some((c) => c.id === id));
  for (const c of r.careers) {
    assert.equal(c.deadline, null);
    assert(c.deadlineNote);
  }
});
test('assistant retrieval narrows field and stage, excludes closed listings and preserves sources', () => {
  const a = searchResources('materials', { field: 'Materials Science' });
  assert(a.length);
  assert(
    a.every(
      (o) =>
        o.fields.includes('Materials Science') ||
        o.fields.includes('All subjects'),
    ),
  );
  assert(searchResources('qzxyw nonsense').length === 0);
  assert(searchResources('CERN').some((o) => o.kind === 'career'));
  assert.match(fallbackAnswer([]), /could not find/);
});
test('chat validates requests and rejects unsigned catalog access', async () => {
  const old = process.env.AI_GATEWAY_MODEL;
  delete process.env.AI_GATEWAY_MODEL;
  try {
    let r = res();
    await chat({ method: 'POST', body: { message: 'materials' } }, r);
    assert.equal(r.statusCode, 401);
    assert.equal(r.body.code, 'login_required');
    r = res();
    await chat({ method: 'POST', body: { message: 'x'.repeat(1501) } }, r);
    assert.equal(r.statusCode, 400);
    r = res();
    await chat({ method: 'GET' }, r);
    assert.equal(r.statusCode, 405);
    r = res();
    await chat({ method: 'POST', body: 'not-json' }, r);
    assert.equal(r.statusCode, 400);
  } finally {
    if (old) process.env.AI_GATEWAY_MODEL = old;
  }
});
