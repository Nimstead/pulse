<script lang="ts">
  import Brush from './Brush.svelte'
  import { ui } from '../lib/state.svelte'
  import { monthShort, type Month } from '../lib/data'

  let { months, compact = false }: { months: Month[]; compact?: boolean } = $props()
  const presets = [['12M', 12], ['3Y', 36], ['5Y', 60], ['10Y', 120], ['All', 0]] as const
  const last = $derived(months.length - 1)
  const span = $derived(ui.to - ui.from + 1)
  // presets always mean "the latest n months"; anything else the brush makes is a custom range
  const target = (n: number): [number, number] => [n ? Math.max(0, last - n + 1) : 0, last]
  const active = $derived(presets.find(([, n]) => { const [f, t] = target(n); return ui.from === f && ui.to === t })?.[0])
  function preset(n: number) { [ui.from, ui.to] = target(n) }
  function setMonth(edge: 'from' | 'to', input: HTMLInputElement) {
    const index = months.findIndex((month) => month.ym === input.value)
    if (index < 0 || (edge === 'from' ? index > ui.to : index < ui.from)) {
      input.value = months[ui[edge]].ym
      return
    }
    ui[edge] = index
  }
  let ghost: [number, number] | null = $state(null)
</script>

<div class="period" class:compact>
  <div class="bar">
    <span class="kicker">Period · shared across tabs</span>
    <span class="range"><b>{monthShort(months[ui.from].ym)}</b> – <b>{monthShort(months[ui.to].ym)}</b> <span class="n">· {span} month{span === 1 ? '' : 's'}{active ? '' : ' · Custom'}</span></span>
    <span class="presets" role="group" aria-label="Quick periods">
      {#each presets as [l, n] (l)}
        {@const t = target(n)}
        <button onclick={() => preset(n)} aria-pressed={active === l}
          title="{monthShort(months[t[0]].ym)} – {monthShort(months[t[1]].ym)}"
          onpointerenter={() => (ghost = t)} onpointerleave={() => (ghost = null)}
          onfocus={() => (ghost = t)} onblur={() => (ghost = null)}>{l}</button>
      {/each}
    </span>
  </div>
  <details class="exact-period">
    <summary>Choose exact months</summary>
    <div class="month-fields">
      <label>Start month<input type="month" min={months[0].ym} max={months[ui.to].ym} value={months[ui.from].ym} onchange={(e) => setMonth('from', e.currentTarget)} /></label>
      <label>End month<input type="month" min={months[ui.from].ym} max={months[last].ym} value={months[ui.to].ym} onchange={(e) => setMonth('to', e.currentTarget)} /></label>
    </div>
  </details>
  <Brush values={months.map((m) => m.n)} labels={months.map((m) => m.ym)} bind:from={ui.from} bind:to={ui.to} {ghost} height={compact ? 26 : 48} />
</div>

<style>
  .exact-period summary { cursor: pointer; min-height: 2.75rem; align-content: center; font-size: 0.875rem; text-decoration: underline; text-underline-offset: 0.2em; }
  .month-fields { display: flex; flex-wrap: wrap; gap: 0.75rem 1rem; padding-bottom: 0.5rem; }
  .month-fields label { display: grid; gap: 0.35rem; flex: 1 1 12rem; min-width: 0; font-size: 0.875rem; }
  .month-fields input { width: 100%; min-width: 0; min-height: 2.75rem; padding: 0.5rem; border: 1px solid var(--rule-strong); background: var(--paper); color: var(--ink); font: inherit; }
  .period { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.6rem; min-width: 0; }
  .bar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem 1rem; }
  .range { font-size: 0.9375rem; }
  .range b { font-weight: 800; letter-spacing: -0.01em; }
  .n { color: var(--ink-3); }
  .presets { margin-left: auto; display: inline-flex; flex-wrap: wrap; gap: 2px; max-width: 100%; border: 2px solid var(--ink); background: var(--ink); }
  .presets button { background: var(--paper); border: 0; padding: 0.4rem 0.8rem; min-height: 2.75rem; font: 700 0.75rem/1.2 var(--sans); color: var(--ink-2); cursor: pointer; transition: background-color 120ms, color 120ms; }
  .presets button:hover { color: var(--ink); background: var(--shade); }
  .presets button:active { background: var(--shade); }
  .presets button[aria-pressed='true'] { background: var(--ink); color: var(--paper); }
  @media (max-width: 560px) {
    .bar { gap: 0.5rem; }
    .bar > .kicker { flex-basis: 100%; }
    .presets { width: 100%; margin-left: 0; }
    .presets button { flex: 1; }
  }
</style>
