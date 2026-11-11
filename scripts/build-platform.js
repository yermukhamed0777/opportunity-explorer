import { readFileSync, rmSync } from 'node:fs';
import { build } from 'esbuild';
const r = JSON.parse(readFileSync('data/resources.json', 'utf8'));
const ids = new Set();
for (const kind of ['skills', 'courses', 'careers', 'universities']) {
  if (!Array.isArray(r[kind]) || !r[kind].length)
    throw Error('Missing ' + kind);
  for (const entry of r[kind]) {
    if (
      !entry.id ||
      ids.has(kind + entry.id) ||
      !entry.name ||
      !/^\d{4}-\d{2}-\d{2}$/.test(entry.checkedOn)
    )
      throw Error('Invalid resource ' + kind);
    ids.add(kind + entry.id);
    for (const url of [
      entry.url,
      ...(entry.sources || []).map((s) => s[1]),
    ].filter(Boolean))
      if (new URL(url).protocol !== 'https:')
        throw Error('Unsafe resource URL');
  }
}
for (const s of r.skills)
  for (const c of s.courses)
    if (!r.courses.some((x) => x.id === c)) throw Error('Unknown course ' + c);
for (const name of ['platform', 'bootstrap', 'auth-page'])
  await build({
    entryPoints: ['src/' + name + '.js'],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2022'],
    outfile: 'dist/' + name + '.js',
    minify: true,
    legalComments: 'none',
  });
for (const file of [
  'dist/index.html',
  'dist/app.js',
  'dist/styles.css',
  'dist/auth.html',
  'dist/bootstrap.js',
  'dist/auth-page.js',
  'dist/platform.js',
]) {
  if (readFileSync(file).length < 100)
    throw Error('Missing or empty release asset: ' + file);
}
console.log(
  'Platform assets validated: skills, courses, universities, careers and account client.',
);

// Catalogs must never be emitted into the public static directory.
for (const name of [
  'data.js',
  'resource-data.js',
  'opportunities.json',
  'resources.json',
  'feed-snapshot.json',
])
  rmSync('dist/' + name, { force: true });
