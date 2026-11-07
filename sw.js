const CACHE_NAME = 'testlab-v11';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './src/ai-prompt.js',
  './src/csv-bank.js',
  './src/grade.js',
  './src/image-url.js',
  './src/import-bank.js',
  './src/json-bank.js',
  './src/library.js',
  './src/render-history.js',
  './src/render-library.js',
  './src/render-question.js',
  './src/report.js',
  './src/repository.js',
  './src/score.js',
  './src/session.js',
  './src/storage.js',
  './src/text.js',
  './src/validate-bank.js'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    })
  );
});

// Network First strategy
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, resClone);
        });
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

