import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

// Reuse the production security headers from vercel.json so `npm run preview` behaves like Vercel.
const vercel = JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'));
const productionHeaders = Object.fromEntries(vercel.headers[0].headers.map((h) => [h.key, h.value]));

const apiProxy = { '/api': { target: process.env.API_PROXY_TARGET || 'http://localhost:5000', changeOrigin: false } };

export default defineConfig({
  root: 'frontend',
  envDir: rootDir,
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('./shared', import.meta.url)) },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 5173,
    proxy: apiProxy,
    fs: { allow: [rootDir] },
  },
  preview: {
    port: 4173,
    proxy: apiProxy,
    headers: productionHeaders,
  },
  plugins: [
    react(),
    VitePWA({
      // Ask before updating, and never reload in the middle of a test (see UpdatePrompt.jsx).
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png', 'robots.txt'],
      manifest: {
        id: '/',
        name: 'Quiz Maker',
        short_name: 'Quiz Maker',
        description: 'Create tests, share a link, see scores instantly. No sign-up.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        lang: 'en',
        background_color: '#f5f7f8',
        theme_color: '#0b5a72',
        categories: ['education', 'productivity'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
