import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/bebe/',
  plugins: [react()],
  worker: {
    // Vite's default IIFE worker format can't have ESM exports; pdf.js's
    // worker is an ES module (uses import/export), so it needs 'es' here.
    format: 'es',
  },
})
