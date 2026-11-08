import { mount, tick } from 'svelte'
import App from './App.svelte'
import { watch } from './views/Watchlist.svelte'
import { load } from './lib/data'
import { ui, feed } from './lib/state.svelte'
import { readPeriod } from './lib/period'
import { readLocation } from './lib/routes'
// Fonts are bundled so the page talks to no other origin.
import '@fontsource-variable/archivo/wght.css'
import '@fontsource-variable/geist-mono/wght.css'
import './app.css'

type Data = NonNullable<Parameters<typeof App>[1]['initialData']>
const target = document.getElementById('app')!
async function start() {
  const status = target.querySelector<HTMLElement>('#analysis-startup, #startup-status') ?? document.createElement('div')
  if (!status.isConnected) { status.id = 'startup-status'; status.className = 'startup-status wrap'; target.prepend(status) }
  const retrying = status.contains(document.activeElement)
  status.setAttribute('role', 'status')
  status.textContent = target.querySelector('#watch-text') ? 'Preparing private analysis. File imports will be available when the public data loads.' : 'Loading interactive data…'
  try {
    const [m, kev, meta, epss, vendors, cwe, recent] = await Promise.all([
      load<Data['months']>('monthly.json'), load<Data['kev']>('kev.json'), load<Data['meta']>('meta.json'),
      load<Data['epss']>('epss.json'), load<Data['vendors']>('vendors.json'), load<Data['cwe']>('cwe.json'), load<Data['recent']>('recent.json'),
    ])
    const months = m.filter((x) => x.ym >= '1999-01')
    const { route, params, windowDays, kevDeadlines, vendorSort, cweSort } = readLocation(location.pathname, location.hash)
    const [from, to] = readPeriod(months.map((m) => m.ym), params.get('from'), params.get('to'))
    Object.assign(ui, { route, from, to, windowDays, kevDeadlines, vendorSort, cweSort, vendor: params.get('vendor') ?? '', cve: params.get('cve') ?? '' })
    feed.generated = meta.generated.slice(0, 10); feed.months = months.map((m) => m.ym); feed.meta = meta
    // The published textarea is usable while data loads; keep its private input in memory.
    const input = target.querySelector<HTMLTextAreaElement>('#watch-text')
    const editing = input === document.activeElement
    const selection = input ? [input.selectionStart, input.selectionEnd, input.selectionDirection] as const : null
    if (input) watch.text = input.value
    // Keep the readable daily report until the interactive data is ready.
    target.replaceChildren()
    mount(App, { target, props: { initialData: { months, kev, meta, epss, vendors, cwe, recent } } })
    if ((editing && selection) || (retrying && input)) {
      await tick()
      const field = target.querySelector<HTMLTextAreaElement>('#watch-text')
      field?.focus({ preventScroll: true })
      if (selection) field?.setSelectionRange(...selection)
    }
  } catch {
    status.setAttribute('role', 'alert')
    const message = document.createElement('p')
    message.textContent = target.querySelector('#watch-text')
      ? 'Private analysis could not start because the public data did not load. Your pasted text is still here. Retry without reloading this page.'
      : 'Interactive data could not be loaded. The published report remains available. Retry without reloading this page.'
    const retry = document.createElement('button')
    retry.className = 'startup-retry'
    retry.textContent = 'Retry loading data'
    retry.onclick = () => { void start() }
    status.replaceChildren(message, retry)
  }
}
void start()
