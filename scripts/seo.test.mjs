import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

// Catches publishing a JS shell, missing section documents, or broken nested asset URLs.
for (const [path, evidence] of [['', 'Latest additions to KEV'], ['exploitation', 'Days to KEV'], ['severity', 'EPSS'], ['vendors', 'weakness'], ['week', 'New KEV listings']]) {
  test(`${path || 'overview'} is a standalone crawlable report`, async () => {
    const html = await readFile(`dist/${path ? path + '/' : ''}index.html`, 'utf8')
    assert.match(html, /<main[\s>]/)
    assert.ok(html.includes(evidence), `missing report content: ${evidence}`)
    assert.ok(html.includes(`rel="canonical" href="https://pulse.nimstead.systems/${path ? path + '/' : ''}"`))
    assert.match(html, /href="\/week\/"/)
    assert.doesNotMatch(html, /(?:src|href)="\.\/assets\//)
    assert.match(html, /Sources and notes/)
  })
}
test('sitemap advertises public reports and robots points to it', async () => {
  const xml = await readFile('dist/sitemap.xml', 'utf8')
  for (const path of ['', 'exploitation/', 'severity/', 'vendors/', 'week/']) assert.ok(xml.includes(`<loc>https://pulse.nimstead.systems/${path}</loc>`))
  assert.doesNotMatch(xml, /watchlist|#|cve=/)
  assert.match(await readFile('dist/robots.txt', 'utf8'), /Sitemap: https:\/\/pulse.nimstead.systems\/sitemap.xml/)
})
