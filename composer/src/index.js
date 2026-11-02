// The composer exports ids-input draws from: han-compose's `export-web` output, stored one folder per
// version in this Worker's own R2 bucket and served under `/<version>/`. A version never changes once
// stored, so its files are cached for good, and a file a version lacks stays missing: that answer is
// kept at the edge for five minutes too. Any site may read them: an export is public and read-only,
// and a read sends no credentials.
//
// The bucket serves whatever it holds. Publishing is a copy into it (`scripts/publish_composer_export.sh`),
// so a new export needs no deploy here; `versions.json` at the root lists them, newest first.
const FILE = /^(?:[A-Za-z0-9_-]{1,64}\/){0,4}[A-Za-z0-9_-][A-Za-z0-9_.-]{0,127}\.(?:json|txt)(?:\.gz)?$/
const TYPES = { json: 'application/json', txt: 'text/plain; charset=utf-8' }
const SHARED = { 'access-control-allow-origin': '*', 'cross-origin-resource-policy': 'cross-origin' }

/** The answer to another site's preflight for an export file. */
export const preflight = () => new Response(null, { status: 204, headers: {
  ...SHARED, 'access-control-allow-methods': 'GET, HEAD, OPTIONS', 'access-control-max-age': '86400' } })

/** `/<version>/` or `/<version>/<file>`, or null where the path names no file of an export. */
function split(path) {
  const trimmed = path.replace(/^\/+/, '')
  const slash = trimmed.indexOf('/')
  if (slash < 0) return trimmed === 'versions.json' ? { key: 'versions.json' } : null
  const version = trimmed.slice(0, slash), file = trimmed.slice(slash + 1)
  if (!/^[A-Za-z0-9_.+-]{1,96}$/.test(version) || !FILE.test(file) || file.includes('..')) return null
  return { key: `${version}/${file}`, version }
}

/** Whether a key holds gzip bytes the client unpacks: a record shard (`g/`) or a host list (`p/`). */
const isShard = key => /^[^/]+\/[gp]\//.test(key)

/**
 * A file of an export, a 404 when the version lacks it, or null when the path names no file of one.
 * @param {{ COMPOSER: { get(key: string): Promise<any> } }} env
 * @param {string} path
 * @param {Request} [request]
 * @param {{ waitUntil(work: Promise<any>): void }} [ctx]
 */
export async function composerFile(env, path, request, ctx) {
  const found = split(path)
  if (!found) return null
  const cache = request && typeof caches !== 'undefined' ? caches.default : null
  const key = request ? new Request(new URL(new URL(request.url).pathname, request.url)) : null
  const hit = cache && key ? await cache.match(key) : undefined
  if (hit) return hit
  let object
  try {
    object = await env.COMPOSER.get(found.key)
  } catch (error) {
    return Response.json({ detail: 'The export store could not be read.' }, { status: 503,
      headers: { 'cache-control': 'no-store', ...SHARED } })
  }
  const response = object ? new Response(object.body, { headers: {
    // A record and a host list are gzip bytes under a .json name, which the client unpacks itself:
    // sent as bytes, so nothing on the way decodes or compresses them again.
    'content-type': isShard(found.key) || found.key.endsWith('.gz')
      ? 'application/octet-stream' : TYPES[found.key.split('.').pop()] ?? 'application/octet-stream',
    'content-length': String(object.size), etag: object.httpEtag,
    'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff', ...SHARED,
  } }) : Response.json({ detail: 'No such composer file.' },
    { status: 404, headers: { 'cache-control': 'public, max-age=300', ...SHARED } })
  if (cache && key && ctx) ctx.waitUntil(cache.put(key, response.clone()))
  return response
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (request.method === 'OPTIONS') return preflight()
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return Response.json({ detail: 'Only GET and HEAD.' }, { status: 405, headers: SHARED })
    }
    const response = await composerFile(env, url.pathname, request, ctx)
      ?? Response.json({ detail: 'No such path. An export is /<version>/<file>.' }, { status: 404, headers: SHARED })
    return request.method === 'HEAD' ? new Response(null, { status: response.status, headers: response.headers }) : response
  },
}
