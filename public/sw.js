// Service Worker for GENTLEMEN Barber Lounge PWA, Auto-Updates & Web Push
const SW_VERSION = 'v4.5.0';
const CACHE_NAME = `gentlemen-cache-${SW_VERSION}`;

// Precache essential static assets (exclude html/root to prevent stale html caching)
const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/apple-touch-icon-180x180.png',
  '/apple-touch-icon-152x152.png',
  '/apple-touch-icon-120x120.png',
  '/apple-touch-icon-precomposed.png',
  '/logo.svg',
  '/logo.png'
];

self.addEventListener('install', (event) => {
  // Activate new service worker immediately
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Precache partial warning:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Clean up ALL older cache buckets from previous versions immediately
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cache) => {
            if (cache !== CACHE_NAME) {
              console.log('SW: Purging old cache bucket:', cache);
              return caches.delete(cache);
            }
          })
        );
      }),
      // Take control of all open client tabs immediately
      self.clients.claim()
    ])
  );
});

// Fetch Strategy:
// 1. For HTML/Navigation requests -> Always Network First, fallback to cached index.html only if completely offline
// 2. For static assets (JS/CSS) -> Cache First with strict MIME validation to prevent HTML poisoning
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Ignore non-GET requests or Firebase / API calls
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Do NOT intercept Firestore, Google APIs, or backend API routes
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('identitytoolkit')
  ) {
    return;
  }

  // HTML Navigation Requests -> Network First (fresh server version), fallback to cache only if network fails
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
    );
    return;
  }

  // Static Assets (JS / CSS / Images)
  const isJs = url.pathname.endsWith('.js');
  const isCss = url.pathname.endsWith('.css');

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Strict MIME verification: If cached response is text/html for a JS/CSS file, discard corrupted cache!
      if (cachedResponse) {
        const ct = cachedResponse.headers.get('content-type') || '';
        if (isJs && !ct.includes('javascript')) {
          caches.open(CACHE_NAME).then((c) => c.delete(request));
          cachedResponse = null;
        } else if (isCss && !ct.includes('css')) {
          caches.open(CACHE_NAME).then((c) => c.delete(request));
          cachedResponse = null;
        }
      }

      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const ct = networkResponse.headers.get('content-type') || '';
          // NEVER cache HTML responses for .js or .css files (which happens when SPA rewrites 404 to index.html)
          if (isJs && !ct.includes('javascript')) {
            return networkResponse;
          }
          if (isCss && !ct.includes('css')) {
            return networkResponse;
          }
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return networkResponse;
      });
    })
  );
});

// Handle incoming Web Push (FCM / Server Web Push payload)
self.addEventListener('push', (event) => {
  let data = {
    title: 'GENTLEMEN BARBER LOUNGE',
    body: 'သင့်ထံသို့ အသိပေးချက်အသစ် ရောက်ရှိပါသည် (New Notification)',
    tag: 'gentlemen-notif',
    url: '/',
  };

  try {
    if (event.data) {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    image: data.image || undefined,
    tag: data.tag || `notif-${Date.now()}`,
    renotify: true,
    vibrate: [150, 80, 150],
    data: {
      dateOfArrival: Date.now(),
      url: data.url || '/',
      notifId: data.notifId,
    },
    actions: [
      { action: 'open', title: 'ကြည့်ရှုမည် (View)' },
      { action: 'close', title: 'ပိတ်မည် (Dismiss)' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle clicking on notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            data: event.notification.data,
          });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Handle messages from the React app
self.addEventListener('message', (event) => {
  if (event.data) {
    if (event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    } else if (event.data.type === 'CLEAR_CACHES') {
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
    } else if (event.data.type === 'SHOW_LOCAL_NOTIFICATION') {
      const payload = event.data.payload || {};
      self.registration.showNotification(payload.title || 'GENTLEMEN LOUNGE', {
        body: payload.body || '',
        icon: payload.icon || '/icon-192.png',
        badge: payload.badge || '/icon-192.png',
        vibrate: [120, 60, 120],
        data: { url: '/', timestamp: Date.now() },
      });
    }
  }
});
