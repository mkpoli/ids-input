// The desktop app (`desktop/`) runs this page in a webview built with VITE_DESKTOP=1. It holds the
// sans export among its own files and answers for it under the `atlas` scheme; links and reports
// leave for the published site, since the page's own origin exists only inside the app.

/** The published workshop. */
export const SITE = 'https://ids.mkpo.li/'

export const DESKTOP = import.meta.env?.VITE_DESKTOP === '1'

/** A scheme the desktop app answers, as its webview spells it: WebView2 reaches one as
 *  `http://<name>.localhost/`, WebKit as `<name>://localhost/`. @param {string} name */
const scheme = name => /Windows/.test(navigator.userAgent) ? `http://${name}.localhost/` : `${name}://localhost/`

/** Where the desktop app serves the sans export, or null outside it. */
export const LOCAL_SANS = DESKTOP ? scheme('atlas') : null
