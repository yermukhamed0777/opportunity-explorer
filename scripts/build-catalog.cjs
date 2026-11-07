const fs = require('node:fs');
const { validateCatalog } = require('../lib/catalog.cjs');
const catalog = validateCatalog(
  JSON.parse(fs.readFileSync('dist/opportunities.json', 'utf8')),
);
const serialized = JSON.stringify(catalog, null, 2).replace(/</g, '\\u003c');
fs.writeFileSync(
  'dist/data.js',
  'window.EXPLORER_CATALOG = ' +
    serialized +
    ';\nwindow.OPPORTUNITIES = window.EXPLORER_CATALOG.opportunities;\nwindow.CHECKED_ON = window.EXPLORER_CATALOG.updatedAt.slice(0,10);\n',
);
console.log(
  'Validated and generated catalog: ' +
    catalog.opportunities.length +
    ' opportunities.',
);
