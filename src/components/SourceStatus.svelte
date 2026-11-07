<script lang="ts">
  import { onMount } from 'svelte'
  import { dateShort, type Meta } from '../lib/data'
  import { scoreDate, snapshotAge } from '../lib/sources'
  let { meta }: { meta: Meta } = $props()
  let age = $state<number | null>(null)
  onMount(() => { age = snapshotAge(meta.generated, Date.now()) })
  const epss = $derived(scoreDate(meta.epss))
</script>

<details class="source-status">
  <summary>
    <span>Snapshot <time datetime={meta.generated}>{dateShort(meta.generated)}</time></span>
    <span class="label">Source dates &amp; coverage</span>
    {#if age != null && age > 2}<strong>{age} days old — check source updates</strong>{/if}
  </summary>
  <div class="source-body">
    <dl>
      <div><dt><a href="https://nvd.nist.gov/">NVD</a></dt><dd>Feed {dateShort(meta.nvd)}. Publication and severity; recent records may be incomplete.</dd></div>
      <div><dt><a href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog">CISA KEV</a></dt><dd>Released {dateShort(meta.kev.released)}. Confirmed exploitation; absence does not establish safety.</dd></div>
      <div><dt><a href="https://www.first.org/epss/">FIRST EPSS</a></dt><dd>{epss ? `Scored ${dateShort(epss)}.` : 'Score date unavailable.'} Probability of exploitation activity in the next 30 days, not severity.</dd></div>
    </dl>
    <p>Public intelligence, not an inventory or a record of your remediation. Confirm affected versions, exposure and business impact before deciding what to fix. CISA due dates apply to US federal civilian agencies.</p>
  </div>
</details>

<style>
  .source-status { border-bottom: 1px solid var(--rule); color: var(--ink-3); font-size: 0.8125rem; }
  summary { padding: 0.85rem 0; cursor: pointer; }
  summary span { display: inline-block; margin-right: 1rem; }
  summary .label { color: var(--ink); text-decoration: underline; text-underline-offset: 0.2em; }
  summary:hover .label { text-decoration-thickness: 2px; }
  strong { display: inline-block; color: var(--ink); }
  .source-body { padding: 0 0 1rem; max-width: 90ch; }
  dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.25rem; margin: 0.25rem 0 1rem; }
  dt { font-weight: 700; color: var(--ink); margin-bottom: 0.3rem; }
  dd { margin: 0; }
  p { margin: 0; max-width: 80ch; }
  @media (max-width: 640px) { dl { grid-template-columns: 1fr; gap: 0.85rem; } }
</style>
