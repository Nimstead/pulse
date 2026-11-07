<script lang="ts">
  import { onMount } from 'svelte'
  import { routePath, readLocation, ROUTES } from './lib/routes'
  import { isoWeek, dateLong, num, type Month, type Kev, type Meta, type Epss, type Ranked } from './lib/data'
  import { readPeriod } from './lib/period'
  import { ui } from './lib/state.svelte'
  import Search from './components/Search.svelte'
  import Sheet from './components/Sheet.svelte'
  import Overview from './views/Overview.svelte'
  import Exploitation from './views/Exploitation.svelte'
  import Severity from './views/Severity.svelte'
  import Vendors from './views/Vendors.svelte'
  import Week from './views/Week.svelte'
  import Watchlist, { watchRow } from './views/Watchlist.svelte'
  import type { Recent } from './views/Week.svelte'

  type Data = { months: Month[]; kev: Kev[]; meta: Meta; epss: Epss; vendors: { years: string[]; rows: Ranked[] }; cwe: { years: string[]; rows: Ranked[]; names?: Record<string, string> }; recent: Recent }

  let { initialData: data }: { initialData: Data } = $props()
  let theme = $state<string>(typeof document === 'undefined' ? '' : document.documentElement.dataset.theme ?? '')
  try { theme = localStorage.getItem('theme') ?? '' } catch {}
  $effect(() => {
    if (theme) document.documentElement.dataset.theme = theme
    else delete document.documentElement.dataset.theme
    try { theme ? localStorage.setItem('theme', theme) : localStorage.removeItem('theme') } catch {}
  })
  // another tab switched theme
  onMount(() => {
    const storage = (e: StorageEvent) => { if (e.key === 'theme' || e.key === null) theme = e.newValue ?? '' }
    addEventListener('storage', storage)
    readHash()
    return () => removeEventListener('storage', storage)
  })
  const dark = $derived(theme === 'dark' || (!theme && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches))

  const kevById = $derived(new Map((data?.kev ?? []).map((k) => [k.id, k])))
  const today = $derived(data ? data.meta.generated.slice(0, 10) : '')
  const partial = $derived(!!data && data.months.at(-1)!.ym === today.slice(0, 7))

  function readHash() {
    if (!data) return
    const { route, params: p } = readLocation(location.pathname, location.hash)
    ui.route = route
    const [from, to] = readPeriod(data.months.map((m) => m.ym), p.get('from'), p.get('to'))
    ui.from = from; ui.to = to
    ui.vendor = p.get('vendor') ?? ''
    ui.cve = p.get('cve') ?? ''
  }
  onMount(() => {
    addEventListener('hashchange', readHash)
    addEventListener('popstate', readHash)
    return () => { removeEventListener('hashchange', readHash); removeEventListener('popstate', readHash) }
  })

  // keep the URL in step without stacking history entries for every brush move
  $effect(() => {
    if (!data) return
    const p = new URLSearchParams({ from: data.months[ui.from].ym, to: data.months[ui.to].ym })
    if (ui.vendor && ui.route === 'vendors') p.set('vendor', ui.vendor)
    if (ui.cve && watchRow(ui.cve) === undefined) p.set('cve', ui.cve) // a private-list ID never reaches the URL or history
    const next = `${routePath(ui.route)}#?${p}`
    if (location.pathname + location.hash !== next) history.replaceState(null, '', next)
  })

  let main: HTMLElement
  $effect(() => {
    const r = ROUTES.find((r) => r.id === ui.route)!
    document.title = `${r.title} · Nimstead Pulse`
    document.querySelector('meta[name=description]')?.setAttribute('content', r.description)
    const url = `https://pulse.nimstead.systems${routePath(ui.route)}`
    document.querySelector('link[rel=canonical]')?.setAttribute('href', url)
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', url)
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', document.title)
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', r.description)
  })

  function go(route: string) {
    // a section change is a real history step (Back returns to it); the effect above then rewrites the new top entry
    if (route !== ui.route) { history.pushState(null, '', location.href); main?.focus({ preventScroll: true }) }
    ui.route = route
    scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }
  const openCve = (id: string) => (ui.cve = id)
  const openVendor = (key: string) => { ui.vendor = key; go('vendors') }

  function onkey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ui.search = true }
    else if (e.key === '/' && !(e.target as Element).closest?.('input, textarea, select, [contenteditable]')) { e.preventDefault(); ui.search = true }
  }
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
</script>

<svelte:window onkeydown={onkey} />

<!-- not href="#main": the hash is the router -->
<a class="skip" href="#main" onclick={(e) => { e.preventDefault(); main.focus() }}>Skip to content</a>

<div class="topbar">
  <div class="wrap issue">
    {#if data}
      <span class="series">Vulnerability surveillance</span><span>Vol. {today.slice(0, 4)}</span><span>No. {isoWeek(today)}</span><span class="issued">Updated {dateLong(today)}</span>
      <span class="src">Sources: NVD · CISA KEV · EPSS</span>
    {:else}<span>Loading the latest issue…</span>{/if}
  </div>
</div>

<header class="wrap masthead">
  <!-- product lockup: company in ExtraBold, product word in Regular; the seal belongs to the company mark only -->
  <h1><a href="/" onclick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); go('overview') }}><span class="co">Nimstead</span> <span class="prod">Pulse</span></a></h1>
  <div class="tools">
    <button class="search" onclick={() => (ui.search = true)} aria-label="Search CVEs and vendors" aria-keyshortcuts="Control+K Meta+K">
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.75" /><path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" /></svg>
      <span>Search CVEs and vendors</span><kbd>{isMac ? '⌘' : 'Ctrl'} K</kbd>
    </button>
    <button class="theme" onclick={() => (theme = dark ? 'light' : 'dark')} aria-label="Switch to {dark ? 'light' : 'dark'} theme" title="Switch theme">
      {#if dark}<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="3.2" fill="currentColor" /><g stroke="currentColor" stroke-width="1.5">{#each [0, 45, 90, 135, 180, 225, 270, 315] as a (a)}<line x1="8" y1="0.8" x2="8" y2="2.8" transform="rotate({a} 8 8)" />{/each}</g></svg>
      {:else}<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M13.5 10.2A6 6 0 0 1 5.8 2.5a6 6 0 1 0 7.7 7.7z" fill="currentColor" /></svg>{/if}
    </button>
  </div>
</header>

<nav class="nav" aria-label="Sections">
  <div class="wrap">
    {#each ROUTES as r (r.id)}
      <a href={routePath(r.id)} aria-current={ui.route === r.id ? 'page' : undefined} onclick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); go(r.id) }}>{r.label}</a>
    {/each}
  </div>
</nav>

<main class="wrap" id="main" tabindex="-1" bind:this={main}>
  {#if data}
    {#key ui.route}
      <div class="view">
        {#if ui.route === 'overview'}<Overview months={data.months} kev={data.kev} vendors={data.vendors} {partial} {today} {openCve} {go} />
        {:else if ui.route === 'exploitation'}<Exploitation months={data.months} kev={data.kev} {openCve} />
        {:else if ui.route === 'severity'}<Severity months={data.months} kev={data.kev} epss={data.epss} {partial} {openCve} />
        {:else if ui.route === 'vendors'}<Vendors months={data.months} vendors={data.vendors} cwe={data.cwe} kev={data.kev} {openCve} />
        {:else if ui.route === 'week'}<Week kev={data.kev} recent={data.recent} {today} {openCve} />
        {:else}<Watchlist months={data.months} {kevById} epss={data.epss} cwe={data.cwe.rows} cweNames={data.cwe.names ?? {}} shards={data.meta.shards} indexParts={data.meta.indexParts} {today} {openCve} />{/if}
      </div>
    {/key}
  {:else}
    <div class="loading" aria-busy="true"><span></span><span></span><span></span></div>
  {/if}
</main>

{#if data}
  <footer class="wrap"><div class="notes" id="notes" tabindex="-1">
    <h2 class="kicker">Sources and notes</h2>
    <ol>
      <li id="note-1"><b>CVEs</b> come from the NVD CVE JSON 2.0 feeds (feed time {data.meta.nvd.slice(0, 16).replace('T', ' ')} UTC) and are counted by NVD publication month. {num(data.meta.rejected)} rejected CVEs are excluded from all counts. The current month is partial and is hatched in charts. The headline trend compares the latest 12 full months with the 12 before; the vendor comparison uses this calendar year so far against all of last year.</li>
      <li id="note-2"><b>Exploited</b> means listed in the CISA Known Exploited Vulnerabilities catalogue (version {data.meta.kev.version}, {num(data.meta.kevCount)} entries). KEV only lists vulnerabilities with reliable evidence of exploitation that CISA tracks, so it undercounts real-world exploitation.</li>
      <li id="note-3"><b>Days to KEV</b> is the gap between NVD publication and the KEV <i>dateAdded</i>. Zero or less means CISA listed it on or before NVD published it. This does not establish when exploitation began or whether a fix was available; it is not a zero-day classification.</li>
      <li id="note-4"><b>Severity</b> uses the CVSS base score in the order v3.1, v3.0, v4.0, v2, preferring NVD's own score over the CNA's. Many recent CVEs have not been analysed by NVD yet (see Figure 12).</li>
      <li id="note-5"><b>EPSS</b> is the FIRST Exploit Prediction Scoring System ({data.meta.epss.match(/model_version:([^,]+)/)?.[1] ?? 'model'}, scored {data.meta.epss.match(/score_date:(\d{4}-\d\d-\d\d)/)?.[1] ?? ''}). It estimates the probability of exploitation activity in the next 30 days. It is a probability, not a verdict.</li>
      <li id="note-6"><b>Vendor and product</b> come from the first vulnerable CPE (CVE counts by vendor use the year of publication), falling back to the CNA's affected data. Names are normalised, so small vendors may appear under slightly different spellings.</li>
    </ol>
  </div></footer>
  <div class="closing">
    <div class="wrap">
      <!-- endorsed lockup: the product is the hero here, so Nimstead and its seal step down to the endorsement -->
      <a class="mark" href="https://nimstead.systems">Pulse<small>a <b>Nimstead<i class="seal" aria-hidden="true"></i></b> product</small></a>
      <nav class="links" aria-label="Footer">
        <div><h2>Data</h2><ul>
          <li><a href="https://nvd.nist.gov/">NVD</a></li>
          <li><a href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog">CISA KEV</a></li>
          <li><a href="https://www.first.org/epss/">FIRST EPSS</a></li>
          <li><a href="#notes" onclick={(e) => { e.preventDefault(); const n = document.getElementById('notes'); n?.scrollIntoView(); n?.focus({ preventScroll: true }) }}>Method notes</a></li>
        </ul></div>
        <div><h2>Project</h2><ul>
          <li><a href="https://nimstead.systems">Nimstead</a></li>
          <li><a href="https://nimstead.systems/assure/">Fix and verify with Assure</a></li>
          <li><a href="https://github.com/Nimstead/pulse">Source on GitHub</a></li>
          <li><a href="#top" onclick={(e) => { e.preventDefault(); scrollTo({ top: 0 }); main.focus({ preventScroll: true }) }}>Back to top</a></li>
        </ul></div>
      </nav>
      <p class="gen">Generated {data.meta.generated.replace('T', ' ').slice(0, 16)} UTC from public data. Pulse was partly <a href="https://www.linkedin.com/in/alexandra-early-619299a0/">Alex Early</a>'s idea. Not affiliated with NIST, CISA or FIRST. Code MIT; the Nimstead name and marks are not licensed.</p>
    </div>
  </div>
  <Search bind:open={ui.search} kev={data.kev} vendors={data.vendors.rows} oncve={openCve} onvendor={openVendor} />
  <Sheet bind:id={ui.cve} {kevById} {today} local={watchRow} cweNames={data.cwe.names ?? {}} />
{/if}

<style>
  .topbar { background: var(--band); color: var(--band-fg); }
  .issue { display: flex; flex-wrap: wrap; gap: 0.25rem 1.5rem; padding-top: 0.6rem; padding-bottom: 0.6rem; font: 500 0.6875rem/1.4 var(--sans); letter-spacing: 0.12em; text-transform: uppercase; color: var(--ash); }
  .issue .series { font-weight: 700; color: var(--band-fg); }
  .src { margin-left: auto; }
  .masthead { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding-top: 1.25rem; padding-bottom: 1.25rem; }
  h1 { font: 400 clamp(1.6rem, 3vw, 1.85rem)/1 var(--display); letter-spacing: -0.045em; }
  h1 a { text-decoration: none; display: inline-block; padding: 0.2rem 0; }
  .co { font-weight: 800; }
  .tools { display: flex; gap: 0.5rem; }
  .search, .theme {
    display: inline-flex; align-items: center; gap: 0.6rem; height: 2.75rem; border: 2px solid var(--ink);
    background: var(--paper); padding: 0 0.85rem; cursor: pointer; color: var(--ink-3); transition: border-color 150ms, color 150ms;
  }
  .search:hover, .theme:hover { color: var(--ink); background: var(--shade); }
  .search:active, .theme:active { background: var(--shade); }
  .search span { font-size: 0.9375rem; min-width: 12rem; text-align: left; }
  kbd { font: 500 0.6875rem var(--mono); border: 1px solid var(--rule); padding: 0.1rem 0.35rem; color: var(--ink-3); }
  .theme { width: 2.75rem; padding: 0; justify-content: center; color: var(--ink); }
  .nav { position: sticky; top: 0; z-index: 20; background: var(--chrome); border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); }
  .nav .wrap { display: flex; gap: 0.25rem 2rem; overflow-x: auto; scrollbar-width: none; }
  /* every tab stays visible on a phone; two wrapped rows are too tall to pin */
  @media (max-width: 640px) { .nav { position: static; } .nav .wrap { flex-wrap: wrap; gap: 0 1.1rem; } .nav a { padding: 0.6rem 0 0.5rem; font-size: 0.875rem; } }
  .nav a:focus-visible { outline-offset: -2px; } /* the scrolling row would clip an outside ring */
  .skip { position: absolute; left: 1rem; top: -100px; z-index: 30; background: var(--ink); color: var(--paper); padding: 0.75rem 1rem; font-weight: 700; }
  .skip:focus { top: 0.5rem; }
  main:focus, .notes:focus { outline: none; } /* programmatic focus targets */
  .closing :focus-visible { outline-color: var(--band-fg); } /* an Ink ring would vanish on the band */
  .nav a { flex-shrink: 0; padding: 0.95rem 0 0.85rem; margin-bottom: -1px; text-decoration: none; font-weight: 500; font-size: 0.9375rem; letter-spacing: -0.01em; color: var(--ink-3); border-bottom: 2px solid transparent; transition: color 120ms, border-color 120ms; }
  .nav a:hover { color: var(--ink); border-bottom-color: var(--line-strong); }
  .nav a[aria-current='page'] { color: var(--ink); font-weight: 700; border-bottom-color: var(--ink); }
  main { min-height: 60vh; }
  .view { animation: view-in 420ms var(--ease-out) both; }
  @keyframes view-in { from { opacity: 0; transform: translateY(8px); } }
  .loading { display: flex; gap: 6px; align-items: flex-end; height: 140px; padding: 3rem 0; }
  .loading span { width: 18px; background: var(--ink); animation: pulse 900ms ease-in-out infinite alternate; }
  .loading span:nth-child(2) { animation-delay: 150ms; } .loading span:nth-child(3) { animation-delay: 300ms; background: var(--kev); }
  @keyframes pulse { from { height: 20%; } to { height: 100%; } }
  .notes { border-top: 2px solid var(--rule-strong); margin-top: 3.5rem; padding-top: 1.25rem; padding-bottom: 3rem; font-size: 0.8125rem; color: var(--ink-3); }
  .notes ol { columns: 2 22rem; column-gap: 3rem; padding-left: 1.2rem; margin: 1rem 0 0; }
  .notes li { max-width: 70ch; text-wrap: pretty; break-inside: avoid; margin-bottom: 0.7rem; scroll-margin-top: 5rem; padding: 0.15rem 0.3rem; margin-left: -0.3rem; transition: background-color 300ms; }
  .notes li::marker { font-weight: 700; color: var(--ink); }
  .notes li:target, .notes li:focus-within { background: var(--shade); }
  .notes b { color: var(--ink); }
  .closing { background: var(--band); color: var(--band-fg); padding: clamp(2.5rem, 6vw, 4.5rem) 0 2.5rem; }
  .closing .wrap { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 2.5rem 3rem; }
  .mark { justify-self: start; display: grid; gap: 0.75rem; font: 800 clamp(2.5rem, 7vw, 5rem)/0.86 var(--display); letter-spacing: -0.055em; color: var(--band-fg); text-decoration: none; }
  .mark:hover small { color: var(--band-fg); }
  .links { display: flex; gap: clamp(2rem, 5vw, 4.5rem); }
  .links h2 { font: 600 0.6875rem/1.3 var(--sans); letter-spacing: 0.12em; text-transform: uppercase; color: var(--ash); margin: 0 0 0.6rem; }
  .links ul { list-style: none; margin: 0; padding: 0; }
  .links a { display: inline-block; padding: 0.625rem 0; font-size: 0.9375rem; line-height: 1.6; color: var(--band-fg); text-decoration: none; } /* 44px tall targets */
  .links a:hover { text-decoration: underline; text-decoration-thickness: 1px; }
  .gen { grid-column: 1 / -1; padding-top: 1.25rem; border-top: 1px solid var(--band-line); max-width: none; }
  @media (max-width: 640px) { .closing .wrap { grid-template-columns: minmax(0, 1fr); } }
  .mark small { font: 400 0.8125rem/1.2 var(--sans); letter-spacing: 0; color: var(--ash); }
  .mark b { font-weight: 800; letter-spacing: -0.03em; color: var(--band-fg); }
  .mark .seal { font-size: 1.375rem; }
  .seal { display: inline-block; width: 0.18em; height: 0.18em; background: var(--seal); vertical-align: top; margin: 0.06em 0 0 0.05em; }
  .gen { margin: 0; font-size: 0.8125rem; color: var(--ash); }
  .gen a { display: inline-block; padding: 0.75rem 0; margin: -0.75rem 0; color: var(--band-fg); text-decoration: underline; text-decoration-thickness: 1px; } /* a 44px target inside a line of small print */
  .gen a:hover { text-decoration-thickness: 2px; }
  @media (max-width: 640px) {
    .search span, .search kbd { display: none; }
    .search { width: 2.75rem; padding: 0; justify-content: center; color: var(--ink); }
    .src { margin-left: 0; }
    .issue span:not(.series):not(.issued) { display: none; }
  }
</style>
