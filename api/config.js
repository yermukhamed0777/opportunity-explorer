import { publicAuthConfig } from '../lib/auth.js';
import { isGatewayConfigured } from '../lib/ai-config.js';
export function createConfigHandler(env = process.env) {
  return function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET')
      return res.status(405).json({ error: 'Method not allowed' });
    let auth;
    try {
      auth = publicAuthConfig(env);
    } catch (error) {
      const missing = error.code === 'auth_not_configured';
      const localSetup = !env.VERCEL && env.NODE_ENV !== 'production';
      return res.status(503).json({
        code: missing ? 'auth_not_configured' : 'auth_config_invalid',
        error: localSetup
          ? 'Local account setup is incomplete. Check .env.local and restart npm run dev.'
          : 'Account service is not configured. Contact the site owner.',
        ...(localSetup
          ? { localSetup: true, missing: error.missing || [] }
          : {}),
      });
    }
    return res.status(200).json({
      ...auth,
      aiConfigured: isGatewayConfigured(env),
    });
  };
}
export default createConfigHandler();
