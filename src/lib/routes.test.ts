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

// Shared reports must restore their window and rankings, including legacy links.
assert.equal(readLocation('/week/', '#?days=30').windowDays, 30)
assert.equal(readLocation('/week/', '#?days=14').windowDays, 14)
assert.equal(readLocation('/week/', '#?days=999').windowDays, 7)
assert.equal(readLocation('/vendors/', '#?sort=cves&cweSort=cves').vendorSort, 'cves')
assert.equal(readLocation('/', '#/vendors?cweSort=cves').cweSort, 'cves')
assert.equal(readLocation('/vendors/', '#?sort=invalid').vendorSort, 'kev')
assert.equal(readLocation('/week/', '').windowDays, 7)
assert.equal(readLocation('/vendors/', '#?cweSort=invalid').cweSort, 'kev')
console.log('Route checks passed')
