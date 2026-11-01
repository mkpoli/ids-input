// What Vite adds to a module: a stylesheet's text, and every asset's URL.
declare module '*?raw' {
  const text: string
  export default text
}

interface ImportMeta {
  glob: (pattern: string | string[], options?: { query?: string, import?: string, eager?: boolean }) => Record<string, string>
}
