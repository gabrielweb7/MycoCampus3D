/**
 * MycoCampus3D — Service Worker (PWA & Offline Cache)
 * Permite que o jogo seja instalado no Android/iOS como aplicativo nativo,
 * execute em tela cheia sem barra de navegador e carregue instantaneamente.
 */

const CACHE_NAME = 'mycocampus-v2.11.24';
const STATIC_ASSETS = [
  './',
  'index.html',
  'catalogo.html',
  'css/item-catalog.css',
  'manifest.webmanifest',
  'css/tailwind.min.css?v=0.8.3',
  'css/game.css?v=2.11.24',
  'js/vendor/three.bundle.min.js',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/favicon-32.png',
  'assets/apple-touch-icon.png',
  'assets/textures/campus-grass.jpg',
  'assets/textures/village-dirt.jpg',
  'assets/og-image.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[PWA] Aviso no pré-cache de ativos:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('message', (event) => {
  if (event && event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim()).then(() => {
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          try { client.postMessage({ type: 'SW_ACTIVATED', cacheName: CACHE_NAME }); } catch (e) {}
        });
      });
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Não intercepta chamadas de API dinâmica ou arquivo VERSION (sempre direto da rede)
  if (url.pathname.includes('/api/') || url.pathname.endsWith('/VERSION') || event.request.method !== 'GET') {
    return;
  }

  // Estratégia Network-First sem HTTP disk cache para HTML, JS e CSS (nunca misturar versões antigas)
  const isCodeOrDoc = event.request.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname === '/';

  if (isCodeOrDoc) {
    const netPromise = (event.request.mode === 'navigate')
      ? fetch(event.request.url, { cache: 'no-cache', credentials: 'same-origin', redirect: 'follow' })
      : fetch(new Request(event.request, { cache: 'no-cache' }));

    event.respondWith(
      netPromise.then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Stale-While-Revalidate apenas para imagens/ícones/ativos estáticos
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
