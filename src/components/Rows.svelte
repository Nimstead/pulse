<script lang="ts">
  import { num, pct } from '../lib/data'

  type Row = { key: string; label: string; sub?: string; value: number; kev: number; spark?: number[] }
  let { rows, valueLabel = 'CVEs', kevLabel = 'Exploited', trendLabel = 'Trend', selected = '', onpick, controls, tone = 'ink', byKev = false, showRate = false }: {
    rows: Row[]; valueLabel?: string; kevLabel?: string; trendLabel?: string; selected?: string; onpick?: (key: string, event: MouseEvent) => void; controls?: string; byKev?: boolean; showRate?: boolean; tone?: 'ink' | 'red'
  } = $props()

  const max = $derived(Math.max(1, ...rows.map((r) => r.value)))
  const maxKev = $derived(Math.max(1, ...rows.map((r) => r.kev)))
  function spark(v: number[]) {
    const m = Math.max(1, ...v), w = 64, h = 18
    return v.map((x, i) => `${i ? 'L' : 'M'}${((i / Math.max(1, v.length - 1)) * w).toFixed(1)},${(h - (x / m) * h).toFixed(1)}`).join('')
  }
</script>

<div class="rows" class:red={tone === "red"} role="table" aria-label="Ranked list">
  <div class="head" role="row">
    <span role="columnheader">#</span><span role="columnheader">Name</span><span role="columnheader" class="r">{valueLabel}</span>
    <span role="columnheader" class="r">{kevLabel}</span><span role="columnheader" class="sp">{trendLabel}</span>
  </div>
  {#each rows as r, i (r.key)}
    <div class="row" class:pick={!!onpick} class:sel={selected === r.key} role="row" style:--d="{Math.min(i, 20) * 22}ms">
      <span class="rank" role="cell">{i + 1}</span>
      <span class="name" role="cell">
        {#if onpick}<button class="label" aria-pressed={selected === r.key} aria-controls={controls} onclick={(event) => onpick(r.key, event)}>{r.label}</button>{:else}<span class="label">{r.label}</span>{/if}{#if r.sub}<span class="sub">{r.sub}</span>{/if}
        <span class="bar" aria-hidden="true">{#if byKev}<b style:width="{(r.kev / maxKev) * 100}%"></b>{:else}<i style:width="{(r.value / max) * 100}%"></i><b style:width="{(r.kev / max) * 100}%"></b>{/if}</span>
      </span>
      <span class="r v" role="cell">{num(r.value)}</span>
      <span class="r k" role="cell" class:zero={!r.kev}>{num(r.kev)}{#if showRate && r.kev && r.value}<small>{pct(r.kev / r.value, 1)} of CVEs</small>{/if}</span>
      <span class="sp" role="cell">{#if r.spark}<svg width="64" height="18" aria-hidden="true"><path d={spark(r.spark)} /></svg>{/if}</span>
    </div>
  {/each}
</div>

<style>
  .rows { font-size: 0.875rem; container-type: inline-size; } /* columns follow the list's own width, so a narrow drill-down panel stays readable */
  .head, .row { display: grid; grid-template-columns: 2rem minmax(0, 1fr) 6.5rem 6.5rem 70px; gap: 0.75rem; align-items: center; }
  .head { font: 600 0.6875rem/1.2 var(--sans); letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-3); padding-bottom: 0.55rem; border-bottom: 2px solid var(--rule-strong); }
  .head span { overflow-wrap: anywhere; text-wrap: balance; }
  .row { width: 100%; text-align: left; background: none; border: 0; border-bottom: 1px solid var(--rule); padding: 0.6rem 0; animation: in 500ms var(--ease-out) both; animation-delay: var(--d); }
  .row.pick { position: relative; cursor: pointer; transition: background-color 120ms; }
  .row.pick:hover, .row.sel { background: var(--shade); }
  .row.pick:active { transform: scale(0.995); }
  /* the name is the button; its ::after stretches the hit area over the whole row, and the row shows the focus ring */
  button.label { background: none; border: 0; padding: 0; font: inherit; color: inherit; text-align: left; cursor: pointer; }
  button.label::after { content: ''; position: absolute; inset: 0; }
  button.label:focus-visible { outline: none; }
  .row.pick:has(:focus-visible) { outline: 2px solid var(--ink); outline-offset: -2px; }
  .row.sel .label { font-weight: 800; }
  .row.sel .rank { color: var(--ink); font-weight: 800; }
  .rank { color: var(--ink-3); font-size: 0.8125rem; text-align: right; }
  .name { min-width: 0; display: flex; flex-direction: column; gap: 0.2rem; }
  .label { font-weight: 600; line-height: 1.4; overflow-wrap: anywhere; }
  .sub { font-size: 0.75rem; color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar { position: relative; height: 4px; background: var(--shade); overflow: hidden; }
  .bar i, .bar b { position: absolute; left: 0; top: 0; bottom: 0; }
  .bar i { background: var(--vol); }
  .bar b { background: var(--kev); min-width: 0; }
  .red .bar i { background: var(--kev-soft); }
  .r { text-align: right; }
  .k { color: var(--kev); font-weight: 600; }
  .k small { display: block; font-size: 0.6875rem; font-weight: 400; color: var(--ink-3); }
  .k.zero { color: var(--ink-3); font-weight: 400; }
  .sp path { fill: none; stroke: var(--ink-2); stroke-width: 1.5; stroke-linejoin: round; }
  @keyframes in { from { opacity: 0; transform: translateY(4px); } }
  @container (max-width: 34rem) {
    .head, .row { grid-template-columns: 1.25rem minmax(0, 1fr) 4rem 4.5rem; gap: 0.5rem; }
    .head { align-items: end; }
    .sp { display: none; }
  }
  @container (max-width: 16rem) {
    .head, .row { grid-template-columns: 1.25rem minmax(0, 1fr) minmax(0, 1fr); }
    .head > :nth-child(2), .name { grid-column: 2 / -1; }
    .head > :nth-child(3), .v { grid-column: 2; }
    .head > :nth-child(4), .k { grid-column: 3; }
  }
</style>
