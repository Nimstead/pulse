<script lang="ts">
  import { scaleLinear } from 'd3-scale'
  import { line } from 'd3-shape'
  import { num } from '../lib/data'

  type L = { key: string; label: string; values: (number | null)[]; tone: 'focus' | 'prior' | 'faint'; color?: string }
  let { labels, lines, label, height = 280 }: {
    labels: string[]; lines: L[]; label: string; height?: number
  } = $props()

  let width = $state(600)
  let hover = $state(-1)
  const ml = 48, mr = 64, mt = 12, mb = 26
  const iw = $derived(Math.max(10, width - ml - mr))
  const ih = $derived(height - mt - mb)
  const x = $derived(scaleLinear().domain([0, Math.max(1, labels.length - 1)]).range([ml, ml + iw]))
  const max = $derived(Math.max(1, ...lines.flatMap((l) => l.values.filter((v): v is number => v != null))))
  const y = $derived(scaleLinear().domain([0, max]).nice().range([mt + ih, mt]))
  const path = $derived(line<number | null>().defined((v) => v != null).x((_, i) => x(i)).y((v) => y(v as number)))
  const order = $derived([...lines].sort((a, b) => ['faint', 'prior', 'focus'].indexOf(a.tone) - ['faint', 'prior', 'focus'].indexOf(b.tone)))
  const lastIdx = (l: L) => l.values.findLastIndex((v) => v != null)
  // end labels for the lines that matter, nudged apart so they never collide
  const ends = $derived.by(() => {
    const out = lines.filter((l) => l.tone !== 'faint' && lastIdx(l) >= 0).map((l) => ({ l, i: lastIdx(l), y: y(l.values[lastIdx(l)] as number) }))
    out.sort((a, b) => a.y - b.y)
    for (let k = 1; k < out.length; k++) if (out[k].y - out[k - 1].y < 14) out[k].y = out[k - 1].y + 14
    return out
  })
  const fmtAxis = (t: number) => (t >= 1000 ? `${t / 1000}k` : String(t))
  function move(e: PointerEvent) {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect()
    const i = Math.round(x.invert(e.clientX - r.left))
    hover = i >= 0 && i < labels.length ? i : -1
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') hover = Math.min(labels.length - 1, (hover < 0 ? labels.length - 2 : hover) + 1)
    else if (e.key === 'ArrowLeft') hover = Math.max(0, (hover < 0 ? labels.length : hover) - 1)
    else return
    e.preventDefault()
  }
  const tipLeft = $derived(hover < 0 ? 0 : Math.min(Math.max(x(hover), 90), width - 90))
  const tipLines = $derived(lines.filter((l) => l.tone !== 'faint' && hover >= 0 && l.values[hover] != null))
  // one live region that always exists, so a screen reader hears each step; the drawn tip is hidden from it
  const tipText = $derived(tipLines.length ? `${labels[hover]}: ${tipLines.map((l) => `${l.label} ${num(l.values[hover] as number)}`).join(', ')}` : '')
</script>

<div class="lines" bind:clientWidth={width} style:height="{height}px">
  <!-- a focusable chart: arrow keys step through the data and the tooltip is announced -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <svg {width} {height} role="img" aria-label={label} tabindex="0" onpointermove={move} onpointerleave={() => (hover = -1)} onkeydown={key} onblur={() => (hover = -1)}>
    {#each y.ticks(4) as t (t)}
      <line x1={ml} x2={ml + iw} y1={y(t)} y2={y(t)} class="grid" class:base={t === 0} />
      <text x={ml - 8} y={y(t)} dy="0.32em" text-anchor="end" class="axis">{fmtAxis(t)}</text>
    {/each}
    {#each labels as l, i (i)}
      {#if i % Math.ceil(labels.length / Math.max(2, Math.floor(iw / Math.max(34, Math.max(...labels.map((l) => l.length)) * 6.4 + 12)))) === 0}
        <text x={x(i)} y={mt + ih + 17} text-anchor="middle" class="axis">{l}</text>
      {/if}
    {/each}
    {#if hover >= 0}<line class="cross" x1={x(hover)} x2={x(hover)} y1={mt} y2={mt + ih} />{/if}
    {#each order as l (l.key)}
      <path d={path(l.values)} class="ln {l.tone}" style:stroke={l.color} />
      {#if l.tone === 'focus' && lastIdx(l) >= 0}
        <rect x={x(lastIdx(l)) - 4} y={y(l.values[lastIdx(l)] as number) - 4} width="8" height="8" class="dot" style:fill={l.color} />
      {/if}
    {/each}
    {#each ends as e (e.l.key)}
      <text x={x(e.i) + 8} y={e.y} dy="0.32em" class="end {e.l.tone}" style:fill={e.l.color}>{e.l.label}</text>
    {/each}
  </svg>
  {#if hover >= 0 && tipLines.length}
    <div class="tip" style:left="{tipLeft}px" data-no-export aria-hidden="true">
      <div class="t">{labels[hover]}</div>
      {#each tipLines as l (l.key)}<div class="row"><span>{l.label}</span><b>{num(l.values[hover] as number)}</b></div>{/each}
    </div>
  {/if}
  <p class="sr-only" aria-live="polite" data-no-export>{tipText}</p>
</div>

<style>
  .lines { position: relative; width: 100%; }
  svg { display: block; overflow: visible; touch-action: pan-y; }
  .grid { stroke: var(--rule); }
  .grid.base { stroke: var(--rule-strong); }
  .axis { fill: var(--ink-3); font: 400 11px var(--sans); font-variant-numeric: tabular-nums; }
  .cross { stroke: var(--ink-3); stroke-dasharray: 2 3; }
  .ln { fill: none; stroke-linejoin: round; stroke-linecap: square; }
  .ln.focus { stroke: var(--vol); stroke-width: 2.75; stroke-dasharray: 3000; animation: draw 1.1s var(--ease-out) both; }
  .ln.prior { stroke: var(--line-strong); stroke-width: 1.5; }
  .ln.faint { stroke: var(--rule); stroke-width: 1; }
  .dot { fill: var(--vol); stroke: var(--paper); stroke-width: 2; }
  .end { font: 600 11.5px var(--sans); fill: var(--ink-3); }
  .end.focus { fill: var(--ink); font-weight: 800; }
  @keyframes draw { from { stroke-dashoffset: 3000; } to { stroke-dashoffset: 0; } }
  .tip {
    position: absolute; top: -6px; transform: translate(-50%, -100%); pointer-events: none; z-index: 5;
    background: var(--paper); border: 1px solid var(--rule-strong); border-top-width: 2px; padding: 0.55rem 0.7rem;
    font-size: 0.8125rem; line-height: 1.5; min-width: 150px; box-shadow: 0 10px 28px rgb(0 0 0 / 0.14);
  }
  .tip .t { font-weight: 800; letter-spacing: -0.01em; }
  .tip .row { display: flex; justify-content: space-between; gap: 1rem; }
</style>
