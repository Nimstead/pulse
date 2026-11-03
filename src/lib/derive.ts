// CISA's launch listing (Nov 2021, 291 entries) and the batches of older CVEs that followed through mid-2022
export const BACKFILL = { from: '2021-11', to: '2022-06', label: 'Catalogue launch and backfill' }

export const NO_KEV = 'No KEV listings in this period. CISA began the catalogue in November 2021.'

export const LAG_BINS = ['≤ 0 d', '1–7 d', '8–30 d', '1–3 mo', '3–12 mo', '1–2 yr', '2–5 yr', '5+ yr'] as const
const LAG_EDGES = [0, 7, 30, 91, 365, 730, 1826]
export const lagBin = (d: number) => {
  const i = LAG_EDGES.findIndex((e) => d <= e)
  return i < 0 ? LAG_EDGES.length : i
}

export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** Axis label for a YYYY-MM bar, thinned so labels never collide at the given bar count. */
export function yearTick(ym: string, _i: number, count: number) {
  const mon = +ym.slice(5, 7), yr = +ym.slice(0, 4)
  if (count <= 30) return mon % 3 === 1 ? `${MON[mon - 1]} ’${ym.slice(2, 4)}` : null
  if (mon !== 1) return null
  const step = count <= 96 ? 1 : count <= 180 ? 2 : 5
  return yr % step === 0 ? String(yr) : null
}

/** Group monthly rows into calendar years, summing every numeric field. */
export function byYear<T extends { ym: string }, K extends keyof T & string>(rows: T[], keys: K[]) {
  const out = new Map<string, Record<K, number>>()
  for (const r of rows) {
    const y = r.ym.slice(0, 4)
    const acc = out.get(y) ?? (Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>)
    for (const k of keys) acc[k] += r[k] as number
    out.set(y, acc)
  }
  return [...out].map(([year, v]) => ({ year, ...v }))
}
