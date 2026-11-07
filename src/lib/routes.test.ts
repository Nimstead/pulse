import assert from 'node:assert/strict'
import { readLocation, routePath } from './routes.ts'
assert.equal(routePath('overview'), '/')
assert.equal(routePath('week'), '/week/')
assert.equal(readLocation('/week/', '').route, 'week')
assert.equal(readLocation('/exploitation/', '#notes').route, 'exploitation')
const legacy = readLocation('/', '#/vendors?from=2025-01&to=2025-12&vendor=microsoft')
assert.equal(legacy.route, 'vendors')
assert.equal(legacy.params.get('vendor'), 'microsoft')
assert.equal(readLocation('/severity/', '#?from=2024-01').params.get('from'), '2024-01')
console.log('Route checks passed')
