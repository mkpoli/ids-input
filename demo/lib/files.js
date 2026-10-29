// Handing a file to the viewer: a Blob behind an object URL, saved by a click on a link to it. File
// names keep the sequence, with what file systems refuse taken out.

/** @param {Blob} blob @param {string} name */
export function download(blob, name) {
  const url = URL.createObjectURL(blob)
  const link = Object.assign(document.createElement('a'), { href: url, download: name, hidden: true })
  const release = () => { link.remove(); URL.revokeObjectURL(url) }
  try {
    document.body.append(link)
    link.click()
  } catch (error) {
    release()
    throw error
  }
  // Allow time for the browser to hand the file to its download manager.
  // There is no completion event for an anchor download, so bound its lifetime.
  setTimeout(release, 60_000)
}

/** A stem safe for a download, cut by code points so surrogate pairs stay whole. @param {string} sequence @param {number} [length] */
export const fileStem = (sequence, length = 40) => [...sequence].filter(char => !/[\\/:*?"<>|\p{Cc}]/u.test(char)).slice(0, length).join('').trim() || 'ids'

/** A file name for `sequence` with `extension`: ⿰亻哥 → ⿰亻哥.svg. @param {string} sequence @param {string} extension */
export const fileName = (sequence, extension) => `${fileStem(sequence)}.${extension}`
