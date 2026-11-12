import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const D = JSON.parse(readFileSync('data/development.json')),
  R = JSON.parse(readFileSync('data/resources.json')),
  blue = JSON.parse(readFileSync('data/project-blueprints.json')),
  curated = JSON.parse(readFileSync('data/curated-intelligence.json'));
const records = [],
  add = (r) => {
    if (records.some((x) => x.id === r.id)) throw Error('Duplicate ' + r.id);
    records.push(r);
  };
const date = '2026-11-12';
for (const c of R.courses)
  add({
    ...c,
    kind: 'course',
    fieldIds:
      c.fieldIds ||
      D.skillMaps.filter((m) => m.courses.includes(c.id)).map((m) => m.fieldId),
    sources: c.sources || [['Official course', c.url]],
    prerequisites: c.prerequisites || 'Check provider syllabus.',
    language: c.language || 'Check provider language options',
  });
if (existsSync('data/learning-resources.json'))
  for (const c of JSON.parse(readFileSync('data/learning-resources.json'))) {
    if (
      records.some(
        (x) =>
          x.kind === 'course' &&
          x.url?.replace(/\/$/, '') === c.url.replace(/\/$/, ''),
      )
    )
      continue;
    add({
      ...c,
      id:
        'learn-' +
        createHash('sha256').update(c.url).digest('hex').slice(0, 20),
      kind: 'course',
    });
  }
for (const u of R.universities)
  add({
    ...u,
    ...curated.universityEnrichment?.[u.id],
    id: 'university-' + u.id,
    kind: 'university',
    fieldIds: D.majors
      .filter((m) =>
        u.fields?.some((f) => m.name.toLowerCase().includes(f.toLowerCase())),
      )
      .map((m) => m.id),
  });
for (const r of curated.records) add(r);
for (const o of D.opportunities)
  add({
    ...o,
    id: 'programme-' + o.id,
    kind: 'opportunity',
    organization: o.org,
    stages: o.educationLevels,
    applicationUrl: o.url,
    status: o.closed
      ? 'Closed'
      : o.finalDeadline
        ? 'Upcoming'
        : 'Deadline not announced',
    openVerified: false,
    deadlineVerified: false,
  });
const old = JSON.parse(readFileSync('data/opportunities.json'));
for (const o of old.opportunities)
  add({
    ...o,
    id: 'opportunity-' + o.id,
    kind: o.type === 'Scholarship' ? 'scholarship' : 'opportunity',
    organization: o.org,
    url: o.sources[0][1],
    applicationUrl: o.sources[0][1],
    status: o.archived ? 'Previous cycle' : 'Deadline not announced',
    openVerified: false,
    deadlineVerified: !!o.deadlineConfirmed,
    summary: o.description,
    fieldIds: D.majors
      .filter((m) =>
        o.fields?.some((f) => m.name.toLowerCase().includes(f.toLowerCase())),
      )
      .map((m) => m.id),
    funding:
      o.type === 'Scholarship'
        ? {
            tuition: null,
            stipend: null,
            travel: null,
            accommodation: null,
            insurance: null,
            researchAllowance: null,
            coverage: o.cost + ' ' + o.costNote,
            amount: null,
          }
        : undefined,
  });
for (const m of D.skillMaps) {
  const field = D.majors.find((x) => x.id === m.fieldId),
    courses = m.courses,
    related = records
      .filter(
        (r) =>
          ['opportunity', 'scholarship'].includes(r.kind) &&
          r.fieldIds?.includes(m.fieldId),
      )
      .slice(0, 2)
      .map((r) => r.id);
  for (let i = 0; i < 3; i++) {
    const [name, question, method] = blue[m.fieldId][i],
      id = `project-${m.fieldId}-${i + 1}`,
      safety =
        /medicine|dentistry|nursing|pharmacy|veterinary|biology|biotechnology|biomedical/.test(
          m.fieldId,
        )
          ? 'Use public, licensed, de-identified or synthetic data only. No diagnosis, treatment, human recruitment, animal handling or wet-lab procedures. Any real clinical, animal or biological work requires institutional approval and qualified supervision.'
          : /mechanical|civil|electrical|chemical-engineering|chemistry|mse/.test(
                m.fieldId,
              )
            ? 'Begin with a desk-based model or published data. No hazardous chemicals, high voltage, pressure systems, high-power tools or structural testing without qualified institutional supervision.'
            : m.fieldId === 'cybersecurity'
              ? 'Use an isolated system you own. Do not scan or exploit third-party systems, collect credentials or publish exploitable private data.'
              : 'Use public, licensed or synthetic information. Do not collect private personal data or recruit participants without appropriate institutional approval. Respect attribution, accessibility and data-use conditions.';
    const dataset = curated.datasets[m.fieldId] || curated.datasets.default;
    add({
      id,
      kind: 'project',
      name,
      fieldIds: [m.fieldId],
      level: ['Beginner', 'Intermediate', 'Advanced'][i],
      question,
      problem: question,
      application: `An educational investigation for ${field.name.toLowerCase()} learners; not a certified professional service.`,
      background: `Turn ${m.skills
        .slice(0, 3)
        .map((s) => s.name.toLowerCase())
        .join(
          ', ',
        )} into an artifact whose assumptions and limitations you can explain.`,
      knowledge: m.skills.slice(0, i + 2).map((s) => s.name),
      tools: m.tools.length
        ? m.tools
        : ['Spreadsheet or notebook', 'Reference manager'],
      datasetNote: dataset.note,
      method,
      methodType:
        i === 0
          ? 'Literature / data-based'
          : i === 1
            ? 'Computational / design-based'
            : 'Interdisciplinary / computational',
      stages:
        i === 0
          ? ['High school', 'Undergraduate degree', 'Career changer']
          : i === 1
            ? [
                'Undergraduate degree',
                'Master’s degree',
                'Early-career professional',
              ]
            : [
                'Master’s degree',
                'PhD or doctoral degree',
                'Experienced professional',
              ],
      hours: [
        '6–10 total hours; start at 1–2 hours/week',
        '15–25 total hours; start at 2–4 hours/week',
        '30–50 total hours; adapt to your weekly limit',
      ][i],
      deliverables: [
        'A reproducible notebook, model or annotated evidence table',
        'A concise methods and limitations report',
        'A portfolio page with source attribution and a clear statement of your contribution',
      ],
      safety,
      limitations:
        'This is an editorial project proposal, not evidence of work already completed, a claim of research novelty or a guarantee of publication. Check data quality and access terms before starting.',
      extension:
        i < 2
          ? 'Compare a second method or dataset and explain where conclusions change.'
          : 'Seek qualified review, predefine validation and document reproducibility before any larger study.',
      portfolioDescription: `Educational example: investigated “${question}” using a documented method and reported limitations. Replace with your actual work and results.`,
      cvBullet: `Fictional example, not a claim about you: ${method} Documented assumptions, reproducible steps and limitations.`,
      interview: `Explain why you chose the question, how you checked the method, what failed or remained uncertain, and what you would change next.`,
      courseIds: courses,
      opportunityIds: related,
      pathwayIds: ['pathway-' + m.fieldId],
      skillIds: m.skills.slice(0, 4).map((s) => s.id),
      sources: [
        ['Official data / learning starting point', dataset.url],
        ...m.sources,
      ],
      checkedOn: date,
      verification:
        'Editorial educational proposal with source links; not a completed study.',
    });
    if (i === 1)
      add({
        ...records.at(-1),
        id: 'research-' + m.fieldId,
        kind: 'research',
        name: 'Research question: ' + name,
        portfolioDescription:
          'Present the question, data provenance, method, uncertainty and a distinction between findings and speculation.',
      });
  }
  const projectIds = [1, 2, 3].map((i) => `project-${m.fieldId}-${i}`);
  add({
    id: 'pathway-' + m.fieldId,
    kind: 'pathway',
    name: curated.pathwayNames[m.fieldId] || field.name + ' specialist',
    fieldIds: [m.fieldId],
    contentType: 'Illustrative pathway archetype',
    education:
      'Relevant education, applied training or adjacent experience. Regulated practice requires the appropriate local authorization; courses alone do not confer it.',
    foundations: m.skills.slice(0, 5).map((s) => s.name),
    tools: m.tools,
    projects: projectIds.map((id) => records.find((r) => r.id === id).name),
    projectIds,
    courseIds: courses,
    opportunityIds: related,
    internships:
      'Seek supervised work that uses the target methods; verify each advertised role’s stage, location and work-authorization conditions.',
    research:
      'Develop a small reproducible investigation and obtain qualified feedback.',
    teamwork:
      'Document your own contribution, review feedback and technical handovers.',
    earlyRoles:
      'Possible supervised, trainee, assistant or junior roles depend on the discipline and jurisdiction.',
    progression:
      'Possible progression involves deeper technical ownership, research or coordination. This is not a required sequence or a guaranteed career outcome.',
    alternatives:
      'Adjacent disciplines, technical training, part-time study and internal transitions may offer different routes.',
    samplePlan: [
      { phase: 'Learn', task: m.skills[0].description },
      {
        phase: 'Build',
        task: records.find((r) => r.id === projectIds[0]).name,
      },
      {
        phase: 'Review',
        task: 'Ask a qualified mentor to critique the artifact and document changes.',
      },
      {
        phase: 'Explore',
        task: 'Compare two actual role notices and identify remaining requirements.',
      },
    ],
    sources: m.sources,
    checkedOn: date,
    verification:
      'Illustrative educational archetype; not a real employee or employer-endorsed route.',
  });
}
const extra = {
  ...records.find((r) => r.id === 'project-mse-2'),
  id: 'project-interdisciplinary-reproducibility',
  name: 'Cross-disciplinary reproducibility handover',
  fieldIds: ['mse', 'cs', 'data-science'],
  level: 'Advanced',
  question:
    'Can a colleague reproduce your public-data result from a clean environment?',
  method:
    'Choose an existing open-data project, pin inputs and dependencies, document assumptions and test the workflow in a clean environment. Compare reproduced outputs and record any differences.',
};
add(extra);
for (const cv of curated.cvFormats) add(cv);
const out = {
  schemaVersion: 1,
  checkedOn: date,
  records,
  reviewQueue: curated.reviewQueue || [],
};
writeFileSync('data/intelligence.json', JSON.stringify(out, null, 2) + '\n');
console.log(
  JSON.stringify(
    Object.fromEntries(
      [...new Set(records.map((r) => r.kind))].map((k) => [
        k,
        records.filter((r) => r.kind === k).length,
      ]),
    ),
  ),
);
