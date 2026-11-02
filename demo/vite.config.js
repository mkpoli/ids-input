import { copyFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// The recognizer's WebAssembly runtime is read from the package at serve and build time, so no
// 12 MB binary lives in the repository.
const { version: VERSION } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

const ORT = ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']
const ORT_DIR = fileURLToPath(new URL('../node_modules/onnxruntime-web/dist/', import.meta.url))
const ORT_ALIAS = fileURLToPath(new URL('../node_modules/onnxruntime-web/dist/ort.wasm.min.mjs', import.meta.url))

// The fallback webfont's shards load on demand (src/svelte/fallback-font.js): the build takes its
// `@font-face` rules out of the stylesheet and writes a list of the published shards the app reads,
// so the page asks for only the ranges it shows. The dev server serves the files as they are.
const CSS_FACE = /@font-face\{[^}]*IDS Fallback[^}]*\}/g

function lazyFallbackFont() {
  return {
    name: 'lazy-fallback-font',
    enforce: 'pre',
    apply: 'build',
    generateBundle(_, bundle) {
      for (const asset of Object.values(bundle)) {
        if (!asset.fileName.endsWith('.css')) continue
        const text = typeof asset.source === 'string' ? asset.source : new TextDecoder().decode(asset.source)
        if (!text.match(CSS_FACE)) continue
        asset.source = text.replace(CSS_FACE, '')
        // The published shards' names, which the app reads to build each face's URL.
        const files = {}
        for (const [name, file] of Object.entries(bundle)) {
          const match = /^(?:assets\/)?([0-9a-f]{3})-[^/]+\.woff2$/.exec(name)
          if (match) files[match[1]] = name
        }
        this.emitFile({ type: 'asset', fileName: 'unicode.json', source: JSON.stringify({ files }) })
      }
    },
  }
}

// The outlines the drawing engine draws without an export, served from the demo's own bundle: each
// file as an asset of its own name under `assets/`, and a module naming every one by the path the
// engine reads it at.
const ENGINE_DATA = fileURLToPath(new URL('../node_modules/@han-compose/composer/data/', import.meta.url))
const ENGINE_OUTLINES = [
  ...['tangut', 'bopomofo', 'new-korean', 'small-seal', 'shuishu', 'palette'].map(name => `sources/${name}/outlines.json.gz`),
  ...readdirSync(join(ENGINE_DATA, 'unicode/outlines')).map(file => `unicode/outlines/${file}`),
]
const ENGINE_MODULE = '\0ids-engine-outlines'
function engineOutlines() {
  let done = false, base = '/'
  return {
    name: 'engine-outlines',
    configResolved(config) { base = config.base.endsWith('/') ? config.base : `${config.base}/` },
    resolveId: id => id === 'ids-engine-outlines' ? ENGINE_MODULE : null,
    // The files are read from the package, which stands outside this checkout's root.
    configureServer(server) { server.middlewares.use((request, response, next) => {
      const path = decodeURIComponent((request.url ?? '').split('?')[0])
      if (!path.startsWith(`${base}assets/`)) return next()
      const name = path.slice(`${base}assets/`.length)
      if (!ENGINE_OUTLINES.includes(name)) return next()
      response.setHeader('content-type', 'application/octet-stream')
      response.end(readFileSync(join(ENGINE_DATA, name)))
    }) },
    load(id) {
      if (id !== ENGINE_MODULE) return null
      // Emitted once, whatever asks for the module and however often it is loaded.
      if (!done) {
        done = true
        for (const path of ENGINE_OUTLINES) this.emitFile({ type: 'asset', fileName: `assets/${path}`, source: readFileSync(join(ENGINE_DATA, path)) })
      }
      // The page's own address, so a page served under a path finds them too.
      return `export default ${JSON.stringify(Object.fromEntries(ENGINE_OUTLINES.map(path => [path, `${base}assets/${path}`])))}`
    },
  }
}

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

// A static site served at the root of https://ids.mkpo.li/ behind the worker in `worker/`, which
// answers any path with the app so a sequence can live in the path.
export default defineConfig({
  root: import.meta.dirname,
  base: '/',
  // What the page says it is when someone reports a problem: the package's version and the commit
  // the deploy built, `dev` for a build the CI did not make.
  define: {
    __APP_VERSION__: JSON.stringify(VERSION),
    __BUILD_COMMIT__: JSON.stringify(process.env.GITHUB_SHA || process.env.VITE_BUILD_COMMIT || 'dev'),
  },
  plugins: [lazyFallbackFont(), svelte(), ortAssets(), engineOutlines()],
  resolve: { alias: { 'onnxruntime-web/wasm': ORT_ALIAS } },
  // The drawing engine starts its Worker from `new URL('./worker.js', import.meta.url)`, which Vite
  // resolves from source; pre-bundled, that URL points nowhere.
  optimizeDeps: { exclude: ['@han-compose/composer'] },
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022',
    rollupOptions: { input: { index: `${import.meta.dirname}/index.html`, compare: `${import.meta.dirname}/compare.html`, engines: `${import.meta.dirname}/engines.html`, embed: `${import.meta.dirname}/embed.html`, design: `${import.meta.dirname}/design.html` } } },
  // The drawing engine's files, outside this checkout's root: a dependency that is a directory is
  // read where it stands, and its Worker is a `file:` module the page asks for by that path.
  server: { fs: { strict: false, allow: ['..', join(import.meta.dirname, '..', 'node_modules', '@han-compose', 'composer')] } },
})
