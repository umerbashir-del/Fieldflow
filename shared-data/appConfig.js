const configuredUrls = {
  analytics: import.meta.env.VITE_ANALYTICS_URL,
  scheduling: import.meta.env.VITE_SCHEDULING_URL,
  chatbot: import.meta.env.VITE_CHATBOT_URL,
  operations: import.meta.env.VITE_OPERATIONS_URL,
};
const PRODUCTION_BUILD = typeof __FIELDFLOW_PRODUCTION__ === 'undefined' ? false : __FIELDFLOW_PRODUCTION__;

function configuredUrl(configured, fallbackPort, productionPath) {
  if (configured) return configured.replace(/\/$/, '');
  if (PRODUCTION_BUILD && typeof window !== 'undefined') {
    return new URL(productionPath, window.location.origin).toString().replace(/\/$/, '');
  }
  const protocol = typeof window === 'undefined' ? 'http:' : window.location.protocol;
  const hostname = typeof window === 'undefined' ? 'localhost' : window.location.hostname;
  return `${protocol}//${hostname}:${fallbackPort}`;
}

export const APP_URLS = {
  analytics: configuredUrl(configuredUrls.analytics, '5173', '/analytics/'),
  scheduling: configuredUrl(configuredUrls.scheduling, '5174', '/scheduling/'),
  chatbot: configuredUrl(configuredUrls.chatbot, '5175', '/support/'),
  operations: configuredUrl(configuredUrls.operations, '5176', '/operations/'),
};

export function appUrl(area, path = '/') {
  const base = APP_URLS[area];
  if (!base) throw new Error(`Unknown FieldFlow area: ${area}`);
  return new URL(path, `${base}/`).toString();
}
