export const RECOVERY_PATH = '/reset-password';
export const CALLBACK_PATH = '/auth/callback';
export function safeNext(value, origin) {
  try {
    const url = new URL(value || '/', origin);
    if (url.origin !== origin || url.pathname !== '/') return '/';
    const safe = new URL('/', origin);
    const opportunity = url.searchParams.get('opportunity');
    if (opportunity && /^[a-z0-9-]{1,120}$/.test(opportunity))
      safe.searchParams.set('opportunity', opportunity);
    if (
      /^#(explore|latest|saved|deadlines|universities|skills|careers|activities|assistant|sources)$/.test(
        url.hash,
      )
    )
      safe.hash = url.hash;
    return safe.pathname + safe.search + safe.hash;
  } catch {
    return '/';
  }
}
export function callbackKind(url) {
  const hash = new URLSearchParams(url.hash.slice(1));
  if (
    url.pathname === RECOVERY_PATH ||
    url.pathname === '/auth/update-password' ||
    hash.get('type') === 'recovery' ||
    url.hash === '#recovery'
  )
    return 'recovery';
  if (
    url.pathname === CALLBACK_PATH ||
    hash.has('access_token') ||
    url.searchParams.has('code')
  )
    return 'confirmation';
  return null;
}
export function authMessage(error) {
  switch (error?.code) {
    case 'email_not_confirmed':
      return 'Please check your inbox to confirm your account. You can resend the confirmation email below.';
    case 'invalid_credentials':
      return 'The email or password is incorrect. Use your ProspectoAI account, or reset your password. If you just registered, confirm your email first.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Too many email requests. Wait before trying again. If this continues, email delivery needs to be configured by the site owner.';
    case 'otp_expired':
    case 'flow_state_expired':
    case 'flow_state_not_found':
    case 'bad_code_verifier':
      return 'This link has expired, was already used, or was opened in a different browser. Request a fresh link below.';
    default:
      return (
        error?.message || 'The request could not be completed. Please retry.'
      );
  }
}
// URL tokens remain in memory only until Supabase stores the session. Never log them.
export async function consumeCallback(client, url) {
  const hash = new URLSearchParams(url.hash.slice(1));
  if (hash.has('error') || url.searchParams.has('error'))
    throw {
      code:
        hash.get('error_code') ||
        url.searchParams.get('error_code') ||
        'otp_expired',
    };
  const code = url.searchParams.get('code');
  if (code) {
    const result = await client.auth.exchangeCodeForSession(code);
    if (result.error) throw result.error;
    return result.data.session;
  }
  const access_token = hash.get('access_token'),
    refresh_token = hash.get('refresh_token');
  if (access_token && refresh_token) {
    const result = await client.auth.setSession({
      access_token,
      refresh_token,
    });
    if (result.error) throw result.error;
    return result.data.session;
  }
  const result = await client.auth.getSession();
  if (result.error) throw result.error;
  return result.data.session;
}
