/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

// Clean up previous caches
cleanupOutdatedCaches();

// Precache app shell files provided by Vite build injection
precacheAndRoute(self.__WB_MANIFEST || []);

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Security requirement Item 12: Never cache /api responses
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api')) {
    // Let network handle directly without SW caching
    return;
  }
});
