"""Self-check for build.aggregate/normalize on a tiny fixture: python -I etl/test_build.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import build  # noqa: E402


def nvd(cid, pub, status="Analyzed", score=None, sev=None, cpe=None, cna_vendor=None, cwe="CWE-79"):
    metrics = {"cvssMetricV31": [{"type": "Primary", "cvssData": {"baseScore": score, "baseSeverity": sev, "version": "3.1"}}]} if score else {}
    cfg = [{"nodes": [{"cpeMatch": [{"vulnerable": True, "criteria": cpe}]}]}] if cpe else []
    aff = [{"affectedData": [{"vendor": cna_vendor, "product": "Widget"}]}] if cna_vendor else []
    return {"cve": {"id": cid, "published": pub + "T10:00:00.000", "vulnStatus": status, "metrics": metrics,
                    "configurations": cfg, "affected": aff, "descriptions": [{"lang": "en", "value": "desc " + cid}],
                    "weaknesses": [{"type": "Primary", "description": [{"value": cwe}]}]}}


recs = [build.normalize(x) for x in [
    nvd("CVE-2025-0001", "2025-01-05", score=9.8, sev="CRITICAL", cpe="cpe:2.3:a:acme_project:rocket:1:*:*:*:*:*:*:*"),
    nvd("CVE-2025-0002", "2025-01-20", status="Awaiting Analysis", cna_vendor="Acme Inc."),
    nvd("CVE-2025-0003", "2025-02-01", status="Rejected"),
]]
assert recs[0]["vendor"] == "acme" and recs[0]["product"] == "rocket" and recs[0]["sev"] == "CRITICAL"
assert recs[1]["vendor"] == "acme" and recs[1]["sev"] == "", "CNA fallback vendor + normalisation"
assert build.normalize(nvd("CVE-2025-0009", "2025-01-01", cpe=r"cpe:2.3:a:joomla:joomla\!:3:*:*:*:*:*:*:*"))["product"] == "joomla!"
assert build.product_key("wavlink", "WL-WN579A3-A") == "wl-wn579a3-a" and build.product_key("linux", "Kernel") == "linux kernel"

kev = build.load_kev({"vulnerabilities": [
    {"cveID": "CVE-2025-0001", "dateAdded": "2025-01-15", "dueDate": "2025-02-05", "knownRansomwareCampaignUse": "Known",
     "vendorProject": "Acme", "product": "Rocket", "vulnerabilityName": "x"},
    {"cveID": "CVE-2025-0002", "dateAdded": "2025-01-20", "vendorProject": "Acme", "product": "Widget"},
]})
epss, meta = build.load_epss("#model_version:v1,score_date:2025-03-01\ncve,epss,percentile\nCVE-2025-0001,0.9,0.99\nCVE-2025-0002,0.2,0.9\n")
assert meta.startswith("model_version") and epss["CVE-2025-0002"] == (0.2, 0.9)

build.INDEX_PART = 2  # force a split on the 3-record fixture
f = build.aggregate(recs, kev, epss)
jan, feb = f["monthly.json"]
assert jan == {"ym": "2025-01", "n": 2, "c": 1, "h": 0, "m": 0, "l": 0, "u": 1, "rej": 0, "unan": 1, "def": 0, "kev": 2, "kevPub": 2}, jan
assert feb["n"] == 0 and feb["rej"] == 1
lag = {k["id"]: k["lag"] for k in f["kev.json"]}
assert lag == {"CVE-2025-0001": 10, "CVE-2025-0002": 0}, lag
assert f["kev.json"][0]["nv"] == "acme", "KEV joined to the NVD vendor by CVE ID"
assert f["kev.json"][0]["ransom"] is False and f["kev.json"][1]["ransom"] is True  # sorted newest added first
assert f["vendors.json"]["rows"][0]["key"] == "acme" and f["vendors.json"]["rows"][0]["kev"] == 2
assert f["epss.json"]["kev"][5] == 1 and f["epss.json"]["watch"] == [], "0.2 lands in the 0.2-0.5 bin; KEV CVEs never on watchlist"
assert len(f["cve/2025-0.json"]) == 3 and f["recent.json"]["latest"] == "2025-01-20"  # sharded by ID year
assert f["totals"]["cves"] == 2 and f["totals"]["medianLag"] == 5 and f["totals"]["shards"] == ["2025-0"]
assert f["recent.json"]["hot"] == [["CVE-2025-0001", "2025-01-05", "Analyzed", 9.8, "CRITICAL", "CWE-79", "acme", "rocket", 0.9]], "every hot row, no description"
assert f["totals"]["indexParts"] == 2 and [len(f["index-0.json"]), len(f["index-1.json"])] == [2, 1], "index split into fixed parts"
idx = {r[0]: r for r in f["index-0.json"] + f["index-1.json"]}
assert len(idx) == 3 and idx["CVE-2025-0001"] == ["CVE-2025-0001", "2025-01-05", "Analyzed", 9.8, "CRITICAL", "CWE-79", "acme", "rocket", 0.9, 0.99]
assert idx["CVE-2025-0003"][2] == "Rejected" and idx["CVE-2025-0003"][8:] == [None, None], "rejected kept, no EPSS"
print("ok")
