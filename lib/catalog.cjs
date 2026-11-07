const TYPES = new Set([
  'Research',
  'Hackathon',
  'Olympiad',
  'Research challenge',
  'Scholarship',
]);
const COSTS = new Set(['Free', 'Paid', 'Funded', 'Unknown']);
const STATUSES = new Set([
  'confirmed',
  'tentative',
  'partial',
  'caution',
  'unannounced',
]);

function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(value + 'T00:00:00Z');
  return (
    Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
}

function validateCatalog(catalog) {
  if (
    catalog?.schemaVersion !== 1 ||
    !Array.isArray(catalog.opportunities) ||
    !Number.isFinite(Date.parse(catalog.updatedAt))
  )
    throw Error('Invalid catalog header.');
  const ids = new Set();
  for (const o of catalog.opportunities) {
    if (!o || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(o.id || '') || ids.has(o.id))
      throw Error('Invalid or duplicate opportunity ID.');
    ids.add(o.id);
    for (const key of [
      'name',
      'short',
      'org',
      'cycle',
      'location',
      'eligibility',
      'cost',
      'deadline',
      'dateStatus',
      'schedule',
      'description',
      'output',
      'effort',
      'team',
      'caution',
      'next',
      'access',
    ]) {
      if (typeof o[key] !== 'string' || !o[key].trim())
        throw Error('Missing ' + key + ' on ' + o.id);
    }
    for (const key of ['fields', 'formats', 'locations', 'eligibilityTags']) {
      if (
        !Array.isArray(o[key]) ||
        !o[key].length ||
        o[key].some((value) => typeof value !== 'string' || !value.trim())
      )
        throw Error('Invalid ' + key + ' on ' + o.id);
    }
    if (
      !TYPES.has(o.type) ||
      !COSTS.has(o.costGroup) ||
      !STATUSES.has(o.status)
    )
      throw Error('Invalid classification on ' + o.id);
    if (o.formats.some((value) => !['Online', 'In person'].includes(value)))
      throw Error('Invalid format on ' + o.id);
    for (const key of ['aid', 'deadlineConfirmed', 'archived'])
      if (typeof o[key] !== 'boolean')
        throw Error('Missing ' + key + ' on ' + o.id);
    if (!isDate(o.checkedOn) || o.checkedOn > catalog.updatedAt.slice(0, 10))
      throw Error('Invalid review date on ' + o.id);
    if (!Array.isArray(o.sources) || !o.sources.length)
      throw Error('Sources required on ' + o.id);
    for (const source of o.sources) {
      if (
        !Array.isArray(source) ||
        source.length !== 2 ||
        typeof source[0] !== 'string' ||
        !source[0].trim()
      )
        throw Error('Invalid source on ' + o.id);
      const url = new URL(source[1]);
      if (url.protocol !== 'https:' || url.username || url.password)
        throw Error('HTTPS source without credentials required on ' + o.id);
    }
    for (const key of ['deadlineStart', 'deadlineEnd', 'finalDeadline'])
      if (o[key] !== null && !isDate(o[key]))
        throw Error('Invalid ' + key + ' on ' + o.id);
    if (
      Boolean(o.deadlineStart) !== Boolean(o.deadlineEnd) ||
      (o.deadlineStart && o.deadlineEnd < o.deadlineStart)
    )
      throw Error('Invalid deadline window on ' + o.id);
    if (
      o.deadlineConfirmed &&
      (!o.deadlineStart || o.deadlineStart !== o.deadlineEnd)
    )
      throw Error('Confirmed deadline must be a single known day on ' + o.id);
    if (o.finalDeadline && o.deadlineEnd && o.finalDeadline < o.deadlineEnd)
      throw Error('Final deadline precedes the next deadline on ' + o.id);
  }
  return catalog;
}
module.exports = { isDate, validateCatalog };
