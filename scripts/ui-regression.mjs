import assert from 'node:assert/strict'
// Run against a local preview; Playwright may come from an existing tooling install.
const { chromium } = await import(process.env.PULSE_PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, executablePath: process.env.PULSE_BROWSER || undefined })
const origin = process.env.PULSE_URL || 'http://127.0.0.1:5173'
const results = []
async function check(name, fn) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  page.setDefaultTimeout(4000)
  try { await fn(page, context); results.push({ name, passed: true }) }
  catch (e) { results.push({ name, passed: false, error: e.message.split('\n').slice(0, 3).join(' ') }) }
  finally { await context.close() }
}
await check('private analysis shows submitted coverage and queue before save details', async p => {
  await p.goto(origin + '/watchlist/')
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
  const positions = await p.evaluate(() => ({ result: document.querySelector('p.headline').getBoundingClientRect().top, save: document.querySelector('.snapshot-report').getBoundingClientRect().top, queue: [...document.querySelectorAll('figure')].find(x => x.textContent.includes('CVEs in priority order')).getBoundingClientRect().top, details: document.querySelector('.snapshot-report details').open }))
  assert(positions.result < positions.save)
  assert(positions.queue < positions.save, 'the queue must precede save and handover controls')
  assert.equal(positions.details, false)
})
await check('product groups expose every member in severity and weekly tables', async p => {
  for (const route of ['severity', 'week']) {
    await p.goto(origin + '/' + route + '/')
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
  await p.goto(origin + '/vendors/')
  const show = p.getByRole('button', { name: /^Show all \d+ exploited CVEs$/ })
  await show.waitFor()
  const total = Number((await show.innerText()).match(/\d+/)[0])
  await show.click()
  assert.equal(await p.locator('#vendor-kev-list button').count(), total)
})
await check('KEV fallback identifies failed NVD details and retries', async p => {
  await p.route('**/data/cve/2024-0.json', route => route.fulfill({ status: 503, body: 'Unavailable' }))
  await p.goto(origin + '/#?cve=CVE-2024-3400')
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
  await p.goto(origin)
  const citation = p.getByRole('button', { name: 'Note 1', exact: true }).first()
  await citation.focus()
  await citation.press('Enter')
  assert.equal(await p.evaluate(() => document.activeElement.id), 'note-1')
  await p.getByRole('button', { name: 'Back to citation' }).click()
  assert.equal(await citation.evaluate(el => el === document.activeElement), true)
})
await check('PNG failure remains actionable after its original dismissal interval', async p => {
  await p.addInitScript(() => { HTMLCanvasElement.prototype.toBlob = function (cb) { cb(null) } })
  await p.goto(origin + '/exploitation/')
  await p.getByRole('button', { name: 'Copy Figure 4 as PNG' }).click()
  const message = p.getByRole('alert').filter({ hasText: /PNG/ }).first()
  await message.waitFor()
  await p.waitForTimeout(2100)
  assert.match(await message.innerText(), /Try again|Retry/)
})
await check('snapshot and handover preserve unmatched IDs without raw scanner text', async p => {
  await p.goto(origin + '/watchlist/')
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
  await p.goto(origin + '/watchlist/')
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
  await p.goto(origin + '/exploitation/')
  await p.addStyleTag({ content: '.plot { animation-delay: 1s !important; animation-duration: 100ms !important; }' })
  const download = p.waitForEvent('download')
  await p.getByRole('button', { name: 'Copy Figure 4 as PNG' }).click()
  await download
  assert(await p.evaluate(() => window.exportedRedPixels > 500), 'exported plot should contain the crimson bars, not the empty entrance frame')
})
await browser.close()
console.log(JSON.stringify(results, null, 2))
process.exitCode = results.some(r => !r.passed) ? 1 : 0
