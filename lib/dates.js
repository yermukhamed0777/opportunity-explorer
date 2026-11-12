/** Calendar and offset validation shared by publication and deadline rendering. */
/** @param {unknown} value @returns {value is string} */
export function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
}
/** @param {unknown} value @returns {value is string} */
export function isOffsetDateTime(value) {
  if (typeof value !== 'string' || !isCalendarDate(value.slice(0, 10)))
    return false;
  const match = value.match(
    /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})(?::(\d{2}))?(Z|([+-])(\d{2}):(\d{2}))$/,
  );
  if (!match || +match[1] > 23 || +match[2] > 59 || +(match[3] || 0) > 59)
    return false;
  const hours = +(match[6] || 0),
    minutes = +(match[7] || 0);
  return (
    hours <= 14 &&
    minutes <= 59 &&
    !(hours === 14 && minutes !== 0) &&
    Number.isFinite(Date.parse(value))
  );
}
/** @param {string} zone @returns {boolean} */
export function isTimeZone(zone) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone }).format();
    return true;
  } catch {
    return false;
  }
}
