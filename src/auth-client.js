import { createClient } from '@supabase/supabase-js';
export async function authClient() {
  const response = await fetch('/api/config', { cache: 'no-store' });
  if (!response.ok)
    throw Error('Account service temporarily unavailable. Please retry.');
  const config = await response.json();
  if (!config.supabaseUrl || !config.supabaseKey)
    throw Error('Account service is not configured.');
  const client = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'implicit',
    },
  });
  return { client, config };
}
