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

// Handle notification click to bring app to foreground (Step 14)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client && typeof client.focus === 'function') {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/?reminder=1');
      }
    }),
  );
});

// Web Push event for reminders (Step 5b & Step 14)
self.addEventListener('push', (event) => {
  let title = 'Tiens Bon';
  let body = 'Un petit instant de pause prévu pour toi.';

  if (event.data) {
    try {
      const payload = event.data.json();
      if (payload.title) title = payload.title;
      if (payload.body) body = payload.body;
    } catch {
      const text = event.data.text();
      if (text) body = text;
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      tag: 'tiens-bon-reminder',
    }),
  );
});
