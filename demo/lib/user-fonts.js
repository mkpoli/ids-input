// Fonts a reader brings. Each package keeps its bytes, the name of the face and the licence it came
// with, in IndexedDB (a font is megabytes, past what localStorage holds), and registers as a family
// the fallback stacks try before the bundled shards.
const DB = 'ids-input-fonts'
const STORE = 'fonts'
const VERSION = 1

/** @typedef {{ id: string, name: string, licence: string, family: string, bytes: ArrayBuffer }} UserFont */

/** @returns {Promise<IDBDatabase>} */
function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, VERSION)
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE, { keyPath: 'id' }) }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** @param {IDBTransactionMode} mode @returns {Promise<IDBObjectStore>} */
async function store(mode) {
  const db = await open()
  return db.transaction(STORE, mode).objectStore(STORE)
}

/** Every stored font, oldest first. @returns {Promise<UserFont[]>} */
export async function listUserFonts() {
  const object = await store('readonly')
  return new Promise((resolve, reject) => {
    const request = object.getAll()
    request.onsuccess = () => resolve(/** @type {UserFont[]} */ (request.result).sort((a, b) => a.id.localeCompare(b.id)))
    request.onerror = () => reject(request.error)
  })
}

/**
 * Adds a font file to the package: its bytes, the name of the face and the licence it carries.
 * @param {{ name: string, licence: string, bytes: ArrayBuffer }} input
 * @returns {Promise<UserFont>}
 */
export async function addUserFont({ name, licence, bytes }) {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const font = { id, name, licence, family: `IDS User Font ${id}`, bytes }
  const object = await store('readwrite')
  await new Promise((resolve, reject) => {
    const request = object.add(font)
    request.onsuccess = () => resolve(undefined)
    request.onerror = () => reject(request.error)
  })
  return font
}

/** @param {string} id */
export async function removeUserFont(id) {
  const object = await store('readwrite')
  await new Promise((resolve, reject) => {
    const request = object.delete(id)
    request.onsuccess = () => resolve(undefined)
    request.onerror = () => reject(request.error)
  })
}

/** Registers one package's face; a font the browser cannot read is skipped. @param {UserFont} font */
export async function registerUserFont(font) {
  try {
    const face = new FontFace(font.family, font.bytes)
    await face.load()
    document.fonts.add(face)
    return true
  } catch {
    return false
  }
}
