import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base: './' genera rutas relativas en dist/, de modo que el mismo build funciona:
//   - en GitHub Pages bajo https://<usuario>.github.io/<repositorio>/
//   - servido desde la memoria LittleFS del propio ESP32 (http://192.168.4.1/)
//   - abierto con `npm run preview` en la red local
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
  },
});
