<script lang="ts">
  import { ui } from '../lib/state.svelte'
</script>

<div class="deadline-control">
  <button class="setting" aria-pressed={ui.kevDeadlines} onclick={() => (ui.kevDeadlines = !ui.kevDeadlines)}>
    <span>Federal due dates</span><span class="value">{ui.kevDeadlines ? 'On' : 'Off'}</span>
  </button>
  <details>
    <summary>About</summary>
    <p>CISA's federal deadlines are optional here. Enable them if your organisation follows them or uses them as a benchmark. This includes dates in triage and exports; KEV exploitation signals always remain visible. <a href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog">CISA guidance</a></p>
  </details>
</div>

<style>
  .deadline-control { display: grid; grid-template-columns: auto auto; align-items: start; gap: 0 0.75rem; max-width: 100%; font: 500 0.8125rem/1.5 var(--sans); }
  .setting { display: inline-flex; align-items: center; justify-content: space-between; gap: 1rem; min-height: 2.75rem; padding: 0.5rem 0.75rem; border: 1px solid var(--rule-strong); background: var(--paper); color: var(--ink-2); font: inherit; cursor: pointer; }
  .setting:hover { border-color: var(--ink); color: var(--ink); }
  .value { color: var(--ink); font-weight: 700; }
  .setting[aria-pressed='true'] { background: var(--ink); color: var(--paper); border-color: var(--ink); }
  .setting[aria-pressed='true'] .value { color: inherit; }
  details { display: contents; }
  summary { grid-column: 2; display: flex; align-items: center; min-height: 2.75rem; cursor: pointer; color: var(--ink-3); text-decoration: underline; text-underline-offset: 0.2em; list-style: none; }
  summary::-webkit-details-marker { display: none; }
  p { grid-column: 1 / -1; margin: 0.65rem 0 0; max-width: 48ch; color: var(--ink-3); }
</style>
