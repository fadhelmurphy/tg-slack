import { TelegramClient } from '@mtcute/web'

const KEY = 'tgs_cred'
export const creds = {
  get() { try { return JSON.parse(localStorage.getItem(KEY)) || {} } catch { return {} } },
  set(apiId, apiHash) { localStorage.setItem(KEY, JSON.stringify({ apiId: Number(apiId), apiHash })) },
}

/** @type {TelegramClient} */
export let tg

// Sesi disimpan otomatis di IndexedDB ("tg-slack"). Kripto MTProto memakai mtcute.wasm.
export function createClient() {
  const { apiId, apiHash } = creds.get()
  tg = new TelegramClient({ apiId, apiHash, storage: 'tg-slack' })
  return tg
}

export async function resume() {
  const { apiId, apiHash } = creds.get()
  if (!apiId || !apiHash) return false
  createClient()
  try { await tg.getMe(); return true } catch { return false }
}

export async function login(apiId, apiHash, ui) {
  creds.set(apiId, apiHash)
  createClient()
  await tg.start({
    phone: ui.phone,
    code: ui.code,
    password: ui.password,
    invalidCodeCallback: (type) => ui.onError(type === 'code' ? 'Kode salah' : 'Password salah'),
  })
}

export async function logout() {
  try { await tg.logOut() } catch { /* abaikan */ }
  location.reload()
}
