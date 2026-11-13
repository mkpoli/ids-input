/** Run `test` with localStorage starting from `record`. @param {Record<string, string>} record @param {() => void} test */
export function withStorage(record, test) {
  const store = new Map(Object.entries(record))
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: key => store.get(key) ?? null,
      setItem: (key, value) => { store.set(key, value) },
      removeItem: key => { store.delete(key) },
    },
  })
  try { test() } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else delete globalThis.localStorage
  }
}
