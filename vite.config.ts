import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Ruta base para GitHub Pages (https://<usuario>.github.io/<repositorio>/).
 * - El workflow de GitHub Actions define VITE_BASE=/<nombre-del-repositorio>/.
 * - Sin VITE_BASE se usa una base relativa ("./"), válida para cualquier nombre de
 *   repositorio y para abrir `npm run preview` localmente.
 * - En desarrollo (`npm run dev`) se usa "/".
 */
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'serve' && !isPreview ? '/' : process.env.VITE_BASE || './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          leaflet: ['leaflet', 'react-leaflet'],
          charts: ['recharts'],
          xlsx: ['xlsx'],
        },
      },
    },
  },
}));
