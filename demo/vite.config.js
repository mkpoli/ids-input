import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
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
        for (const name of Object.keys(bundle)) {
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
  ...['tangut', 'bopomofo', 'new-korean', 'small-seal', 'shuishu', 'jurchen', 'palette'].map(name => `sources/${name}/outlines.json.gz`),
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

// The open data release keeps its files where the build script writes them, under
// data/open-data/, and serves them at /data/open-data/: the page links to stable paths, and the
// build puts the same directory beside the app.
const OPEN_DATA = fileURLToPath(new URL('../data/open-data/', import.meta.url))
const OPEN_DATA_TYPES = { '.json': 'application/json; charset=utf-8', '.tsv': 'text/tab-separated-values; charset=utf-8', '.md': 'text/markdown; charset=utf-8' }

function openData() {
  return {
    name: 'open-data',
    configureServer(server) {
      server.middlewares.use('/data/open-data', (request, response, next) => {
        let name
        try { name = decodeURIComponent((request.url ?? '').split('?')[0].replace(/^\//, '')) } catch { return next() }
        const file = join(OPEN_DATA, name)
        if (!name || name.startsWith('.') || name.includes('/') || !existsSync(file) || !statSync(file).isFile()) return next()
        response.setHeader('Content-Type', OPEN_DATA_TYPES[extname(file)] ?? 'application/octet-stream')
        response.end(readFileSync(file))
      })
    },
    writeBundle() {
      const out = join(import.meta.dirname, '..', 'dist', 'data', 'open-data')
      mkdirSync(out, { recursive: true })
      for (const name of ['descriptions.json', 'descriptions.tsv', 'components.tsv', 'manifest.json', 'README.md']) {
        if (existsSync(join(OPEN_DATA, name))) copyFileSync(join(OPEN_DATA, name), join(out, name))
      }
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
  plugins: [lazyFallbackFont(), svelte(), ortAssets(), engineOutlines(), openData()],
  resolve: { alias: { 'onnxruntime-web/wasm': ORT_ALIAS } },
  // The drawing engine starts its Worker from `new URL('./worker.js', import.meta.url)`, which Vite
  // resolves from source; pre-bundled, that URL points nowhere.
  optimizeDeps: { exclude: ['@han-compose/composer'] },
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022',
    // A fallback shard is fetched when a character needs it; inlined, the small ones would ride in
    // the first scripts as base64, which hardly compresses.
    assetsInlineLimit: file => file.endsWith('.woff2') ? false : undefined,
    rollupOptions: { input: { index: `${import.meta.dirname}/index.html`, compare: `${import.meta.dirname}/compare.html`, engines: `${import.meta.dirname}/engines.html`, sources: `${import.meta.dirname}/sources.html`, embed: `${import.meta.dirname}/embed.html`, design: `${import.meta.dirname}/design.html`, 'open-data': `${import.meta.dirname}/open-data.html`, unencoded: `${import.meta.dirname}/unencoded.html` } } },
  // The drawing engine's files, outside this checkout's root: a dependency that is a directory is
  // read where it stands, and its Worker is a `file:` module the page asks for by that path.
  server: { fs: { strict: false, allow: ['..', join(import.meta.dirname, '..', 'node_modules', '@han-compose', 'composer')] } },
})
