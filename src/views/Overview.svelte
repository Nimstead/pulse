<script lang="ts">
  import { Tween, prefersReducedMotion } from 'svelte/motion'
  import { cubicOut } from 'svelte/easing'
  import { line } from 'd3-shape'
  import Figure from '../components/Figure.svelte'
  import Bars from '../components/Bars.svelte'
  import Lines from '../components/Lines.svelte'
  import Period from '../components/Period.svelte'
  import Fn from '../components/Fn.svelte'
  import { copyPng } from '../lib/export'
  import { ui, provenance } from '../lib/state.svelte'
  import { num, pct, dateShort, kvp, monthLong, monthShort, ymMinus, median, sum, delta, titleCase, type Month, type Kev, type Ranked } from '../lib/data'
  import { LAG_BINS, lagBin, yearTick, NO_KEV, BACKFILL, MON } from '../lib/derive'

  let { months, kev, vendors, partial, today, openCve, go }: {
    months: Month[]; kev: Kev[]; vendors: { years: string[]; rows: Ranked[] }; partial: boolean; today: string; openCve: (id: string) => void; go: (r: string) => void
  } = $props()

  const byYm = $derived(new Map(months.map((m) => [m.ym, m])))
  // the Pulse band reads the last full month of the selected period, so it follows the brush
  const endIdx = $derived(partial && ui.to === months.length - 1 ? Math.max(0, ui.to - 1) : ui.to)
  const latest = $derived(months[endIdx])
  const yearAgo = $derived(byYm.get(ymMinus(latest.ym, 12)))
  const prev12 = $derived(months.slice(Math.max(0, endIdx - 12), endIdx))
  const record = $derived(months.slice(0, endIdx).every((m) => m.n < latest.n))
  const pubAvg = $derived(sum(prev12, (m) => m.n) / Math.max(1, prev12.length))
  const kevAvg = $derived(sum(prev12, (m) => m.kev) / Math.max(1, prev12.length))
  const lagWin = (endYm: string) => median(kev.filter((k) => k.lag != null && k.added.slice(0, 7) > ymMinus(endYm, 12) && k.added.slice(0, 7) <= endYm).map((k) => k.lag!))
  const lagNow = $derived(lagWin(latest.ym))
  const lagBefore = $derived(lagWin(ymMinus(latest.ym, 12)))

  // 24-month traces for the band
  const trail = $derived(months.slice(Math.max(0, endIdx - 23), endIdx + 1))
  const lagsByMonth = $derived.by(() => {
    const m = new Map<string, number[]>()
    for (const k of kev) if (k.lag != null) (m.get(k.added.slice(0, 7)) ?? m.set(k.added.slice(0, 7), []).get(k.added.slice(0, 7))!).push(k.lag)
    return m
  })
  const traces = $derived([
    trail.map((m) => m.n),
    trail.map((m) => m.kev),
    trail.map((m) => median(lagsByMonth.get(m.ym) ?? [])),
  ])
  let TW = $state(240)
  const TH = 44
  function trace(vs: (number | null)[]) {
    const ok = vs.filter((v): v is number => v != null)
    const lo = Math.min(0, ...ok), hi = Math.max(1, ...ok)
    const x = (i: number) => (i / Math.max(1, vs.length - 1)) * TW
    const y = (v: number) => TH - 3 - ((v - lo) / (hi - lo)) * (TH - 6)
    const last = vs.findLastIndex((v) => v != null)
    return { d: line<number | null>().defined((v) => v != null).x((_, i) => x(i)).y((v) => y(v!))(vs) ?? '', end: last < 0 ? null : [x(last), y(vs[last]!)] }
  }

  let band: HTMLElement
  let bandStatus = $state('')
  let bandTimer: ReturnType<typeof setTimeout>
  async function copyBand() {
    clearTimeout(bandTimer)
    bandStatus = '…'
    try {
      bandStatus = await copyPng(band, 'pulse-summary-' + latest.ym, provenance())
      bandTimer = setTimeout(() => (bandStatus = ''), 4000)
    } catch { bandStatus = 'Failed' }
  }

  const motion = { duration: () => (prefersReducedMotion.current ? 0 : 520), easing: cubicOut }
  const tPub = Tween.of(() => latest.n, motion)
  const tKev = Tween.of(() => latest.kev, motion)
  const tLag = Tween.of(() => lagNow ?? 0, motion)

  // the selected period
  const sel = $derived(months.slice(ui.from, ui.to + 1))
  const selFull = $derived(sel.filter((m) => !(partial && m === months.at(-1))))
  const N = $derived(sum(selFull, (m) => m.n))
  const trend = $derived.by(() => {
    const a = selFull.slice(-12), end = a.at(-1)?.ym
    if (!end || a.length < 12) return null
    const before = Array.from({ length: 12 }, (_, i) => byYm.get(ymMinus(end, 12 + i))?.n ?? 0)
    const b = before.reduce((x, y) => x + y, 0)
    return b ? delta(sum(a, (m) => m.n), b) : null
  })
  // KEV listings on the same two 12-month windows as the CVE trend, so the headline compares like with like
  const kevTrend = $derived.by(() => {
    const a = selFull.slice(-12), end = a.at(-1)?.ym
    if (!end || a.length < 12) return null
    const b = Array.from({ length: 12 }, (_, i) => byYm.get(ymMinus(end, 12 + i))?.kev ?? 0).reduce((x, y) => x + y, 0)
    return b ? delta(sum(a, (m) => m.kev), b) : null
  })
  const exploited = $derived(sum(selFull, (m) => m.kevPub))
  const share = $derived(N ? exploited / N : 0)
  const kevIn = $derived(kev.filter((k) => k.added.slice(0, 7) >= sel[0].ym && k.added.slice(0, 7) <= sel.at(-1)!.ym))
  const lags = $derived(kevIn.filter((k) => k.lag != null).map((k) => k.lag!))
  const zeroDay = $derived(lags.length ? lags.filter((l) => l <= 0).length / lags.length : 0)
  const within30 = $derived(lags.length ? lags.filter((l) => l <= 30).length / lags.length : 0)
  const yearWord = (d: number) => (Math.abs(d) < 0.02 ? 'flat on a year ago' : d > 0 ? `up ${Math.round(d * 100)}% in a year` : `down ${Math.round(-d * 100)}% in a year`)
  const word = (d: number) => (Math.abs(d) < 0.02 ? 'level with' : d > 0 ? `up ${Math.round(d * 100)}% on` : `down ${Math.round(-d * 100)}% on`)

  // Figure 2: cumulative volume by month of year
  const endYear = $derived(+sel.at(-1)!.ym.slice(0, 4))
  const startYear = $derived(Math.max(+sel[0].ym.slice(0, 4), endYear - 9))
  const cumul = $derived(Array.from({ length: endYear - startYear + 1 }, (_, k) => {
    const yr = startYear + k
    let run = 0
    const values = MON.map((_, i) => {
      const m = byYm.get(`${yr}-${String(i + 1).padStart(2, '0')}`)
      if (!m || (partial && m === months.at(-1))) return null
      return (run += m.n)
    })
    return { key: String(yr), label: String(yr), values, tone: (yr === endYear ? 'focus' : yr === endYear - 1 ? 'prior' : 'faint') as 'focus' | 'prior' | 'faint' }
  }))

  const lagCounts = $derived(LAG_BINS.map((_, i) => lags.filter((l) => lagBin(l) === i).length))
  // the vendors whose yearly CVE counts grew most, this year so far against all of last year
  const thisY = $derived(today.slice(0, 4)), lastY = $derived(String(+today.slice(0, 4) - 1))
  const growth = $derived.by(() => {
    const i = vendors.years.indexOf(thisY), j = vendors.years.indexOf(lastY)
    if (i < 0 || j < 0) return []
    return vendors.rows.map((r) => ({ name: titleCase(r.key), now: r.byYear[i], before: r.byYear[j] }))
      .filter((r) => r.now > r.before).sort((a, b) => b.now - b.before - (a.now - a.before)).slice(0, 3)
  })
  // same basis for total and vendors: this year so far against all of last year
  const yearTotal = (y: string) => sum(months.filter((m) => m.ym.startsWith(y)), (m) => m.n)
  const why = $derived.by(() => {
    if (growth.length < 3) return null
    const now = yearTotal(thisY), before = yearTotal(lastY), rise = now - before
    if (rise <= 0 || !before) return null
    const gNow = sum(growth, (g) => g.now), gBefore = sum(growth, (g) => g.before)
    return { share: (gNow - gBefore) / rise }
  })
  // rolling 12-month totals indexed to 100, starting once the KEV window is clear of the launch backfill
  const indexed = $derived.by(() => {
    const first = ymMinus(BACKFILL.to, -12)
    const roll = (ym: string, f: (m: Month) => number) => Array.from({ length: 12 }, (_, i) => byYm.get(ymMinus(ym, i))).reduce((a, m) => a + (m ? f(m) : 0), 0)
    let pts = selFull.filter((m) => m.ym >= first)
    if (pts.length < 12) return null
    // based 12 months before the end, so the last point reads as the headline's year-on-year change
    const base = ymMinus(pts.at(-1)!.ym, 12)
    if (base < first) return null
    const context = base < pts[0].ym
    if (context) pts = months.filter((m) => m.ym >= base && m.ym <= pts.at(-1)!.ym)
    const c0 = roll(base, (m) => m.n), k0 = roll(base, (m) => m.kev)
    if (!c0 || !k0) return null
    return { base, context, from: pts[0].ym, to: pts.at(-1)!.ym, labels: pts.map((m) => monthShort(m.ym)), cvesN: pts.map((m) => roll(m.ym, (x) => x.n)), kevN: pts.map((m) => roll(m.ym, (x) => x.kev)), c0, k0, cves: pts.map((m) => (roll(m.ym, (x) => x.n) / c0) * 100), kev: pts.map((m) => (roll(m.ym, (x) => x.kev) / k0) * 100) }
  })
  const newest = $derived(kev.slice(0, 5))
  const tipMonth = (ym: string) => monthLong(ym) + (partial && ym === months.at(-1)!.ym ? ' (partial)' : '')
</script>

<section class="briefing" aria-label="Start with Pulse">
  <div class="briefing-actions">
    <a href="/week/" onclick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); go('week') }}>Prepare a handover</a>
    <a href="/watchlist/" onclick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); go('watchlist') }}>Triage your CVEs</a>
  </div>
</section>

<div class="summary" bind:this={band}>
<section class="lead">
  <div>
  <h2 class="headline">
    <!-- nowrap pairs keep each footnote button on the line of the word it annotates -->
    {#if !selFull.length}This month is still in progress.
    {:else if trend != null}New CVEs: {yearWord(trend).replace(/ \S+$/, '')} <span class="nw">{yearWord(trend).split(' ').at(-1)}.<Fn n={1} /></span>
    {:else}{num(N)} CVEs published {monthShort(selFull[0].ym)} to <span class="nw">{monthShort(selFull.at(-1)!.ym)}.<Fn n={1} /></span>{/if}
    {#if trend != null && kevTrend != null}New <mark>KEV listings</mark>: {yearWord(kevTrend).replace(/ in a year$/, '')}.<Fn n={2} />
    {:else if share}Since {monthShort(sel[0].ym)}, about 1 in {num(1 / share)} is confirmed <span class="nw"><mark>exploited</mark>.<Fn n={2} /></span>{/if}
  </h2>
  {#if !selFull.length}<p class="basis">{num(sum(sel, (m) => m.n))} CVEs published so far in {monthLong(sel[0].ym)}. Monthly charts include partial counts; year-on-year comparisons need complete months.</p>{/if}
  {#if trend != null}{@const w = selFull.slice(-12)}<p class="basis">{kevTrend != null ? 'Both trends compare' : 'The publication trend compares'} {monthShort(w[0].ym)} – {monthShort(w.at(-1)!.ym)} with the 12 months before{#if kevTrend != null}: CVEs by publication month, KEV listings by the month CISA added them{/if}.</p>{/if}
  <button class="copy" onclick={copyBand} disabled={bandStatus === '…'} data-no-export title="Copy the headline, the three figures and Figure 1 as one PNG for slides">{bandStatus === 'Failed' ? 'Retry summary PNG' : bandStatus || 'Copy summary for slides'}</button>
  {#if bandStatus === 'Failed'}<p class="export-error" role="alert" data-no-export>Could not create the summary PNG. Try again with “Retry summary PNG”, or export the figures individually below.</p>{/if}
  <span class="sr-only" role="status" data-no-export>{bandStatus === '…' ? 'Copying summary…' : bandStatus}</span>
  </div>
  <dl class="answers">
    <div>
      <dt>Period</dt>
      <dd><b>{num(N)}</b> CVEs in the complete months of the selected period{#if trend != null}; the trend compares the latest 12 months with the 12 before{/if}.</dd>
    </div>
    <div>
      <dt>Exploitation</dt>
      <dd>{#if share}Since {monthShort(sel[0].ym)}, about <b>1 in {num(1 / share)}</b> CVEs is confirmed exploited.<Fn n={2} />{' '}{/if}{#if lags.length}<b>{pct(within30)}</b> of the KEV listings came within 30 days of publication.<Fn n={3} />{:else}{NO_KEV}{/if}</dd>
    </div>
    <div>
      <dt>So what</dt>
      <dd>KEV confirms exploitation; EPSS estimates likelihood. Use both to prioritise<Fn n={5} /> alongside exposure and business impact. Absence from KEV does not mean safe. <a class="linklike" href="/watchlist/" onclick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); go('watchlist') }}>Check your own CVEs</a></dd>
    </div>
  </dl>
</section>
<div class="view-period" data-no-export><Period {months} compact /></div>

{#if selFull.length}
<section class="pulse" aria-label="Vital signs for {monthLong(latest.ym)}">
  <div class="sign">
    <h3>CVEs published · {monthLong(latest.ym)}<Fn n={1} /></h3>
    <p class="big">{num(tPub.current)}</p>
    <p class="cmp">{#if record}<b>The highest month on record.</b>{' '}{/if}Previous 12-month average {num(pubAvg)} a month</p>
    {@render spark(traces[0], false)}
  </div>
  <div class="sign">
    <h3>New KEV listings · {monthLong(latest.ym)}<Fn n={2} /></h3>
    <p class="big">{num(tKev.current)}<i class="seal" aria-hidden="true"></i></p>
    <p class="cmp"><b>{(latest.kev / Math.max(0.1, kevAvg)).toFixed(1)}×</b> the previous 12-month average ({kevAvg.toFixed(1)} a month)</p>
    {@render spark(traces[1], true)}
  </div>
  <div class="sign">
    <h3>Median days to KEV · 12 months to {monthShort(latest.ym)}<Fn n={3} /></h3>
    <p class="big">{lagNow == null ? '—' : num(tLag.current)}<span class="unit">days</span></p>
    <p class="cmp">{#if lagBefore != null && lagNow != null}<b>{lagNow < lagBefore ? 'Down' : lagNow > lagBefore ? 'Up' : 'Level'} from {num(lagBefore)} days</b> the year before.{' '}{/if}From CVE publication to CISA listing.</p>
    {@render spark(traces[2], false)}
  </div>
</section>
{/if}
{#if indexed}
  {@const cUp = Math.round(indexed.cves.at(-1)! - 100)}
  {@const kUp = Math.round(indexed.kev.at(-1)! - 100)}
  <Figure n={1} name="volume-vs-exploitation" title="Volume against exploitation" sub="Rolling 12-month totals, plain counts, from {monthShort(indexed.from)} (after the KEV launch backfill).{indexed.context ? ` ${monthShort(indexed.base)} is comparison context before the selected period.` : ''}"
    csv={() => indexed.labels.map((l, i) => ({ month: l, cves_12mo: indexed.cvesN[i], kev_12mo: indexed.kevN[i] }))}>
    <div class="pair">
      <div>
        <h4 class="ph">CVEs published, last 12 months <b>{cUp >= 0 ? '+' : ''}{cUp}% in a year</b></h4>
        <Lines label="CVEs published, rolling 12 months" labels={indexed.labels} height={220}
          lines={[{ key: 'c', label: 'CVEs', endLabel: num(indexed.cvesN.at(-1)!), values: indexed.cvesN, tone: 'focus', color: 'var(--vol)' }]} />
      </div>
      <div>
        <h4 class="ph kevh">Added to KEV, last 12 months <b>{kUp >= 0 ? '+' : ''}{kUp}% in a year</b></h4>
        <Lines label="KEV listings, rolling 12 months" labels={indexed.labels} height={220}
          lines={[{ key: 'k', label: 'KEV listings', endLabel: num(indexed.kevN.at(-1)!), values: indexed.kevN, tone: 'focus', color: 'var(--kev)' }]} />
      </div>
    </div>
    {#snippet notes()}{monthShort(indexed.to)}: {num(indexed.cvesN.at(-1)!)} CVEs in 12 months against {num(indexed.c0)} a year earlier, and {num(indexed.kevN.at(-1)!)} KEV listings against {num(indexed.k0)}.{#if cUp > kUp}{' '}Volume has grown far faster than confirmed exploitation.{/if}{/snippet}
  </Figure>
{/if}
</div>

{#if why}
<section class="year-context" aria-labelledby="year-context-title">
  <h3 id="year-context-title">Current-year context · {thisY}</h3>
  <p>This comparison is independent of the selected period: {thisY} so far against all of {lastY}. {growth[0].name}, {growth[1].name} and {growth[2].name} had the largest absolute increases in published CVEs and account for <b>{pct(why.share)}</b> of the increase. {#if why.share <= 1}The remaining {pct(1 - why.share)} comes from other vendors.{:else}Declines elsewhere offset part of their increase.{/if}<Fn n={6} /></p>
</section>
{/if}

{#snippet spark(vs: (number | null)[], red: boolean)}
  {@const t = trace(vs)}
  <div class="trace" bind:clientWidth={TW}>
    <svg class:red width={TW} height={TH} aria-hidden="true">
      <line x1="0" x2={TW} y1={TH - 0.5} y2={TH - 0.5} class="base" />
      {#key trail[0].ym}<path d={t.d} pathLength="1" />{/key}
      {#if t.end}<rect x={t.end[0] - 3.5} y={t.end[1] - 3.5} width="7" height="7" />{/if}
    </svg>
  </div>
  <p class="span"><span>{monthShort(trail[0].ym)}</span><span>{monthShort(latest.ym)}</span></p>
{/snippet}

<Figure n="1b" name="cves-per-month" title="CVEs published, and new KEV listings, per month" sub="{monthShort(sel[0].ym)} – {monthShort(sel.at(-1)!.ym)}, the period set above."
  csv={() => sel.map((m) => ({ month: m.ym, published: m.n, later_exploited: m.kevPub, kev_listings: m.kev, rejected: m.rej }))}>
  {#snippet legend()}
    <span><span class="swatch" style:background="var(--vol)"></span> CVEs published</span>
    <span><span class="swatch" style:background="var(--kev)"></span> Added to KEV (exploited in the wild)</span>
    {#if partial}<span><span class="swatch hatch"></span> Partial month</span>{/if}
    {#if sel[0].ym <= BACKFILL.to}<span><span class="swatch" style:background="var(--shade)"></span> {BACKFILL.label}, Nov 2021 – Jun 2022</span>{/if}
  {/snippet}
  <Bars label="Monthly CVEs published" labels={sel.map((m) => m.ym)} height={150} hatchLast={partial && ui.to === months.length - 1}
    mark={record ? { index: sel.findIndex((m) => m.ym === latest.ym), label: `Record: ${num(latest.n)}` } : undefined}
    series={[{ key: 'n', label: 'CVEs published', color: 'var(--vol)', values: sel.map((m) => m.n) }]}
    tick={(l, i) => yearTick(l, i, sel.length)} tipTitle={tipMonth} />
  <div class="mirror">
    <Bars label="Monthly KEV listings" labels={sel.map((m) => m.ym)} height={92} hatchLast={partial && ui.to === months.length - 1}
      series={[{ key: 'kev', label: 'Added to KEV', color: 'var(--kev)', values: sel.map((m) => m.kev) }]}
      tick={() => null} tipTitle={tipMonth} empty={NO_KEV} cap shade={BACKFILL} />
  </div>
  {#snippet notes()}
    Upper panel: CVEs by NVD publication month. Lower panel, on its own scale: KEV listings by the month CISA added them. The panels use different scales. KEV captures only exploitation CISA has confirmed, not every exploited vulnerability. A KEV bar with a break is taller than its axis; hover or step to it for its value.
  {/snippet}
</Figure>


<div class="two">
  <Figure n={2} name="cumulative-by-year" title="Cumulative CVEs through the year" sub="{endYear} against previous years, so the pace is visible before the year ends"
    csv={() => cumul.flatMap((c) => c.values.map((v, i) => ({ year: c.key, month: MON[i], cumulative: v })))}>
    <Lines label="Cumulative CVEs by month of year" labels={MON} lines={cumul} height={280} />
  </Figure>

  <Figure n={3} name="days-to-kev" title="How soon CISA lists a published CVE" sub="KEV listings made in the period, by days since the CVE was published"
    csv={() => LAG_BINS.map((b, i) => ({ bucket: b, listings: lagCounts[i] }))}>
    {#snippet legend()}
      <span><span class="swatch" style:background="var(--kev)"></span> Within 30 days of publication</span>
      <span><span class="swatch" style:background="var(--kev-soft)"></span> Later</span>
    {/snippet}
    <Bars label="Distribution of days from publication to KEV listing" labels={[...LAG_BINS]} height={280}
      series={[{ key: 'fast', label: 'Within 30 days', color: 'var(--kev)', values: lagCounts.map((v, i) => (i < 3 ? v : 0)) }, { key: 'slow', label: 'Later', color: 'var(--kev-soft)', values: lagCounts.map((v, i) => (i < 3 ? 0 : v)) }]} tick={(l) => l} empty={NO_KEV} />
    {#snippet notes()}
      {#if lags.length}{pct(zeroDay)} listed on or before publication day · {pct(within30)} within 30 days · <a class="linklike" href="/exploitation/" onclick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); go('exploitation') }}>Exploitation detail</a>{/if}
    {/snippet}
  </Figure>
</div>

<section class="latest">
  <h2>Latest additions to KEV</h2>
  <ul>
    {#each newest as k (k.id)}
      <li>
        <button class="linklike mono-id" onclick={() => openCve(k.id)}>{k.id}</button>
        <span class="v">{kvp(k.vendor, k.product)}</span>
        <span class="d">Added {dateShort(k.added)}{k.lag != null ? ` · ${k.lag <= 0 ? 'listed on or before NVD publication' : `${num(k.lag)} day${k.lag === 1 ? '' : 's'} after publication`}` : ''}</span>
        {#if k.ransom}<span class="chip red">Ransomware use known</span>{/if}
      </li>
    {/each}
  </ul>
  <div class="ctas">
    <a class="cta" href="/week/" onclick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); go('week') }}>Everything that changed this week</a>
    <a class="cta alt" href="/watchlist/" onclick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; e.preventDefault(); go('watchlist') }}>Check your own CVEs</a>
  </div>
</section>

<style>
  .briefing { padding: 0.5rem 0; border-bottom: 1px solid var(--rule); }
  .briefing-actions { display: flex; flex-wrap: wrap; gap: 0.25rem 2rem; }
  .briefing-actions a { display: inline-flex; align-items: center; min-height: 2.75rem; padding: 0.5rem 0; text-underline-offset: 0.2em; font: 600 0.9375rem/1.3 var(--sans); }
  .briefing-actions a:hover { text-decoration-thickness: 2px; }
  @media (max-width: 560px) { .briefing-actions { gap: 0.25rem 1.25rem; } }
  .lead { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 4fr); gap: 1.75rem clamp(2rem, 5vw, 5rem); align-items: start; padding: clamp(1.75rem, 3vw, 2.75rem) 0 1.75rem; }
  .headline { font: 800 clamp(2.5rem, 5.2vw, 4.75rem)/0.94 var(--display); letter-spacing: -0.05em; max-width: 19ch; }
  .headline :global(.fn) { font-size: 0.32em; vertical-align: 1.6em; letter-spacing: 0; }
  mark { background: none; color: var(--kev); }
  .view-period { margin-bottom: 1.25rem; }
  .pair { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: clamp(1.5rem, 3vw, 3rem); }
  .ph { font: 600 0.875rem/1.3 var(--sans); color: var(--ink-2); margin: 0 0 0.5rem; display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  .ph b { font: 800 1.125rem/1.1 var(--display); letter-spacing: -0.02em; color: var(--ink); }
  .kevh b { color: var(--kev); }
  @media (max-width: 900px) { .pair { grid-template-columns: minmax(0, 1fr); } }
  .basis { margin: 1.1rem 0 0; font-size: 1rem; color: var(--ink-3); max-width: 52ch; }
  .nw { white-space: nowrap; }
  .year-context { border-top: 1px solid var(--rule); padding: 1.25rem 0; margin-bottom: 1rem; }
  .year-context h3 { font-size: 1.25rem; }
  .year-context p { max-width: 75ch; color: var(--ink-2); margin: 0.5rem 0 0; }
  .export-error { font-size: 0.875rem; color: var(--ink-2); max-width: 60ch; }

  .answers { display: grid; gap: 1.1rem; margin: 0; }
  /* beside the headline the answers set the block's height, so they step down to keep the Pulse band in the first screen */
  @media (min-width: 1101px) { .answers { gap: 0.85rem; } .answers dd { font-size: 1rem; line-height: 1.45; } .answers div { padding-top: 0.6rem; } }
  .answers div { border-top: 2px solid var(--rule-strong); padding-top: 0.75rem; }
  dt { font: 600 0.6875rem/1.2 var(--sans); letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-3); }
  dd { margin: 0.45rem 0 0; font-size: 1.125rem; line-height: 1.45; max-width: 40ch; }
  dd b { font-weight: 800; letter-spacing: -0.02em; }

  /* the Pulse band: the month's three vital signs, inverted to Ink, full bleed without overflowing the page */
  .pulse {
    display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); background: var(--band); color: var(--band-fg);
    border-image: linear-gradient(var(--band-line) 0 1px, var(--band) 1px calc(100% - 1px), var(--band-line) 0) fill 0 / 1 / 0 100vw; /* edge lines only show in dark, where the band sits one step below the page */
    padding: clamp(1.5rem, 2.5vw, 2rem) 0;
    margin-bottom: clamp(1.5rem, 3vw, 2.5rem);
    --fn: var(--band-fg);
  }
  .pulse :focus-visible { outline-color: var(--band-fg); } /* an Ink ring would vanish on the band */
  .copy { margin-top: 1.25rem; font: 700 0.875rem/1.1 var(--sans); padding: 0.75rem 1.1rem; min-height: 2.75rem; background: var(--ink); color: var(--paper); border: 2px solid var(--ink); cursor: pointer; transition: background-color 150ms, color 150ms; }
  .copy:hover { background: var(--paper); color: var(--ink); }
  .sign { display: flex; flex-direction: column; padding: 0 clamp(1rem, 2.5vw, 2.25rem); border-left: 1px solid var(--band-line); min-width: 0; }
  .sign:first-of-type { padding-left: 0; border-left: 0; }
  .sign h3 { font: 600 0.6875rem/1.3 var(--sans); letter-spacing: 0.12em; text-transform: uppercase; color: var(--ash); }
  .big { margin: 0.75rem 0 0; font: 800 clamp(3rem, 5.6vw, 5rem)/0.86 var(--display); letter-spacing: -0.055em; white-space: nowrap; }
  .seal { display: inline-block; width: 0.16em; height: 0.16em; background: var(--seal); vertical-align: top; margin: 0.04em 0 0 0.06em; }
  .unit { font-size: 0.24em; font-weight: 600; letter-spacing: 0; margin-left: 0.35em; color: var(--ash); }
  .cmp { margin: 0.8rem 0 0; font-size: 0.875rem; color: var(--ash); }
  .cmp b { color: var(--band-fg); font-weight: 800; }
  .trace { height: 44px; margin-top: auto; padding-top: 1rem; box-sizing: content-box; }
  .trace svg { display: block; overflow: visible; }
  .trace .base { stroke: var(--band-line); stroke-width: 1; }
  .trace path { fill: none; stroke-linecap: square; stroke: var(--band-fg); stroke-width: 2; stroke-linejoin: round; stroke-dasharray: 1; animation: draw 1.4s 120ms var(--ease-out) both; }
  .trace rect { fill: var(--band-fg); }
  .trace .red path { stroke: var(--band-kev); }
  .trace .red rect { fill: var(--band-kev); } /* lifted crimson: Seal Crimson fails 3:1 on Ink */
  @keyframes draw { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
  .span { display: flex; justify-content: space-between; margin: 0.35rem 0 0; font-size: 0.6875rem; color: var(--ash); }

  .mirror { margin-top: 0.1rem; }
  .swatch.hatch { background: repeating-linear-gradient(45deg, var(--ink-3) 0 1.5px, transparent 1.5px 4px); border: 1px solid var(--ink-3); }
  .two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: clamp(1.5rem, 3vw, 3rem); margin-top: 1rem; }
  .latest { border-top: 2px solid var(--rule-strong); padding-top: 1.1rem; margin-top: 1.5rem; }
  .latest h2 { font: 700 1.25rem/1.2 var(--display); letter-spacing: -0.02em; }
  .latest ul { list-style: none; margin: 0.8rem 0 0; padding: 0; display: grid; column-gap: 1.25rem; grid-template-columns: 9.5rem minmax(0, 1fr) auto auto; }
  /* subgrid, so dates and chips line up across rows too */
  .latest li { grid-column: 1 / -1; display: grid; grid-template-columns: subgrid; align-items: baseline; gap: 0.25rem 1.25rem; padding: 0.7rem 0; border-bottom: 1px solid var(--rule); }
  .latest li .chip { justify-self: start; }
  @media (max-width: 640px) { .latest ul { grid-template-columns: 8.5rem minmax(0, 1fr); } .latest li > :nth-child(n + 3) { grid-column: 2; } }
  @container (max-width: 16rem) {
    .latest ul { grid-template-columns: minmax(0, 1fr); }
    .latest li > :nth-child(n) { grid-column: 1; }
  }
  .latest .v { font-weight: 600; }
  .latest .d { color: var(--ink-3); font-size: 0.875rem; }
  .cta { text-decoration: none; margin-top: 1.25rem; font: 700 0.9375rem/1 var(--sans); padding: 0.95rem 1.35rem; background: var(--ink); color: var(--paper); border: 2px solid var(--ink); cursor: pointer; transition: background-color 150ms, color 150ms; }
  .cta:hover { background: var(--paper); color: var(--ink); }
  .ctas { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.25rem; }
  .ctas .cta { text-decoration: none; margin-top: 0; }
  .cta.alt { background: var(--paper); color: var(--ink); }
  .cta.alt:hover { background: var(--ink); color: var(--paper); }
  @media (max-width: 1100px) {
    .lead { grid-template-columns: minmax(0, 1fr); }
    .answers { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.25rem clamp(1.5rem, 3vw, 3rem); }
  }
  @media (max-width: 900px) {
    .two, .answers { grid-template-columns: minmax(0, 1fr); }
    .pulse { grid-template-columns: minmax(0, 1fr); padding: 0.5rem 0; }
  .sign { padding: 1.5rem 0; border-left: 0; border-top: 1px solid var(--band-line); }
    .sign:first-of-type { border-top: 0; }
  }
</style>
