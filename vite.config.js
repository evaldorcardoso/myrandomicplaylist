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
      type: 'module',
      navigateFallback: 'index.html'
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
      description: 'Painel de curadoria de playlists do Spotify',
      lang: 'pt-BR',
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
  // The app is served from the domain root (e.g. Vercel). `publicPath` was an
  // invalid Vite option and was silently ignored, so this preserves the existing
  // behavior. Change this (and the router base) if you ever host under a subpath.
  base: '/',
})
