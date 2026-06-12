import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Defaults to the site root for local dev/preview. On GitHub Pages the app is
// served from a repo subpath (https://<user>.github.io/click/), so the deploy
// workflow sets VITE_BASE=/click/. The Globe reads import.meta.env.BASE_URL to
// load its bundled country atlas, and the SW/manifest paths derive from this too.
const base = process.env.VITE_BASE || '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      // A new build waits rather than seizing control mid-run — the in-app
      // Update prompt (<PwaPrompts>) lets the player reload on their terms.
      registerType: 'prompt',
      injectRegister: null,
      // public/manifest.webmanifest is hand-authored and authoritative.
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,json,webmanifest,woff2}'],
        // The three.js/globe bundle is ~2.75 MB; precache it so the app runs offline.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
        // Never SPA-fallback future backend routes (a LiveGameClient).
        navigateFallbackDenylist: [/^\/api\//, /^\/ws\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'gc-font-css' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'gc-font-files',
              expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5174,
    // No backend in this UI-first build — the app runs on the in-browser
    // MockGameClient. When a Go backend lands, restore an /api + /ws proxy here.
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
