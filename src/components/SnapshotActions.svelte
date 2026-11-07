<script lang="ts">
  import { handover, type Snapshot } from '../lib/snapshot'
  import { download } from '../lib/export'

  let { snapshot, baseline, includeDeadlines }: {
    snapshot: Snapshot; baseline: Snapshot | null; includeDeadlines: boolean
  } = $props()
  let status = $state('')
  const date = $derived(snapshot.generated.slice(0, 10))
  const text = $derived(handover(snapshot, baseline, includeDeadlines))

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

<section class="snapshot-actions" aria-label="Save or hand over this analysis">
  <div class="actions">
    <button class="btn" onclick={saveSnapshot}>Download snapshot</button>
    <button class="btn" onclick={copy}>Copy handover</button>
    <button class="btn" onclick={saveHandover}>Download handover</button>
  </div>
  <p>Files and clipboard copies contain your CVE list. Keep them private.</p>
  {#if status}<p role="status">{status}</p>{/if}
</section>

<style>
  .snapshot-actions { margin: 0 0 1.5rem; }
  .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .btn { display: inline-flex; align-items: center; justify-content: center; min-height: 2.75rem; padding: 0.5rem 1rem; border: 2px solid var(--rule-strong); background: var(--paper); color: var(--ink); font: 700 0.875rem var(--sans); cursor: pointer; }
  .btn:hover { background: var(--ink); color: var(--paper); }
  p { margin: 0.5rem 0 0; font-size: 0.8125rem; color: var(--ink-2); }
</style>
