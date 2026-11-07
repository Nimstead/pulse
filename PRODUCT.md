# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static site + nightly ETL (user choice). Python standard-library ETL writes precomputed JSON; Vite + TypeScript + Svelte 5 front end, D3 for scales, native Svelte motion. Hosted on Cloudflare Workers at pulse.nimstead.systems, refreshed daily by GitHub Actions.

## Users

- **Leadership (primary):** CISOs, heads of security, risk owners. They need the trend story in seconds — is CVE volume rising, how much gets exploited, how fast — often to drop into a deck or board update.
- **Vulnerability management teams:** prioritisation — what is exploited, EPSS likelihood, which vendors and weakness types dominate.
- **SOC analysts:** what changed this week — new KEV listings, CISA due dates, ransomware-linked entries, fresh criticals.

## Brand

Nimstead Pulse, a Nimstead product (lockup: "Nimstead" ExtraBold + "Pulse" Regular). The Nimstead "Plain Sight" identity is binding: ink on paper, Archivo, zero radius, Seal Crimson rationed. Here crimson means confirmed exploitation and nothing else.

## Product Purpose

Turn the public CVE firehose into an easy-to-interpret picture: how many CVEs are released per month, which were later marked exploited in the wild (CISA KEV) and when, and how severity, exploit probability, vendors and weaknesses trend over time. Success: a stakeholder understands the state of the vulnerability landscape from the first screen and can look up any CVE's timeline.

## Positioning

Joins release volume with exploitation timing: every KEV entry is tied back to its publication date, so the product can show the gap between NVD publication and KEV listing, not just two separate counts.

## Operating Context

Read on laptops and shared screens in meetings; charts are copied into slides and reports. Data refreshes daily from public feeds.

## Capabilities and Constraints

- Sources: NVD CVE JSON 2.0 yearly feeds, CISA Known Exploited Vulnerabilities catalog, EPSS daily scores (FIRST / Empirical Security). All public, no keys.
- No backend, no accounts, no alerting.
- NVD enrichment backlog means many recent CVEs lack CVSS/CPE; this is reported, not hidden.
- KEV is one exploitation list among several (not exhaustive); EPSS is a probability, not a verdict.

## Evidence on Hand

Real public data only, generated into `public/data/` by `etl/build.py`. No testimonials, customers or benchmarks exist; none may be invented.

## Product Principles

1. The story first: lead with a plain-language headline, then the chart that proves it.
2. Every number traceable to a source and a refresh time.
3. Honest about gaps: backlog, list coverage and probability caveats are visible.
4. Built to be lifted into a deck: every chart exports.

## Accessibility & Inclusion

Keyboard navigable, reduced-motion and reduced-transparency respected, colour never the sole carrier of meaning, WCAG AA contrast in light and dark.
