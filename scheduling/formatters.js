// Exact copy of shared-data/formatters.js's logic. Kept identical on
// purpose — when this area switches to the real shared data, these two
// functions can be deleted and replaced with an import with zero
// behavior change.

export function formatDate(isoDate) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC'
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

export function clientName(clientId, clients) {
  return clients.find((client) => client.id === clientId)?.name ?? 'Unknown client';
}
