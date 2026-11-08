const PROPS = [
  'color', 'background-color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
  'font-variant-numeric', 'text-transform', 'text-align', 'white-space', 'display', 'flex-direction', 'flex-wrap', 'align-items',
  'justify-content', 'gap', 'grid-template-columns', 'padding', 'margin', 'border-top', 'border-bottom', 'border-left',
  'border-right', 'border-radius', 'width', 'height', 'min-width', 'background-image', 'opacity', 'fill', 'stroke', 'stroke-width',
  'stroke-dasharray', 'text-anchor', 'dominant-baseline', 'box-sizing', 'overflow', 'position', 'top', 'left', 'right',
  'bottom', 'transform', 'border-collapse', 'border-spacing', 'vertical-align',
]

function inlineStyles(src: Element, dst: Element) {
  const cs = getComputedStyle(src)
  ;(dst as HTMLElement).setAttribute('style', PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';'))
  for (let i = 0; i < src.children.length; i++) inlineStyles(src.children[i], dst.children[i])
}

// an SVG image cannot reach the page's web fonts, so the Latin subsets travel inside it as data URLs
let fonts: Promise<string> | undefined
function embedFonts() {
  const faces = [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules] } catch { return [] } })
    .filter((r): r is CSSFontFaceRule => r instanceof CSSFontFaceRule && /^U\+0+-0*FF\b/i.test(r.style.getPropertyValue('unicode-range')))
  return Promise.all(faces.map(async (r) => {
    const url = r.style.getPropertyValue('src').match(/url\("?([^")]+)"?\)/)?.[1]
    if (!url) return ''
    const blob = await (await fetch(url)).blob()
    const data = await new Promise<string>((res) => { const f = new FileReader(); f.onload = () => res(String(f.result)); f.readAsDataURL(blob) })
    return `@font-face{font-family:${r.style.getPropertyValue('font-family')};font-weight:${r.style.getPropertyValue('font-weight')};src:url(${data.replace(/^data:[^;]*/, 'data:font/woff2')})}`
  })).then((css) => css.join(''), () => '')
}

/** Render a DOM node to PNG via an SVG foreignObject and put it on the clipboard (or download as a fallback). `foot` is a provenance line added below. */
export async function copyPng(node: HTMLElement, name: string, foot = '') {
  // Capture the finished chart, rather than freezing an empty entrance frame.
  await Promise.all(node.getAnimations({ subtree: true })
    .filter((animation) => animation.playState === 'running' && animation.effect?.getTiming().iterations !== Infinity)
    .map((animation) => animation.finished.catch(() => {})))
  let width = Math.ceil(node.getBoundingClientRect().width)
  const padding = 16
  const clone = node.cloneNode(true) as HTMLElement
  inlineStyles(node, clone)
  // A compact phone row becomes the complete table in the exported artifact.
  clone.querySelectorAll<HTMLElement>('table.data th, table.data td').forEach((el) => {
    el.style.display = 'table-cell'
    el.style.width = 'auto'
    el.style.height = 'auto'
  })
  clone.querySelectorAll<HTMLElement>('table.data .mono-id').forEach((el) => { el.style.whiteSpace = 'nowrap' })
  clone.querySelectorAll<HTMLElement>('table.data').forEach((el) => {
    el.style.width = '100%'
    el.style.tableLayout = 'auto'
  })
  for (const [selector, display] of [['thead', 'table-header-group'], ['tbody', 'table-row-group'], ['tr', 'table-row']]) {
    clone.querySelectorAll<HTMLElement>(`table.data ${selector}`).forEach((el) => {
      el.style.display = el.hasAttribute('hidden') ? 'none' : display
      el.style.position = 'static'
      el.style.width = 'auto'
      el.style.overflow = 'visible'
    })
  }
  clone.querySelectorAll<HTMLElement>('table.data, table.data thead, table.data tbody, table.data tr').forEach((el) => { el.style.height = 'auto' })
  // Expand only the detached copy: a mobile viewport must not crop exported columns.
  clone.querySelectorAll<HTMLElement>('.table-scroll').forEach((el) => {
    el.style.overflow = 'visible'
    for (let ancestor: HTMLElement | null = el; ancestor; ancestor = ancestor === clone ? null : ancestor.parentElement) {
      ancestor.style.width = '100%'
      ancestor.style.height = 'auto'
      ancestor.style.maxHeight = 'none'
      ancestor.style.maxWidth = 'none'
    }
  })
  clone.querySelectorAll<HTMLElement>('.row-identity').forEach((el) => {
    el.style.position = 'static'
    el.style.left = 'auto'
    const peer = el.parentElement?.querySelector<HTMLElement>('th, td')
    if (peer) {
      el.style.padding = peer.style.padding
      el.style.borderBottom = peer.style.borderBottom
    }
  })
  clone.querySelectorAll<HTMLElement>('[data-no-export]').forEach((el) => {
    // the inlined heights of everything above an in-flow control would keep its space
    if (el.style.position !== 'absolute') for (let a = el.parentElement; a; a = a === clone ? null : a.parentElement) a.style.height = 'auto'
    el.remove()
  })
  // Let text reflow at the final artifact width instead of freezing phone wrapping.
  clone.querySelectorAll<HTMLElement>('figcaption, .head, .cap, .sub, .legend, .legend > span, .notes').forEach((el) => {
    el.style.width = 'auto'
    el.style.height = 'auto'
  })
  const head = clone.querySelector<HTMLElement>('.head')
  if (head) head.style.width = '100%'
  const root = getComputedStyle(document.documentElement)
  const wrap = Object.assign(document.createElement('div'), { style: `position:absolute;left:-99999px;top:0;width:${width}px;padding:${padding}px;box-sizing:content-box` })
  wrap.append(clone)
  if (foot) {
    const p = Object.assign(document.createElement('p'), { textContent: foot })
    p.setAttribute('style', `margin:0;padding:8px 0 4px;border-top:1px solid ${root.getPropertyValue('--rule')};font:400 11px/1.4 ${root.getPropertyValue('--sans')};color:${root.getPropertyValue('--ink-3')}`)
    wrap.append(p)
  }
  // Measure with only the exported inline styles, just as the SVG will render.
  // Page media queries and pseudo-elements must not change these dimensions.
  const host = document.createElement('div')
  host.attachShadow({ mode: 'closed' }).append(wrap)
  document.body.append(host)
  const scrollers = [...clone.querySelectorAll<HTMLElement>('.table-scroll')]
  width += Math.max(0, ...scrollers.map((el) => el.scrollWidth - el.clientWidth))
  wrap.style.width = `${width}px`
  const imageWidth = width + padding * 2
  const height = Math.ceil(wrap.getBoundingClientRect().height)
  host.remove()
  const css = await (fonts ??= embedFonts())
  const bg = getComputedStyle(document.body).backgroundColor
  const body = [...wrap.childNodes].map((n) => new XMLSerializer().serializeToString(n)).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${imageWidth}" height="${height}"><style>${css}</style><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="background:${bg};width:${imageWidth}px;height:${height}px;padding:${padding}px;box-sizing:border-box">${body}</div></foreignObject></svg>`
  const img = new Image()
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  await img.decode()
  const scale = 2
  const canvas = Object.assign(document.createElement('canvas'), { width: imageWidth * scale, height: height * scale })
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0)
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('PNG encode failed'))), 'image/png'))
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return 'Copied'
  } catch {
    download(blob, `${name}.png`)
    return 'Saved'
  }
}

/** One CSV cell. Text a spreadsheet would run as a formula (CNA-written, e.g. "@fastify/…") gets a leading quote. */
export function csvCell(v: unknown) {
  let s = v == null ? '' : String(v)
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function downloadCsv(rows: Record<string, unknown>[], name: string) {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const text = [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n')
  download(new Blob([text], { type: 'text/csv' }), `${name}.csv`)
}

export function download(blob: Blob, filename: string) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename })
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
