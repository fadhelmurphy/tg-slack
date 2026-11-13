import { defineConfig } from 'vite'

// base './' agar jalan di sub-path GitHub Pages.
// @mtcute dikecualikan dari pre-bundle supaya mtcute.wasm (new URL(..., import.meta.url)) terbaca benar.
export default defineConfig({
  base: './',
  optimizeDeps: { exclude: ['@mtcute/web', '@mtcute/wasm'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 3000 },
})
