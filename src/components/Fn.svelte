<script lang="ts">
  let { n }: { n: number } = $props()
  // a button, not an anchor: the hash is the router
  const go = () => document.getElementById(`note-${n}`)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
</script>

<sup class="fn" data-no-export><button onclick={go} aria-label="Note {n}">{n}</button></sup>

<style>
  .fn { font-size: 0.62em; line-height: 0; margin-left: 0.08em; }
  button { position: relative; background: none; border: 0; padding: 0 0.1em; color: var(--fn, var(--ink)); font: 700 1em var(--sans); cursor: pointer; }
  button::after { content: ''; position: absolute; left: 50%; top: 50%; width: 24px; height: 44px; transform: translate(-50%, -50%); } /* a 24×44px hit area without moving the text */
  button:hover { text-decoration: underline; }
</style>
