export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET')
    return res.status(405).json({ error: 'Method not allowed' });
  return res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseKey: process.env.SUPABASE_PUBLISHABLE_KEY || '',
    aiConfigured: !!(
      process.env.AI_GATEWAY_MODEL &&
      (process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN)
    ),
  });
}
