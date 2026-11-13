import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatHandler } from '../api/chat.js';
import { createDevelopmentHandler } from '../api/development.js';

const model = 'openai/gpt-4.1-nano';
const oidc = { AI_GATEWAY_MODEL: model, VERCEL_OIDC_TOKEN: 'private-oidc' };
const response = () => ({
  statusCode: 200,
  headers: {},
  setHeader(k, v) {
    this.headers[k] = v;
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});
function dependencies({
  catalogError = null,
  quotaError = null,
  allowed = true,
  env = oidc,
  getContext = async () => ({ profileConsent: false }),
  generate = async () => ({
    output: {
      items: [
        {
          title: 'Review one set of notes',
          hours: 1,
          weekOffset: 0,
          kind: 'Task',
          resourceId: null,
          reason: 'Suggested study task',
          dependencies: '',
        },
      ],
    },
  }),
} = {}) {
  const calls = { quota: 0, generate: 0 };
  const db = {
    rpc: async (name) => {
      assert.equal(name, 'reserve_ai_request');
      calls.quota++;
      return { data: allowed, error: quotaError };
    },
    from: (name) => {
      assert.equal(name, 'intelligence_records');
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        range: async () => ({ data: [], error: catalogError }),
      };
    },
  };
  return {
    calls,
    options: {
      env,
      authenticate: async () => ({ db, user: { id: 'verified-user' } }),
      getContext,
      generate: async (...args) => {
        calls.generate++;
        return generate(...args);
      },
    },
  };
}

test('chat returns 400 only for malformed JSON and invalid user payloads', async () => {
  const handler = createChatHandler({
    authenticate: () =>
      assert.fail('Invalid input must stop before auth or data work'),
  });
  for (const body of [
    '{',
    null,
    {},
    { message: '' },
    { message: 'x'.repeat(1501) },
  ]) {
    const res = response();
    await handler({ method: 'POST', body }, res);
    assert.equal(res.statusCode, 400);
  }
});

test('chat distinguishes catalog outages (503) from unexpected server errors (500) without leaking data', async (t) => {
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args));
  const failedCatalog = dependencies({
    catalogError: { message: 'PRIVATE_DATABASE_DETAILS' },
  });
  let res = response();
  await createChatHandler(failedCatalog.options)(
    { method: 'POST', body: { message: 'Find a course' } },
    res,
  );
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'catalog_unavailable');
  assert.equal(failedCatalog.calls.generate, 0);
  const failedContext = dependencies({
    getContext: async () => {
      throw Error('PRIVATE_DATABASE_DETAILS');
    },
  });
  res = response();
  await createChatHandler(failedContext.options)(
    { method: 'POST', body: { message: 'Find a course' } },
    res,
  );
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.code, 'assistant_unavailable');
  assert.match(res.headers['X-Prospecto-Request-Id'], /^[0-9a-f-]{36}$/);
  assert(
    !JSON.stringify([res.body, logs]).includes('PRIVATE_DATABASE_DETAILS'),
  );
});

test('gateway failures report 503 while retaining labelled catalog results and quota guards', async () => {
  const deps = dependencies({
    generate: async () => {
      throw Object.assign(Error('PRIVATE_PROVIDER_BODY'), { statusCode: 503 });
    },
  });
  const res = response();
  await createChatHandler(deps.options)(
    { method: 'POST', body: { message: 'Find a course' } },
    res,
  );
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.mode, 'catalog');
  assert(Array.isArray(res.body.references));
  assert.match(res.body.notice, /AI generation is unavailable/);
  assert(!JSON.stringify(res.body).includes('PRIVATE_PROVIDER_BODY'));
  assert.equal(deps.calls.quota, 1);
  assert.equal(deps.calls.generate, 1);
});

test('plan drafting accepts OIDC without an API key and returns an unsaved, validated draft', async () => {
  const deps = dependencies(),
    res = response();
  await createDevelopmentHandler(deps.options)(
    { method: 'POST', body: { goal: 'Learn materials', hours: 2 } },
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.draft.items.length, 1);
  assert.equal(deps.calls.quota, 1);
  assert.equal(deps.calls.generate, 1);
  assert.match(res.body.notice, /No plan has been changed/);
  assert(!JSON.stringify(res.body).includes('private-oidc'));
});

test('drafting configuration, invalid input, denied quota and quota-service outages never invoke AI', async () => {
  for (const [patch, body, expected] of [
    [
      { env: { AI_GATEWAY_MODEL: model } },
      { goal: 'Learn materials', hours: 2 },
      503,
    ],
    [{}, '{', 400],
    [{ allowed: false }, { goal: 'Learn materials', hours: 2 }, 429],
    [
      { quotaError: { message: 'PRIVATE_DATABASE_DETAILS' } },
      { goal: 'Learn materials', hours: 2 },
      503,
    ],
  ]) {
    const deps = dependencies(patch),
      res = response();
    await createDevelopmentHandler(deps.options)({ method: 'POST', body }, res);
    assert.equal(res.statusCode, expected);
    assert.equal(deps.calls.generate, 0);
    assert(!JSON.stringify(res.body).includes('PRIVATE_DATABASE_DETAILS'));
  }
});
