"""Build Nimstead Pulse data files from NVD, CISA KEV and EPSS. Standard library only.

Usage: python etl/build.py   (writes public/data/, caches downloads in .cache/)
"""
import csv
import gzip
import io
import json
import re
import shutil
import statistics
import sys
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache"
OUT = ROOT / "public" / "data"
NVD = "https://nvd.nist.gov/feeds/json/cve/2.0/nvdcve-2.0-{}.json.gz"
KEV = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
EPSS = "https://epss.empiricalsecurity.com/epss_scores-current.csv.gz"
FIRST_YEAR = 2002  # the 2002 feed also holds 1999-2001
UNANALYSED = {"Received", "Awaiting Analysis", "Undergoing Analysis"}
SEVS = ("CRITICAL", "HIGH", "MEDIUM", "LOW")
SHARD = 10000  # CVE numbers per lookup shard file
INDEX_PART = 100_000  # rows per index part, ~14 MB, under Cloudflare's 25 MiB static asset limit
MAX_ASSET = 25 * 1024 * 1024
ALIASES = {"d link": "dlink", "red hat": "redhat", "tp link": "tplink", "palo alto networks": "paloaltonetworks", "hewlett packard enterprise": "hpe"}  # spellings that split one vendor
PRODUCT_ALIASES = {("linux", "linux"): "linux kernel", ("linux", "kernel"): "linux kernel"}

EXAMPLE = ["CVE-2021-44228", "CVE-2024-3400", "CVE-2023-4966", "CVE-2023-34362", "CVE-2017-0144", "CVE-2014-0160", "CVE-2022-22965",
           "CVE-2019-0708", "CVE-2022-0847", "CVE-2021-3156", "CVE-2023-44487", "CVE-2024-6387", "CVE-2023-38545", "CVE-2024-3094"]

CWE_NAMES = {
    "CWE-79": "Cross-site scripting", "CWE-89": "SQL injection", "CWE-787": "Out-of-bounds write",
    "CWE-125": "Out-of-bounds read", "CWE-20": "Improper input validation", "CWE-416": "Use after free",
    "CWE-22": "Path traversal", "CWE-352": "Cross-site request forgery", "CWE-78": "OS command injection",
    "CWE-434": "Unrestricted file upload", "CWE-862": "Missing authorization", "CWE-476": "NULL pointer dereference",
    "CWE-287": "Improper authentication", "CWE-190": "Integer overflow", "CWE-502": "Deserialization of untrusted data",
    "CWE-77": "Command injection", "CWE-119": "Memory buffer bounds", "CWE-798": "Hard-coded credentials",
    "CWE-918": "Server-side request forgery", "CWE-306": "Missing authentication", "CWE-362": "Race condition",
    "CWE-269": "Improper privilege management", "CWE-94": "Code injection", "CWE-863": "Incorrect authorization",
    "CWE-276": "Incorrect default permissions", "CWE-200": "Information exposure", "CWE-400": "Uncontrolled resource consumption",
    "CWE-611": "XML external entity", "CWE-120": "Classic buffer overflow", "CWE-121": "Stack-based buffer overflow",
    "CWE-122": "Heap-based buffer overflow", "CWE-639": "Authorization bypass via user key", "CWE-284": "Improper access control",
    "CWE-732": "Incorrect permission assignment", "CWE-601": "Open redirect", "CWE-770": "Allocation without limits",
    "CWE-74": "Injection", "CWE-843": "Type confusion", "CWE-288": "Auth bypass via alternate path",
    "CWE-1321": "Prototype pollution", "CWE-295": "Improper certificate validation", "CWE-427": "Uncontrolled search path",
    "CWE-668": "Exposure to wrong sphere", "CWE-835": "Infinite loop", "CWE-401": "Memory leak",
    "CWE-327": "Broken cryptography", "CWE-319": "Cleartext transmission", "CWE-312": "Cleartext storage",
    "CWE-922": "Insecure storage", "CWE-59": "Link following", "CWE-367": "TOCTOU race",
    "CWE-1236": "CSV injection", "CWE-917": "Expression language injection", "CWE-913": "Dynamic code resources",
    "CWE-193": "Off-by-one error", "CWE-665": "Improper initialization", "CWE-506": "Embedded malicious code",
    "CWE-340": "Predictable identifiers", "CWE-15": "External control of setting", "CWE-704": "Incorrect type conversion",
    "NVD-CWE-noinfo": "Insufficient information", "NVD-CWE-Other": "Other",
}


def fetch(url, name):
    """Download url into .cache/name, skipping when the server says it is unchanged."""
    path, stamp = CACHE / name, CACHE / (name + ".lm")
    req = urllib.request.Request(url, headers={"User-Agent": "nimstead-pulse-etl"})
    if path.exists() and stamp.exists() and stamp.read_text():
        req.add_header("If-Modified-Since", stamp.read_text())
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            data = r.read()
            tmp = path.with_suffix(".part")
            tmp.write_bytes(data)
            tmp.replace(path)  # never leave a half-written cache file behind
            stamp.write_text(r.headers.get("Last-Modified", ""))
    except urllib.error.HTTPError as e:
        if e.code != 304:
            raise
    return path


def vendor_key(s):
    # shortcut: crude name normalisation (CPE "microsoft" vs CNA "Microsoft Corporation"); upgrade to an alias table if top-vendor lists look split
    s = re.sub(r"[_\-]+", " ", (s or "").lower())
    s = re.sub(r"\b(project|inc|corp|corporation|ltd|llc|co|gmbh|ag|limited|software|foundation)\b\.?", "", s)
    s = re.sub(r"[^a-z0-9 .+]", "", s).strip(" .")
    s = re.sub(r"\s+", " ", s)
    s = ALIASES.get(s, s)
    return "" if s in ("", "n/a", "na", "unknown") else s


def product_key(vendor, s):
    s = re.sub(r"[_\s]+", " ", (s or "").lower()).strip(" .")  # hyphens stay: they are part of model numbers
    s = PRODUCT_ALIASES.get((vendor, s), s)
    if vendor == "microsoft":
        s = re.sub(r"^(windows 1[01]) (?:\d{4}|\d{2}h\d)$", r"\1", s)  # fold feature releases into the base product
    return "" if s in ("", "n/a", "na", "unknown", "-") else s


def pick_cvss(metrics):
    for key in ("cvssMetricV31", "cvssMetricV30", "cvssMetricV40", "cvssMetricV2"):
        rows = metrics.get(key) or []
        if rows:
            m = next((r for r in rows if r.get("type") == "Primary"), rows[0])
            d = m["cvssData"]
            return d.get("baseScore"), (d.get("baseSeverity") or m.get("baseSeverity") or "").upper(), d.get("version")
    return None, "", None


def normalize(item):
    """One NVD 2.0 vulnerability -> compact dict."""
    c = item["cve"]
    score, sev, ver = pick_cvss(c.get("metrics") or {})
    cwe = ""
    for w in sorted(c.get("weaknesses") or [], key=lambda w: w.get("type") != "Primary"):
        vals = [d["value"] for d in w.get("description", []) if d.get("value", "").startswith(("CWE-", "NVD-CWE"))]
        if vals:
            cwe = vals[0]
            break
    vendor = product = ""
    for cfg in c.get("configurations") or []:
        for node in cfg.get("nodes", []):
            for m in node.get("cpeMatch", []):
                if m.get("vulnerable"):
                    parts = m["criteria"].split(":")
                    vendor, product = (re.sub(r"\\(.)", r"\1", x) for x in parts[3:5])  # CPE 2.3 escapes, e.g. joomla\!
                    break
            if vendor:
                break
        if vendor:
            break
    if not vendor:  # CNA-supplied affected data covers CVEs NVD has not enriched yet
        for a in c.get("affected") or []:
            for d in a.get("affectedData", []):
                if vendor_key(d.get("vendor")):
                    vendor, product = d["vendor"], d.get("product", "")
                    break
            if vendor:
                break
    desc = next((d["value"] for d in c.get("descriptions", []) if d.get("lang") == "en"), "")
    return {
        "id": c["id"], "pub": c["published"][:10], "status": c.get("vulnStatus", ""),
        "score": score, "sev": sev if sev in SEVS else "", "ver": ver, "cwe": cwe,
        "vendor": vendor_key(vendor), "product": product_key(vendor_key(vendor), product), "desc": desc,
    }


def load_kev(raw):
    out = {}
    for v in raw["vulnerabilities"]:
        out[v["cveID"]] = {
            "added": v["dateAdded"], "due": v.get("dueDate", ""), "ransom": v.get("knownRansomwareCampaignUse") == "Known",
            "vendor": v.get("vendorProject", ""), "product": v.get("product", ""), "name": v.get("vulnerabilityName", ""),
            "cwes": v.get("cwes") or [],
        }
    return out


def load_epss(text):
    lines = text.splitlines()
    meta = lines[0].lstrip("#") if lines and lines[0].startswith("#") else ""
    rows = csv.DictReader(l for l in lines if not l.startswith("#"))
    return {r["cve"]: (float(r["epss"]), float(r["percentile"])) for r in rows}, meta


def days(a, b):
    return (date.fromisoformat(b) - date.fromisoformat(a)).days


def aggregate(records, kev, epss):
    """Return {filename: object} for everything the site loads."""
    by_id = {r["id"]: r for r in records}
    monthly = defaultdict(lambda: Counter())
    for r in records:
        m = monthly[r["pub"][:7]]
        if r["status"] == "Rejected":
            m["rej"] += 1
            continue
        m["n"] += 1
        m[r["sev"][:1].lower() or "u"] += 1
        if r["status"] in UNANALYSED:
            m["unan"] += 1
        if r["status"] == "Deferred":
            m["def"] += 1
        if r["id"] in kev:
            m["kevPub"] += 1
    for k in kev.values():
        monthly[k["added"][:7]]["kev"] += 1
    months = sorted(monthly)
    monthly_rows = [{"ym": m, **{k: monthly[m][k] for k in ("n", "c", "h", "m", "l", "u", "rej", "unan", "def", "kev", "kevPub")}} for m in months]

    kev_rows = []
    for cid, k in kev.items():
        r = by_id.get(cid, {})
        e = epss.get(cid)
        kev_rows.append({
            "id": cid, "nv": r.get("vendor", ""), "vendor": k["vendor"], "product": k["product"], "name": k["name"], "added": k["added"],
            "due": k["due"], "ransom": k["ransom"], "pub": r.get("pub"),
            "lag": days(r["pub"], k["added"]) if r.get("pub") else None,
            "score": r.get("score"), "sev": r.get("sev", ""), "cwe": r.get("cwe") or (k["cwes"][0] if k["cwes"] else ""),
            "epss": e[0] if e else None, "pct": e[1] if e else None,
        })
    kev_rows.sort(key=lambda x: x["added"], reverse=True)

    live = [r for r in records if r["status"] != "Rejected"]
    years = sorted({r["pub"][:4] for r in live})

    def top(field, n, names=None):
        tot, kv, by = Counter(), Counter(), defaultdict(Counter)
        for r in live:
            key = r[field]
            if not key:
                continue
            tot[key] += 1
            by[key][r["pub"][:4]] += 1
            if r["id"] in kev:
                kv[key] += 1
        rows = []
        for key, cnt in tot.most_common(n):
            row = {"key": key, "total": cnt, "kev": kv[key], "byYear": [by[key][y] for y in years]}
            if names is not None:
                row["name"] = names.get(key, key)
            rows.append(row)
        return rows

    vendors = top("vendor", 60)
    products = defaultdict(Counter)
    pkev = defaultdict(Counter)
    keep = {v["key"] for v in vendors}
    for r in live:
        if r["vendor"] in keep and r["product"]:
            products[r["vendor"]][r["product"]] += 1
            if r["id"] in kev:
                pkev[r["vendor"]][r["product"]] += 1
    for v in vendors:
        v["products"] = [{"key": p, "total": n, "kev": pkev[v["key"]][p]} for p, n in products[v["key"]].most_common(12)]

    # EPSS: distribution of live CVEs vs KEV, plus a high-EPSS watchlist not yet in KEV
    edges = [0, 0.001, 0.01, 0.05, 0.1, 0.2, 0.5, 0.8, 1.0001]
    hist_all, hist_kev = [0] * (len(edges) - 1), [0] * (len(edges) - 1)
    watch = []
    for r in live:
        e = epss.get(r["id"])
        if not e:
            continue
        i = next(i for i in range(len(edges) - 1) if e[0] < edges[i + 1])
        (hist_kev if r["id"] in kev else hist_all)[i] += 1
        if r["id"] not in kev and e[0] >= 0.1:
            watch.append({"id": r["id"], "epss": e[0], "pct": e[1], "vendor": r["vendor"], "product": r["product"],
                          "sev": r["sev"], "score": r["score"], "pub": r["pub"]})
    watch.sort(key=lambda x: -x["epss"])

    def row(r):
        e = epss.get(r["id"])
        return [r["id"], r["pub"], r["status"], r["score"], r["sev"], r["cwe"], r["vendor"], r["product"],
                e[0] if e else None, r["desc"][:1200]]

    shards = defaultdict(list)
    for r in records:
        _, y, n = r["id"].split("-")
        shards[f"{y}-{int(n) // SHARD}"].append(row(r))  # the ID alone tells the client which shard to fetch

    # last 30 days by publication date, for the "This week" view
    latest = max(r["pub"] for r in live)
    since = (date.fromisoformat(latest) - timedelta(days=29)).isoformat()
    recent = [r for r in live if r["pub"] >= since]
    per_day = Counter(r["pub"] for r in recent)
    scored = Counter(r["pub"] for r in recent if r["sev"])
    hot = sorted((r for r in recent if r["sev"] in ("CRITICAL", "HIGH")),
                 key=lambda r: (-(epss.get(r["id"], (0, 0))[0]), -(r["score"] or 0)))
    hot_day = Counter(r["pub"] for r in hot)

    ex = set(EXAMPLE)  # built once, not per record
    lags = [k["lag"] for k in kev_rows if k["lag"] is not None]
    # every CVE minus its description, in fixed parts the private watchlist fetches in full, so requests never depend on the list
    index = [row(r)[:9] + [epss[r["id"]][1] if r["id"] in epss else None] for r in records]
    parts = [index[i:i + INDEX_PART] for i in range(0, len(index), INDEX_PART)]
    files = {
        "monthly.json": monthly_rows,
        "kev.json": kev_rows,
        "vendors.json": {"years": years, "rows": vendors},
        "cwe.json": {"years": years, "rows": top("cwe", 30, CWE_NAMES), "names": CWE_NAMES},
        "epss.json": {"edges": edges[:-1] + [1], "all": hist_all, "kev": hist_kev, "watch": watch[:300], "watchTotal": len(watch)},
        "recent.json": {"latest": latest, "days": [[d, per_day[d], scored[d], hot_day[d]] for d in sorted(per_day)],
                        "hot": [row(r)[:9] for r in hot]},  # no descriptions, so every row fits
        # well-known CVEs, exploited and not, in index-row form: the "Your CVEs" view opens on this worked example
        "example.json": {"ids": EXAMPLE, "rows": [row(r)[:9] + [epss[r["id"]][1] if r["id"] in epss else None] for r in records if r["id"] in ex]},
        "totals": {"cves": len(live), "rejected": len(records) - len(live), "kevCount": len(kev),
                   "medianLag": statistics.median(lags) if lags else None, "shards": sorted(shards), "indexParts": len(parts)},
    }
    for i, part in enumerate(parts):
        files[f"index-{i}.json"] = part
    for y, rows in shards.items():
        files[f"cve/{y}.json"] = rows
    return files


def main():
    CACHE.mkdir(exist_ok=True)
    this_year = datetime.now(timezone.utc).year
    years = range(FIRST_YEAR, this_year + 1)
    with ThreadPoolExecutor(6) as pool:
        kev_job, epss_job = pool.submit(fetch, KEV, "kev.json"), pool.submit(fetch, EPSS, "epss.csv.gz")
        nvd_paths = list(pool.map(lambda y: fetch(NVD.format(y), f"nvd-{y}.json.gz"), years))
        kev_path, epss_path = kev_job.result(), epss_job.result()

    records, stamps = [], []
    for p in nvd_paths:
        with gzip.open(p) as f:
            feed = json.load(f)
        stamps.append(feed.get("timestamp", ""))
        records += [normalize(v) for v in feed["vulnerabilities"]]
        print(f"{p.name}: {len(feed['vulnerabilities'])}", file=sys.stderr)
        del feed
    kev_raw = json.loads(kev_path.read_text(encoding="utf-8"))
    kev = load_kev(kev_raw)
    epss, epss_meta = load_epss(gzip.decompress(epss_path.read_bytes()).decode())

    files = aggregate(records, kev, epss)
    totals = files.pop("totals")
    files["meta.json"] = {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "nvd": max(stamps), "kev": {"version": kev_raw.get("catalogVersion"), "released": kev_raw.get("dateReleased")},
        "epss": epss_meta, **totals,
    }
    shutil.rmtree(OUT / "cve", ignore_errors=True)  # drop shards from older layouts
    (OUT / "cve").mkdir(parents=True, exist_ok=True)
    for p in OUT.glob("index*.json"):  # drop the old single index and any parts beyond today's count
        p.unlink()
    for name, obj in files.items():
        (OUT / name).write_text(json.dumps(obj, separators=(",", ":")), encoding="utf-8")
        if (OUT / name).stat().st_size >= MAX_ASSET:
            sys.exit(f"{name} is over Cloudflare's 25 MiB static asset limit: lower INDEX_PART or SHARD")
    print(f"wrote {len(files)} files, {totals}", file=sys.stderr)


if __name__ == "__main__":
    main()
