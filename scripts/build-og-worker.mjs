// Bundle the configured Worker and WASM for local runtime verification without deploying.
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

execFileSync('bunx', ['--no-install', 'wrangler', 'deploy', '--dry-run', '--outdir', 'dist-worker'], {
  cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: 'inherit',
})
