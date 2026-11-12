import { removePrivateDocuments } from '../lib/account-cleanup.js';
import { createClient } from '@supabase/supabase-js';
import { publicAuthConfig, requireUser } from '../lib/auth.js';
export default async function handler(req, res) {
  if (!['GET', 'DELETE'].includes(req.method))
    return res.status(405).json({ error: 'Method not allowed' });
  const auth = await requireUser(req, res);
  if (!auth) return;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (req.method === 'GET')
    return res.status(200).json({ deletionConfigured: !!secret });
  if (!secret)
    return res.status(503).json({
      error:
        'Account deletion needs the site owner to configure the server-only Supabase secret. Individual records and files can be deleted now.',
    });
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid confirmation request.' });
  }
  if (body?.confirmation !== 'DELETE MY ACCOUNT')
    return res
      .status(400)
      .json({ error: 'Type DELETE MY ACCOUNT to confirm.' });
  const { data: recent, error } = await auth.db.rpc('has_recent_signin');
  if (error || !recent)
    return res.status(403).json({
      error: 'Sign in again within five minutes, then confirm deletion.',
      code: 'reauth_required',
    });
  try {
    // Never accept a user ID or path from the request.
    const admin = createClient(publicAuthConfig().supabaseUrl, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const bucket = admin.storage.from('profile-documents');
    await removePrivateDocuments(bucket, auth.user.id);
    const token = req.headers.authorization.match(/^Bearer (\S+)$/)[1];
    const { error: signOutError } = await admin.auth.admin.signOut(
      token,
      'global',
    );
    if (signOutError) throw signOutError;
    const { error: deleteError } = await admin.auth.admin.deleteUser(
      auth.user.id,
    );
    if (deleteError) throw deleteError;
    return res.status(200).json({ deleted: true });
  } catch {
    return res.status(503).json({
      error:
        'Deletion could not finish. Your account was not reported as deleted. Retry or contact the site owner.',
    });
  }
}
