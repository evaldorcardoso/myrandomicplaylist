import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import loadVersion from 'vite-plugin-package-version'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), loadVersion(), VitePWA({ 
    registerType: 'autoUpdate',
    devOptions: {
      enabled: true
    },
    includeAssets: ['favicon.ico', 'apple-icon-180x180.png', 'masked-icon.svg'],
    manifest: {
      name: 'My Randomic Playlist',
      short_name: 'MRP',
      description: 'Gerador de playlist aleatória do Spotify',
      theme_color: '#62faf5',
      icons: [
        {
          src: 'assets/android-icon-192x192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: 'assets/mrp-logo-512x512.png',
          sizes: '512x512',
          type: 'image/png'
        },
        {
          src: 'assets/mrp-logo-512x512.png',
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
