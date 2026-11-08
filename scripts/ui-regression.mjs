import assert from 'node:assert/strict'
// Run against a local preview; Playwright may come from an existing tooling install.
const { chromium } = await import(process.env.PULSE_PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, executablePath: process.env.PULSE_BROWSER || undefined })
const origin = process.env.PULSE_URL || 'http://127.0.0.1:5173'
const results = []
async function visit(page, path = '/') {
  await page.goto(origin + path)
  await page.waitForFunction(() => location.hash.includes('from=') && !document.querySelector('#startup-status, #analysis-startup'))
}
async function check(name, fn) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.setDefaultTimeout(4000)
  try { await fn(page, context); results.push({ name, passed: true }) }
  catch (e) { results.push({ name, passed: false, error: e.message.split('\n').slice(0, 3).join(' ') }) }
  finally { await context.close() }
}
await check('private analysis shows coverage and saving before the queue, with details below', async p => {
  await visit(p, '/watchlist/')
  await p.getByLabel('CVE list', { exact: true }).fill('CVE-2024-3400 CVE-2099-999999')
  await p.getByRole('button', { name: 'Analyse 2 CVEs', exact: true }).click()
  await p.getByRole('heading', { name: /CVEs in priority order/ }).waitFor()
  const coverage = p.getByRole('region', { name: 'Analysis coverage' })
  await coverage.getByText('2 submitted', { exact: true }).waitFor({ timeout: 15000 })
  assert.match(await coverage.innerText(), /2 submitted.*1 matched.*1 not found/s)
  await coverage.getByText(/Review .* unmatched/).click()
  assert.match(await coverage.innerText(), /CVE-2099-999999/)
  const headline = p.locator('p.headline')
  assert.match(await headline.innerText(), /matched/)
  await p.getByText('Analysis ready: 1 matched, 1 not found, 0 rejected.', { exact: true }).waitFor()
  await p.getByRole('button', { name: 'View results', exact: true }).click()
  assert(await coverage.evaluate(el => el === document.activeElement))
  const positions = await p.evaluate(() => ({ save: document.querySelector('.snapshot-actions').getBoundingClientRect().top, report: document.querySelector('.snapshot-report').getBoundingClientRect().top, queue: [...document.querySelectorAll('figure')].find(x => x.textContent.includes('CVEs in priority order')).getBoundingClientRect().top, details: document.querySelector('.snapshot-report details').open }))
  assert(positions.save < positions.queue, 'compact save actions belong near coverage')
  assert(positions.queue < positions.report, 'detailed handover information stays below the queue')
  assert.equal(positions.details, false)
})
await check('product groups expose every member in severity and weekly tables', async p => {
  for (const route of ['severity', 'week']) {
    await visit(p, '/' + route + '/')
    const expand = p.getByRole('button', { name: /^Show \d+ CVEs? for / }).first()
    await expand.waitFor()
    const label = await expand.getAttribute('aria-label')
    const expected = Number(label.match(/Show (\d+)/)[1])
    const id = await expand.getAttribute('aria-controls')
    await expand.click()
    await p.locator('[id="' + id + '"] button.mono-id').first().waitFor()
    assert.equal(await p.locator('[id="' + id + '"] button.mono-id').count(), expected)
  }
})
await check('vendor exposes all exploited CVEs beyond the initial twelve', async p => {
  await visit(p, '/vendors/')
  const show = p.getByRole('button', { name: /^Show all \d+ exploited CVEs$/ })
  await show.waitFor()
  const total = Number((await show.innerText()).match(/\d+/)[0])
  await show.click()
  assert.equal(await p.locator('#vendor-kev-list button').count(), total)
})
await check('KEV fallback identifies failed NVD details and retries', async p => {
  await p.route('**/data/cve/2024-0.json', route => route.fulfill({ status: 503, body: 'Unavailable' }))
  await visit(p, '/#?cve=CVE-2024-3400')
  const dialog = p.getByRole('dialog', { name: 'CVE-2024-3400' })
  await dialog.getByRole('button', { name: 'Retry NVD details' }).waitFor()
  assert.match(await dialog.innerText(), /NVD details unavailable/)
  await p.unroute('**/data/cve/2024-0.json')
  await p.route('**/data/cve/2024-0.json', route => route.fulfill({ json: [['CVE-2024-3400','2024-04-12','Analyzed',10,'CRITICAL','CWE-77','paloaltonetworks','pan os',0.94,'Recovered NVD test description.']] }))
  await dialog.getByRole('button', { name: 'Retry NVD details' }).click()
  await dialog.getByText('Recovered NVD test description.').waitFor()
  assert(!/NVD details unavailable/.test(await dialog.innerText()))
})
await check('citation moves keyboard focus into the note and offers return', async p => {
  await visit(p)
  const citation = p.getByRole('button', { name: 'Note 1', exact: true }).first()
  await citation.focus()
  await citation.press('Enter')
  assert.equal(await p.evaluate(() => document.activeElement.id), 'note-1')
  await p.getByRole('button', { name: 'Back to citation' }).click()
  assert.equal(await citation.evaluate(el => el === document.activeElement), true)
})
await check('PNG failure remains actionable after its original dismissal interval', async p => {
  await p.addInitScript(() => { HTMLCanvasElement.prototype.toBlob = function (cb) { cb(null) } })
  await visit(p, '/exploitation/')
  await p.getByRole('button', { name: 'Copy Figure 4 as PNG' }).click()
  const message = p.getByRole('alert').filter({ hasText: /PNG/ }).first()
  await message.waitFor()
  await p.waitForTimeout(2100)
  assert.match(await message.innerText(), /Try again|Retry/)
})
await check('snapshot and handover preserve unmatched IDs without raw scanner text', async p => {
  await visit(p, '/watchlist/')
  await p.getByLabel('CVE list', { exact: true }).fill('scanner secret marker CVE-2024-3400 CVE-2099-999999')
  await p.getByRole('button', { name: 'Analyse 2 CVEs', exact: true }).click()
  await p.getByRole('region', { name: 'Analysis coverage' }).getByText('2 submitted', { exact: true }).waitFor({ timeout: 15000 })
  const downloadedText = async label => {
    const pending = p.waitForEvent('download')
    await p.getByRole('button', { name: label, exact: true }).click()
    const stream = await (await pending).createReadStream()
    const chunks = []; for await (const chunk of stream) chunks.push(chunk)
    return Buffer.concat(chunks).toString('utf8')
  }
  const saved = await downloadedText('Download snapshot')
  assert.deepEqual(JSON.parse(saved).findings.map(f => f.id).sort(), ['CVE-2024-3400', 'CVE-2099-999999'])
  assert(!saved.includes('scanner secret marker'))
  const handover = await downloadedText('Download handover')
  assert.match(handover, /CVE-2024-3400/); assert.match(handover, /CVE-2099-999999/)
  await p.getByRole('button', { name: 'Clear', exact: true }).click()
  await p.getByLabel('Load snapshot', { exact: true }).setInputFiles({ name: 'snapshot.json', mimeType: 'application/json', buffer: Buffer.from(saved) })
  await p.getByRole('region', { name: 'Analysis coverage' }).getByText('2 submitted', { exact: true }).waitFor({ timeout: 15000 })
  await p.getByText('Compare with the saved snapshot', { exact: true }).waitFor()
  assert.equal(new URL(p.url()).hash.includes('CVE-'), false)
  let shards = 0
  p.on('request', request => { if (request.url().includes('/data/cve/')) shards++ })
  await p.getByRole('button', { name: 'CVE-2024-3400', exact: true }).first().click()
  await p.getByRole('dialog', { name: 'CVE-2024-3400' }).getByText(/Description not loaded/).waitFor()
  assert.equal(shards, 0, 'opening a private-list record must not fetch an identifying shard')
})
await check('a list with no matched records can still be saved', async p => {
  await visit(p, '/watchlist/')
  await p.getByLabel('CVE list', { exact: true }).fill('CVE-2099-999999')
  await p.getByRole('button', { name: 'Analyse 1 CVE', exact: true }).click()
  await p.getByRole('heading', { name: 'No CVEs matched this analysis' }).waitFor({ timeout: 15000 })
  await p.getByRole('button', { name: 'Download snapshot', exact: true }).waitFor()
})
await check('PNG capture includes bars while their entrance animation is running', async p => {
  await p.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { write: async () => { throw new Error('Test download fallback') } } })
    const encode = HTMLCanvasElement.prototype.toBlob
    HTMLCanvasElement.prototype.toBlob = function (...args) {
      const pixels = this.getContext('2d').getImageData(0, this.height * 0.25, this.width, this.height * 0.4).data
      window.exportedRedPixels = 0
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 70 && pixels[i + 1] < pixels[i] * 0.7 && pixels[i + 2] < pixels[i] * 0.8) window.exportedRedPixels++
      return encode.apply(this, args)
    }
  })
  await visit(p, '/exploitation/')
  await p.addStyleTag({ content: '.plot { animation-delay: 1s !important; animation-duration: 100ms !important; }' })
  const download = p.waitForEvent('download')
  await p.getByRole('button', { name: 'Copy Figure 4 as PNG' }).click()
  await download
  assert(await p.evaluate(() => window.exportedRedPixels > 500), 'exported plot should contain the crimson bars, not the empty entrance frame')
})
await check('input and caret survive the initial static-to-interactive transition', async p => {
  let release
  const hold = new Promise(resolve => { release = resolve })
  await p.route('**/data/meta.json', async route => { await hold; await route.continue() })
  try {
    await p.goto(origin + '/watchlist/', { waitUntil: 'domcontentloaded' })
    const field = p.getByLabel('CVE list', { exact: true })
    await field.fill('private scanner note CVE-2024-3400')
    await field.press('Home')
    const before = await field.evaluate(el => ({ value: el.value, caret: el.selectionStart }))
    release()
    await p.waitForFunction(() => location.hash.includes('from='))
    const after = await field.evaluate(el => ({ value: el.value, caret: el.selectionStart, focused: el === document.activeElement }))
    assert.equal(after.value, before.value, 'initial input must not be discarded when data arrives')
    assert.equal(after.caret, before.caret)
    assert.equal(after.focused, true)
    assert(!p.url().includes('CVE-'))
  } finally { release() }
})
await check('mobile keyboard vendor selection moves focus to its lifetime profile and back', async p => {
  await p.setViewportSize({ width: 390, height: 844 })
  await visit(p, '/vendors/')
  const vendor = p.getByRole('button', { name: 'Cisco', exact: true })
  await vendor.focus(); await vendor.press('Enter')
  const profile = p.getByRole('region', { name: 'Lifetime profile: Cisco', exact: true })
  await profile.waitFor()
  assert(await profile.evaluate(el => el === document.activeElement))
  await profile.getByRole('button', { name: 'Back to selected vendor' }).click()
  assert(await vendor.evaluate(el => el === document.activeElement))
})
await check('empty filters announce their result and can be cleared in place', async p => {
  await p.setViewportSize({ width: 320, height: 740 })
  await visit(p, '/watchlist/')
  await p.getByLabel('CVE list', { exact: true }).fill('CVE-2024-3400')
  await p.getByRole('button', { name: 'Analyse 1 CVE', exact: true }).click()
  await p.getByRole('region', { name: 'Analysis coverage' }).getByText('1 submitted', { exact: true }).waitFor({ timeout: 15000 })
  await p.getByLabel('Filter by CVE, vendor or product', { exact: true }).fill('no-such-product-zqx')
  await p.getByRole('status').filter({ hasText: 'Showing 0 of 1 matching CVEs' }).waitFor()
  await p.getByText('No CVEs match these filters.', { exact: true }).waitFor()
  assert(await p.getByRole('button', { name: 'Download Figure 17 data as CSV' }).isDisabled(), 'empty CSV export must be disabled')
  await p.getByText('No rows to export as CSV.', { exact: true }).waitFor()
  const recovery = await p.getByRole('button', { name: 'Clear filters', exact: true }).boundingBox()
  assert(recovery && recovery.x >= 0 && recovery.x + recovery.width <= 320, 'filter recovery must fit without sideways scrolling')
  await p.getByRole('button', { name: 'Clear filters', exact: true }).click()
  assert.equal(await p.getByLabel('Filter by CVE, vendor or product', { exact: true }).inputValue(), '')
  await p.getByRole('status').filter({ hasText: 'Showing 1 of 1 matching CVEs' }).waitFor()
})
await check('weekly handover failure persists and its text can be downloaded', async p => {
  await p.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Test clipboard unavailable') } } }))
  await visit(p, '/week/')
  await p.getByRole('button', { name: 'Copy as text', exact: true }).click()
  const error = p.getByRole('alert').filter({ hasText: /Could not copy/ })
  await error.waitFor()
  await p.waitForTimeout(2100)
  assert(await error.isVisible())
  const pending = p.waitForEvent('download')
  await p.getByRole('button', { name: 'Download handover', exact: true }).click()
  const stream = await (await pending).createReadStream()
  const chunks = []; for await (const chunk of stream) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString('utf8')
  assert.match(text, /Nimstead Pulse · last 7 days/)
  assert.match(text, /Start here:/)
  assert.match(text, /CISA due dates excluded/)
  assert.match(text, /verify product and version applicability/)
})
await check('private case records link directly to the shared description download', async p => {
  await visit(p, '/watchlist/')
  await p.getByLabel('CVE list', { exact: true }).fill('CVE-2024-3400')
  await p.getByRole('button', { name: 'Analyse 1 CVE', exact: true }).click()
  await p.getByRole('region', { name: 'Analysis coverage' }).getByText('1 submitted', { exact: true }).waitFor({ timeout: 15000 })
  let shards = 0
  p.on('request', request => { if (request.url().includes('/data/cve/')) shards++ })
  await p.getByRole('button', { name: 'CVE-2024-3400', exact: true }).first().click()
  await p.getByRole('dialog', { name: 'CVE-2024-3400' }).getByRole('button', { name: 'Go to description download' }).click()
  const download = p.getByRole('button', { name: 'Download descriptions', exact: true })
  await p.waitForFunction(() => document.activeElement?.id === 'download-descriptions')
  assert(await download.evaluate(el => el === document.activeElement))
  assert.equal(shards, 0, 'the shortcut must not fetch individual CVEs or start a bulk download without a click')
})

await check('browser Back closes loaded and loading case records and restores page focus', async p => {
  for (const delayed of [false, true]) {
    let release
    const hold = new Promise(resolve => { release = resolve })
    await p.route('**/data/cve/2024-0.json', async route => {
      if (delayed) await hold
      await route.fulfill({ json: [['CVE-2024-3400','2024-04-12','Analyzed',10,'CRITICAL','CWE-77','paloaltonetworks','pan os',0.94,'Loaded NVD record for navigation regression.']] }).catch(error => {
        if (!delayed) throw error // Back can cancel the deliberately held request.
      })
    })
    try {
      await visit(p)
      await p.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: 'This week', exact: true }).click()
      await p.getByRole('button', { name: 'Find a CVE or vendor', exact: true }).click()
      const search = p.getByRole('combobox', { name: 'Find a CVE or vendor' })
      await search.fill('CVE-2024-3400'); await search.press('Enter')
      const dialog = p.getByRole('dialog', { name: 'CVE-2024-3400' })
      await dialog.waitFor()
      if (!delayed) await dialog.locator('.desc').waitFor()
      await p.goBack()
      await p.waitForFunction(() => location.pathname === '/')
      await p.waitForFunction(() => !document.querySelector('dialog[open]'))
      assert.equal(await p.evaluate(() => document.activeElement.id), 'main')
      await p.goForward()
      await p.getByRole('dialog', { name: 'CVE-2024-3400' }).waitFor()
      await p.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
    } finally { release(); await p.unrouteAll({ behavior: 'wait' }) }
  }
})
await check('file controls explain startup readiness and import successfully once enabled', async p => {
  let release
  const hold = new Promise(resolve => { release = resolve })
  await p.route('**/data/meta.json', async route => { await hold; await route.continue() })
  try {
    await p.goto(origin + '/watchlist/', { waitUntil: 'domcontentloaded' })
    assert(await p.getByLabel('Choose file', { exact: true }).isDisabled())
    assert(await p.getByLabel('Load snapshot', { exact: true }).isDisabled())
    await p.getByText(/File imports will be available/).waitFor()
    release()
    await p.waitForFunction(() => !document.querySelector('input[multiple]').disabled)
    await p.getByLabel('Choose file', { exact: true }).setInputFiles({ name: 'cves.txt', mimeType: 'text/plain', buffer: Buffer.from('CVE-2024-3400\nCVE-2021-44228') })
    await p.waitForFunction(() => document.querySelector('#watch-text').value.includes('CVE-2024-3400'))
    assert.match(await p.getByLabel('CVE list', { exact: true }).inputValue(), /CVE-2021-44228/)
    assert(!p.url().includes('CVE-'))
  } finally { release() }
})
await check('a missing shard gets missing-record guidance instead of a connection retry', async p => {
  await p.route('**/data/cve/2099-9.json', route => route.fulfill({ status: 404, body: 'Not found' }))
  await visit(p, '/#?cve=CVE-2099-99999')
  const dialog = p.getByRole('dialog', { name: 'CVE-2099-99999' })
  await dialog.getByText(/No NVD record/).waitFor()
  assert.match(await dialog.innerText(), /Check the ID/)
  assert.equal(await dialog.getByRole('button', { name: 'Retry NVD details' }).count(), 0)
})
await check('choosing a vendor in search focuses the selected profile on new and current routes', async p => {
  for (const path of ['/', '/vendors/']) {
    await visit(p, path)
    await p.getByRole('button', { name: 'Find a CVE or vendor', exact: true }).click()
    const search = p.getByRole('combobox', { name: 'Find a CVE or vendor' })
    await search.fill('Cisco'); await search.press('Enter')
    const profile = p.getByRole('region', { name: 'Lifetime profile: Cisco' })
    await profile.waitFor()
    assert(await profile.evaluate(el => el === document.activeElement))
  }
})
await check('snapshot changes are visible near coverage and link to focused comparison details', async p => {
  await visit(p, '/watchlist/')
  await p.getByLabel('CVE list', { exact: true }).fill('CVE-2024-3400')
  await p.getByRole('button', { name: 'Analyse 1 CVE', exact: true }).click()
  await p.getByRole('button', { name: 'Download snapshot', exact: true }).waitFor({ timeout: 15000 })
  const pending = p.waitForEvent('download')
  await p.getByRole('button', { name: 'Download snapshot', exact: true }).click()
  const stream = await (await pending).createReadStream()
  const chunks = []; for await (const chunk of stream) chunks.push(chunk)
  const baseline = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  // Controlled presentation fixture, not an assertion about historical public observations.
  Object.assign(baseline.findings[0], { kev: false, ransomware: false, kevAdded: '', kevDue: '', epss: 0.05 })
  await p.getByLabel('Load snapshot', { exact: true }).setInputFiles({ name: 'baseline.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(baseline)) })
  const summary = p.getByRole('region', { name: 'Snapshot comparison summary' })
  await summary.getByText(/1 with changed signals/).waitFor({ timeout: 15000 })
  const positions = await p.evaluate(() => ({ summary: document.querySelector('[aria-label="Snapshot comparison summary"]').getBoundingClientRect().top, queue: [...document.querySelectorAll('figure')].find(el => el.textContent.includes('CVEs in priority order')).getBoundingClientRect().top, open: document.querySelector('.snapshot-report details').open }))
  assert(positions.summary < positions.queue)
  assert.equal(positions.open, false)
  await summary.getByRole('button', { name: 'Review changes' }).click()
  assert(await p.locator('#snapshot-comparison').evaluate(el => el.open && el.querySelector('summary') === document.activeElement))
})
await check('mobile table identities remain visible while reading the rightmost signals', async p => {
  await p.setViewportSize({ width: 320, height: 740 })
  for (const route of ['watchlist', 'week', 'severity']) {
    await visit(p, '/' + route + '/')
    const region = p.locator('.table-scroll').first()
    const identity = region.locator('button.mono-id').first()
    await identity.waitFor()
    await region.evaluate(el => { el.scrollLeft = el.scrollWidth })
    await p.waitForTimeout(100)
    const a = await identity.boundingBox(), b = await region.boundingBox()
    assert(a && b && a.x >= b.x - 1 && a.x + a.width <= b.x + b.width + 1, route + ': CVE identity must remain visible')
  }
})
await check('mobile table PNGs include every column and omit pagination controls', async p => {
  await p.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { write: async () => { throw new Error('Test download fallback') } } })
    const draw = CanvasRenderingContext2D.prototype.drawImage
    CanvasRenderingContext2D.prototype.drawImage = function (img, ...args) {
      if (img instanceof HTMLImageElement && img.src.startsWith('data:image/svg+xml')) window.lastExportSvg = decodeURIComponent(img.src.slice(img.src.indexOf(',') + 1))
      return draw.call(this, img, ...args)
    }
  })
  await p.setViewportSize({ width: 390, height: 844 })
  for (const [route, number, textScale] of [['watchlist', 17, 100], ['week', 15, 100], ['watchlist', 17, 200]]) {
    await visit(p, '/' + route + '/')
    if (textScale === 200) await p.evaluate(async () => {
      document.documentElement.style.fontSize = '200%'
      await document.fonts.ready
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    })
    const button = p.getByRole('button', { name: 'Copy Figure ' + number + ' as PNG' })
    const figure = p.locator('figure').filter({ has: button })
    await figure.locator('table tbody tr').first().waitFor()
    const fullWidth = await figure.locator('table').evaluate(el => el.scrollWidth)
    await figure.locator('.table-scroll').evaluate(el => { el.scrollLeft = el.scrollWidth })
    const pending = p.waitForEvent('download')
    await button.click()
    const stream = await (await pending).createReadStream()
    const chunks = []; for await (const chunk of stream) chunks.push(chunk)
    const png = Buffer.concat(chunks)
    assert(png.readUInt32BE(16) >= fullWidth * 2 - 2, route + ': PNG must include the full table width')
    const svg = await p.evaluate(() => window.lastExportSvg)
    assert.match(svg, /EPSS/)
    assert(!svg.includes('Show more'), 'pagination is not content for a static image')
    const layout = await p.evaluate(svg => {
      const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
      const artifact = document.importNode(doc.querySelector('foreignObject > div'), true)
      Object.assign(artifact.style, { position: 'absolute', left: '-99999px', top: '0' })
      const host = document.createElement('div')
      host.attachShadow({ mode: 'closed' }).append(artifact)
      document.body.append(host)
      const edge = artifact.getBoundingClientRect().right
      const cells = [...artifact.querySelectorAll('table.data th, table.data td')].filter(cell => !cell.closest('[hidden]'))
      const fits = cells.every(cell => cell.getBoundingClientRect().width > 0 && cell.getBoundingClientRect().right <= edge - 15)
      const headers = [...artifact.querySelectorAll('table.data th')].map(cell => cell.textContent)
      const captionWidth = artifact.querySelector('.head').getBoundingClientRect().width
      const width = artifact.getBoundingClientRect().width
      host.remove()
      return { fits, headers, captionWidth, width }
    }, svg)
    assert(layout.fits, route + ': every exported cell must fit inside the image gutter')
    assert(layout.captionWidth > layout.width / 2, route + ': the caption should reflow at the export width')
    if (route === 'watchlist') assert.deepEqual(layout.headers, ['Priority', 'CVE', 'Vendor · product', 'Severity', 'EPSS', 'KEV', 'Weakness'])
  }
})

await check('priority data retains visible attribution and labels raw NVD fields separately', async p => {
  await visit(p, '/watchlist/')
  const figure = p.locator('figure').filter({ has: p.getByRole('button', { name: 'Download Figure 17 data as CSV' }) })
  await figure.getByRole('button', { name: 'CVE-2021-44228', exact: true }).waitFor()
  await figure.getByRole('button', { name: 'View data', exact: true }).click()
  const table = figure.getByRole('region', { name: 'Figure 17 data table, scrolls sideways' })
  const headers = await table.locator('th').allTextContents()
  const cells = await table.locator('tbody tr').filter({ hasText: 'CVE-2021-44228' }).locator('td').allTextContents()
  assert.equal(cells[headers.indexOf('vendor')], 'Apache')
  assert.equal(cells[headers.indexOf('product')], 'Log4j2')
  assert.equal(cells[headers.indexOf('nvd vendor')], 'siemens')
  assert.equal(cells[headers.indexOf('nvd product')], '6bk1602-0aa12-0tp0 firmware')
})
await check('historical vendor insight does not invent leaders from zero KEV observations', async p => {
  await visit(p, '/vendors/#?from=2001-01&to=2001-12')
  await p.locator('.view-head').getByText(/No KEV listings/).waitFor()
  const intro = await p.locator('.view-head').innerText()
  assert.match(intro, /No KEV listings/)
  assert(!/ahead of|most common weakness/.test(intro))
})
await check('volume chart keyboard readout identifies the series, not its latest value', async p => {
  await visit(p)
  const charts = p.locator('.lines')
  for (const [i, label] of [[0, 'CVEs'], [1, 'KEV listings']]) {
    const chart = charts.nth(i)
    await chart.locator('svg').focus(); await chart.locator('svg').press('Home')
    const text = await chart.locator('[aria-live]').innerText()
    assert.match(text, new RegExp(': ' + label + ' [\\d,]+$'))
  }
})
await check('failed reanalysis labels retained results and does not announce ready', async p => {
  await visit(p, '/watchlist/')
  await p.getByLabel('CVE list', { exact: true }).fill('CVE-2024-3400')
  await p.getByRole('button', { name: 'Analyse 1 CVE', exact: true }).click()
  await p.getByText('Analysis ready: 1 matched, 0 not found, 0 rejected.', { exact: true }).waitFor({ timeout: 15000 })
  await p.route('**/data/index-*.json', route => route.fulfill({ status: 503, body: 'Unavailable' }))
  await p.getByRole('button', { name: 'Analyse 1 CVE', exact: true }).click()
  const error = p.getByRole('alert').filter({ hasText: 'Analysis failed' })
  await error.waitFor()
  assert.match(await error.innerText(), /Previous results.*public data/s)
  assert(!/503|Failed to fetch/.test(await error.innerText()), 'download errors should explain recovery without transport jargon')
  assert.equal(await p.getByText(/^Analysis ready:/).count(), 0)
  assert.equal(await p.getByLabel('CVE list', { exact: true }).inputValue(), 'CVE-2024-3400')
  await p.unroute('**/data/index-*.json')
  await p.getByRole('button', { name: 'Analyse 1 CVE', exact: true }).click()
  await p.getByText(/^Analysis ready:/).waitFor({ timeout: 15000 })
})
await check('vendor search from a case closes the case and focuses the new profile', async p => {
  await visit(p, '/#?cve=CVE-2024-3400')
  await p.getByRole('dialog', { name: 'CVE-2024-3400' }).waitFor()
  await p.keyboard.press('Control+k')
  await p.keyboard.type('Cisco'); await p.keyboard.press('Enter')
  await p.waitForFunction(() => location.pathname === '/vendors/')
  assert.equal(await p.locator('dialog[open]').count(), 0)
  assert.equal(await p.evaluate(() => document.activeElement?.id), 'vendor-profile')
})
await check('startup failure replaces preparing with retry and preserves private input', async p => {
  let release
  const hold = new Promise(resolve => { release = resolve })
  await p.route('**/data/meta.json', async route => { await hold; await route.fulfill({ status: 503, body: 'Unavailable' }) })
  try {
    await p.goto(origin + '/watchlist/', { waitUntil: 'domcontentloaded' })
    const input = p.getByLabel('CVE list', { exact: true })
    await input.fill('private note CVE-2024-3400 CVE-2021-44228')
    release()
    const retry = p.getByRole('button', { name: 'Retry loading data', exact: true })
    await retry.waitFor()
    assert.equal(await p.getByText(/Preparing private analysis/).count(), 0)
    await p.unroute('**/data/meta.json')
    await retry.click()
    await p.waitForFunction(() => location.hash.includes('from='))
    assert.equal(await input.inputValue(), 'private note CVE-2024-3400 CVE-2021-44228')
    assert(await p.getByRole('button', { name: 'Analyse 2 CVEs', exact: true }).isEnabled())
    assert(!p.url().includes('CVE-'))
  } finally { release(); await p.unrouteAll({ behavior: 'wait' }) }
})
await check('weekly product jump moves keyboard focus and continues at the target', async p => {
  await p.setViewportSize({ width: 390, height: 844 })
  await visit(p, '/week/')
  const jump = p.getByRole('link', { name: 'by product', exact: true })
  await jump.focus(); await jump.press('Enter')
  const focused = await p.evaluate(() => ({ id: document.activeElement.id, label: document.activeElement.getAttribute('aria-label'), text: document.activeElement.textContent }))
  assert.equal(focused.id, 'fresh')
  assert.match(focused.label || focused.text, /Fresh Critical and High/)
  await p.keyboard.press('Tab')
  assert.equal(await p.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Copy Figure 15 as PNG')
})
await check('automatic theme changes update the toggle and reverse on the first click', async p => {
  await p.emulateMedia({ colorScheme: 'light' })
  await visit(p)
  await p.getByRole('button', { name: 'Switch to dark theme' }).waitFor()
  await p.emulateMedia({ colorScheme: 'dark' })
  const toggle = p.getByRole('button', { name: 'Switch to light theme' })
  await toggle.waitFor()
  await toggle.click()
  assert.equal(await p.evaluate(() => document.documentElement.dataset.theme), 'light')
})

await check('PNG exports include an outer gutter around the figure and provenance', async p => {
  await p.emulateMedia({ colorScheme: 'dark' })
  await p.setViewportSize({ width: 390, height: 844 })
  await p.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: { write: async () => { throw new Error('Test download fallback') } } })
    const encode = HTMLCanvasElement.prototype.toBlob
    HTMLCanvasElement.prototype.toBlob = function (...args) {
      const ctx = this.getContext('2d'), background = getComputedStyle(document.body).backgroundColor.match(/\d+/g).slice(0, 3).map(Number)
      let edgeInk = 0
      for (const x of [0, this.width - 1]) {
        const data = ctx.getImageData(x, 0, 1, this.height).data
        for (let i = 0; i < data.length; i += 4) if (background.some((value, channel) => Math.abs(data[i + channel] - value) > 2)) edgeInk++
      }
      window.exportEdgeInk = edgeInk
      return encode.apply(this, args)
    }
  })
  await visit(p)
  const pending = p.waitForEvent('download')
  await p.getByRole('button', { name: 'Copy Figure 1 as PNG', exact: true }).click()
  await pending
  assert.equal(await p.evaluate(() => window.exportEdgeInk), 0, 'text and rules must not touch the image edges')
})

await check('all section labels remain visible at tablet widths and enlarged text', async p => {
  for (const [width, textScale] of [[720, 100], [1440, 200], [1440, 100]]) {
    await p.setViewportSize({ width, height: 1000 })
    await visit(p, '/watchlist/')
    if (textScale === 200) await p.addStyleTag({ content: 'html { font-size: 200% !important; }' })
    const visibility = await p.getByRole('navigation', { name: 'Sections' }).evaluate(nav => {
      const row = nav.querySelector('.wrap'), rect = row.getBoundingClientRect(), style = getComputedStyle(row)
      return [...row.querySelectorAll('a')].map(a => ({ label: a.textContent, visible: a.getBoundingClientRect().left >= rect.left + parseFloat(style.paddingLeft) - 1 && a.getBoundingClientRect().right <= rect.right - parseFloat(style.paddingRight) + 1 }))
    })
    assert(visibility.every(link => link.visible), `${width}px / ${textScale}% text: hidden section labels ${visibility.filter(link => !link.visible).map(link => link.label).join(', ')}`)
  }
})

await check('worked-example download failure explains the task and can retry in place', async p => {
  await p.route('**/data/example.json', route => route.fulfill({ status: 503, body: 'Unavailable' }))
  await visit(p, '/watchlist/')
  const error = p.getByRole('alert')
  await error.waitFor()
  assert.match(await error.innerText(), /worked example/i)
  assert(!/example\.json|503/.test(await error.innerText()))
  await p.unroute('**/data/example.json')
  await p.getByRole('button', { name: 'Show the example again', exact: true }).click()
  await p.getByRole('button', { name: 'CVE-2021-44228', exact: true }).first().waitFor()
  assert.equal(await p.getByRole('alert').count(), 0, 'a successful retry should clear the old error')
})
await check('description download failure names the content and keeps retry available', async p => {
  await visit(p, '/watchlist/')
  await p.getByRole('button', { name: 'CVE-2021-44228', exact: true }).first().waitFor()
  await p.route('**/data/cve/*.json', route => route.abort())
  const section = p.getByRole('region', { name: 'CVE descriptions', exact: true })
  await section.getByRole('button', { name: 'Download descriptions', exact: true }).click()
  const error = section.getByRole('alert')
  await error.waitFor()
  assert.match(await error.innerText(), /descriptions/i)
  assert(!/Failed to fetch|\.json/.test(await error.innerText()))
  assert(await section.getByRole('button', { name: 'Retry', exact: true }).isEnabled())
})

await check('a complete one-year view retains its rolling comparison and labelled context', async p => {
  await visit(p, '/#?from=2025-11&to=2026-10')
  const figure = p.locator('figure').filter({ has: p.getByRole('button', { name: 'Download Figure 1 data as CSV', exact: true }) })
  await figure.getByRole('button', { name: 'View data', exact: true }).click()
  const data = figure.getByRole('region', { name: 'Figure 1 data table, scrolls sideways' })
  assert.equal(await data.locator('tbody tr').count(), 13)
  assert.match(await data.locator('tbody tr').first().innerText(), /Oct 2025/)
  assert.match(await data.locator('tbody tr').last().innerText(), /Oct 2026/)
  assert.match(await figure.locator('.sub').innerText(), /comparison context/)
})
await check('phone triage shows priority and primary signals without sideways panning', async p => {
  await p.setViewportSize({ width: 320, height: 844 })
  await visit(p, '/watchlist/')
  const region = p.locator('.table-scroll').first()
  const id = region.getByRole('button', { name: 'CVE-2021-44228', exact: true })
  await id.waitFor()
  assert(await region.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'phone triage should fit its primary signals in the viewport')
  const row = region.locator('tbody tr').filter({ has: p.getByRole('button', { name: 'CVE-2021-44228', exact: true }) })
  const text = await row.innerText()
  assert.match(text, /Act now/i); assert.match(text, /Apache Log4j2/); assert.match(text, /10\.0/); assert.match(text, /EPSS/); assert.match(text, /99\.9%/)
  await id.click()
  await p.getByRole('dialog', { name: 'CVE-2021-44228' }).getByText(/Improper input validation/).waitFor()
})

await check('masthead controls remain visible with enlarged text at every breakpoint', async p => {
  await visit(p)
  for (const width of [320, 390, 640, 641, 720, 1024, 1440]) {
    await p.setViewportSize({ width, height: 1000 })
    for (const scale of [100, 200]) {
      await p.evaluate(scale => { document.documentElement.style.fontSize = scale + '%' }, scale)
      const clipped = await p.locator('.masthead').evaluate(header => [...header.querySelectorAll('h1, button')].filter(el => {
        const r = el.getBoundingClientRect()
        return r.left < 0 || r.right > innerWidth
      }).map(el => el.getAttribute('aria-label') || el.textContent))
      assert.deepEqual(clipped, [], width + 'px / ' + scale + '% text: masthead controls must stay on screen')
    }
  }
})

await check('source notes take keyboard users directly to the referenced figure', async p => {
  await visit(p)
  const link = p.locator('#note-4').getByRole('link', { name: 'Figure 12', exact: true })
  await link.focus(); await link.press('Enter')
  const figure = p.locator('#figure-12')
  await figure.waitFor()
  assert.match(new URL(p.url()).pathname, /severity/)
  assert(await figure.evaluate(el => el === document.activeElement))
  assert.match(await figure.locator('h3').innerText(), /CVEs NVD has not analysed/)
  assert(await figure.evaluate(el => el.getBoundingClientRect().top >= 0 && el.getBoundingClientRect().top < innerHeight / 2))
})

await check('all routes reflow without page panning at 200 percent text', async p => {
  for (const width of [320, 390, 641, 720]) for (const route of ['/', '/#?from=2026-08&to=2026-10', '/exploitation/', '/severity/', '/vendors/', '/week/', '/watchlist/']) {
    await p.setViewportSize({ width, height: 1000 })
    await visit(p, route)
    if (route === '/watchlist/') await p.getByRole('button', { name: 'CVE-2021-44228', exact: true }).first().waitFor()
    await p.evaluate(async () => {
      document.documentElement.style.fontSize = '200%'
      await document.fonts.ready
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    })
    const size = await p.evaluate(() => ({ width: innerWidth, content: document.documentElement.scrollWidth, skipBottom: document.querySelector('.skip').getBoundingClientRect().bottom }))
    assert(size.content <= size.width + 1, route + ' at ' + width + 'px: page content must fit enlarged text')
    assert(size.skipBottom <= 0, 'the unfocused skip link must remain outside the viewport')
  }
})

await check('slide summaries use a landscape canvas independently of the viewport', async p => {
  await p.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: { write: async () => { throw new Error('Test download fallback') } } }))
  for (const width of [390, 1440]) {
    await p.setViewportSize({ width, height: 1000 })
    await visit(p)
    const pending = p.waitForEvent('download')
    await p.getByRole('button', { name: 'Copy summary for slides', exact: true }).click()
    const stream = await (await pending).createReadStream()
    const chunks = []; for await (const chunk of stream) chunks.push(chunk)
    const png = Buffer.concat(chunks), ratio = png.readUInt32BE(16) / png.readUInt32BE(20)
    assert(ratio > 1.6 && ratio < 1.9, width + 'px: slide summary must be landscape and close to 16:9')
    assert(png.readUInt32BE(16) >= 2000, 'slide text needs enough output resolution')
  }
})
await check('mobile product rankings expose highest EPSS with the product', async p => {
  for (const width of [320, 390]) for (const route of ['/week/', '/severity/']) {
    await p.setViewportSize({ width, height: 1000 })
    await visit(p, route)
    const figure = p.locator(route === '/week/' ? '#figure-15' : '#figure-10')
    const row = figure.locator('tbody tr').first(), signal = row.locator('.mobile-signal')
    await signal.waitFor()
    assert.match(await signal.innerText(), /Highest EPSS/)
    assert((await signal.innerText()).includes((await row.locator('td').last().innerText()).trim()))
    assert(await signal.evaluate(el => el.getBoundingClientRect().right <= innerWidth), 'the ranking score must be visible without panning')
  }
})
await check('private case records present their signals before description housekeeping', async p => {
  await visit(p, '/watchlist/')
  await p.getByRole('button', { name: 'CVE-2021-44228', exact: true }).first().click()
  const sheet = p.getByRole('dialog', { name: 'CVE-2021-44228' })
  const order = await sheet.evaluate(el => ({ name: el.querySelector('.name').getBoundingClientRect().top, signals: el.querySelector('.chips').getBoundingClientRect().top, notice: [...el.querySelectorAll('.record-status')].find(n => n.textContent.includes('Description not loaded')).getBoundingClientRect().top }))
  assert(order.signals < order.notice && order.name < order.notice, 'the CVE meaning and exploitation evidence come before the optional download')
})

await check('chart CSV files retain the source snapshot and interpretation context', async p => {
  for (const [route, figure] of [['/', '1'], ['/week/', '15']]) {
    await visit(p, route)
    const meta = await (await p.request.get(origin + '/data/meta.json')).json()
    const pending = p.waitForEvent('download')
    await p.getByRole('button', { name: `Download Figure ${figure} data as CSV`, exact: true }).click()
    const stream = await (await pending).createReadStream()
    const chunks = []; for await (const chunk of stream) chunks.push(chunk)
    const csv = Buffer.concat(chunks).toString('utf8')
    assert.match(csv.split('\n')[0], /snapshot_generated_at,source_nvd_feed,source_kev_catalogue,source_epss,figure_title,figure_context,figure_notes,provenance/)
    for (const source of [meta.generated, meta.nvd, meta.kev.version, meta.epss]) assert(csv.includes(source), 'download must retain exact source metadata')
    if (figure === '1') {
      assert.match(csv, /NVD publication month/)
      assert.match(csv, /CISA listing month/)
    } else assert.match(csv, /Published in the last 7 days/)
  }
})

await browser.close()
console.log(JSON.stringify(results, null, 2))
process.exitCode = results.some(r => !r.passed) ? 1 : 0
