/** Resolve a shared URL's month range against the available data. */
export function readPeriod(months: string[], from: string | null, to: string | null): [number, number] {
  const last = months.length - 1
  const f = from ? months.indexOf(from) : -1, t = to ? months.indexOf(to) : -1
  const end = t >= 0 ? t : last
  return [f >= 0 && f <= end ? f : Math.max(0, end - 59), end]
}
