/** App-wide UI state, mirrored to the URL hash so any view and period is shareable. */
export const ui = $state({ route: 'overview', from: 0, to: 0, vendor: '', cve: '', search: false })

export const ROUTES = [
  { id: 'overview', label: 'Overview' },
  { id: 'exploitation', label: 'Exploitation' },
  { id: 'severity', label: 'Severity & EPSS' },
  { id: 'vendors', label: 'Vendors & weaknesses' },
  { id: 'week', label: 'This week' },
  { id: 'watchlist', label: 'Your CVEs' },
] as const
