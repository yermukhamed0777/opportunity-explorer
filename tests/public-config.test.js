import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import { createConfigHandler } from '../api/config.js';
import { publicAuthConfig } from '../lib/auth.js';
import { authClient } from '../src/auth-client.js';

const valid = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
};
function configResponse(env) {
  const res = {
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
  };
  createConfigHandler(env)({ method: 'GET' }, res);
  return res;
}

test('missing and partial public configuration return actionable local diagnostics without values', () => {
  for (const [env, missing] of [
    [{}, ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY']],
    [{ SUPABASE_URL: valid.SUPABASE_URL }, ['SUPABASE_PUBLISHABLE_KEY']],
    [
      { SUPABASE_PUBLISHABLE_KEY: valid.SUPABASE_PUBLISHABLE_KEY },
      ['SUPABASE_URL'],
    ],
  ]) {
    assert.throws(
      () => publicAuthConfig(env),
      (e) => e.code === 'auth_not_configured',
    );
    const res = configResponse({
      ...env,
      SUPABASE_SECRET_KEY: 'secret-never-public',
    });
    assert.equal(res.statusCode, 503);
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.equal(res.body.code, 'auth_not_configured');
    assert.equal(res.body.localSetup, true);
    assert.deepEqual(res.body.missing, missing);
    assert(!JSON.stringify(res.body).includes('secret-never-public'));
    assert(!('supabaseKey' in res.body));
  }
});

test('valid public configuration exposes only public values and an OIDC-aware capability flag', () => {
  for (const credential of [
    { AI_GATEWAY_API_KEY: 'private-gateway' },
    { VERCEL_OIDC_TOKEN: 'private-oidc' },
  ]) {
    const res = configResponse({
      ...valid,
      ...credential,
      AI_GATEWAY_MODEL: 'openai/gpt-4.1-nano',
      SUPABASE_SECRET_KEY: 'private-service',
      CRON_SECRET: 'private-cron',
      BLOB_READ_WRITE_TOKEN: 'private-storage',
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, {
      supabaseUrl: valid.SUPABASE_URL,
      supabaseKey: valid.SUPABASE_PUBLISHABLE_KEY,
      aiConfigured: true,
    });
    assert(!JSON.stringify(res.body).includes('private-'));
  }
  assert.equal(
    configResponse({ ...valid, AI_GATEWAY_MODEL: 'openai/gpt-4.1-nano' }).body
      .aiConfigured,
    false,
  );
  assert.equal(
    configResponse({ ...valid, VERCEL_OIDC_TOKEN: 'private-oidc' }).body
      .aiConfigured,
    false,
  );
});

test('invalid public keys and conflicting origins fail closed; production diagnostics omit local setup', () => {
  for (const patch of [
    { SUPABASE_PUBLISHABLE_KEY: 'sb_secret_never-public' },
    { SUPABASE_PUBLISHABLE_KEY: 'unrecognized-private-key' },
    { NEXT_PUBLIC_SUPABASE_URL: 'https://other.supabase.co' },
  ]) {
    const res = configResponse({ ...valid, ...patch, VERCEL: '1' });
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, 'auth_config_invalid');
    assert(!JSON.stringify(res.body).includes('never-public'));
    assert(!('localSetup' in res.body));
  }
  assert(!('localSetup' in configResponse({ NODE_ENV: 'production' }).body));
});

test('auth client never creates a Supabase client for missing or partial config', async () => {
  for (const env of [
    {},
    { SUPABASE_URL: valid.SUPABASE_URL },
    { SUPABASE_PUBLISHABLE_KEY: valid.SUPABASE_PUBLISHABLE_KEY },
  ]) {
    const res = configResponse(env);
    await assert.rejects(
      authClient({
        fetcher: async () => ({ ok: false, json: async () => res.body }),
        clientFactory: () =>
          assert.fail('Incomplete config must not create a client'),
      }),
      (e) =>
        e.code === 'auth_not_configured' &&
        /\.env\.local/.test(e.message) &&
        /SUPABASE_PUBLISHABLE_KEY/.test(e.message),
    );
  }
});

test('auth client initializes valid config and suppresses unexpected server error content', async () => {
  const res = configResponse(valid),
    sentinel = {};
  const result = await authClient({
    fetcher: async (url, options) => {
      assert.equal(url, '/api/config');
      assert.equal(options.cache, 'no-store');
      return { ok: true, json: async () => res.body };
    },
    clientFactory: (url, key, options) => {
      assert.equal(url, valid.SUPABASE_URL);
      assert.equal(key, valid.SUPABASE_PUBLISHABLE_KEY);
      assert.equal(options.auth.detectSessionInUrl, false);
      return sentinel;
    },
  });
  assert.equal(result.client, sentinel);
  await assert.rejects(
    authClient({
      fetcher: async () => ({
        ok: false,
        json: async () => ({ error: 'PRIVATE_TOKEN_AND_CV' }),
      }),
    }),
    (e) =>
      !e.message.includes('PRIVATE_TOKEN_AND_CV') &&
      e.code === 'auth_unavailable',
  );
});

test('missing config renders a setup banner with all sign-in and recovery forms disabled', async () => {
  const w = new Window({ url: 'http://localhost:4173/login' });
  try {
    w.document.write(
      readFileSync('dist/auth.html', 'utf8').replace(
        /<script\b[^>]*>[\s\S]*?<\/script>/gi,
        '',
      ),
    );
    w.fetch = async () => ({
      ok: false,
      json: async () => configResponse({}).body,
    });
    w.eval(readFileSync('dist/auth-page.js', 'utf8'));
    await w.happyDOM.whenAsyncComplete();
    assert.match(
      w.document.querySelector('#auth-title').textContent,
      /setup needed/,
    );
    const banner = w.document.querySelector('#auth-status');
    assert.equal(banner.getAttribute('role'), 'alert');
    assert.match(banner.textContent, /\.env\.example.*\.env\.local/);
    assert([...w.document.querySelectorAll('form')].every((f) => f.hidden));
    assert(
      [...w.document.querySelectorAll('form input, form button')].every(
        (el) => el.disabled,
      ),
    );
    assert.equal(w.document.querySelector('#auth-retry').hidden, false);
  } finally {
    await w.happyDOM.close();
  }
});
