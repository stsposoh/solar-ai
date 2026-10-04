import { defineConfig } from 'vite'

// GitHub Pages serves the project under /solar-ai/; local dev stays at the root.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/solar-ai/' : '/',
  server: {
    port: 5173,
    strictPort: false,
  },
}))
