/* OpenSpec Local Viewer service worker.
   Bump CACHE_VERSION together with the app version in index.html
   (see AGENTS.md) so each release deploys a fresh cache. */
const CACHE_VERSION = 'osviewer-1.4.0';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

const CDN_LIBS = [
  'https://cdn.jsdelivr.net/npm/marked@18/lib/marked.umd.min.js',
  'https://cdn.jsdelivr.net/npm/js-yaml@4/dist/js-yaml.min.js',
  'https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.min.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then((c) => c.addAll([...SHELL, ...CDN_LIBS]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // HTML navigation: always try the network first so deployed updates show up
  // immediately, then fall back to the cached shell when offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Everything else (app shell, CDN libs, icons): cache-first.
  e.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});