import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import loadVersion from 'vite-plugin-package-version'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  assetsInclude: ['**/*.png'],
  plugins: [vue(), tailwindcss(), loadVersion(), VitePWA({ 
    registerType: 'autoUpdate',
    strategies: 'injectManifest',
    srcDir: 'src',
    filename: 'sw.ts',
    devOptions: {
      enabled: true,
      type: 'module'
    },
    injectManifest: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      sourcemap: true,
      maximumFileSizeToCacheInBytes: 4 * 1024 * 1024
    },
    includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
    manifest: {
      name: 'MR Playlist',
      short_name: 'MRP',
      description: 'Gerador de playlist aleatória do Spotify',
      theme_color: '#62faf5',
      icons: [
        {
          src: '/launchericon-192x192.png',
          sizes: '192x192',
          type: 'image/png'
        },
        {
          src: '/launchericon-512x512.png',
          sizes: '512x512',
          type: 'image/png'
        },
        {
           src: '/launchericon-512x512.png',
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
  publicPath: process.env.NODE_ENV === 'production' ? '/mrplaylist/' : '/',
})
