import { readFileSync } from 'node:fs';
import { validateContent } from '../lib/intelligence-core.js';
import { approvedHosts } from '../lib/intelligence-data.js';
const data = JSON.parse(readFileSync('data/intelligence.json'));
for (const r of data.records) validateContent(r, approvedHosts);
const quote = (s) => "'" + String(s).replaceAll("'", "''") + "'";
const sql = [];
// Idempotent initial seed: existing reviewed administrator publications are never replaced.
for (let i = 0; i < data.records.length; i += 40) {
  const batch = data.records.slice(i, i + 40);
  sql.push(
    `insert into public.intelligence_records(id,kind,payload,status,checked_on) select r->>'id',r->>'kind',r,case when r->>'status'='Archived' then 'Archived' else 'Published' end,(r->>'checkedOn')::date from jsonb_array_elements(${quote(JSON.stringify(batch))}::jsonb) r where not exists(select 1 from public.intelligence_records old where old.id=r->>'id');`,
  );
}
for (const r of data.reviewQueue) {
  const url = r.sources?.[0]?.[1];
  if (!url) continue;
  sql.push(
    `insert into public.content_candidates(record_id,source_url,proposal,notes) select ${quote(r.id)},${quote(url)},${quote(JSON.stringify(r))}::jsonb,${quote(r.reason || 'Needs source verification')} where not exists(select 1 from public.content_candidates where record_id=${quote(r.id)} and source_url=${quote(url)});`,
  );
}
process.stdout.write(sql.join('\n') + '\n');
