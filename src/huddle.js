// Huddle = ruang Jitsi Meet. Host bisa diganti ke Jitsi self-hosted / JaaS agar skalanya sendiri.
const KEY = 'tgs_jitsi'
export const jitsiHost = () => localStorage.getItem(KEY) || 'meet.jit.si'
export const setJitsiHost = (v) => localStorage.setItem(KEY, v.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '') || 'meet.jit.si')

// Nama ruang acak (tidak bisa ditebak); satu ruang dipakai bersama lewat pesan di channel
const rnd = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(36).padStart(2, '0')).join('')
export const newRoomUrl = () => `https://${jitsiHost()}/tgslack-${rnd()}`

/** Cari link huddle terbaru (maks 4 jam) di daftar pesan channel. */
export function findActive(list) {
  const re = new RegExp('https://' + jitsiHost().replace(/\./g, '\\.') + '/tgslack-[a-z0-9]+')
  const since = Date.now() / 1000 - 4 * 3600
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i]
    if (m.date < since) break
    const hit = re.exec(m.text)
    if (hit) return hit[0]
  }
  return null
}
