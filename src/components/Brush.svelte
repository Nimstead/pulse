<script lang="ts">
  import { Spring } from 'svelte/motion'
  import { monthShort } from '../lib/data'

  let { values, labels, from = $bindable(), to = $bindable(), height = 52, ghost = null }: {
    values: number[]; labels: string[]; from: number; to: number; height?: number; ghost?: [number, number] | null
  } = $props()

  const n = $derived(labels.length)
  const MIN = 3 // months
  let width = $state(600)
  const px = $derived(width / Math.max(1, n)) // pixels per month
  const max = $derived(Math.max(1, ...values))

  // presentation values in month units; springs animate from wherever they are, so any change is interruptible
  const L = new Spring(0, { stiffness: 0.16, damping: 0.92 })
  const R = new Spring(1, { stiffness: 0.16, damping: 0.92 })
  let drag: null | { mode: 'l' | 'r' | 'move'; x0: number; l0: number; r0: number; span: number; hist: { t: number; x: number }[] } = null

  let placed = false
  $effect(() => {
    const f = from, t = to + 1 // read before the drag guard, or the effect loses its dependencies after the first drag
    if (drag) return
    if (!placed) { L.set(f, { instant: true }); R.set(t, { instant: true }); placed = true } // no glide on first paint
    else { L.target = f; R.target = t }
  })

  const rubber = (over: number, dim: number) => (over * dim * 0.55) / (dim + 0.55 * Math.abs(over))
  const project = (v: number, d = 0.995) => ((v / 1000) * d) / (1 - d) // Apple's scroll-deceleration projection
  const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

  function commit(l: number, r: number, span = 0) {
    // a move keeps a whole-month span so start and end shift together, even mid-glide or against an edge
    if (span) { const f = clamp(Math.round(l), 0, n - span); r = f + span; l = f }
    const f = clamp(Math.round(l), 0, n - MIN)
    const t = clamp(Math.round(r) - 1, f + MIN - 1, n - 1)
    if (f !== from) from = f
    if (t !== to) to = t
  }

  function down(e: PointerEvent) {
    const el = e.currentTarget as HTMLElement
    const x = e.clientX - el.getBoundingClientRect().left
    const lx = L.current * px, rx = R.current * px
    const near = Math.max(10, Math.min(16, (rx - lx) / 4))
    let mode: 'l' | 'r' | 'move'
    if (Math.abs(x - lx) <= near) mode = 'l'
    else if (Math.abs(x - rx) <= near) mode = 'r'
    else if (x > lx && x < rx) mode = 'move'
    else {
      // tap outside the window: recentre it there, keeping its span
      const span = to - from + 1, c = x / px
      const f = clamp(Math.round(c - span / 2), 0, n - span)
      from = f; to = f + span - 1
      return
    }
    el.setPointerCapture(e.pointerId)
    drag = { mode, x0: e.clientX, l0: L.current, r0: R.current, span: to - from + 1, hist: [{ t: e.timeStamp, x: e.clientX }] }
  }

  function moveP(e: PointerEvent) {
    if (!drag) return
    const dx = (e.clientX - drag.x0) / px
    drag.hist.push({ t: e.timeStamp, x: e.clientX })
    if (drag.hist.length > 6) drag.hist.shift()
    let l = drag.l0, r = drag.r0
    if (drag.mode === 'move') {
      const span = r - l
      l = drag.l0 + dx
      if (l < 0) l = -rubber(-l, span)
      if (l + span > n) l = n - span + rubber(l + span - n, span)
      r = l + span
    } else if (drag.mode === 'l') l = clamp(drag.l0 + dx, 0, r - MIN)
    else r = clamp(drag.r0 + dx, l + MIN, n)
    L.set(l, { instant: true }); R.set(r, { instant: true })
    commit(l, r, drag.mode === 'move' ? drag.span : 0)
  }

  function up(e: PointerEvent) {
    if (!drag) return
    const h = drag.hist, a = h[0], b = h[h.length - 1]
    const v = b.t > a.t && e.timeStamp - b.t < 80 ? ((b.x - a.x) / (b.t - a.t)) * 1000 / px : 0 // months per second
    let l = L.current, r = R.current
    if (drag.mode === 'move') {
      l = clamp(Math.round(l + project(v)), 0, n - drag.span)
      r = l + drag.span
      // a flick earns a touch of bounce; a placed drop settles flat
      L.damping = R.damping = Math.abs(v) > 3 ? 0.72 : 0.92
    } else {
      l = Math.round(l); r = Math.round(r)
    }
    drag = null
    commit(l, r)
    L.target = from; R.target = to + 1
    setTimeout(() => (L.damping = R.damping = 0.92), 600)
  }

  function keys(e: KeyboardEvent, which: 'l' | 'r' | 'move') {
    const step = e.shiftKey ? 12 : 1
    const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? step : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -step : 0
    if (!d) return
    e.preventDefault()
    if (which === 'l') from = clamp(from + d, 0, to - MIN + 1)
    else if (which === 'r') to = clamp(to + d, from + MIN - 1, n - 1)
    else {
      const span = to - from
      from = clamp(from + d, 0, n - 1 - span); to = from + span
    }
  }
  const years = $derived(labels.map((l, i) => (l.endsWith('-01') && +l.slice(0, 4) % (px * 12 > 34 ? 1 : px * 12 > 16 ? 2 : 5) === 0 ? i : -1)).filter((i) => i >= 0))
</script>

<div class="brush" bind:clientWidth={width} style:height="{height + 18}px">
  <div class="track" style:height="{height}px" onpointerdown={down} onpointermove={moveP} onpointerup={up} onpointercancel={up} role="presentation">
    <svg {width} {height} aria-hidden="true">
      {#each values as v, i (i)}
        <rect x={i * px} width={Math.max(0.6, px - (px > 4 ? 1 : 0))} y={height - Math.sqrt(v / max) * (height - 4)} height={Math.sqrt(v / max) * (height - 4)}
          class:in={i + 0.5 > L.current && i + 0.5 < R.current} />
      {/each}
    </svg>
    <div class="shade" style:width="{Math.max(0, L.current * px)}px"></div>
    <div class="shade right" style:left="{R.current * px}px"></div>
    {#if ghost && (ghost[0] !== from || ghost[1] !== to)}<div class="ghost" style:left="{ghost[0] * px}px" style:width="{(ghost[1] - ghost[0] + 1) * px}px"></div>{/if}
    <div class="win" style:left="{L.current * px}px" style:width="{(R.current - L.current) * px}px"
      role="slider" tabindex="0" aria-label="Selected period" aria-valuemin={0} aria-valuemax={n - 1} aria-valuenow={from}
      aria-valuetext="{monthShort(labels[from])} to {monthShort(labels[to])}" onkeydown={(e) => keys(e, 'move')}>
      <span class="h l" role="slider" tabindex="0" aria-label="Start month" aria-valuemin={0} aria-valuemax={n - 1} aria-valuenow={from}
        aria-valuetext={monthShort(labels[from])} onkeydown={(e) => { e.stopPropagation(); keys(e, 'l') }}></span>
      <span class="h r" role="slider" tabindex="0" aria-label="End month" aria-valuemin={0} aria-valuemax={n - 1} aria-valuenow={to}
        aria-valuetext={monthShort(labels[to])} onkeydown={(e) => { e.stopPropagation(); keys(e, 'r') }}></span>
    </div>
  </div>
  <div class="years" aria-hidden="true">
    {#each years.filter((i) => i * px < width - 34) as i (i)}<span style:left="{i * px}px">{labels[i].slice(0, 4)}</span>{/each}
  </div>
</div>

<style>
  .brush { position: relative; width: 100%; user-select: none; -webkit-user-select: none; }
  .track { position: relative; cursor: crosshair; touch-action: none; }
  svg { display: block; }
  rect { fill: var(--ink-3); opacity: 0.35; }
  rect.in { fill: var(--vol); opacity: 1; }
  .shade { position: absolute; top: 0; bottom: 0; left: 0; background: color-mix(in srgb, var(--paper) 55%, transparent); pointer-events: none; }
  .shade.right { right: 0; width: auto; }
  .win {
    position: absolute; top: -4px; bottom: -4px; border: 2px solid var(--ink); cursor: grab;
    background: color-mix(in srgb, var(--ink) 4%, transparent);
  }
  .win:active { cursor: grabbing; }
  .ghost { position: absolute; top: -3px; bottom: -3px; border: 1.5px dashed var(--ink-2); pointer-events: none; }
  .h { position: absolute; top: 50%; width: 8px; height: 24px; margin-top: -12px; background: var(--ink); cursor: ew-resize; }
  .h:focus-visible { outline-offset: 3px; }
  .h::after { content: ''; position: absolute; inset: -10px -8px; } /* hit padding beyond the visible grip */
  .h.l { left: -5px; }
  .h.r { right: -5px; }
  .years { position: relative; height: 18px; }
  .years span { position: absolute; top: 3px; font-size: 11px; color: var(--ink-3); transform: translateX(-1px); padding-left: 3px; border-left: 1px solid var(--rule); line-height: 1.2; }
</style>
