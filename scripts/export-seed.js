import { readFileSync, writeFileSync } from 'node:fs';
const resources = JSON.parse(readFileSync('data/resources.json'));
const catalog = JSON.parse(readFileSync('data/opportunities.json'));
const development = JSON.parse(readFileSync('data/development.json'));
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
const rows = [];
for (const [kind, key] of [
  ['skill', 'skills'],
  ['university', 'universities'],
  ['course', 'courses'],
  ['career', 'careers'],
])
  for (const item of resources[key])
    rows.push([kind + ':' + item.id, kind, item, item.checkedOn, 'active']);
const today = new Date().toISOString().slice(0, 10);
for (const item of catalog.opportunities)
  rows.push([
    'opportunity:' + item.id,
    'opportunity',
    item,
    item.checkedOn,
    item.archived
      ? 'archived'
      : item.finalDeadline && item.finalDeadline < today
        ? 'expired'
        : 'active',
  ]);
for (const [prefix, kind, items] of [
  ['map', 'skill', development.skillMaps],
  ['pathway', 'career', development.pathways],
  ['programme', 'opportunity', development.opportunities],
])
  for (const item of items)
    rows.push([
      prefix + ':' + item.id,
      kind,
      item,
      item.checkedOn,
      item.closed || (item.finalDeadline && item.finalDeadline < today)
        ? 'expired'
        : 'active',
    ]);
const sql =
  '-- Source-backed public records only. No users, credentials or invented examples.\ninsert into public.resources(id,kind,payload,checked_on,status) values\n' +
  rows
    .map(
      ([id, kind, payload, date, state]) =>
        '(' +
        [
          quote(id),
          quote(kind),
          quote(JSON.stringify(payload)) + '::jsonb',
          quote(date) + '::date',
          quote(state),
        ].join(',') +
        ')',
    )
    .join(',\n') +
  '\non conflict(id) do update set kind=excluded.kind,payload=excluded.payload,checked_on=excluded.checked_on,status=excluded.status,published_at=now();\n';
writeFileSync('supabase/seed.sql', sql);
console.log('Exported ' + rows.length + ' public resource records.');
