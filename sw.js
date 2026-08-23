/* OpenSpec Local Viewer service worker.
   Bump CACHE_VERSION together with the app version in index.html
   (see AGENTS.md) so each release deploys a fresh cache. */
const CACHE_VERSION = 'osviewer-3.5.0';

const SHELL = [
  './',
  './index.html',
  './index.js',
  './index.css',
  './imports.js',
  './styles/reset.css',
  './styles/variables.css',
  './styles/global.css',
  './lib/html-literal.js',
  './lib/tiny-signals.js',
  './lib/marked.umd.min.js',
  './lib/js-yaml.min.js',
  './lib/purify.min.js',
  './lib/fuse.min.js',
  './app/state.js',
  './app/render.js',
  './app/diff.js',
  './app/store.js',
  './app/annotations.js',
  './app/prompt.js',
  './app/search.js',
  './components/osv-folder-rail/osv-folder-rail.js',
  './components/osv-folder-rail/osv-folder-rail.css',
  './components/osv-header/osv-header.js',
  './components/osv-header/osv-header.css',
  './components/osv-search/osv-search.js',
  './components/osv-search/osv-search.css',
  './components/osv-file-list/osv-file-list.js',
  './components/osv-file-list/osv-file-list.css',
  './components/osv-pane/osv-pane.js',
  './components/osv-pane/osv-pane.css',
  './components/osv-review/osv-review.js',
  './components/osv-review/osv-review.css',
  './components/osv-loading/osv-loading.js',
  './components/osv-loading/osv-loading.css',
  './components/osv-toast/osv-toast.js',
  './components/osv-toast/osv-toast.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then((c) => c.addAll(SHELL))
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

  // Everything else (app shell, libs, icons): cache-first.
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
