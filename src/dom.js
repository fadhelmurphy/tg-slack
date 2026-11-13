// Helper DOM minimal pengganti framework
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v == null) continue
    if (k === 'class') el.className = v
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
    else if (k in el && k !== 'list') el[k] = v
    else el.setAttribute(k, v === true ? '' : v)
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)))
  }
  return el
}
export const clear = (el) => { el.replaceChildren(); return el }
// append yang meratakan array dan mengabaikan null/false (append bawaan tidak)
export const add = (el, ...kids) => {
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(String(k)))
  return el
}
export const fill = (el, ...kids) => add(clear(el), ...kids)
export const fmtTime = (d) => new Date(d * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
export const fmtSize = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.ceil(n / 1024) + ' KB')
export const dayLabel = (d) => (d ? new Date(d * 1000).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }) : '')
