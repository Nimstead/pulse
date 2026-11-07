<script lang="ts">
  import { tick } from 'svelte'
  import { titleCase, num, type Kev, type Ranked } from '../lib/data'

  let { open = $bindable(), kev, vendors, oncve, onvendor }: {
    open: boolean; kev: Kev[]; vendors: Ranked[]; oncve: (id: string) => void; onvendor: (key: string) => void
  } = $props()

  let dlg: HTMLDialogElement
  let input: HTMLInputElement
  let q = $state('')
  let active = $state(0)

  $effect(() => {
    if (open && !dlg.open) { q = ''; active = 0; dlg.showModal(); input.focus() }
    if (!open && dlg.open) dlg.close()
  })

  type Hit = { kind: 'cve' | 'vendor'; key: string; title: string; sub: string }
  const hits = $derived.by((): Hit[] => {
    const s = q.trim().toLowerCase()
    if (!s) return kev.slice(0, 6).map((k) => ({ kind: 'cve', key: k.id, title: k.id, sub: `Latest KEV · ${k.vendor} ${k.product}` }))
    const out: Hit[] = []
    const idm = s.match(/^(?:cve-?)?(\d{4})-(\d{4,})$/)
    if (idm) out.push({ kind: 'cve', key: `CVE-${idm[1]}-${idm[2]}`, title: `CVE-${idm[1]}-${idm[2]}`, sub: 'Open case record' })
    // a vendor is the broader answer, so it leads; capped so KEV entries still show
    else
      for (const v of vendors.filter((v) => v.key.includes(s)).slice(0, 2))
        out.push({ kind: 'vendor', key: v.key, title: titleCase(v.key), sub: `Vendor · ${num(v.total)} CVEs, ${num(v.kev)} exploited` })
    for (const k of kev) {
      if (out.length >= 7) break
      if (idm ? k.id.toLowerCase().startsWith(`cve-${idm[1]}-${idm[2]}`) && k.id.toLowerCase() !== `cve-${idm[1]}-${idm[2]}`
        : `${k.id} ${k.vendor} ${k.product} ${k.name}`.toLowerCase().includes(s))
        out.push({ kind: 'cve', key: k.id, title: k.id, sub: `In KEV · ${k.name}` })
    }
    return out
  })

  async function choose(h: Hit | undefined) {
    if (!h) return
    open = false
    dlg.close()
    await tick() // release modal focus before selecting and focusing the destination
    h.kind === 'cve' ? oncve(h.key) : onvendor(h.key)
  }
  async function keys(e: KeyboardEvent) {
    if (!hits.length) return
    if (e.key === 'ArrowDown') { active = Math.min(hits.length - 1, active + 1); e.preventDefault() }
    else if (e.key === 'ArrowUp') { active = Math.max(0, active - 1); e.preventDefault() }
    else if (e.key === 'Enter') { choose(hits[active]); e.preventDefault(); return }
    else return
    await tick()
    document.getElementById(`hit-${active}`)?.scrollIntoView({ block: 'nearest' })
  }
</script>

<dialog bind:this={dlg} onclose={() => (open = false)} onclick={(e) => { if (e.target === dlg) open = false }} aria-label="Search">
  <div class="box">
    <div class="search-field">
      <input bind:this={input} bind:value={q} oninput={() => (active = 0)} onkeydown={keys} placeholder="CVE-2024-3400, Microsoft…" aria-describedby="search-scope"
        aria-label="Find a CVE or vendor" role="combobox" aria-expanded="true" aria-controls="search-hits" aria-activedescendant={hits.length ? `hit-${active}` : undefined} autocomplete="off" spellcheck="false" />
      <button class="close" onclick={() => (open = false)} aria-label="Close search"><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="square" /></svg></button>
    </div>
    <p id="search-scope" class="scope">Open any full CVE ID. Search names across KEV entries and tracked vendors.</p>
    <ul id="search-hits" role="listbox">
      {#each hits as h, i (h.kind + h.key)}
        <!-- svelte-ignore a11y_click_events_have_key_events (keys are handled on the combobox input) -->
        <li id="hit-{i}" role="option" aria-selected={i === active} class:active={i === active}
          onpointerdown={(e) => e.preventDefault()} onclick={() => choose(h)} onpointerenter={() => (active = i)}>
          <span class="t">{h.title}</span><span class="s">{h.sub}</span>
        </li>
      {:else}
        <li class="empty">No KEV entry or tracked vendor matches. Enter a full CVE ID to open any record.</li>
      {/each}
    </ul>
    <span class="sr-only" role="status">{hits.length ? `${hits.length} suggestions` : 'No matches. Try a full CVE ID.'}</span>
    <div class="foot"><kbd>↑</kbd><kbd>↓</kbd> to move · <kbd>Enter</kbd> to open · <kbd>Esc</kbd> to close</div>
  </div>
</dialog>

<style>
  dialog {
    margin: 12dvh auto auto; width: min(640px, calc(100vw - 32px)); max-height: calc(88dvh - 1rem); padding: 0; border: 2px solid var(--rule-strong);
    background: var(--paper); color: var(--ink); box-shadow: 0 30px 80px rgb(0 0 0 / 0.28);
    transform-origin: 50% 0; transition: transform 260ms var(--ease-out), opacity 180ms;
  }
  @starting-style { dialog[open] { transform: scale(0.96) translateY(-6px); opacity: 0; } }
  dialog::backdrop { background: rgb(17 17 17 / 0.5); }
  .box { display: flex; flex-direction: column; max-height: inherit; }
  .search-field { display: flex; align-items: center; flex-shrink: 0; border-bottom: 1px solid var(--rule); }
  input { width: 100%; min-width: 0; border: 0; background: transparent; padding: 1.15rem 1.2rem; font: 500 1.125rem var(--sans); color: var(--ink); outline: none; }
  input:focus-visible { box-shadow: inset 0 -2px var(--ink); }
  .close { display: grid; place-items: center; flex-shrink: 0; width: 2.75rem; height: 2.75rem; margin-right: 0.6rem; padding: 0; border: 1px solid var(--line-strong); background: var(--paper); color: var(--ink); cursor: pointer; transition: background-color 150ms, color 150ms; }
  .close:hover { background: var(--ink); border-color: var(--ink); color: var(--paper); }
  .close:active { transform: translateY(1px); }
  ul { list-style: none; margin: 0; padding: 0.35rem; min-height: 0; max-height: 50dvh; overflow-y: auto; overscroll-behavior: contain; }
  li { display: grid; padding: 0.6rem 0.8rem; cursor: pointer; }
  li.active { background: var(--ink); color: var(--paper); }
  li.active .s { color: color-mix(in srgb, var(--paper) 75%, var(--ink)); }
  .t { font-weight: 700; }
  .s { font-size: 0.8rem; color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .empty { color: var(--ink-3); cursor: default; }
  .scope { margin: 0; padding: 0.7rem 1.2rem 0.35rem; color: var(--ink-3); font-size: 0.8125rem; flex-shrink: 0; }
  .foot { border-top: 1px solid var(--rule); padding: 0.5rem 1.1rem; font-size: 0.75rem; color: var(--ink-3); flex-shrink: 0; }
  kbd { font: 500 0.6875rem var(--mono); border: 1px solid var(--rule); padding: 0 0.3rem; }
</style>
