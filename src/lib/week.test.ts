import assert from 'node:assert/strict'
import { inLastDays, dueWithinDays } from './week.ts'

assert.equal(inLastDays('2026-11-01', '2026-11-07', 7), true)
assert.equal(inLastDays('2026-10-31', '2026-11-07', 7), false)
assert.equal(dueWithinDays('2026-11-13', '2026-11-07', 7), true)
assert.equal(dueWithinDays('2026-11-14', '2026-11-07', 7), false, 'today plus six is the seventh calendar day')
