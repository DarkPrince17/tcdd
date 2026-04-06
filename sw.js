const CACHE = 'tcdd-v1';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['/']))
  );
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('/check')) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

self.addEventListener('message', e => {
  if (e.data.type === 'START_CHECK') {
    const { config } = e.data;
    startPolling(config);
  }
  if (e.data.type === 'STOP_CHECK') {
    stopPolling();
  }
});

let pollTimer = null;
let backendUrl = '';

function startPolling(config) {
  stopPolling();
  backendUrl = config.backendUrl;
  check(config);
  pollTimer = setInterval(() => check(config), config.interval);
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

async function check(config) {
  try {
    const r = await fetch(`${config.backendUrl}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kalkis: config.kalkis,
        varis: config.varis,
        tarih: config.tarih,
        saat: config.saat || null
      })
    });
    const data = await r.json();

    self.clients.matchAll().then(clients => {
      clients.forEach(c => c.postMessage({ type: 'CHECK_RESULT', data }));
    });

    if (data.bilet_var) {
      const sefer = data.seferler.find(s => s.bos);
      self.registration.showNotification('Bilet Çıktı!', {
        body: `${config.kalkis} → ${config.varis} | ${sefer.saat} seferi müsait! (${sefer.musait_koltuk} koltuk)`,
        icon: '/static/icon.png',
        badge: '/static/icon.png',
        vibrate: [200, 100, 200, 100, 200],
        tag: 'bilet-bulundu',
        renotify: true,
        requireInteraction: true,
        actions: [{ action: 'open', title: 'TCDD\'ye Git' }]
      });
    }
  } catch (err) {
    self.clients.matchAll().then(clients => {
      clients.forEach(c => c.postMessage({ type: 'CHECK_ERROR', error: err.message }));
    });
  }
}

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'open') {
    clients.openWindow('https://bilet.tcdd.gov.tr');
  }
});
