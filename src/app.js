import Long from 'long'
import { h, clear, add, fill } from './dom.js'
import { tg, logout } from './tg.js'
import { messageEl, makeComposer } from './message.js'
import { names, peerKey, rememberPeers, rootOf, toMsg, userName } from './model.js'

const state = {
  convs: [], rail: '', topics: {}, active: null, msgs: {}, thread: null, results: null, error: '', newTopic: null,
}
const k = (conv, topic) => `${conv}:${topic}`
const convOf = (key) => state.convs.find((c) => c.key === key)
const fail = (e) => { state.error = e?.message || String(e); render() }

// ---- peta chat mtcute -> Conv ----
const convFromPeer = (p) => {
  const ip = p.inputPeer
  if (p.type === 'chat' && p.isForum) return { key: 'c' + ip.channelId, kind: 'forum', title: p.displayName, id: p.id, peer: ip }
  if (p.type === 'user' && !p.isBot && !p.isSelf) return { key: 'u' + ip.userId, kind: 'dm', title: p.displayName, id: p.id, peer: ip }
  return null
}

// ---- data ----
function upsert(conv, m) {
  const key = k(conv.key, m.topicId)
  const list = (state.msgs[key] ??= [])
  const i = list.findIndex((x) => x.id === m.id)
  if (i >= 0) list[i] = m; else list.push(m)
  list.sort((a, b) => a.id - b.id)
}
const upsertRaw = (conv, raw) => upsert(conv, toMsg(raw, conv.kind === 'forum'))
const patch = (convKey, id, fn) => {
  for (const [key, list] of Object.entries(state.msgs))
    if (key.startsWith(convKey + ':')) state.msgs[key] = list.map((m) => (m.id === id ? fn(m) : m))
}

async function loadMessages(conv, topic, older = false) {
  try {
    const existing = state.msgs[k(conv.key, topic)] ?? []
    const offsetId = older && existing.length ? existing[0].id : 0
    if (conv.kind === 'forum') {
      const res = await tg.call({
        _: 'messages.getReplies', peer: conv.peer, msgId: topic, offsetId, offsetDate: 0,
        addOffset: 0, limit: 100, maxId: 0, minId: 0, hash: Long.ZERO,
      })
      rememberPeers(res)
      for (const m of res.messages) if (m._ === 'message') upsertRaw(conv, m)
    } else {
      const res = await tg.getHistory(conv.id, { limit: 100, offset: offsetId ? { id: offsetId, date: 0 } : undefined })
      for (const m of res) { if (m.sender) names.set(String(m.sender.id), m.sender.displayName); upsertRaw(conv, m.raw) }
    }
  } catch (e) { return fail(e) }
  render()
}

async function openTopic(conv, topic) {
  state.active = { conv: conv.key, topic }
  state.thread = null; state.results = null
  render({ forceBottom: true })
  await loadMessages(conv, topic)
}

async function selectRail(key) {
  state.rail = key; state.results = null
  if (key === 'dm') return render()
  const conv = convOf(key)
  if (!conv) return render()
  try {
    const list = await tg.getForumTopics(conv.id, { limit: 100 })
    state.topics[key] = [...list].map((t) => ({ id: t.id, title: t.title }))
    render()
    if (state.topics[key].length && matchMedia('(min-width: 801px)').matches) await openTopic(conv, state.topics[key][0].id)
  } catch (e) { fail(e) }
}

// ---- real-time ----
function onRaw({ update: u, peers }) {
  for (const [id, user] of peers.users) names.set(String(id), userName(user))
  if (['updateNewChannelMessage', 'updateNewMessage', 'updateEditChannelMessage', 'updateEditMessage'].includes(u._)) {
    const m = u.message
    if (m._ !== 'message') return
    const conv = convOf(peerKey(m.peerId) ?? '')
    if (!conv) return
    upsertRaw(conv, m)
  } else if (u._ === 'updateDeleteChannelMessages') {
    const key = 'c' + u.channelId, ids = new Set(u.messages)
    for (const kk of Object.keys(state.msgs)) if (kk.startsWith(key + ':')) state.msgs[kk] = state.msgs[kk].filter((m) => !ids.has(m.id))
  } else if (u._ === 'updateMessageReactions') {
    const key = peerKey(u.peer)
    if (!key) return
    const r = toMsg({ id: 0, date: 0, reactions: u.reactions }, false).reactions
    patch(key, u.msgId, (x) => ({ ...x, reactions: r }))
  } else return
  render()
}

// ---- aksi ----
const activeConv = () => (state.active ? convOf(state.active.conv) : undefined)
const sendParams = (parent) => {
  const conv = activeConv(), p = {}
  if (!conv) return p
  if (conv.kind === 'forum' && state.active.topic !== 1) p.threadId = state.active.topic
  if (parent != null) p.replyTo = parent
  return p
}
const sender = (parent) => ({
  async text(text) {
    const conv = activeConv(); if (!conv) return
    const sent = await tg.sendText(conv.id, text, sendParams(parent))
    upsertRaw(conv, sent.raw); render()
  },
  async file(file, caption) {
    const conv = activeConv(); if (!conv) return
    const sent = await tg.sendMedia(conv.id, { type: 'auto', file, caption }, sendParams(parent))
    upsertRaw(conv, sent.raw); render()
  },
})

async function react(m, emoji) {
  const conv = activeConv(); if (!conv) return
  const mine = m.reactions.find((r) => r.mine)?.emoji
  patch(conv.key, m.id, (x) => { // optimistik
    let rs = x.reactions.map((r) => (r.mine ? { ...r, count: r.count - 1, mine: false } : r)).filter((r) => r.count > 0)
    if (mine !== emoji) {
      const ex = rs.find((r) => r.emoji === emoji)
      rs = ex ? rs.map((r) => (r === ex ? { ...r, count: r.count + 1, mine: true } : r)) : [...rs, { emoji, count: 1, mine: true }]
    }
    return { ...x, reactions: rs }
  })
  render()
  try { await tg.sendReaction({ chatId: conv.id, message: m.id, emoji: mine === emoji ? null : emoji }) } catch (e) { fail(e) }
}

async function search(q) {
  const conv = activeConv()
  if (!conv || !q.trim()) { state.results = null; return render() }
  try {
    const res = await tg.searchMessages({ chatId: conv.id, query: q.trim(), limit: 40 })
    state.results = [...res].map((m) => { if (m.sender) names.set(String(m.sender.id), m.sender.displayName); return toMsg(m.raw, conv.kind === 'forum') })
    state.thread = null
  } catch (e) { return fail(e) }
  render()
}

async function createTopic(title) {
  const conv = convOf(state.rail)
  state.newTopic = null
  if (!conv || !title.trim()) return render()
  try { await tg.createForumTopic({ chatId: conv.id, title: title.trim() }); await selectRail(state.rail) } catch (e) { fail(e) }
}

// ---- tampilan ----
let els
let mainComposer, threadComposer
let lastTopCount = -1

function render(opts = {}) {
  if (!els) return
  els.app.classList.toggle('show-main', !!state.active)
  const conv = activeConv()
  const list = state.active ? state.msgs[k(state.active.conv, state.active.topic)] ?? [] : []
  const byId = new Map(list.map((m) => [m.id, m]))
  const threads = new Map()
  for (const m of list) {
    if (m.parentId === null) continue
    const r = rootOf(m.id, byId)
    if (r !== m.id) threads.set(r, [...(threads.get(r) ?? []), m])
  }
  const top = list.filter((m) => m.parentId === null || !byId.has(m.parentId))
  const topicTitle = (id) => (state.topics[state.active?.conv] ?? []).find((t) => t.id === id)?.title ?? '…'
  const forums = state.convs.filter((c) => c.kind === 'forum')
  const dms = state.convs.filter((c) => c.kind === 'dm')

  // rail
  fill(els.rail,
    h('button', { class: state.rail === 'dm' ? 'on' : '', title: 'Pesan langsung', onclick: () => selectRail('dm') }, '✉'),
    h('div', { class: 'rail-list' }, forums.map((c) => h('button', { class: state.rail === c.key ? 'on' : '', title: c.title, onclick: () => selectRail(c.key) }, c.title.slice(0, 2).toUpperCase()))),
    h('button', { title: 'Keluar', onclick: logout }, '⎋'))

  // sidebar
  const items = state.rail === 'dm' ? dms.map((c) => ({ id: 0, label: c.title, conv: c }))
    : (state.topics[state.rail] ?? []).map((t) => ({ id: t.id, label: t.title, conv: convOf(state.rail) }))
  const railConv = convOf(state.rail)
  const newInput = state.newTopic !== null && h('input', {
    class: 'newtopic', placeholder: 'nama-channel', value: state.newTopic,
    onblur: () => { state.newTopic = null; render() },
    onkeydown: (e) => { if (e.key === 'Enter') createTopic(e.target.value); if (e.key === 'Escape') { state.newTopic = null; render() } },
  })
  fill(els.side, 
    h('h2', {}, state.rail === 'dm' ? 'Pesan langsung' : railConv?.title ?? ''),
    !forums.length && state.rail !== 'dm' && h('p', { class: 'muted small pad' }, 'Belum ada grup dengan Topics. Buat grup di Telegram, aktifkan Topics, lalu muat ulang.'),
    h('div', { class: 'section' }, h('span', {}, state.rail === 'dm' ? 'Percakapan' : 'Channel'),
      state.rail !== 'dm' && railConv && h('button', { title: 'Channel baru', onclick: () => { state.newTopic = ''; render(); els.side.querySelector('.newtopic')?.focus() } }, '+')),
    newInput,
    items.map((it) => h('button', {
      class: 'item' + (state.active?.conv === it.conv.key && state.active.topic === it.id ? ' on' : ''),
      onclick: () => openTopic(it.conv, it.id),
    }, (state.rail === 'dm' ? '● ' : '# ') + it.label)))

  // main
  const oldFeed = els.main.querySelector('.feed')
  const nearBottom = !oldFeed || oldFeed.scrollHeight - oldFeed.scrollTop - oldFeed.clientHeight < 80
  const oldTop = oldFeed?.scrollTop ?? 0
  if (!conv || !state.active) {
    fill(els.main, h('div', { class: 'empty muted' }, 'Pilih channel di sebelah kiri.'))
  } else {
    mainComposer.setPlaceholder(`Kirim pesan ke ${conv.kind === 'dm' ? conv.title : '#' + topicTitle(state.active.topic)}`)
    const feed = h('div', { class: 'feed' },
      h('button', { class: 'older', onclick: () => loadMessages(conv, state.active.topic, true) }, 'Muat pesan lebih lama'),
      top.map((m) => {
        const rs = threads.get(m.id)
        return messageEl(m, { convKey: conv.key, replies: rs?.length, last: rs?.[rs.length - 1]?.date,
          onThread: () => { state.results = null; state.thread = m.id; render() }, onReact: (e) => react(m, e) })
      }))
    const search_ = h('input', { class: 'search', placeholder: `Cari di ${conv.title}`, value: els.query ?? '',
      oninput: (e) => { els.query = e.target.value }, onkeydown: (e) => e.key === 'Enter' && search(e.target.value) })
    fill(els.main, 
      h('header', {}, h('button', { class: 'back', onclick: () => { state.active = null; state.thread = null; state.results = null; render() } }, '←'), h('b', {}, conv.kind === 'dm' ? conv.title : '# ' + topicTitle(state.active.topic)), search_),
      state.error && h('div', { class: 'banner', onclick: () => { state.error = ''; render() } }, state.error + ' ✕'),
      feed, mainComposer.el)
    const grew = top.length !== lastTopCount
    lastTopCount = top.length
    if (opts.forceBottom || (nearBottom && grew)) feed.scrollTop = feed.scrollHeight
    else feed.scrollTop = oldTop
  }

  // panel thread / hasil search
  const rootMsg = state.thread != null ? byId.get(state.thread) : undefined
  els.thread.hidden = !(rootMsg || state.results)
  clear(els.thread)
  if (state.results) {
    add(els.thread, 
      h('header', {}, h('b', {}, `Hasil: ${state.results.length}`), h('button', { onclick: () => { state.results = null; render() } }, '✕')),
      h('div', { class: 'feed' },
        !state.results.length && h('p', { class: 'muted pad' }, 'Tidak ada hasil.'),
        state.results.map((m) => h('div', { class: 'result', onclick: () => conv && openTopic(conv, m.topicId || 0) },
          conv?.kind === 'forum' && h('div', { class: 'muted small' }, '# ' + topicTitle(m.topicId)),
          messageEl(m, { convKey: conv?.key, onReact: () => {} })))))
  } else if (rootMsg) {
    const rs = threads.get(rootMsg.id) ?? []
    add(els.thread, 
      h('header', {}, h('b', {}, 'Thread'), h('button', { onclick: () => { state.thread = null; render() } }, '✕')),
      h('div', { class: 'feed' },
        messageEl(rootMsg, { convKey: conv.key, onReact: (e) => react(rootMsg, e) }),
        h('div', { class: 'divider' }, `${rs.length} balasan`),
        rs.map((m) => messageEl(m, { convKey: conv.key, onReact: (e) => react(m, e) }))),
      threadComposer.el)
    threadComposer.parent = rootMsg.id
  }
}

// ---- boot ----
export async function startApp(root) {
  clear(root)
  els = {
    rail: h('nav', { class: 'rail' }), side: h('aside', { class: 'side' }),
    main: h('main', { class: 'main' }), thread: h('aside', { class: 'thread', hidden: true }),
  }
  els.app = h('div', { class: 'app' }, els.rail, els.side, els.main, els.thread)
  root.append(els.app)
  mainComposer = makeComposer({ placeholder: 'Kirim pesan', onSend: (t) => sender(null).text(t), onFile: (f, c) => sender(null).file(f, c) })
  threadComposer = makeComposer({ placeholder: 'Balas…',
    onSend: (t) => sender(threadComposer.parent).text(t), onFile: (f, c) => sender(threadComposer.parent).file(f, c) })

  tg.onRawUpdate.add(onRaw)
  render()
  try {
    for await (const d of tg.iterDialogs({ limit: 100 })) {
      const c = convFromPeer(d.peer)
      if (c) { state.convs.push(c); names.set(String(d.peer.id), d.peer.displayName) }
    }
    state.rail = state.convs.find((c) => c.kind === 'forum')?.key ?? 'dm'
    render()
    await selectRail(state.rail)
  } catch (e) { fail(e) }
}
