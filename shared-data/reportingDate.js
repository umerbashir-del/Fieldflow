const TODAY_OVERRIDE = 'today';

export function reportingDateFromAccount(account, search = '') {
  const useToday = new URLSearchParams(search).get('reporting_date') === TODAY_OVERRIDE;
  const storedDate = account?.demo_reporting_date ?? null;
  return {
    date: useToday || !storedDate ? new Date() : new Date(`${storedDate}T12:00:00Z`),
    isoDate: useToday || !storedDate ? new Date().toISOString().slice(0, 10) : storedDate,
    isDemoDate: Boolean(storedDate) && !useToday,
    storedDate,
  };
}

export function withReportingDate(url, reporting) {
  const next = new URL(url);
  if (reporting?.storedDate && !reporting.isDemoDate) next.searchParams.set('reporting_date', TODAY_OVERRIDE);
  else next.searchParams.delete('reporting_date');
  return next.toString();
}

export function toggleReportingDateInCurrentUrl(reporting) {
  const next = new URL(window.location.href);
  if (reporting.isDemoDate) next.searchParams.set('reporting_date', TODAY_OVERRIDE);
  else next.searchParams.delete('reporting_date');
  window.location.assign(next.toString());
}

export function formatReportingDate(isoDate) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${isoDate}T00:00:00Z`));
}
