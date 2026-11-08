<script lang="ts">
  import { tick } from 'svelte'
  import Figure from '../components/Figure.svelte'
  import Rows from '../components/Rows.svelte'
  import Bars from '../components/Bars.svelte'
  import Period from '../components/Period.svelte'
  import { ui } from '../lib/state.svelte'
  import { num, dateShort, monthShort, titleCase, productName, type Month, type Ranked, type Kev } from '../lib/data'

  let { months, vendors, cwe, kev, openCve }: {
    months: Month[]; vendors: { years: string[]; rows: Ranked[] }; cwe: { years: string[]; rows: Ranked[] }; kev: Kev[]; openCve: (id: string) => void
  } = $props()

  // CVE totals use calendar-year buckets; KEV listings use the selected months.
  const y0 = $derived(months[ui.from].ym.slice(0, 4)), y1 = $derived(months[ui.to].ym.slice(0, 4))
  const span = (years: string[]) => {
    const a = years.indexOf(y0), b = years.indexOf(y1)
    return [a < 0 ? 0 : a, b < 0 ? years.length - 1 : b] as const
  }
  // exploited counts follow the period: KEV listings added in the selected months
  const m0 = $derived(months[ui.from].ym), m1 = $derived(months[ui.to].ym)
  const kevIn = $derived(kev.filter((k) => k.added.slice(0, 7) >= m0 && k.added.slice(0, 7) <= m1))
  // matched by CVE ID to the NVD vendor, the same key the CVE counts use
  const kevByVendor = $derived.by(() => { const m = new Map<string, number>(); for (const k of kevIn) m.set(k.nv, (m.get(k.nv) ?? 0) + 1); return m })
  const kevByCwe = $derived.by(() => { const m = new Map<string, number>(); for (const k of kevIn) if (k.cwe) m.set(k.cwe, (m.get(k.cwe) ?? 0) + 1); return m })
  const vendorKevN = (key: string) => kevByVendor.get(key) ?? 0
  const by = $derived(ui.vendorSort === 'cves' ? 'cves' : 'kev')
  function rank(src: { years: string[]; rows: Ranked[] }, n: number, label: (r: Ranked) => string, skip = (_: Ranked) => false, sort: 'cves' | 'kev' = 'cves', kevOf: (r: Ranked) => number = (r) => r.kev) {
    const [a, b] = span(src.years)
    return src.rows.filter((r) => !skip(r)).map((r) => ({
      key: r.key, label: label(r), value: r.byYear.slice(a, b + 1).reduce((x, y) => x + y, 0), kev: kevOf(r),
      spark: r.byYear.slice(Math.max(0, b - 9), b + 1),
    })).sort((x, y) => (sort === 'kev' ? y.kev - x.kev || y.value - x.value : y.value - x.value)).slice(0, n)
  }
  const vRows = $derived(rank(vendors, 20, (r) => titleCase(r.key), undefined, by, (r) => vendorKevN(r.key)))
  const cby = $derived(ui.cweSort === 'cves' ? 'cves' : 'kev')
  const cRows = $derived(rank(cwe, 15, (r) => r.name ?? r.key, (r) => r.key.startsWith('NVD-CWE'), cby, (r) => kevByCwe.get(r.key) ?? 0).map((r) => ({ ...r, sub: r.key })))

  const leadingCwe = $derived(rank(cwe, 2, (r) => r.name ?? r.key, (r) => r.key.startsWith('NVD-CWE'), 'kev', (r) => kevByCwe.get(r.key) ?? 0).filter((r) => r.kev > 0))
  const mostKev = $derived(rank(vendors, 2, (r) => titleCase(r.key), undefined, 'kev', (r) => vendorKevN(r.key)).filter((r) => r.kev > 0))
  const current = $derived(vendors.rows.find((r) => r.key === ui.vendor) ?? null)
  const vendorKev = $derived(current ? kev.filter((k) => k.nv === current.key) : [])
  $effect(() => { if (!ui.vendor && vRows.length) ui.vendor = vRows[0].key })
  let expandedVendor = $state('')
  let drill: HTMLElement
  let origin = $state<HTMLElement | null>(null)
  async function pick(key: string, event: MouseEvent) {
    origin = event.currentTarget as HTMLElement
    ui.vendor = key
    await tick()
    if (matchMedia('(max-width: 900px)').matches) {
      drill?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
      if (event.detail === 0) drill?.focus({ preventScroll: true })
    }
  }
</script>

<header class="view-head">
  <h2>Vendors and weaknesses</h2>
  {#if !kevIn.length}
    <p class="insight">No KEV listings from {monthShort(m0)} to {monthShort(m1)}. CISA began the catalogue in November 2021. The CVE counts and lifetime vendor profiles remain available below.</p>
  {:else if mostKev.length}
    <p class="insight"><b>{mostKev[0].label}</b> {mostKev[1]?.kev === mostKev[0].kev ? 'is among the vendors with the most' : 'had the most'} CVEs added to KEV from {monthShort(m0)} to {monthShort(m1)} ({num(mostKev[0].kev)}){#if mostKev[1] && mostKev[1].kev < mostKev[0].kev}, ahead of {mostKev[1].label} ({num(mostKev[1].kev)}){/if}. {#if leadingCwe.length}<b>{leadingCwe[0].label}</b> {leadingCwe[1]?.kev === leadingCwe[0].kev ? 'is among the most common weaknesses' : 'is the most common weakness'} across KEV listings in the period ({num(leadingCwe[0].kev)}).{/if}</p>
  {/if}
  <p>Where CVEs come from, and the classes of mistake behind them. Select a vendor for its products and exploited CVEs.</p>
</header>
<div class="view-period"><Period {months} compact /></div>
<p class="scope-note"><b>CVE counts:</b> calendar years {y0}{y0 === y1 ? '' : `–${y1}`}{y1 === months.at(-1)!.ym.slice(0, 4) ? ' (latest year so far)' : ''}. <b>KEV listings:</b> {monthShort(m0)}–{monthShort(m1)}. <b>Vendor details:</b> all time, independent of this period.</p>

<div class="split">
  <Figure n={13} name="top-vendors" title={by === 'kev' ? 'Vendors with the most exploited CVEs' : 'Vendors with the most CVEs'} sub="CVEs published {y0}{y0 === y1 ? '' : `–${y1}`}. Exploited counts KEV listings added {monthShort(m0)} to {monthShort(m1)}. Trend shows the last 10 years."
    csv={() => vRows.map((r) => ({ vendor: r.key, cves: r.value, exploited_in_period: r.kev }))}>
    <div class="toggle" role="group" aria-label="Rank vendors by">
      <button aria-pressed={by === 'cves'} onclick={() => { ui.vendorSort = 'cves'; ui.vendor = '' }}>Most CVEs</button>
      <button aria-pressed={by === 'kev'} onclick={() => { ui.vendorSort = 'kev'; ui.vendor = '' }}>Most exploited</button>
    </div>
    <Rows rows={vRows} selected={ui.vendor} onpick={pick} controls="vendor-profile" byKev={by === 'kev'} valueLabel="CVEs {y0.slice(2)}–{y1.slice(2)}" kevLabel="KEV in period" trendLabel="10-year trend" />
  </Figure>

  <section class="drill" id="vendor-profile" aria-label="Lifetime profile: {current ? titleCase(current.key) : 'select a vendor'}" tabindex="-1" bind:this={drill}>
    {#if current}
      {#key current.key}
        <Figure n="13a" period={false} name="vendor-{current.key}" title="Lifetime profile: {titleCase(current.key)}" sub="All years, independent of the selected period: {num(current.total)} CVEs since records began · {num(current.kev)} exploited. Product counts follow KEV's broader product names."
          csv={() => (current.products ?? []).map((p) => ({ product: p.key, cves: p.total, exploited: p.kev }))}>
          {#snippet notes()}Exploited counts match CISA's product names, which can differ from NVD's, so a product may show fewer exploited CVEs than its vendor total suggests.{/snippet}
          <Bars label="{current.key} CVEs per year" labels={vendors.years} height={150}
            series={[{ key: 'n', label: 'CVEs', color: 'var(--vol)', values: current.byYear }]}
            tick={(l, i) => ((vendors.years.length - 1 - i) % 5 === 0 ? l : null)} />
          <h4 class="kicker sec">Top products</h4>
          <Rows rows={(current.products ?? []).map((p) => ({ key: p.key, label: productName(current.key, p.key), value: p.total, kev: p.kev }))} showRate valueLabel="CVEs, all time" kevLabel="KEV, all time" />
          {#if vendorKev.length}
            <h4 class="kicker sec">Exploited CVEs · all time</h4>
            <p class="list-count">{expandedVendor === current.key ? `All ${num(vendorKev.length)} exploited CVEs` : `Latest ${num(Math.min(12, vendorKev.length))} of ${num(vendorKev.length)} exploited CVEs`}</p>
            <ul class="kl" id="vendor-kev-list">
              {#each expandedVendor === current.key ? vendorKev : vendorKev.slice(0, 12) as k (k.id)}
                <li><button class="linklike mono-id" onclick={() => openCve(k.id)}>{k.id}</button><span>{k.product}</span><span class="d">{dateShort(k.added)}</span></li>
              {/each}
            </ul>
            {#if vendorKev.length > 12}<button class="linklike more" aria-expanded={expandedVendor === current.key} aria-controls="vendor-kev-list" onclick={() => expandedVendor = expandedVendor === current!.key ? '' : current!.key}>{expandedVendor === current.key ? 'Show latest 12' : `Show all ${num(vendorKev.length)} exploited CVEs`}</button>{/if}
          {/if}
        </Figure>
        {#if origin}<button class="linklike back" onclick={() => origin?.focus()}>Back to selected vendor</button>{/if}
      {/key}
    {/if}
  </section>
</div>

<Figure n={14} name="top-weaknesses" title={cby === 'kev' ? 'The weaknesses behind the most exploited CVEs' : 'The weaknesses behind the most CVEs'} sub="CWE types; CVEs published {y0}{y0 === y1 ? '' : `–${y1}`}. Exploited counts KEV listings added {monthShort(m0)} to {monthShort(m1)}."
  csv={() => cRows.map((r) => ({ cwe: r.key, name: r.label, cves: r.value, exploited_in_period: r.kev }))}>
  <div class="toggle" role="group" aria-label="Rank weaknesses by">
    <button aria-pressed={cby === 'cves'} onclick={() => (ui.cweSort = 'cves')}>Most CVEs</button>
    <button aria-pressed={cby === 'kev'} onclick={() => (ui.cweSort = 'kev')}>Most exploited</button>
  </div>
  <Rows rows={cRows} byKev={cby === 'kev'} valueLabel="CVEs {y0.slice(2)}–{y1.slice(2)}" kevLabel="KEV in period" trendLabel="10-year trend" />
  {#snippet notes()}CVEs that NVD marks as having insufficient information or "Other" weakness types are left out. Injection and memory-safety classes top this list.{/snippet}
</Figure>

<style>
  .toggle { display: inline-flex; border: 2px solid var(--ink); margin-bottom: 1rem; }
  .toggle button { background: var(--paper); border: 0; border-left: 2px solid var(--ink); padding: 0.45rem 0.85rem; min-height: 2.75rem; font: 700 0.8125rem var(--sans); color: var(--ink-2); cursor: pointer; }
  .toggle button:first-child { border-left: 0; }
  .toggle button:hover { background: var(--shade); color: var(--ink); }
  .toggle button[aria-pressed='true'] { background: var(--ink); color: var(--paper); }
  .split { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: clamp(1.5rem, 3vw, 3rem); }
  .drill { position: sticky; top: 3.5rem; align-self: start; scroll-margin-top: 4rem; }
  .back { min-height: 2.75rem; font-weight: 600; }
  .scope-note { margin: -0.75rem 0 1.5rem; font-size: 0.875rem; color: var(--ink-2); max-width: 85ch; }
  .list-count { margin: 0 0 0.5rem; color: var(--ink-2); font-size: 0.875rem; }
  .more { min-height: 2.75rem; margin-top: 0.5rem; font-weight: 600; }
  .sec { margin: 1.4rem 0 0.6rem; }
  .kl { list-style: none; margin: 0; padding: 0; font-size: 0.875rem; }
  .kl li { display: flex; flex-wrap: wrap; gap: 0.75rem; padding: 0.4rem 0; border-bottom: 1px solid var(--rule); }
  .kl span { color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .kl .d { margin-left: auto; color: var(--ink-3); flex-shrink: 0; }
  @media (max-width: 900px) { .split { grid-template-columns: minmax(0, 1fr); } .drill { position: static; } }
</style>
