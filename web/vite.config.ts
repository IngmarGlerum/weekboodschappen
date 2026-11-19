import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// De versie van deze build: de commit op Vercel, anders het tijdstip van bouwen.
const APP_VERSION = (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7) || `lokaal-${Date.now()}`

/**
 * Schrijft version.json naast de app. De app vergelijkt die (zonder cache) met zijn eigen
 * versie; zo merkt een oude, opgeslagen kopie dat er een nieuwe versie is, ook als het
 * bijwerken van de service worker vastloopt.
 */
function versionFile(): Plugin {
  return {
    name: 'weekplanner-version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: APP_VERSION, builtAt: new Date().toISOString() }),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [
    react(),
    versionFile(),
    VitePWA({
      // Requirement 11: installable on the home screen, and the app shell works offline.
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Weekplanner',
        short_name: 'Weekplanner',
        description: 'Avondeten en boodschappen voor de hele week, samen plannen.',
        lang: 'nl',
        theme_color: '#2f855a',
        background_color: '#f7fafc',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The SQLite WebAssembly build is larger than Workbox's 2 MB default.
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,wasm}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  // PowerSync ships web workers and WebAssembly, which Vite's dependency
  // pre-bundling must leave alone.
  optimizeDeps: {
    exclude: ['@powersync/web'],
  },
  worker: {
    format: 'es',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
