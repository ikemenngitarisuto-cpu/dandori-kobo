// 段取工房 オフライン版: 電波がなくても開けるよう、ページとアイコンを端末にしまっておく。
// 扱うのは、このページ自身の置き場のファイルだけ。外のサイトには一切取りに行かない。
const CACHE = 'dandori-202610162203';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('dandori-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const wait = ms => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // ページ本体: 電波があれば新しい版を取りに行き、遅いときや圏外ならしまっておいた版を出す
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const net = fetch(req).then(res => {
        if (res && res.ok) cache.put('./index.html', res.clone());
        return res;
      });
      try {
        return await Promise.race([net, wait(3500)]);
      } catch (err) {
        const hit = (await cache.match('./index.html')) || (await cache.match('./'));
        if (hit) return hit;
        return net;
      }
    })());
    return;
  }

  // アイコンなど: しまってある版をすぐ出し、裏で新しくする
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    const net = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (hit) return hit;
    const res = await net;
    return res || new Response('', { status: 504, statusText: 'offline' });
  })());
});
