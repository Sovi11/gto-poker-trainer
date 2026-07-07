import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Production builds are served from GitHub Pages under /gto-poker-trainer/;
// dev stays at the root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/gto-poker-trainer/' : '/',
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
}));
