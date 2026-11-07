export function chartKeyIndex(current: number, length: number, key: string): number | null {
  if (length < 1) return null
  if (key === 'Home') return 0
  if (key === 'End') return length - 1
  if (key === 'ArrowRight') return Math.min(length - 1, current < 0 ? 0 : current + 1)
  if (key === 'ArrowLeft') return Math.max(0, current < 0 ? length - 1 : current - 1)
  return null
}
