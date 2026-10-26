// Handing a file to the viewer: a Blob behind an object URL, saved by a click on a link to it. File
// names keep the sequence, with what file systems refuse taken out.

/** @param {Blob} blob @param {string} name */
export function download(blob, name) {
  const url = URL.createObjectURL(blob)
  const link = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** A file name for `sequence` with `extension`: ⿰亻哥 → ⿰亻哥.svg. @param {string} sequence @param {string} extension */
export const fileName = (sequence, extension) => `${(sequence.replace(/[\\/:*?"<>|\p{Cc}]/gu, '').trim() || 'ids').slice(0, 64)}.${extension}`
