<script lang="ts">
  import Figure from '../components/Figure.svelte'
  import Bars from '../components/Bars.svelte'
  import Period from '../components/Period.svelte'
  import { ui } from '../lib/state.svelte'
  import { num, pct, epssPct, dateShort, monthLong, monthShort, sum, SEV, SEV_COLOR, share, epssBands, titleCase, vp, type Month, type Kev, type Epss } from '../lib/data'
  import { byYear, yearTick } from '../lib/derive'

  let { months, kev, epss, partial, openCve }: { months: Month[]; kev: Kev[]; epss: Epss; partial: boolean; openCve: (id: string) => void } = $props()

  const sel = $derived(months.slice(ui.from, ui.to + 1))
  const a = $derived(sel[0].ym), b = $derived(sel.at(-1)!.ym)
  const years = $derived(byYear(sel, ['c', 'h', 'm', 'l', 'u', 'n', 'unan', 'def']))

  // Figure 8: all CVEs vs exploited CVEs, by severity, for CVEs published in the period
  // full months only, so these totals match the Overview's
  const selFull = $derived(sel.filter((m) => !(partial && m === months.at(-1))))
  const allMix = $derived(SEV.map((s) => sum(selFull, (m) => m[s.key])))
  // the watchlist follows the period like every other figure here, so a 2014 CVE doesn't top a 5-year view
  const watch = $derived(epss.watch.filter((w) => w.pub.slice(0, 7) >= a && w.pub.slice(0, 7) <= b))
  // one row per product: the list is EPSS-sorted, so each group's first CVE is its highest
  const watchGroups = $derived.by(() => {
    const g = new Map<string, typeof watch>()
    for (const w of watch) { const k = vp(w.vendor, w.product); (g.get(k) ?? g.set(k, []).get(k)!).push(w) }
    return [...g].map(([name, rows]) => ({ name, rows, top: rows[0] }))
  })
  const ageMo = (pub: string) => (+b.slice(0, 4) - +pub.slice(0, 4)) * 12 + (+b.slice(5, 7) - +pub.slice(5, 7))
  const kevPub = $derived(selFull.length ? kev.filter((k) => k.pub && k.pub.slice(0, 7) >= a && k.pub.slice(0, 7) <= selFull.at(-1)!.ym) : [])
  const kevMix = $derived(SEV.map((s) => kevPub.filter((k) => k.sev === s.full).length))
  const critOfKev = $derived(share(kevMix)[0])
  const notCritKev = $derived(1 - share(kevMix)[0])

  // Figure 9: EPSS population shares
  const allTot = $derived(epss.all.reduce((x, y) => x + y, 0))
  const kevTot = $derived(epss.kev.reduce((x, y) => x + y, 0))
  const binLabels = $derived(epssBands(epss.edges))
  const highEpss = $derived(epss.all.slice(4).reduce((x, y) => x + y, 0))
  let shown = $state(25)
  let expandedProduct = $state('')
</script>

<header class="view-head">
  <h2>Severity and exploit likelihood</h2>
  {#if kevPub.length}<p class="insight"><b>{pct(notCritKev)}</b> of the exploited CVEs published {monthShort(a)} to {monthShort(selFull.at(-1)!.ym)} were not rated Critical.</p>{/if}
  <p>CVSS says how bad a flaw could be. EPSS estimates how likely it is to be exploited. The two often disagree, and the gap shows where severity alone misleads.</p>
</header>
<div class="view-period"><Period {months} compact /></div>

<Figure n={8} name="severity-exploited" title="Critical is not the whole story" sub={selFull.length ? `Severity of CVEs published ${monthShort(a)} to ${monthShort(selFull.at(-1)!.ym)}: all of them, and those later listed in KEV. Complete months only.` : 'Complete months only; the current month is still in progress.'}
  csv={selFull.length ? () => SEV.map((s, i) => ({ severity: s.label, all_cves: allMix[i], exploited: kevMix[i] })) : undefined}>
  {#snippet legend()}{#each SEV as s (s.key)}<span><span class="swatch" style:background={SEV_COLOR[s.key]}></span> {s.label}</span>{/each}{/snippet}
  {#if !selFull.length}
    <p>No complete month in this selection. Choose a longer period to compare severity; the charts below still show the available partial-month data.</p>
  {:else}
  <div class="hbars">
    {#each [{ label: 'All CVEs', n: sum(allMix, (x) => x), mix: allMix }, { label: 'Published in period, later in KEV', n: kevPub.length, mix: kevMix }] as r (r.label)}
      <div class="hrow">
        <div class="hl"><b>{r.label}</b><span>{num(r.n)}</span></div>
        <div class="hb" role="img" aria-label="{r.label}: {SEV.map((s, i) => `${s.label} ${pct(share(r.mix)[i])}`).join(', ')}">
          {#each SEV as s, i (s.key)}
            {@const w = share(r.mix)[i]}
            {#if w > 0}<span style:width="{w * 100}%" style:background={SEV_COLOR[s.key]} class:dark={i < 2} class:edge={s.key === 'l' || s.key === 'u'} title="{s.label}: {num(r.mix[i])}">{w > 0.06 ? pct(w) : ''}</span>{/if}
          {/each}
        </div>
      </div>
    {/each}
  </div>
  {/if}
  {#snippet notes()}
    {#if kevPub.length}{pct(notCritKev)} of exploited CVEs from this period were <b>not</b> rated Critical. A "patch Criticals first" policy alone would miss them. Critical CVEs are {pct(critOfKev)} of the exploited set but {pct(share(allMix)[0])} of all CVEs, so severity is a weak filter on its own.{/if}
  {/snippet}
</Figure>

<Figure n={9} name="epss-distribution" title="Exploit probability (EPSS) across all CVEs and exploited CVEs" period={false} sub="All years: share of each population in each EPSS band. Scores are current, not as at publication."
  csv={() => binLabels.map((l, i) => ({ epss_band: l, all_cves: epss.all[i], kev_cves: epss.kev[i] }))}>
  {#snippet legend()}
    <span><span class="swatch" style:background="var(--vol)"></span> All CVEs not in KEV ({num(allTot)})</span>
    <span><span class="swatch" style:background="var(--kev)"></span> All CVEs in KEV, any year ({num(kevTot)})</span>
  {/snippet}
  <Bars label="EPSS distribution" labels={binLabels} height={250} stacked={false} format={(v) => pct(v, 1)} axis={(t) => pct(t)}
    series={[
      { key: 'all', label: 'All CVEs not in KEV', color: 'var(--vol)', values: epss.all.map((v) => v / (allTot || 1)) },
      { key: 'kev', label: 'CVEs in KEV', color: 'var(--kev)', values: epss.kev.map((v) => v / (kevTot || 1)) },
    ]} tick={(l) => l} />
  {#snippet notes()}{num(highEpss)} CVEs not currently in KEV score 10% or more. The list below is a capped subset of these elevated EPSS signals; confirm whether affected products and versions are present in your environment.{/snippet}
</Figure>

<Figure n={10} name="epss-watchlist" title="Elevated EPSS, not currently in KEV" sub="One row per product with EPSS of 10% or more and no current KEV listing, ranked by its highest EPSS. It draws on the {num(watch.length)} CVEs published {monthShort(a)} to {monthShort(b)} among the 300 highest-EPSS CVEs not in KEV, of {num(epss.watchTotal)} at 10% or more overall. EPSS estimates probability; it does not establish exposure or exploitation."
  csv={() => watch.map((w) => ({ cve: w.id, epss: w.epss, percentile: w.pct, vendor: w.vendor, product: w.product, severity: w.sev, score: w.score, published: w.pub }))}>
  {#if watchGroups.length > shown}<p class="table-scope">First {num(shown)} of {num(watchGroups.length)} products shown. CSV includes all matching CVEs.</p>{/if}
  {#if watchGroups.length}<p class="table-hint" data-no-export>Scroll sideways for all signals. The CVE stays in view.</p>{/if}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (a scroll region must be focusable to scroll by keyboard) -->
  <div class="table-scroll" tabindex="0" role="region" aria-label="Table, scrolls sideways">
    <table class="data">
      <thead><tr><th>Vendor · product</th><th class="r">CVEs</th><th class="row-identity">Highest</th><th>Severity</th><th class="r">Age</th><th class="r">EPSS</th></tr></thead>
      <tbody>
        {#each watchGroups.slice(0, shown) as g, i (g.name)}
          {@const w = g.top}
          {@const age = ageMo(w.pub)}
          <tr>
            <td><b>{g.name}</b><div class="mobile-signal" data-no-export>Highest EPSS <b>{epssPct(w.epss)}</b></div></td>
            <td class="r"><button class="group-toggle" aria-label="{expandedProduct === g.name ? 'Hide' : 'Show'} {g.rows.length} CVE{g.rows.length === 1 ? '' : 's'} for {g.name}" aria-expanded={expandedProduct === g.name} aria-controls="severity-group-{i}" onclick={() => expandedProduct = expandedProduct === g.name ? '' : g.name}>{num(g.rows.length)} CVE{g.rows.length === 1 ? '' : 's'}</button></td>
            <td class="row-identity"><button class="linklike mono-id" onclick={() => openCve(w.id)}>{w.id}</button><div class="sm">{dateShort(w.pub)}</div></td>
            <td>{w.sev ? `${titleCase(w.sev.toLowerCase())}${w.score != null ? ` ${w.score.toFixed(1)}` : ''}` : '—'}</td>
            <td class="r nw">{age < 1 ? 'New' : age < 24 ? `${age} mo` : `${Math.floor(age / 12)} yr`}</td>
            <td class="r"><b>{epssPct(w.epss)}</b></td>
          </tr>
          <tr id="severity-group-{i}" class="group-detail" hidden={expandedProduct !== g.name}>
            <td colspan="6">
              {#if expandedProduct === g.name}
              <ul class="group-members" aria-label="CVEs for {g.name}">
                {#each g.rows as member (member.id)}
                  <li><button class="linklike mono-id" onclick={() => openCve(member.id)}>{member.id}</button><span>Published {dateShort(member.pub)}</span><span>{member.sev ? titleCase(member.sev.toLowerCase()) : 'Not scored'}{member.score != null ? ` ${member.score.toFixed(1)}` : ''}</span><span>EPSS {epssPct(member.epss)}</span></li>
                {/each}
              </ul>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if shown < watchGroups.length}<button class="linklike more" data-no-export onclick={() => (shown += 50)}>Show more</button>{/if}
</Figure>

<div class="grid-2">
  <Figure n={11} name="severity-mix" title="Severity mix of new CVEs, by year" sub="Share of CVEs published each year, by CVSS base severity"
    csv={() => years.map((y) => ({ year: y.year, critical: y.c, high: y.h, medium: y.m, low: y.l, not_scored: y.u }))}>
    {#snippet legend()}{#each SEV as s (s.key)}<span><span class="swatch" style:background={SEV_COLOR[s.key]}></span> {s.label}</span>{/each}{/snippet}
    <Bars label="Severity share by year" labels={years.map((y) => y.year)} height={260} normalize
      series={SEV.map((s) => ({ key: s.key, label: s.label, color: SEV_COLOR[s.key], values: years.map((y) => y[s.key]) }))}
      tick={(l, i) => (years.length <= 12 || i % 2 === 0 ? l : null)} />
  </Figure>

  <Figure n={12} name="nvd-backlog" title="CVEs NVD has not analysed" sub="Share of each month's CVEs that are deferred or still waiting for NVD analysis"
    csv={() => sel.map((m) => ({ month: m.ym, published: m.n, awaiting_analysis: m.unan, deferred: m.def }))}>
    {#snippet legend()}
      <span><span class="swatch" style:background="var(--ink-2)"></span> Awaiting analysis</span>
      <span><span class="swatch" style:background="var(--ink-3)"></span> Deferred by NVD</span>
      <span><span class="swatch" style:background="var(--shade)"></span> Analysed or modified</span>
    {/snippet}
    <Bars label="Share of CVEs awaiting or deferred NVD analysis per month" labels={sel.map((m) => m.ym)} height={260} normalize hatchLast={partial && ui.to === months.length - 1}
      series={[
        { key: 'unan', label: 'Awaiting analysis', color: 'var(--ink-2)', values: sel.map((m) => m.unan) },
        { key: 'def', label: 'Deferred by NVD', color: 'var(--ink-3)', values: sel.map((m) => m.def) },
        { key: 'ok', label: 'Analysed or modified', color: 'var(--shade)', values: sel.map((m) => m.n - m.unan - m.def) },
      ]}
      tick={(l, i) => yearTick(l, i, sel.length)} tipTitle={monthLong} />
    {#snippet notes()}Unanalysed CVEs often lack NVD's CPE product data and score, so NVD-only tooling misses them. Where NVD has no score, this report uses the CNA's.{/snippet}
  </Figure>
</div>

<style>
  .hbars { display: grid; gap: 1.1rem; }
  .hrow { display: grid; grid-template-columns: 11rem 1fr; gap: 1rem; align-items: center; }
  .hl { display: grid; font-size: 0.875rem; }
  .hl span { color: var(--ink-3); font-size: 0.8rem; }
  .hb { display: flex; height: 2.4rem; overflow: hidden; }
  .hb span { display: flex; align-items: center; justify-content: center; font: 600 0.8125rem var(--sans); color: var(--ink); min-width: 2px; }
  .hb span.dark { color: var(--paper); }
  .hb span.edge { box-shadow: inset 0 0 0 1px var(--line-strong); }
  .sm { font-size: 0.75rem; color: var(--ink-3); }
  .more { margin-top: 0.9rem; font-weight: 600; min-height: 2.75rem; }
  @media (max-width: 560px) { .hrow { grid-template-columns: 1fr; gap: 0.35rem; } }
</style>
