import { build } from 'vite'
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises'

// Reuse the interactive report components and data; never maintain a second set of figures.
await build({ build: { ssr: 'src/entry-server.ts', outDir: '.prerender', copyPublicDir: false } })
const { renderReport, ROUTES, routePath } = await import('../.prerender/entry-server.js')
const data = Object.fromEntries(await Promise.all(['monthly', 'kev', 'meta', 'epss', 'vendors', 'cwe', 'recent'].map(async (name) => [name === 'monthly' ? 'months' : name, JSON.parse(await readFile(`public/data/${name}.json`, 'utf8'))])))
data.months = data.months.filter((m) => m.ym >= '1999-01')
const template = await readFile('dist/index.html', 'utf8')
const escape = (s) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')
for (const r of ROUTES) {
  const url = `https://pulse.nimstead.systems${routePath(r.id)}`
  const title = escape(`${r.title} · Nimstead Pulse`)
  const html = template
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${escape(r.description)}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${title}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${escape(r.description)}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${url}`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${url}`)
    .replace('<div id="app"></div>', () => `<div id="app">${renderReport(data, r.id)}</div>`)
  const dir = `dist${routePath(r.id)}`
  await mkdir(dir, { recursive: true })
  await writeFile(`${dir}index.html`, html)
}
// No artificial lastmod: only add one when tracking substantive changes per report.
await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${ROUTES.filter((r) => r.id !== 'watchlist').map((r) => `  <url><loc>https://pulse.nimstead.systems${routePath(r.id)}</loc></url>`).join('\n')}\n</urlset>\n`)
await rm('.prerender', { recursive: true })
