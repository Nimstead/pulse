import assert from 'node:assert/strict'
import { chartKeyIndex } from './chart-key.ts'

assert.equal(chartKeyIndex(-1, 8, 'ArrowRight'), 0)
assert.equal(chartKeyIndex(-1, 8, 'ArrowLeft'), 7)
assert.equal(chartKeyIndex(3, 8, 'ArrowRight'), 4)
assert.equal(chartKeyIndex(3, 8, 'ArrowLeft'), 2)
assert.equal(chartKeyIndex(3, 8, 'Home'), 0)
assert.equal(chartKeyIndex(3, 8, 'End'), 7)
assert.equal(chartKeyIndex(7, 8, 'ArrowRight'), 7)
assert.equal(chartKeyIndex(0, 8, 'ArrowLeft'), 0)
assert.equal(chartKeyIndex(-1, 0, 'ArrowRight'), null)
console.log('chart-key: ok')
