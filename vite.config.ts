import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/', // IMPORTANT per a PWABuilder i Android

  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',

      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'robots.txt'
      ],

      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/sw\.js$/,
          /^\/manifest\.webmanifest$/,
          /^\/manifest\.json$/,
          /^\/api\//
        ]
      },

      manifest: {
        id: '/',
        name: 'ThermoSafe – Risc climàtic',
        short_name: 'ThermoSafe',
        description:
          'Consulta el risc per calor, fred i vent segons la teva ubicació amb dades oficials i notificacions automàtiques.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#f59e0b',
        orientation: 'portrait',
        lang: 'ca',

        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable any'
          }
        ]
      }
    })
  ]
})