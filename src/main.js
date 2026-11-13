import './styles.css'
import { resume } from './tg.js'
import { showLogin } from './login.js'
import { startApp } from './app.js'

const root = document.getElementById('root')
root.innerHTML = '<div class="login"><p class="muted">Menghubungkan…</p></div>'
resume().then((ok) => (ok ? startApp(root) : showLogin(root, () => startApp(root)))).catch(() => showLogin(root, () => startApp(root)))
