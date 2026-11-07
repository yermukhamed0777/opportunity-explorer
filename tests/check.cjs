const fs = require('fs'),
  vm = require('vm'),
  assert = require('node:assert/strict');
const c = { window: {}, TextEncoder };
vm.createContext(c);
vm.runInContext(fs.readFileSync('dist/data.js', 'utf8'), c);
vm.runInContext(fs.readFileSync('dist/app.js', 'utf8'), c);
const data = c.window.OPPORTUNITIES,
  core = c.ExplorerCore,
  catalog = JSON.parse(fs.readFileSync('dist/opportunities.json', 'utf8')),
  ids = (items) => Array.from(items, (o) => o.id).sort();
assert(data.length >= 20);
assert.equal(new Set(data.map((o) => o.id)).size, data.length);
assert.equal(JSON.stringify(data), JSON.stringify(catalog.opportunities));
for (const o of data) {
  assert(o.sources.length);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(o.checkedOn));
  for (const [label, url] of o.sources) {
    assert(label);
    assert.equal(new URL(url).protocol, 'https:');
  }
  if (o.deadlineStart) assert(o.deadlineEnd >= o.deadlineStart);
  assert(['Free', 'Paid', 'Funded', 'Unknown'].includes(o.costGroup));
}
const base = {
  org: 'Test',
  description: '',
  fields: ['Physics'],
  formats: ['Online'],
  locations: ['Online / worldwide'],
  location: 'Online',
  eligibilityTags: ['Undergraduate applicant'],
  access: 'International',
  costGroup: 'Free',
  deadlineStart: '2027-01-15',
  deadlineEnd: '2027-01-15',
  deadlineConfirmed: true,
};
const fixture = [
  { ...base, id: 'physics', name: 'Physics', type: 'Research' },
  {
    ...base,
    id: 'broad',
    name: 'Broad scholarship',
    type: 'Scholarship',
    fields: ['All subjects'],
    costGroup: 'Funded',
    eligibilityTags: ['Master’s applicant'],
    deadlineStart: '2027-01-01',
    deadlineEnd: '2027-01-31',
    deadlineConfirmed: false,
  },
  { ...base, id: 'past', name: 'Past', archived: true, type: 'Research' },
  {
    ...base,
    id: 'unknown',
    name: 'Unknown',
    type: 'Scholarship',
    deadlineStart: null,
    deadlineEnd: null,
    deadlineConfirmed: false,
  },
];
const filter = (f) => core.filter(fixture, { today: '2026-11-06', ...f });
assert.deepEqual(
  ids(
    filter({
      type: 'Scholarship',
      stage: 'Master’s applicant',
      field: 'Physics',
      cost: 'Funded',
    }),
  ),
  ['broad'],
);
assert.deepEqual(
  ids(filter({ from: '2027-01-16', to: '2027-01-20', unknown: false })),
  ['broad'],
);
assert.equal(
  filter({ from: '2027-01-16', to: '2027-01-20', unknown: true }).length,
  2,
);
assert.deepEqual(ids(filter({ confirmed: true })), ['physics']);
assert.equal(filter({ includeClosed: true }).length, 4);
assert.equal(
  core.isClosed({ finalDeadline: '2026-11-05' }, '2026-11-06'),
  true,
);
assert.equal(
  core.isClosed({ finalDeadline: '2026-11-06' }, '2026-11-06'),
  false,
);
assert.deepEqual(
  ids(
    core.filter(
      fixture,
      { view: 'saved', today: '2026-11-06' },
      new Set(['past']),
    ),
  ),
  ['past'],
);
assert.equal(filter({ query: 'no-such-opportunity' }).length, 0);
const sorted = core
  .sort(data, 'deadline')
  .map((o) => o.deadlineStart || '9999');
assert(sorted.every((d, i) => i === 0 || sorted[i - 1] <= d));
console.log(
  'Passed: ' +
    data.length +
    ' source-backed listings, schema consistency, combined eligibility/funding/subject filters, tentative windows, unknown dates, closed listings, shortlists and sorting.',
);

const restored = core.parseBackup(
  {
    version: 1,
    saved: ['rsi', 'rsi', 'unknown-id'],
    progress: {
      rsi: {
        status: 'Preparing',
        notes: '<script>literal private text</script>',
      },
      unknown: { status: 'Accepted', notes: 'not in catalog' },
    },
  },
  data.map((o) => o.id),
);
assert.deepEqual(Array.from(restored.saved), ['rsi']);
assert.equal(restored.progress.rsi.status, 'Preparing');
assert.equal(
  restored.progress.rsi.notes,
  '<script>literal private text</script>',
);
assert.equal(restored.progress.unknown, undefined);
assert.throws(() =>
  core.parseBackup({ version: 9, saved: [], progress: {} }, []),
);
assert.equal(
  core.parseBackup(
    {
      version: 1,
      saved: [],
      progress: { rsi: { status: 'Bogus', notes: 'x'.repeat(2000) } },
    },
    ['rsi'],
  ).progress.rsi.notes.length,
  1500,
);
assert.throws(() => core.calendar({ ...data[0], deadlineConfirmed: false }));
assert.throws(() =>
  core.calendar({
    ...data[0],
    deadlineStart: '2026-02-30',
    deadlineEnd: '2026-02-30',
  }),
);
const calendar = core.calendar({
  ...data[0],
  name: 'Research, science; ' + 'é'.repeat(80) + '\nSecond line',
});
assert(calendar.includes('DTSTART;VALUE=DATE:20261211\r\n'));
assert(calendar.includes('DTEND;VALUE=DATE:20261212\r\n'));
assert(calendar.includes('SUMMARY:Deadline reminder: Research\\, science\\;'));
assert(
  calendar
    .split('\r\n')
    .every((line) => new TextEncoder().encode(line).length <= 75),
);
assert(!calendar.includes('PRIVATE PERSONAL NOTE'));
assert(calendar.includes('Date reminder only'));
const students = ids(
  core.filter(data, {
    stage: 'University student',
    type: 'Research',
    cost: 'Funded',
    today: '2026-11-06',
  }),
);
assert(students.includes('eth-ssrf-2027'));
assert(students.includes('epfl-life-sciences-srp-2027'));
console.log(
  'Passed: tracker backup validation, unknown IDs, note limits, calendar dates, escaping and UTF-8 line folding.',
);

const previous = new Map([
  ['oe-shortlist-v1', '["rsi"]'],
  ['oe-progress-v1', '{"rsi":{"status":"Interested","notes":"keep"}}'],
]);
let failOnce = true;
const storage = {
  getItem: (key) => previous.get(key) ?? null,
  removeItem: (key) => previous.delete(key),
  setItem(key, value) {
    if (key === 'oe-progress-v1' && failOnce) {
      failOnce = false;
      throw Error('quota');
    }
    previous.set(key, value);
  },
};
assert.equal(
  core.persistTracker(storage, ['ssp'], {
    ssp: { status: 'Applied', notes: 'new' },
  }),
  false,
);
assert.equal(previous.get('oe-shortlist-v1'), '["rsi"]');
assert.equal(JSON.parse(previous.get('oe-progress-v1')).rsi.notes, 'keep');
assert.equal(
  core.persistTracker(storage, ['ssp'], {
    ssp: { status: 'Applied', notes: 'new' },
  }),
  true,
);
assert.equal(JSON.parse(previous.get('oe-progress-v1')).ssp.status, 'Applied');
const safeCalendar = core.calendar({
  ...data[0],
  name: 'Title\rATTENDEE:fake@example.org',
});
assert(!safeCalendar.includes('\rATTENDEE:'));
assert(safeCalendar.includes('Title\\nATTENDEE:'));
console.log(
  'Passed: failed backup storage rolls back and calendar line breaks cannot inject fields.',
);
