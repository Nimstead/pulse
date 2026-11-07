import { mount } from 'svelte'
import App from './App.svelte'
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
Promise.all([
  load<Data['months']>('monthly.json'), load<Data['kev']>('kev.json'), load<Data['meta']>('meta.json'),
  load<Data['epss']>('epss.json'), load<Data['vendors']>('vendors.json'), load<Data['cwe']>('cwe.json'), load<Data['recent']>('recent.json'),
]).then(([m, kev, meta, epss, vendors, cwe, recent]) => {
  const months = m.filter((x) => x.ym >= '1999-01')
  const { route, params } = readLocation(location.pathname, location.hash)
  const [from, to] = readPeriod(months.map((m) => m.ym), params.get('from'), params.get('to'))
  Object.assign(ui, { route, from, to, vendor: params.get('vendor') ?? '', cve: params.get('cve') ?? '' })
  feed.generated = meta.generated.slice(0, 10); feed.months = months.map((m) => m.ym)
  // Keep the readable daily report until the interactive data is ready.
  target.replaceChildren()
  mount(App, { target, props: { initialData: { months, kev, meta, epss, vendors, cwe, recent } } })
}).catch(() => {
  const message = document.createElement('p')
  message.setAttribute('role', 'alert')
  message.textContent = 'Interactive data could not be loaded. The published report remains available. Reload to try again.'
  target.prepend(message)
})
