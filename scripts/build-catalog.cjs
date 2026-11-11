const fs = require('node:fs');
const { validateCatalog } = require('../lib/catalog.cjs');
const catalog = validateCatalog(
  JSON.parse(fs.readFileSync('data/opportunities.json', 'utf8')),
);
console.log(
  'Validated catalog: ' + catalog.opportunities.length + ' opportunities.',
);
