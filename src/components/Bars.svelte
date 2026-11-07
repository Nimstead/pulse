<script lang="ts">
  import { untrack } from 'svelte'
  import { Spring, prefersReducedMotion } from 'svelte/motion'
  import { scaleLinear } from 'd3-scale'
  import { chartKeyIndex } from '../lib/chart-key'
  import { num } from '../lib/data'

  type Series = { key: string; label: string; color: string; values: number[] }
  // the lightest ramp steps fall under 3:1 on Paper, so they carry a Line Strong edge
  const LIGHT = ['var(--sev-l)', 'var(--sev-u)', 'var(--shade)']
  let {
    labels, series, label, height = 260, stacked = true, normalize = false, hatchLast = false,
    tick = (_l: string, _i: number) => null as string | null, format = num,
    tipTitle = (l: string) => l, axis, empty = '', cap = false, shade, mark,
  }: {
    labels: string[]; series: Series[]; label: string; height?: number; stacked?: boolean; normalize?: boolean
    hatchLast?: boolean; tick?: (l: string, i: number) => string | null; format?: (v: number) => string
    tipTitle?: (l: string, i: number) => string; axis?: (t: number) => string; empty?: string; cap?: boolean; shade?: { from: string; to: string; label: string }; mark?: { index: number; label: string }
  } = $props()

  let width = $state(600)
  let hover = $state(-1)
  const ml = 48, mr = 4, mt = 10, mb = 26
  const uid = Math.random().toString(36).slice(2, 8)
  const instructionsId = $props.id()

  const totals = $derived(labels.map((_, i) => series.reduce((a, s) => a + (s.values[i] || 0), 0)))
  const value = (s: Series, i: number) => (normalize ? (totals[i] ? (s.values[i] || 0) / totals[i] : 0) : s.values[i] || 0)
  const rawMax = $derived(normalize ? 1 : Math.max(1, ...labels.map((_, i) => (stacked ? totals[i] : Math.max(...series.map((s) => s.values[i] || 0))))))
  // cap at 1.4x the 90th percentile: outliers are drawn cut, with a break and their value, so the rest stays readable
  const capAt = $derived.by(() => {
    const v = totals.filter((t) => t > 0).sort((a, b) => a - b)
    return cap && stacked && !normalize && v.length >= 8 ? Math.max(1, v[Math.floor(v.length * 0.9)] * 1.4) : Infinity
  })
  const max = $derived(Math.min(rawMax, capAt))
  const span = $derived.by(() => {
    if (!shade) return null
    const a = labels.findIndex((l) => l >= shade.from), b = labels.findLastIndex((l) => l <= shade.to)
    return a >= 0 && b >= a ? { a, b } : null
  })
  // critically damped: the axis glides to a new range and never overshoots
  const yMax = new Spring(untrack(() => max), { stiffness: 0.14, damping: 0.95 })
  $effect(() => { yMax.set(max, { instant: prefersReducedMotion.current }) })

  const iw = $derived(Math.max(10, width - ml - mr))
  const ih = $derived(height - mt - mb)
  const bw = $derived(iw / Math.max(1, labels.length))
  const gap = $derived(bw > 6 ? Math.min(bw * 0.22, 6) : 0)
  const y = $derived(scaleLinear().domain([0, Math.max(yMax.current, 1e-9)]).range([ih, 0]).clamp(true))
  const ticks = $derived(scaleLinear().domain([0, max]).nice().ticks(Math.max(1, Math.min(4, Math.floor(ih / 26)))).filter((t) => t <= yMax.current * 1.001 && (normalize || axis || Number.isInteger(t))))
  const isEmpty = $derived(!!empty && totals.every((t) => !t))
  // Thin labels by their rendered width, including on dense charts; pin edge labels inside the plot.
  const shown = $derived.by(() => {
    const out = new Map<number, 'start' | 'middle' | 'end'>()
    let lastRight = -Infinity
    labels.forEach((l, i) => {
      const t = tick(l, i)
      if (!t) return
      const textWidth = t.length * 6.6
      let anchor: 'start' | 'middle' | 'end' = bw > 24 ? 'middle' : 'start'
      let x = i * bw + (anchor === 'middle' ? bw / 2 : 0)
      let left = x - (anchor === 'middle' ? textWidth / 2 : 0)
      let right = left + textWidth
      if (left < 0) { anchor = 'start'; x = 0; left = 0; right = textWidth }
      if (right > iw) { anchor = 'end'; x = iw; left = iw - textWidth; right = iw }
      if (left < 0 || left - lastRight < 10) return
      out.set(i, anchor)
      lastRight = right
    })
    return out
  })
  const fmtAxis = (t: number) => axis ? axis(t) : (normalize ? `${Math.round(t * 100)}%` : t >= 1000 ? `${t / 1000}k` : String(t))

  function rects(i: number) {
    let base = 0
    return series.map((s, k) => {
      const v = value(s, i)
      if (stacked) {
        const r = { s, x: ml + i * bw + gap / 2, w: Math.max(0.5, bw - gap), y0: base, v }
        base += v
        return r
      }
      const w = (bw - gap) / series.length
      return { s, x: ml + i * bw + gap / 2 + k * w, w: Math.max(0.5, w - 1), y0: 0, v }
    })
  }

  function move(e: PointerEvent) {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect()
    const i = Math.floor((e.clientX - r.left - ml) / bw)
    hover = i >= 0 && i < labels.length ? i : -1
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'Escape') { hover = -1; e.preventDefault(); return }
    const next = chartKeyIndex(hover, labels.length, e.key)
    if (next == null) return
    hover = next
    e.preventDefault()
  }
  const shownValue = (s: Series, i: number) => (normalize ? `${Math.round(value(s, i) * 100)}%` : format(s.values[i] || 0))
  // one live region that always exists, so a screen reader hears each step; the drawn tip is hidden from it
  const tipText = $derived(hover < 0 || isEmpty ? '' : `${tipTitle(labels[hover], hover)}: ${series.map((s) => `${s.label} ${shownValue(s, hover)}`).join(', ')}${stacked && series.length > 1 && !normalize ? `, total ${format(totals[hover])}` : ''}`)
  const tipLeft = $derived(hover < 0 ? 0 : Math.min(Math.max(ml + hover * bw + bw / 2, 90), width - 90))
</script>

<div class="bars" bind:clientWidth={width} style:height="{height}px">
  <!-- a focusable chart: arrow keys step through the data and the tooltip is announced -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <svg
    {width} {height} role="img" aria-label={label} aria-describedby={instructionsId} tabindex="0"
    onpointermove={move} onpointerleave={() => (hover = -1)} onkeydown={key} onblur={() => (hover = -1)}
  >
    <defs>
      <pattern id="hatch-{uid}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="5" height="5" fill="var(--paper)" /><line x1="0" y1="0" x2="0" y2="5" stroke="var(--ink-3)" stroke-width="1.5" />
      </pattern>
    </defs>
    <g transform="translate(0,{mt})">
      {#each ticks as t (t)}
        <line x1={ml} x2={width - mr} y1={y(t)} y2={y(t)} class:base={t === 0} class="grid" />
        <text x={ml - 8} y={y(t)} dy="0.32em" text-anchor="end" class="axis">{fmtAxis(t)}</text>
      {/each}
      {#if span}
        <rect class="span" x={ml + span.a * bw} width={(span.b - span.a + 1) * bw} y={0} height={ih} />
      {/if}
      {#if hover >= 0}
        <rect class="hover" x={ml + hover * bw} width={bw} y={0} height={ih} />
      {/if}
      <g class="plot">
        {#each labels as l, i (l)}
          {@const last = hatchLast && i === labels.length - 1}
          {#each rects(i) as r (r.s.key)}
            {#if r.v > 0}
              <rect
                x={r.x} width={r.w} y={y(r.y0 + r.v)} height={Math.max(0, y(r.y0) - y(r.y0 + r.v))}
                fill={last ? `url(#hatch-${uid})` : r.s.color}
                stroke={last ? r.s.color : LIGHT.includes(r.s.color) ? 'var(--line-strong)' : 'none'} stroke-width={LIGHT.includes(r.s.color) ? 0.75 : 1}
                opacity={hover >= 0 && hover !== i ? 0.55 : 1}
              />
            {/if}
          {/each}
        {/each}
      </g>
      {#if mark && mark.index >= 0 && mark.index < labels.length}
        {@const near = mark.index > labels.length * 0.75}
        <text class="mark-l" x={ml + mark.index * bw + (near ? bw : 0)} y={y(totals[mark.index]) - 6} text-anchor={near ? 'end' : 'start'}>{mark.label}</text>
      {/if}
      {#each labels as l, i (l)}
        {#if totals[i] > capAt}
          <rect x={ml + i * bw + gap / 2 - 1} y={7} width={Math.max(0.5, bw - gap) + 2} height={2.5} class="break" />
          <!-- on narrow bars only the tallest is labelled, so neighbouring values never overprint -->
          {#if bw >= 16 || totals[i] === Math.max(...totals)}<text x={ml + i * bw + bw / 2} y={-2} text-anchor="middle" class="clip">{format(totals[i])}</text>{/if}
        {/if}
      {/each}
      {#each labels as l, i (l)}
        {@const anchor = shown.get(i)}
        {@const t = anchor ? tick(l, i) : null}
        {#if t}
          {@const cx = anchor === 'end' ? width - mr : ml + i * bw + (anchor === 'middle' ? bw / 2 : 0)}
          <line x1={ml + i * bw + bw / 2} x2={ml + i * bw + bw / 2} y1={ih} y2={ih + 4} class="grid base" />
          <text x={cx} y={ih + 17} class="axis" text-anchor={anchor}>{t}</text>
        {/if}
      {/each}
    </g>
  </svg>
  <p class="sr-only" id={instructionsId}>Use Left and Right Arrow to step through the data, Home and End to jump to the first and last value. Escape clears the selected value.</p>
  {#if isEmpty}<p class="empty">{empty}</p>{/if}
  {#if hover >= 0 && !isEmpty}
    <div class="tip" style:left="{tipLeft}px" data-no-export aria-hidden="true">
      <div class="t">{tipTitle(labels[hover], hover)}</div>
      {#each series as s (s.key)}
        <div class="row"><span class="swatch" style:background={s.color}></span>{s.label}<b>{shownValue(s, hover)}</b></div>
      {/each}
      {#if stacked && series.length > 1 && !normalize}<div class="row total">Total<b>{format(totals[hover])}</b></div>{/if}
    </div>
  {/if}
  <p class="sr-only" aria-live="polite" data-no-export>{tipText}</p>
</div>

<style>
  .bars { position: relative; width: 100%; }
  .empty { position: absolute; inset: 0 0 26px 48px; display: grid; place-items: center; margin: 0; text-align: center; font-size: 0.875rem; color: var(--ink-3); padding: 0 1rem; }
  svg { display: block; overflow: visible; touch-action: pan-y; }
  svg:focus-visible { outline-offset: 4px; }
  .grid { stroke: var(--rule); stroke-width: 1; }
  .grid.base { stroke: var(--rule-strong); }
  .axis { fill: var(--ink-3); font: 400 11px var(--sans); font-variant-numeric: tabular-nums; }
  .hover { fill: var(--shade); }
  .break { fill: var(--paper); }
  .mark-l { fill: var(--ink); font: 800 11.5px var(--sans); font-variant-numeric: tabular-nums; }
  .span { fill: var(--shade); }
  .clip { fill: var(--ink); font: 700 10.5px var(--sans); font-variant-numeric: tabular-nums; }
  .plot { animation: grow 700ms var(--ease-out) both; transform-origin: 0 100%; transform-box: fill-box; }
  @keyframes grow { from { transform: scaleY(0); } }
  .tip {
    position: absolute; top: -6px; transform: translate(-50%, -100%); pointer-events: none; z-index: 5;
    background: var(--paper); border: 1px solid var(--rule-strong); border-top-width: 2px; padding: 0.55rem 0.7rem;
    font-size: 0.8125rem; line-height: 1.5; min-width: 170px; box-shadow: 0 10px 28px rgb(0 0 0 / 0.14);
  }
  .tip .t { font-weight: 800; letter-spacing: -0.01em; margin-bottom: 0.15rem; }
  .tip .row { display: flex; align-items: center; gap: 0.4rem; }
  .tip .row b { margin-left: auto; padding-left: 1rem; font-weight: 600; }
  .tip .total { border-top: 1px solid var(--rule); margin-top: 0.2rem; padding-top: 0.2rem; }
</style>
