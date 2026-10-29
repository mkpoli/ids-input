import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// A static site served at the root of https://ids.mkpo.li/ (GitHub Pages with a custom domain).
export default defineConfig({
  root: import.meta.dirname,
  base: '/',
  plugins: [svelte()],
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022',
    rollupOptions: { input: { index: `${import.meta.dirname}/index.html`, compare: `${import.meta.dirname}/compare.html`, engines: `${import.meta.dirname}/engines.html`, embed: `${import.meta.dirname}/embed.html` } } },
  server: { fs: { allow: ['..'] } },
})
