<script module lang="ts">
  export type SlideData = {
    headline: string; basis: string; footer: string
    vitals: { label: string; value: string; note: string }[]
    comparison: { labels: string[]; cves: number[]; kev: number[]; subtitle: string } | null
  }
</script>

<script lang="ts">
  import Lines from './Lines.svelte'
  import { num } from '../lib/data'
  let { data }: { data: SlideData } = $props()
</script>

<article class="slide">
  <header>
    <h2>{data.headline}</h2>
    <p>{data.basis}</p>
  </header>
  {#if data.vitals.length}
    <div class="vitals">
      {#each data.vitals as vital, i (vital.label)}
        <div>
          <h3>{vital.label}</h3>
          <p class="value">{vital.value}{#if i === 1}<i aria-hidden="true"></i>{/if}</p>
          <p class="note">{vital.note}</p>
        </div>
      {/each}
    </div>
  {/if}
  <section class="proof">
    {#if data.comparison}
      <h3>Figure 1. Volume against exploitation</h3>
      <p>{data.comparison.subtitle}</p>
      <div class="plots">
        <div>
          <h4>CVEs published, rolling 12 months</h4>
          <Lines label="CVEs published, rolling 12 months" labels={data.comparison.labels} height={190}
            lines={[{ key: 'c', label: 'CVEs', endLabel: num(data.comparison.cves.at(-1)!), values: data.comparison.cves, tone: 'focus' }]} />
        </div>
        <div>
          <h4>Added to KEV, rolling 12 months</h4>
          <Lines label="KEV listings, rolling 12 months" labels={data.comparison.labels} height={190}
            lines={[{ key: 'k', label: 'KEV listings', endLabel: num(data.comparison.kev.at(-1)!), values: data.comparison.kev, tone: 'focus', color: 'var(--kev)' }]} />
        </div>
      </div>
    {:else}
      <h3>Selected-period context</h3>
      <p>A rolling annual comparison needs at least 12 complete months after the KEV launch backfill and a preceding comparison baseline. Select a longer period to include Figure 1.</p>
    {/if}
  </section>
  <footer>
    <p>KEV is CISA’s Known Exploited Vulnerabilities catalogue. It confirms reported exploitation; absence from KEV does not mean safe.</p>
    <p>{data.footer}</p>
  </footer>
</article>

<style>
  /* Export geometry is independent of the reading viewport and its text zoom. */
  .slide { box-sizing: border-box; width: 1248px; height: 688px; padding: 24px; display: flex; flex-direction: column; gap: 16px; font: 400 16px/1.4 var(--sans); background: var(--paper); color: var(--ink); }
  h2, h3, h4, p { margin: 0; }
  h2 { font: 800 40px/1.05 var(--display); letter-spacing: -0.03em; max-width: 50ch; }
  header p { margin-top: 10px; font-size: 14px; color: var(--ink-2); }
  .vitals { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); background: var(--band); color: var(--band-fg); padding: 16px; }
  .vitals > div { padding: 0 18px; border-left: 1px solid var(--band-line); }
  .vitals > div:first-child { border: 0; padding-left: 0; }
  .vitals h3 { font: 600 12px/1.3 var(--sans); color: var(--ash); }
  .value { font: 800 48px/1 var(--display); letter-spacing: -0.03em; margin: 8px 0; }
  .value i { display: inline-block; width: 8px; height: 8px; margin-left: 4px; vertical-align: top; background: var(--seal); }
  .note { font-size: 14px; color: var(--ash); }
  .proof { border-top: 2px solid var(--rule-strong); padding-top: 10px; }
  .proof h3 { font: 700 18px/1.2 var(--sans); }
  .proof > p { margin: 4px 0 10px; font-size: 13px; color: var(--ink-2); }
  .plots { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
  h4 { font: 600 14px/1.2 var(--sans); margin-bottom: 6px; }
  footer { margin-top: auto; border-top: 1px solid var(--rule); padding-top: 8px; font-size: 11px; color: var(--ink-3); }
  footer p + p { margin-top: 4px; }
</style>
