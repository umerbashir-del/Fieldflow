// Exact copy of shared-data/formatters.js. Kept identical on purpose —
// when this area switches to the real shared data, this file can be
// deleted and the import in App.jsx repointed at '../../shared-data/formatters.js'
// with zero behavior change.

export function formatDate(isoDate) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC'
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

export function clientName(clientId, clients) {
  return clients.find((client) => client.id === clientId)?.name ?? 'Unknown client';
}
