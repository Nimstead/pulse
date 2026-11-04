<script lang="ts" module>
  /** [id, published, status, score, severity, cwe, vendor, product, epss]: a lookup row without its description */
  type HotRow = [string, string, string, number | null, string, string, string, string, number | null]
  /** days: [date, published, scored, Critical or High] */
  export type Recent = { latest: string; days: [string, number, number, number][]; hot: HotRow[] }
</script>

<script lang="ts">
  import Figure from '../components/Figure.svelte'
  import Bars from '../components/Bars.svelte'
  import { downloadCsv } from '../lib/export'
  import { num, pct, epssPct, dateLong, dateShort, titleCase, kvp, daysBetween, addDays, vp, SEV_COLOR, type Kev } from '../lib/data'

  let { kev, recent, today, openCve }: { kev: Kev[]; recent: Recent; today: string; openCve: (id: string) => void } = $props()

  let windowDays = $state(7)
  const since = $derived(addDays(today, -windowDays + 1))
  const newKev = $derived(kev.filter((k) => k.added >= since))
  // the window before this one, for an "is this a bad week?" comparison
  const prevKevN = $derived(kev.filter((k) => k.added < since && k.added >= addDays(since, -windowDays)).length)
  const overdue = $derived(kev.filter((k) => k.due && k.due < today && k.due >= addDays(today, -windowDays)).sort((a, b) => b.due.localeCompare(a.due))) // most recently missed first
  const dueSoon = $derived(kev.filter((k) => k.due && k.due >= today && k.due <= addDays(today, windowDays)).sort((a, b) => a.due.localeCompare(b.due)))
  const todayN = $derived(dueSoon.filter((k) => k.due === today).length)
  // triage order: newly exploited, then KEV due today, then fresh Critical/High with EPSS of 10% or more
  const start = $derived.by(() => {
    const out: { id: string; what: string; why: string; facts: string; red: boolean; due: string; late: boolean }[] = [], seen = new Set<string>()
    const add = (x: (typeof out)[number]) => { if (!seen.has(x.id)) { seen.add(x.id); out.push(x) } }
    const sev = (s: string, n: number | null) => (s ? `${titleCase(s.toLowerCase())}${n != null ? ` ${n.toFixed(1)}` : ''}` : 'Not scored')
    const kevFacts = (k: Kev) => [k.due ? `Due ${dateShort(k.due)}` : '', sev(k.sev, k.score), k.epss != null ? `EPSS ${epssPct(k.epss)}` : ''].filter(Boolean).join(' · ')
    const isNew = new Set(newKev.map((k) => k.id))
    // the deadline in words, so a row is scannable without reading its facts line
    const dueOf = (d: string) => { if (!d) return { due: 'No deadline', late: false }; const left = daysBetween(today, d); return left < 0 ? { due: `${-left} day${left === -1 ? '' : 's'} overdue`, late: true } : left === 0 ? { due: 'Due today', late: true } : { due: `Due in ${left} day${left === 1 ? '' : 's'}`, late: false } }
    const kevRow = (k: Kev, why: string) => ({ id: k.id, what: kvp(k.vendor, k.product), why: [why, isNew.has(k.id) ? 'Newly exploited' : '', k.ransom ? 'ransomware' : ''].filter(Boolean).join(' · '), facts: kevFacts(k), red: true, ...dueOf(k.due) })
    // every overdue and due-today item is listed, so the list keeps its promise; only the sections below are capped
    for (const k of overdue) add(kevRow(k, 'Overdue'))
    for (const k of dueSoon) if (k.due === today) add(kevRow(k, isNew.has(k.id) ? 'Due today' : 'KEV due today'))
    for (const k of newKev) add(kevRow(k, ''))
    for (const k of dueSoon) add(kevRow(k, 'KEV deadline')) // the deadline column already says when
    // nothing fresh may have reached EPSS 10% yet; then the highest-scoring fresh CVEs still lead the list
    for (const r of (likely.length ? likely : hot).slice(0, 2)) add({ id: r[0], what: vp(r[6], r[7]), why: likely.length ? 'Likely target' : 'Top EPSS this week', facts: `Published ${dateShort(r[1])} · ${sev(r[4], r[3])} · EPSS ${epssPct(r[8]!)}`, red: false, due: 'No KEV deadline', late: false })
    return out
  })
  // the list stays scannable, but never hides an overdue or due-today item; Copy as text and CSV still carry all of it
  const SHOW = $derived(Math.max(7, overdue.length + todayN))
  let all = $state(false)
  let copied = $state('')
  async function brief() {
    const lines = [`Nimstead Pulse · last ${windowDays} days to ${dateShort(today)}`, '',
      `${newKev.length} newly exploited (CISA KEV) · ${todayN} KEV due today · ${overdue.length} due dates passed in the last ${windowDays} days · ${severeN} new Critical or High CVEs, ${likely.length} with EPSS of 10% or more`, '',
      'Start here:', ...start.map((x) => `- ${x.id}  ${x.what}  (${x.why}; ${x.facts})`), '', 'Sources: NVD, CISA KEV, EPSS']
    try { await navigator.clipboard.writeText(lines.join('\n')); copied = 'Copied' } catch { copied = 'Copy failed' }
    setTimeout(() => (copied = ''), 1800)
  }
  const days = $derived(recent.days.filter(([d]) => d >= addDays(recent.latest, -windowDays + 1)))
  const pubN = $derived(days.reduce((a, d) => a + d[1], 0))
  const scoredN = $derived(days.reduce((a, d) => a + d[2], 0))
  const severeN = $derived(days.reduce((a, d) => a + d[3], 0))
  // recent.json holds 30 days, so the previous window only exists for 7 and 14
  const prevDays = $derived(windowDays * 2 <= recent.days.length ? recent.days.filter(([d]) => d < addDays(recent.latest, -windowDays + 1) && d >= addDays(recent.latest, -2 * windowDays + 1)) : null)
  const prevSevereN = $derived(prevDays ? prevDays.reduce((a, d) => a + d[3], 0) : null)
  const hot = $derived(recent.hot.filter((r) => r[1] >= addDays(recent.latest, -windowDays + 1)))
  // fresh Critical/High grouped by product; hot is EPSS-sorted, so each group's first row is its highest
  const hotGroups = $derived.by(() => {
    const g = new Map<string, typeof hot>()
    for (const r of hot) { const k = vp(r[6], r[7]); (g.get(k) ?? g.set(k, []).get(k)!).push(r) }
    return [...g].map(([name, rows]) => ({ name, rows, top: rows[0] }))
  })
  const likely = $derived(hot.filter((r) => (r[8] ?? 0) >= 0.1))
  const weekday = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
</script>

<header class="view-head">
  <h2>This week</h2>
  <p class="insight"><b>{num(newKev.length)}</b> newly exploited CVE{newKev.length === 1 ? '' : 's'} in the last {windowDays} days. {todayN ? `${num(todayN)} KEV deadline${todayN === 1 ? '' : 's'} fall${todayN === 1 ? 's' : ''} today` : 'No KEV deadline falls today'}{overdue.length ? `, and ${num(overdue.length)} ${overdue.length === 1 ? 'has' : 'have'} passed their due date in the last ${windowDays} days` : ''}.</p>
  <p>The operational brief: what was newly confirmed as exploited, what is due, and the serious CVEs that have just been published.</p>
</header>

<div class="toggle" role="group" aria-label="Window">
  {#each [7, 14, 30] as d (d)}<button aria-pressed={windowDays === d} onclick={() => (windowDays = d)}>Last {d} days</button>{/each}
</div>


<div class="tiles">
  <div><div class="kicker">New KEV listings</div><div class="big red">{num(newKev.length)}</div><div class="cmp"><b>{num(prevKevN)}</b> the {windowDays} days before{newKev.some((k) => k.ransom) ? ` · ${newKev.filter((k) => k.ransom).length} with ransomware use` : ''}</div></div>
  <div><div class="kicker">KEV due today</div><div class="big" class:red={todayN > 0}>{num(todayN)}</div><div class="cmp">US federal deadlines falling today</div></div>
  <div><div class="kicker">KEV deadlines, next {windowDays} days</div><div class="big">{num(dueSoon.length)}</div><div class="cmp">Including today's. {num(overdue.length)} passed in the last {windowDays} days.</div></div>
  <div><div class="kicker">Fresh likely targets</div><div class="big">{num(likely.length)}</div><div class="cmp">EPSS 10% or more, of {num(severeN)} new Critical or High{#if prevSevereN != null}{' '}({num(prevSevereN)} the {windowDays} days before){/if} · <a href="#fresh" onclick={(e) => { e.preventDefault(); document.getElementById('fresh')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }) }}>by product</a></div></div>
</div>

{#if start.length}
  <section class="start" aria-labelledby="start-h">
    <div class="start-head">
      <div><h3 id="start-h">Start here</h3><p class="rank">Every KEV item overdue or due today, then everything newly exploited, then the rest due in the next {windowDays} days, then the 2 fresh CVEs with the highest EPSS.</p></div>
      <span class="acts"><button class="copytext" onclick={brief}>{copied || 'Copy as text'}</button><button class="copytext" onclick={() => downloadCsv(start.map((x, i) => ({ rank: i + 1, cve: x.id, product: x.what, status: x.why, deadline: x.due, facts: x.facts })), 'start-here')}>CSV</button></span>
    </div>
    <ol>
      {#each all ? start : start.slice(0, SHOW) as x, i (x.id)}
        <li>
          <span class="n">{i + 1}</span>
          <button class="linklike mono-id" onclick={() => openCve(x.id)}>{x.id}</button>
          <span class="chip" class:red={x.red}>{x.why}</span>
          <span class="what"><span class="nm1">{x.what}</span><small>{x.facts}</small></span>
          <span class="due" class:late={x.late}>{x.due}</span>
        </li>
      {/each}
    </ol>
    {#if start.length > SHOW}<button class="linklike more" aria-expanded={all} onclick={() => (all = !all)}>{all ? `Show the first ${SHOW}` : `Show all ${num(start.length)}`}</button>{/if}
  </section>
{/if}


<div id="fresh" class="anchor"></div>
<Figure n={15} name="recent-critical" title="Fresh Critical and High CVEs, by product" sub="Published in the last {windowDays} days: one row per product, ranked by its highest EPSS. {likely.length ? `${num(likely.length)} have reached EPSS 10%.` : 'None has reached EPSS 10% yet, so nothing fresh stands out.'}"
  csv={() => hot.map((r) => ({ cve: r[0], published: r[1], severity: r[4], score: r[3], vendor: r[6], product: r[7], epss: r[8] }))}>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex (a scroll region must be focusable to scroll by keyboard) -->
  <div class="table-scroll" tabindex="0" role="region" aria-label="Table, scrolls sideways">
    <table class="data">
      <thead><tr><th>Vendor · product</th><th class="r">CVEs</th><th>Highest</th><th>Severity</th><th class="r">EPSS</th></tr></thead>
      <tbody>
        {#each hotGroups.slice(0, 15) as g (g.name)}
          {@const r = g.top}
          <tr>
            <td><b>{g.name}</b></td>
            <td class="r">{num(g.rows.length)}</td>
            <td><button class="linklike mono-id" onclick={() => openCve(r[0])}>{r[0]}</button><div class="sm">{dateShort(r[1])}</div></td>
            <td><span class="chip" style:border-color={SEV_COLOR[r[4]]}><span class="swatch" style:background={SEV_COLOR[r[4]]}></span>{titleCase(r[4].toLowerCase())}{r[3] != null ? ` ${r[3].toFixed(1)}` : ''}</span></td>
            <td class="r">{r[8] == null ? '—' : epssPct(r[8])}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</Figure>

<Figure n={16} name="recent-published" title="CVEs published per day" sub="Darker segment: CVEs that already have a severity score"
  csv={() => days.map(([d, n, s]) => ({ date: d, published: n, scored: s }))}>
  <Bars label="CVEs published per day" labels={days.map((d) => d[0])} height={160}
    series={[{ key: 's', label: 'Scored', color: 'var(--vol)', values: days.map((d) => d[2]) }, { key: 'u', label: 'Not scored yet', color: 'var(--vol-soft)', values: days.map((d) => d[1] - d[2]) }]}
    tick={(l, i) => (days.length <= 14 || i % 5 === 0 ? weekday(l) : null)} tipTitle={(l) => dateLong(l)} />
</Figure>

<style>
  .toggle { display: inline-flex; border: 2px solid var(--ink); overflow: hidden; margin-bottom: 1.5rem; }
  .toggle button { background: var(--paper); border: 0; border-left: 2px solid var(--ink); padding: 0.55rem 0.95rem; min-height: 2.75rem; font: 700 0.8125rem var(--sans); color: var(--ink-2); cursor: pointer; }
  .toggle button:first-child { border-left: 0; }
  .toggle button[aria-pressed='true'] { background: var(--ink); color: var(--paper); }
  .tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: clamp(1rem, 3vw, 3rem); margin-bottom: 1.5rem; }
  .tiles > div { border-top: 2px solid var(--rule-strong); padding-top: 0.8rem; }
  .big { font: 800 clamp(2.2rem, 4.5vw, 3.2rem)/0.95 var(--display); letter-spacing: -0.05em; margin-top: 0.35rem; }
  .big.red { color: var(--kev); }
  .cmp { font-size: 0.82rem; color: var(--ink-2); margin-top: 0.35rem; }
  .late { color: var(--kev); }
  .tiles .cmp b { font-weight: 800; color: var(--ink); }
  .anchor { scroll-margin-top: 4rem; }
  .start { border-top: 2px solid var(--rule-strong); padding-top: 1rem; margin-bottom: 2rem; }
  .start-head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem; }
  .start-head > div { flex: 1 1 20rem; }
  .start .rank { margin: 0.2rem 0 0; font-size: 0.875rem; color: var(--ink-3); }
  .start h3 { font: 700 1.25rem/1.2 var(--display); letter-spacing: -0.02em; }
  .copytext { background: var(--paper); border: 2px solid var(--ink); padding: 0.5rem 0.85rem; min-height: 2.75rem; font: 700 0.8125rem/1.1 var(--sans); color: var(--ink); cursor: pointer; min-width: 7.5rem; transition: background-color 150ms, color 150ms; }
  .acts { display: inline-flex; gap: 0.5rem; }
  .copytext:hover { background: var(--ink); color: var(--paper); }
  .start ol { list-style: none; margin: 0.75rem 0 0; padding: 0; display: grid; }
  .start li { display: grid; grid-template-columns: 1.5rem 7.75rem 15.5rem minmax(0, 1fr) 9rem; align-items: center; gap: 0.75rem; padding: 0.6rem 0; border-bottom: 1px solid var(--rule); }
  .start li .chip { justify-self: start; }
  .start .due { text-align: right; font: 800 0.9375rem/1.2 var(--display); letter-spacing: -0.01em; color: var(--ink-2); }
  .start .due.late { color: var(--kev); }
  .start .n { font: 800 1.1rem/1 var(--display); color: var(--ink-3); }
  .start .what { font-weight: 600; display: grid; min-width: 0; }
  .start .nm1 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .start .what small { line-height: 1.35; }
  .start .what small { font-weight: 400; font-size: 0.8125rem; color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; }
  @media (max-width: 900px) { .start li { grid-template-columns: 1.5rem minmax(0, 1fr); } .start li > :nth-child(n + 3) { grid-column: 2; justify-self: start; } }
  .sm { font-size: 0.75rem; color: var(--ink-3); }
  .more { margin-top: 0.9rem; font-weight: 600; min-height: 2.75rem; }
  @media (max-width: 1000px) { .tiles { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 720px) { .tiles { grid-template-columns: 1fr; } }
</style>
