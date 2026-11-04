<script lang="ts" module>
  import type { CveRow } from '../lib/data'
  import type { Item } from '../lib/watchlist'

  /** The private list and its analysis. Memory only: never written to storage, the URL or the network. */
  export const watch = $state({
    text: '', ids: [] as string[], items: [] as Item[], missing: [] as string[], rejected: [] as string[],
    desc: {} as Record<string, string>, descFor: '', dl: { running: false, done: 0, total: 0, error: '' }, example: false,
  })
  let exampleShown = false // once per page load: after Clear, the view stays empty
  let ctl: AbortController | null = null

  /** Sheet lookup: a row for an ID on the analysed list (null if NVD has none), undefined for any other ID. */
  export function watchRow(id: string): CveRow | null | undefined {
    if (!watch.ids.includes(id)) return undefined
    const it = watch.items.find((i) => i.row[0] === id)
    return it ? ([...it.row.slice(0, 9), watch.desc[id] ?? ''] as CveRow) : null
  }

  // Fetches every shard in a fixed order, whatever is on the list, so the requests reveal nothing about it.
  async function loadDescs(shards: string[]) {
    ctl?.abort()
    const c = (ctl = new AbortController()), want = new Set(watch.ids), forKey = watch.ids.join(), out: Record<string, string> = {}
    const queue = [...shards]
    watch.dl = { running: true, done: 0, total: shards.length, error: '' }
    try {
      await Promise.all(Array.from({ length: 4 }, async () => {
        for (let name = queue.shift(); name; name = queue.shift()) {
          const r = await fetch(`data/cve/${name}.json`, { signal: c.signal })
          if (!r.ok) throw new Error(`Could not load ${name}.json (${r.status})`)
          for (const row of (await r.json()) as CveRow[]) if (want.has(row[0])) out[row[0]] = row[9]
          if (!c.signal.aborted) watch.dl.done++
        }
      }))
      watch.desc = out
      watch.descFor = forKey
    } catch (e) {
      if (!c.signal.aborted) watch.dl.error = String((e as Error).message ?? e)
      c.abort()
    } finally {
      if (ctl === c) { ctl = null; watch.dl.running = false }
    }
  }
  function cancelDescs() { ctl?.abort(); ctl = null; watch.dl.running = false }
</script>

<script lang="ts">
  import { tick } from 'svelte'
  import Figure from '../components/Figure.svelte'
  import Bars from '../components/Bars.svelte'
  import Rows from '../components/Rows.svelte'
  import { load, num, pct, epssPct, dateShort, addDays, kvp, sum, SEV, SEV_COLOR, share, epssBands, titleCase, vp, type Kev, type Epss, type Month, type Ranked } from '../lib/data'
  import { parseIds, analyse, TIERS, MAX_IDS, type IdxRow } from '../lib/watchlist'

  let { months, kevById, epss, cwe, cweNames: names, shards, indexParts, today, openCve }: {
    months: Month[]; kevById: Map<string, Kev>; epss: Epss; cwe: Ranked[]; cweNames: Record<string, string>; shards: string[]; indexParts: number; today: string; openCve: (id: string) => void
  } = $props()

  const parsed = $derived(parseIds(watch.text))
  let busy = $state(false)
  let err = $state('')
  let dragging = $state(false)
  let shown = $state(50)

  // the worked example: a small fixed file every visitor fetches, analysed exactly like a pasted list
  async function example() {
    exampleShown = true
    try {
      const ex = await load<{ ids: string[]; rows: IdxRow[] }>('example.json')
      Object.assign(watch, { ids: ex.ids, ...analyse(ex.ids, ex.rows, kevById), example: true })
      shown = 50
    } catch (e) { err = String((e as Error).message ?? e) }
  }
  if (!exampleShown && !watch.text && !watch.items.length) example()
  async function run() {
    busy = true; err = ''
    try {
      // every part, whatever is on the list; plain fetch, not the load() cache: the 45 MB index is dropped once the list is joined
      const parts = await Promise.all(Array.from({ length: indexParts }, async (_, i) => {
        const r = await fetch(`data/index-${i}.json`)
        if (!r.ok) throw new Error(`Could not load the CVE index (${r.status})`)
        return (await r.json()) as IdxRow[]
      }))
      const res = analyse(parsed.ids, parts.flat(), kevById)
      Object.assign(watch, { ids: parsed.ids, ...res, example: false })
      shown = 50
    } catch (e) { err = String((e as Error).message ?? e) } finally { busy = false }
  }
  let undo = $state<typeof watch | null>(null) // the list lives only in memory, so Clear keeps one undo step
  function clear() {
    cancelDescs()
    undo = watch.example && !watch.text ? null : { ...watch, dl: { running: false, done: 0, total: 0, error: '' } }
    Object.assign(watch, { text: '', ids: [], items: [], missing: [], rejected: [], desc: {}, descFor: '', dl: { running: false, done: 0, total: 0, error: '' }, example: false })
    err = ''
  }
  async function readFiles(files: FileList | null | undefined) {
    if (!files?.length) return
    const big = [...files].filter((f) => f.size > 20e6)
    if (big.length) { err = `${big.map((f) => f.name).join(', ')} is over 20 MB. Paste the relevant part instead.`; return }
    const texts = await Promise.all([...files].map((f) => f.text())) // read in the browser; the file is never uploaded
    watch.text = [watch.text.trim(), ...texts].filter(Boolean).join('\n')
    err = ''
  }

  // the worked example is described as an example, never as the visitor's own list
  const your = $derived(watch.example ? 'these' : 'your'), Your = $derived(watch.example ? 'These' : 'Your'), yourList = $derived(watch.example ? 'the example' : 'your list')
  const items = $derived(watch.items)
  const n = $derived(items.length)
  const kevN = $derived(items.filter((i) => i.kev).length)
  const ransomN = $derived(items.filter((i) => i.kev?.ransom).length)
  const overdueN = $derived(items.filter((i) => i.kev?.due && i.kev.due < today).length)
  const likelyN = $derived(items.filter((i) => i.tier === 2).length)
  const severeN = $derived(items.filter((i) => i.row[4] === 'CRITICAL' || i.row[4] === 'HIGH').length)
  const unscoredN = $derived(items.filter((i) => !i.row[4]).length)
  const descReady = $derived(watch.descFor !== '' && watch.descFor === watch.ids.join())
  const stale = $derived(watch.ids.length > 0 && !watch.example && parsed.ids.join() !== watch.ids.join())

  const mineMix = $derived(SEV.map((s) => items.filter((i) => i.row[4] === s.full).length))
  const allMix = $derived(SEV.map((s) => sum(months, (m) => m[s.key])))

  const binLabels = $derived(epssBands(epss.edges))
  const allBins = $derived(share(epss.all.map((v, i) => v + epss.kev[i])))
  const mineBins = $derived(share(epss.edges.slice(0, -1).map((e, i) => items.filter((it) => it.row[8] != null && it.row[8] >= e && (i === epss.edges.length - 2 || it.row[8] < epss.edges[i + 1])).length)))

  const years = $derived.by(() => {
    const ys = items.map((i) => +i.row[1].slice(0, 4)).filter(Boolean)
    if (!ys.length) return []
    return Array.from({ length: Math.max(...ys) - Math.min(...ys) + 1 }, (_, k) => String(Math.min(...ys) + k))
  })
  const perYear = (sel: Item[]) => years.map((y) => sel.filter((i) => i.row[1].startsWith(y)).length)

  function group(key: (i: Item) => string, label: (k: string) => string, sub: (k: string) => string = () => '') {
    const g = new Map<string, Item[]>()
    for (const i of items) { const k = key(i); if (k) (g.get(k) ?? g.set(k, []).get(k)!).push(i) }
    return [...g].map(([k, xs]) => ({ k, xs, kev: xs.filter((i) => i.kev).length })).sort((a, b) => b.xs.length - a.xs.length || b.kev - a.kev).slice(0, 12)
      .map(({ k, xs, kev }) => ({ key: k, label: label(k), sub: sub(k), value: xs.length, kev, spark: years.length > 1 ? perYear(xs) : undefined }))
  }
  // KEV names first, as in the table: NVD's first vulnerable CPE can be a downstream product (Log4j listed under Siemens firmware)
  const products = $derived(group((i) => (i.kev?.vendor ? kvp(i.kev.vendor, i.kev.product) : i.row[6] ? vp(i.row[6], i.row[7]) : ''), (k) => k))
  const cweNames = $derived(new Map([...Object.entries(names), ...cwe.map((c) => [c.key, c.name ?? c.key] as [string, string])]))
  const weaknesses = $derived(group((i) => (i.row[5]?.startsWith('NVD-CWE') ? '' : i.row[5]), (k) => cweNames.get(k) ?? k, (k) => (cweNames.has(k) ? k : '')))

  const csvRows = () => items.map(({ row: r, kev, tier }) => ({
    priority: TIERS[tier].label, cve: r[0], published: r[1], status: r[2], severity: r[4], score: r[3], vendor: r[6], product: r[7], cwe: r[5],
    epss: r[8], epss_percentile: r[9], in_kev: !!kev, kev_added: kev?.added ?? '', kev_due: kev?.due ?? '', ransomware: kev?.ransom ?? false,
    description: watch.desc[r[0]] ?? '',
  }))
</script>

<header class="view-head">
  <h2>Your CVEs</h2>
  <p>Paste or drop the CVEs that affect you, from a scanner export, a ticket or a spreadsheet, and get one prioritised analysis of the whole set.</p>
</header>

<section class="intake">
  <div class="field">
    <label class="kicker" for="watch-text">CVE list</label>
    <!-- no name and no form, so the browser keeps no form history; spellcheck off, because enhanced spellcheck sends text to a server -->
    <textarea id="watch-text" bind:value={watch.text} rows="8" class:dragging placeholder="CVE-2024-3400, CVE-2021-44228 … or drop a .txt, .csv or .json file here"
      spellcheck="false" autocomplete="off" autocapitalize="off" data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false" data-lt-active="false"
      ondragover={(e) => { e.preventDefault(); dragging = true }} ondragleave={() => (dragging = false)}
      ondrop={(e) => { e.preventDefault(); dragging = false; readFiles(e.dataTransfer?.files) }}></textarea>
    <div class="actions">
      {#if !watch.text && !n}
        {#if undo}<button class="btn" onclick={() => { Object.assign(watch, undo); undo = null }}>Undo clear</button>
        {:else}<button class="btn" onclick={example}>Show the example again</button>{/if}
      {/if}
      <button class="btn primary" onclick={run} disabled={!parsed.ids.length || busy}>
        {busy ? 'Analysing…' : parsed.ids.length ? `Analyse ${num(parsed.ids.length)} CVE${parsed.ids.length === 1 ? '' : 's'}` : 'Analyse'}
      </button>
      <label class="btn">Choose file<input type="file" class="sr-only" multiple accept=".txt,.csv,.json,.xml,.md,text/*"
        onchange={(e) => { readFiles(e.currentTarget.files); e.currentTarget.value = '' }} /></label>
      <button class="btn" onclick={clear} disabled={!watch.text && !n}>Clear</button>
      <span class="status" aria-live="polite">
        {#if watch.text && !parsed.ids.length}No CVE IDs found. IDs look like CVE-2024-3400.
        {:else if parsed.ids.length}{num(parsed.ids.length)} unique ID{parsed.ids.length === 1 ? '' : 's'} found{parsed.dupes ? `, ${num(parsed.dupes)} duplicate${parsed.dupes === 1 ? '' : 's'} ignored` : ''}{parsed.capped ? `. Only the first ${num(MAX_IDS)} are used` : ''}{stale ? '. The list has changed since the last analysis' : ''}.{/if}
      </span>
    </div>
    {#if err}<p class="err" role="alert">{err}</p>{/if}
  </div>
  <aside class="privacy">
    <h3 class="kicker">Your list stays in this browser</h3>
    <ul>
      <li>The analysis runs on this page. Every visitor downloads the same public data files, so the site never learns which CVEs you entered.</li>
      <li>The site's security policy blocks this page from contacting any other server.</li>
      <li>Nothing is saved. Reloading or closing the tab, or pressing Clear, wipes the list.</li>
      <li>Two things are outside the page's control: browser extensions can read any page, and the NVD, CVE.org and CISA links in a case record take that one ID to that site if you click them.</li>
    </ul>
  </aside>
</section>

{#if n}
  {#if watch.example}<p class="exnote"><b>A worked example.</b> These are 14 well-known CVEs. Paste or drop your own list above and press Analyse to replace them; your list never leaves this browser.</p>{/if}
  <p class="headline">
    {kevN ? `${num(kevN)} of ${your} ${num(n)} CVEs ${kevN === 1 ? 'is' : 'are'} exploited in the wild` : `None of ${your} ${num(n)} CVEs is listed as exploited in the wild`}{ransomN ? `, ${num(ransomN)} with known ransomware use` : ''}.
    {likelyN ? `${num(likelyN)} more ${likelyN === 1 ? 'has' : 'have'} an EPSS of 10% or higher, so ${likelyN === 1 ? 'it is a likely target' : 'they are likely targets'}.` : ''}
    {#if watch.missing.length || watch.rejected.length}<span class="aside">{[watch.missing.length && `${num(watch.missing.length)} not found`, watch.rejected.length && `${num(watch.rejected.length)} rejected`].filter(Boolean).join(', ')}; <a href="#watch-unmatched">see the end of the page</a>.</span>{/if}
  </p>

  <div class="tiles">
    <div><div class="kicker">Exploited (in KEV)</div><div class="big red">{num(kevN)}</div><div class="cmp">{pct(kevN / n)} of {yourList}</div></div>
    <div><div class="kicker">Known ransomware use</div><div class="big" class:red={ransomN > 0}>{num(ransomN)}</div><div class="cmp">KEV entries CISA links to ransomware</div></div>
    <div><div class="kicker">Past the CISA due date</div><div class="big">{num(overdueN)}</div><div class="cmp">US federal deadline, a useful outside benchmark</div></div>
    <div><div class="kicker">EPSS 10% or higher</div><div class="big">{num(likelyN)}</div><div class="cmp">not in KEV yet</div></div>
    <div><div class="kicker">Critical or high</div><div class="big">{num(severeN)}</div><div class="cmp">{pct(severeN / n)} of {yourList}, by CVSS</div></div>
    <div><div class="kicker">Not scored yet</div><div class="big">{num(unscoredN)}</div><div class="cmp">no CVSS from NVD or the CNA</div></div>
  </div>

  <section class="descs" aria-live="polite">
    {#if descReady}
      <p><b>Descriptions loaded.</b> They show in the table and in each case record.</p>
    {:else if watch.dl.running}
      <div class="dlrow">
        <progress max={watch.dl.total} value={watch.dl.done} aria-label="Downloading descriptions"></progress>
        <span>{watch.dl.done} of {watch.dl.total} files</span>
        <button class="btn" onclick={cancelDescs}>Cancel</button>
      </div>
    {:else}
      <div class="dlrow">
        <div>
          <b>{watch.descFor ? 'Your list has changed. Refresh the descriptions?' : 'Add descriptions?'}</b>
          <span class="muted">This downloads the full NVD text for every CVE ({shards.length} files, about 40 MB). Everyone downloads the same files, so it reveals nothing about your list. Repeat downloads come from your browser's cache.</span>
          {#if watch.dl.error}<span class="err" role="alert">{watch.dl.error}. Check the connection and try again.</span>{/if}
        </div>
        <button class="btn" onclick={() => loadDescs(shards)}>{watch.dl.error ? 'Retry' : 'Download descriptions'}</button>
      </div>
    {/if}
  </section>

  <Figure n={17} name="your-cves-priority" title="{Your} CVEs in priority order" sub="Exploited first, then likely targets by EPSS, then by CVSS severity" csv={csvRows}>
    {#snippet legend()}{#each TIERS as t, i (t.label)}<span><span class="chip" class:solid-red={i === 0} class:red={i === 1}>{t.label}</span> {t.note}</span>{/each}{/snippet}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (a scroll region must be focusable to scroll by keyboard) -->
    <div class="table-scroll" tabindex="0" role="region" aria-label="Table, scrolls sideways">
      <table class="data">
        <thead><tr><th>Priority</th><th>CVE</th><th>Vendor · product</th><th>Severity</th><th class="r">EPSS</th><th>KEV</th><th>Weakness</th></tr></thead>
        <tbody>
          {#each items.slice(0, shown) as { row: r, kev, tier } (r[0])}
            <tr>
              <td><span class="chip" class:solid-red={tier === 0} class:red={tier === 1}>{TIERS[tier].label}</span></td>
              <td><button class="linklike mono-id" onclick={() => openCve(r[0])}>{r[0]}</button><div class="sm">{r[1] ? dateShort(r[1]) : '—'}</div></td>
              <td class="desc">
                {kev?.vendor ? kvp(kev.vendor, kev.product) : vp(r[6], r[7])}
                {#if watch.desc[r[0]]}<div class="sm">{watch.desc[r[0]].slice(0, 180)}{watch.desc[r[0]].length > 180 ? '…' : ''}</div>{/if}
              </td>
              <td class="nw">{#if r[4]}<span class="chip" style:border-color={SEV_COLOR[r[4]]}><span class="swatch" style:background={SEV_COLOR[r[4]]}></span>{titleCase(r[4].toLowerCase())}{r[3] != null ? ` ${r[3].toFixed(1)}` : ''}</span>{:else}<span class="sm">Not scored</span>{/if}</td>
              <td class="r nw">{#if r[8] != null}<b>{epssPct(r[8])}</b>{#if r[9] != null}<div class="sm">top {r[9] >= 0.999 ? '0.1%' : pct(1 - r[9], 1)}</div>{/if}{:else}—{/if}</td>
              <td class="nw">{#if kev}Added {dateShort(kev.added)}{#if kev.due}<div class="sm" class:overdue={kev.due < today && kev.due >= addDays(today, -90)}>{kev.due >= today ? 'Due' : kev.due >= addDays(today, -90) ? 'Overdue · due' : 'Was due'} {dateShort(kev.due)}</div>{/if}{:else}<span class="sm">—</span>{/if}</td>
              <td class="nw">{r[5] ? (cweNames.get(r[5]) ?? r[5]) : '—'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if shown < items.length}<button class="linklike more" onclick={() => (shown += 100)}>Show more ({num(items.length - shown)} left)</button>{/if}
  </Figure>

  <div class="grid-2">
    <Figure n={18} name="your-cves-severity" title="Severity of {your} CVEs against all CVEs" sub="Share by CVSS base severity"
      csv={() => SEV.map((s, i) => ({ severity: s.label, your_cves: mineMix[i], all_cves: allMix[i] }))}>
      {#snippet legend()}{#each SEV as s (s.key)}<span><span class="swatch" style:background={SEV_COLOR[s.key]}></span> {s.label}</span>{/each}{/snippet}
      <div class="hbars">
        {#each [{ label: `${Your} CVEs`, n, mix: mineMix }, { label: 'All CVEs', n: sum(allMix, (x) => x), mix: allMix }] as r (r.label)}
          <div class="hrow">
            <div class="hl"><b>{r.label}</b><span>{num(r.n)}</span></div>
            <div class="hb" role="img" aria-label="{r.label}: {SEV.map((s, i) => `${s.label} ${pct(share(r.mix)[i])}`).join(', ')}">
              {#each SEV as s, i (s.key)}
                {@const w = share(r.mix)[i]}
                {#if w > 0}<span style:width="{w * 100}%" style:background={SEV_COLOR[s.key]} class:dark={i < 2} class:edge={s.key === 'l' || s.key === 'u'} title="{s.label}: {num(r.mix[i])}">{w > 0.08 ? pct(w) : ''}</span>{/if}
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </Figure>

    <Figure n={19} name="your-cves-epss" title="Exploit probability of {your} CVEs against all CVEs" sub="Share in each EPSS band. Scores are current."
      csv={() => binLabels.map((l, i) => ({ epss_band: l, your_cves: mineBins[i], all_cves: allBins[i] }))}>
      {#snippet legend()}
        <span><span class="swatch" style:background="var(--vol)"></span> {Your} CVEs</span>
        <span><span class="swatch" style:background="var(--vol-soft)"></span> All CVEs</span>
      {/snippet}
      <Bars label="EPSS distribution, {your} CVEs and all CVEs" labels={binLabels} height={230} stacked={false} format={(v) => pct(v, 1)} axis={(t) => pct(t)}
        series={[
          { key: 'mine', label: `${Your} CVEs`, color: 'var(--vol)', values: mineBins },
          { key: 'all', label: 'All CVEs', color: 'var(--vol-soft)', values: allBins },
        ]} tick={(l) => l} />
    </Figure>
  </div>

  {#if years.length}
    <Figure n={20} name="your-cves-by-year" title="When {your} CVEs were published" sub="By NVD publication year. Red: since listed as exploited."
      csv={() => years.map((y, i) => ({ year: y, cves: perYear(items)[i], exploited: perYear(items.filter((x) => x.kev))[i] }))}>
      {#snippet legend()}
        <span><span class="swatch" style:background="var(--kev)"></span> Exploited (in KEV)</span>
        <span><span class="swatch" style:background="var(--vol)"></span> Not in KEV</span>
      {/snippet}
      <Bars label="{Your} CVEs by publication year" labels={years} height={200}
        series={[
          { key: 'kev', label: 'Exploited', color: 'var(--kev)', values: perYear(items.filter((x) => x.kev)) },
          { key: 'rest', label: 'Not in KEV', color: 'var(--vol)', values: perYear(items.filter((x) => !x.kev)) },
        ]} tick={(l, i) => (years.length <= 14 || i % 2 === 0 ? l : null)} />
    </Figure>
  {/if}

  {#if products.some((p) => p.value > 1) || weaknesses.some((w) => w.value > 1)}
  <div class="grid-2">
    <Figure n={21} name="your-cves-products" title="Products with the most CVEs on {yourList}" sub="Most common, up to 12; red: exploited"
      csv={() => products.map((p) => ({ product: p.label, cves: p.value, exploited: p.kev }))}>
      {#if products.length}<Rows rows={products} />{:else}<p class="sm">No vendor or product data for these CVEs yet.</p>{/if}
    </Figure>
    <Figure n={22} name="your-cves-weaknesses" title="Weakness types on {yourList}" sub="Most common CWEs, up to 12; red: exploited"
      csv={() => weaknesses.map((w) => ({ cwe: w.key, name: w.label, cves: w.value, exploited: w.kev }))}>
      {#if weaknesses.length}<Rows rows={weaknesses} />{:else}<p class="sm">No weakness data for these CVEs yet.</p>{/if}
    </Figure>
  </div>
  {/if}

  {#if watch.missing.length || watch.rejected.length}
    <section id="watch-unmatched" class="unmatched">
      {#if watch.missing.length}<h3 class="kicker">Not in the NVD feed ({num(watch.missing.length)})</h3><p>{watch.missing.join(', ')}. Check the IDs; very new CVEs can take a day to appear.</p>{/if}
      {#if watch.rejected.length}<h3 class="kicker">Rejected by the CVE program ({num(watch.rejected.length)})</h3><p>{watch.rejected.join(', ')}. These are not vulnerabilities and can be closed.</p>{/if}
    </section>
  {/if}
{/if}

<style>
  .intake { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); gap: clamp(1.5rem, 3vw, 3rem); margin-bottom: 2rem; }
  .field { display: grid; gap: 0.5rem; align-content: start; }
  textarea {
    width: 100%; min-height: 10rem; resize: vertical; padding: 0.8rem 0.9rem; border: 1px solid var(--rule-strong);
    background: var(--paper); color: var(--ink); font: 400 1rem/1.6 var(--mono); /* under 16px makes iOS zoom on focus */
  }
  textarea.dragging { border-width: 2px; background: var(--shade); }
  .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.6rem; }
  .btn {
    display: inline-flex; align-items: center; height: 2.75rem; padding: 0 1.1rem; border: 2px solid var(--rule-strong);
    background: var(--paper); font: 700 0.875rem var(--sans); color: var(--ink); cursor: pointer; transition: background-color 150ms, color 150ms;
  }
  .btn:hover:not(:disabled) { background: var(--ink); color: var(--paper); }
  .btn:active:not(:disabled) { transform: scale(0.97); }
  .btn:disabled, .btn.primary:disabled { background: var(--shade); border-color: var(--shade); color: var(--disabled); cursor: default; }
  .btn:focus-within { outline: 2px solid var(--ink); outline-offset: 2px; }
  .btn.primary { background: var(--ink); border-color: var(--ink); color: var(--paper); }
  .exnote { margin: 0 0 1rem; padding: 0.75rem 1rem; background: var(--shade); font-size: 0.9375rem; }
  .btn.primary:hover:not(:disabled) { background: var(--paper); color: var(--ink); }
  .status { font-size: 0.82rem; color: var(--ink-2); }
  .err { color: var(--kev); font-size: 0.875rem; margin: 0; display: block; }
  .privacy { border-top: 2px solid var(--rule-strong); padding-top: 0.8rem; font-size: 0.875rem; color: var(--ink-2); }
  .privacy ul { margin: 0.75rem 0 0; padding: 0; list-style: none; display: grid; gap: 0.55rem; }
  .privacy li { position: relative; padding-left: 1.25rem; }
  .privacy li::before { content: ''; position: absolute; left: 0; top: 0.7em; width: 8px; height: 2px; background: var(--ink); }
  .headline { font: 500 clamp(1.25rem, 2.4vw, 1.6rem)/1.35 var(--display); letter-spacing: -0.02em; max-width: 62ch; margin: 0 0 1.5rem; }
  .headline .aside { display: block; font: 400 0.875rem var(--sans); color: var(--ink-3); margin-top: 0.4rem; }
  .tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem clamp(1rem, 3vw, 3rem); margin-bottom: 1.75rem; }
  .tiles > div { border-top: 2px solid var(--rule-strong); padding-top: 0.8rem; }
  .big { font: 800 clamp(2rem, 4vw, 2.8rem)/0.95 var(--display); letter-spacing: -0.05em; margin-top: 0.35rem; }
  .big.red { color: var(--kev); }
  .cmp { font-size: 0.82rem; color: var(--ink-2); margin-top: 0.35rem; }
  .descs { border: 1px solid var(--line-strong); padding: 0.8rem 1rem; margin-bottom: 1.5rem; font-size: 0.875rem; }
  .descs p { margin: 0; }
  .dlrow { display: flex; align-items: center; gap: 0.6rem 1.25rem; justify-content: space-between; flex-wrap: wrap; }
  .dlrow > div { display: grid; gap: 0.2rem; max-width: 75ch; }
  .muted { color: var(--ink-2); }
  progress { flex: 1; min-width: 10rem; height: 6px; appearance: none; border: 0; background: var(--shade); overflow: hidden; }
  progress::-webkit-progress-bar { background: var(--shade); }
  progress::-webkit-progress-value { background: var(--vol); transition: width 200ms; }
  progress::-moz-progress-bar { background: var(--vol); }
  .sm { font-size: 0.75rem; color: var(--ink-3); }
  .overdue { color: var(--kev); }
  td.desc { max-width: 46ch; }
  .more { margin-top: 0.9rem; font-weight: 600; min-height: 2.75rem; }
  .hbars { display: grid; gap: 1.1rem; }
  .hrow { display: grid; grid-template-columns: 8rem 1fr; gap: 1rem; align-items: center; }
  .hl { display: grid; font-size: 0.875rem; }
  .hl span { color: var(--ink-3); font-size: 0.8rem; }
  .hb { display: flex; height: 2.4rem; overflow: hidden; }
  .hb span { display: flex; align-items: center; justify-content: center; font: 600 0.8125rem var(--sans); color: var(--ink); min-width: 2px; }
  .hb span.dark { color: var(--paper); }
  .hb span.edge { box-shadow: inset 0 0 0 1px var(--line-strong); }
  .unmatched { border-top: 1px solid var(--rule-strong); padding-top: 1rem; margin-top: 1.5rem; font-size: 0.875rem; color: var(--ink-2); scroll-margin-top: 5rem; }
  .unmatched p { margin: 0.35rem 0 1rem; overflow-wrap: anywhere; }
  @media (max-width: 900px) { .intake { grid-template-columns: minmax(0, 1fr); } }
  @media (max-width: 720px) { .tiles { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 560px) { .hrow { grid-template-columns: 1fr; gap: 0.35rem; } }
</style>
