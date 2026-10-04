import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    base: process.env.BASE_URL || '/tiens-bon/',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        manifest: {
          id: '/tiens-bon/',
          name: 'Tiens Bon',
          short_name: 'Tiens Bon',
          description: 'Compagnon local et bienveillant pour arrêter de fumer à la maison.',
          theme_color: '#065f46',
          background_color: '#fafaf9',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/tiens-bon/',
          scope: '/tiens-bon/',
          shortcuts: [
            {
              name: "J'ai une envie",
              short_name: 'Envie',
              description: "Ouvrir immédiatement l'écran d'aide pour surmonter une envie",
              url: '/tiens-bon/?craving=1',
              icons: [
                {
                  src: '/icon.svg',
                  sizes: '192x192',
                  type: 'image/svg+xml',
                },
              ],
            },
          ],
          icons: [
            {
              src: '/tiens-bon/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/tiens-bon/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/tiens-bon/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: '/tiens-bon/icon.svg',
              sizes: '192x192 512x512',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/zod')) {
              return 'vendor-zod';
            }
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      hmr: false,
    },
  };
});
