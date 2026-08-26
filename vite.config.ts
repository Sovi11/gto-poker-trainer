import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves from /gto-poker-trainer/, Cloudflare Pages (the primary
// deploy, which sets CF_PAGES) serves from the root, and dev stays at the
// root. `vite preview` runs in serve mode, so it needs the production base
// too — otherwise it serves at / while the built HTML points at the subpath,
// and every asset 404s into the SPA fallback.
const onCloudflare = Boolean(process.env.CF_PAGES);
export default defineConfig(({ command, isPreview }) => ({
  base: !onCloudflare && (command === 'build' || isPreview) ? '/gto-poker-trainer/' : '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon-32.png', 'icon.svg'],
      manifest: {
        name: 'Fold Call or Jam — GTO Poker Trainer',
        short_name: 'Fold Call Jam',
        description:
          'Learn GTO poker properly: a daily puzzle, 50 lessons with playable hands, graded drills, a real CFR solver, and bots with exploitable personalities.',
        theme_color: '#0d1210',
        background_color: '#0d1210',
        display: 'standalone',
        orientation: 'portrait',
        categories: ['education', 'games'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Google Fonts are the only external request the app makes; cache them
        // so an installed app still renders correctly offline.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
}));
