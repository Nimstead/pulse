import type { Kev } from './data'

/** [id, published, status, score, severity, cwe, vendor, product, epss, epss percentile], from data/index-{n}.json */
export type IdxRow = [string, string, string, number | null, string, string, string, string, number | null, number | null]
export type Item = { row: IdxRow; kev?: Kev; tier: number }

export const MAX_IDS = 10000
export const TIERS = [
  { label: 'Act now', note: 'Exploited in the wild, with known ransomware use. Confirm affected versions and exposure first.' },
  { label: 'Exploited', note: 'Listed in CISA KEV' },
  { label: 'Elevated EPSS', note: 'EPSS score of 10% or higher' },
  { label: 'Severe', note: 'Critical or high severity' },
  { label: 'Monitor', note: 'Everything else' },
] as const

/** Pull CVE IDs out of any pasted text or file: scanner exports, CSV, JSON, prose. */
export function parseIds(text: string) {
  const all = (text.match(/\bCVE-\d{4}-\d{4,}\b/gi) ?? []).map((s) => s.toUpperCase())
  const uniq = [...new Set(all)]
  return { ids: uniq.slice(0, MAX_IDS), dupes: all.length - uniq.length, capped: uniq.length > MAX_IDS }
}

export function tier(r: IdxRow, kev?: Kev) {
  if (kev) return kev.ransom ? 0 : 1
  if ((r[8] ?? 0) >= 0.1) return 2
  return r[4] === 'CRITICAL' || r[4] === 'HIGH' ? 3 : 4
}

export const byPriority = (a: Item, b: Item) =>
  a.tier - b.tier || (b.row[8] ?? -1) - (a.row[8] ?? -1) || (b.row[3] ?? -1) - (a.row[3] ?? -1) || a.row[0].localeCompare(b.row[0])

export function filterItems(items: Item[], query: string, priority: number | null = null) {
  const q = query.trim().toLowerCase()
  return items.filter(({ row, kev, tier }) => (priority == null || tier === priority) && (!q || [row[0], row[6], row[7], kev?.vendor, kev?.product].join(' ').toLowerCase().includes(q)))
}

/** Join the list against the full index and KEV. Runs entirely in memory; the index is the same file for every visitor. */
export function analyse(ids: string[], index: IdxRow[], kevById: Map<string, Kev>) {
  const want = new Set(ids), found = new Map<string, IdxRow>()
  for (const r of index) if (want.has(r[0])) found.set(r[0], r)
  const items: Item[] = [], missing: string[] = [], rejected: string[] = []
  for (const id of ids) {
    const kev = kevById.get(id)
    // a KEV entry NVD has not published yet still counts
    const row = found.get(id) ?? (kev ? ([id, kev.pub ?? '', '', kev.score, kev.sev, kev.cwe, '', '', kev.epss, kev.pct] as IdxRow) : undefined)
    if (!row) missing.push(id)
    else if (row[2] === 'Rejected') rejected.push(id)
    else items.push({ row, kev, tier: tier(row, kev) })
  }
  return { items: items.sort(byPriority), missing, rejected }
}
