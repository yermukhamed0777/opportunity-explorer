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
  if (!(await requireUser(req, res))) return;
  return res.status(200).json({ catalog, resources, development });
}
