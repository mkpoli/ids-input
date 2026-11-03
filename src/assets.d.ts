// What Vite adds to a module: a stylesheet's text, every asset's URL, and the build's `VITE_*`
// variables, which a module read outside Vite (tests, the worker) finds absent.
declare module '*?raw' {
  const text: string
  export default text
}

interface ImportMeta {
  env?: Record<string, string | undefined>
  glob: (pattern: string | string[], options?: { query?: string, import?: string, eager?: boolean }) => Record<string, string>
}
