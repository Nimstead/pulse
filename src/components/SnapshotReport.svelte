<script lang="ts">
  import { compareSnapshots, handover, type Snapshot } from '../lib/snapshot'
  import { download } from '../lib/export'
  import { dateShort, num } from '../lib/data'

  let { snapshot, baseline, includeDeadlines, openCve }: {
    snapshot: Snapshot; baseline: Snapshot | null; includeDeadlines: boolean; openCve: (id: string) => void
  } = $props()
  let status = $state('')
  let shown = $state(50)
  const comparison = $derived.by(() => {
    if (!baseline) return { changes: [], error: '' }
    try { return { changes: compareSnapshots(baseline, snapshot, includeDeadlines), error: '' } }
    catch (e) { return { changes: [], error: (e as Error).message } }
  })
  const text = $derived(handover(snapshot, baseline, includeDeadlines))
  const date = $derived(snapshot.generated.slice(0, 10))
  const modelChanged = $derived(baseline && baseline.sources.epssModel !== snapshot.sources.epssModel)
  const counts = $derived({ changed: comparison.changes.filter(c => c.kind === 'changed').length, added: comparison.changes.filter(c => c.kind === 'added').length, removed: comparison.changes.filter(c => c.kind === 'removed').length })

  function saveSnapshot() {
    try {
      download(new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }), `pulse-snapshot-${date}.json`)
      status = 'Snapshot download started. Keep the file private; it contains your CVE list.'
    } catch { status = 'Snapshot download failed. Try again in this browser.' }
  }
  function saveHandover() {
    try {
      download(new Blob([text], { type: 'text/plain;charset=utf-8' }), `pulse-handover-${date}.txt`)
      status = 'Handover download started. Share it only with intended recipients.'
    } catch { status = 'Handover download failed. Try copying the text instead.' }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(text); status = 'Handover copied. It contains your CVE list.' }
    catch { status = 'Could not copy. Download the handover as text instead.' }
  }
</script>

<section class="snapshot-report" aria-labelledby="snapshot-heading">
  <div class="report-head">
    <h3 id="snapshot-heading">Save or hand over this analysis</h3>
    <div class="actions">
      <button class="btn" onclick={saveSnapshot}>Download snapshot</button>
      <button class="btn" onclick={copy}>Copy handover</button>
      <button class="btn" onclick={saveHandover}>Download handover</button>
    </div>
  </div>
  <p class="private-note">Files and clipboard copies contain your CVE list. Keep them private.</p>
  <details class="report-details">
    <summary>{baseline ? 'Compare with the saved snapshot' : 'Snapshot details and handover preview'}</summary>
    <p>Save this analysis as a dated JSON file. Reload it on your next visit to refresh the signals and see what changed. Federal due dates are {includeDeadlines ? 'included' : 'excluded'}.</p>
    <p class="sources">Current public data: {dateShort(date)} · NVD through {dateShort(snapshot.sources.nvd.slice(0, 10))} · KEV {snapshot.sources.kev} · EPSS {snapshot.sources.epss ? dateShort(snapshot.sources.epss) : 'date unavailable'}</p>
    {#if baseline}
      <p class="comparison-basis">Compared with public data from <b>{dateShort(baseline.generated.slice(0, 10))}</b>. The file’s observations are user-supplied and have not been authenticated.</p>
      {#if comparison.error}<p class="notice" role="alert">{comparison.error} You can still use the current analysis and handover.</p>
      {:else}
        <p class="change-summary" role="status"><b>{num(counts.changed)}</b> with changed signals · <b>{num(counts.added)}</b> added to the list · <b>{num(counts.removed)}</b> removed from the list</p>
        {#if baseline.generated.slice(0, 10) === date}<p class="notice">Both snapshots use public data from the same day. A new analysis may show no changes until the feeds refresh.</p>{/if}
        {#if modelChanged}<p class="notice">The EPSS model changed or is unknown. Score changes may reflect the model as well as new evidence.</p>{/if}
        {#if includeDeadlines && !baseline.deadlinesIncluded}<p class="notice">The baseline excluded federal due dates, so changes to those dates cannot be compared.</p>{/if}
        {#if comparison.changes.length}
          <ul class="changes">
            {#each comparison.changes.slice(0, shown) as change (change.id)}
              <li>
                <div><span class="kind">{change.kind === 'changed' ? 'Signal changed' : change.kind === 'added' ? 'Added to list' : 'Removed from list'}</span>
                  {#if change.kind === 'removed'}<b>{change.id}</b>{:else}<button class="linklike" onclick={() => openCve(change.id)}>{change.id}</button>{/if}
                </div>
                <p>{change.notes.join(' · ')}</p>
              </li>
            {/each}
          </ul>
          {#if comparison.changes.length > shown}<button class="btn" onclick={() => shown += 50}>Show 50 more changes ({num(comparison.changes.length - shown)} remaining)</button>{/if}
        {:else}<p class="notice">No observed changes in the compared fields. This does not establish that your assets are safe or remediated.</p>{/if}
      {/if}
    {:else}<p class="notice">No previous snapshot loaded. The handover covers your current list; changes over time will appear after you load a snapshot.</p>{/if}
    <div class="handover-head">
      <div><h3>Your team handover</h3><p>Includes the full analysed list, priorities, source dates{baseline ? ' and comparison' : ''}. Verify asset and version applicability before acting.</p></div>
    </div>
    <details>
      <summary>Preview handover text</summary>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex (a scroll region must be focusable to scroll by keyboard) -->
      <div class="handover-text" tabindex="0" role="region" aria-label="Personalised handover text"><pre>{text}</pre></div>
    </details>
    <p class="private-note">Created here, without an account or upload. Downloads and clipboard copies contain your CVE list. Store and share them carefully.</p>
  </details>
  {#if status}<p class="status" role="status">{status}</p>{/if}
</section>

<style>
  .snapshot-report { border-top: 1px solid var(--rule); padding-top: 0.8rem; margin-bottom: 1.25rem; }
  .report-head, .handover-head { display: flex; align-items: start; justify-content: space-between; flex-wrap: wrap; gap: 0.8rem 1.5rem; }
  .handover-head > div:first-child { flex: 1 1 22rem; }
  .report-head { align-items: center; }
  .report-head h3 { font-size: 1rem; }
  h3 { font: 700 clamp(1.25rem, 2vw, 1.5rem)/1.25 var(--display); letter-spacing: -0.02em; margin: 0; }
  p { max-width: 72ch; margin: 0.45rem 0 0; color: var(--ink-2); font-size: 0.9375rem; }
  .sources, .comparison-basis, .private-note { font-size: 0.8125rem; margin-top: 0.8rem; }
  .change-summary { font-size: 1.0625rem; margin-top: 1rem; color: var(--ink); }
  .notice { margin-top: 0.8rem; }
  .changes { list-style: none; padding: 0; margin: 1rem 0; }
  .changes li { display: grid; grid-template-columns: minmax(11rem, 0.35fr) minmax(0, 1fr); gap: 0.35rem 1.5rem; border-top: 1px solid var(--rule); padding: 0.7rem 0; }
  .changes li > div { display: grid; align-content: start; justify-items: start; }
  .changes p { margin: 0; overflow-wrap: anywhere; }
  .kind { color: var(--ink-2); font-size: 0.8125rem; }
  .changes button, .changes b { font-size: 0.9375rem; overflow-wrap: anywhere; }
  .changes button { min-height: 2.75rem; text-align: left; }
  .handover-head { margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--rule); }
  .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .btn { display: inline-flex; align-items: center; justify-content: center; min-height: 2.75rem; padding: 0.5rem 1rem; border: 2px solid var(--rule-strong); background: var(--paper); color: var(--ink); font: 700 0.875rem var(--sans); cursor: pointer; }
  .btn:hover { background: var(--ink); color: var(--paper); }
  details { margin-top: 0.75rem; }
  summary { cursor: pointer; padding: 0.75rem 0; font-size: 0.9375rem; font-weight: 600; }
  .handover-text { padding: 1rem; background: var(--shade); border: 1px solid var(--rule); max-height: 24rem; overflow: auto; }
  pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font: 400 0.8125rem/1.6 var(--mono); }
  .status { min-height: 1.5em; font-size: 0.875rem; }
  @media (max-width: 560px) { .changes li { grid-template-columns: minmax(0, 1fr); } .handover-head > div:first-child { flex-basis: 100%; } }
</style>
