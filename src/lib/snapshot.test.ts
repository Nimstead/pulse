import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { analyse, type IdxRow } from './watchlist.ts'
import type { Kev } from './data'
import { createSnapshot, parseSnapshot, compareSnapshots, handover } from './snapshot.ts'

const sources = { generated: '2026-11-07T13:05:00Z', nvd: '2026-11-07T03:00:00Z', kev: { version: '2026.11.06', released: '2026-11-06' }, epss: 'model_version:v2026.06.15,score_date:2026-11-06' }
const row = (id: string, epss: number | null = 0.05): IdxRow => [id, '2024-01-01', 'Analyzed', 7, 'HIGH', 'CWE-79', 'acme', 'rocket', epss, 0.9]
const kev = (id: string): Kev => ({ id, nv: 'acme', vendor: 'Acme', product: 'Rocket', name: 'Example issue', added: '2026-11-06', due: '2026-11-20', ransom: true, pub: '2024-01-01', lag: 1040, score: 7, sev: 'HIGH', cwe: 'CWE-79', epss: 0.5, pct: 0.9 })
const ids = ['CVE-2024-1000', 'CVE-2024-1001', 'CVE-2024-1002']
const snapshot = (rows: IdxRow[], kevs: Kev[] = [], input = rows.map(r => r[0]), generated = sources.generated) =>
  createSnapshot({ ids: input, ...analyse(input, rows, new Map(kevs.map(k => [k.id, k]))) }, { ...sources, generated }, true)

// Exact index rows captured from the bundled public data on 7 November 2026; independent of nightly feed changes.
const longProductCves: IdxRow[] = JSON.parse(readFileSync(new URL('./fixtures/long-product-cves.json', import.meta.url), 'utf8'))
for (const record of longProductCves) {
  test(`snapshot round-trips the full product name for ${record[0]}`, () => {
    const saved = snapshot([record])
    assert.equal(saved.findings[0].product, record[7], 'export must preserve the real product name')
    const loaded = parseSnapshot(JSON.stringify(saved, null, 2))
    assert.deepEqual(loaded, saved, 'reload must preserve every exported observation and source date')
    assert.deepEqual(compareSnapshots(loaded, saved), [], 'a reload must not manufacture changes')
  })
}

test('snapshot survives JSON round-trip with all input IDs and source dates, excluding raw scanner text', () => {
  const analysis = { ids, ...analyse(ids, [row(ids[0])], new Map()), text: 'secret-hostname', desc: { [ids[0]]: 'private note' } }
  const saved = createSnapshot(analysis, sources)
  const loaded = parseSnapshot(JSON.stringify(saved))
  assert.deepEqual(loaded, saved)
  assert.deepEqual(loaded.findings.map(f => [f.id, f.state]), [[ids[0], 'found'], [ids[1], 'missing'], [ids[2], 'missing']])
  assert.equal(loaded.sources.epss, '2026-11-06')
  assert.equal(loaded.sources.epssModel, 'v2026.06.15')
  assert.doesNotMatch(JSON.stringify(saved), /secret-hostname|private note|description|text/)
})

test('comparison distinguishes new exploitation, EPSS threshold changes, and list membership', () => {
  const before = snapshot([row(ids[0]), row(ids[1]), row(ids[2])], [], ids, '2026-11-01T13:05:00Z')
  const after = snapshot([row(ids[0], 0.3), row(ids[1], 0.1), row('CVE-2024-1003', 0.5)], [kev(ids[0]), kev('CVE-2024-1003')])
  const changes = compareSnapshots(before, after)
  assert.deepEqual(changes.map(c => [c.id, c.kind]), [[ids[0], 'changed'], [ids[1], 'changed'], ['CVE-2024-1003', 'added'], [ids[2], 'removed']])
  assert.ok(changes[0].notes.includes('Newly listed in CISA KEV'))
  assert.ok(changes[0].notes.includes('New known ransomware use'))
  assert.match(changes[1].notes.join(' '), /crossed.*10%/i)
  assert.doesNotMatch(changes[2].notes.join(' '), /newly listed/i, 'new list members have no prior observation')
  assert.match(changes[3].notes.join(' '), /does not establish remediation/i)
})

test('unavailable scores and missing records are reported as unknown, not lower risk', () => {
  const before = snapshot([row(ids[0], 0.5), row(ids[1])], [], ids, '2026-11-01T13:05:00Z')
  const after = snapshot([row(ids[0], null)], [], ids)
  const changes = compareSnapshots(before, after)
  assert.match(changes[0].notes.join(' '), /EPSS.*unavailable/)
  assert.doesNotMatch(changes[0].notes.join(' '), /decreased|below|0\.0%/)
  assert.match(changes[1].notes.join(' '), /not found/i)
  assert.equal(changes.length, 2, 'unchanged missing record is not a change')
})

test('same observations produce no changes; newer baselines cannot be compared backwards', () => {
  const saved = snapshot([row(ids[0])])
  assert.deepEqual(compareSnapshots(saved, saved), [])
  const older = snapshot([row(ids[0])], [], [ids[0]], '2026-11-01T00:00:00Z')
  assert.throws(() => compareSnapshots(saved, older), /newer/i)
})

test('actual ETL timestamps without a timezone reload consistently as UTC', () => {
  const saved = createSnapshot({ ids: [ids[0]], ...analyse([ids[0]], [row(ids[0])], new Map()) }, {
    ...sources, generated: '2026-11-07T13:05:51+00:00', nvd: '2026-11-07T03:03:40.7275217',
  })
  assert.equal(parseSnapshot(JSON.stringify(saved)).sources.nvd, '2026-11-07T03:03:40.7275217Z')
})

test('reload rejects corrupt, inconsistent, oversized and unsupported files', () => {
  const valid = snapshot([row(ids[0])])
  const bad = [null, [], {}, { ...valid, version: 2 }, { ...valid, generated: '2026-02-30T00:00:00Z' },
    { ...valid, findings: [...valid.findings, valid.findings[0]] },
    { ...valid, findings: [{ ...valid.findings[0], id: '<script>alert(1)</script>' }] },
    { ...valid, findings: [{ ...valid.findings[0], epss: 1.1 }] },
    { ...valid, findings: [{ ...valid.findings[0], vendor: 42 }] },
    { ...valid, findings: [{ ...valid.findings[0], product: longProductCves[0][7] + '\n' }] },
    { ...valid, findings: [{ ...valid.findings[0], kev: false, ransomware: true }] },
    { ...valid, findings: [{ ...valid.findings[0], state: 'missing', epss: 0.5 }] }]
  for (const value of bad) assert.throws(() => parseSnapshot(JSON.stringify(value)))
  assert.throws(() => parseSnapshot('not JSON'))
  assert.throws(() => parseSnapshot(' '.repeat(10_000_001)), /10 MB/)
  const loaded = parseSnapshot(JSON.stringify({ ...valid, privateNote: 'do not retain', findings: [{ ...valid.findings[0], extra: 'private' }] }))
  assert.doesNotMatch(JSON.stringify(loaded), /do not retain|private/)
})

test('handover covers the whole list and provenance, includes changes and respects deadline visibility', () => {
  const before = snapshot([row(ids[0])], [], [ids[0]], '2026-11-01T13:05:00Z')
  const current = snapshot([row(ids[0], 0.3), row(ids[1], 0.2)], [kev(ids[0])], ids)
  const text = handover(current, before, false)
  assert.match(text, /CVE-2024-1000.*Acme.*Rocket/)
  assert.match(text, /CVE-2024-1001/)
  assert.match(text, /CVE-2024-1002.*not found/i)
  assert.match(text, /Newly listed in CISA KEV/)
  assert.match(text, /2026-11-06/)
  assert.match(text, /verify.*product.*version/i)
  assert.doesNotMatch(text, /2026-11-20/)
  assert.match(handover(current, before, true), /2026-11-20/)
  assert.match(handover({ ...current, sources: { ...current.sources, epssModel: 'new-model' } }, before, false), /model.*changed/i)
})

test('deadline opt-out omits dates from saved files and does not manufacture deadline changes on reload', () => {
  const analysis = { ids: [ids[0]], ...analyse([ids[0]], [row(ids[0])], new Map([[ids[0], kev(ids[0])]])) }
  const withoutDates = createSnapshot(analysis, { ...sources, generated: '2026-11-01T00:00:00Z' }, false)
  assert.doesNotMatch(JSON.stringify(withoutDates), /2026-11-20/)
  assert.equal(parseSnapshot(JSON.stringify(withoutDates)).deadlinesIncluded, false)
  const withDates = createSnapshot(analysis, sources, true)
  assert.deepEqual(compareSnapshots(withoutDates, withDates, true), [])
  const changedDate = { ...withDates, findings: withDates.findings.map(f => ({ ...f, kevDue: '2026-11-21' })) }
  assert.match(compareSnapshots(withDates, changedDate, true)[0].notes.join(' '), /2026-11-20.*2026-11-21/)
  assert.deepEqual(compareSnapshots(withDates, changedDate, false), [])
})
