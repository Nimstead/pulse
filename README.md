# Nimstead Pulse

A weekly surveillance report on CVE releases and exploitation in the wild. It shows monthly CVE volume, CISA KEV listings and how fast they follow disclosure, severity and EPSS, vendors and weaknesses, a "this week" brief, and a lookup for any CVE.

Static site (Vite + Svelte 5). A standard-library Python ETL turns public feeds into small JSON files:

| Source | Used for |
| --- | --- |
| [NVD CVE JSON 2.0 feeds](https://nvd.nist.gov/vuln/data-feeds) | every CVE: published date, status, CVSS, CWE, vendor/product |
| [CISA KEV catalogue](https://www.cisa.gov/known-exploited-vulnerabilities-catalog) | exploited in the wild: date added, due date, ransomware use |
| [EPSS](https://www.first.org/epss/) | probability of exploitation in the next 30 days |

## Run locally

Requires Python 3.12+ and Node 22.18+ (the tests run `.ts` files directly).

```bash
npm install
npm run data      # downloads ~400 MB of feeds into .cache/ (first run), writes public/data/
npm run dev       # http://localhost:5173
```

`npm test` runs the ETL, watchlist and CSV self-checks. `npm run check` type-checks the app (strict TypeScript and Svelte accessibility rules); CI runs both. Re-running `npm run data` only re-downloads feeds that changed (`If-Modified-Since`).

## Deploy

Live at [pulse.nimstead.systems](https://pulse.nimstead.systems), served as static assets by a Cloudflare Worker (`wrangler.jsonc`, with security headers in `public/_headers`).

`.github/workflows/refresh.yml` runs every day at 14:30 UTC, on every push to `main`, and on demand (`gh workflow run refresh.yml`). It tests, rebuilds the data and deploys `dist/` with Wrangler. It needs two repository secrets: `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (an "Edit Cloudflare Workers" token for the account and the `nimstead.systems` zone).

Any static host works too: run `npm run data && npm run build` and serve `dist/`. The ETL fails if any output file reaches 25 MiB, Cloudflare's per-file limit for static assets.

## Notes

- Counts use NVD publication month and exclude rejected CVEs.
- KEV is not an exhaustive list of exploited CVEs, and EPSS is a probability. The site's footnotes say so wherever it matters.
- Lookup data is sharded by CVE number (`public/data/cve/{year}-{n}.json`), so a lookup fetches only one small file.

## Privacy: "Your CVEs"

The **Your CVEs** view analyses a pasted or uploaded list entirely in the browser. The list is never sent anywhere or saved:

- Every visitor makes the same requests. The view opens on a fixed worked example (`data/example.json`, the same 14 well-known CVEs for everyone). The analysis fetches every part of the index, `data/index-0.json` onwards (every CVE without its description), and "Download descriptions" fetches *all* shards in a fixed order. Shards are never fetched per ID, because the file name would reveal the ID's range.
- A Content-Security-Policy in `index.html` allows same-origin requests only. Fonts are bundled (`@fontsource-variable/*`), not loaded from Google.
- The list lives in memory only: no localStorage, URL or hash. Opening a listed CVE's case record uses the in-memory row.
- Keep it that way: do not add analytics, third-party scripts or per-ID fetches to this view.

## Credit

Pulse was partly [Alex Early](https://www.linkedin.com/in/alexandra-early-619299a0/)'s idea.

## Licence

The code is under the [MIT licence](LICENSE).

The licence doesn't cover the Nimstead brand. The names "Nimstead" and "Nimstead Pulse", the Nimstead mark (the favicon) and the Plain Sight visual identity stay with Nimstead. If you publish a fork, give it another name and remove the marks.

The bundled fonts (Archivo, Geist Mono) are under the SIL Open Font Licence. The data comes from NVD, CISA and FIRST under their own terms.
