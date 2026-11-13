import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gatewayDiagnostic,
  gatewayAccess,
  generateWithFallback,
  FALLBACK_MODEL,
} from '../lib/ai-gateway.js';
const model = 'google/gemini-3.1-flash-lite';
const requestId = '7e913803-8d12-4bdc-8c6c-31cdb433dc6d';

test('Gateway diagnostics never emit raw provider bodies, prompts, credentials or private data', () => {
  const privateText =
    'private-cv@example.com SECRET_API_KEY Bearer xyz access_token=secret Prompt: private CV';
  const error = new Error(privateText);
  error.statusCode = 403;
  error.cause = {
    responseBody: JSON.stringify({
      error: { type: 'forbidden', message: privateText, provider: 'google' },
      generationId: 'gen_123456789abc',
    }),
    authorization: privateText,
  };
  error.cause.cause = error;
  const result = gatewayDiagnostic(error, { model, requestId });
  assert.equal(result.errorCode, 'forbidden');
  assert.equal(result.provider, 'google');
  assert.equal(result.gatewayRequestId, 'gen_123456789abc');
  assert.equal(result.requestId, requestId);
  assert.equal(result.status, 403);
  assert(
    !/private-cv|SECRET_API_KEY|Bearer|access_token|private CV/.test(
      JSON.stringify(result),
    ),
  );
  const hostile = gatewayDiagnostic(
    { code: privateText, provider: privateText },
    { model: privateText, requestId: privateText },
  );
  assert.equal(hostile.model, 'not_configured');
  assert.equal(hostile.requestId, null);
  assert(!JSON.stringify(hostile).includes(privateText));
});

test('Gateway messages normalize region, owner verification and credit failures without echoing provider text', () => {
  for (const [message, expected] of [
    ['This location is not supported', 'location_not_supported'],
    ['customer verification required', 'customer_verification_required'],
    ['Insufficient credits', 'insufficient_funds'],
    ['invalid API key', 'authentication_error'],
  ])
    assert.equal(gatewayDiagnostic({ message }).errorCode, expected);
});

test('team access checks use the existing credential and return only selected public model metadata', async () => {
  let called = 0;
  const result = await gatewayAccess({
    env: { AI_GATEWAY_MODEL: model, AI_GATEWAY_API_KEY: 'private-key' },
    fetcher: async (url, options) => {
      called++;
      assert.equal(
        url,
        'https://ai-gateway.vercel.sh/v1/models?include_availability=true',
      );
      assert.equal(options.headers.Authorization, 'Bearer private-key');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          request_context_availability: {
            http: { status: 'available', secret: 'private-key' },
          },
          data: [
            {
              id: model,
              model_eligibility: {
                status: 'ineligible',
                reason: 'model_access_denied',
              },
            },
            { id: FALLBACK_MODEL, model_eligibility: { status: 'eligible' } },
          ],
        }),
      };
    },
  });
  assert.equal(called, 1);
  assert.equal(result.requestAvailable, 'available');
  assert.equal(result.models[0].eligibility, 'ineligible');
  assert.equal(result.models[1].eligibility, 'eligible');
  assert(!JSON.stringify(result).includes('private-key'));
});

test('one eligible fallback preserves the grounded prompt and request ID and logs no private options', async () => {
  const calls = [],
    logs = [];
  const result = await generateWithFallback(
    {
      prompt: 'PRIVATE_PROMPT',
      system: 'grounding rules',
      maxOutputTokens: 1200,
    },
    {
      env: { AI_GATEWAY_MODEL: model },
      requestId,
      logger: {
        info: (...args) => logs.push(args),
        error: (...args) => logs.push(args),
      },
      access: async () => ({
        requestAvailable: 'available',
        models: [{ id: FALLBACK_MODEL, found: true, eligibility: 'eligible' }],
      }),
      generate: async (options) => {
        calls.push(options);
        if (calls.length === 1)
          throw Object.assign(new Error('Denied PRIVATE_PROMPT'), {
            statusCode: 403,
          });
        return { text: 'A grounded result' };
      },
    },
  );
  assert.deepEqual(
    calls.map((x) => x.model),
    [model, FALLBACK_MODEL],
  );
  assert(
    calls.every(
      (x) =>
        x.prompt === 'PRIVATE_PROMPT' &&
        x.system === 'grounding rules' &&
        x.maxRetries === 0,
    ),
  );
  assert.equal(result.usedFallback, true);
  assert.equal(result.requestId, requestId);
  assert(!JSON.stringify(logs).includes('PRIVATE_PROMPT'));
});

test('fallback never bypasses credentials, billing, regional restrictions or an ineligible/unknown model', async () => {
  for (const [status, message, eligibility, requestAvailable] of [
    [401, 'Denied', 'eligible', 'available'],
    [402, 'Denied', 'eligible', 'available'],
    [403, 'This location is not supported', 'eligible', 'available'],
    [403, 'Denied', 'ineligible', 'available'],
    [503, 'Unavailable', 'unknown', 'available'],
    [503, 'Unavailable', 'eligible', 'unavailable'],
  ]) {
    let calls = 0;
    await assert.rejects(
      generateWithFallback(
        { prompt: 'private' },
        {
          env: { AI_GATEWAY_MODEL: model },
          logger: { error() {}, info() {} },
          generate: async () => {
            calls++;
            throw Object.assign(new Error(message), { statusCode: status });
          },
          access: async () => ({
            requestAvailable,
            models: [{ id: FALLBACK_MODEL, found: true, eligibility }],
          }),
        },
      ),
    );
    assert.equal(calls, 1);
  }
});

test('fallback stops after a second failure and never retries indefinitely', async () => {
  let calls = 0;
  await assert.rejects(
    generateWithFallback(
      { prompt: 'private' },
      {
        env: { AI_GATEWAY_MODEL: model },
        logger: { error() {}, info() {} },
        generate: async () => {
          calls++;
          throw Object.assign(new Error('Unavailable'), { statusCode: 503 });
        },
        access: async () => ({
          requestAvailable: 'available',
          models: [
            { id: FALLBACK_MODEL, found: true, eligibility: 'eligible' },
          ],
        }),
      },
    ),
  );
  assert.equal(calls, 2);
});
