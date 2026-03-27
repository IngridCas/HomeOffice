// client/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/react-swc'

export default defineConfig({
  plugins: [react()],
  base: './', // <--- ESTA ES LA LÍNEA MÁGICA
})