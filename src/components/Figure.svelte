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
  let dataOpen = $state(false)
  let page = $state(0)
  const pageSize = 50
  const dataRows = $derived(dataOpen && csv ? csv() : [])
  const pageCount = $derived(Math.max(1, Math.ceil(dataRows.length / pageSize)))
  const currentPage = $derived(Math.min(page, pageCount - 1))
  const pageRows = $derived(dataRows.slice(currentPage * pageSize, (currentPage + 1) * pageSize))
  const dataId = $props.id()
  $effect(() => { dataRows; page = 0 })
  const cellText = (value: unknown) => value == null ? '' : typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? String(value) : JSON.stringify(value)
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
  {#if csv}
    <div class="data-disclosure" data-no-export>
      <button class="data-toggle" aria-expanded={dataOpen} aria-controls={dataId} onclick={() => (dataOpen = !dataOpen)}>{dataOpen ? 'Hide data' : 'View data'}</button>
      <div id={dataId} hidden={!dataOpen}>
        {#if dataOpen}
        <p class="data-count">{#if dataRows.length}Rows {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, dataRows.length)} of {dataRows.length} · Page {currentPage + 1} of {pageCount}{:else}No rows for this figure.{/if}</p>
        {#if dataRows.length}
          <!-- svelte-ignore a11y_no_noninteractive_tabindex (the region must receive focus for keyboard scrolling) -->
          <div class="data-scroll" tabindex="0" role="region" aria-label="Figure {n} data table, scrolls sideways">
            <table>
              <thead><tr>{#each Object.keys(dataRows[0]) as key (key)}<th scope="col">{key.replaceAll('_', ' ')}</th>{/each}</tr></thead>
              <tbody>{#each pageRows as row, i (i)}<tr>{#each Object.keys(dataRows[0]) as key (key)}<td>{cellText(row[key])}</td>{/each}</tr>{/each}</tbody>
            </table>
          </div>
          {#if pageCount > 1}<div class="data-pages"><button class="data-more" disabled={currentPage === 0} onclick={() => (page = currentPage - 1)}>Previous page</button><button class="data-more" disabled={currentPage >= pageCount - 1} onclick={() => (page = currentPage + 1)}>Next page</button></div>{/if}
        {/if}
        {/if}
      </div>
    </div>
  {/if}
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
  .data-disclosure { margin-top: 0.8rem; }
  .data-toggle, .data-more { min-height: 2.75rem; border: 1px solid var(--line-strong); background: var(--paper); color: var(--ink); padding: 0.45rem 0.75rem; font: 600 0.8125rem/1.2 var(--sans); cursor: pointer; }
  .data-toggle:hover, .data-more:hover { background: var(--shade); }
  .data-more:disabled { color: var(--ink-3); cursor: default; }
  .data-pages { display: flex; gap: 0.5rem; margin-top: 0.6rem; }
  .data-count { margin: 0.6rem 0; color: var(--ink-3); font-size: 0.8125rem; }
  .data-scroll { max-width: 100%; max-height: 24rem; overflow: auto; border-top: 2px solid var(--rule-strong); }
  .data-scroll:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
  th { position: sticky; top: 0; background: var(--paper); text-align: left; font-size: 0.6875rem; letter-spacing: 0.06em; color: var(--ink-3); white-space: nowrap; }
  th, td { padding: 0.5rem 0.75rem 0.5rem 0; border-bottom: 1px solid var(--rule); vertical-align: top; }
  td { overflow-wrap: anywhere; }
  @media (max-width: 560px) {
    figcaption { flex-direction: column; gap: 0.5rem; }
  }
</style>
