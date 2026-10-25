// @ts-check
// Shortcuts written as the platform writes them: ⌘ and ⇧ on Apple systems, Ctrl+ and Shift+ elsewhere.

/** Whether the page runs on an Apple system, where the command key is ⌘. */
export const isApple = () => {
  const nav = /** @type {Navigator & { userAgentData?: { platform?: string } } | undefined} */ (globalThis.navigator)
  return /mac|iphone|ipad|ipod/i.test(nav?.userAgentData?.platform || nav?.platform || nav?.userAgent || '')
}

/**
 * `combo` (`mod+shift+z`, `backspace`, `1`) as the platform writes it: `⌘⇧Z` or `Ctrl+Shift+Z`.
 * @param {string} combo
 * @param {boolean} [apple]
 */
export function shortcut(combo, apple = isApple()) {
  const NAMES = /** @type {Record<string, [string, string]>} */ ({
    mod: ['⌘', 'Ctrl'], shift: ['⇧', 'Shift'], alt: ['⌥', 'Alt'], backspace: ['⌫', 'Backspace'], delete: ['⌦', 'Del'],
    enter: ['↩', 'Enter'], tab: ['⇥', 'Tab'], escape: ['Esc', 'Esc'],
  })
  const keys = combo.split('+').map(key => NAMES[key.toLowerCase()]?.[apple ? 0 : 1] ?? (key.length === 1 ? key.toUpperCase() : key))
  return apple ? keys.join('') : keys.join('+')
}
