// Rock-Solid Service Worker for GENTLEMAN Barber Lounge PWA, 100% Offline Capability & Web Push
const SW_VERSION = 'v-2026.10.04-rocksolid-v2';
const CACHE_NAME = `gentleman-cache-${SW_VERSION}`;

// Precache essential static assets & Offline App Shell
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/apple-touch-icon-180x180.png',
  '/logo.svg',
  '/logo.png'
];

self.addEventListener('install', (event) => {
  // Activate new service worker immediately without waiting
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Use allSettled so one missing icon NEVER fails the precaching of index.html & shell!
      await Promise.allSettled(
        CORE_ASSETS.map((url) =>
          fetch(url, { cache: 'no-cache' })
            .then((res) => {
              if (res && res.status === 200) {
                return cache.put(url, res);
              }
            })
            .catch((err) => console.warn(`Precache skipped for ${url}:`, err))
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Clean up old cache buckets
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cache) => {
            if (cache !== CACHE_NAME) {
              console.log('SW: Purging obsolete cache:', cache);
              return caches.delete(cache);
            }
          })
        );
      }),
      // Immediately take control of all active clients
      self.clients.claim()
    ])
  );
});

// Fetch Strategy:
// 1. Navigation / Document requests -> Network-first, with guaranteed fallback to cached /index.html
// 2. Local Static Assets (JS, CSS, Images, Fonts) -> Stale-While-Revalidate / Cache-First
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Ignore non-GET requests
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Do NOT intercept Firestore or Google Auth backend API routes
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('identitytoolkit')
  ) {
    return;
  }

  // 1. HTML Navigation Requests (Visiting pages, refreshing, or opening PWA while offline)
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy.clone());
              cache.put('/index.html', copy);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // Offline fallback: Return cached HTML
          const cached =
            (await caches.match(request)) ||
            (await caches.match('/index.html')) ||
            (await caches.match('/'));
          if (cached) return cached;
          return new Response('<h1>GENTLEMAN Barber Lounge</h1><p>Offline App Shell loading...</p>', {
            headers: { 'Content-Type': 'text/html' }
          });
        })
    );
    return;
  }

  // 2. Same-Origin Assets (JS, CSS, Images, Manifest, Icons)
  if (url.origin === self.location.origin) {
    const isCodeAsset = url.pathname.endsWith('.js') || url.pathname.endsWith('.css');

    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        // Validate MIME type to prevent HTML poisoning
        if (cachedResponse) {
          const ct = cachedResponse.headers.get('content-type') || '';
          if (isCodeAsset && ct.includes('text/html')) {
            caches.open(CACHE_NAME).then((c) => c.delete(request));
            cachedResponse = null;
          }
        }

        const networkFetch = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const ct = networkResponse.headers.get('content-type') || '';
              // Do not cache HTML for JS/CSS files
              if (isCodeAsset && ct.includes('text/html')) {
                return networkResponse;
              }
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
            }
            return networkResponse;
          })
          .catch(() => {
            return cachedResponse;
          });

        return cachedResponse || networkFetch;
      })
    );
  }
});

// Handle incoming Web Push (FCM / Server Web Push payload)
self.addEventListener('push', (event) => {
  let data = {
    title: 'GENTLEMAN BARBERSHOP',
    body: 'သင့်ထံသို့ အသိပေးချက်အသစ် ရောက်ရှိပါသည်',
    tag: 'gentleman-notif',
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
      self.registration.showNotification(payload.title || 'GENTLEMAN BARBERSHOP', {
        body: payload.body || '',
        icon: payload.icon || '/icon-192.png',
        badge: payload.badge || '/icon-192.png',
        vibrate: [120, 60, 120],
        data: { url: '/', timestamp: Date.now() },
      });
    }
  }
});
