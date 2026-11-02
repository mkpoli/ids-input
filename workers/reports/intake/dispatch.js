// The report as the dispatch carries it: the fields the dialog sent, as strings, and the origin it
// was served from. The uploaded image stays behind, since the action takes the drawing from the site
// itself, and nothing else of the request travels.

/**
 * The report a `repository_dispatch` carries, in the shape the action reads it.
 * @param {Record<string, unknown>} payload the `client_payload`
 * @returns {{ origin: string, form: FormData }}
 */
export function formOf(payload) {
  const fields = payload?.report
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new Error('The dispatch carried no report.')
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) if (typeof value === 'string') form.set(name, value)
  return { origin: typeof payload.origin === 'string' ? payload.origin : '', form }
}
