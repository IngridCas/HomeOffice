import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' // <--- Verifica esta línea

export default defineConfig({
  plugins: [react()],
  base: './', // Esto es vital para que Azure no de pantalla en blanco
})