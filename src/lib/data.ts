export type Month = {
  ym: string; n: number; c: number; h: number; m: number; l: number; u: number
  rej: number; unan: number; def: number; kev: number; kevPub: number
}
export type Kev = {
  /** nv: NVD vendor key, joined by CVE ID; vendor and product are as written by CISA */
  id: string; nv: string; vendor: string; product: string; name: string; added: string; due: string; ransom: boolean
  pub: string | null; lag: number | null; score: number | null; sev: string; cwe: string
  epss: number | null; pct: number | null
}
export type Ranked = {
  key: string; name?: string; total: number; kev: number; byYear: number[]
  products?: { key: string; total: number; kev: number }[]
}
export type Watch = { id: string; epss: number; pct: number; vendor: string; product: string; sev: string; score: number | null; pub: string }
export type Epss = { edges: number[]; all: number[]; kev: number[]; watch: Watch[]; watchTotal: number }
export type Meta = {
  generated: string; nvd: string; kev: { version: string; released: string }; epss: string
  cves: number; rejected: number; kevCount: number; medianLag: number | null; shards: string[]; indexParts: number
}
/** [id, published, status, score, severity, cwe, vendor, product, epss, description] */
export type CveRow = [string, string, string, number | null, string, string, string, string, number | null, string]

const cache = new Map<string, Promise<unknown>>()
export function load<T>(name: string): Promise<T> {
  if (!cache.has(name))
    cache.set(name, fetch(`/data/${name}`).then((r) => {
      if (!r.ok) throw new Error(`Could not load ${name} (${r.status})`)
      return r.json()
    }).catch((e) => { cache.delete(name); throw e })) // a failed fetch is retried next time, not cached
  return cache.get(name) as Promise<T>
}

export const shard = (cveId: string) => {
  const [, y, n] = cveId.split("-")
  return load<CveRow[]>(`cve/${y}-${Math.floor(+n / 10000)}.json`) // matches SHARD in etl/build.py
}

const nf = new Intl.NumberFormat('en-GB')
export const num = (v: number) => nf.format(Math.round(v))
export const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`
/** EPSS as a percentage that never rounds up to certainty. */
export const epssPct = (v: number) => (v >= 0.9995 ? '>99.9%' : pct(v, 1))
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const monthLong = (ym: string) => `${MONTHS[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}`
export const monthShort = (ym: string) => `${MONTHS[+ym.slice(5, 7) - 1].slice(0, 3)} ${ym.slice(0, 4)}`
export const dateShort = (d: string) => `${+d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1].slice(0, 3)} ${d.slice(0, 4)}`
export const dateLong = (d: string) => `${+d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5)
export const addDays = (d: string, n: number) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10)
export const ymMinus = (ym: string, months: number) => {
  const t = +ym.slice(0, 4) * 12 + +ym.slice(5, 7) - 1 - months
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}
export function median(xs: number[]) {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b), i = s.length >> 1
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2
}
export const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0)
export const delta = (now: number, before: number) => (before ? (now - before) / before : 0)
export const SEV = [
  { key: 'c', label: 'Critical', full: 'CRITICAL' },
  { key: 'h', label: 'High', full: 'HIGH' },
  { key: 'm', label: 'Medium', full: 'MEDIUM' },
  { key: 'l', label: 'Low', full: 'LOW' },
  { key: 'u', label: 'Not scored', full: '' },
] as const
/** Severity colour by SEV key ('c') or by NVD name ('CRITICAL'). */
export const SEV_COLOR: Record<string, string> = {
  c: 'var(--sev-c)', h: 'var(--sev-h)', m: 'var(--sev-m)', l: 'var(--sev-l)', u: 'var(--sev-u)',
  CRITICAL: 'var(--sev-c)', HIGH: 'var(--sev-h)', MEDIUM: 'var(--sev-m)', LOW: 'var(--sev-l)',
}
/** Each value as a share of the total (all zeros stay zero). */
export const share = (xs: number[]) => { const t = xs.reduce((x, y) => x + y, 0) || 1; return xs.map((x) => x / t) }
const fmtE = (e: number) => (e >= 1 ? '100%' : e >= 0.01 ? `${Math.round(e * 100)}%` : `${+(e * 100).toFixed(1)}%`)
/** '0%–0.1%' style labels for the EPSS histogram bands. */
export const epssBands = (edges: number[]) => edges.slice(0, -1).map((e, i) => `${fmtE(e)}–${fmtE(edges[i + 1])}`)
const NAMES: Record<string, string> = {
  ibm: 'IBM', hp: 'HP', hpe: 'HPE', sap: 'SAP', redhat: 'Red Hat', 'red hat': 'Red Hat', dlink: 'D-Link', 'd link': 'D-Link',
  vmware: 'VMware', openssl: 'OpenSSL', gitlab: 'GitLab', totolink: 'TOTOLINK', qnap: 'QNAP', tplink: 'TP-Link', 'tp link': 'TP-Link',
  wordpress: 'WordPress', phpmyadmin: 'phpMyAdmin', github: 'GitHub', nvidia: 'NVIDIA', asus: 'ASUS', lg: 'LG', zohocorp: 'Zoho Corp',
  f5: 'F5', imagemagick: 'ImageMagick', jetbrains: 'JetBrains', sonicwall: 'SonicWall', netgear: 'NETGEAR', paloaltonetworks: 'Palo Alto Networks',
  couchdb: 'CouchDB', sharepoint: 'SharePoint', manageengine: 'ManageEngine', powerprotect: 'PowerProtect', opnsense: 'OPNsense',
  fortinac: 'FortiNAC', fortios: 'FortiOS', fortigate: 'FortiGate', fortiweb: 'FortiWeb', ahnlab: 'AhnLab', log4j: 'Log4j', macos: 'macOS',
  ios: 'iOS', ipados: 'iPadOS', iphone: 'iPhone', mysql: 'MySQL', postgresql: 'PostgreSQL', php: 'PHP', vcenter: 'vCenter', esxi: 'ESXi',
  netscaler: 'NetScaler', openmanage: 'OpenManage', moveit: 'MOVEit', pan: 'PAN', os: 'OS', xe: 'XE', 'ios xe': 'IOS XE', asa: 'ASA',
  flir: 'FLIR', chromium: 'Chromium', webkit: 'WebKit', javascript: 'JavaScript', nodejs: 'Node.js', jquery: 'jQuery',
}
/** Display name for a normalised vendor/product key: known spellings first, model numbers upper-cased, else title case. */
export const titleCase = (s: string) =>
  NAMES[s] ?? s.split(' ').map((w) => NAMES[w] ?? (/\d.*\d/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1))).join(' ')
/** KEV vendor and product as written by CISA, without repeating the vendor ('Sudo', not 'Sudo Sudo'). */
export const kvp = (vendor: string, product: string) => (product.toLowerCase().startsWith(vendor.toLowerCase()) ? product : `${vendor} ${product}`.trim())
/** "Vendor product", without repeating the vendor when the product is named after it. */
export const vp = (vendor: string, product: string) => {
  const v = titleCase(vendor || '—'), p = titleCase(product || '')
  const bare = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!p || bare(p) === bare(v)) return p || v // 'Joomla!' rather than 'Joomla Joomla!'
  return p.toLowerCase().startsWith(v.toLowerCase() + ' ') ? p : `${v} ${p}`
}

/** ISO-8601 week number, used as the bulletin's issue number. */
export function isoWeek(d: string) {
  const t = new Date(d.slice(0, 10) + 'T00:00:00Z')
  const day = (t.getUTCDay() + 6) % 7
  t.setUTCDate(t.getUTCDate() - day + 3)
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4))
  return 1 + Math.round(((t.getTime() - firstThursday.getTime()) / 864e5 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
}
