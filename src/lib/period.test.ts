import assert from 'node:assert/strict'
import { readPeriod } from './period.ts'

const months = Array.from({ length: 84 }, (_, i) => `${2020 + Math.floor(i / 12)}-${String(i % 12 + 1).padStart(2, '0')}`)
assert.deepEqual(readPeriod(months, null, null), [24, 83], 'default is the latest five years')
assert.deepEqual(readPeriod(months, '2021-01', '2022-12'), [12, 35], 'valid shared dates are preserved')
assert.deepEqual(readPeriod(months, '2026-01', '2020-12'), [0, 11], 'reversed dates fall back relative to the end, never an empty range')
assert.deepEqual(readPeriod(months, null, '2020-01'), [0, 0], 'the first month remains a valid one-month range')
assert.deepEqual(readPeriod(months, '2021-01', '2021-01'), [12, 12], 'one-month links survive reload')
assert.deepEqual(readPeriod(months, 'invalid', 'invalid'), [24, 83], 'unknown dates use the default period')
console.log('period: ok')
