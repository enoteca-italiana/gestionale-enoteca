import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      devOptions: {
        // Keep SW generation for production only: in dev this can leave stale
        // service workers that interfere with local startup/cache refresh.
        enabled: false
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}']
      },
      manifest: {
        id: '/',
        name: 'Enoteca Italiana',
        short_name: 'Enoteca',
        description: 'Gestione scarichi vino in enoteca',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#fbf6ea',
        theme_color: '#7c164a',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-192x192-maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/pwa-512x512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('exceljs')) return 'vendor_excel';
          if (id.includes('jspdf') || id.includes('jspdf-autotable')) return 'vendor_pdf';
          if (id.includes('@supabase/supabase-js')) return 'vendor_supabase';
          return undefined;
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': new URL('./src', import.meta.url).pathname
    }
  },
  server: {
    port: 5173,
    strictPort: true
  },
  preview: {
    host: true,
    strictPort: true,
    allowedHosts: true
  }
});
