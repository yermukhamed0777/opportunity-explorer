import { createClient } from '@supabase/supabase-js';
export async function authClient({
  fetcher = fetch,
  clientFactory = createClient,
} = {}) {
  const response = await fetcher('/api/config', { cache: 'no-store' });
  const config = await response.json().catch(() => ({}));
  if (!response.ok || !config.supabaseUrl || !config.supabaseKey) {
    const setup = ['auth_not_configured', 'auth_config_invalid'].includes(
      config.code,
    );
    throw Object.assign(
      new Error(
        setup && config.localSetup === true
          ? 'Local setup required: copy .env.example to .env.local, set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY for the same Supabase project, then restart npm run dev. Use the publishable key, never a secret or service-role key.'
          : setup
            ? 'Account service is not configured. Contact the site owner.'
            : 'Account service temporarily unavailable. Please retry.',
      ),
      { code: setup ? config.code : 'auth_unavailable' },
    );
  }
  const client = clientFactory(config.supabaseUrl, config.supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'implicit',
    },
  });
  return { client, config };
}
