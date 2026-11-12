import { isCalendarDate, isOffsetDateTime } from './dates.js';
// Shared deterministic content, deadline and recommendation rules. No provider secrets.
export const CYCLE_STATES = [
  'Open',
  'Upcoming',
  'Deadline not announced',
  'Expected to reopen',
  'Previous cycle',
  'Closed',
  'Archived',
];
export const KINDS = [
  'university',
  'course',
  'scholarship',
  'opportunity',
  'professional',
  'project',
  'research',
  'pathway',
  'location',
  'cv',
];
export function cycleStatus(record, now = new Date()) {
  if (record.status === 'Archived' || record.archived) return 'Archived';
  if (
    record.status === 'Previous cycle' ||
    record.closed ||
    record.status === 'Closed'
  )
    return record.status === 'Previous cycle' ? 'Previous cycle' : 'Closed';
  const day = now.toISOString().slice(0, 10);
  if (
    record.deadlineAt &&
    Number.isFinite(Date.parse(record.deadlineAt)) &&
    Date.parse(record.deadlineAt) < +now
  )
    return 'Closed';
  if (record.finalDeadline && record.finalDeadline < day)
    return 'Previous cycle';
  if (record.opensOn && record.opensOn > day) return 'Upcoming';
  if (
    record.status === 'Open' &&
    record.openVerified === true &&
    record.checkedOn &&
    record.applicationUrl
  )
    return 'Open';
  return ['Upcoming', 'Expected to reopen'].includes(record.status)
    ? record.status
    : 'Deadline not announced';
}
export function deadlineInfo(record, timeZone = 'UTC', now = new Date()) {
  try {
    new Intl.DateTimeFormat('en', { timeZone }).format(now);
  } catch {
    timeZone = 'UTC';
  }
  const status = cycleStatus(record, now);
  if (['Closed', 'Previous cycle', 'Archived'].includes(status))
    return {
      level: status,
      text: status,
      timeZone,
      urgent: false,
      verified: false,
    };
  if (
    record.deadlineAt &&
    isOffsetDateTime(record.deadlineAt) &&
    record.deadlineVerified
  ) {
    const ms = Date.parse(record.deadlineAt) - +now;
    if (!Number.isFinite(ms))
      return {
        level: 'Unknown',
        text: 'Verify the official cut-off',
        urgent: false,
        verified: false,
        timeZone,
      };
    const hours = Math.ceil(ms / 3600000),
      days = Math.ceil(ms / 86400000),
      level =
        hours <= 24
          ? '24 hours'
          : hours <= 48
            ? '48 hours'
            : days <= 6
              ? '3–6 days'
              : days <= 13
                ? '7–13 days'
                : days <= 30
                  ? '14–30 days'
                  : 'More than 30 days';
    return {
      level,
      text: new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone,
      }).format(new Date(record.deadlineAt)),
      remaining: hours < 48 ? `${hours} hours` : `${days} days`,
      timeZone,
      urgent: hours <= 48,
      verified: true,
    };
  }
  if (record.finalDeadline)
    return {
      level: 'Date only',
      text: record.finalDeadline + ' · cut-off/timezone must be checked',
      timeZone,
      urgent: false,
      verified: !!record.deadlineVerified,
    };
  return {
    level: 'Unknown',
    text: 'Deadline not announced',
    timeZone,
    urgent: false,
    verified: false,
  };
}
export function canonicalUrl(value) {
  const u = new URL(value);
  if (
    u.protocol !== 'https:' ||
    u.username ||
    u.password ||
    /^(localhost|127\.|10\.|192\.168\.|0\.|\[)/i.test(u.hostname) ||
    [...u.searchParams.keys()].some((k) =>
      /token|secret|password|authorization/i.test(k),
    )
  )
    throw Error('Use a public official HTTPS source.');
  u.hash = '';
  return u.href.replace(/\/$/, '');
}
export function duplicateKey(record) {
  return (
    (record.kind || '') +
    '|' +
    (['course', 'opportunity', 'scholarship'].includes(record.kind)
      ? canonicalUrl(
          record.url || record.sources?.[0]?.[1] || record.applicationUrl,
        ).toLowerCase()
      : String(record.name || '')
          .toLowerCase()
          .replace(/[^\p{L}\p{N}]+/gu, ' ')
          .trim())
  );
}
export function validateContent(record, approvedHosts) {
  if (
    !record ||
    !KINDS.includes(record.kind) ||
    !/^[a-z0-9][a-z0-9:-]{1,119}$/.test(record.id || '') ||
    typeof record.name !== 'string' ||
    !record.name.trim() ||
    record.name.length > 200
  )
    throw Error('A valid ID, kind and title are required.');
  if (
    !isCalendarDate(record.checkedOn) ||
    record.checkedOn >
      new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  )
    throw Error('Use a real review date that is not in the future.');
  if (
    !Array.isArray(record.sources) ||
    !record.sources.length ||
    record.sources.length > 12
  )
    throw Error('At least one official source is required.');
  for (const source of record.sources) {
    if (!Array.isArray(source) || source.length !== 2)
      throw Error('Sources need a label and URL.');
    const u = new URL(canonicalUrl(source[1]));
    if (approvedHosts && !approvedHosts.has(u.hostname))
      throw Error('This source domain is not in the reviewed source registry.');
  }
  if (['scholarship', 'opportunity'].includes(record.kind)) {
    if (!CYCLE_STATES.includes(record.status))
      throw Error('Choose a supported cycle status.');
    if (
      record.status === 'Open' &&
      (!record.openVerified || !record.applicationUrl)
    )
      throw Error(
        'Open status requires a reviewed current application source.',
      );
    if (record.finalDeadline && !isCalendarDate(record.finalDeadline))
      throw Error('Invalid deadline date.');
    if (record.deadlineAt && !isOffsetDateTime(record.deadlineAt))
      throw Error('Exact deadlines require an explicit timezone offset.');
  }
  if (
    record.kind === 'professional' &&
    (!record.facts?.length || !record.analysis || !record.limitations)
  )
    throw Error(
      'Professional profiles require separated facts, analysis and evidence limitations.',
    );
  if (
    ['project', 'research'].includes(record.kind) &&
    (!record.method || !record.safety || !record.deliverables)
  )
    throw Error('Projects need a method, safety boundaries and deliverables.');
  if (JSON.stringify(record).length > 60000)
    throw Error('This record is too large.');
  return record;
}
export function explainFit(record, profile = {}) {
  const p = profile.preferences || {},
    basic = p.basic || {},
    fields = p.field_ids || [],
    skills = profile.skills || [],
    reasons = [],
    cautions = [];
  if (record.fieldIds?.some((x) => fields.includes(x)))
    reasons.push('Matches a selected field');
  if (
    record.stages?.includes(basic.stage) ||
    record.educationLevels?.includes(basic.stage)
  )
    reasons.push('Includes your selected education stage');
  else if (record.stages?.length && basic.stage)
    cautions.push('Your stage is not explicitly listed; check eligibility');
  if (
    basic.format &&
    JSON.stringify(record).toLowerCase().includes(basic.format.toLowerCase())
  )
    reasons.push('Includes your preferred format');
  if (record.skillIds?.length) {
    const demonstrated = record.skillIds.filter((id) =>
      skills.some(
        (s) =>
          s.skill_id === id &&
          ['Demonstrated', 'Verified by evidence'].includes(s.state),
      ),
    );
    reasons.push(
      `${demonstrated.length} of ${record.skillIds.length} linked skills have evidence recorded by you`,
    );
  }
  if (
    record.nationalities?.length &&
    basic.nationality &&
    !record.nationalities.some(
      (n) => n.toLowerCase() === basic.nationality.toLowerCase(),
    )
  )
    cautions.push(
      'Nationality eligibility needs checking; no eligibility is guaranteed',
    );
  if (Number(basic.hours) && Number(record.hoursPerWeek) > Number(basic.hours))
    cautions.push('Suggested weekly effort exceeds your current availability');
  if (record.funding?.accommodation === null)
    cautions.push('Accommodation funding is not confirmed');
  if (['Previous cycle', 'Closed', 'Archived'].includes(cycleStatus(record)))
    cautions.push('This cycle is not open; use it for preparation only');
  if (!reasons.length)
    reasons.push(
      'Explore manually; insufficient profile evidence for a specific match',
    );
  return {
    reasons,
    cautions,
    confidence:
      'Limited to your confirmed entries and the recorded provider facts; not an admission or employment prediction.',
  };
}
export function stableSort(records, profile, now = new Date()) {
  return [...records].sort((a, b) => {
    const pa = explainFit(a, profile),
      pb = explainFit(b, profile);
    const active = (r) =>
      !['Closed', 'Previous cycle', 'Archived'].includes(cycleStatus(r, now));
    return (
      Number(active(b)) - Number(active(a)) ||
      Number(pb.reasons[0] === 'Matches a selected field') -
        Number(pa.reasons[0] === 'Matches a selected field') ||
      (a.finalDeadline || '9999').localeCompare(b.finalDeadline || '9999') ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id)
    );
  });
}
export const COMPARISON_CATEGORIES = [
  ['Foundational knowledge', ['Education', 'Course']],
  ['Subject knowledge', ['Education', 'Research']],
  ['Technical capability', ['Technical skill', 'Project']],
  ['Software proficiency', ['Technical skill', 'Project']],
  ['Laboratory or practical ability', ['Research', 'Internship', 'Project']],
  ['Research exposure', ['Research', 'Publication']],
  ['Portfolio evidence', ['Project', 'Presentation']],
  ['Communication', ['Presentation', 'Language', 'Volunteering']],
  ['Leadership', ['Leadership', 'Club']],
  ['Industry awareness', ['Internship', 'Employment', 'Course']],
  ['Professional experience', ['Employment', 'Internship']],
  ['Career clarity', ['Education', 'Project']],
];
export function compareEvidence(target, profile = {}) {
  const stage = profile.preferences?.basic?.stage || 'Not specified',
    junior = /school|foundation|undergraduate|associate/i.test(stage);
  return COMPARISON_CATEGORIES.map(([name, kinds]) => {
    const evidence = (profile.records || []).filter((r) =>
      kinds.includes(r.kind),
    );
    return {
      name,
      evidence: evidence.map((r) => ({
        id: r.id,
        title: r.title,
        kind: r.kind,
      })),
      missing: evidence.length
        ? 'Add a specific outcome or artifact if it is missing.'
        : 'No relevant evidence recorded yet.',
      why: `Helps explain ${name.toLowerCase()} in the selected direction.`,
      next: junior
        ? 'Choose one supervised or desk-based student activity; senior employment history is not expected.'
        : 'Choose one relevant artifact or responsibility and document your contribution.',
      projectId: target.projectIds?.[0] || null,
      courseId: target.courseIds?.[0] || null,
      opportunityId: target.opportunityIds?.[0] || null,
      effort: junior
        ? 'Start with 1–2 hours/week; review after two weeks.'
        : 'Start with a 2-hour evidence review, then adapt your plan.',
      confidence:
        'Based on self-reported, confirmed entries; no external proficiency validation.',
      stage,
    };
  });
}
export function visibleNotifications(
  notices,
  states,
  settings = {},
  now = new Date(),
) {
  if (settings.enabled === false) return [];
  return notices
    .filter((n) => {
      const state = states.find((s) => s.notice_key === n.id);
      if (state?.state === 'Dismissed') return false;
      if (state?.snooze_until && Date.parse(state.snooze_until) > +now)
        return false;
      if (
        settings.regions?.length &&
        n.region &&
        !settings.regions.includes(n.region)
      )
        return false;
      if (settings.types?.length && n.type && !settings.types.includes(n.type))
        return false;
      return true;
    })
    .slice(0, 20);
}
export function geographicRegion(record) {
  const aliases = {
    'Hong Kong': 'East Asia',
    Singapore: 'Southeast Asia',
    'United States': 'North America',
    Switzerland: 'Europe',
    'United Kingdom': 'Europe',
    'South America': 'Latin America',
    'Europe / international': 'Europe',
  };
  const regions = [
    'East Asia',
    'Southeast Asia',
    'South Asia',
    'Central Asia',
    'Europe',
    'North America',
    'Latin America',
    'Middle East',
    'Africa',
    'Oceania',
  ];
  const value = aliases[record.region] || record.region;
  return regions.includes(value) ? value : null;
}
export function contentTotals(records, now = new Date()) {
  const byKind = (k) => records.filter((r) => r.kind === k).length,
    opps = records.filter((r) =>
      ['opportunity', 'scholarship'].includes(r.kind),
    );
  const stale = records.filter(
    (r) => +now - Date.parse(r.checkedOn) > 90 * 86400000,
  ).length;
  return {
    courses: byKind('course'),
    universities: byKind('university'),
    scholarships: byKind('scholarship'),
    open: opps.filter((r) => cycleStatus(r, now) === 'Open').length,
    upcoming: opps.filter((r) => cycleStatus(r, now) === 'Upcoming').length,
    previousCycle: opps.filter((r) => cycleStatus(r, now) === 'Previous cycle')
      .length,
    archived: records.filter((r) => r.status === 'Archived').length,
    research: byKind('research'),
    pathways: byKind('pathway'),
    professionals: byKind('professional'),
    projects: byKind('project'),
    regions: new Set(records.map(geographicRegion).filter(Boolean)).size,
    approvedSources: new Set(
      records.flatMap((r) => r.sources?.map((s) => canonicalUrl(s[1])) || []),
    ).size,
    stale,
  };
}
