// Browser-safe workspace rules. Database triggers enforce the same time boundary.
export const ACTIVE_STATES = ['Planned', 'In progress'];
export function monday(value = new Date()) {
  const date = new Date(
    typeof value === 'string' ? value + 'T12:00:00Z' : value,
  );
  if (Number.isNaN(+date)) throw Error('Choose a valid week.');
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
export function checkBudget(plan, items, candidate) {
  const hours = Number(candidate.weekly_hours);
  if (!Number.isFinite(hours) || hours < 0 || hours > 80)
    throw Error('Hours must be between 0 and 80.');
  if (candidate.week_start !== monday(candidate.week_start))
    throw Error('Choose the Monday of the week.');
  const assigned = items
    .filter(
      (x) =>
        x.plan_id === candidate.plan_id &&
        (!candidate.id || x.id !== candidate.id) &&
        x.week_start === candidate.week_start &&
        ACTIVE_STATES.includes(x.state),
    )
    .reduce((n, x) => n + Number(x.weekly_hours), 0);
  if (
    ACTIVE_STATES.includes(candidate.state) &&
    assigned + hours > Number(plan.weekly_hours) + 0.001
  )
    throw Error(
      `This week would use ${assigned + hours} hours. Your limit is ${plan.weekly_hours}. Reduce hours or choose another week.`,
    );
  return true;
}
export const DOCX =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export function validateDocument(file, bytes) {
  const ext = file.name?.split('.').at(-1)?.toLowerCase();
  if (
    !['pdf', 'docx'].includes(ext) ||
    !Number.isInteger(file.size) ||
    file.size < 1 ||
    file.size > 10485760
  )
    throw Error('Choose a PDF or DOCX file up to 10 MB.');
  const type = ext === 'pdf' ? 'application/pdf' : DOCX;
  if (file.type && ![type, 'application/octet-stream'].includes(file.type))
    throw Error('The file type does not match its extension.');
  if (
    bytes &&
    !(ext === 'pdf'
      ? String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-'
      : bytes[0] === 80 && bytes[1] === 75 && bytes[2] === 3 && bytes[3] === 4)
  )
    throw Error('The file signature is invalid. Export a fresh PDF or DOCX.');
  return type;
}
export function availability(o, today = new Date().toISOString().slice(0, 10)) {
  if (o.closed || o.archived || (o.finalDeadline && o.finalDeadline < today))
    return 'Closed / past cycle';
  if (/directory/i.test(o.verification || o.kind || o.recordType || ''))
    return 'Directory · check individual listings';
  if (o.finalDeadline) return 'Published deadline · verify provider';
  return 'Next deadline not confirmed';
}
export function fitReasons(o, preferences, maps) {
  const basic = preferences?.basic || {},
    chosen = preferences?.field_ids || [];
  const reasons = [],
    cautions = [];
  if (
    chosen.some((id) => o.fieldIds?.includes(id)) ||
    o.fields?.includes('All subjects')
  )
    reasons.push('Includes a field you selected');
  if (basic.stage && o.educationLevels?.includes(basic.stage))
    reasons.push('Lists your education stage');
  if (
    basic.location &&
    JSON.stringify([o.region, o.country, o.format])
      .toLowerCase()
      .includes(basic.location.toLowerCase())
  )
    reasons.push('Matches your preferred location or format');
  if (
    o.minimumAge &&
    basic.ageRange &&
    (basic.ageRange.startsWith('Under') ? 12 : parseInt(basic.ageRange)) <
      o.minimumAge
  )
    cautions.push(`Minimum age ${o.minimumAge}; confirm your age eligibility`);
  if (
    basic.stage &&
    o.educationLevels?.length &&
    !o.educationLevels.includes(basic.stage)
  )
    cautions.push(
      'Your selected stage is not listed; check provider eligibility',
    );
  if (availability(o).startsWith('Closed'))
    cautions.push('Closed or past cycle; preparation only');
  if (o.eligibility) cautions.push(o.eligibility);
  if (!reasons.length)
    reasons.push('Explore manually; no confirmed profile match');
  return {
    reasons,
    cautions,
    fieldMatch: chosen.some((id) => o.fieldIds?.includes(id)),
  };
}
export function profileEvidence(records, skills, courses) {
  const groups = [
    ['Academic foundation', ['Education', 'Course', 'Certification']],
    ['Research', ['Research', 'Publication', 'Presentation']],
    ['Projects', ['Project', 'Hackathon']],
    ['Experience', ['Internship', 'Employment', 'Volunteering']],
    ['Leadership and teamwork', ['Leadership', 'Club']],
    ['Achievements', ['Competition', 'Award']],
    ['Communication', ['Language', 'Presentation']],
    ['Technical practice', ['Technical skill']],
  ];
  return groups.map(([name, kinds]) => {
    const evidence = records.filter((r) => kinds.includes(r.kind));
    if (name === 'Technical practice')
      for (const s of skills.filter(
        (x) => x.state === 'Demonstrated' && x.evidence,
      ))
        evidence.push({ title: s.skill_id, details: s.evidence });
    if (name === 'Academic foundation')
      for (const c of courses.filter((x) => x.state === 'Completed'))
        evidence.push({ title: c.course_id, details: c.notes });
    return {
      name,
      evidence,
      gap: evidence.length
        ? 'Review the quality and relevance of these records.'
        : 'No evidence recorded yet; this is not a judgment of your ability.',
      why: 'Visible evidence makes your progress easier to explain.',
      next: evidence.length
        ? 'Add an outcome, artifact or reflection.'
        : 'Choose one small activity and record what you learn.',
      time: 'Start with one 30-minute review.',
    };
  });
}
export function compareUniversities(ids, universities) {
  const unique = [...new Set(ids)];
  if (unique.length > 4) throw Error('Compare up to four universities.');
  return unique
    .map((id) => universities.find((x) => x.id === id))
    .filter(Boolean);
}
export function validatePlanDraft(draft, budget, resourceIds) {
  if (
    !draft ||
    !Array.isArray(draft.items) ||
    draft.items.length < 1 ||
    draft.items.length > 8
  )
    throw Error('The assistant did not return a usable plan. Please retry.');
  const byWeek = {};
  for (const item of draft.items) {
    if (
      !Number.isFinite(item.hours) ||
      item.hours <= 0 ||
      !Number.isInteger(item.weekOffset) ||
      item.weekOffset < 0 ||
      item.weekOffset > 12
    )
      throw Error('The suggested schedule is invalid.');
    byWeek[item.weekOffset] = (byWeek[item.weekOffset] || 0) + item.hours;
    if (byWeek[item.weekOffset] > budget + 0.001)
      throw Error(
        'The suggested plan exceeded your weekly limit. Retry with fewer tasks.',
      );
    if (item.resourceId && !resourceIds.has(item.resourceId))
      throw Error('The suggested resource is outside the verified collection.');
  }
  return draft;
}
