import { readFileSync } from 'node:fs';
const resources = JSON.parse(
  readFileSync(new URL('../data/resources.json', import.meta.url)),
);
const catalog = JSON.parse(
  readFileSync(new URL('../data/opportunities.json', import.meta.url)),
);
const development = JSON.parse(
  readFileSync(new URL('../data/development.json', import.meta.url)),
);
export function searchResources(
  query,
  { stage = '', field = '', region = '', extra = [] } = {},
) {
  const today = new Date().toISOString().slice(0, 10);
  const entries = [
    ...extra
      .filter(
        (o) =>
          o.status !== 'Archived' &&
          !o.closed &&
          (!o.finalDeadline || o.finalDeadline >= today),
      )
      .map((o) => ({
        ...o,
        fields:
          o.fields ||
          (o.fieldIds?.length
            ? development.majors
                .filter((m) => o.fieldIds.includes(m.id))
                .map((m) => m.name)
            : ['All subjects']),
        summary:
          o.summary ||
          o.question ||
          o.analysis ||
          o.description ||
          o.eligibility ||
          o.research ||
          o.name,
        stage: o.stages || o.educationLevels || [],
        url: o.url || o.sources?.[0]?.[1],
      })),
    ...development.opportunities
      .filter(
        (o) => !o.closed && (!o.finalDeadline || o.finalDeadline >= today),
      )
      .map((o) => ({
        ...o,
        kind: 'opportunity',
        summary: o.note,
        stage: o.educationLevels,
        deadline: o.finalDeadline || 'Not confirmed',
        caution: o.eligibility,
      })),
    ...development.skillMaps.map((o) => ({
      id: o.id,
      name: o.name,
      fields: o.fields,
      skills: o.skills.map((s) => s.name),
      sources: o.sources,
      checkedOn: o.checkedOn,
      kind: 'skill',
      summary: o.project,
      url: '/#skills',
    })),
    ...development.pathways.map((o) => ({
      ...o,
      kind: 'pathway',
      summary: o.projects.join(' '),
      url: '/#pathways',
    })),
    ...catalog.opportunities
      .filter(
        (o) => !o.archived && (!o.finalDeadline || o.finalDeadline >= today),
      )
      .map((o) => ({
        id: o.id,
        kind: 'opportunity',
        name: o.name,
        fields: o.fields,
        region: o.location,
        summary: o.description,
        eligibility: o.eligibility,
        stage: o.eligibilityTags,
        funding: o.cost,
        deadline: o.deadline,
        deadlineConfirmed: o.deadlineConfirmed,
        caution: o.caution,
        checkedOn: o.checkedOn,
        url: o.sources[0][1],
      })),
    ...resources.universities.map((o) => ({
      ...o,
      kind: 'university',
      summary: o.research + ' ' + o.experience,
      url: o.sources[0][1],
    })),
    ...resources.careers.map((o) => ({ ...o, kind: 'career' })),
    ...resources.courses.map((o) => ({
      ...o,
      kind: 'course',
      fields:
        o.fields ||
        resources.skills
          .filter((s) => s.courses.includes(o.id))
          .flatMap((s) => s.fields),
      summary: o.provider + ' — ' + o.skills.join(', '),
      region: 'Online',
    })),
    ...resources.skills.map((o) => ({
      ...o,
      kind: 'skill',
      summary: o.project,
      url: '/' + '#skills',
    })),
  ];
  const aliases = {
    mse: 'materials semiconductors',
    cs: 'computer software',
    robotics: 'mechanical robotics',
    highschool: 'high school',
    undergraduate: 'university bachelor',
    masters: 'master',
  };
  let expanded = query.toLowerCase();
  for (const [key, value] of Object.entries(aliases))
    expanded = expanded.replace(new RegExp('\\b' + key + '\\b', 'g'), value);
  const tokens = [
    ...new Set(expanded.match(/[\p{L}\p{N}]{3,}/gu) || []),
  ].filter(
    (t) =>
      ![
        'the',
        'and',
        'for',
        'with',
        'find',
        'best',
        'want',
        'options',
        'plan',
        'show',
        'could',
        'please',
        'need',
      ].includes(t),
  );
  const major = development.majors.find(
    (m) => m.id === field || m.name.toLowerCase() === field.toLowerCase(),
  );
  const fieldName = major?.name || field;
  const stageAliases = {
    'High school': ['High school junior', 'Other high school'],
    'Undergraduate degree': ['University student'],
    'Master’s degree': ['Master’s applicant'],
    'Pre-university or foundation program': ['Pre-university gap year'],
  };
  return entries
    .filter(
      (o) =>
        (!field ||
          o.fields.includes(fieldName) ||
          o.fields.includes('All subjects')) &&
        (!region ||
          (o.region || '').toLowerCase().includes(region.toLowerCase())) &&
        (!stage ||
          o.kind !== 'opportunity' ||
          o.stage?.includes(stage) ||
          stageAliases[stage]?.some((s) => o.stage?.includes(s))),
    )
    .map((o) => ({
      ...o,
      score: tokens.reduce(
        (s, t) => s + (JSON.stringify(o).toLowerCase().includes(t) ? 1 : 0),
        0,
      ),
    }))
    .filter((o) => !tokens.length || o.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}
export function fallbackAnswer(results) {
  if (!results.length)
    return 'I could not find a match in the researched collection. Try a broader subject or location. This is catalog search, not a search of the whole internet.';
  return (
    'Here are relevant entries from the researched collection. Open the provider sources to check fit and current availability.\n\n' +
    results
      .slice(0, 5)
      .map(
        (o, i) =>
          `${i + 1}. ${o.name} — ${o.summary || o.project}\n${o.eligibility ? 'Check: ' + o.eligibility : ''}`,
      )
      .join('\n\n') +
    '\n\nSuggested next steps: choose two options, verify the provider details, and add one concrete preparation task to My activities.'
  );
}
