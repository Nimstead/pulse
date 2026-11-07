import { dateShort, monthShort } from './data'

/** App-wide UI state, mirrored to the URL hash so any view and period is shareable. */
export const ui = $state({ route: 'overview', from: 0, to: 0, vendor: '', cve: '', search: false, windowDays: 7, kevDeadlines: false, vendorSort: 'kev', cweSort: 'kev' })

/** Return focus to the citation that opened the method notes; never persisted. */
export const notes = $state({ origin: null as HTMLElement | null })

/** Set once the data loads; read only when a figure is exported. */
export const feed = { generated: '', months: [] as string[] }

/** The provenance line under an exported PNG; the period is left off where the figure does not follow it. */
export const provenance = (period = true) => {
  const p = period && !['week', 'watchlist'].includes(ui.route) && feed.months.length ? ` · ${monthShort(feed.months[ui.from])}–${monthShort(feed.months[ui.to])}` : ''
  return `Nimstead Pulse · Sources: NVD, CISA KEV, EPSS · data ${feed.generated ? dateShort(feed.generated) : ''}${p}`
}
