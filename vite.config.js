import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  // Necessary for some older libraries that still expect 'global'
  define: {
    global: 'window',
  },
})