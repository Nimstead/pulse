import { dateShort, monthShort } from './data'

/** App-wide UI state, mirrored to the URL hash so any view and period is shareable. */
export const ui = $state({ route: 'overview', from: 0, to: 0, vendor: '', cve: '', search: false })

/** Set once the data loads; read only when a figure is exported. */
export const feed = { generated: '', months: [] as string[] }

/** The provenance line under an exported PNG; the period is left off where the figure does not follow it. */
export const provenance = (period = true) => {
  const p = period && !['week', 'watchlist'].includes(ui.route) && feed.months.length ? ` · ${monthShort(feed.months[ui.from])}–${monthShort(feed.months[ui.to])}` : ''
  return `Nimstead Pulse · Sources: NVD, CISA KEV, EPSS · data ${feed.generated ? dateShort(feed.generated) : ''}${p}`
}

export const ROUTES = [
  { id: 'overview', label: 'Overview' },
  { id: 'exploitation', label: 'Exploitation' },
  { id: 'severity', label: 'Severity & EPSS' },
  { id: 'vendors', label: 'Vendors & weaknesses' },
  { id: 'week', label: 'This week' },
  { id: 'watchlist', label: 'Your CVEs' },
] as const
