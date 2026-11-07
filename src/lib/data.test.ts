import assert from 'node:assert/strict'
import { test } from 'node:test'
import { vp } from './data.ts'

test('product names distinguish Cisco IOS from Apple iOS', () => {
  assert.equal(vp('cisco', 'ios'), 'Cisco IOS')
  assert.equal(vp('cisco', 'ios xr'), 'Cisco IOS XR')
  assert.equal(vp('cisco', 'ios xe'), 'Cisco IOS XE')
  assert.equal(vp('apple', 'ios'), 'Apple iOS')
})
