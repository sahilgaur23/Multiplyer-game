import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  server: {
    allowedHosts: ['f0c0-2401-4900-8838-3e3b-c3c-97f4-54ad-3d45.ngrok-free.app']
  },
  plugins: [react()],
})
