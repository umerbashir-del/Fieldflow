export function formatDate(isoDate) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC'
  }).format(new Date(`${isoDate}T00:00:00Z`));
}

export function clientName(clientId, clients) {
  return clients.find((client) => client.id === clientId)?.name ?? 'Unknown client';
}
