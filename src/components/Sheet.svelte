<script lang="ts">
  import { ui } from '../lib/state.svelte'
  import { shard, num, pct, epssPct, dateLong, daysBetween, titleCase, SEV_COLOR, type Kev, type CveRow } from '../lib/data'

  let { id = $bindable(), kevById, today, local, cweNames = {}, epssDate, nvdDate }: {
    id: string; kevById: Map<string, Kev>; today: string; local?: (id: string) => CveRow | null | undefined; cweNames?: Record<string, string>; epssDate?: string; nvdDate?: string
  } = $props()

  let dlg: HTMLDialogElement
  let row = $state<CveRow | null | undefined>(undefined)
  let failed = $state(false)
  let closing = $state(false)
  const kev = $derived(id ? kevById.get(id) : undefined)
  const epssScore = $derived(row?.[8] ?? kev?.epss ?? null)

  $effect(() => {
    if (!id) return
    row = undefined
    failed = false
    if (!dlg.open) dlg.showModal()
    const want = id, mine = local?.(want)
    if (mine !== undefined) { row = mine; return } // private list: never fetch, the shard name would reveal the ID's range
    shard(want).then((rows) => { if (id === want) row = rows.find((r) => r[0] === want) ?? null }).catch(() => { if (id === want) { row = null; failed = true } })
  })

  function close() {
    if (closing || !dlg.open) return
    closing = true
    // leave the way it came in: slide back out to the right, then close
    setTimeout(() => { dlg.close(); closing = false; id = '' }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220)
  }
  const steps = $derived.by(() => {
    const s: { label: string; date: string; note?: string; red?: boolean }[] = []
    const pub = row?.[1] ?? kev?.pub
    if (pub) s.push({ label: 'Published', date: pub, note: 'NVD publication date' })
    if (kev) {
      s.push({ label: 'Added to CISA KEV', date: kev.added, red: true, note: kev.lag == null ? '' : kev.lag <= 0 ? 'Listed on or before publication day' : `${num(kev.lag)} days after publication` })
      if (ui.kevDeadlines && kev.due) {
        const d = daysBetween(today, kev.due)
        s.push({ label: 'KEV due date (US federal deadline)', date: kev.due, note: d >= 0 ? `${d} days from the data date` : `${-d} days ago` })
      }
    }
    return s.sort((a, b) => a.date.localeCompare(b.date))
  })
</script>

<dialog bind:this={dlg} class:closing onclose={() => (id = '')} oncancel={(e) => { e.preventDefault(); close() }}
  onclick={(e) => { if (e.target === dlg) close() }} aria-labelledby="sheet-title">
  <div class="panel">
    <header>
      <div>
        <h2 id="sheet-title">{id}</h2>
      </div>
      <button class="x" onclick={close} aria-label="Close"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" /></svg></button>
    </header>

    {#if row === undefined && !kev}
      <p class="muted">Loading…</p>
    {:else if failed && !kev}
      <p class="muted" role="alert">Could not load this record. Check the connection and try again.</p>
    {:else if row === null && !kev}
      <p class="muted">No record for {id} in the NVD feed. Check the ID; very new CVEs can take a day to appear.</p>
    {:else}
      <div class="chips">
        {#if kev}<span class="chip solid-red">Exploited · in KEV</span>{/if}
        {#if kev?.ransom}<span class="chip red">Ransomware use known</span>{/if}
        {#if row?.[4]}<span class="chip" style:border-color={SEV_COLOR[row[4]]}><span class="swatch" style:background={SEV_COLOR[row[4]]}></span>{titleCase(row[4].toLowerCase())}{row[3] != null ? ` ${row[3].toFixed(1)}` : ''}</span>
        {:else if row}<span class="chip">Not scored yet</span>{/if}
        {#if row?.[2]}<span class="chip">NVD: {row[2]}</span>{/if}
      </div>

      <p class="provenance">{#if nvdDate}NVD feed through {dateLong(nvdDate)}{#if epssDate} · {/if}{/if}{#if epssDate}EPSS score dated {dateLong(epssDate)}{/if}</p>

      {#if kev?.name}<p class="name">{kev.name}</p>{/if}
      {#if row?.[9]}<p class="desc">{row[9]}</p>{/if}

      <dl class="facts">
        <div><dt>Vendor</dt><dd>{kev?.vendor || titleCase(row?.[6] || '—')}</dd></div>
        <div><dt>Product</dt><dd>{kev?.product || titleCase(row?.[7] || '—')}</dd></div>
        <div><dt>Weakness</dt><dd>{#if row?.[5] || kev?.cwe}{@const w = (row?.[5] || kev?.cwe)!}{cweNames[w] ?? w}{#if cweNames[w]}&nbsp;<span class="muted cwe">{w}</span>{/if}{:else}—{/if}</dd></div>
        <div><dt>EPSS</dt><dd>{#if epssScore != null}{epssPct(epssScore)} <span class="muted">estimated probability of exploitation activity in 30 days</span>{:else}Unavailable{/if}</dd></div>
      </dl>

      {#if epssScore != null}
        <div class="meter" aria-hidden="true"><i style:width="{epssScore * 100}%"></i></div>
      {/if}

      <p class="triage">
        {#if kev}CISA KEV lists this CVE based on evidence of exploitation. Check whether an affected product and version are in your environment; use CISA and vendor guidance to determine remediation. CISA due dates are federal benchmarks, not universal obligations.{:else}No KEV entry is shown in this snapshot. Check product and version applicability against your inventory and review vendor guidance.{/if}
        {#if epssScore == null} EPSS is unavailable in this snapshot; this does not mean low risk.{:else if !kev && epssScore >= 0.1} Elevated EPSS is a probability signal, not confirmation of exposure or exploitation.{/if}
      </p>

      <p class="links">
        <a href="https://nvd.nist.gov/vuln/detail/{id}" target="_blank" rel="noopener noreferrer">NVD record {@render ext()}</a>
        <a href="https://www.cve.org/CVERecord?id={id}" target="_blank" rel="noopener noreferrer">CVE.org {@render ext()}</a>
        {#if kev}<a href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search_api_fulltext={id}" target="_blank" rel="noopener noreferrer">CISA KEV {@render ext()}</a>{/if}
      </p>

      <h3 class="kicker">Timeline</h3>
      <ol class="timeline">
        {#each steps as s (s.label)}
          <li class:red={s.red}><span class="d">{dateLong(s.date)}</span><span class="l">{s.label}</span>{#if s.note}<span class="n">{s.note}</span>{/if}</li>
        {/each}
      </ol>

    {/if}
  </div>
</dialog>

{#snippet ext()}<svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3h7v7M13 3L4 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>{/snippet}

<style>
  dialog {
    margin: 0 0 0 auto; height: 100dvh; max-height: 100dvh; width: min(520px, 100vw); max-width: 100vw; padding: 0; border: 0;
    background: var(--paper); color: var(--ink); border-left: 2px solid var(--rule-strong);
    transform: translateX(0); transition: transform 320ms var(--ease-out), opacity 200ms; box-shadow: -20px 0 50px rgb(0 0 0 / 0.18);
  }
  @starting-style { dialog[open] { transform: translateX(100%); } }
  dialog.closing { transform: translateX(100%); transition-duration: 220ms; transition-timing-function: cubic-bezier(0.75, 0, 0.8, 0.1); }
  dialog::backdrop { background: rgb(17 17 17 / 0.5); transition: opacity 300ms; }
  @starting-style { dialog[open]::backdrop { opacity: 0; } }
  dialog.closing::backdrop { opacity: 0; }
  .panel { padding: 1.5rem clamp(1.25rem, 4vw, 2rem) 2.5rem; overflow-y: auto; overscroll-behavior: contain; overflow-wrap: anywhere; height: 100%; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; border-bottom: 2px solid var(--rule-strong); padding-bottom: 1rem; }
  h2 { font: 800 clamp(1.9rem, 5vw, 2.6rem)/1 var(--display); letter-spacing: -0.05em; margin-top: 0.25rem; overflow-wrap: anywhere; }
  .x { background: var(--paper); border: 1px solid var(--line-strong); width: 2.75rem; height: 2.75rem; flex-shrink: 0; display: grid; place-items: center; cursor: pointer; color: var(--ink); transition: background-color 150ms, color 150ms; }
  .x:hover { background: var(--ink); color: var(--paper); border-color: var(--ink); }
  .links svg { vertical-align: -0.1em; }
  .x:active { transform: translateY(1px); }
  .chips { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 1rem 0; }
  .name { font: 700 1.25rem/1.25 var(--display); letter-spacing: -0.02em; margin: 0 0 0.6rem; }
  .desc { color: var(--ink-2); font-size: 0.9375rem; margin: 0 0 1.25rem; }
  .provenance { margin: -0.5rem 0 1rem; color: var(--ink-3); font-size: 0.8rem; }
  .triage { background: var(--shade); border-left: 3px solid var(--ink-2); padding: 0.75rem 0.9rem; margin: 0 0 1.25rem; font-size: 0.875rem; color: var(--ink-2); }
  .facts { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem 1.25rem; margin: 0 0 0.75rem; }
  .facts div { border-top: 1px solid var(--rule); padding-top: 0.5rem; }
  dt { font: 600 0.6875rem/1.3 var(--sans); letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-3); }
  dd { margin: 0.15rem 0 0; font-weight: 600; }
  .muted { color: var(--ink-3); font-weight: 400; font-size: 0.875rem; }
  .cwe { white-space: nowrap; }
  .meter { height: 6px; background: var(--shade); overflow: hidden; margin-bottom: 1.75rem; }
  .meter i { display: block; height: 100%; background: var(--ink); }
  h3.kicker { margin: 0.5rem 0 0.75rem; }
  .timeline { list-style: none; margin: 0; padding: 0 0 0 1.1rem; position: relative; }
  .timeline::before { content: ''; position: absolute; left: 0; top: 0.4rem; bottom: 1.2rem; width: 2px; background: var(--rule); } /* the rail */
  .timeline li { position: relative; padding: 0 0 1.1rem 0.6rem; display: grid; }
  .timeline li::before { content: ''; position: absolute; left: calc(-1.1rem - 4px); top: 0.35rem; width: 10px; height: 10px; background: var(--ink); outline: 2px solid var(--paper); }
  .timeline li.red::before { background: var(--kev); }
  .d { font-weight: 800; letter-spacing: -0.01em; }
  .l { color: var(--ink-2); }
  .n { font-size: 0.8rem; color: var(--ink-3); }
  .links { display: flex; gap: 0 1.25rem; flex-wrap: wrap; margin: 0 0 1.5rem; font-weight: 600; }
  .links a { display: inline-flex; align-items: center; gap: 0.3em; min-height: 2.75rem; }
  @media (prefers-reduced-motion: reduce) { dialog { transition: opacity 200ms; } @starting-style { dialog[open] { transform: none; opacity: 0; } } dialog.closing { transform: none; opacity: 0; } }
</style>
