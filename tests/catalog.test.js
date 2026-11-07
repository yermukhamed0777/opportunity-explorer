import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import catalogTools from '../lib/catalog.cjs';
const catalog = JSON.parse(readFileSync('dist/opportunities.json', 'utf8'));
const copy = () => structuredClone(catalog);

test('the full catalog validates without changing source data', () => {
  const before = JSON.stringify(catalog);
  catalogTools.validateCatalog(catalog);
  assert.equal(JSON.stringify(catalog), before);
});
test('catalog validation rejects impossible dates, duplicate IDs and false confirmation', () => {
  for (const mutate of [
    (x) => {
      x.opportunities[0].checkedOn = '2026-02-30';
    },
    (x) => {
      x.opportunities[0].deadlineStart = '2026-13-01';
    },
    (x) => {
      x.opportunities[1].id = x.opportunities[0].id;
    },
    (x) => {
      x.opportunities[0].deadlineStart = null;
      x.opportunities[0].deadlineEnd = null;
    },
    (x) => {
      x.opportunities[0].sources[0][1] = 'https://user:password@example.org';
    },
  ]) {
    const value = copy();
    mutate(value);
    assert.throws(() => catalogTools.validateCatalog(value));
  }
});
test('real leap dates validate and invalid leap dates do not', () => {
  assert.equal(catalogTools.isDate('2028-02-29'), true);
  assert.equal(catalogTools.isDate('2027-02-29'), false);
});
