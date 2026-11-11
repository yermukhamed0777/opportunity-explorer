import test from 'node:test';
import assert from 'node:assert/strict';
import {
  safeNext,
  callbackKind,
  consumeCallback,
  authMessage,
} from '../src/auth-flow.js';
import { requireUser, publicAuthConfig } from '../lib/auth.js';
import { createPreviewServer } from '../scripts/dev-server.js';
import { once } from 'node:events';
const origin = 'https://opportunity-explorer-ruddy.vercel.app';
const response = () => ({
  statusCode: 200,
  setHeader() {},
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(value) {
    this.body = value;
    return this;
  },
});
test('return paths cannot redirect to external sites, auth pages or token fragments', () => {
  for (const value of [
    'https://evil.example/',
    '//evil.example/',
    '/login',
    '/reset-password',
    '/#access_token=secret',
    '/?code=secret',
  ])
    assert.equal(safeNext(value, origin), '/');
  assert.equal(safeNext('/#universities', origin), '/#universities');
  assert.equal(
    safeNext('/?opportunity=research-science-institute#explore', origin),
    '/?opportunity=research-science-institute#explore',
  );
});
test('recovery and confirmation links route independently of transient auth events', async () => {
  assert.equal(
    callbackKind(new URL(origin + '/#access_token=example&type=recovery')),
    'recovery',
  );
  assert.equal(
    callbackKind(new URL(origin + '/reset-password?code=example')),
    'recovery',
  );
  assert.equal(
    callbackKind(new URL(origin + '/auth/callback?code=example')),
    'confirmation',
  );
  const calls = [];
  const client = {
    auth: {
      setSession: async (value) => {
        calls.push(['implicit', value]);
        return { data: { session: { user: { id: 'one' } } } };
      },
      exchangeCodeForSession: async (code) => {
        calls.push(['pkce', code]);
        return { data: { session: { user: { id: 'two' } } } };
      },
    },
  };
  assert.equal(
    (
      await consumeCallback(
        client,
        new URL(
          origin +
            '/reset-password#access_token=a&refresh_token=b&type=recovery',
        ),
      )
    ).user.id,
    'one',
  );
  assert.equal(
    (await consumeCallback(client, new URL(origin + '/reset-password?code=c')))
      .user.id,
    'two',
  );
  assert.equal(calls.length, 2);
  await assert.rejects(
    () =>
      consumeCallback(
        client,
        new URL(
          origin + '/reset-password#error=access_denied&error_code=otp_expired',
        ),
      ),
    (error) => error.code === 'otp_expired',
  );
  assert.match(
    authMessage({ code: 'email_not_confirmed' }),
    /Please check your inbox to confirm your account/,
  );
  assert.match(authMessage({ code: 'invalid_credentials' }), /incorrect/);
});
test('API gate rejects missing, invalid, anonymous and unconfirmed sessions', async () => {
  let res = response();
  let called = false;
  assert.equal(
    await requireUser({ headers: {} }, res, () => {
      called = true;
    }),
    null,
  );
  assert.equal(res.statusCode, 401);
  assert.equal(called, false);
  const before = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  };
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  try {
    for (const [user, error, code] of [
      [null, { message: 'bad' }, 401],
      [{ id: 'one', is_anonymous: true }, null, 401],
      [{ id: 'one' }, null, 403],
      [{ id: 'one', email_confirmed_at: '2026-11-11' }, null, 200],
    ]) {
      res = response();
      const factory = () => ({
        auth: { getUser: async () => ({ data: { user }, error }) },
      });
      const result = await requireUser(
        { headers: { authorization: 'Bearer example' } },
        res,
        factory,
      );
      assert.equal(res.statusCode, code);
      assert.equal(!!result, code === 200);
    }
  } finally {
    for (const [key, value] of Object.entries(before))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  }
});
test('public configuration refuses mismatched projects and privileged keys', () => {
  assert.throws(() =>
    publicAuthConfig({
      SUPABASE_URL: 'https://one.supabase.co',
      NEXT_PUBLIC_SUPABASE_URL: 'https://two.supabase.co',
    }),
  );
  assert.throws(() =>
    publicAuthConfig({ SUPABASE_PUBLISHABLE_KEY: 'sb_secret_test' }),
  );
  const serviceKey =
    'eyJ.' +
    Buffer.from(JSON.stringify({ role: 'service_role' })).toString(
      'base64url',
    ) +
    '.signature';
  assert.throws(() =>
    publicAuthConfig({ SUPABASE_PUBLISHABLE_KEY: serviceKey }),
  );
});
test('auth routes load directly; private catalogs and APIs cannot be fetched without login', async () => {
  const server = createPreviewServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    for (const path of ['/login', '/reset-password', '/auth/callback']) {
      const r = await fetch(base + path);
      assert.equal(r.status, 200);
      assert.match(await r.text(), /update-password-form/);
    }
    for (const path of [
      '/opportunities.json',
      '/resources.json',
      '/feed-snapshot.json',
      '/data.js',
      '/resource-data.js',
    ])
      assert.equal((await fetch(base + path)).status, 404);
    for (const path of ['/api/catalog', '/api/discover', '/api/renewal']) {
      const r = await fetch(base + path);
      assert.equal(r.status, 401);
      assert.equal(r.headers.get('cache-control'), 'private, no-store');
    }
    const r = await fetch(base + '/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'materials' }),
    });
    assert.equal(r.status, 401);
  } finally {
    server.close();
    await once(server, 'close');
  }
});
