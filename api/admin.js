import { requireUser } from '../lib/auth.js';
import {
  intelligence,
  approvedHosts,
  sourceRegistry,
} from '../lib/intelligence-data.js';
import {
  validateContent,
  contentTotals,
  cycleStatus,
} from '../lib/intelligence-core.js';
import { readContentReport, refreshContent } from '../lib/content-updates.js';
export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method))
    return res.status(405).json({ error: 'Method not allowed' });
  const auth = await requireUser(req, res);
  if (!auth) return;
  const { db } = auth;
  const admin = await db.rpc('is_content_admin');
  if (admin.error || !admin.data)
    return res.status(403).json({
      error: 'Administrator access required.',
      code: 'admin_required',
    });
  try {
    if (req.method === 'GET') {
      const [records, versions, candidates, snapshot] = await Promise.all([
        db.from('intelligence_records').select('*').order('id').range(0, 999),
        db
          .from('content_versions')
          .select(
            'id,record_id,version,before_payload,after_payload,old_status,new_status,changed_at',
          )
          .order('id', { ascending: false })
          .limit(100),
        db
          .from('content_candidates')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
        db.rpc('admin_system_snapshot'),
      ]);
      if ([records, versions, candidates, snapshot].some((x) => x.error))
        throw Error('The admin database snapshot could not load.');
      let report = null,
        reportError = null;
      try {
        report = await readContentReport();
      } catch {
        reportError =
          'Source report unavailable; published records remain intact.';
      }
      return res.status(200).json({
        records: records.data,
        versions: versions.data,
        candidates: candidates.data,
        snapshot: snapshot.data,
        report,
        reportError,
        totals: contentTotals(
          records.data.map((r) => ({
            ...r.payload,
            status: r.status === 'Archived' ? 'Archived' : r.payload.status,
          })),
        ),
        health: {
          supabase: 'Ready',
          auth: 'Ready: this request has a confirmed session',
          redirects:
            'Warning: hosted allowlist requires dashboard verification',
          smtp: 'Needs setup: delivery not verified',
          ai:
            process.env.AI_GATEWAY_API_KEY && process.env.AI_GATEWAY_MODEL
              ? 'Warning: configured; verify actual generation'
              : 'Not configured',
          accountDeletion: process.env.SUPABASE_SECRET_KEY
            ? 'Warning: configured; verify deletion'
            : 'Needs setup',
          scheduler: process.env.CRON_SECRET
            ? 'Warning: daily job configured; check latest successful run'
            : 'Not configured',
          commit:
            process.env.VERCEL_GIT_COMMIT_SHA ||
            process.env.VERCEL_GIT_PROVIDER_COMMIT_SHA ||
            'See Vercel deployment metadata',
        },
        approvedSources: sourceRegistry().length,
      });
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || JSON.stringify(body).length > 90000)
      return res.status(400).json({ error: 'Request too large.' });
    if (body.action === 'refresh') {
      const report = await refreshContent(
        intelligence.records,
        sourceRegistry(),
      );
      return res.status(200).json({
        checked: report.checked,
        status: report.status,
        runAt: report.runAt,
      });
    }
    if (body.action === 'reject') {
      const { error } = await db
        .from('content_candidates')
        .update({
          state: 'Rejected',
          notes: String(body.notes || '').slice(0, 1999),
        })
        .eq('id', body.id);
      if (error) throw Error('The candidate could not be rejected.');
      return res.status(200).json({ saved: true });
    }
    if (body.action === 'stage') {
      const record = validateContent(body.record, approvedHosts);
      const { error } = await db.from('content_candidates').insert({
        record_id: record.id,
        source_url: record.sources[0][1],
        proposal: record,
        notes: 'Manual administrator proposal',
      });
      if (error) throw Error('The candidate could not be staged.');
      return res.status(200).json({ saved: true });
    }
    let record = body.record;
    if (body.action === 'restore') {
      const { data, error } = await db
        .from('content_versions')
        .select('after_payload,new_status')
        .eq('id', body.versionId)
        .single();
      if (error || !data) throw Error('Version not found.');
      record = {
        ...data.after_payload,
        status:
          data.new_status === 'Archived'
            ? 'Archived'
            : data.after_payload.status,
      };
      if (cycleStatus(record) === 'Previous cycle')
        record.status = 'Previous cycle';
    }
    if (
      !['publish', 'restore', 'archive'].includes(body.action) ||
      body.attestation !== true
    )
      return res.status(400).json({
        error:
          'Review the official sources and confirm the accuracy attestation before publishing.',
      });
    validateContent(record, approvedHosts);
    const { data: version, error } = await db.rpc('publish_intelligence', {
      record,
      expected_version: Number(body.expectedVersion),
    });
    if (error)
      return res.status(409).json({
        error:
          'The record changed or could not be saved. Reload the current version and retry.',
      });
    if (body.candidateId)
      await db
        .from('content_candidates')
        .update({ state: 'Approved' })
        .eq('id', body.candidateId);
    return res.status(200).json({ saved: true, version });
  } catch (error) {
    return res.status(400).json({
      error: String(error.message || 'Administration request failed.').slice(
        0,
        300,
      ),
    });
  }
}
