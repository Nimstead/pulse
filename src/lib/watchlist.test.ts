// Self-check for the watchlist logic: node src/lib/watchlist.test.ts
import assert from 'node:assert/strict'
import { parseIds, analyse, filterItems, MAX_IDS, type IdxRow } from './watchlist.ts'
import type { Kev } from './data'

const p = parseIds('Found cve-2024-3400 and CVE-2021-44228, again CVE-2024-3400; "CVE-2024-123456",XCVE-2020-0001 CVE-20-1')
assert.deepEqual(p.ids, ['CVE-2024-3400', 'CVE-2021-44228', 'CVE-2024-123456'])
assert.equal(p.dupes, 1)
assert.equal(parseIds(Array.from({ length: MAX_IDS + 5 }, (_, i) => `CVE-2024-${10000 + i}`).join(' ')).capped, true)

const row = (id: string, sev: string, epss: number | null, status = 'Analyzed'): IdxRow => [id, '2024-01-01', status, 7, sev, 'CWE-79', 'acme', 'rocket', epss, null]
const index = [row('CVE-1-0001', 'LOW', 0.5), row('CVE-1-0002', 'HIGH', 0.01), row('CVE-1-0003', 'LOW', 0.01), row('CVE-1-0004', 'LOW', 0.9, 'Rejected'), row('CVE-1-0005', 'LOW', 0.02)]
const kev = (id: string, ransom: boolean) => ({ id, ransom, pub: '2024-01-01', score: 9.8, sev: 'CRITICAL', cwe: '', epss: 0.3, pct: 0.9 }) as Kev
const kevById = new Map([['CVE-1-0005', kev('CVE-1-0005', false)], ['CVE-1-0009', kev('CVE-1-0009', true)]])

const a = analyse(['CVE-1-0003', 'CVE-1-0002', 'CVE-1-0001', 'CVE-1-0004', 'CVE-1-0005', 'CVE-1-0009', 'CVE-1-7777'], index, kevById)
assert.deepEqual(a.items.map((i) => [i.row[0], i.tier]), [['CVE-1-0009', 0], ['CVE-1-0005', 1], ['CVE-1-0001', 2], ['CVE-1-0002', 3], ['CVE-1-0003', 4]])
assert.deepEqual(a.rejected, ['CVE-1-0004'])
assert.deepEqual(a.missing, ['CVE-1-7777'], 'KEV-only CVE-1-0009 is kept, not missing')
assert.deepEqual(filterItems(a.items, 'CVE-1-0002').map((i) => i.row[0]), ['CVE-1-0002'])
assert.deepEqual(filterItems(a.items, 'AcMe RoCkEt').map((i) => i.row[0]), ['CVE-1-0005', 'CVE-1-0001', 'CVE-1-0002', 'CVE-1-0003'])
assert.deepEqual(filterItems(a.items, 'acme rocket', 3).map((i) => i.row[0]), ['CVE-1-0002'])
assert.deepEqual(filterItems(a.items, '', 0).map((i) => i.row[0]), ['CVE-1-0009'])
assert.deepEqual(filterItems(a.items, '', null).map((i) => i.row[0]), a.items.map((i) => i.row[0]))
console.log('ok')
