import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// The recognizer's WebAssembly runtime is read from the package at serve and build time, so no
// 12 MB binary lives in the repository.
const ORT = ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']
const ORT_DIR = fileURLToPath(new URL('../node_modules/onnxruntime-web/dist/', import.meta.url))
const ORT_ALIAS = fileURLToPath(new URL('../node_modules/onnxruntime-web/dist/ort.wasm.min.mjs', import.meta.url))

function ortAssets() {
  return {
    name: 'ort-assets',
    configureServer(server) {
      server.middlewares.use('/ort', (request, response, next) => {
        const name = decodeURIComponent((request.url ?? '').split('?')[0].replace(/^\//, ''))
        if (!ORT.includes(name)) return next()
        response.setHeader('Content-Type', name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript')
        response.end(readFileSync(join(ORT_DIR, name)))
      })
    },
    writeBundle() {
      const out = join(import.meta.dirname, '..', 'dist', 'ort')
      mkdirSync(out, { recursive: true })
      for (const name of ORT) copyFileSync(join(ORT_DIR, name), join(out, name))
    },
  }
}

// A static site served at the root of https://ids.mkpo.li/ (GitHub Pages with a custom domain).
export default defineConfig({
  root: import.meta.dirname,
  base: '/',
  plugins: [svelte(), ortAssets()],
  resolve: { alias: { 'onnxruntime-web/wasm': ORT_ALIAS } },
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022',
    rollupOptions: { input: { index: `${import.meta.dirname}/index.html`, compare: `${import.meta.dirname}/compare.html`, engines: `${import.meta.dirname}/engines.html`, embed: `${import.meta.dirname}/embed.html`, design: `${import.meta.dirname}/design.html` } } },
  server: { fs: { allow: ['..'] } },
})
