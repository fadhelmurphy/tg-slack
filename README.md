# TG Slack (JS murni + WebAssembly)

Klon Slack di atas Telegram, full frontend tanpa server dan tanpa framework UI.
Memakai [`@mtcute/web`](https://github.com/mtcute/mtcute): MTProto via WebSocket, sesi di IndexedDB, kripto (AES-IGE, SHA, gzip) lewat **WebAssembly** (`mtcute.wasm`).

## Pemetaan
| Slack | Telegram |
|---|---|
| Workspace | Supergroup dengan **Topics** aktif |
| Channel | Topic |
| Thread | Balasan ke sebuah pesan (dikelompokkan di klien) |
| DM | Chat privat |
| Reaksi, file, search | Fitur bawaan Telegram |

## Jalankan
1. Ambil **API ID** dan **API Hash** di https://my.telegram.org (API development tools).
2. `npm install && npm run dev`
3. Isi API ID/Hash, lalu login dengan nomor, kode, dan password 2FA (jika ada).

Deploy: push ke `main`, aktifkan Pages (Source: GitHub Actions).

## Struktur
`src/tg.js` klien dan login, `src/model.js` konversi pesan, `src/app.js` state/real-time/render, `src/message.js` pesan dan composer, `src/login.js` form login, `src/dom.js` helper DOM.

## Catatan
- Sesi (IndexedDB) setara akses penuh ke akunmu. Jangan host di domain bersama yang tidak kamu kontrol.
- Private channel = grup terpisah (Topics tidak bisa disembunyikan per member).
- Belum ada: notifikasi saat tab tertutup, bot/slash command, section channel, unread badge.
