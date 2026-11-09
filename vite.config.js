import { defineConfig } from 'vite';

// Servidor local solo en 127.0.0.1 (no expuesto a la red).
export default defineConfig({
  // GitHub Pages sirve en /vaca3d-neuro/; Netlify (NETLIFY=true) en la raíz
  base: process.env.NETLIFY ? '/' : '/vaca3d-neuro/',
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
  build: { chunkSizeWarningLimit: 1500 },
});
