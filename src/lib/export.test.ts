// Self-check for CSV cells: node src/lib/export.test.ts
import assert from 'node:assert/strict'
import { csvCell } from './export.ts'

assert.equal(csvCell('@fastify/middie versions'), "'@fastify/middie versions")
assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`)
assert.equal(csvCell('a,b'), '"a,b"')
assert.equal(csvCell(-1), '-1', 'numbers are data, not formulas')
assert.equal(csvCell(null), '')
console.log('ok')
