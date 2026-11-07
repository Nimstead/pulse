import type { Meta } from './data'
import { MAX_IDS, TIERS, type Item } from './watchlist.ts'
import { scoreDate } from './sources.ts'

export type Finding = {
  id: string; state: 'found' | 'missing' | 'rejected'; epss: number | null; cvss: number | null
  severity: string; vendor: string; product: string; kev: boolean; ransomware: boolean; kevAdded: string; kevDue: string
}
export type Snapshot = {
  format: 'nimstead-pulse'; version: 1; generated: string; deadlinesIncluded: boolean
  sources: { nvd: string; kev: string; epss: string; epssModel: string }
  findings: Finding[]
}
export type Change = { id: string; kind: 'added' | 'removed' | 'changed'; notes: string[] }
type Analysis = { ids: string[]; items: Item[]; missing: string[]; rejected: string[] }

export function createSnapshot(analysis: Analysis, meta: Pick<Meta, 'generated' | 'nvd' | 'kev' | 'epss'>, includeDeadlines = false): Snapshot {
  const items = new Map(analysis.items.map(item => [item.row[0], item]))
  const rejected = new Set(analysis.rejected)
  return {
    format: 'nimstead-pulse', version: 1, generated: meta.generated, deadlinesIncluded: includeDeadlines,
    sources: { nvd: /(?:Z|[+-]\d{2}:\d{2})$/.test(meta.nvd) ? meta.nvd : meta.nvd + 'Z', kev: meta.kev.version, epss: scoreDate(meta.epss), epssModel: meta.epss.match(/model_version:([^,\s]+)/)?.[1] ?? '' },
    findings: analysis.ids.map(id => {
      const item = items.get(id), row = item?.row, kev = item?.kev
      return {
        id, state: item ? 'found' : rejected.has(id) ? 'rejected' : 'missing', epss: row?.[8] ?? null, cvss: row?.[3] ?? null,
        severity: row?.[4] ?? '', vendor: kev?.vendor || row?.[6] || '', product: kev?.product || row?.[7] || '',
        kev: !!kev, ransomware: kev?.ransom ?? false, kevAdded: kev?.added ?? '', kevDue: includeDeadlines ? kev?.due ?? '' : '',
      }
    }),
  }
}

/** Files are untrusted. Rebuild only the public fields we understand; never retain arbitrary imported data. */
export function parseSnapshot(text: string): Snapshot {
  if (text.length > 10_000_000) throw new Error('Snapshot exceeds 10 MB. Choose a Pulse snapshot with at most 10,000 CVEs.')
  const invalid = () => { throw new Error('Invalid Pulse snapshot. Choose an unedited version 1 JSON snapshot downloaded from Pulse.') }
  const obj = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : invalid()
  // Public vendor/product names are bounded by the whole-file limit, not an arbitrary field length.
  const str = (v: unknown, max = text.length): string => typeof v === 'string' && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v) ? v : invalid()
  const date = (v: unknown, optional = false): string => {
    const s = str(v)
    if (optional && !s) return s
    return /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s ? s : invalid()
  }
  const timestamp = (v: unknown): string => {
    const s = str(v)
    date(s.slice(0, 10))
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/.test(s) && Number.isFinite(Date.parse(s)) ? s : invalid()
  }
  const score = (v: unknown, max: number) => v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max) ? v as number | null : invalid()
  const bool = (v: unknown) => typeof v === 'boolean' ? v : invalid()
  let json: unknown
  try { json = JSON.parse(text) } catch { return invalid() }
  const root = obj(json)
  if (root.format !== 'nimstead-pulse' || root.version !== 1) return invalid()
  const src = obj(root.sources), seen = new Set<string>(), deadlinesIncluded = bool(root.deadlinesIncluded)
  if (!Array.isArray(root.findings) || !root.findings.length || root.findings.length > MAX_IDS) return invalid()
  const findings = root.findings.map(value => {
    const f = obj(value), id = str(f.id, 40), state = f.state
    if (!/^CVE-\d{4}-\d{4,}$/.test(id) || seen.has(id) || !['found', 'missing', 'rejected'].includes(String(state))) return invalid()
    seen.add(id)
    const finding: Finding = {
      id, state: state as Finding['state'], epss: score(f.epss, 1), cvss: score(f.cvss, 10), severity: str(f.severity, 20),
      vendor: str(f.vendor), product: str(f.product), kev: bool(f.kev), ransomware: bool(f.ransomware),
      kevAdded: date(f.kevAdded, true), kevDue: date(f.kevDue, true),
    }
    if (!['', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE'].includes(finding.severity)) return invalid()
    if ((!finding.kev && (finding.ransomware || finding.kevAdded || finding.kevDue)) || (finding.kev && !finding.kevAdded)) return invalid()
    if (!deadlinesIncluded && finding.kevDue) return invalid()
    if (state !== 'found' && (finding.epss !== null || finding.cvss !== null || finding.severity || finding.vendor || finding.product || finding.kev)) return invalid()
    return finding
  })
  return { format: 'nimstead-pulse', version: 1, generated: timestamp(root.generated), deadlinesIncluded,
    sources: { nvd: timestamp(src.nvd), kev: str(src.kev, 100), epss: date(src.epss, true), epssModel: str(src.epssModel, 100) }, findings }
}

const probability = (v: number | null) => v === null ? 'unavailable' : `${(v * 100).toLocaleString('en-GB', { maximumSignificantDigits: 6 })}%`
const status = (f: Finding) => f.state === 'missing' ? 'not found in this NVD/KEV snapshot' : f.state === 'rejected' ? 'rejected by the CVE program' : 'found in public data'
const priority = (f: Finding) => f.kev ? f.ransomware ? 0 : 1 : (f.epss ?? 0) >= 0.1 ? 2 : ['CRITICAL', 'HIGH'].includes(f.severity) ? 3 : 4

export function compareSnapshots(before: Snapshot, after: Snapshot, includeDeadlines = false): Change[] {
  if (Date.parse(before.generated) > Date.parse(after.generated)) throw new Error('The loaded snapshot is newer than the current public data. Comparison is unavailable until Pulse catches up.')
  const old = new Map(before.findings.map(f => [f.id, f])), now = new Set(after.findings.map(f => f.id))
  const changes: Change[] = []
  for (const f of after.findings) {
    const b = old.get(f.id)
    if (!b) { changes.push({ id: f.id, kind: 'added', notes: [`Added to the list; ${status(f)}. No prior observation to compare.`] }); continue }
    const notes: string[] = []
    if (b.state !== f.state) notes.push(`Record is now ${status(f)} (previously ${status(b)}).`)
    // Missing records are unknowns, not evidence that exploitation or risk has gone away.
    if (f.state === 'found' && b.state === 'found') {
      if (!b.kev && f.kev) notes.push('Newly listed in CISA KEV')
      if (b.kev && !f.kev) notes.push('No longer listed in this KEV snapshot; verify source changes, not evidence of safety')
      if (!b.ransomware && f.ransomware) notes.push('New known ransomware use')
      if (b.ransomware && !f.ransomware) notes.push('Ransomware flag no longer shown; verify source changes')
      if (b.epss !== f.epss) {
        notes.push(`EPSS ${probability(b.epss)} → ${probability(f.epss)}`)
        if (b.epss !== null && f.epss !== null) {
          if (b.epss < 0.1 && f.epss >= 0.1) notes.push('EPSS crossed the 10% threshold upwards')
          if (b.epss >= 0.1 && f.epss < 0.1) notes.push('EPSS moved below 10%; not evidence of safety')
        }
      }
      if (b.cvss !== f.cvss || b.severity !== f.severity) notes.push(`CVSS ${b.cvss ?? 'unavailable'} ${b.severity} → ${f.cvss ?? 'unavailable'} ${f.severity}`.trim())
      if (b.vendor !== f.vendor || b.product !== f.product) notes.push('Vendor/product attribution changed; verify affected products and versions')
      if (b.kev && f.kev && b.kevAdded !== f.kevAdded) notes.push(`KEV listing date ${b.kevAdded} → ${f.kevAdded}`)
      if (includeDeadlines && before.deadlinesIncluded && after.deadlinesIncluded && b.kevDue !== f.kevDue) notes.push(`Federal KEV due date ${b.kevDue || 'unavailable'} → ${f.kevDue || 'unavailable'}`)
    }
    if (notes.length) changes.push({ id: f.id, kind: 'changed', notes })
  }
  for (const b of before.findings) if (!now.has(b.id)) changes.push({ id: b.id, kind: 'removed', notes: ['Removed from the input list; this does not establish remediation.'] })
  return changes
}

export function handover(current: Snapshot, baseline: Snapshot | null, includeDeadlines: boolean): string {
  const findings = current.findings, found = findings.filter(f => f.state === 'found')
    .sort((a, b) => priority(a) - priority(b) || (b.epss ?? -1) - (a.epss ?? -1) || (b.cvss ?? -1) - (a.cvss ?? -1) || a.id.localeCompare(b.id))
  const lines = ['Nimstead Pulse · Personalised handover', `Public data generated ${current.generated}`, `${findings.length} submitted CVEs · ${found.length} found · ${findings.filter(f => f.state === 'missing').length} not found · ${findings.filter(f => f.state === 'rejected').length} rejected`,
    `${found.filter(f => f.kev).length} in CISA KEV · ${found.filter(f => f.ransomware).length} with known ransomware use · ${found.filter(f => !f.kev && (f.epss ?? 0) >= 0.1).length} with elevated EPSS outside KEV`, '',
    `Sources: NVD ${current.sources.nvd}; CISA KEV ${current.sources.kev}; EPSS score date ${current.sources.epss || 'unavailable'}, model ${current.sources.epssModel || 'unavailable'}.`]
  if (baseline) {
    lines.push('', `Changes since public data ${baseline.generated}:`, `Baseline sources: NVD ${baseline.sources.nvd}; CISA KEV ${baseline.sources.kev}; EPSS ${baseline.sources.epss || 'unavailable'}, model ${baseline.sources.epssModel || 'unavailable'}.`)
    if (baseline.sources.epssModel !== current.sources.epssModel) lines.push('EPSS model changed or is unknown; score changes may reflect the model as well as new evidence.')
    if (includeDeadlines && !baseline.deadlinesIncluded) lines.push('The baseline excluded federal due dates; changes to those dates cannot be compared.')
    try {
      const changes = compareSnapshots(baseline, current, includeDeadlines)
      lines.push(...(changes.length ? changes.map(c => `- ${c.id}: ${c.notes.join('; ')}`) : ['No observed changes in the compared fields.']))
    } catch (e) { lines.push((e as Error).message) }
  } else lines.push('', 'No previous snapshot loaded; changes over time are unknown.')
  lines.push('', 'Review queue (public signals only; highest priority first):')
  for (const f of found) lines.push(`- ${f.id} · ${[f.vendor, f.product].filter(Boolean).join(' / ') || 'Product unknown'} · ${TIERS[priority(f)].label}: ${TIERS[priority(f)].note} · CVSS ${f.cvss ?? 'unavailable'} ${f.severity} · EPSS ${probability(f.epss)}${f.kev ? ` · KEV added ${f.kevAdded}` : ''}${includeDeadlines && f.kevDue ? ` · Federal KEV due ${f.kevDue}` : ''}`)
  for (const f of findings) if (f.state !== 'found') lines.push(`- ${f.id}: ${status(f)}. ${f.state === 'rejected' ? 'Check the CVE record for a replacement ID.' : 'Check the ID and retry after the next data refresh.'}`)
  lines.push('', 'Next: verify affected product and version, asset exposure and business impact; follow vendor remediation guidance and confirm the fix.',
    'KEV is not exhaustive. EPSS estimates exploitation activity over the next 30 days, not whether your assets are exposed. Missing scores do not mean low risk.',
    includeDeadlines ? 'CISA due dates are US federal benchmarks, not your remediation status.' : 'CISA due dates are excluded from this handover.',
    'List additions and removals do not prove new exposure or completed remediation. No asset inventory or remediation status is known to Pulse.',
    'Prepared locally in your browser. This handover contains your CVE list; share it only with intended recipients.')
  return lines.join('\n')
}
