// Per-viewer settings in localStorage, under `ids-input:<name>`. Every read and write may fail (a
// private window, storage blocked); the page then runs on its defaults.

/** @param {string} name @param {any} fallback */
export function load(name, fallback) {
  try {
    const raw = localStorage.getItem(`ids-input:${name}`)
    return raw === null ? fallback : JSON.parse(raw)
  } catch { return fallback }
}

/** @param {string} name @param {any} value */
export function save(name, value) {
  try {
    if (value === undefined) localStorage.removeItem(`ids-input:${name}`)
    else localStorage.setItem(`ids-input:${name}`, JSON.stringify(value))
  } catch { /* Storage unavailable: the setting lasts for this visit. */ }
}
