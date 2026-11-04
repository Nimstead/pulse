<script lang="ts">
  import type { Snippet } from 'svelte'
  import { copyPng, downloadCsv } from '../lib/export'
  import { provenance } from '../lib/state.svelte'

  // period: false for a figure that ignores the shared period, so its export does not claim one
  let { n, title, sub = '', csv, name, period = true, legend, notes, children }: {
    n: number | string; title: string; sub?: string; name: string; period?: boolean
    csv?: () => Record<string, unknown>[]; legend?: Snippet; notes?: Snippet; children: Snippet
  } = $props()

  let node: HTMLElement
  let status = $state('')
  async function png() {
    status = '…'
    try { status = await copyPng(node, name, provenance(period)) } catch { status = 'Failed' }
    setTimeout(() => (status = ''), 1800)
  }
</script>

<figure bind:this={node}>
  <figcaption>
    <div class="head">
      <h3 class="cap"><span class="fig">Figure {n}.</span> <span class="title">{title}</span></h3>
      {#if sub}<p class="sub">{sub}</p>{/if}
    </div>
    <div class="actions" data-no-export>
      <button onclick={png} aria-label="Copy Figure {n} as PNG" title="Copy figure as PNG for slides">{status || 'Copy PNG'}</button>
      {#if csv}<button onclick={() => downloadCsv(csv(), name)} aria-label="Download Figure {n} data as CSV" title="Download the figure's data">CSV</button>{/if}
      <span class="sr-only" aria-live="polite">{status === 'Copied' ? `Figure ${n} copied` : status === 'Saved' ? `Figure ${n} saved as PNG` : status === 'Failed' ? 'Copy failed' : ''}</span>
    </div>
  </figcaption>
  {#if legend}<div class="legend">{@render legend()}</div>{/if}
  <div class="body">{@render children()}</div>
  {#if notes}<div class="notes">{@render notes()}</div>{/if}
</figure>

<style>
  figure { margin: 0; padding: 1rem 0 1.75rem; border-top: 2px solid var(--rule-strong); min-width: 0; }
  figcaption { display: flex; gap: 1rem; justify-content: space-between; align-items: baseline; }
  .head { font-size: 1.25rem; max-width: 60ch; } /* 60ch at the caption's size, as before */
  .cap { margin: 0; font: 700 1.25rem/1.25 var(--display); letter-spacing: -0.02em; text-wrap: wrap; }
  .fig { font-weight: 800; color: var(--ink-3); margin-right: 0.25em; }
  .sub { font: 400 0.875rem/1.45 var(--sans); letter-spacing: 0; color: var(--ink-3); margin: 0.3rem 0 0; }
  .actions { display: flex; gap: 0.25rem; flex-shrink: 0; }
  .actions button {
    background: var(--paper); border: 2px solid var(--ink); padding: 0.5rem 0.85rem; min-height: 2.75rem;
    font: 700 0.8125rem/1.1 var(--sans); color: var(--ink); cursor: pointer; min-width: 5rem;
    transition: background-color 150ms, color 150ms, border-color 150ms;
  }
  .actions button:hover { background: var(--ink); border-color: var(--ink); color: var(--paper); }
  .actions button:active { transform: translateY(1px); }
  .legend { display: flex; flex-wrap: wrap; gap: 0.35rem 1.25rem; margin-top: 0.75rem; font-size: 0.8125rem; color: var(--ink-2); }
  .body { margin-top: 0.85rem; position: relative; }
  .notes { margin-top: 0.9rem; font-size: 0.8125rem; line-height: 1.55; color: var(--ink-3); max-width: 70ch; text-wrap: pretty; }
  @media (max-width: 560px) {
    figcaption { flex-direction: column; gap: 0.5rem; }
  }
</style>
