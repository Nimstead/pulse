const PROPS = [
  'color', 'background-color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
  'font-variant-numeric', 'text-transform', 'text-align', 'white-space', 'display', 'flex-direction', 'align-items',
  'justify-content', 'gap', 'grid-template-columns', 'padding', 'margin', 'border-top', 'border-bottom', 'border-left',
  'border-right', 'border-radius', 'width', 'height', 'min-width', 'opacity', 'fill', 'stroke', 'stroke-width',
  'stroke-dasharray', 'text-anchor', 'dominant-baseline', 'box-sizing', 'overflow', 'position', 'top', 'left', 'right',
  'bottom', 'transform',
]

function inlineStyles(src: Element, dst: Element) {
  const cs = getComputedStyle(src)
  ;(dst as HTMLElement).setAttribute('style', PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';'))
  for (let i = 0; i < src.children.length; i++) inlineStyles(src.children[i], dst.children[i])
}

/** Render a DOM node to PNG via an SVG foreignObject and put it on the clipboard (or download as a fallback). */
export async function copyPng(node: HTMLElement, name: string) {
  const { width, height } = node.getBoundingClientRect()
  const clone = node.cloneNode(true) as HTMLElement
  inlineStyles(node, clone)
  clone.querySelectorAll('[data-no-export]').forEach((el) => el.remove())
  const bg = getComputedStyle(document.body).backgroundColor
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="background:${bg};width:${width}px;height:${height}px">${new XMLSerializer().serializeToString(clone)}</div></foreignObject></svg>`
  const img = new Image()
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  await img.decode()
  const scale = 2
  const canvas = Object.assign(document.createElement('canvas'), { width: width * scale, height: height * scale })
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

function download(blob: Blob, filename: string) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename })
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
