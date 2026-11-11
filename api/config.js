import { publicAuthConfig } from '../lib/auth.js';
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET')
    return res.status(405).json({ error: 'Method not allowed' });
  let auth;
  try {
    auth = publicAuthConfig();
  } catch {
    return res.status(503).json({
      error:
        'Authentication configuration is inconsistent. Contact the site owner.',
    });
  }
  return res.status(200).json({
    ...auth,
    aiConfigured: !!(
      process.env.AI_GATEWAY_MODEL &&
      (process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN)
    ),
  });
}
