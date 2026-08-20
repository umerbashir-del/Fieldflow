// App-specific date helpers (not part of the shared schema). Everything
// operates on ISO 'YYYY-MM-DD' strings in UTC so date-only values never
// drift a day depending on the browser's local timezone.

function todayISO() {
  return toISO(new Date());
}

function toISO(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseISO(isoDate) {
  return new Date(`${isoDate}T00:00:00Z`);
}

function addDaysISO(isoDate, days) {
  const d = parseISO(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}

function addMonthsISO(isoDate, months) {
  const d = parseISO(isoDate);
  d.setUTCMonth(d.getUTCMonth() + months);
  return toISO(d);
}

// Monday-start week containing isoDate.
function startOfWeekISO(isoDate) {
  const d = parseISO(isoDate);
  const day = d.getUTCDay(); // 0 = Sun ... 6 = Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return toISO(d);
}

function startOfMonthISO(isoDate) {
  const d = parseISO(isoDate);
  return toISO(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)));
}

function weekdayShort(isoDate) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(parseISO(isoDate));
}

function monthDay(isoDate) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(parseISO(isoDate));
}

function monthYearLabel(isoDate) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(parseISO(isoDate));
}

function isSameMonth(a, b) {
  const da = parseISO(a);
  const db = parseISO(b);
  return da.getUTCFullYear() === db.getUTCFullYear() && da.getUTCMonth() === db.getUTCMonth();
}
