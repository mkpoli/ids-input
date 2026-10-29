// Emit the package's declarations, replacing any left from an earlier run.
// Called from the `types` and `prepack` scripts. The compiler is resolved and run through this
// Node process because bun does not add node_modules/.bin to PATH for lifecycle scripts, and the
// package's bin is a script with a shebang, which Windows cannot spawn directly.
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const packagePath = require.resolve('tsrs/package.json')
const { bin } = require(packagePath)
const launcher = join(dirname(packagePath), typeof bin === 'string' ? bin : bin.tsrs)

rmSync(new URL('../types', import.meta.url), { recursive: true, force: true })
const { status, error } = spawnSync(process.execPath, [launcher, '-p', fileURLToPath(new URL('../tsconfig.json', import.meta.url))], { stdio: 'inherit' })
if (error) throw error
process.exit(status ?? 1)
