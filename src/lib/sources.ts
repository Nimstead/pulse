/** FIRST metadata includes a model version date as well as the actual score date. */
export const scoreDate = (metadata: string) => metadata.match(/score_date:(\d{4}-\d{2}-\d{2})/)?.[1] ?? ''

export function snapshotAge(generated: string, now: number): number | null {
  const elapsed = now - Date.parse(generated)
  return Number.isFinite(elapsed) ? Math.max(0, Math.floor(elapsed / 864e5)) : null
}
