// Small inline-SVG icon set for the Analytics dashboard. Stroke-based,
// single consistent line style (24x24 viewBox, 1.75 stroke) so every icon
// badge across the page reads as one system rather than mixed glyphs.
const PATHS = {
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <circle cx="8" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="14" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  trend: (
    <>
      <path d="M4 16l6-6 4 4 6-8" />
      <path d="M14 6h6v6" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V10M11 20V4M18 20v-7" />
      <path d="M3 20h18" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.5l2.4 2.4 4.6-5.4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="9" r="3.2" />
      <path d="M3.5 19c.7-3.4 3-5 5.5-5s4.8 1.6 5.5 5" />
      <circle cx="17" cy="9.5" r="2.6" />
      <path d="M15.5 14c1.9.4 3.5 1.8 4 4.6" />
    </>
  ),
  building: (
    <>
      <rect x="5" y="3.5" width="10" height="17" rx="1" />
      <path d="M15 9h4v11.5H8.5" />
      <path d="M8.5 7.5h3M8.5 11h3M8.5 14.5h3" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3.5h12v17l-2.3-1.5-2.2 1.5-2.2-1.5L9 20.5l-2.2-1.5L4.5 20.5V6a2.5 2.5 0 012.5-2.5z" />
      <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
    </>
  ),
  pulse: <path d="M3 12h4l2-6 4 12 2-6h6" />,
  wrench: <path d="M14.7 6.3a4 4 0 00-5.4 4.9L4 16.5V20h3.5l5.3-5.3a4 4 0 004.9-5.4l-2.9 2.9-2.4-.6-.6-2.4z" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.8-4.8" />
    </>
  ),
  toolbox: (
    <>
      <rect x="3" y="9" width="18" height="10.5" rx="1.5" />
      <path d="M8.5 9V6.5a1.5 1.5 0 011.5-1.5h4a1.5 1.5 0 011.5 1.5V9" />
      <path d="M3 13.5h18M10.5 13.5v2M13.5 13.5v2" />
    </>
  ),
  arrowLeft: <path d="M19 12H5M5 12l6-6M5 12l6 6" />,
  chevron: <path d="M6 9l6 6 6-6" />,
};

export default function Icon({ name, className }) {
  return (
    <svg className={className ? `icon ${className}` : 'icon'} viewBox="0 0 24 24" aria-hidden="true">
      {PATHS[name] ?? null}
    </svg>
  );
}

// Each job/service category gets its own icon + tint, reused from the
// Scheduling dashboard's redesign so the two products read as one system.
const CATEGORY_STYLE = {
  Installation: { icon: 'toolbox', tint: 'tint-sage' },
  Inspection: { icon: 'search', tint: 'tint-ochre' },
  Maintenance: { icon: 'wrench', tint: 'tint-rose' },
  Repair: { icon: 'wrench', tint: 'tint-terracotta' },
};

export function categoryStyle(category) {
  return CATEGORY_STYLE[category] ?? { icon: 'chart', tint: 'tint-neutral' };
}
