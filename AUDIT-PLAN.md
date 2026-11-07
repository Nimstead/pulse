# Audit fix plan (2026-11-03)

**Status:** all 9 tasks implemented on 2026-11-03. `npm test` passes, the data and the app rebuild, and the views were checked in the browser.

From a full read of `etl/`, `src/`, `.github/workflows/refresh.yml` and checks against the built `public/data/`.
Load assumed: a static site with many visitors, each in their own browser, and one ETL run a day in CI.
Do the tasks in order. Each one is small and can ship on its own.

## Must fix

### 1. "This week" Figure 15 counts from a capped list
- **Files:** `etl/build.py:267-279`, `src/views/Week.svelte:3,49-63,110`
- **Problem:** `recent.json` keeps only the top 250 Critical/High rows of the last 30 days, sorted by EPSS. Week filters that capped list by date. Today's data: the last 7 days have **1,044** Critical/High CVEs, but only **46** rows reach the table and CSV. The per-product "CVEs" column undercounts, and products with low EPSS never show up.
- **Change:** emit every hot row without its description: `"hot": [row(r)[:9] for r in hot]`. Delete `hotTotal`, the cap, and the "capped at 250" comments in build.py and Week.svelte. Drop `description: r[9]` from the Figure 15 CSV. Fix the `Recent` type to a 4-tuple and drop the `d[3] ?? 0` fallbacks.
- **Cost:** `recent.json` grows from ~120 KB to ~0.9 MB raw (gzip on Pages makes it much smaller). It loads on every page.
- **Verify:** add to `etl/test_build.py`: `assert len(f["recent.json"]["hot"]) == 1` (the fixture has one Critical CVE) and no cap. Then `npm run data` and check that 7-day hot rows equal the sum of `days[i][3]`.

### 2. Vendor "exploited" counts match on name prefixes
- **Files:** `src/views/Vendors.svelte:22-24,40-41`, `etl/build.py:194-200`
- **Problem:** `vendorKevN` counts KEV rows whose CISA vendor name *starts with* the NVD key. Today's data: Zoho Corp shows 0 (really 9), HP 0 (2), Huawei, Debian and Canonical 0. PHP also counts phpMyAdmin and PHPUnit. Sun counts Sunhillo. The drill-down header uses `current.kev` (matched by CVE ID), so the header and the list under it disagree.
- **Change:** in build.py, add `"nv": r.get("vendor", "")` to each KEV row (the NVD vendor key, joined by CVE ID). In Vendors.svelte, key `kevByVendor` on `k.nv`, make `vendorKevN = (key) => kevByVendor.get(key) ?? 0`, filter `vendorKev` with `k.nv === current.key`, and delete `squash`. Add `nv: string` to the `Kev` type.
- **Verify:** add to test_build.py: `assert f["kev.json"][0]["nv"] == "acme"`. In the browser, Zoho Corp shows 9 exploited all-time and the drill-down count matches its list.

## Should fix

### 3. CSV export does not neutralise formula cells
- **Files:** `src/lib/export.ts:45-48`
- **Problem:** spreadsheets read a cell that starts with `=`, `+`, `-` or `@` as a formula. 265 cells in today's data start that way, for example the description "@fastify/middie versions …" and the product "@astrojs/node". Excel shows `#NAME?`. Descriptions are written by outside CNAs, so a hostile one starting with `=HYPERLINK(…)` would run as a formula.
- **Change:** in `esc`, prefix `'` when a string value matches `/^[=+\-@\t\r]/`, and quote when it contains `\r`. Export `esc` as `csvCell`.
- **Verify:** add `src/lib/export.test.ts` with three asserts (`@x` → `'@x`, `a,b` → `"a,b"`, the number `-1` unchanged) and add it to `npm test`.

### 4. A failed fetch is cached forever and shown as "No record"
- **Files:** `src/lib/data.ts:24-31`, `src/components/Sheet.svelte:19,54-57`
- **Problem:** `load()` caches the rejected promise. After one network blip, every CVE in that shard says "No record for CVE-… in the NVD feed" until reload, which is false.
- **Change:** in `load`, `.catch((e) => { cache.delete(name); throw e })`. In Sheet, add a `failed` state that is set in the catch (guarded by `id === want`) and show "Could not load this record. Check the connection and try again."
- **Verify:** open a CVE with DevTools offline (error message shows), go back online, open it again (the record loads).

### 5. CI never runs the watchlist test, and the README's Node 20 cannot run it
- **Files:** `.github/workflows/refresh.yml:32`, `README.md:15`
- **Problem:** CI runs only `python -I etl/test_build.py`, so a break in `analyse()` (priority tiers, the KEV-only fallback) still deploys. `node src/lib/watchlist.test.ts` needs built-in TypeScript stripping (Node 22.18+), so `npm test` fails on the Node 20 the README asks for.
- **Change:** replace the CI test step with `- run: npm test`, placed after `npm ci`. Change the README to "Node 22.18+".
- **Verify:** `npm test` prints `ok` twice. Check the workflow run on the next push.

### 6. Severity colours and EPSS helpers are copied across views
- **Files:** `Severity.svelte:13,31,38-39`, `Watchlist.svelte:112-114,118-119`, `Sheet.svelte:28`, `Week.svelte:65`, `Overview.svelte:96`, `derive.ts:13`
- **Problem:** `share`, `fmtE` with `binLabels`, the two severity colour maps and the `MON` array each exist 2–3 times. A colour or band change has to be made in five places.
- **Change:** export `share`, `epssBands(edges)`, `SEV_COLOR` (keyed by full name) and `MON` once from `src/lib/data.ts` and import them everywhere. Use `SEV` keys for the short map.
- **Verify:** `npm run build`. The Severity, Your CVEs and This week views look the same as before.

### 7. Dead code and an unused dependency
- **Files:** `data.ts:61` (`signed`, never used), `data.ts:83` (a stray duplicate JSDoc line), `Bars.svelte:11,16,120` (`highlight` prop, never passed), `Lines.svelte:7-8,18,49,71` (`format`/`yMin` props, never passed: use `num` and `0`), `package.json` (`d3-array` is never imported; `d3-scale` brings its own copy)
- **Change:** delete them.
- **Verify:** `npm install && npm run build && npm test`.

## Nice to have

### 8. Grouping copies the array for every row
- **Files:** `Watchlist.svelte:132-134`, `Week.svelte:61`, `Severity.svelte:25`
- **Problem:** `g.set(k, [...(g.get(k) ?? []), r])` is O(n²) per group. A 10,000-ID scanner list that is mostly one product makes ~50M copies on every analysis. Watchlist's sort also re-filters KEV inside the comparator. After task 1, Week groups up to ~7,700 rows.
- **Change:** push into the existing array (the pattern already used at `Overview.svelte:36`), and count KEV once per group before sorting.

### 9. ETL rebuilds a set for every record
- **Files:** `etl/build.py:283`
- **Change:** hoist `ex = set(EXAMPLE)` out of the comprehension.

Left out: 2 cosmetic items (Overview shows "0.0×" for periods before KEV existed; Week's "Top EPSS" fallback would print 0.0% for a CVE with no EPSS yet).

## Completed product and accessibility review — 7 November 2026

Reviewed the VM, SOC handover and community research workflows against the D3 and Web Interface Guidelines skills and Nimstead's current brand guidance. Kept the existing typography, monochrome structure and restrained exploitation accent; added no dependencies.

Implemented source dates and coverage disclosures; clear routes into handover and private CVE triage; snapshot-based deadline windows; honest partial-month comparisons and missing-score labels; cancellable analysis with stale-result protection; local filters and dated CSV exports; explicit unmatched/rejected records; and guidance to check rejection reasons and replacement IDs before closing findings.

Charts now provide keyboard instructions, predictable arrow/Home/End navigation, Escape dismissal and reduced-motion handling. CSV-backed figures offer paginated semantic data tables that update with the selected period. Search announces results and keeps the active option visible. Mobile navigation, weekly product labels and triage filters fit narrow screens. Shared links preserve weekly windows and ranking choices.

### Review iterations

- Separate VM, SOC and design reviewers proposed and checked changes.
- A final Ponytail simplicity/source audit used GPT-6.1 Sol at Medium reasoning. Its three blockers (unmatched-only results, narrow filter layout and late file-read repopulation after Clear) were fixed and re-reviewed. No blockers remained in that source audit.

### Verification evidence

- Python ETL assertions and all ten Node test entries passed. On the installed Node 22.15 runtime, used `NODE_OPTIONS=--experimental-strip-types`; supplied a temporary `python` alias to the installed Python 3.13. The documented project minimum remains Node 22.18+.
- `npm run check`: zero errors and warnings. `npm run build`: client, SSR and six SEO checks passed. `git diff --check` passed.
- Browser checks covered all six sections at 320px, plus tablet/desktop and light/dark inspection. Fixed the observed Week and Watchlist horizontal overflow and rechecked both at 320px.
- Exercised chart keys, sliders, skip link, search navigation, modal focus/Escape, live table updates, preserved URL filters, stale analysis suppression and unmatched/rejected-only results. Verified the current-month-only Severity empty state in the production preview.
- Production PNG export was visually inspected: chart/context included, disclosure table and controls excluded. A filtered watchlist CSV was downloaded and parsed: exactly the selected CVE and snapshot date were present.

Browser viewport testing does not replace physical-device or screen-reader testing. Reduced-motion implementation was source-reviewed; an OS-level motion-preference session was not run. No deployment was performed as part of this review.
