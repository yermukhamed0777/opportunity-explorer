import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isCalendarDate, isOffsetDateTime, isTimeZone } from '../lib/dates.js';
import {
  cycleStatus,
  deadlineInfo,
  validateContent,
  duplicateKey,
  compareEvidence,
  visibleNotifications,
  stableSort,
  contentTotals,
  canonicalUrl,
} from '../lib/intelligence-core.js';
import {
  intelligence,
  approvedHosts,
  sourceRegistry,
} from '../lib/intelligence-data.js';
import { inspectSources } from '../lib/content-updates.js';
import { removePrivateDocuments } from '../lib/account-cleanup.js';
const now = new Date('2026-11-12T02:00:00Z');
test('expanded content validates, has no duplicate identifiers or sources masquerading as new courses', () => {
  const seen = new Set();
  for (const r of intelligence.records) {
    validateContent(r, approvedHosts);
    const key = duplicateKey(r);
    assert(!seen.has(key), key);
    seen.add(key);
  }
  assert.equal(intelligence.records.length, 561);
  assert.equal(contentTotals(intelligence.records, now).courses, 281);
  assert.equal(intelligence.reviewQueue.length, 18);
});
test('real calendar and explicit-offset validation rejects rollover dates and impossible offsets', () => {
  for (const d of ['2026-02-30', '2025-02-29', '2026-13-01', '26-01-01'])
    assert(!isCalendarDate(d));
  assert(isCalendarDate('2028-02-29'));
  for (const d of [
    '2026-11-12T24:00Z',
    '2026-02-30T12:00Z',
    '2026-11-12T12:00+14:30',
    '2026-11-12T12:00',
  ])
    assert(!isOffsetDateTime(d), d);
  assert(isOffsetDateTime('2026-11-30T09:00:00+08:00'));
  assert(!isTimeZone('Mars/City'));
  assert(isTimeZone('Asia/Hong_Kong'));
});
test('publication rejects invalid review dates, unapproved hosts and fabricated open cycles', () => {
  const r = intelligence.records.find((r) => r.kind === 'opportunity');
  for (const patch of [
    { checkedOn: '2026-02-30' },
    { finalDeadline: '2026-04-31' },
    { deadlineAt: '2026-11-30T12:00+20:00' },
    { sources: [['Fake', 'https://unapproved.example/']] },
    { status: 'Open', openVerified: false },
  ])
    assert.throws(() => validateContent({ ...r, ...patch }, approvedHosts));
});
test('exact provider cutoffs convert timezone while date-only deadlines never imply an hourly countdown', () => {
  const r = {
    status: 'Open',
    openVerified: true,
    applicationUrl: 'https://example.edu',
    checkedOn: '2026-11-12',
    deadlineVerified: true,
    deadlineAt: '2026-11-13T12:00:00+08:00',
    finalDeadline: '2026-11-13',
  };
  const d = deadlineInfo(r, 'Asia/Hong_Kong', now);
  assert.match(d.text, /12:00/);
  assert.equal(d.remaining, '26 hours');
  assert.equal(d.level, '48 hours');
  const date = deadlineInfo({ ...r, deadlineAt: null }, 'Asia/Hong_Kong', now);
  assert.equal(date.level, 'Date only');
  assert.equal(date.urgent, false);
  assert.equal(date.remaining, undefined);
  assert.equal(cycleStatus(r, new Date('2026-11-14')), 'Closed');
});
test('Open requires current review and application evidence; expired records are preparation only', () => {
  assert.equal(cycleStatus({ status: 'Open' }, now), 'Deadline not announced');
  assert.equal(
    cycleStatus({ finalDeadline: '2026-10-01' }, now),
    'Previous cycle',
  );
  assert.equal(cycleStatus({ opensOn: '2027-01-01' }, now), 'Upcoming');
});
test('evidence comparison is stage-sensitive and never invents scores or qualifications', () => {
  const result = compareEvidence(
    { projectIds: ['project-mse-1'] },
    {
      preferences: { basic: { stage: 'High school' } },
      records: [{ id: 'r', kind: 'Project', title: 'My notebook' }],
    },
  );
  assert.equal(result.length, 12);
  assert(
    result.every(
      (x) =>
        !('score' in x) &&
        x.next.includes('senior employment history is not expected'),
    ),
  );
  assert(result.find((x) => x.name === 'Portfolio evidence').evidence.length);
});
test('notification dismiss, snooze, filters and deterministic order respect owner settings', () => {
  const n = [
    { id: 'a', region: 'Asia', type: 'Research' },
    { id: 'b', region: 'Europe', type: 'Course' },
  ];
  assert.equal(
    visibleNotifications(n, [{ notice_key: 'a', state: 'Dismissed' }], {}, now)
      .length,
    1,
  );
  assert.equal(
    visibleNotifications(
      n,
      [{ notice_key: 'a', state: 'Snoozed', snooze_until: '2026-11-13' }],
      { regions: ['Asia'] },
      now,
    ).length,
    0,
  );
  assert.equal(visibleNotifications(n, [], { enabled: false }, now).length, 0);
  const records = [
    { id: 'b', name: 'Beta' },
    { id: 'a', name: 'Alpha' },
  ];
  assert.deepEqual(
    stableSort(records, {}, now).map((r) => r.id),
    ['a', 'b'],
  );
});
test('controlled source checks retain successful fingerprints and queued leads during failures', async () => {
  const source = {
    url: 'https://example.edu/programme',
    recordIds: ['r'],
    frequencyDays: 1,
  };
  const previous = {
    checks: [
      {
        url: source.url,
        checkedAt: '2026-11-01',
        lastSuccessAt: '2026-11-01',
        hash: 'good',
      },
    ],
    candidates: [{ id: 'old', sourceUrl: source.url }],
  };
  const report = await inspectSources({
    records: [],
    sources: [source],
    previous,
    now,
    fetcher: async () => {
      throw Error('offline');
    },
  });
  assert.equal(report.status, 'Failed');
  assert.equal(report.checks[0].hash, 'good');
  assert.equal(report.checks[0].lastSuccessAt, '2026-11-01');
  assert.equal(report.candidates[0].id, 'old');
});
test('source changes and new links are staged, bounded and never treated as published facts', async () => {
  const source = {
    url: 'https://example.edu/programme',
    recordIds: ['r'],
    frequencyDays: 1,
  };
  const previous = {
    checks: [{ url: source.url, checkedAt: '2026-11-01', hash: 'old' }],
  };
  const report = await inspectSources({
    records: [],
    sources: [source],
    previous,
    now,
    fetcher: async () =>
      new Response(
        '<title>New call</title><main>2027-01-01 <a href="/research">Summer research application 2027</a><a href="https://evil.example/">Summer scholarship 2027</a></main>',
      ),
  });
  assert.equal(report.status, 'Completed');
  assert.equal(report.candidates.length, 2);
  assert(report.candidates.every((c) => c.state === 'Review'));
  assert(!report.candidates.some((c) => c.sourceUrl.includes('evil')));
});
test('no-due scans are a no-op and source batches rotate instead of starving lower-priority URLs', async () => {
  const urls = ['a', 'b', 'c'].map((x) => ({
    url: 'https://example.edu/' + x,
    frequencyDays: 1,
  }));
  const previous = {
    checks: [{ url: urls[0].url, checkedAt: now.toISOString() }],
  };
  const report = await inspectSources({
    records: [],
    sources: urls,
    previous,
    now,
    maxSources: 1,
    fetcher: async () => new Response('<main>Source</main>'),
  });
  assert.equal(report.checked, 1);
  assert.equal(report.remainingDue, 1);
  assert(report.checks.some((x) => x.url === urls[1].url));
  const none = await inspectSources({
    records: [],
    sources: [urls[0]],
    previous,
    now,
    fetcher: () => {
      throw Error('must not fetch');
    },
  });
  assert.equal(none.status, 'Not due');
});
test('all project ideas are educational, safety bounded, sourced and connected to real resource IDs', () => {
  const ids = new Set(intelligence.records.map((r) => r.id));
  const projects = intelligence.records.filter((r) => r.kind === 'project');
  assert.equal(projects.length, 100);
  assert.equal(new Set(projects.map((r) => r.name)).size, 100);
  for (const r of projects) {
    assert(r.method && r.safety && r.cvBullet && r.interview && r.deliverables);
    assert.match(r.cvBullet, /example|fictional|after/i);
    for (const id of [
      ...(r.courseIds || []),
      ...(r.opportunityIds || []),
      ...(r.pathwayIds || []),
    ])
      assert(ids.has(id), id);
  }
});
test('skill intelligence records have levels, assessment, prerequisites and field-specific emerging choices', () => {
  const d = JSON.parse(readFileSync('data/development.json'));
  assert.equal(
    d.skillMaps.reduce((n, m) => n + m.skills.length, 0),
    516,
  );
  for (const m of d.skillMaps) {
    assert(m.skills.some((s) => s.category === 'Emerging skills'));
    for (const s of m.skills)
      assert(
        s.interpretations.Advanced &&
          s.assessment &&
          s.checkedOn &&
          s.prerequisites &&
          s.relatedFields.includes(m.fieldId),
      );
  }
});
test('private document cleanup covers nested folders and paging without path escape or partial success claims', async () => {
  const removed = [],
    pages = {
      owner: [
        ...Array.from({ length: 100 }, (_, i) => ({
          id: 'id' + i,
          name: 'f' + i,
        })),
        { id: null, name: 'nested' },
      ],
      'owner/nested': [{ id: 'last', name: 'cv.pdf' }],
    };
  const bucket = {
    list: async (p, { offset, limit }) => ({
      data: pages[p].slice(offset, offset + limit),
    }),
    remove: async (paths) => {
      removed.push(...paths);
      return {};
    },
  };
  assert.equal(await removePrivateDocuments(bucket, 'owner'), 101);
  assert(removed.includes('owner/nested/cv.pdf'));
  await assert.rejects(
    () =>
      removePrivateDocuments(
        { list: async () => ({ data: [{ name: '../other', id: 'x' }] }) },
        'owner',
      ),
    /Invalid document path/,
  );
});
test('approved registry excludes credential-bearing and private-address source links', () => {
  assert(sourceRegistry().length > 300);
  for (const u of [
    'http://example.edu/',
    'https://user:pass@example.edu/',
    'https://127.0.0.1/',
    'https://example.edu/?token=secret',
  ])
    assert.throws(() => canonicalUrl(u));
});
