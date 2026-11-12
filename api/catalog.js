import { readFileSync } from 'node:fs';
import { requireUser } from '../lib/auth.js';
const catalog = JSON.parse(
  readFileSync(new URL('../data/opportunities.json', import.meta.url)),
);
const resources = JSON.parse(
  readFileSync(new URL('../data/resources.json', import.meta.url)),
);
const development = JSON.parse(
  readFileSync(new URL('../data/development.json', import.meta.url)),
);
export default async function handler(req, res) {
  if (req.method !== 'GET')
    return res.status(405).json({ error: 'Method not allowed' });
  const auth = await requireUser(req, res);
  if (!auth) return;
  const { data: rows, error } = await auth.db
    .from('intelligence_records')
    .select('id,kind,payload,status,version,updated_at')
    .order('id')
    .range(0, 999);
  if (error)
    return res
      .status(503)
      .json({ error: 'The expanded collection could not load. Please retry.' });
  const published = rows.map((r) => ({
    ...r.payload,
    id: r.id,
    kind: r.kind,
    version: r.version,
    publishedAt: r.updated_at,
    ...(r.status === 'Archived' ? { status: 'Archived' } : {}),
  }));
  const expandedCourses = published.filter(
    (r) => r.kind === 'course' && r.status !== 'Archived',
  );
  const liveResources = {
    ...resources,
    courses: expandedCourses.length ? expandedCourses : resources.courses,
  };
  return res.status(200).json({
    catalog,
    resources: liveResources,
    development,
    intelligence: { records: published },
  });
}
