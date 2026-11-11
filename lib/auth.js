import { createClient } from '@supabase/supabase-js';

export function publicAuthConfig(env = process.env) {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key =
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';
  const urls = [env.SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_URL].filter(Boolean);
  const keys = [
    env.SUPABASE_PUBLISHABLE_KEY,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ].filter(Boolean);
  if (new Set(urls).size > 1 || new Set(keys).size > 1)
    throw Error('Conflicting public authentication configuration.');
  if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))
    throw Error('Invalid authentication origin.');
  if (key.startsWith('sb_secret_'))
    throw Error('A server secret cannot be used as a browser key.');
  if (key.startsWith('eyJ')) {
    const claims = JSON.parse(
      Buffer.from(key.split('.')[1], 'base64url').toString(),
    );
    if (claims.role !== 'anon')
      throw Error('Only a publishable or anonymous browser key is allowed.');
  }
  return { supabaseUrl: url, supabaseKey: key };
}

// A hidden panel is only a UI boundary. Every data API validates the user here.
export async function requireUser(req, res, clientFactory = createClient) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Vary', 'Authorization');
  const token = req.headers?.authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) {
    res
      .status(401)
      .json({ error: 'Sign in to use ProspectoAI.', code: 'login_required' });
    return null;
  }
  try {
    const config = publicAuthConfig();
    if (!config.supabaseUrl || !config.supabaseKey)
      throw Error('Missing configuration');
    const db = clientFactory(config.supabaseUrl, config.supabaseKey, {
      global: { headers: { Authorization: 'Bearer ' + token } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await db.auth.getUser(token);
    if (error || !data?.user || data.user.is_anonymous) {
      res.status(401).json({
        error: 'Your session expired. Sign in again.',
        code: 'invalid_session',
      });
      return null;
    }
    if (!data.user.email_confirmed_at) {
      res.status(403).json({
        error: 'Please check your inbox to confirm your account.',
        code: 'email_not_confirmed',
      });
      return null;
    }
    return { db, user: data.user };
  } catch {
    res.status(503).json({
      error: 'Authentication service temporarily unavailable. Please retry.',
      code: 'auth_unavailable',
    });
    return null;
  }
}
