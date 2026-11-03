<script lang="ts">
  let { n }: { n: number } = $props()
  // a button, not an anchor: the hash is the router
  const go = () => document.getElementById(`note-${n}`)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
</script>

<sup class="fn"><button onclick={go} aria-label="Note {n}">{n}</button></sup>

<style>
  .fn { font-size: 0.62em; line-height: 0; margin-left: 0.08em; }
  button { background: none; border: 0; padding: 0 0.1em; color: var(--fn, var(--ink)); font: 700 1em var(--sans); cursor: pointer; }
  button:hover { text-decoration: underline; }
</style>
