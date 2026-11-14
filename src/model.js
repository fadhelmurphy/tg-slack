// Konversi pesan TL mentah (objek { _: 'message', ... }) ke model UI.
export const names = new Map() // id (string) -> nama

export const userName = (u) => [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || 'Pengguna'

export function rememberPeers({ users = [], chats = [] }) {
  for (const u of users) if (u.id != null) names.set(String(u.id), userName(u))
  for (const c of chats) if (c.id != null && c.title) names.set(String(c.id), c.title)
}

export const peerKey = (p) => (!p ? null : p._ === 'peerChannel' ? 'c' + p.channelId : p._ === 'peerUser' ? 'u' + p.userId : p._ === 'peerChat' ? 'g' + p.chatId : null)

export function topicAndParent(m, isForum) {
  const rt = m.replyTo && m.replyTo._ === 'messageReplyHeader' ? m.replyTo : null
  if (!isForum) return { topicId: 0, parentId: rt?.replyToMsgId ?? null }
  if (!rt) return { topicId: 1, parentId: null } // topic General
  if (rt.forumTopic) {
    const topicId = rt.replyToTopId ?? rt.replyToMsgId
    return { topicId, parentId: rt.replyToMsgId !== topicId ? rt.replyToMsgId : null }
  }
  return { topicId: 1, parentId: rt.replyToMsgId ?? null } // balasan di General
}

export function toMsg(m, isForum) {
  const { topicId, parentId } = topicAndParent(m, isForum)
  // di chat privat pesan masuk sering tanpa fromId: pengirimnya adalah lawan bicara (peerId)
  const fromId = m.fromId?.userId ?? m.fromId?.channelId ?? (m.peerId?._ === 'peerUser' && !m.out ? m.peerId.userId : '')
  let media = null
  if (m.media?._ === 'messageMediaPhoto') media = { kind: 'photo', name: 'foto.jpg', size: 0 }
  else if (m.media?._ === 'messageMediaDocument' && m.media.document?._ === 'document') {
    const d = m.media.document
    const fn = d.attributes.find((a) => a._ === 'documentAttributeFilename')
    const st = d.attributes.find((a) => a._ === 'documentAttributeSticker')
    if (st && d.mimeType === 'image/webp') media = { kind: 'sticker', name: 'stiker.webp', size: Number(d.size) }
    else if (st) media = { kind: 'file', name: (st.alt || '') + ' stiker', size: Number(d.size) }
    else media = { kind: 'file', name: fn?.fileName ?? 'berkas', size: Number(d.size) }
  }
  const reactions = (m.reactions?.results ?? [])
    .filter((r) => r.reaction?._ === 'reactionEmoji')
    .map((r) => ({ emoji: r.reaction.emoticon, count: r.count, mine: r.chosenOrder != null }))
  return {
    id: m.id, topicId, parentId, date: m.date, senderId: String(fromId),
    senderName: names.get(String(fromId)) ?? (m.out ? 'Saya' : 'Pengguna'),
    text: m.message ?? '', media, reactions, raw: m,
  }
}

/** Akar thread: ikuti rantai balasan sampai level atas. */
export function rootOf(id, byId) {
  let cur = byId.get(id), guard = 0
  while (cur && cur.parentId !== null && byId.has(cur.parentId) && guard++ < 200) cur = byId.get(cur.parentId)
  return cur ? cur.id : id
}
