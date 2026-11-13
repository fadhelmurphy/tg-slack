import { Message, PeersIndex } from '@mtcute/web'
import { h, fmtTime, fmtSize } from './dom.js'
import { tg } from './tg.js'

const URL_RE = /(https?:\/\/[^\s<]+)/g
function linkify(text) {
  return text.split(URL_RE).map((part, i) =>
    i % 2 ? h('a', { href: part, target: '_blank', rel: 'noopener noreferrer' }, part) : part)
}
const EMOJIS = ['👍', '❤️', '😂', '🎉', '👀', '🙏']
const blobCache = new Map()

// Unduh media dari pesan TL mentah lewat Message mtcute (hanya untuk lokasi file)
async function download(msg) {
  const hl = new Message(msg.raw, PeersIndex.from({ users: [], chats: [] }))
  const buf = await tg.downloadAsBuffer(hl.media)
  return new Blob([buf])
}

function mediaEl(msg, convKey) {
  const m = msg.media
  if (m.kind === 'photo' || m.kind === 'sticker') {
    const key = convKey + ':' + msg.id
    const box = h('div', { class: 'photo ph' }, 'Memuat gambar…')
    const cls = m.kind === 'sticker' ? 'sticker' : 'photo'
    const mime = m.kind === 'sticker' ? 'image/webp' : 'image/jpeg'
    const show = (url) => box.replaceWith(h('img', { class: cls, src: url, alt: '' }))
    if (blobCache.has(key)) show(blobCache.get(key))
    else download(msg).then((b) => { const u = URL.createObjectURL(new Blob([b], { type: mime })); blobCache.set(key, u); show(u) })
      .catch(() => { box.textContent = 'Gambar tidak bisa dimuat' })
    return box
  }
  const btn = h('button', { class: 'file' }, '📎 ', m.name, ' ', h('span', { class: 'muted small' }, fmtSize(m.size)))
  btn.onclick = async () => {
    btn.disabled = true
    try {
      const b = await download(msg)
      const a = h('a', { href: URL.createObjectURL(b), download: m.name })
      a.click()
    } finally { btn.disabled = false }
  }
  return btn
}

export function messageEl(msg, { convKey, replies = 0, last, onThread, onReact }) {
  const picker = h('div', { class: 'picker', hidden: true },
    EMOJIS.map((e) => h('button', { onclick: () => { picker.hidden = true; onReact(e) } }, e)))
  const actions = h('div', { class: 'actions' },
    h('button', { title: 'Reaksi', onclick: () => { picker.hidden = !picker.hidden } }, '😊'),
    onThread && h('button', { title: 'Balas di thread', onclick: onThread }, '💬'), picker)

  return h('div', { class: 'msg' },
    h('div', { class: 'avatar' }, msg.senderName.slice(0, 1).toUpperCase()),
    h('div', { class: 'body' },
      h('div', { class: 'meta' }, h('b', {}, msg.senderName), ' ', h('span', { class: 'muted small' }, fmtTime(msg.date))),
      msg.text && h('div', { class: 'text' }, linkify(msg.text)),
      msg.media && mediaEl(msg, convKey),
      msg.reactions.length > 0 && h('div', { class: 'reactions' }, msg.reactions.map((r) =>
        h('button', { class: 'chip' + (r.mine ? ' mine' : ''), onclick: () => onReact(r.emoji) }, `${r.emoji} ${r.count}`))),
      onThread && replies > 0 && h('button', { class: 'replies', onclick: onThread },
        `${replies} balasan`, last ? h('span', { class: 'muted small' }, ` · terakhir ${fmtTime(last)}`) : null)),
    actions)
}

export function makeComposer({ placeholder, onSend, onFile }) {
  const err = h('div', { class: 'error small' })
  const ta = h('textarea', { rows: 2, placeholder })
  const file = h('input', { type: 'file', hidden: true })
  const send = h('button', { class: 'primary' }, 'Kirim')
  const clip = h('button', { title: 'Lampirkan berkas' }, '📎')
  const el = h('div', { class: 'composer' }, err, ta, h('div', { class: 'composer-bar' }, clip, file, send))

  const run = async (fn) => {
    ta.disabled = send.disabled = clip.disabled = true
    err.textContent = ''
    try { await fn(); ta.value = '' } catch (e) { err.textContent = e?.message || String(e) }
    finally { ta.disabled = send.disabled = clip.disabled = false; ta.focus() }
  }
  const doSend = () => { const t = ta.value.trim(); if (t) run(() => onSend(t)) }
  send.onclick = doSend
  clip.onclick = () => file.click()
  file.onchange = () => { const f = file.files[0]; file.value = ''; if (f) run(() => onFile(f, ta.value.trim())) }
  ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend() } }
  return { el, setPlaceholder: (p) => { ta.placeholder = p } }
}
