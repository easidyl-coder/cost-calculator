// 파일을 고쳤으면 아래 버전 문자열을 바꾼다 (한 곳). app.js 의 APP_VER 도 같이 올린다.
// 인터넷이 되면 항상 새 파일을 받고(받은 것은 저장), 인터넷이 안 되면 저장해 둔 파일을 쓴다.
const VERSION = 'wongagesan-v10';
const FILES = ['./', './index.html', './style.css', './calc.js', './app.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png',
  './lib/pdf.min.js', './lib/pdf.worker.min.js', './lib/mammoth.browser.min.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
