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
  let ghost: [number, number] | null = $state(null)
</script>

<div class="period" class:compact>
  <div class="bar">
    <span class="kicker">Period · all sections</span>
    <span class="range"><b>{monthShort(months[ui.from].ym)}</b> – <b>{monthShort(months[ui.to].ym)}</b> <span class="n">· {span} months{active ? '' : ' · Custom'}</span></span>
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
  <Brush values={months.map((m) => m.n)} labels={months.map((m) => m.ym)} bind:from={ui.from} bind:to={ui.to} {ghost} height={compact ? 26 : 48} />
</div>

<style>
  .period { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.6rem; min-width: 0; }
  .bar { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.4rem 1rem; }
  .range { font-size: 0.9375rem; }
  .range b { font-weight: 800; letter-spacing: -0.01em; }
  .n { color: var(--ink-3); }
  .presets { margin-left: auto; display: inline-flex; border: 2px solid var(--ink); }
  .presets button { background: var(--paper); border: 0; border-left: 2px solid var(--ink); padding: 0.4rem 0.8rem; font: 700 0.75rem/1.2 var(--sans); color: var(--ink-2); cursor: pointer; transition: background-color 120ms, color 120ms; }
  .presets button:hover { color: var(--ink); background: var(--shade); }
  .presets button:first-child { border-left: 0; }
  .presets button:active { background: var(--shade); }
  .presets button[aria-pressed='true'] { background: var(--ink); color: var(--paper); }
</style>
