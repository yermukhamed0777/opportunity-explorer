import { readFileSync } from 'node:fs';
const resources = JSON.parse(
  readFileSync(new URL('../dist/resources.json', import.meta.url)),
);
const catalog = JSON.parse(
  readFileSync(new URL('../dist/opportunities.json', import.meta.url)),
);
export function searchResources(
  query,
  { stage = '', field = '', region = '' } = {},
) {
  const today = new Date().toISOString().slice(0, 10);
  const entries = [
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
      fields: resources.skills
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
  return entries
    .filter(
      (o) =>
        (!field ||
          o.fields.includes(field) ||
          o.fields.includes('All subjects')) &&
        (!region ||
          (o.region || '').toLowerCase().includes(region.toLowerCase())) &&
        (!stage || o.kind !== 'opportunity' || o.stage.includes(stage)),
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
