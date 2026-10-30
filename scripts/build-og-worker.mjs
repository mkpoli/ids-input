// Compile Pages Functions and their imported WebAssembly into the advanced-mode worker directory.
// The Pages artifact contains the compiled handler and its WASM modules.
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
mkdirSync(new URL('../dist/_worker.js/', import.meta.url), { recursive: true })
execFileSync('bunx', ['--no-install', 'wrangler', 'pages', 'functions', 'build', 'functions',
  '--outdir', 'dist/_worker.js', '--compatibility-date', '2026-08-01'], {
  cwd: root, stdio: 'inherit',
})
