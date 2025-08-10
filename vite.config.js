import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import loadVersion from 'vite-plugin-package-version'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  assetsInclude: ['**/*.png'],
  plugins: [vue(), loadVersion(), VitePWA({ 
    registerType: 'autoUpdate',
    devOptions: {
      enabled: true
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      sourcemap: true,
      runtimeCaching: [
          {
            // Cachear imagens do Spotify
            urlPattern: /^https:\/\/image-cdn-ak\.spotifycdn\.com\/.*$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'spotify-images-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 dias
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
      ],
      // Ignorar recursos externos não configurados
      navigateFallbackDenylist: [
        /^https:\/\/image-cdn-ak\.spotifycdn\.com/
      ]
    },
    includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
    manifest: {
      name: 'My Randomic Playlist',
      short_name: 'MRP',
      description: 'Gerador de playlist aleatória do Spotify',
      theme_color: '#62faf5',
      icons: [
        {
          src: '/pwa-192x192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: '/pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png'
        },
        {
          src: '/pwa-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    }, 
  })],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  publicPath: process.env.NODE_ENV === 'production' ? '/myrandomicplaylist/' : '/',
})
