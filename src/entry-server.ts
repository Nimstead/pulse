import { render } from 'svelte/server'
import App from './App.svelte'
import { ui } from './lib/state.svelte'
import { readPeriod } from './lib/period'
export { ROUTES, routePath } from './lib/routes'

export function renderReport(initialData: NonNullable<Parameters<typeof App>[1]['initialData']>, route: string) {
  const [from, to] = readPeriod(initialData.months.map((m) => m.ym), null, null)
  Object.assign(ui, { route, from, to, vendor: '', cve: '', search: false, windowDays: 7, vendorSort: 'kev', cweSort: 'kev' })
  return render(App, { props: { initialData } }).body
}
