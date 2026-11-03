// A little Markdown for the catalogue notes: links, inline code, and line breaks. Everything is
// escaped first, and only http(s) links survive, so a note cannot bring markup of its own.
const ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** @param {string} text */
export function inline(text) {
  return String(text)
    .replace(/[&<>"']/g, char => ESCAPE[/** @type {keyof typeof ESCAPE} */ (char)])
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, label, url) => `<a href="${url}" target="_blank" rel="noreferrer">${label}</a>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\s*\n+\s*/g, ' ')
}
