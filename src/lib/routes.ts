export const ROUTES = [
  { id: 'overview', label: 'Overview', title: 'CVE releases and exploitation trends', description: 'Daily CVE publication trends, confirmed exploitation and time to CISA KEV listing, with source dates and methodology.' },
  { id: 'exploitation', label: 'Exploitation', title: 'Known exploited vulnerabilities and KEV trends', description: 'Explore CISA KEV listings, ransomware use and the time from CVE publication to confirmed exploitation listing.' },
  { id: 'severity', label: 'Severity & EPSS', title: 'CVE severity and EPSS exploitation probability', description: 'Compare CVSS severity with confirmed exploitation and FIRST EPSS probabilities using public vulnerability data.' },
  { id: 'vendors', label: 'Vendors & weaknesses', title: 'Vulnerability trends by vendor and weakness', description: 'Compare CVE and known-exploited counts by vendor and CWE weakness, with source notes and coverage limits.' },
  { id: 'week', label: 'This week', title: 'Weekly vulnerability brief and KEV deadlines', description: 'New CISA KEV listings, approaching federal remediation deadlines and recently published Critical and High CVEs ranked by EPSS.' },
  { id: 'watchlist', label: 'Your CVEs', title: 'Check your CVEs privately', description: 'Prioritise your CVE list using KEV, EPSS and severity. Your list stays in browser memory and is never submitted or saved.' },
] as const

export const routePath = (route: string) => route === 'overview' ? '/' : `/${route}/`

/** Preserve existing shared links; filters remain fragments and never reach the server. */
export function readLocation(pathname: string, hash: string) {
  const legacy = hash.startsWith('#/')
  const [path, query] = legacy ? hash.slice(2).split('?') : [pathname.replace(/^\/|\/$/g, ''), hash.startsWith('#?') ? hash.slice(2) : '']
  const params = new URLSearchParams(query)
  const days = Number(params.get('days'))
  return { windowDays: days === 14 || days === 30 ? days : 7,
    vendorSort: params.get('sort') === 'cves' ? 'cves' : 'kev',
    cweSort: params.get('cweSort') === 'cves' ? 'cves' : 'kev',
    route: ROUTES.some((r) => r.id === path) ? path : 'overview', params }
}
