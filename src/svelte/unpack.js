// A gzipped JSON file of the package's own `data/`, read once.

/**
 * The bytes of a file, as text: gunzipped when it is gzip, decoded as UTF-8 either way.
 * @param {ArrayBuffer} buffer
 * @returns {Promise<string>}
 */
export async function unpack(buffer) {
  const head = new Uint8Array(buffer, 0, 2)
  if (head[0] !== 0x1f || head[1] !== 0x8b) return new TextDecoder().decode(buffer)
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))
  return await new Response(stream).text()
}
