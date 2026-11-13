import { h, clear } from './dom.js'
import { creds, login } from './tg.js'

export function showLogin(root, onDone) {
  const saved = creds.get()
  const card = h('form', { class: 'login-card' })
  const wrap = h('div', { class: 'login' }, card)
  clear(root).append(wrap)

  const paint = (...kids) => clear(card).append(h('h1', {}, 'TG Slack'),
    h('p', { class: 'muted' }, 'Workspace gaya Slack di atas Telegram. Semua berjalan di browser kamu.'), ...kids)
  let error = h('p', { class: 'error' })
  const setError = (m) => { error.textContent = m }

  // minta satu nilai dari user; resolve saat form dikirim
  const ask = (placeholder, type = 'text') => new Promise((resolve) => {
    const input = h('input', { placeholder, type, autofocus: true })
    paint(input, h('button', { type: 'submit' }, 'Kirim'), error)
    input.focus()
    card.onsubmit = (e) => { e.preventDefault(); paint(h('p', { class: 'muted' }, 'Menghubungkan…'), error); resolve(input.value.trim()) }
  })

  const credsForm = () => {
    const id = h('input', { placeholder: 'API ID', inputMode: 'numeric', value: saved.apiId || '' })
    const hash = h('input', { placeholder: 'API Hash', value: saved.apiHash || '' })
    paint(id, hash, h('p', { class: 'muted small' }, 'Ambil dari my.telegram.org (API development tools). Disimpan hanya di browser ini.'),
      h('button', { type: 'submit' }, 'Lanjut'), error)
    card.onsubmit = async (e) => {
      e.preventDefault()
      if (!Number(id.value) || !hash.value.trim()) return setError('API ID dan API Hash wajib diisi')
      setError('')
      paint(h('p', { class: 'muted' }, 'Menghubungkan…'), error)
      try {
        await login(id.value, hash.value.trim(), {
          phone: () => ask('Nomor telepon (format +62...)'),
          code: () => ask('Kode dari Telegram'),
          password: () => ask('Password 2FA', 'password'),
          onError: (m) => setError(m),
        })
        onDone()
      } catch (err) { credsForm(); setError(err?.message || String(err)) }
    }
  }
  credsForm()
}
