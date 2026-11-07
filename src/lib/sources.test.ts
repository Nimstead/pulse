import assert from 'node:assert/strict'
import { scoreDate, snapshotAge } from './sources.ts'
assert.equal(scoreDate('model_version:v2026.06.15,score_date:2026-11-06T12:00:23Z'), '2026-11-06')
assert.equal(scoreDate('model_version:v2026.06.15'), '')
assert.equal(snapshotAge('2026-11-07T13:05:51+00:00', Date.parse('2026-11-07T18:00:00Z')), 0)
assert.equal(snapshotAge('2026-11-04T13:05:51+00:00', Date.parse('2026-11-07T18:00:00Z')), 3)
assert.equal(snapshotAge('bad timestamp', Date.now()), null)
assert.equal(snapshotAge('2026-11-08T13:05:51Z', Date.parse('2026-11-07T18:00:00Z')), 0)
console.log('Source date checks passed')
