// Sefer service worker: uygulamayı internetsiz de açar.
// Yeni sürüm yayınlarken CACHE adındaki numarayı artır.
const CACHE = 'sefer-v53';
const SHELL = ['./', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png', './js/config.js', './js/vendor/supabase.js', './js/vendor/591.supabase.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Sayfanın kendisi: önce internet (güncel sürüm), yoksa önbellek.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return res;
    }).catch(() => caches.match('./index.html')));
    return;
  }
  // Satır İzi köprüsü (Kitaplar sekmesi): önce internet ki Satır İzi güncellenince eskisi kalmasın, yoksa önbellek.
  if (new URL(req.url).pathname.includes('/satir-izi/')) {
    e.respondWith(fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req)));
    return;
  }
  // Diğer dosyalar ve yazı tipleri: önce önbellek, yoksa internet.
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});

// Bildirimler
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  const m = /^nc?-([a-z]+)-(\d{4}-\d\d-\d\d|test)$/.exec(d.tag || '');
  const opt = { body: d.body || '', tag: d.tag || undefined, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: d.url || (/^rapor/.test(d.tag || '') ? './?rapor=1' : './'), kildim: m ? { id: m[1], k: m[2] } : null } };
  if (m) opt.actions = [{ action: 'kildim', title: 'Kıldım' }];
  e.waitUntil(self.registration.showNotification(d.title || 'Sefer', opt));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const data = e.notification.data || {}, kl = e.action === 'kildim' && data.kildim;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) { if ('focus' in c) { if (kl) c.postMessage({ type: 'kildim', id: kl.id, k: kl.k }); else if (/rapor=1/.test(data.url || '')) c.postMessage({ type: 'rapor' }); return c.focus(); } }
    return self.clients.openWindow(kl ? `./?kildim=${kl.id}_${kl.k}` : (data.url || './'));
  }));
});
