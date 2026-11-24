import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (normalized.includes('/node_modules/')) {
            if (
              normalized.includes('/react/') ||
              normalized.includes('/react-dom/') ||
              normalized.includes('/scheduler/')
            ) {
              return 'vendor-react';
            }
            if (normalized.includes('/dexie')) {
              return 'vendor-db';
            }
            if (normalized.includes('/@firebase/auth') || normalized.includes('/firebase/auth')) {
              return 'vendor-firebase-auth';
            }
            if (normalized.includes('/firebase/') || normalized.includes('/@firebase/')) {
              return 'vendor-firebase';
            }
            if (
              normalized.includes('/adhan/') ||
              normalized.includes('/lucide-react/')
            ) {
              return 'vendor-libs';
            }
          }
          if (normalized.includes('/src/data/duas')) {
            return 'data-duas';
          }
          if (
            normalized.includes('/src/data/surahs') ||
            normalized.includes('/src/data/surahDescriptions')
          ) {
            return 'data-surahs';
          }
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'fonts/indopak-nastaleeq.woff2',
        'fonts/sura_names.woff2',
      ],
      manifest: {
        name: 'সুকূন — হৃদয়ের প্রশান্তিতে কুরআন ও দুআর নিত্যসঙ্গী',
        short_name: 'সুকূন',
        description:
          'সুকূন — হৃদয়ের প্রশান্তিতে কুরআন ও দুআর নিত্যসঙ্গী। অফলাইন-ফার্স্ট কুরআন তিলাওয়াত ও দৈনন্দিন রুটিন অ্যাপ।',
        theme_color: '#FAF6EE',
        background_color: '#FAF6EE',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'bn',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
});
