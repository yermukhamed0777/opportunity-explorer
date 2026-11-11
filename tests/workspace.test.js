import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { zipSync, strToU8 } from 'fflate';
import {
  monday,
  checkBudget,
  validateDocument,
  availability,
  fitReasons,
  profileEvidence,
  compareUniversities,
  validatePlanDraft,
} from '../lib/workspace-model.js';
import { parseDocument } from '../lib/document-parser.js';
import { processFile } from '../api/document.js';
import { developmentContext } from '../lib/development-context.js';
import { createPreviewServer } from '../scripts/dev-server.js';
const D = JSON.parse(readFileSync('data/development.json')),
  R = JSON.parse(readFileSync('data/resources.json'));
test('all 33 fields have distinct skill maps, valid courses and named evidence categories', () => {
  assert.equal(D.majors.length, 33);
  assert.equal(new Set(D.majors.map((x) => x.id)).size, 33);
  assert.equal(D.stages.length, 12);
  assert(D.stages.includes('PhD or doctoral degree'));
  const skillIds = [];
  for (const m of D.skillMaps) {
    assert(D.majors.some((x) => x.id === m.fieldId));
    assert(new Set(m.skills.map((x) => x.category)).size >= 10);
    assert(
      m.skills.every((x) => x.description.length > 20 && x.evidence && x.why),
    );
    assert(m.courses.every((id) => R.courses.some((c) => c.id === id)));
    skillIds.push(...m.skills.map((x) => x.id));
  }
  assert.equal(new Set(skillIds).size, skillIds.length);
  assert.equal(R.courses.length, 28);
  assert.equal(D.pathways.length, 10);
  assert(
    D.pathways.every((x) => /Illustrative/.test(x.note) && x.sources.length),
  );
});
test('weekly time budget includes new unsaved tasks and cannot be split into non-Monday dates', () => {
  const plan = { weekly_hours: 5 },
    a = {
      plan_id: 'p',
      week_start: '2026-11-09',
      weekly_hours: 3,
      state: 'Planned',
    };
  assert.equal(monday('2026-11-15'), '2026-11-09');
  assert(checkBudget(plan, [], a));
  assert.throws(
    () => checkBudget(plan, [a], { ...a, weekly_hours: 3 }),
    /limit/,
  );
  assert(checkBudget(plan, [a], { ...a, weekly_hours: 2 }));
  assert(checkBudget(plan, [a], { ...a, state: 'Completed', weekly_hours: 8 }));
  assert.throws(
    () => checkBudget(plan, [], { ...a, week_start: '2026-11-10' }),
    /Monday/,
  );
  assert.throws(
    () => checkBudget(plan, [], { ...a, weekly_hours: NaN }),
    /Hours/,
  );
});
test('AI drafts reject fabricated resources, excess hours and invalid weeks before any write', () => {
  const x = { title: 'Read', hours: 3, weekOffset: 0, resourceId: 'real' };
  assert(validatePlanDraft({ items: [x] }, 5, new Set(['real'])));
  assert.throws(
    () => validatePlanDraft({ items: [x, x] }, 5, new Set(['real'])),
    /exceeded/,
  );
  assert.throws(
    () =>
      validatePlanDraft(
        { items: [{ ...x, resourceId: 'invented' }] },
        5,
        new Set(['real']),
      ),
    /outside/,
  );
  assert.throws(
    () =>
      validatePlanDraft(
        { items: [{ ...x, weekOffset: -1 }] },
        5,
        new Set(['real']),
      ),
    /schedule/,
  );
});
test('closed cycles and age or stage caveats are not described as open eligibility matches', () => {
  assert.match(
    availability(D.opportunities.find((x) => x.id === 'mitacs-2027-closed')),
    /Closed/,
  );
  assert.match(availability({ finalDeadline: '2026-01-01' }), /Closed/);
  assert.match(
    availability({ verification: 'Programme directory' }),
    /Directory/,
  );
  const unv = D.opportunities.find((x) => x.id === 'unv-online'),
    fit = fitReasons(unv, { basic: { ageRange: '16–17' }, field_ids: ['mse'] });
  assert(fit.cautions.some((x) => x.includes('18')));
  assert.equal(new Set(D.opportunities.map((x) => x.region)).size, 8); // includes Worldwide alongside seven geographic regions
});
test('evidence review is transparent and university comparison has a four-institution limit', () => {
  const groups = profileEvidence(
    [{ kind: 'Project', title: 'My project' }],
    [],
    [],
  );
  assert.equal(groups.length, 8);
  assert.equal(
    groups.find((x) => x.name === 'Projects').evidence[0].title,
    'My project',
  );
  assert(
    groups
      .filter((x) => !x.evidence.length)
      .every((x) => /No evidence/.test(x.gap)),
  );
  assert.equal(
    compareUniversities(
      R.universities.slice(0, 4).map((x) => x.id),
      R.universities,
    ).length,
    4,
  );
  assert.throws(
    () =>
      compareUniversities(
        R.universities.slice(0, 5).map((x) => x.id),
        R.universities,
      ),
    /four/,
  );
});
test('document validation rejects renamed executables, unsupported types and oversize files', () => {
  assert.equal(
    validateDocument(
      { name: 'cv.pdf', type: 'application/pdf', size: 10 },
      new TextEncoder().encode('%PDF-1.4'),
    ),
    'application/pdf',
  );
  assert.throws(() => validateDocument({ name: 'cv.exe', size: 12 }), /PDF/);
  assert.throws(
    () => validateDocument({ name: 'cv.pdf', size: 10485761 }),
    /10 MB/,
  );
  assert.throws(
    () =>
      validateDocument({ name: 'cv.pdf', size: 10 }, new Uint8Array([77, 90])),
    /signature/,
  );
});
const docx = () =>
  zipSync({
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    ),
    'word/document.xml': strToU8(
      '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Education</w:t></w:r></w:p><w:p><w:r><w:t>Materials degree project</w:t></w:r></w:p></w:body></w:document>',
    ),
  });
test('DOCX extraction returns real text and tentative, unconsented review records', async () => {
  const result = await parseDocument(docx(), 'cv.docx');
  assert.match(result.text, /Materials degree project/);
  assert.equal(result.draft[0].kind, 'Education');
  assert.equal(result.draft[0].ai_allowed, false);
  const worker = await processFile(docx(), 'cv.docx');
  assert.equal(worker.text, result.text);
  await assert.rejects(
    parseDocument(zipSync({ 'test.txt': strToU8('Not a CV') }), 'fake.docx'),
    /not a readable/,
  );
});
function pdf() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const stream = 'BT /F1 16 Tf 30 220 Td (Project: Materials research) Tj ET';
  objects.push(
    '<< /Length ' +
      Buffer.byteLength(stream) +
      ' >>\nstream\n' +
      stream +
      '\nendstream',
  );
  let content = '%PDF-1.4\n',
    offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(content));
    content += i + 1 + ' 0 obj\n' + objects[i] + '\nendobj\n';
  }
  const xref = Buffer.byteLength(content);
  content +=
    'xref\n0 6\n0000000000 65535 f \n' +
    offsets
      .slice(1)
      .map((x) => String(x).padStart(10, '0') + ' 00000 n \n')
      .join('') +
    'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' +
    xref +
    '\n%%EOF';
  return new Uint8Array(Buffer.from(content));
}
test('PDF parser extracts actual selectable text in a bounded worker', async () => {
  const result = await processFile(pdf(), 'portfolio.pdf');
  assert.match(result.text, /Materials research/);
  assert.equal(result.pages, 1);
});
test('profile context defaults to off and never queries private evidence without consent', async () => {
  let calls = 0;
  const db = {
    from() {
      calls++;
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async maybeSingle() {
          return { data: { allow_profile_ai: false } };
        },
      };
    },
  };
  assert.deepEqual(await developmentContext(db, 'owner'), {
    profileConsent: false,
  });
  assert.equal(calls, 1);
});
test('new private APIs reject signed-out requests and development data has no static public path', async () => {
  const server = createPreviewServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const root = 'http://127.0.0.1:' + server.address().port;
  try {
    for (const path of ['document', 'development', 'account']) {
      const r = await fetch(root + '/api/' + path, {
        method: path === 'account' ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: path === 'account' ? undefined : '{}',
      });
      assert.equal(r.status, 401);
      assert.equal((await r.json()).code, 'login_required');
    }
    assert.equal((await fetch(root + '/development.json')).status, 404);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});
