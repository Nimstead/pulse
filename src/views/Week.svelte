<script lang="ts" module>
  /** [id, published, status, score, severity, cwe, vendor, product, epss]: a lookup row without its description */
  type HotRow = [string, string, string, number | null, string, string, string, string, number | null]
  /** days: [date, published, scored, Critical or High] */
  export type Recent = { latest: string; days: [string, number, number, number][]; hot: HotRow[] }
</script>

<script lang="ts">
  import { ui } from '../lib/state.svelte'
  import DeadlineControl from '../components/DeadlineControl.svelte'
  import Figure from '../components/Figure.svelte'
  import Bars from '../components/Bars.svelte'
  import { download, downloadCsv } from '../lib/export'
  import { inLastDays, dueWithinDays } from '../lib/week'
  import { num, pct, epssPct, dateLong, dateShort, titleCase, kvp, daysBetween, addDays, vp, SEV_COLOR, type Kev } from '../lib/data'

  let { kev, recent, today, openCve }: { kev: Kev[]; recent: Recent; today: string; openCve: (id: string) => void } = $props()

  const windowDays = $derived(ui.windowDays)
  const since = $derived(addDays(today, -windowDays + 1))
  const newKev = $derived(kev.filter((k) => inLastDays(k.added, today, windowDays)))
  // the window before this one, for an "is this a bad week?" comparison
  const prevKevN = $derived(kev.filter((k) => k.added < since && k.added >= addDays(since, -windowDays)).length)
  const passedWindow = $derived(kev.filter((k) => ui.kevDeadlines && k.due && inLastDays(k.due, today, windowDays) && k.due < today).sort((a, b) => b.due.localeCompare(a.due))) // most recently passed first
  const dueSoon = $derived(kev.filter((k) => ui.kevDeadlines && k.due && dueWithinDays(k.due, today, windowDays)).sort((a, b) => a.due.localeCompare(b.due)))
  const todayN = $derived(dueSoon.filter((k) => k.due === today).length)
  // triage order: KEV dates and new listings, then fresh Critical/High with elevated EPSS
  const start = $derived.by(() => {
    const out: { id: string; what: string; why: string; facts: string; red: boolean; due: string; late: boolean }[] = [], seen = new Set<string>()
    const add = (x: (typeof out)[number]) => { if (!seen.has(x.id)) { seen.add(x.id); out.push(x) } }
    const sev = (s: string, n: number | null) => (s ? `${titleCase(s.toLowerCase())}${n != null ? ` ${n.toFixed(1)}` : ''}` : 'Not scored')
    const kevFacts = (k: Kev) => [ui.kevDeadlines && k.due ? `Federal due ${dateShort(k.due)}` : '', sev(k.sev, k.score), k.epss != null ? `EPSS ${epssPct(k.epss)}` : 'EPSS unavailable'].filter(Boolean).join(' · ')
    const isNew = new Set(newKev.map((k) => k.id))
    // the deadline in words, so a row is scannable without reading its facts line
    const dueOf = (d: string) => { if (!d) return { due: 'No deadline', late: false }; const left = daysBetween(today, d); return left < 0 ? { due: `Due date passed ${-left} day${left === -1 ? '' : 's'} ago`, late: true } : left === 0 ? { due: 'Due today', late: true } : { due: `Due in ${left} day${left === 1 ? '' : 's'}`, late: false } }
    const kevRow = (k: Kev, why: string) => ({ id: k.id, what: kvp(k.vendor, k.product), why: [why, isNew.has(k.id) ? 'New KEV listing' : '', k.ransom ? 'ransomware' : ''].filter(Boolean).join(' · '), facts: kevFacts(k), red: true, ...dueOf(ui.kevDeadlines ? k.due : '') })
    // passed dates in this window and due-today items are listed; this is not asset remediation status.
    for (const k of passedWindow) add(kevRow(k, 'KEV due date passed'))
    for (const k of dueSoon) if (k.due === today) add(kevRow(k, isNew.has(k.id) ? 'Due today' : 'KEV due today'))
    for (const k of newKev) add(kevRow(k, ''))
    for (const k of dueSoon) add(kevRow(k, 'KEV deadline')) // the deadline column already says when
    // nothing fresh may have reached EPSS 10% yet; then the highest-scoring fresh CVEs still lead the list
    for (const r of (likely.length ? likely : scoredHot).slice(0, 2)) add({ id: r[0], what: vp(r[6], r[7]), why: likely.length ? 'Elevated EPSS' : 'Top available EPSS this window', facts: `Published ${dateShort(r[1])} · ${sev(r[4], r[3])} · EPSS ${epssPct(r[8]!)}`, red: false, due: 'No KEV deadline', late: false })
    return out
  })
  // keep the list scannable while including every passed-date and due-today row
  const SHOW = $derived(Math.max(7, passedWindow.length + todayN))
  let all = $state(false)
  let expandedProduct = $state('')
  let productsShown = $state(15)
  let copied = $state('')
  let copyError = $state('')
  let downloadError = $state('')
  function handoverText() {
    const lines = [`Nimstead Pulse · last ${windowDays} days to ${dateShort(today)}`, `NVD CVE publication data through ${dateShort(recent.latest)}`, '',
      `${newKev.length} new CISA KEV listings · ${ui.kevDeadlines ? `${todayN} KEV due today · ${passedWindow.length} KEV due dates passed in this window · ` : ''}${severeN} new Critical or High CVEs, ${likely.length} with elevated EPSS (10% or more)`, '',
      'Start here:', ...start.map((x) => `- ${x.id}  ${x.what}  (${x.why}; ${x.facts})`), '', 'Public signals do not show whether your assets are exposed or affected; verify product and version applicability.', ui.kevDeadlines ? 'CISA due dates are federal benchmarks, not your remediation status.' : 'CISA due dates excluded from this handover.', 'Sources: NVD, CISA KEV, EPSS']
    return lines.join('\n')
  }
  async function brief() {
    copyError = ''; copied = ''
    try { await navigator.clipboard.writeText(handoverText()); copied = 'Copied'; setTimeout(() => (copied = ''), 1800) }
    catch { copyError = 'Could not copy the handover. Retry copying, or download it as a text file.' }
  }
  function saveHandover() {
    downloadError = ''
    try { download(new Blob([handoverText()], { type: 'text/plain;charset=utf-8' }), `pulse-week-${today}.txt`) }
    catch { downloadError = 'Could not download the handover. Try Download handover again, or copy the text.' }
  }
  const days = $derived(recent.days.filter(([d]) => inLastDays(d, today, windowDays)))
  const pubN = $derived(days.reduce((a, d) => a + d[1], 0))
  const scoredN = $derived(days.reduce((a, d) => a + d[2], 0))
  const severeN = $derived(days.reduce((a, d) => a + d[3], 0))
  // recent.json holds 30 days, so the previous window only exists for 7 and 14
  const prevDays = $derived(windowDays * 2 <= recent.days.length ? recent.days.filter(([d]) => d < since && d >= addDays(since, -windowDays)) : null)
  const prevSevereN = $derived(prevDays ? prevDays.reduce((a, d) => a + d[3], 0) : null)
  const hot = $derived(recent.hot.filter((r) => inLastDays(r[1], today, windowDays)))
  // fresh Critical/High grouped by product; hot is EPSS-sorted, so each group's first row is its highest
  const hotGroups = $derived.by(() => {
    const g = new Map<string, typeof hot>()
    for (const r of hot) { const k = vp(r[6], r[7]); (g.get(k) ?? g.set(k, []).get(k)!).push(r) }
    return [...g].map(([name, rows]) => ({ name, rows, top: rows.find((r) => r[8] != null) ?? rows[0] }))
  })
  const scoredHot = $derived(hot.filter((r) => r[8] != null))
  const likely = $derived(scoredHot.filter((r) => r[8]! >= 0.1))
  const nvdLag = $derived(recent.latest < today)
  const weekday = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
</script>

<header class="view-head">
  <h2>This week</h2>
  <p class="insight"><b>{num(newKev.length)}</b> new KEV listing{newKev.length === 1 ? '' : 's'} in the last {windowDays} days. {#if ui.kevDeadlines}{todayN ? `${num(todayN)} KEV due date${todayN === 1 ? '' : 's'} fall${todayN === 1 ? 's' : ''} today` : 'No KEV due date falls today'}{passedWindow.length ? `, and ${num(passedWindow.length)} KEV due date${passedWindow.length === 1 ? '' : 's'} passed in this window` : ''}.{/if}</p>
  <p>New KEV entries{ui.kevDeadlines ? ", federal deadlines" : ""} and elevated EPSS for your shift handover. Match these signals to your assets before acting.</p>
  {#if nvdLag}<p class="coverage">NVD publication data in this view runs through {dateShort(recent.latest)}; the selected {windowDays}-day window ends {dateShort(today)}. New CVE counts may be partial.</p>{/if}
</header>

<p class="sr-only" role="status">{copied}</p>
<div class="report-controls">
<div class="toggle" role="group" aria-label="Window">
  {#each [7, 14, 30] as d (d)}<button aria-pressed={windowDays === d} onclick={() => (ui.windowDays = d)}>Last {d} days</button>{/each}
</div>
<DeadlineControl />
</div>

<div class="tiles" class:no-deadlines={!ui.kevDeadlines}>
  <div><div class="kicker">New KEV listings</div><div class="big red">{num(newKev.length)}</div><div class="cmp"><b>{num(prevKevN)}</b> the {windowDays} days before{newKev.some((k) => k.ransom) ? ` · ${newKev.filter((k) => k.ransom).length} with ransomware use` : ''}</div></div>
  {#if ui.kevDeadlines}<div><div class="kicker">KEV due today</div><div class="big">{num(todayN)}</div><div class="cmp">US federal deadlines falling today</div></div>
  <div><div class="kicker">KEV due dates, next {windowDays} days</div><div class="big">{num(dueSoon.length)}</div><div class="cmp">Including today. {num(passedWindow.length)} KEV due dates passed in this window.</div></div>{/if}
  <div><div class="kicker">Elevated EPSS</div><div class="big">{num(likely.length)}</div><div class="cmp">10% or more, of {num(severeN)} new Critical or High{#if prevSevereN != null}{' '}({num(prevSevereN)} the {windowDays} days before){/if} · <a href="#fresh" onclick={(e) => { e.preventDefault(); const target = document.getElementById('fresh'); target?.focus({ preventScroll: true }); target?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }) }}>by product</a></div></div>
</div>

{#if start.length}
  <section class="start" aria-labelledby="start-h">
    <div class="start-head">
      <div><h3 id="start-h">Start here</h3><p class="rank">{#if ui.kevDeadlines}KEV due dates that passed in this window or fall today, then new KEV listings, then other dates due in the next {windowDays} days, then{:else}New KEV listings, then{/if} up to 2 fresh CVEs with the highest available EPSS. Check asset and version applicability before prioritising action.</p></div>
      <span class="acts"><button class="copytext" onclick={brief}>{copied || (copyError ? 'Retry copy' : 'Copy as text')}</button><button class="copytext" onclick={saveHandover}>Download handover</button><button class="copytext" onclick={() => downloadCsv(start.map((x, i) => ({ snapshot_date: today, rank: i + 1, cve: x.id, product: x.what, status: x.why, ...(ui.kevDeadlines ? { deadline: x.due } : {}), facts: x.facts })), 'start-here')}>CSV</button></span>
    </div>
    {#if copyError}<p class="export-error" role="alert">{copyError}</p>{/if}
    {#if downloadError}<p class="export-error" role="alert">{downloadError}</p>{/if}
    <ol>
      {#each all ? start : start.slice(0, SHOW) as x, i (x.id)}
        <li class:no-deadlines={!ui.kevDeadlines}>
          <span class="n">{i + 1}</span>
          <button class="linklike mono-id" onclick={() => openCve(x.id)}>{x.id}</button>
          <span class="chip" class:red={x.red}>{x.why}</span>
          <span class="what"><span class="nm1">{x.what}</span><small>{x.facts}</small></span>
          {#if ui.kevDeadlines}<span class="due" class:late={x.late}>{x.due}</span>{/if}
        </li>
      {/each}
    </ol>
    {#if start.length > SHOW}<button class="linklike more" aria-expanded={all} onclick={() => (all = !all)}>{all ? `Show the first ${SHOW}` : `Show all ${num(start.length)}`}</button>{/if}
  </section>
{/if}


<section id="fresh" class="anchor" aria-label="Fresh Critical and High CVEs, by product" tabindex="-1">
<Figure n={15} name="recent-critical" title="Fresh Critical and High CVEs, by product" sub="Published in the last {windowDays} days: one row per product, ranked by its highest available EPSS. {likely.length ? `${num(likely.length)} ${likely.length === 1 ? 'has' : 'have'} EPSS of 10% or more.` : 'None with an available EPSS has reached 10%.'} EPSS is a probability signal, not a finding of exposure or exploitation."
  csv={() => hot.map((r) => ({ cve: r[0], published: r[1], severity: r[4], score: r[3], vendor: r[6], product: r[7], epss: r[8] }))}>
  {#if hotGroups.length > productsShown}<p class="table-scope">First {num(productsShown)} of {num(hotGroups.length)} products shown. CSV includes all matching CVEs.</p>{/if}
  {#if hotGroups.length}<p class="table-hint" data-no-export>Scroll sideways for all signals. The CVE stays in view.</p>{/if}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (a scroll region must be focusable to scroll by keyboard) -->
  <div class="table-scroll" tabindex="0" role="region" aria-label="Table, scrolls sideways">
    <table class="data">
      <thead><tr><th>Vendor · product</th><th class="r">CVEs</th><th class="row-identity">Highest</th><th>Severity</th><th class="r">EPSS</th></tr></thead>
      <tbody>
        {#each hotGroups.slice(0, productsShown) as g, i (g.name)}
          {@const r = g.top}
          <tr>
            <td><b>{g.name}</b></td>
            <td class="r"><button class="group-toggle" aria-label="{expandedProduct === g.name ? 'Hide' : 'Show'} {g.rows.length} CVE{g.rows.length === 1 ? '' : 's'} for {g.name}" aria-expanded={expandedProduct === g.name} aria-controls="week-group-{i}" onclick={() => expandedProduct = expandedProduct === g.name ? '' : g.name}>{num(g.rows.length)} CVE{g.rows.length === 1 ? '' : 's'}</button></td>
            <td class="row-identity"><button class="linklike mono-id" onclick={() => openCve(r[0])}>{r[0]}</button><div class="sm">{dateShort(r[1])}</div></td>
            <td><span class="chip" style:border-color={SEV_COLOR[r[4]]}><span class="swatch" style:background={SEV_COLOR[r[4]]}></span>{titleCase(r[4].toLowerCase())}{r[3] != null ? ` ${r[3].toFixed(1)}` : ''}</span></td>
            <td class="r">{r[8] == null ? 'Unavailable' : epssPct(r[8])}</td>
          </tr>
          <tr id="week-group-{i}" class="group-detail" hidden={expandedProduct !== g.name}>
            <td colspan="5">
              {#if expandedProduct === g.name}
              <ul class="group-members" aria-label="CVEs for {g.name}">
                {#each g.rows as member (member[0])}
                  <li><button class="linklike mono-id" onclick={() => openCve(member[0])}>{member[0]}</button><span>Published {dateShort(member[1])}</span><span>{member[4] ? titleCase(member[4].toLowerCase()) : 'Not scored'}{member[3] != null ? ` ${member[3].toFixed(1)}` : ''}</span><span>EPSS {member[8] == null ? 'unavailable' : epssPct(member[8])}</span></li>
                {/each}
              </ul>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  {#if hotGroups.length > productsShown}<button class="linklike more" data-no-export onclick={() => productsShown += 15}>Show more products ({num(hotGroups.length - productsShown)} remaining)</button>{/if}
</Figure>
</section>

<Figure n={16} name="recent-published" title="CVEs published per day" sub="Published CVEs, split by whether a severity score is available"
  csv={() => days.map(([d, n, s]) => ({ date: d, published: n, scored: s }))}>
  {#snippet legend()}
    <span><span class="swatch" style:background="var(--vol)"></span> Scored</span>
    <span><span class="swatch" style:background="var(--vol-soft)"></span> Not scored yet</span>
  {/snippet}
  <Bars label="CVEs published per day" labels={days.map((d) => d[0])} height={160}
    series={[{ key: 's', label: 'Scored', color: 'var(--vol)', values: days.map((d) => d[2]) }, { key: 'u', label: 'Not scored yet', color: 'var(--vol-soft)', values: days.map((d) => d[1] - d[2]) }]}
    tick={(l, i) => (days.length <= 14 || i % 5 === 0 ? weekday(l) : null)} tipTitle={(l) => dateLong(l)} />
</Figure>

<style>
  .report-controls { display: flex; flex-wrap: wrap; align-items: start; justify-content: space-between; gap: 0.75rem 1.5rem; margin-bottom: 1.5rem; }
  .toggle { display: inline-flex; border: 2px solid var(--ink); margin-bottom: 0; }
  .toggle button { background: var(--paper); border: 0; border-left: 2px solid var(--ink); padding: 0.55rem 0.95rem; min-height: 2.75rem; font: 700 0.8125rem var(--sans); color: var(--ink-2); cursor: pointer; }
  .toggle button:first-child { border-left: 0; }
  .toggle button:hover { background: var(--shade); color: var(--ink); }
  .toggle button[aria-pressed='true'] { background: var(--ink); color: var(--paper); }
  .tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: clamp(1rem, 3vw, 3rem); margin-bottom: 1.5rem; }
  .tiles.no-deadlines { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tiles > div { border-top: 2px solid var(--rule-strong); padding-top: 0.8rem; }
  .big { font: 800 clamp(2.2rem, 4.5vw, 3.2rem)/0.95 var(--display); letter-spacing: -0.05em; margin-top: 0.35rem; }
  .big.red { color: var(--kev); }
  .cmp { font-size: 0.82rem; color: var(--ink-2); margin-top: 0.35rem; }
  .late { color: var(--ink); }
  .coverage { font-size: 0.875rem; color: var(--ink-2); border-left: 3px solid var(--rule-strong); padding-left: 0.75rem; }
  .tiles .cmp b { font-weight: 800; color: var(--ink); }
  .anchor { scroll-margin-top: 4rem; }
  .start { border-top: 2px solid var(--rule-strong); padding-top: 1rem; margin-bottom: 2rem; }
  .start-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem; }
  .start-head > div { flex: 1 1 20rem; }
  .start .rank { margin: 0.2rem 0 0; font-size: 0.875rem; color: var(--ink-3); }
  .start h3 { font: 700 1.25rem/1.2 var(--display); letter-spacing: -0.02em; }
  .copytext { background: var(--paper); border: 2px solid var(--ink); padding: 0.5rem 0.85rem; min-height: 2.75rem; font: 700 0.8125rem/1.1 var(--sans); color: var(--ink); cursor: pointer; min-width: 7.5rem; transition: background-color 150ms, color 150ms; }
  .acts { display: inline-flex; flex-wrap: wrap; gap: 0.5rem; }
  .export-error { margin: 0.75rem 0 0; font-size: 0.875rem; color: var(--ink-2); }
  .copytext:hover { background: var(--ink); color: var(--paper); }
  .start ol { list-style: none; margin: 0.75rem 0 0; padding: 0; display: grid; }
  .start li { display: grid; grid-template-columns: 1.5rem 7.75rem 15.5rem minmax(0, 1fr) 9rem; align-items: center; gap: 0.75rem; padding: 0.6rem 0; border-bottom: 1px solid var(--rule); }
  .start li.no-deadlines { grid-template-columns: 1.5rem 7.75rem 15.5rem minmax(0, 1fr); }
  .start li .chip { justify-self: start; max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
  .start .mono-id { white-space: normal; overflow-wrap: anywhere; }
  .start .due { text-align: right; font: 800 0.9375rem/1.2 var(--display); letter-spacing: -0.01em; color: var(--ink-2); }
  .start .due.late { color: var(--ink); }
  .start .n { font: 800 1.1rem/1 var(--display); color: var(--ink-3); }
  .start .what { font-weight: 600; display: grid; min-width: 0; }
  .start .nm1 { overflow-wrap: anywhere; }
  .start .what small { line-height: 1.35; }
  .start .what small { font-weight: 400; font-size: 0.8125rem; color: var(--ink-3); overflow-wrap: anywhere; }
  @media (max-width: 900px) { .start li, .start li.no-deadlines { grid-template-columns: 1.5rem minmax(0, 1fr); } .start li > :nth-child(n + 3) { grid-column: 2; justify-self: start; } }
  .sm { font-size: 0.75rem; color: var(--ink-3); }
  .more { margin-top: 0.9rem; font-weight: 600; min-height: 2.75rem; }
  @media (max-width: 1000px) { .tiles { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 720px) { .tiles, .tiles.no-deadlines { grid-template-columns: 1fr; } }
  @media (max-width: 560px) { .toggle { width: 100%; } .toggle button { flex: 1; padding-inline: 0.5rem; } }
</style>
