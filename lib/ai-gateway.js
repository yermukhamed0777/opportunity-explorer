import { randomUUID } from 'node:crypto';
import { generateText } from 'ai';

// These are reviewed model choices, not visitor-controlled routing or credentials.
export const FALLBACK_MODEL = 'openai/gpt-4.1-nano';
const MODEL = /^[a-z0-9][a-z0-9.-]*\/[a-z0-9][a-z0-9._/-]{1,100}$/;
const CODES = new Set([
  'authentication_error',
  'invalid_api_key',
  'forbidden',
  'access_denied',
  'permission_denied',
  'model_access_denied',
  'model_not_found',
  'customer_verification_required',
  'insufficient_funds',
  'quota_for_entity_exceeded',
  'rate_limit_exceeded',
  'internal_server_error',
  'provider_unavailable',
  'unsupported_country_region_territory',
  'location_not_supported',
  'content_policy_violation',
  'invalid_request_error',
]);
const PROVIDERS = new Set([
  'google',
  'vertex',
  'openai',
  'anthropic',
  'bedrock',
  'azure',
  'groq',
  'cerebras',
  'together',
  'fireworks',
]);
const safeModel = (v) =>
  typeof v === 'string' && MODEL.test(v) ? v : 'not_configured';
const safeId = (v) =>
  typeof v === 'string' &&
  /^(?:gen|req|chatcmpl)[_-][a-zA-Z0-9_-]{6,100}$/.test(v)
    ? v
    : null;

export function gatewayDiagnostic(error, { model, requestId } = {}) {
  const nodes = [],
    seen = new Set(),
    queue = [error];
  while (queue.length && nodes.length < 12) {
    const value = queue.shift();
    if (!value || typeof value !== 'object' || seen.has(value)) continue;
    seen.add(value);
    nodes.push(value);
    for (const key of ['cause', 'error', 'data', 'response'])
      if (value[key] && typeof value[key] === 'object') queue.push(value[key]);
    if (
      typeof value.responseBody === 'string' &&
      value.responseBody.length < 16000
    ) {
      try {
        queue.push(JSON.parse(value.responseBody));
      } catch {}
    }
  }
  let errorCode =
    nodes.flatMap((n) => [n.code, n.type]).find((v) => CODES.has(v)) ||
    'unknown_gateway_error';
  const status =
    nodes
      .map((n) => n.statusCode ?? n.status)
      .find((v) => Number.isInteger(v) && v >= 400 && v <= 599) || null;
  // Never log raw vendor messages: providers can echo prompts, tokens or CV text.
  const message = nodes
    .map((n) =>
      typeof n.message === 'string'
        ? n.message.slice(0, 4000).toLowerCase()
        : '',
    )
    .join(' ');
  let providerMessage;
  if (
    /unsupported.*(?:country|region|location)|(?:country|region|location).*not supported/.test(
      message,
    )
  ) {
    errorCode = 'location_not_supported';
    providerMessage = 'The provider does not support this request location.';
  } else if (
    /customer.verification|verify.*(?:customer|payment)|payment method.*required/.test(
      message,
    )
  ) {
    errorCode = 'customer_verification_required';
    providerMessage = 'The Gateway account requires owner verification.';
  } else if (
    /insufficient.*(?:fund|credit)|credit.*(?:exhaust|balance)/.test(message)
  ) {
    errorCode = 'insufficient_funds';
    providerMessage = 'The Gateway credit balance is insufficient.';
  } else if (
    /quota|budget.*(?:exceed|exhaust)/.test(message) ||
    errorCode === 'quota_for_entity_exceeded'
  ) {
    errorCode = 'quota_for_entity_exceeded';
    providerMessage = 'The Gateway quota or budget has been reached.';
  } else if (
    /api.key.*(?:invalid|revoked)|invalid.*api.key|authentication/.test(
      message,
    ) ||
    status === 401
  ) {
    errorCode = 'authentication_error';
    providerMessage =
      'The Gateway could not authenticate its configured credential.';
  } else if (
    /model.*(?:not found|not available|not enabled|not permitted|access denied)/.test(
      message,
    ) ||
    errorCode === 'model_not_found'
  ) {
    providerMessage =
      'The requested model is unavailable or not permitted for this account.';
  } else if (status === 403) {
    providerMessage =
      'The Gateway or provider denied access; no more specific safe reason was returned.';
  } else if (status === 429) {
    errorCode = 'rate_limit_exceeded';
    providerMessage = 'The Gateway rate limit was reached.';
  } else if (
    nodes.some((n) => ['AbortError', 'TimeoutError'].includes(n.name))
  ) {
    errorCode = 'request_timeout';
    providerMessage = 'The model request exceeded the bounded time limit.';
  } else {
    providerMessage =
      'The model request failed; private provider error text was withheld.';
  }
  const provider = nodes
    .map((n) => n.provider ?? n.providerName)
    .find((v) => PROVIDERS.has(v));
  return {
    requestId: /^[0-9a-f-]{36}$/.test(requestId || '') ? requestId : null,
    errorCode,
    status,
    model: safeModel(model),
    provider: provider || 'not_reported',
    modelPublisher: safeModel(model).split('/')[0],
    gatewayRequestId:
      nodes.map((n) => safeId(n.generationId ?? n.requestId)).find(Boolean) ||
      null,
    providerMessage,
  };
}

export async function gatewayAccess({
  env = process.env,
  fetcher = fetch,
} = {}) {
  const model = safeModel(env.AI_GATEWAY_MODEL),
    candidates = [...new Set([model, FALLBACK_MODEL])].filter(
      (x) => x !== 'not_configured',
    ),
    credential = env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN;
  const result = {
    checkedAt: new Date().toISOString(),
    credentialMode: env.AI_GATEWAY_API_KEY
      ? 'api-key'
      : env.VERCEL_OIDC_TOKEN
        ? 'oidc'
        : 'missing',
    httpStatus: null,
    requestAvailable: 'unknown',
    models: candidates.map((id) => ({
      id,
      found: false,
      eligibility: 'unknown',
      reason: null,
    })),
  };
  if (!credential) return result;
  try {
    const response = await fetcher(
      'https://ai-gateway.vercel.sh/v1/models?include_availability=true',
      {
        headers: { Authorization: 'Bearer ' + credential },
        signal: AbortSignal.timeout(5000),
      },
    );
    result.httpStatus = response.status;
    const body = await response.json();
    if (!response.ok) {
      result.error = gatewayDiagnostic(
        { ...body, statusCode: response.status },
        { model },
      );
      return result;
    }
    const context = body.request_context_availability,
      http = context?.http || context;
    if (['available', 'unavailable', 'unknown'].includes(http?.status))
      result.requestAvailable = http.status;
    result.models = candidates.map((id) => {
      const entry = body.data?.find((m) => m.id === id),
        eligibility = entry?.model_eligibility;
      return {
        id,
        found: !!entry,
        eligibility: ['eligible', 'ineligible', 'unknown'].includes(
          eligibility?.status,
        )
          ? eligibility.status
          : 'unknown',
        reason: CODES.has(eligibility?.reason)
          ? eligibility.reason
          : eligibility?.reason
            ? 'provider_policy_or_configuration'
            : null,
      };
    });
  } catch (error) {
    result.error = gatewayDiagnostic(error, { model });
  }
  return result;
}

export async function generateWithFallback(
  options,
  {
    requestId = randomUUID(),
    env = process.env,
    generate = generateText,
    access = gatewayAccess,
    logger = console,
  } = {},
) {
  const primary = safeModel(env.AI_GATEWAY_MODEL);
  if (primary === 'not_configured') throw Error('AI model not configured.');
  let model = primary,
    usedFallback = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await generate({
        ...options,
        model,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(12000),
      });
      logger.info('AI gateway request completed', {
        requestId,
        model,
        usedFallback,
      });
      return { ...result, aiModel: model, usedFallback, requestId };
    } catch (error) {
      const diagnostic = gatewayDiagnostic(error, { model, requestId });
      logger.error('AI gateway request failed', diagnostic);
      const blocked =
        [401, 402].includes(diagnostic.status) ||
        [
          'authentication_error',
          'invalid_api_key',
          'insufficient_funds',
          'customer_verification_required',
          'quota_for_entity_exceeded',
          'content_policy_violation',
          'location_not_supported',
        ].includes(diagnostic.errorCode);
      if (attempt || blocked || primary === FALLBACK_MODEL) throw error;
      const availability = await access({ env });
      const fallback = availability.models.find(
        (m) =>
          m.id === FALLBACK_MODEL && m.found && m.eligibility === 'eligible',
      );
      if (!fallback || availability.requestAvailable === 'unavailable')
        throw error;
      // The same Gateway credential, policies, quota reservation and grounded prompt apply.
      model = fallback.id;
      usedFallback = true;
    }
  }
}
