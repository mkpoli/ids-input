import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// A static site: relative asset URLs, so it works under any path (GitHub Pages serves it under /ids-input/).
export default defineConfig({
  root: import.meta.dirname,
  base: './',
  plugins: [svelte()],
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022' },
  server: { fs: { allow: ['..'] } },
})
