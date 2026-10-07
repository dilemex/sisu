import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/sisu/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        workbox: {
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          navigateFallback: 'index.html',
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'pages',
                networkTimeoutSeconds: 3
              }
            }
          ]
        }
      },
      manifest: {
        // ... igual ao que já está
      }
    })
  ]
})