import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { build } from 'esbuild';
const r = JSON.parse(readFileSync('dist/resources.json', 'utf8'));
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
writeFileSync(
  'dist/resource-data.js',
  'window.PROSPECTO_RESOURCES = ' +
    JSON.stringify(r).replace(/</g, '\\u003c') +
    ';\n',
);
mkdirSync('dist/vendor', { recursive: true });
await build({
  entryPoints: ['src/platform.js'],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2022'],
  outfile: 'dist/platform.js',
  minify: true,
  legalComments: 'none',
});
for (const file of [
  'dist/index.html',
  'dist/app.js',
  'dist/styles.css',
  'dist/data.js',
  'dist/platform.js',
  'dist/resource-data.js',
]) {
  if (readFileSync(file).length < 100)
    throw Error('Missing or empty release asset: ' + file);
}
console.log(
  'Platform assets validated: skills, courses, universities, careers and account client.',
);
